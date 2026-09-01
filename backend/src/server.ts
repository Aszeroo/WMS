import 'dotenv/config';
import cors from 'cors';
import express, {
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { performance } from 'node:perf_hooks';
import { Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';
import {
  ROLES,
  claimsFromRequest,
  clearSessionCookie,
  createSessionToken,
  hashPassword,
  publicUser,
  requireAuth,
  requireRole,
  setSessionCookie,
  verifyPassword,
} from './auth';

const globalForPrisma = globalThis as typeof globalThis & { __wmsPrisma?: PrismaClient };
const prisma = globalForPrisma.__wmsPrisma ?? new PrismaClient();
globalForPrisma.__wmsPrisma = prisma;
const app = express();
const port = Number(process.env.PORT ?? 5000);
const activeRepairStatuses = ['reported', 'in_progress'];
const validEquipmentStatuses = ['available', 'issued', 'under_repair'] as const;
const validRepairStatuses = ['reported', 'in_progress', 'completed', 'rejected'] as const;
type JsonRecord = Record<string, unknown>;
type AsyncHandler = (request: Request, response: Response, next: NextFunction) => Promise<void>;

class HttpError extends Error {
  constructor(public readonly statusCode: number, message: string, public readonly code?: string) {
    super(message);
    this.name = 'HttpError';
  }
}

const asyncHandler = (handler: AsyncHandler): RequestHandler => (request, response, next) => {
  void handler(request, response, next).catch(next);
};

const bodyOf = (request: Request): JsonRecord => {
  if (typeof request.body !== 'object' || request.body === null || Array.isArray(request.body)) {
    throw new HttpError(400, 'Request body must be a JSON object', 'INVALID_BODY');
  }
  return request.body as JsonRecord;
};

const requiredString = (body: JsonRecord, field: string): string => {
  const value = body[field];
  if (typeof value !== 'string' || value.trim() === '') throw new HttpError(400, `${field} is required`, 'VALIDATION_ERROR');
  return value.trim();
};

const optionalString = (body: JsonRecord, field: string): string | null | undefined => {
  const value = body[field];
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') throw new HttpError(400, `${field} must be a string`, 'VALIDATION_ERROR');
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

const optionalNumber = (body: JsonRecord, field: string): number | null | undefined => {
  const value = body[field];
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) throw new HttpError(400, `${field} must be a number`, 'VALIDATION_ERROR');
  return number;
};

const optionalDate = (body: JsonRecord, field: string): Date | null | undefined => {
  const value = body[field];
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string' && typeof value !== 'number') throw new HttpError(400, `${field} must be a valid date`, 'VALIDATION_ERROR');
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new HttpError(400, `${field} must be a valid date`, 'VALIDATION_ERROR');
  return date;
};

const requiredDate = (body: JsonRecord, field: string): Date => {
  const date = optionalDate(body, field);
  if (!date) throw new HttpError(400, `${field} must be a valid date`, 'VALIDATION_ERROR');
  return date;
};

const idFrom = (request: Request): number => {
  const id = Number(request.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'id must be a positive integer', 'VALIDATION_ERROR');
  return id;
};

const queryInteger = (value: unknown, field: string, defaultValue: number, maximum?: number): number => {
  if (value === undefined) return defaultValue;
  if (typeof value !== 'string' || !/^[1-9][0-9]*$/.test(value)) {
    throw new HttpError(400, `${field} must be a positive integer`, 'VALIDATION_ERROR');
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || (maximum !== undefined && parsed > maximum)) {
    throw new HttpError(400, `${field} is out of range`, 'VALIDATION_ERROR');
  }
  return parsed;
};

const paginationFrom = (request: Request) => ({
  page: queryInteger(request.query.page, 'page', 1, 1_000_000),
  pageSize: queryInteger(request.query.pageSize, 'pageSize', 10, 100),
});

const optionalQueryString = (value: unknown, field: string, maximum: number): string | undefined => {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.length > maximum) {
    throw new HttpError(400, `${field} is invalid`, 'VALIDATION_ERROR');
  }
  const trimmed = value.trim();
  return trimmed || undefined;
};

const optionalEnumQuery = (value: unknown, field: string, allowed: readonly string[]): string | undefined => {
  if (value === undefined || value === '') return undefined;
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw new HttpError(400, `${field} is invalid`, 'VALIDATION_ERROR');
  }
  return value;
};

const optionalQueryInteger = (value: unknown, field: string): number | undefined =>
  value === undefined ? undefined : queryInteger(value, field, 1);

const optionalBooleanQuery = (value: unknown, field: string): boolean | undefined => {
  if (value === undefined || value === '') return undefined;
  if (value !== 'true' && value !== 'false') {
    throw new HttpError(400, `${field} must be true or false`, 'VALIDATION_ERROR');
  }
  return value === 'true';
};

