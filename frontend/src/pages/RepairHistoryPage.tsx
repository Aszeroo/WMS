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
import { useTranslation } from 'react-i18next';
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

function equipmentLabel(item: EquipmentInstance) {
  return `${item.serialNumber} — ${item.type?.name ?? ''}`;
}

function EquipmentSearchSelect({ value, onChange, status, onLookupError }: EquipmentSearchSelectProps) {
  const [options, setOptions] = useState<EquipmentInstance[]>([]);
  const [loading, setLoading] = useState(false);
  const latestRequest = useRef(0);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const selectedOption = useRef<EquipmentInstance | undefined>(undefined);
  const { t } = useTranslation();

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
      placeholder={t('equipmentSearch.placeholder')}
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
  const { t, i18n } = useTranslation();

  // Format date according to current language
  const formatDate = (value?: string | null) => {
    if (!value) return '—';
    const locale = i18n.language === 'th' ? 'th-TH' : 'en-US';
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(value));
  };

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

  // Compute repair status options using translation
  const repairStatusOptions = [
    { value: 'reported', label: t('repairHistory.status.reported'), color: 'orange' },
    { value: 'in_progress', label: t('repairHistory.status.in_progress'), color: 'blue' },
    { value: 'completed', label: t('repairHistory.status.completed'), color: 'green' },
    { value: 'rejected', label: t('repairHistory.status.rejected'), color: 'default' },
  ];
  const statusByValue = Object.fromEntries(repairStatusOptions.map((item) => [item.value, item]));

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
        message.success(t('repairHistory.messages.updateSuccess'));
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
        message.success(t('repairHistory.messages.createSuccess'));
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
      title: t('repairHistory.deleteConfirm.title'),
      content: t('repairHistory.deleteConfirm.content'),
      okText: t('repairHistory.deleteConfirm.okText'),
      cancelText: t('repairHistory.deleteConfirm.cancelText'),
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await apiService.deleteRepair(repair.id);
          message.success(t('repairHistory.messages.deleteSuccess'));
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
    { title: t('repairHistory.table.date'), dataIndex: 'repairDate', key: 'repairDate', render: formatDate },
    { title: t('repairHistory.table.equipment'), key: 'equipment', render: (_, item) => <><Typography.Text strong>{item.equipment.serialNumber}</Typography.Text><br /><Typography.Text type="secondary">{item.equipment.type?.name ?? '—'}</Typography.Text></> },
    { title: t('repairHistory.table.symptoms'), key: 'symptoms', width: 240, render: (_, item) => <><Typography.Text>{item.symptoms}</Typography.Text>{item.notes && <><br /><Typography.Text type="secondary">{item.notes}</Typography.Text></>}</> },
    { title: t('repairHistory.table.assignee'), key: 'assignee', render: (_, item) => item.employee?.name ?? item.repairedBy ?? '—' },
    { title: t('repairHistory.table.status'), dataIndex: 'status', key: 'status', render: (value: string) => { const status = statusByValue[value]; return <Tag color={status?.color}>{status?.label ?? value}</Tag>; } },
    ...(canWrite ? [{ title: t('repairHistory.table.actions'), key: 'actions', render: (_value: unknown, item: Repair) => <Space><Button type="link" onClick={() => openModal(item)}>{t('employeeManagement.modal.actions.edit')}</Button>{isAdmin && <Button type="link" danger onClick={() => deleteRepair(item)}>{t('employeeManagement.modal.actions.delete')}</Button>}</Space> }] : []),
  ];

  return (
    <div className="page-stack">
      <section className="page-intro"><div><Typography.Text className="eyebrow">{t('repairHistory.eyebrow')}</Typography.Text><Typography.Title level={2}>{t('repairHistory.title')}</Typography.Title><Typography.Paragraph>{t('repairHistory.description')}</Typography.Paragraph></div>{canWrite && <Button type="primary" onClick={() => openModal()}>{t('repairHistory.addButton')}</Button>}</section>
      {historyError && <Alert type="error" showIcon message={historyError} action={<Button size="small" onClick={() => void loadHistory()}>ลองใหม่</Button>} />}
      {lookupError && <Alert type="warning" showIcon message={lookupError} action={<Button size="small" onClick={retryLookups}>ลองใหม่</Button>} />}
      <Card className="content-card">
        <form className="filter-bar" onSubmit={applyFilters}>
          <label>{t('repairHistory.filter.startDate')}<input type="date" value={draftFilters.startDate} onChange={(event) => setDraftFilters((current) => ({ ...current, startDate: event.target.value }))} /></label>
          <label>{t('repairHistory.filter.endDate')}<input type="date" value={draftFilters.endDate} onChange={(event) => setDraftFilters((current) => ({ ...current, endDate: event.target.value }))} /></label>
          <label>{t('repairHistory.filter.status')}<select value={draftFilters.status} onChange={(event) => setDraftFilters((current) => ({ ...current, status: event.target.value }))}><option value="">{t('repairHistory.filter.all')}</option>{repairStatusOptions.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></label>
          <label>{t('repairHistory.filter.equipment')}<EquipmentSearchSelect key={`filter-${equipmentLookupVersion}`} value={draftFilters.equipmentId} onChange={(equipmentId) => setDraftFilters((current) => ({ ...current, equipmentId }))} onLookupError={setLookupError} /></label>
          <label>{t('repairHistory.filter.assignee')}<Select allowClear showSearch optionFilterProp="label" placeholder={t('repairHistory.filter.assignee')} value={draftFilters.employeeId} onChange={(employeeId) => setDraftFilters((current) => ({ ...current, employeeId: employeeId ?? undefined }))} options={employees.map((item) => ({ value: item.id, label: `${item.name} (${item.employeeId})` }))} /></label>
          <Space><Button htmlType="submit">{t('buttons.search')}</Button><Button onClick={clearFilters}>{t('buttons.reset')}</Button></Space>
        </form>
        <Table rowKey="id" loading={loading} columns={columns} dataSource={result.data} locale={{ emptyText: <Empty description={t('repairHistory.empty.description')} /> }} scroll={{ x: 1050 }} pagination={{ current: result.page, pageSize: result.pageSize, total: result.total, showSizeChanger: true, onChange: (page, pageSize) => setResult((current) => ({ ...current, page, pageSize })) }} />
      </Card>

      <Modal title={editing ? t('repairHistory.modal.title.edit') : t('repairHistory.modal.title.add')} open={modalOpen} onCancel={() => setModalOpen(false)} footer={null} destroyOnHidden>
        <Form form={form} layout="vertical" onFinish={submitRepair} requiredMark="optional">
          {editing ? (
            <Form.Item label={t('repairHistory.form.label.equipment')}>
              <Input value={equipmentLabel(editing.equipment)} disabled />
              <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
                ไม่สามารถเปลี่ยนอุปกรณ์ของประวัติการซ่อมได้ หากเลือกอุปกรณ์ผิด ให้ลบและสร้างรายการใหม่ตามสิทธิ์
              </Typography.Paragraph>
            </Form.Item>
          ) : (
            <Form.Item
              name="equipmentId"
              label={t('repairHistory.form.label.equipment')}
              rules={[{ required: true, message: t('repairHistory.form.label.equipment') }]}
            >
              <EquipmentSearchSelect
                key={`create-${equipmentLookupVersion}`}
                onChange={(equipmentId) => form.setFieldValue('equipmentId', equipmentId)}
                status="available"
                onLookupError={setLookupError}
              />
            </Form.Item>
          )}
          <Form.Item name="employeeId" label={t('repairHistory.form.label.assignee')}>
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder={t('repairHistory.form.label.assignee')}
              options={employees.map((item) => ({ value: item.id, label: `${item.name} (${item.employeeId})` }))}
            />
          </Form.Item>
          <div className="form-grid">
            <Form.Item name="repairDate" label={t('repairHistory.form.label.repairDate')}>
              <Input type="date" />
            </Form.Item>
            <Form.Item name="status" label={t('repairHistory.form.label.status')}>
              <Select options={repairStatusOptions.map(({ value, label }) => ({ value, label }))} />
            </Form.Item>
          </div>
          <Form.Item name="symptoms" label={t('repairHistory.form.label.symptoms')} rules={[{ required: true, message: t('repairHistory.form.label.symptoms') }]}>
            <Input.TextArea rows={3} placeholder={t('repairHistory.form.placeholder.symptoms')} />
          </Form.Item>
          <Form.Item name="repairedBy" label={t('repairHistory.form.label.repairedBy')}>
            <Input placeholder={t('repairHistory.form.label.repairedBy')} />
          </Form.Item>
          <Form.Item name="notes" label={t('repairHistory.form.label.notes')}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <div className="modal-actions">
            <Button onClick={() => setModalOpen(false)}>{t('cancel')}</Button>
            <Button type="primary" htmlType="submit">{t('save')}</Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
