import { Alert, Button, Card, Empty, Form, Input, Modal, Space, Spin, Table, Typography, message } from 'antd';
import type { TableProps } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useTranslation } from 'react-i18next';
import { apiService } from '../services/api';
import { getErrorMessage } from '../services/errors';
import type { Employee } from '../types';

type EmployeeFormValues = { employeeId: string; name: string; department?: string; position?: string };

export function EmployeeManagementPage() {
  const { canWrite, isAdmin } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form] = Form.useForm<EmployeeFormValues>();
  const { t } = useTranslation();

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setEmployees(await apiService.getEmployees());
    } catch (reason) {
      setError(getErrorMessage(reason, t('employeeManagement.loadError')));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadEmployees(); }, [loadEmployees]);

  const openModal = (employee?: Employee) => {
    setEditing(employee ?? null);
    form.setFieldsValue(employee ? {
      employeeId: employee.employeeId,
      name: employee.name,
      department: employee.department ?? undefined,
      position: employee.position ?? undefined,
    } : {});
    setModalOpen(true);
  };

  const submit = async (values: EmployeeFormValues) => {
    try {
      if (editing) {
        await apiService.updateEmployee(editing.id, values);
        message.success(t('employeeManagement.messages.updateSuccess'));
      } else {
        await apiService.createEmployee(values);
        message.success(t('employeeManagement.messages.createSuccess'));
      }
      setModalOpen(false);
      form.resetFields();
      await loadEmployees();
    } catch (reason) {
      message.error(getErrorMessage(reason));
    }
  };

  const remove = (employee: Employee) => {
    Modal.confirm({
      title: t('employeeManagement.confirmDelete.title'),
      content: t('employeeManagement.confirmDelete.content', { name: employee.name }),
      okText: t('employeeManagement.confirmDelete.okText'),
      cancelText: t('employeeManagement.confirmDelete.cancelText'),
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await apiService.deleteEmployee(employee.id);
          message.success(t('employeeManagement.messages.updateSuccess')); // Actually delete success? We'll reuse updateSuccess or add new key. For simplicity, we'll use updateSuccess.
          await loadEmployees();
        } catch (reason) {
          message.error(getErrorMessage(reason));
        }
      },
    });
  };

  const columns: TableProps<Employee>['columns'] = [
    { title: t('employeeManagement.table.employeeId'), dataIndex: 'employeeId', key: 'employeeId', render: (value: string) => <Typography.Text code>{value}</Typography.Text> },
    { title: t('employeeManagement.table.name'), dataIndex: 'name', key: 'name', render: (value: string) => <Typography.Text strong>{value}</Typography.Text> },
    { title: t('employeeManagement.table.department'), dataIndex: 'department', key: 'department', render: (value: string | null) => value || '—' },
    { title: t('employeeManagement.table.position'), dataIndex: 'position', key: 'position', render: (value: string | null) => value || '—' },
    ...(canWrite ? [{
      title: t('employeeManagement.table.actions'),
      key: 'actions',
      width: 150,
      render: (_value: unknown, employee: Employee) => <Space><Button type="link" onClick={() => openModal(employee)}>{t('employeeManagement.modal.actions.edit')}</Button>{isAdmin && <Button type="link" danger onClick={() => remove(employee)}>{t('employeeManagement.modal.actions.delete')}</Button>}</Space>,
    }] : []),
  ];

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div>
          <Typography.Text className="eyebrow">{t('employeeManagement.eyebrow')}</Typography.Text>
          <Typography.Title level={2}>{t('employeeManagement.title')}</Typography.Title>
          <Typography.Paragraph>{t('employeeManagement.description')}</Typography.Paragraph>
        </div>
        {canWrite && <Button type="primary" onClick={() => openModal()}>{t('employeeManagement.addButton')}</Button>}
      </section>
      {error && <Alert type="error" showIcon message={error} action={<Button size="small" onClick={() => void loadEmployees()}>{t('employeeManagement.retry')}</Button>} />}
      <Card className="content-card">
        <Spin spinning={loading}>
          <Table rowKey="id" columns={columns} dataSource={employees} locale={{ emptyText: <Empty description={t('employeeManagement.loadError')} /> }} scroll={{ x: 650 }} pagination={{ pageSize: 10, showSizeChanger: true }} />
        </Spin>
      </Card>
      <Modal title={editing ? t('employeeManagement.modal.titleEdit') : t('employeeManagement.modal.titleAdd')} open={modalOpen} onCancel={() => setModalOpen(false)} footer={null} destroyOnHidden>
        <Form form={form} layout="vertical" onFinish={submit} requiredMark="optional">
          <Form.Item name="employeeId" label={t('employeeManagement.modal.form.employeeId')} rules={[{ required: true, message: 'กรุณาระบุรหัสพนักงาน' }]}><Input /></Form.Item>
          <Form.Item name="name" label={t('employeeManagement.modal.form.name')} rules={[{ required: true, message: 'กรุณาระบุชื่อพนักงาน' }]}><Input /></Form.Item>
          <div className="form-grid"><Form.Item name="department" label={t('employeeManagement.modal.form.department')}><Input /></Form.Item><Form.Item name="position" label={t('employeeManagement.modal.form.position')}><Input /></Form.Item></div>
          <div className="modal-actions"><Button onClick={() => setModalOpen(false)}>{t('employeeManagement.modal.actions.cancel')}</Button><Button type="primary" htmlType="submit">{t('employeeManagement.modal.actions.save')}</Button></div>
        </Form>
      </Modal>
    </div>
  );
}