const dateFilter = (from: unknown, to: unknown) => {
  const value: { gte?: Date; lte?: Date } = {};
  const startDate = from === '' ? undefined : from;
  const endDate = to === '' ? undefined : to;
  if (startDate !== undefined && typeof startDate !== 'string') {
    throw new HttpError(400, 'Invalid start date', 'VALIDATION_ERROR');
  }
  if (endDate !== undefined && typeof endDate !== 'string') {
    throw new HttpError(400, 'Invalid end date', 'VALIDATION_ERROR');
  }
  if (typeof startDate === 'string') {
    const date = new Date(startDate);
    if (Number.isNaN(date.getTime())) throw new HttpError(400, 'Invalid start date', 'VALIDATION_ERROR');
    value.gte = date;
  }
  if (typeof endDate === 'string') {
    const date = new Date(endDate);
    if (Number.isNaN(date.getTime())) throw new HttpError(400, 'Invalid end date', 'VALIDATION_ERROR');
    date.setHours(23, 59, 59, 999);
    value.lte = date;
  }
  if (value.gte && value.lte && value.gte > value.lte) {
    throw new HttpError(400, 'Start date cannot be after end date', 'VALIDATION_ERROR');
  }
  return Object.keys(value).length > 0 ? value : undefined;
};

const pagedResponse = <T>(data: T[], total: number, page: number, pageSize: number) => ({
  data,
  total,
  page,
  pageSize,
  totalPages: Math.ceil(total / pageSize),
});

const equipmentInclude = {
  type: { select: { id: true, name: true, unit: true } },
} as const;

const refreshEquipmentStatus = async (transaction: Prisma.TransactionClient, equipmentId: number): Promise<void> => {
  const [activeRepair, activeIssuance] = await Promise.all([
    transaction.equipmentRepair.findFirst({ where: { equipmentId, status: { in: activeRepairStatuses } }, select: { id: true } }),
    transaction.equipmentIssuance.findFirst({ where: { equipmentId, returnDate: null }, select: { id: true } }),
  ]);
  const status = activeRepair ? 'under_repair' : activeIssuance ? 'issued' : 'available';
  await transaction.equipmentInstance.update({ where: { id: equipmentId }, data: { status } });
};

const ensureEquipment = async (equipmentId: number) => {
  const equipment = await prisma.equipmentInstance.findUnique({ where: { id: equipmentId } });
  if (!equipment) throw new HttpError(404, 'Equipment not found', 'NOT_FOUND');
  return equipment;
};

