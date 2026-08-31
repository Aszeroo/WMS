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
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { apiService } from '../services/api';
import { getErrorMessage } from '../services/errors';
import type {
  Employee,
  EquipmentInstance,
  PageResult,
  Repair,
  RepairCreateInput,
  RepairHistoryQuery,
  RepairUpdateInput,
} from '../types';

const repairStatusOptions = [
  { value: 'reported', label: 'แจ้งซ่อม', color: 'orange' },
  { value: 'in_progress', label: 'กำลังซ่อม', color: 'blue' },
  { value: 'completed', label: 'ซ่อมเสร็จแล้ว', color: 'green' },
  { value: 'rejected', label: 'ยกเลิก', color: 'default' },
];
const statusByValue = Object.fromEntries(repairStatusOptions.map((item) => [item.value, item]));
const EQUIPMENT_PAGE_SIZE = 20;

type RepairFormValues = {
  equipmentId: number;
  employeeId?: number;
  repairDate?: string;
  symptoms: string;
  status?: string;
  repairedBy?: string;
  notes?: string;
};
type RepairFilters = {
  startDate: string;
  endDate: string;
  status: string;
  equipmentId?: number;
  employeeId?: number;
};
type EquipmentSearchSelectProps = {
  value?: number;
  onChange: (value: number | undefined) => void;
  status?: 'available';
  onLookupError: (error: string) => void;
};

const emptyFilters = (): RepairFilters => ({ startDate: '', endDate: '', status: '' });

function formatDate(value?: string | null) {
  return value ? new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium' }).format(new Date(value)) : '—';
}

function equipmentLabel(item: EquipmentInstance) {
  return `${item.serialNumber} — ${item.type?.name ?? ''}`;
}

function EquipmentSearchSelect({ value, onChange, status, onLookupError }: EquipmentSearchSelectProps) {
  const [options, setOptions] = useState<EquipmentInstance[]>([]);
  const [loading, setLoading] = useState(false);
  const latestRequest = useRef(0);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const selectedOption = useRef<EquipmentInstance | undefined>(undefined);

  const loadOptions = useCallback(async (search: string) => {
    const requestId = latestRequest.current + 1;
    latestRequest.current = requestId;
    setLoading(true);
    try {
      const result = await apiService.getInstances({
        search: search || undefined,
        status,
        page: 1,
        pageSize: EQUIPMENT_PAGE_SIZE,
      });
      if (requestId !== latestRequest.current) return;
      setOptions((current) => {
        const selected = selectedOption.current ?? current.find((item) => item.id === value);
        return selected && !result.data.some((item) => item.id === selected.id)
          ? [selected, ...result.data]
          : result.data;
      });
      onLookupError('');
    } catch (reason) {
      if (requestId === latestRequest.current) {
        onLookupError(getErrorMessage(reason, 'ไม่สามารถค้นหารายการอุปกรณ์ได้'));
      }
    } finally {
      if (requestId === latestRequest.current) setLoading(false);
    }
  }, [onLookupError, status, value]);

  useEffect(() => {
    void loadOptions('');
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [loadOptions]);

  const search = useCallback((query: string) => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      void loadOptions(query);
    }, 250);
  }, [loadOptions]);

  return (
    <Select
      allowClear
      showSearch
      filterOption={false}
      loading={loading}
      optionFilterProp="label"
      placeholder="ค้นหาหมายเลขซีเรียล ยี่ห้อ หรือรุ่น"
      value={value}
      onChange={(nextValue) => {
        selectedOption.current = options.find((item) => item.id === nextValue);
        onChange(nextValue ?? undefined);
      }}
      onSearch={search}
      options={options.map((item) => ({ value: item.id, label: equipmentLabel(item) }))}
    />
  );
}

