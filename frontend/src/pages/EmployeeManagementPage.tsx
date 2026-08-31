import { Alert, Button, Card, Empty, Form, Input, Modal, Space, Spin, Table, Typography, message } from 'antd';
import type { TableProps } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
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

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setEmployees(await apiService.getEmployees());
    } catch (reason) {
      setError(getErrorMessage(reason, 'ไม่สามารถโหลดข้อมูลพนักงานได้'));
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
        message.success('แก้ไขข้อมูลพนักงานแล้ว');
      } else {
        await apiService.createEmployee(values);
        message.success('เพิ่มข้อมูลพนักงานแล้ว');
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
      title: 'ลบข้อมูลพนักงานนี้หรือไม่',
      content: `ข้อมูลของ “${employee.name}” จะถูกลบถาวร และไม่สามารถลบผู้ที่มีประวัติการเบิกหรือซ่อมได้`,
      okText: 'ลบ', cancelText: 'ยกเลิก', okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await apiService.deleteEmployee(employee.id);
          message.success('ลบข้อมูลพนักงานแล้ว');
          await loadEmployees();
        } catch (reason) {
          message.error(getErrorMessage(reason));
        }
      },
    });
  };

  const columns: TableProps<Employee>['columns'] = [
    { title: 'รหัสพนักงาน', dataIndex: 'employeeId', key: 'employeeId', render: (value: string) => <Typography.Text code>{value}</Typography.Text> },
    { title: 'ชื่อ-นามสกุล', dataIndex: 'name', key: 'name', render: (value: string) => <Typography.Text strong>{value}</Typography.Text> },
    { title: 'แผนก', dataIndex: 'department', key: 'department', render: (value: string | null) => value || '—' },
    { title: 'ตำแหน่ง', dataIndex: 'position', key: 'position', render: (value: string | null) => value || '—' },
    ...(canWrite ? [{
      title: 'จัดการ', key: 'actions', width: 150,
      render: (_value: unknown, employee: Employee) => <Space><Button type="link" onClick={() => openModal(employee)}>แก้ไข</Button>{isAdmin && <Button type="link" danger onClick={() => remove(employee)}>ลบ</Button>}</Space>,
    }] : []),
  ];

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div><Typography.Text className="eyebrow">PEOPLE DIRECTORY</Typography.Text><Typography.Title level={2}>จัดการพนักงาน</Typography.Title><Typography.Paragraph>จัดการรายชื่อผู้มีสิทธิ์เบิกและรับผิดชอบงานซ่อม</Typography.Paragraph></div>
        {canWrite && <Button type="primary" onClick={() => openModal()}>+ เพิ่มพนักงาน</Button>}
      </section>
      {error && <Alert type="error" showIcon message={error} action={<Button size="small" onClick={() => void loadEmployees()}>ลองใหม่</Button>} />}
      <Card bordered={false} className="content-card">
        <Spin spinning={loading}>
          <Table rowKey="id" columns={columns} dataSource={employees} locale={{ emptyText: <Empty description="ยังไม่มีข้อมูลพนักงาน" /> }} scroll={{ x: 650 }} pagination={{ pageSize: 10, showSizeChanger: true }} />
        </Spin>
      </Card>
      <Modal title={editing ? 'แก้ไขข้อมูลพนักงาน' : 'เพิ่มพนักงาน'} open={modalOpen} onCancel={() => setModalOpen(false)} footer={null} destroyOnHidden>
        <Form form={form} layout="vertical" onFinish={submit} requiredMark="optional">
          <Form.Item name="employeeId" label="รหัสพนักงาน" rules={[{ required: true, message: 'กรุณาระบุรหัสพนักงาน' }]}><Input /></Form.Item>
          <Form.Item name="name" label="ชื่อ-นามสกุล" rules={[{ required: true, message: 'กรุณาระบุชื่อพนักงาน' }]}><Input /></Form.Item>
          <div className="form-grid"><Form.Item name="department" label="แผนก"><Input /></Form.Item><Form.Item name="position" label="ตำแหน่ง"><Input /></Form.Item></div>
          <div className="modal-actions"><Button onClick={() => setModalOpen(false)}>ยกเลิก</Button><Button type="primary" htmlType="submit">บันทึก</Button></div>
        </Form>
      </Modal>
    </div>
  );
}
