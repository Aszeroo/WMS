import { Alert, Button, Card, Form, Input, Space, Tag, Typography, message } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { apiService } from '../services/api';
import { getErrorMessage } from '../services/errors';
import type { ChangePasswordInput, ProfileUpdateInput } from '../types';

type ProfileFormValues = Required<ProfileUpdateInput>;
type PasswordFormValues = ChangePasswordInput & { confirmPassword: string };

const roleLabel = { admin: 'ผู้ดูแลระบบ', staff: 'เจ้าหน้าที่', viewer: 'ผู้ชม' } as const;

export function ProfilePage() {
  const { user, updateUser, clearUser } = useAuth();
  const navigate = useNavigate();
  const [profileForm] = Form.useForm<ProfileFormValues>();
  const [passwordForm] = Form.useForm<PasswordFormValues>();
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [error, setError] = useState('');

  if (!user) return null;

  const submitProfile = async (values: ProfileFormValues) => {
    setError('');
    setProfileLoading(true);
    try {
      const nextUser = await apiService.updateProfile(values);
      updateUser(nextUser);
      profileForm.setFieldsValue({ username: nextUser.username, email: nextUser.email });
      message.success('บันทึกข้อมูลโปรไฟล์แล้ว');
    } catch (reason) {
      setError(getErrorMessage(reason, 'ไม่สามารถบันทึกข้อมูลโปรไฟล์ได้'));
    } finally {
      setProfileLoading(false);
    }
  };

  const submitPassword = async (values: PasswordFormValues) => {
    setError('');
    setPasswordLoading(true);
    try {
      await apiService.changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword });
      passwordForm.resetFields();
      clearUser();
      message.success('เปลี่ยนรหัสผ่านแล้ว กรุณาเข้าสู่ระบบใหม่');
      navigate('/login', { replace: true });
    } catch (reason) {
      setError(getErrorMessage(reason, 'ไม่สามารถเปลี่ยนรหัสผ่านได้'));
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div>
          <Typography.Text className="eyebrow">ACCOUNT SETTINGS</Typography.Text>
          <Typography.Title level={2}>โปรไฟล์ของฉัน</Typography.Title>
          <Typography.Paragraph>ดูและแก้ไขข้อมูลบัญชีของคุณ</Typography.Paragraph>
        </div>
      </section>
      {error && <Alert type="error" showIcon message={error} />}
      <Card bordered={false} className="content-card" title="ข้อมูลบัญชี">
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Typography.Text>สิทธิ์การใช้งาน: <Tag>{roleLabel[user.role]}</Tag></Typography.Text>
          <Form
            form={profileForm}
            layout="vertical"
            initialValues={{ username: user.username, email: user.email }}
            onFinish={submitProfile}
            requiredMark="optional"
          >
            <Form.Item name="username" label="ชื่อผู้ใช้งาน" rules={[{ required: true, message: 'กรุณาระบุชื่อผู้ใช้งาน' }, { min: 3, message: 'ชื่อผู้ใช้งานต้องมีอย่างน้อย 3 ตัวอักษร' }]}>
              <Input autoComplete="username" />
            </Form.Item>
            <Form.Item name="email" label="อีเมล" rules={[{ required: true, message: 'กรุณาระบุอีเมล' }, { type: 'email', message: 'กรุณาระบุอีเมลให้ถูกต้อง' }]}>
              <Input autoComplete="email" />
            </Form.Item>
            <div className="modal-actions"><Button type="primary" htmlType="submit" loading={profileLoading}>บันทึกข้อมูล</Button></div>
          </Form>
        </Space>
      </Card>
      <Card bordered={false} className="content-card" title="เปลี่ยนรหัสผ่าน">
        <Form form={passwordForm} layout="vertical" onFinish={submitPassword} requiredMark="optional">
          <Form.Item name="currentPassword" label="รหัสผ่านปัจจุบัน" rules={[{ required: true, message: 'กรุณาระบุรหัสผ่านปัจจุบัน' }]}>
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Form.Item name="newPassword" label="รหัสผ่านใหม่" rules={[{ required: true, message: 'กรุณาระบุรหัสผ่านใหม่' }, { min: 12, message: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 12 ตัวอักษร' }]}>
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="ยืนยันรหัสผ่านใหม่"
            dependencies={['newPassword']}
            rules={[{ required: true, message: 'กรุณายืนยันรหัสผ่านใหม่' }, ({ getFieldValue }) => ({ validator: async (_rule, value) => value === getFieldValue('newPassword') ? undefined : Promise.reject(new Error('รหัสผ่านใหม่ไม่ตรงกัน')) })]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <div className="modal-actions"><Button type="primary" htmlType="submit" loading={passwordLoading}>เปลี่ยนรหัสผ่าน</Button></div>
        </Form>
      </Card>
    </div>
  );
}
