import { Alert, Button, Card, Form, Input, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { preloadAuthenticatedShell } from '../routes/lazyPages';
import { getErrorMessage } from '../services/errors';

type LoginValues = { identifier: string; password: string };

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const destination = (location.state as { from?: string } | null)?.from ?? '/dashboard';

  useEffect(() => {
    if (user) navigate(destination, { replace: true });
  }, [destination, navigate, user]);

  const submit = async (values: LoginValues) => {
    setError('');
    setSubmitting(true);
    try {
      await login(values.identifier, values.password);
      preloadAuthenticatedShell();
      navigate(destination, { replace: true });
    } catch (reason) {
      setError(getErrorMessage(reason, 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login-page">
      <Card className="login-card" bordered={false}>
        <div className="login-brand"><span className="brand-symbol">ED</span><span>Equipment Desk</span></div>
        <Typography.Text className="eyebrow">SECURE OPERATIONS CONSOLE</Typography.Text>
        <Typography.Title level={2}>เข้าสู่ระบบ</Typography.Title>
        <Typography.Paragraph type="secondary">กรุณาเข้าสู่ระบบเพื่อจัดการข้อมูลอุปกรณ์</Typography.Paragraph>
        {error && <Alert type="error" showIcon message={error} className="login-error" />}
        <Form layout="vertical" onFinish={submit} requiredMark="optional">
          <Form.Item name="identifier" label="ชื่อผู้ใช้หรืออีเมล" rules={[{ required: true, message: 'กรุณาระบุชื่อผู้ใช้หรืออีเมล' }]}>
            <Input autoComplete="username" autoFocus placeholder="username หรือ email" />
          </Form.Item>
          <Form.Item name="password" label="รหัสผ่าน" rules={[{ required: true, message: 'กรุณาระบุรหัสผ่าน' }]}>
            <Input.Password autoComplete="current-password" placeholder="รหัสผ่าน" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={submitting}>เข้าสู่ระบบ</Button>
        </Form>
      </Card>
    </main>
  );
}