const parseZod = <T>(schema: z.ZodType<T>, value: unknown): T => {
  const result = schema.safeParse(value);
  if (!result.success) {
    const message = result.error.issues.map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`).join('; ');
    throw new HttpError(400, message, 'VALIDATION_ERROR');
  }
  return result.data;
};

const loginSchema = z.object({
  identifier: z.string().trim().min(1).max(254).optional(),
  username: z.string().trim().min(1).max(100).optional(),
  email: z.string().trim().email().max(254).optional(),
  password: z.string().min(1).max(200),
}).refine((value) => Boolean(value.identifier || value.username || value.email), {
  message: 'identifier, username or email is required',
  path: ['identifier'],
});

const userCreateSchema = z.object({
  username: z.string().trim().min(3).max(100),
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(200),
  role: z.enum(ROLES).default('viewer'),
});
const userUpdateSchema = z.object({
  username: z.string().trim().min(3).max(100).optional(),
  email: z.string().trim().email().max(254).optional(),
  password: z.string().min(12).max(200).optional(),
  role: z.enum(ROLES).optional(),
}).refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' });
const profileUpdateSchema = z.object({
  username: z.string().trim().min(3).max(100).optional(),
  email: z.string().trim().email().max(254).optional(),
}).refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' });
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(12).max(200),
}).refine((value) => value.currentPassword !== value.newPassword, {
  message: 'New password must be different from current password',
  path: ['newPassword'],
});
const userPublicSelect = { id: true, username: true, email: true, role: true } as const;

app.disable('x-powered-by');
app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : 0);
app.use((_, response, next) => {
  const startedAt = performance.now();
  const originalEnd = response.end.bind(response);
  response.end = ((...args: never[]) => {
    if (!response.headersSent) {
      const durationMs = (performance.now() - startedAt).toFixed(1);
      response.setHeader('Server-Timing', `app;dur=${durationMs}`);
    }
    return originalEnd(...args);
  }) as typeof response.end;
  next();
});
app.use(helmet());
app.use(express.json({ limit: '1mb' }));

const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173,http://localhost:5174')
  .split(',').map((origin) => origin.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) callback(null, true);
    else callback(new HttpError(403, 'Origin is not allowed', 'CORS_ERROR'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === 'test' ? 1000 : 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === 'test' ? 1000 : 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later' },
});
app.use('/api', generalLimiter);

app.get('/', (_request, response) => {
  response.json({ name: 'Equipment Management API', version: '1.0.0' });
});

app.get(['/health', '/api/health'], asyncHandler(async (_request, response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    response.json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() });
  } catch {
    response.status(503).json({ status: 'error', database: 'unavailable', timestamp: new Date().toISOString() });
  }
}));

app.post('/api/auth/login', loginLimiter, asyncHandler(async (request, response) => {
  const body = parseZod(loginSchema, request.body);
  const identifier = body.identifier ?? body.username ?? body.email;
  const user = await prisma.user.findFirst({ where: { OR: [{ username: identifier }, { email: identifier }] } });
  const validPassword = await verifyPassword(body.password, user?.passwordHash);
  const safeUser = user ? publicUser(user) : null;
  if (!user || !validPassword || !safeUser) throw new HttpError(401, 'Invalid username or password', 'INVALID_CREDENTIALS');
  const token = createSessionToken(safeUser, user.sessionVersion);
  setSessionCookie(response, token);
  response.json({ user: safeUser, token });
}));

app.post('/api/auth/logout', asyncHandler(async (request, response) => {
  const claims = claimsFromRequest(request);
  if (claims) {
    await prisma.user.updateMany({
      where: { id: claims.userId, sessionVersion: claims.sessionVersion },
      data: { sessionVersion: { increment: 1 } },
    });
  }
  clearSessionCookie(response);
  response.status(204).send();
}));

app.get('/api/auth/me', requireAuth(prisma), (_request, response) => {
  response.json({ user: _request.auth });
});

app.put('/api/auth/profile', requireAuth(prisma), asyncHandler(async (request, response) => {
  const values = parseZod(profileUpdateSchema, request.body);
  const userId = request.auth?.id;
  if (!userId) throw new HttpError(401, 'Authentication required', 'AUTH_REQUIRED');
  const user = await prisma.user.update({
    where: { id: userId },
    data: { username: values.username, email: values.email },
    select: userPublicSelect,
  });
  const safeUser = publicUser(user);
  if (!safeUser) throw new HttpError(500, 'Could not update profile');
  response.json(safeUser);
}));

app.post('/api/auth/change-password', requireAuth(prisma), asyncHandler(async (request, response) => {
  const values = parseZod(changePasswordSchema, request.body);
  const userId = request.auth?.id;
  if (!userId) throw new HttpError(401, 'Authentication required', 'AUTH_REQUIRED');
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  if (!user || !(await verifyPassword(values.currentPassword, user.passwordHash))) {
    throw new HttpError(400, 'Current password is incorrect', 'INVALID_CURRENT_PASSWORD');
  }
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(values.newPassword), sessionVersion: { increment: 1 } },
  });
  clearSessionCookie(response);
  response.status(204).send();
}));

// เส้นทางธุรกิจทั้งหมดต้องยืนยันตัวตน ส่วน health และ auth อยู่ด้านบนแล้ว
app.use('/api', (request, response, next) => {
  if (request.path === '/health' || request.path.startsWith('/auth/')) {
    next();
    return;
  }
  requireAuth(prisma)(request, response, next);
});
const writeAccess = requireRole('admin', 'staff');
const adminAccess = requireRole('admin');

app.get('/api/dashboard/stats', asyncHandler(async (_request, response) => {
  const grouped = await prisma.equipmentInstance.groupBy({
    by: ['status'],
    _count: { _all: true },
  });
  const counts = new Map(grouped.map((item) => [item.status, item._count._all]));
  const total = grouped.reduce((sum, item) => sum + item._count._all, 0);
  response.json({
    total,
    available: counts.get('available') ?? 0,
    issued: counts.get('issued') ?? 0,
    underRepair: counts.get('under_repair') ?? 0,
  });
}));

app.get('/api/equipment-types', asyncHandler(async (_request, response) => {
  response.json(await prisma.equipmentType.findMany({ include: { _count: { select: { instances: true } } }, orderBy: { name: 'asc' } }));
}));

app.post('/api/equipment-types', writeAccess, asyncHandler(async (request, response) => {
  const body = bodyOf(request);
  response.status(201).json(await prisma.equipmentType.create({ data: {
    name: requiredString(body, 'name'), unit: requiredString(body, 'unit'), description: optionalString(body, 'description'),
  } }));
}));

app.put('/api/equipment-types/:id', writeAccess, asyncHandler(async (request, response) => {
  const body = bodyOf(request);
  const data: Prisma.EquipmentTypeUpdateInput = {};
  if (body.name !== undefined) data.name = requiredString(body, 'name');
  if (body.unit !== undefined) data.unit = requiredString(body, 'unit');
  if (body.description !== undefined) data.description = optionalString(body, 'description');
  response.json(await prisma.equipmentType.update({ where: { id: idFrom(request) }, data }));
}));

app.delete('/api/equipment-types/:id', adminAccess, asyncHandler(async (request, response) => {
  await prisma.equipmentType.delete({ where: { id: idFrom(request) } });
  response.status(204).send();
}));

app.get('/api/equipment-instances', asyncHandler(async (request, response) => {
  const { page, pageSize } = paginationFrom(request);
  const search = optionalQueryString(request.query.search, 'search', 200) ?? '';
  const status = optionalEnumQuery(request.query.status, 'status', validEquipmentStatuses);
  const typeId = optionalQueryInteger(request.query.typeId, 'typeId');
  const where: Prisma.EquipmentInstanceWhereInput = {
    ...(search ? { OR: [{ serialNumber: { contains: search } }, { brand: { contains: search } }, { model: { contains: search } }] } : {}),
    ...(status ? { status } : {}),
    ...(typeId === undefined ? {} : { typeId }),
  };
  const [data, total] = await Promise.all([
    prisma.equipmentInstance.findMany({ where, include: equipmentInclude, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.equipmentInstance.count({ where }),
  ]);
  response.json(pagedResponse(data, total, page, pageSize));
}));

app.post('/api/equipment-instances', writeAccess, asyncHandler(async (request, response) => {
  const body = bodyOf(request);
  const typeId = optionalNumber(body, 'typeId');
  if (!typeId || !Number.isInteger(typeId) || typeId <= 0) throw new HttpError(400, 'typeId is required', 'VALIDATION_ERROR');
  const serialNumbers = Array.isArray(body.serialNumbers)
    ? body.serialNumbers.filter((value): value is string => typeof value === 'string').map((value) => value.trim()).filter(Boolean)
    : [requiredString(body, 'serialNumber')];
  if (serialNumbers.length === 0) throw new HttpError(400, 'At least one serial number is required', 'VALIDATION_ERROR');
  if (new Set(serialNumbers).size !== serialNumbers.length) throw new HttpError(400, 'Serial numbers must be unique', 'VALIDATION_ERROR');
  const status = body.status === undefined ? 'available' : requiredString(body, 'status');
  if (!validEquipmentStatuses.includes(status as (typeof validEquipmentStatuses)[number]) || status !== 'available') {
    throw new HttpError(400, 'New equipment must start as available', 'INVALID_STATE_TRANSITION');
  }
  const type = await prisma.equipmentType.findUnique({ where: { id: typeId } });
  if (!type) throw new HttpError(400, 'Equipment type not found', 'NOT_FOUND');
  const data = serialNumbers.map((serialNumber) => ({
    serialNumber, typeId, brand: optionalString(body, 'brand') ?? null, model: optionalString(body, 'model') ?? null,
    purchaseDate: optionalDate(body, 'purchaseDate') ?? null, status,
  }));
  const created = await prisma.$transaction(data.map((item) => prisma.equipmentInstance.create({ data: item, include: equipmentInclude })));
  response.status(201).json(created.length === 1 ? created[0] : created);
}));

app.put('/api/equipment-instances/:id', writeAccess, asyncHandler(async (request, response) => {
  const body = bodyOf(request);
  const id = idFrom(request);
  const current = await prisma.equipmentInstance.findUnique({ where: { id } });
  if (!current) throw new HttpError(404, 'Equipment not found', 'NOT_FOUND');
  const data: Prisma.EquipmentInstanceUpdateInput = {};
  if (body.serialNumber !== undefined) data.serialNumber = requiredString(body, 'serialNumber');
  if (body.brand !== undefined) data.brand = optionalString(body, 'brand');
  if (body.model !== undefined) data.model = optionalString(body, 'model');
  if (body.purchaseDate !== undefined) data.purchaseDate = optionalDate(body, 'purchaseDate');
  if (body.typeId !== undefined) {
    const typeId = optionalNumber(body, 'typeId');
    if (!typeId || !Number.isInteger(typeId) || typeId <= 0) throw new HttpError(400, 'typeId must be a positive integer', 'VALIDATION_ERROR');
    data.type = { connect: { id: typeId } };
  }
  if (body.status !== undefined) {
    const status = requiredString(body, 'status');
    if (!validEquipmentStatuses.includes(status as (typeof validEquipmentStatuses)[number])) throw new HttpError(400, 'Invalid equipment status', 'VALIDATION_ERROR');
    if (status !== 'available') throw new HttpError(409, 'Use issuance or repair records to change this equipment status', 'INVALID_STATE_TRANSITION');
    const [activeIssuance, activeRepair] = await Promise.all([
      prisma.equipmentIssuance.findFirst({ where: { equipmentId: id, returnDate: null }, select: { id: true } }),
      prisma.equipmentRepair.findFirst({ where: { equipmentId: id, status: { in: activeRepairStatuses } }, select: { id: true } }),
    ]);
    if (activeIssuance || activeRepair) throw new HttpError(409, 'Active issuance or repair must be completed first', 'INVALID_STATE_TRANSITION');
    data.status = 'available';
  }
  response.json(await prisma.equipmentInstance.update({ where: { id }, data, include: equipmentInclude }));
}));

app.delete('/api/equipment-instances/:id', adminAccess, asyncHandler(async (request, response) => {
  await prisma.equipmentInstance.delete({ where: { id: idFrom(request) } });
  response.status(204).send();
}));

app.get('/api/employees', asyncHandler(async (_request, response) => {
  response.json(await prisma.employee.findMany({ orderBy: { name: 'asc' } }));
}));

app.post('/api/employees', writeAccess, asyncHandler(async (request, response) => {
  const body = bodyOf(request);
  response.status(201).json(await prisma.employee.create({ data: {
    employeeId: requiredString(body, 'employeeId'), name: requiredString(body, 'name'),
    department: optionalString(body, 'department'), position: optionalString(body, 'position'),
  } }));
}));

app.put('/api/employees/:id', writeAccess, asyncHandler(async (request, response) => {
  const body = bodyOf(request);
  const data: Prisma.EmployeeUpdateInput = {};
  if (body.employeeId !== undefined) data.employeeId = requiredString(body, 'employeeId');
  if (body.name !== undefined) data.name = requiredString(body, 'name');
  if (body.department !== undefined) data.department = optionalString(body, 'department');
  if (body.position !== undefined) data.position = optionalString(body, 'position');
  response.json(await prisma.employee.update({ where: { id: idFrom(request) }, data }));
}));

app.delete('/api/employees/:id', adminAccess, asyncHandler(async (request, response) => {
  await prisma.employee.delete({ where: { id: idFrom(request) } });
  response.status(204).send();
}));

app.get('/api/issuance-history', asyncHandler(async (request, response) => {
  const { page, pageSize } = paginationFrom(request);
  const issueDate = dateFilter(request.query.startDate, request.query.endDate);
  const building = optionalQueryString(request.query.building, 'building', 100);
  const floor = optionalQueryString(request.query.floor, 'floor', 100);
  const jobNumber = optionalQueryString(request.query.jobNumber, 'jobNumber', 100);
  const equipmentId = optionalQueryInteger(request.query.equipmentId, 'equipmentId');
  const active = optionalBooleanQuery(request.query.active, 'active');
  const where: Prisma.EquipmentIssuanceWhereInput = {
    ...(issueDate ? { issueDate } : {}),
    ...(building ? { building: { contains: building } } : {}),
    ...(floor ? { floor: { contains: floor } } : {}),
    ...(jobNumber ? { jobNumber: { contains: jobNumber } } : {}),
    ...(equipmentId === undefined ? {} : { equipmentId }),
    ...(active === true ? { returnDate: null } : {}),
  };
  const [data, total] = await Promise.all([
    prisma.equipmentIssuance.findMany({ where, include: { equipment: { include: equipmentInclude }, employee: true }, orderBy: { issueDate: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.equipmentIssuance.count({ where }),
  ]);
  response.json(pagedResponse(data, total, page, pageSize));
}));

app.post('/api/issuance-history', writeAccess, asyncHandler(async (request, response) => {
  const body = bodyOf(request);
  const equipmentId = optionalNumber(body, 'equipmentId');
  const employeeId = optionalNumber(body, 'employeeId');
  if (!equipmentId || !Number.isInteger(equipmentId) || equipmentId <= 0) throw new HttpError(400, 'equipmentId is required', 'VALIDATION_ERROR');
  if (!employeeId || !Number.isInteger(employeeId) || employeeId <= 0) throw new HttpError(400, 'employeeId is required', 'VALIDATION_ERROR');
  const issueDate = optionalDate(body, 'issueDate') ?? new Date();
  const returnDate = optionalDate(body, 'returnDate');
  if (returnDate && returnDate < issueDate) throw new HttpError(400, 'returnDate cannot be before issueDate', 'VALIDATION_ERROR');
  const data = await prisma.$transaction(async (transaction) => {
    const equipment = await transaction.equipmentInstance.findUnique({ where: { id: equipmentId } });
    if (!equipment) throw new HttpError(404, 'Equipment not found', 'NOT_FOUND');
    if (equipment.status !== 'available') throw new HttpError(409, 'Equipment is not available', 'INVALID_STATE_TRANSITION');
    const employee = await transaction.employee.findUnique({ where: { id: employeeId } });
    if (!employee) throw new HttpError(400, 'Employee not found', 'NOT_FOUND');
    const activeIssuance = await transaction.equipmentIssuance.findFirst({ where: { equipmentId, returnDate: null } });
    if (activeIssuance) throw new HttpError(409, 'Equipment already has an active issuance', 'INVALID_STATE_TRANSITION');
    const issuance = await transaction.equipmentIssuance.create({ data: {
      equipmentId, employeeId, issueDate, returnDate,
      building: optionalString(body, 'building'), floor: optionalString(body, 'floor'), jobNumber: optionalString(body, 'jobNumber'), notes: optionalString(body, 'notes'),
    } });
    await refreshEquipmentStatus(transaction, equipmentId);
    return transaction.equipmentIssuance.findUniqueOrThrow({ where: { id: issuance.id }, include: { equipment: { include: equipmentInclude }, employee: true } });
  });
  response.status(201).json(data);
}));

app.put('/api/issuance-history/:id', writeAccess, asyncHandler(async (request, response) => {
  const body = bodyOf(request);
  const id = idFrom(request);
  const existing = await prisma.equipmentIssuance.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, 'Issuance record not found', 'NOT_FOUND');
  const data: Prisma.EquipmentIssuanceUpdateInput = {};
  const issueDate = body.issueDate !== undefined ? requiredDate(body, 'issueDate') : existing.issueDate;
  const returnDate = body.returnDate !== undefined ? optionalDate(body, 'returnDate') : existing.returnDate;
  if (returnDate && returnDate < issueDate) throw new HttpError(400, 'returnDate cannot be before issueDate', 'VALIDATION_ERROR');
  if (body.issueDate !== undefined) data.issueDate = issueDate;
  if (body.returnDate !== undefined) data.returnDate = returnDate;
  if (body.building !== undefined) data.building = optionalString(body, 'building');
  if (body.floor !== undefined) data.floor = optionalString(body, 'floor');
  if (body.jobNumber !== undefined) data.jobNumber = optionalString(body, 'jobNumber');
  if (body.notes !== undefined) data.notes = optionalString(body, 'notes');
  const result = await prisma.$transaction(async (transaction) => {
    await transaction.equipmentIssuance.update({ where: { id }, data });
    await refreshEquipmentStatus(transaction, existing.equipmentId);
    return transaction.equipmentIssuance.findUniqueOrThrow({ where: { id }, include: { equipment: { include: equipmentInclude }, employee: true } });
  });
  response.json(result);
}));

app.delete('/api/issuance-history/:id', adminAccess, asyncHandler(async (request, response) => {
  const id = idFrom(request);
  const existing = await prisma.equipmentIssuance.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, 'Issuance record not found', 'NOT_FOUND');
  await prisma.$transaction(async (transaction) => {
    await transaction.equipmentIssuance.delete({ where: { id } });
    await refreshEquipmentStatus(transaction, existing.equipmentId);
  });
  response.status(204).send();
}));

app.get('/api/repair-history', asyncHandler(async (request, response) => {
  const { page, pageSize } = paginationFrom(request);
  const repairDate = dateFilter(request.query.startDate, request.query.endDate);
  const status = optionalEnumQuery(request.query.status, 'status', validRepairStatuses);
  const equipmentId = optionalQueryInteger(request.query.equipmentId, 'equipmentId');
  const employeeId = optionalQueryInteger(request.query.employeeId, 'employeeId');
  const where: Prisma.EquipmentRepairWhereInput = {
    ...(repairDate ? { repairDate } : {}),
    ...(status ? { status } : {}),
    ...(equipmentId === undefined ? {} : { equipmentId }),
    ...(employeeId === undefined ? {} : { employeeId }),
  };
  const [data, total] = await Promise.all([
    prisma.equipmentRepair.findMany({ where, include: { equipment: { include: equipmentInclude }, employee: true }, orderBy: { repairDate: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.equipmentRepair.count({ where }),
  ]);
  response.json(pagedResponse(data, total, page, pageSize));
}));

app.post('/api/repair-history', writeAccess, asyncHandler(async (request, response) => {
  const body = bodyOf(request);
  const equipmentId = optionalNumber(body, 'equipmentId');
  if (!equipmentId || !Number.isInteger(equipmentId) || equipmentId <= 0) throw new HttpError(400, 'equipmentId is required', 'VALIDATION_ERROR');
  const employeeId = optionalNumber(body, 'employeeId');
  const status = body.status === undefined ? 'reported' : requiredString(body, 'status');
  if (!validRepairStatuses.includes(status as (typeof validRepairStatuses)[number])) throw new HttpError(400, 'Invalid repair status', 'VALIDATION_ERROR');
  const equipment = await ensureEquipment(equipmentId);
  if (equipment.status === 'issued') throw new HttpError(409, 'Return the equipment before reporting a repair', 'INVALID_STATE_TRANSITION');
  if (employeeId !== undefined && employeeId !== null && (!Number.isInteger(employeeId) || employeeId <= 0)) throw new HttpError(400, 'employeeId must be a positive integer', 'VALIDATION_ERROR');
  if (employeeId) {
    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) throw new HttpError(400, 'Employee not found', 'NOT_FOUND');
  }
  const repairDate = optionalDate(body, 'repairDate') ?? new Date();
  const data = await prisma.$transaction(async (transaction) => {
    const activeRepair = await transaction.equipmentRepair.findFirst({ where: { equipmentId, status: { in: activeRepairStatuses } } });
    if (activeRepair) throw new HttpError(409, 'Equipment already has an active repair', 'INVALID_STATE_TRANSITION');
    const repair = await transaction.equipmentRepair.create({ data: {
      equipmentId, employeeId: employeeId ?? null, repairDate, symptoms: requiredString(body, 'symptoms'), status,
      repairedBy: optionalString(body, 'repairedBy'), notes: optionalString(body, 'notes'),
    } });
    await refreshEquipmentStatus(transaction, equipmentId);
    return transaction.equipmentRepair.findUniqueOrThrow({ where: { id: repair.id }, include: { equipment: { include: equipmentInclude }, employee: true } });
  });
  response.status(201).json(data);
}));

app.put('/api/repair-history/:id', writeAccess, asyncHandler(async (request, response) => {
  const body = bodyOf(request);
  const id = idFrom(request);
  const existing = await prisma.equipmentRepair.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, 'Repair record not found', 'NOT_FOUND');
  const data: Prisma.EquipmentRepairUpdateInput = {};
  if (body.repairDate !== undefined) data.repairDate = requiredDate(body, 'repairDate');
  if (body.symptoms !== undefined) data.symptoms = requiredString(body, 'symptoms');
  if (body.status !== undefined) {
    const nextStatus = requiredString(body, 'status');
    if (!validRepairStatuses.includes(nextStatus as (typeof validRepairStatuses)[number])) throw new HttpError(400, 'Invalid repair status', 'VALIDATION_ERROR');
    const allowedNext: Record<string, string[]> = { reported: ['reported', 'in_progress', 'completed', 'rejected'], in_progress: ['in_progress', 'completed', 'rejected'], completed: ['completed'], rejected: ['rejected'] };
    if (!allowedNext[existing.status]?.includes(nextStatus)) throw new HttpError(409, 'Invalid repair status transition', 'INVALID_STATE_TRANSITION');
    data.status = nextStatus;
  }
  if (body.repairedBy !== undefined) data.repairedBy = optionalString(body, 'repairedBy');
  if (body.notes !== undefined) data.notes = optionalString(body, 'notes');
  if (body.employeeId !== undefined) {
    const employeeId = optionalNumber(body, 'employeeId');
    if (employeeId === null || employeeId === undefined) data.employee = { disconnect: true };
    else {
      if (!Number.isInteger(employeeId) || employeeId <= 0) throw new HttpError(400, 'employeeId must be a positive integer', 'VALIDATION_ERROR');
      data.employee = { connect: { id: employeeId } };
    }
  }
  const result = await prisma.$transaction(async (transaction) => {
    await transaction.equipmentRepair.update({ where: { id }, data });
    await refreshEquipmentStatus(transaction, existing.equipmentId);
    return transaction.equipmentRepair.findUniqueOrThrow({ where: { id }, include: { equipment: { include: equipmentInclude }, employee: true } });
  });
  response.json(result);
}));

app.delete('/api/repair-history/:id', adminAccess, asyncHandler(async (request, response) => {
  const id = idFrom(request);
  const existing = await prisma.equipmentRepair.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, 'Repair record not found', 'NOT_FOUND');
  await prisma.$transaction(async (transaction) => {
    await transaction.equipmentRepair.delete({ where: { id } });
    await refreshEquipmentStatus(transaction, existing.equipmentId);
  });
  response.status(204).send();
}));

app.get('/api/users', adminAccess, asyncHandler(async (_request, response) => {
  const users = await prisma.user.findMany({ select: userPublicSelect, orderBy: { username: 'asc' } });
  response.json(users.map((user) => publicUser(user)).filter((user): user is NonNullable<typeof user> => Boolean(user)));
}));

app.post('/api/users', adminAccess, asyncHandler(async (request, response) => {
  const values = parseZod(userCreateSchema, request.body);
  const user = await prisma.user.create({ data: {
    username: values.username, email: values.email, passwordHash: await hashPassword(values.password), role: values.role,
  }, select: userPublicSelect });
  const safeUser = publicUser(user);
  if (!safeUser) throw new HttpError(500, 'Could not create user');
  response.status(201).json(safeUser);
}));

app.put('/api/users/:id', adminAccess, asyncHandler(async (request, response) => {
  const values = parseZod(userUpdateSchema, request.body);
  const id = idFrom(request);
  const passwordHash = values.password ? await hashPassword(values.password) : undefined;
  const safeUser = await prisma.$transaction(async (transaction) => {
    const existing = await transaction.user.findUnique({ where: { id }, select: { role: true } });
    if (!existing) throw new HttpError(404, 'User not found', 'NOT_FOUND');
    const roleChanged = values.role !== undefined && values.role !== existing.role;
    if (roleChanged && existing.role === 'admin' && values.role !== 'admin') {
      const adminCount = await transaction.user.count({ where: { role: 'admin' } });
      if (adminCount <= 1) throw new HttpError(409, 'At least one administrator must remain', 'LAST_ADMIN_REQUIRED');
    }
    const data: Prisma.UserUpdateInput = {
      username: values.username,
      email: values.email,
      role: values.role,
      ...(passwordHash ? { passwordHash } : {}),
      ...(passwordHash || roleChanged ? { sessionVersion: { increment: 1 } } : {}),
    };
    const user = await transaction.user.update({ where: { id }, data, select: userPublicSelect });
    return publicUser(user);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  if (!safeUser) throw new HttpError(500, 'Could not update user');
  response.json(safeUser);
}));

app.delete('/api/users/:id', adminAccess, asyncHandler(async (request, response) => {
  const id = idFrom(request);
  if (request.auth?.id === id) throw new HttpError(400, 'You cannot delete your own account', 'VALIDATION_ERROR');
  await prisma.$transaction(async (transaction) => {
    const existing = await transaction.user.findUnique({ where: { id }, select: { role: true } });
    if (!existing) throw new HttpError(404, 'User not found', 'NOT_FOUND');
    if (existing.role === 'admin') {
      const adminCount = await transaction.user.count({ where: { role: 'admin' } });
      if (adminCount <= 1) throw new HttpError(409, 'At least one administrator must remain', 'LAST_ADMIN_REQUIRED');
    }
    await transaction.user.delete({ where: { id } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  response.status(204).send();
}));

app.use((_request, response) => {
  response.status(404).json({ error: 'Route not found', code: 'NOT_FOUND' });
});

app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  if (response.headersSent) return;
  if (error instanceof HttpError) {
    response.status(error.statusCode).json({ error: error.message, ...(error.code ? { code: error.code } : {}) });
    return;
  }
  if (error && typeof error === 'object' && 'statusCode' in error && typeof error.statusCode === 'number') {
    const statusCode = error.statusCode;
    const message = statusCode === 401 ? 'Authentication required' : statusCode === 403 ? 'You do not have permission to perform this action' : 'Request failed';
    response.status(statusCode).json({ error: message, code: statusCode === 401 ? 'AUTH_REQUIRED' : 'FORBIDDEN' });
    return;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') { response.status(409).json({ error: 'A record with the same unique value already exists', code: 'DUPLICATE' }); return; }
    if (error.code === 'P2025') { response.status(404).json({ error: 'Record not found', code: 'NOT_FOUND' }); return; }
    if (error.code === 'P2003') { response.status(409).json({ error: 'This record is still referenced by another record', code: 'REFERENTIAL_INTEGRITY' }); return; }
  }
  console.error(error);
  response.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
});

let httpServer: ReturnType<typeof app.listen> | undefined;
let shuttingDown = false;

const stopServer = async (signal: string): Promise<void> => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}; shutting down gracefully`);
  await new Promise<void>((resolve) => {
    if (!httpServer) {
      resolve();
      return;
    }
    httpServer.close((error) => {
      if (error) {
        console.error('Failed to close HTTP server', error);
        process.exitCode = 1;
      }
      resolve();
    });
  });
  await prisma.$disconnect();
};

