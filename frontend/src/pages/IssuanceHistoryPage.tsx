import {
  Alert,
  Button,
  Card,
  Empty,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import type { TableProps } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { apiService } from '../services/api';
import { getErrorMessage } from '../services/errors';
import type { Employee, EquipmentInstance, Issuance, PageResult } from '../types';

type IssuanceFormValues = {
  equipmentId: number;
  employeeId: number;
  issueDate?: string;
  building?: string;
  floor?: string;
  jobNumber?: string;
  notes?: string;
};
type EmployeeFormValues = { employeeId: string; name: string; department?: string; position?: string };

function formatDate(value?: string | null) {
  return value ? new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium' }).format(new Date(value)) : '—';
}

export function IssuanceHistoryPage() {
  const { canWrite, isAdmin } = useAuth();
  const [result, setResult] = useState<PageResult<Issuance>>({ data: [], total: 0, page: 1, pageSize: 10, totalPages: 0 });
  const [equipment, setEquipment] = useState<EquipmentInstance[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filters, setFilters] = useState({ startDate: '', endDate: '', building: '', floor: '', jobNumber: '' });
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [employeeModalOpen, setEmployeeModalOpen] = useState(false);
  const [form] = Form.useForm<IssuanceFormValues>();
  const [employeeForm] = Form.useForm<EmployeeFormValues>();
  const [error, setError] = useState('');

  const loadLookups = useCallback(async () => {
    try {
      const [instances, nextEmployees] = await Promise.all([
        apiService.getInstances({ page: 1, pageSize: 100, status: 'available' }),
        apiService.getEmployees(),
      ]);
      setEquipment(instances.data);
      setEmployees(nextEmployees);
    } catch (reason) {
      setError(getErrorMessage(reason, 'ไม่สามารถโหลดข้อมูลสำหรับการเบิกได้'));
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const next = await apiService.getIssuances({
        ...(filters.startDate ? { startDate: filters.startDate } : {}),
        ...(filters.endDate ? { endDate: filters.endDate } : {}),
        ...(filters.building ? { building: filters.building } : {}),
        ...(filters.floor ? { floor: filters.floor } : {}),
        ...(filters.jobNumber ? { jobNumber: filters.jobNumber } : {}),
        page: result.page,
        pageSize: result.pageSize,
      });
      setResult(next);
    } catch (reason) {
      setError(getErrorMessage(reason, 'ไม่สามารถโหลดประวัติการเบิกได้'));
    } finally {
      setLoading(false);
    }
  }, [filters, result.page, result.pageSize]);

  useEffect(() => { void loadLookups(); }, [loadLookups]);
  useEffect(() => { void loadHistory(); }, [loadHistory]);

  const submitIssuance = async (values: IssuanceFormValues) => {
    try {
      await apiService.createIssuance({ ...values, issueDate: values.issueDate ? new Date(`${values.issueDate}T00:00:00`).toISOString() : undefined });
      message.success('บันทึกการเบิกอุปกรณ์แล้ว');
      setModalOpen(false);
      form.resetFields();
      await Promise.all([loadLookups(), loadHistory()]);
    } catch (reason) { message.error(getErrorMessage(reason)); }
  };

  const submitEmployee = async (values: EmployeeFormValues) => {
    try {
      await apiService.createEmployee(values);
      message.success('เพิ่มข้อมูลพนักงานแล้ว');
      setEmployeeModalOpen(false);
      employeeForm.resetFields();
      await loadLookups();
    } catch (reason) { message.error(getErrorMessage(reason)); }
  };

  const returnEquipment = (item: Issuance) => {
    Modal.confirm({
      title: 'ยืนยันการคืนอุปกรณ์',
      content: `บันทึกการคืน ${item.equipment.serialNumber} ใช่หรือไม่`,
      okText: 'ยืนยันคืนอุปกรณ์', cancelText: 'ยกเลิก',
      onOk: async () => {
        try { await apiService.updateIssuance(item.id, { returnDate: new Date().toISOString() }); message.success('บันทึกการคืนแล้ว'); await Promise.all([loadLookups(), loadHistory()]); }
        catch (reason) { message.error(getErrorMessage(reason)); }
      },
    });
  };

  const deleteRecord = (item: Issuance) => {
    Modal.confirm({
      title: 'ลบประวัติการเบิกนี้หรือไม่', content: 'ข้อมูลประวัติจะถูกลบถาวร', okText: 'ลบ', cancelText: 'ยกเลิก', okButtonProps: { danger: true },
      onOk: async () => {
        try { await apiService.deleteIssuance(item.id); message.success('ลบประวัติแล้ว'); await loadHistory(); }
        catch (reason) { message.error(getErrorMessage(reason)); }
      },
    });
  };

  const columns: TableProps<Issuance>['columns'] = [
    { title: 'วันที่เบิก', dataIndex: 'issueDate', key: 'issueDate', render: formatDate },
    { title: 'อุปกรณ์', key: 'equipment', render: (_, item) => <><Typography.Text strong>{item.equipment.serialNumber}</Typography.Text><br /><Typography.Text type="secondary">{item.equipment.type?.name ?? '—'}</Typography.Text></> },
    { title: 'ผู้เบิก', key: 'employee', render: (_, item) => <><Typography.Text>{item.employee.name}</Typography.Text><br /><Typography.Text type="secondary">{item.employee.employeeId}</Typography.Text></> },
    { title: 'สถานที่', key: 'location', render: (_, item) => [item.building && `อาคาร ${item.building}`, item.floor && `ชั้น ${item.floor}`].filter(Boolean).join(' · ') || '—' },
    { title: 'หมายเลข JOB', dataIndex: 'jobNumber', key: 'jobNumber', render: (value: string | null) => value || '—' },
    { title: 'สถานะ', key: 'state', render: (_, item) => item.returnDate ? <Tag color="default">คืนแล้ว</Tag> : <Tag color="blue">กำลังใช้งาน</Tag> },
    ...(canWrite ? [{ title: 'จัดการ', key: 'actions', render: (_value: unknown, item: Issuance) => <Space>{!item.returnDate && <Button type="link" onClick={() => returnEquipment(item)}>รับคืน</Button>}{isAdmin && <Button type="link" danger onClick={() => deleteRecord(item)}>ลบ</Button>}</Space> }] : []),
  ];

  const applyFilters = (event: React.FormEvent) => { event.preventDefault(); setResult((current) => ({ ...current, page: 1 })); };

  return (
    <div className="page-stack">
      <section className="page-intro"><div><Typography.Text className="eyebrow">LENDING LOG</Typography.Text><Typography.Title level={2}>ประวัติการเบิก</Typography.Title><Typography.Paragraph>ติดตามว่าอุปกรณ์อยู่กับใครและถูกนำไปใช้งานที่ใด</Typography.Paragraph></div>{canWrite && <Space wrap><Button onClick={() => setEmployeeModalOpen(true)}>+ เพิ่มพนักงาน</Button><Button type="primary" onClick={() => { form.resetFields(); form.setFieldValue('issueDate', new Date().toISOString().slice(0, 10)); setModalOpen(true); }}>+ บันทึกการเบิก</Button></Space>}</section>
      {error && <Alert type="error" showIcon message={error} />}
      <Card bordered={false} className="content-card">
        <form className="filter-bar" onSubmit={applyFilters}>
          <label>ตั้งแต่<input type="date" value={filters.startDate} onChange={(event) => setFilters({ ...filters, startDate: event.target.value })} /></label>
          <label>ถึง<input type="date" value={filters.endDate} onChange={(event) => setFilters({ ...filters, endDate: event.target.value })} /></label>
          <label>อาคาร<input value={filters.building} placeholder="ทั้งหมด" onChange={(event) => setFilters({ ...filters, building: event.target.value })} /></label>
          <label>ชั้น<input value={filters.floor} placeholder="ทั้งหมด" onChange={(event) => setFilters({ ...filters, floor: event.target.value })} /></label>
          <label>หมายเลข JOB<input value={filters.jobNumber} placeholder="ค้นหา JOB" onChange={(event) => setFilters({ ...filters, jobNumber: event.target.value })} /></label>
          <Button htmlType="submit">ค้นหา</Button>
        </form>
        <Table rowKey="id" loading={loading} columns={columns} dataSource={result.data} locale={{ emptyText: <Empty description="ยังไม่มีประวัติการเบิก" /> }} scroll={{ x: 950 }} pagination={{ current: result.page, pageSize: result.pageSize, total: result.total, showSizeChanger: true, onChange: (page, pageSize) => setResult((current) => ({ ...current, page, pageSize })) }} />
      </Card>

      <Modal title="บันทึกการเบิกอุปกรณ์" open={modalOpen} onCancel={() => setModalOpen(false)} footer={null} destroyOnHidden>
        <Form form={form} layout="vertical" onFinish={submitIssuance} requiredMark="optional">
          <Form.Item name="equipmentId" label="อุปกรณ์" rules={[{ required: true, message: 'กรุณาเลือกอุปกรณ์' }]}><Select showSearch optionFilterProp="label" placeholder="เลือกอุปกรณ์ที่พร้อมใช้งาน" options={equipment.map((item) => ({ value: item.id, label: `${item.serialNumber} — ${item.type?.name ?? ''}` }))} /></Form.Item>
          <Form.Item name="employeeId" label="ผู้เบิก" rules={[{ required: true, message: 'กรุณาเลือกผู้เบิก' }]}><Select showSearch optionFilterProp="label" placeholder={employees.length ? 'เลือกพนักงาน' : 'กรุณาเพิ่มพนักงานก่อน'} options={employees.map((item) => ({ value: item.id, label: `${item.name} (${item.employeeId})` }))} /></Form.Item>
          <Form.Item name="issueDate" label="วันที่เบิก"><Input type="date" /></Form.Item>
          <div className="form-grid"><Form.Item name="building" label="อาคาร"><Input placeholder="เช่น A" /></Form.Item><Form.Item name="floor" label="ชั้น"><Input placeholder="เช่น 2" /></Form.Item></div>
          <Form.Item name="jobNumber" label="หมายเลข JOB"><Input placeholder="เช่น JOB-2026-001" /></Form.Item>
          <Form.Item name="notes" label="หมายเหตุ"><Input.TextArea rows={3} /></Form.Item>
          <div className="modal-actions"><Button onClick={() => setModalOpen(false)}>ยกเลิก</Button><Button type="primary" htmlType="submit">บันทึก</Button></div>
        </Form>
      </Modal>

      <Modal title="เพิ่มพนักงาน" open={employeeModalOpen} onCancel={() => setEmployeeModalOpen(false)} footer={null} destroyOnHidden>
        <Form form={employeeForm} layout="vertical" onFinish={submitEmployee} requiredMark="optional">
          <Form.Item name="employeeId" label="รหัสพนักงาน" rules={[{ required: true, message: 'กรุณาระบุรหัสพนักงาน' }]}><Input /></Form.Item>
          <Form.Item name="name" label="ชื่อ-นามสกุล" rules={[{ required: true, message: 'กรุณาระบุชื่อพนักงาน' }]}><Input /></Form.Item>
          <div className="form-grid"><Form.Item name="department" label="แผนก"><Input /></Form.Item><Form.Item name="position" label="ตำแหน่ง"><Input /></Form.Item></div>
          <div className="modal-actions"><Button onClick={() => setEmployeeModalOpen(false)}>ยกเลิก</Button><Button type="primary" htmlType="submit">บันทึก</Button></div>
        </Form>
      </Modal>
    </div>
  );
}
