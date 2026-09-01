import { Alert, Button, Card, Empty, Form, Input, Modal, Select, Space, Spin, Table, Tag, Typography, message } from 'antd';
import type { TableProps } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { apiService } from '../services/api';
import { getErrorMessage } from '../services/errors';
import type { User, UserCreateInput, UserRole, UserUpdateInput } from '../types';

type UserFormValues = UserCreateInput & { password?: string };

const roleOptions: Array<{ value: UserRole; label: string }> = [
  { value: 'admin', label: 'ผู้ดูแลระบบ' },
  { value: 'staff', label: 'เจ้าหน้าที่' },
  { value: 'viewer', label: 'ผู้ชม' },
];
const roleLabel = Object.fromEntries(roleOptions.map((item) => [item.value, item.label])) as Record<UserRole, string>;

export function UserManagementPage() {
  const { user: currentUser, isAdmin, updateUser, clearUser } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form] = Form.useForm<UserFormValues>();

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setUsers(await apiService.getUsers());
    } catch (reason) {
      setError(getErrorMessage(reason, 'ไม่สามารถโหลดข้อมูลผู้ใช้งานได้'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) void loadUsers();
  }, [isAdmin, loadUsers]);

  const openModal = (user?: User) => {
    setEditing(user ?? null);
    form.resetFields();
    if (user) {
      form.setFieldsValue({ username: user.username, email: user.email, role: user.role, password: undefined });
    } else {
      form.setFieldsValue({ role: 'viewer' });
    }
    setModalOpen(true);
  };

  const submit = async (values: UserFormValues) => {
    try {
      let updatedUser: User | undefined;
      if (editing) {
        const payload: UserUpdateInput = {
          username: values.username,
          email: values.email,
          role: values.role,
          ...(values.password ? { password: values.password } : {}),
        };
        updatedUser = await apiService.updateUser(editing.id, payload);
        message.success('แก้ไขข้อมูลผู้ใช้งานแล้ว');
      } else {
        await apiService.createUser({ username: values.username, email: values.email, password: values.password ?? '', role: values.role });
        message.success('เพิ่มผู้ใช้งานแล้ว');
      }
      setModalOpen(false);
      form.resetFields();
      if (updatedUser && currentUser?.id === updatedUser.id) {
        const sessionChanged = Boolean(values.password) || values.role !== currentUser.role;
        if (sessionChanged) {
          clearUser();
          navigate('/login', { replace: true });
          return;
        }
        updateUser(updatedUser);
      }
      await loadUsers();
    } catch (reason) {
      message.error(getErrorMessage(reason, 'ไม่สามารถบันทึกข้อมูลผู้ใช้งานได้'));
    }
  };

  const remove = (user: User) => {
    if (currentUser?.id === user.id) {
      message.error('ไม่สามารถลบบัญชีของตนเองได้');
      return;
    }
    Modal.confirm({
      title: 'ลบผู้ใช้งานนี้หรือไม่',
      content: `บัญชี “${user.username}” จะถูกลบถาวร`,
      okText: 'ลบ',
      cancelText: 'ยกเลิก',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await apiService.deleteUser(user.id);
          message.success('ลบผู้ใช้งานแล้ว');
          await loadUsers();
        } catch (reason) {
          message.error(getErrorMessage(reason, 'ไม่สามารถลบผู้ใช้งานได้'));
        }
      },
    });
  };

  if (!isAdmin) return null;

  const columns: TableProps<User>['columns'] = [
    { title: 'ชื่อผู้ใช้งาน', dataIndex: 'username', key: 'username', render: (value: string) => <Typography.Text strong>{value}</Typography.Text> },
    { title: 'อีเมล', dataIndex: 'email', key: 'email' },
    { title: 'สิทธิ์', dataIndex: 'role', key: 'role', render: (value: UserRole) => <Tag>{roleLabel[value]}</Tag> },
    {
      title: 'จัดการ',
      key: 'actions',
      render: (_value: unknown, user: User) => (
        <Space>
          <Button type="link" onClick={() => openModal(user)}>แก้ไข</Button>
          <Button type="link" danger disabled={currentUser?.id === user.id} onClick={() => remove(user)}>ลบ</Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div>
          <Typography.Text className="eyebrow">USER ADMINISTRATION</Typography.Text>
          <Typography.Title level={2}>จัดการผู้ใช้งาน</Typography.Title>
          <Typography.Paragraph>เพิ่ม แก้ไข และกำหนดสิทธิ์บัญชีผู้ใช้งานระบบ</Typography.Paragraph>
        </div>
        <Button type="primary" onClick={() => openModal()}>+ เพิ่มผู้ใช้งาน</Button>
      </section>
      {error && <Alert type="error" showIcon message={error} action={<Button size="small" onClick={() => void loadUsers()}>ลองใหม่</Button>} />}
      <Card bordered={false} className="content-card">
        <Spin spinning={loading}>
          <Table rowKey="id" columns={columns} dataSource={users} locale={{ emptyText: <Empty description="ยังไม่มีผู้ใช้งาน" /> }} scroll={{ x: 700 }} pagination={{ pageSize: 10, showSizeChanger: true }} />
        </Spin>
      </Card>
      <Modal title={editing ? 'แก้ไขผู้ใช้งาน' : 'เพิ่มผู้ใช้งาน'} open={modalOpen} onCancel={() => setModalOpen(false)} footer={null} destroyOnHidden>
        <Form form={form} layout="vertical" onFinish={submit} requiredMark="optional">
          <Form.Item name="username" label="ชื่อผู้ใช้งาน" rules={[{ required: true, message: 'กรุณาระบุชื่อผู้ใช้งาน' }, { min: 3, message: 'ชื่อผู้ใช้งานต้องมีอย่างน้อย 3 ตัวอักษร' }]}>
            <Input autoComplete="username" />
          </Form.Item>
          <Form.Item name="email" label="อีเมล" rules={[{ required: true, message: 'กรุณาระบุอีเมล' }, { type: 'email', message: 'กรุณาระบุอีเมลให้ถูกต้อง' }]}>
            <Input autoComplete="email" />
          </Form.Item>
          <Form.Item name="role" label="สิทธิ์การใช้งาน" rules={[{ required: true, message: 'กรุณาเลือกสิทธิ์การใช้งาน' }]}>
            <Select options={roleOptions} />
          </Form.Item>
          <Form.Item name="password" label={editing ? 'รหัสผ่านใหม่ (เว้นว่างหากไม่เปลี่ยน)' : 'รหัสผ่าน'} rules={[{ required: !editing, message: 'กรุณาระบุรหัสผ่าน' }, { min: 12, message: 'รหัสผ่านต้องมีอย่างน้อย 12 ตัวอักษร' }]}>
            <Input.Password autoComplete={editing ? 'new-password' : 'new-password'} />
          </Form.Item>
          <div className="modal-actions"><Button onClick={() => setModalOpen(false)}>ยกเลิก</Button><Button type="primary" htmlType="submit">บันทึก</Button></div>
        </Form>
      </Modal>
    </div>
  );
}