const validateRuntimeEnvironment = (): void => {
  if (process.env.NODE_ENV !== 'production') return;
  if (!process.env.DATABASE_URL?.trim()) throw new Error('DATABASE_URL must be configured in production');
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret) throw new Error('SESSION_SECRET must be configured in production');
  if (secret.length < 32) throw new Error('SESSION_SECRET must contain at least 32 characters in production');
  if (process.env.COOKIE_SECURE !== 'true') throw new Error('COOKIE_SECURE=true is required in production');
  if ((process.env.COOKIE_SAME_SITE ?? '').toLowerCase() !== 'none') {
    throw new Error('COOKIE_SAME_SITE=none is required in production');
  }
  if (!process.env.CORS_ORIGIN?.trim()) throw new Error('CORS_ORIGIN must be configured in production');
};

validateRuntimeEnvironment();

const startServer = async (): Promise<void> => {
  if (!Number.isInteger(port) || port <= 0 || port > 65535) throw new Error('PORT must be a valid TCP port');
  validateRuntimeEnvironment();
  await prisma.$connect();
  httpServer = app.listen(port, () => console.log(`Equipment Management API listening on http://localhost:${port}`));
};

if (require.main === module) {
  process.once('SIGTERM', () => { void stopServer('SIGTERM'); });
  process.once('SIGINT', () => { void stopServer('SIGINT'); });
  startServer().catch(async (error: unknown) => {
    console.error('Failed to start server', error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
}

export { app, prisma, startServer };
export default app;
