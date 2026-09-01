import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app, prisma } from '../src/server';

const password = 'test-password-123';
let adminCookie = '';
let staffCookie = '';
let viewerCookie = '';

const loginCookie = async (identifier: string) => {
  const result = await request(app).post('/api/auth/login').send({ identifier, password });
  expect(result.status).toBe(200);
  const cookies = result.headers['set-cookie'] as string[];
  return cookies[0];
};

const setupUsers = async () => {
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.createMany({ data: [
    { username: 'admin', email: 'admin@test.local', passwordHash, role: 'admin' },
    { username: 'staff', email: 'staff@test.local', passwordHash, role: 'staff' },
    { username: 'viewer', email: 'viewer@test.local', passwordHash, role: 'viewer' },
  ] });
};

describe('production API authentication and state transitions', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    await prisma.equipmentRepair.deleteMany();
    await prisma.equipmentIssuance.deleteMany();
    await prisma.equipmentInstance.deleteMany();
    await prisma.employee.deleteMany();
    await prisma.equipmentType.deleteMany();
    await prisma.user.deleteMany();
    await setupUsers();
    [adminCookie, staffCookie, viewerCookie] = await Promise.all([
      loginCookie('admin'), loginCookie('staff'), loginCookie('viewer'),
    ]);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('requires authentication for business reads and writes', async () => {
    const dashboard = await request(app).get('/api/dashboard/stats');
    expect(dashboard.status).toBe(401);
    expect(dashboard.headers['server-timing']).toMatch(/^app;dur=\d+\.\d+$/);
    expect((await request(app).post('/api/equipment-types').send({ name: 'Notebook', unit: 'เครื่อง' })).status).toBe(401);
    expect((await request(app).get('/api/health')).status).toBe(200);
  });

  it('aggregates dashboard counts by equipment status', async () => {
    const type = await prisma.equipmentType.create({ data: { name: 'Dashboard type', unit: 'เครื่อง' } });
    await prisma.equipmentInstance.createMany({ data: [
      { serialNumber: 'DASH-001', typeId: type.id, status: 'available' },
      { serialNumber: 'DASH-002', typeId: type.id, status: 'available' },
      { serialNumber: 'DASH-003', typeId: type.id, status: 'issued' },
      { serialNumber: 'DASH-004', typeId: type.id, status: 'under_repair' },
    ] });

    const stats = await request(app).get('/api/dashboard/stats').set('Cookie', staffCookie);

    expect(stats.status).toBe(200);
    expect(stats.headers['server-timing']).toMatch(/^app;dur=\d+\.\d+$/);
    expect(stats.body).toEqual({ total: 4, available: 2, issued: 1, underRepair: 1 });
  });

  it('returns a safe user and revokes bearer tokens on logout', async () => {
    const me = await request(app).get('/api/auth/me').set('Cookie', adminCookie);
    expect(me.status).toBe(200);
    expect(me.body.user).toMatchObject({ username: 'admin', role: 'admin' });
    expect(me.body.user.passwordHash).toBeUndefined();

    const login = await request(app).post('/api/auth/login').send({ identifier: 'admin', password });
    expect(login.status).toBe(200);
    expect(typeof login.body.token).toBe('string');
    const token = login.body.token as string;
    const beforeLogout = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(beforeLogout.status).toBe(200);

    const logout = await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${token}`);
    expect(logout.status).toBe(204);
    const afterLogout = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(afterLogout.status).toBe(401);
  });

  it('updates a safe profile and invalidates sessions after password change', async () => {
    const profile = await request(app).put('/api/auth/profile').set('Cookie', adminCookie).send({
      username: 'admin-renamed',
      email: 'admin-renamed@test.local',
    });
    expect(profile.status).toBe(200);
    expect(profile.body).toEqual({ id: expect.any(Number), username: 'admin-renamed', email: 'admin-renamed@test.local', role: 'admin' });
    expect(profile.body.passwordHash).toBeUndefined();

    const wrongPassword = await request(app).post('/api/auth/change-password').set('Cookie', adminCookie).send({
      currentPassword: 'wrong-password',
      newPassword: 'newpass8',
    });
    expect(wrongPassword.status).toBe(400);
    expect(wrongPassword.body.code).toBe('INVALID_CURRENT_PASSWORD');

    const changed = await request(app).post('/api/auth/change-password').set('Cookie', adminCookie).send({
      currentPassword: password,
      newPassword: 'newpass8',
    });
    expect(changed.status).toBe(204);
    expect(changed.body).toEqual({});

    const oldSession = await request(app).get('/api/auth/me').set('Cookie', adminCookie);
    expect(oldSession.status).toBe(401);
    const newLogin = await request(app).post('/api/auth/login').send({ identifier: 'admin-renamed', password: 'newpass8' });
    expect(newLogin.status).toBe(200);
    expect(newLogin.body.user.passwordHash).toBeUndefined();
    expect(typeof newLogin.body.token).toBe('string');
  });

  it('enforces viewer and staff roles', async () => {
    const viewerWrite = await request(app).post('/api/equipment-types').set('Cookie', viewerCookie).send({ name: 'Viewer type', unit: 'ชิ้น' });
    expect(viewerWrite.status).toBe(403);
    const staffWrite = await request(app).post('/api/equipment-types').set('Cookie', staffCookie).send({ name: 'Staff type', unit: 'ชิ้น' });
    expect(staffWrite.status).toBe(201);
    const staffDelete = await request(app).delete(`/api/equipment-types/${staffWrite.body.id}`).set('Cookie', staffCookie);
    expect(staffDelete.status).toBe(403);
    const users = await request(app).get('/api/users').set('Cookie', staffCookie);
    expect(users.status).toBe(403);
  });

  it('supports safe admin user CRUD and protects the last administrator', async () => {
    const created = await request(app).post('/api/users').set('Cookie', adminCookie).send({
      username: 'managed-user',
      email: 'managed-user@test.local',
      password: 'eight888',
      role: 'viewer',
    });
    expect(created.status).toBe(201);

    const tooShort = await request(app).post('/api/users').set('Cookie', adminCookie).send({
      username: 'too-short-password',
      email: 'too-short-password@test.local',
      password: 'seven77',
      role: 'viewer',
    });
    expect(tooShort.status).toBe(400);
    expect(created.body).toMatchObject({ username: 'managed-user', role: 'viewer' });
    expect(created.body.passwordHash).toBeUndefined();

    const listed = await request(app).get('/api/users').set('Cookie', adminCookie);
    expect(listed.status).toBe(200);
    expect(listed.body).toEqual(expect.arrayContaining([expect.objectContaining({ id: created.body.id, username: 'managed-user' })]));

    const updated = await request(app).put(`/api/users/${created.body.id}`).set('Cookie', adminCookie).send({ role: 'staff', password: 'newpass8' });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ id: created.body.id, role: 'staff' });
    expect(updated.body.passwordHash).toBeUndefined();

    const removed = await request(app).delete(`/api/users/${created.body.id}`).set('Cookie', adminCookie);
    expect(removed.status).toBe(204);

    const admin = await prisma.user.findUniqueOrThrow({ where: { username: 'admin' } });
    const demoted = await request(app).put(`/api/users/${admin.id}`).set('Cookie', adminCookie).send({ role: 'staff' });
    expect(demoted.status).toBe(409);
    expect(demoted.body.code).toBe('LAST_ADMIN_REQUIRED');
  });

  it('keeps issuance and repair status transitions consistent', async () => {
    const type = await request(app).post('/api/equipment-types').set('Cookie', staffCookie).send({ name: 'Notebook', unit: 'เครื่อง' });
    const employee = await request(app).post('/api/employees').set('Cookie', staffCookie).send({ employeeId: 'E-001', name: 'ผู้ทดสอบ' });
    const equipment = await request(app).post('/api/equipment-instances').set('Cookie', staffCookie).send({ typeId: type.body.id, serialNumber: 'SN-001' });
    expect(type.status).toBe(201);
    expect(employee.status).toBe(201);
    expect(equipment.status).toBe(201);

    const issuance = await request(app).post('/api/issuance-history').set('Cookie', staffCookie).send({ equipmentId: equipment.body.id, employeeId: employee.body.id });
    expect(issuance.status).toBe(201);
    const issuanceHistory = await request(app).get('/api/issuance-history').set('Cookie', staffCookie).query({ startDate: '', endDate: '' });
    expect(issuanceHistory.status).toBe(200);
    expect(issuanceHistory.body).toMatchObject({ total: 1, data: [{ id: issuance.body.id }] });
    let current = await request(app).get('/api/equipment-instances').set('Cookie', staffCookie);
    expect(current.body.data[0].status).toBe('issued');

    const repairWhileIssued = await request(app).post('/api/repair-history').set('Cookie', staffCookie).send({ equipmentId: equipment.body.id, symptoms: 'จอไม่ติด' });
    expect(repairWhileIssued.status).toBe(409);

    const returned = await request(app).put(`/api/issuance-history/${issuance.body.id}`).set('Cookie', staffCookie).send({ returnDate: new Date().toISOString() });
    expect(returned.status).toBe(200);
    const repair = await request(app).post('/api/repair-history').set('Cookie', staffCookie).send({ equipmentId: equipment.body.id, symptoms: 'จอไม่ติด' });
    expect(repair.status).toBe(201);
    current = await request(app).get('/api/equipment-instances').set('Cookie', staffCookie);
    expect(current.body.data[0].status).toBe('under_repair');

    const completed = await request(app).put(`/api/repair-history/${repair.body.id}`).set('Cookie', staffCookie).send({ status: 'completed' });
    expect(completed.status).toBe(200);
    current = await request(app).get('/api/equipment-instances').set('Cookie', staffCookie);
    expect(current.body.data[0].status).toBe('available');
  });

  it('filters repair history by equipment and employee', async () => {
    const type = await request(app).post('/api/equipment-types').set('Cookie', staffCookie).send({ name: 'Filter type', unit: 'เครื่อง' });
    const [firstEmployee, secondEmployee] = await Promise.all([
      request(app).post('/api/employees').set('Cookie', staffCookie).send({ employeeId: 'E-FILTER-1', name: 'ผู้รับผิดชอบหนึ่ง' }),
      request(app).post('/api/employees').set('Cookie', staffCookie).send({ employeeId: 'E-FILTER-2', name: 'ผู้รับผิดชอบสอง' }),
    ]);
    const [firstEquipment, secondEquipment] = await Promise.all([
      request(app).post('/api/equipment-instances').set('Cookie', staffCookie).send({ typeId: type.body.id, serialNumber: 'FILTER-001' }),
      request(app).post('/api/equipment-instances').set('Cookie', staffCookie).send({ typeId: type.body.id, serialNumber: 'FILTER-002' }),
    ]);
    await request(app).post('/api/repair-history').set('Cookie', staffCookie).send({
      equipmentId: firstEquipment.body.id,
      employeeId: firstEmployee.body.id,
      symptoms: 'อาการของเครื่องแรก',
      status: 'completed',
    });
    await request(app).post('/api/repair-history').set('Cookie', staffCookie).send({
      equipmentId: secondEquipment.body.id,
      employeeId: secondEmployee.body.id,
      symptoms: 'อาการของเครื่องที่สอง',
      status: 'rejected',
    });

    const byEquipment = await request(app).get('/api/repair-history').set('Cookie', staffCookie).query({ equipmentId: firstEquipment.body.id });
    expect(byEquipment.status).toBe(200);
    expect(byEquipment.body).toMatchObject({ total: 1, data: [{ equipmentId: firstEquipment.body.id }] });

    const byEmployee = await request(app).get('/api/repair-history').set('Cookie', staffCookie).query({ employeeId: secondEmployee.body.id });
    expect(byEmployee.status).toBe(200);
    expect(byEmployee.body).toMatchObject({ total: 1, data: [{ employeeId: secondEmployee.body.id }] });

    const intersection = await request(app).get('/api/repair-history').set('Cookie', staffCookie).query({
      equipmentId: firstEquipment.body.id,
      employeeId: secondEmployee.body.id,
    });
    expect(intersection.status).toBe(200);
    expect(intersection.body).toMatchObject({ total: 0, data: [] });
  });

  it('paginates equipment instances beyond the first page', async () => {
    const type = await request(app).post('/api/equipment-types').set('Cookie', staffCookie).send({ name: 'Pagination type', unit: 'เครื่อง' });
    const serialNumbers = Array.from({ length: 101 }, (_, index) => `PAGE-${String(index + 1).padStart(3, '0')}`);
    const created = await request(app).post('/api/equipment-instances').set('Cookie', staffCookie).send({
      typeId: type.body.id,
      serialNumbers,
    });
    expect(created.status).toBe(201);
    expect(created.body).toHaveLength(101);

    const lastPage = await request(app).get('/api/equipment-instances').set('Cookie', staffCookie).query({ page: 11, pageSize: 10 });
    expect(lastPage.status).toBe(200);
    expect(lastPage.body).toMatchObject({ total: 101, page: 11, pageSize: 10, totalPages: 11 });
    expect(lastPage.body.data).toHaveLength(1);
    expect(lastPage.body.data[0].serialNumber).toBe('PAGE-101');
  });

  it('rejects duplicate and malformed data with useful status codes', async () => {
    const type = await request(app).post('/api/equipment-types').set('Cookie', adminCookie).send({ name: 'Monitor', unit: 'เครื่อง' });
    const first = await request(app).post('/api/equipment-instances').set('Cookie', adminCookie).send({ typeId: type.body.id, serialNumber: 'DUP-001' });
    expect(first.status).toBe(201);
    const duplicate = await request(app).post('/api/equipment-instances').set('Cookie', adminCookie).send({ typeId: type.body.id, serialNumber: 'DUP-001' });
    expect(duplicate.status).toBe(409);
    const malformed = await request(app).post('/api/equipment-types').set('Cookie', adminCookie).send({ name: '', unit: 'เครื่อง' });
    expect(malformed.status).toBe(400);

    const decimalPage = await request(app).get('/api/equipment-instances?page=1.5').set('Cookie', adminCookie);
    expect(decimalPage.status).toBe(400);
    const oversizedPage = await request(app).get('/api/equipment-instances?pageSize=101').set('Cookie', adminCookie);
    expect(oversizedPage.status).toBe(400);
    const invalidStatus = await request(app).get('/api/equipment-instances?status=unknown').set('Cookie', adminCookie);
    expect(invalidStatus.status).toBe(400);
    const invalidDateRange = await request(app).get('/api/repair-history?startDate=2026-02-01&endDate=2026-01-01').set('Cookie', adminCookie);
    expect(invalidDateRange.status).toBe(400);
    const invalidRepairStatus = await request(app).get('/api/repair-history?status=unknown').set('Cookie', adminCookie);
    expect(invalidRepairStatus.status).toBe(400);
    const invalidRepairEquipment = await request(app).get('/api/repair-history?equipmentId=1.5').set('Cookie', adminCookie);
    expect(invalidRepairEquipment.status).toBe(400);
    const invalidRepairEmployee = await request(app).get('/api/repair-history?employeeId=1.5').set('Cookie', adminCookie);
    expect(invalidRepairEmployee.status).toBe(400);
  });
});