export function RepairHistoryPage() {
  const { canWrite, isAdmin } = useAuth();
  const [result, setResult] = useState<PageResult<Repair>>({ data: [], total: 0, page: 1, pageSize: 10, totalPages: 0 });
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [draftFilters, setDraftFilters] = useState<RepairFilters>(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState<RepairFilters>(emptyFilters);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Repair | null>(null);
  const [historyError, setHistoryError] = useState('');
  const [lookupError, setLookupError] = useState('');
  const [equipmentLookupVersion, setEquipmentLookupVersion] = useState(0);
  const [form] = Form.useForm<RepairFormValues>();

  const loadEmployees = useCallback(async () => {
    setLookupError('');
    try {
      setEmployees(await apiService.getEmployees());
    } catch (reason) {
      setLookupError(getErrorMessage(reason, 'ไม่สามารถโหลดข้อมูลพนักงานได้'));
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setHistoryError('');
    const query: RepairHistoryQuery = {
      page: result.page,
      pageSize: result.pageSize,
      ...(appliedFilters.startDate ? { startDate: appliedFilters.startDate } : {}),
      ...(appliedFilters.endDate ? { endDate: appliedFilters.endDate } : {}),
      ...(appliedFilters.status ? { status: appliedFilters.status } : {}),
      ...(appliedFilters.equipmentId ? { equipmentId: appliedFilters.equipmentId } : {}),
      ...(appliedFilters.employeeId ? { employeeId: appliedFilters.employeeId } : {}),
    };
    try {
      setResult(await apiService.getRepairs(query));
    } catch (reason) {
      setHistoryError(getErrorMessage(reason, 'ไม่สามารถโหลดประวัติการซ่อมได้'));
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, result.page, result.pageSize]);

  useEffect(() => {
    void loadEmployees();
  }, [loadEmployees]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const openModal = (repair?: Repair) => {
    const nextEditing = repair ?? null;
    setEditing(nextEditing);
    form.resetFields();
    form.setFieldsValue(nextEditing ? {
      equipmentId: nextEditing.equipmentId,
      employeeId: nextEditing.employeeId ?? undefined,
      repairDate: new Date(nextEditing.repairDate).toISOString().slice(0, 10),
      symptoms: nextEditing.symptoms,
      status: nextEditing.status,
      repairedBy: nextEditing.repairedBy ?? undefined,
      notes: nextEditing.notes ?? undefined,
    } : { repairDate: new Date().toISOString().slice(0, 10), status: 'reported' });
    setModalOpen(true);
  };

  const submitRepair = async (values: RepairFormValues) => {
    const repairDate = values.repairDate
      ? new Date(`${values.repairDate}T00:00:00`).toISOString()
      : undefined;
    try {
      if (editing) {
        const updatePayload: RepairUpdateInput = {
          employeeId: values.employeeId,
          repairDate,
          symptoms: values.symptoms,
          status: values.status,
          repairedBy: values.repairedBy,
          notes: values.notes,
        };
        await apiService.updateRepair(editing.id, updatePayload);
        message.success('แก้ไขประวัติการซ่อมแล้ว');
      } else {
        const createPayload: RepairCreateInput = {
          equipmentId: values.equipmentId,
          employeeId: values.employeeId,
          repairDate,
          symptoms: values.symptoms,
          status: values.status,
          repairedBy: values.repairedBy,
          notes: values.notes,
        };
        await apiService.createRepair(createPayload);
        message.success('บันทึกประวัติการซ่อมแล้ว');
      }
      setModalOpen(false);
      form.resetFields();
      await loadHistory();
    } catch (reason) {
      message.error(getErrorMessage(reason));
    }
  };

  const deleteRepair = (repair: Repair) => {
    Modal.confirm({
      title: 'ลบประวัติการซ่อมนี้หรือไม่',
      content: 'ข้อมูลจะถูกลบถาวร',
      okText: 'ลบ',
      cancelText: 'ยกเลิก',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await apiService.deleteRepair(repair.id);
          message.success('ลบประวัติแล้ว');
          await loadHistory();
        } catch (reason) {
          message.error(getErrorMessage(reason));
        }
      },
    });
  };

  const applyFilters = (event: React.FormEvent) => {
    event.preventDefault();
    setAppliedFilters({ ...draftFilters });
    setResult((current) => ({ ...current, page: 1 }));
  };

  const clearFilters = () => {
    const filters = emptyFilters();
    setDraftFilters(filters);
    setAppliedFilters(filters);
    setResult((current) => ({ ...current, page: 1 }));
  };

  const retryLookups = () => {
    void loadEmployees();
    setEquipmentLookupVersion((version) => version + 1);
  };

  const columns: TableProps<Repair>['columns'] = [
    { title: 'วันที่แจ้ง', dataIndex: 'repairDate', key: 'repairDate', render: formatDate },
    { title: 'อุปกรณ์', key: 'equipment', render: (_, item) => <><Typography.Text strong>{item.equipment.serialNumber}</Typography.Text><br /><Typography.Text type="secondary">{item.equipment.type?.name ?? '—'}</Typography.Text></> },
    { title: 'อาการ / รายละเอียด', key: 'symptoms', width: 240, render: (_, item) => <><Typography.Text>{item.symptoms}</Typography.Text>{item.notes && <><br /><Typography.Text type="secondary">{item.notes}</Typography.Text></>}</> },
    { title: 'ผู้รับผิดชอบ', key: 'assignee', render: (_, item) => item.employee?.name ?? item.repairedBy ?? '—' },
    { title: 'สถานะ', dataIndex: 'status', key: 'status', render: (value: string) => { const status = statusByValue[value]; return <Tag color={status?.color}>{status?.label ?? value}</Tag>; } },
    ...(canWrite ? [{ title: 'จัดการ', key: 'actions', render: (_value: unknown, item: Repair) => <Space><Button type="link" onClick={() => openModal(item)}>แก้ไข</Button>{isAdmin && <Button type="link" danger onClick={() => deleteRepair(item)}>ลบ</Button>}</Space> }] : []),
  ];

  return (
    <div className="page-stack">
      <section className="page-intro"><div><Typography.Text className="eyebrow">MAINTENANCE LOG</Typography.Text><Typography.Title level={2}>ประวัติการซ่อม</Typography.Title><Typography.Paragraph>บันทึกอาการ การดำเนินการ และสถานะการซ่อมของอุปกรณ์</Typography.Paragraph></div>{canWrite && <Button type="primary" onClick={() => openModal()}>+ แจ้งซ่อม</Button>}</section>
      {historyError && <Alert type="error" showIcon message={historyError} action={<Button size="small" onClick={() => void loadHistory()}>ลองใหม่</Button>} />}
      {lookupError && <Alert type="warning" showIcon message={lookupError} action={<Button size="small" onClick={retryLookups}>ลองใหม่</Button>} />}
      <Card bordered={false} className="content-card">
        <form className="filter-bar" onSubmit={applyFilters}>
          <label>ตั้งแต่<input type="date" value={draftFilters.startDate} onChange={(event) => setDraftFilters((current) => ({ ...current, startDate: event.target.value }))} /></label>
          <label>ถึง<input type="date" value={draftFilters.endDate} onChange={(event) => setDraftFilters((current) => ({ ...current, endDate: event.target.value }))} /></label>
          <label>สถานะ<select value={draftFilters.status} onChange={(event) => setDraftFilters((current) => ({ ...current, status: event.target.value }))}><option value="">ทั้งหมด</option>{repairStatusOptions.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></label>
          <label>อุปกรณ์<EquipmentSearchSelect key={`filter-${equipmentLookupVersion}`} value={draftFilters.equipmentId} onChange={(equipmentId) => setDraftFilters((current) => ({ ...current, equipmentId }))} onLookupError={setLookupError} /></label>
          <label>ผู้รับผิดชอบ<Select allowClear showSearch optionFilterProp="label" placeholder="ทั้งหมด" value={draftFilters.employeeId} onChange={(employeeId) => setDraftFilters((current) => ({ ...current, employeeId: employeeId ?? undefined }))} options={employees.map((item) => ({ value: item.id, label: `${item.name} (${item.employeeId})` }))} /></label>
          <Space><Button htmlType="submit">ค้นหา</Button><Button onClick={clearFilters}>ล้างตัวกรอง</Button></Space>
        </form>
        <Table rowKey="id" loading={loading} columns={columns} dataSource={result.data} locale={{ emptyText: <Empty description="ยังไม่มีประวัติการซ่อม" /> }} scroll={{ x: 1050 }} pagination={{ current: result.page, pageSize: result.pageSize, total: result.total, showSizeChanger: true, onChange: (page, pageSize) => setResult((current) => ({ ...current, page, pageSize })) }} />
      </Card>

      <Modal title={editing ? 'แก้ไขประวัติการซ่อม' : 'แจ้งซ่อมอุปกรณ์'} open={modalOpen} onCancel={() => setModalOpen(false)} footer={null} destroyOnHidden>
        <Form form={form} layout="vertical" onFinish={submitRepair} requiredMark="optional">
          {editing ? <Form.Item label="อุปกรณ์"><Input value={equipmentLabel(editing.equipment)} disabled /><Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>ไม่สามารถเปลี่ยนอุปกรณ์ของประวัติการซ่อมได้ หากเลือกอุปกรณ์ผิด ให้ลบและสร้างรายการใหม่ตามสิทธิ์</Typography.Paragraph></Form.Item> : <Form.Item name="equipmentId" label="อุปกรณ์" rules={[{ required: true, message: 'กรุณาเลือกอุปกรณ์' }]}><EquipmentSearchSelect key={`create-${equipmentLookupVersion}`} onChange={(equipmentId) => form.setFieldValue('equipmentId', equipmentId)} status="available" onLookupError={setLookupError} /></Form.Item>}
          <Form.Item name="employeeId" label="ผู้รับผิดชอบ"><Select allowClear showSearch optionFilterProp="label" placeholder="เลือกพนักงาน (ถ้ามี)" options={employees.map((item) => ({ value: item.id, label: `${item.name} (${item.employeeId})` }))} /></Form.Item>
          <div className="form-grid"><Form.Item name="repairDate" label="วันที่แจ้ง"><Input type="date" /></Form.Item><Form.Item name="status" label="สถานะ"><Select options={repairStatusOptions.map(({ value, label }) => ({ value, label }))} /></Form.Item></div>
          <Form.Item name="symptoms" label="อาการ / ปัญหา" rules={[{ required: true, message: 'กรุณาระบุอาการหรือปัญหา' }]}><Input.TextArea rows={3} placeholder="อธิบายอาการที่พบ" /></Form.Item>
          <Form.Item name="repairedBy" label="ช่าง / ผู้ซ่อม"><Input placeholder="ระบุชื่อช่าง (ถ้ามี)" /></Form.Item>
          <Form.Item name="notes" label="หมายเหตุ"><Input.TextArea rows={2} /></Form.Item>
          <div className="modal-actions"><Button onClick={() => setModalOpen(false)}>ยกเลิก</Button><Button type="primary" htmlType="submit">บันทึก</Button></div>
        </Form>
      </Modal>
    </div>
  );
}
