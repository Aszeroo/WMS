import { Button, Layout, Menu, Space, Tag, Typography, message } from 'antd';
import { useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { preloadRoute } from '../routes/lazyPages';

const { Header, Sider, Content } = Layout;

const menuLabel = (path: string, label: string) => (
  <span onPointerEnter={() => preloadRoute(path)}>{label}</span>
);

const roleLabel = { admin: 'ผู้ดูแลระบบ', staff: 'เจ้าหน้าที่', viewer: 'ผู้ชม' } as const;

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAdmin } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const menuItems = useMemo(() => [
    { key: '/dashboard', label: menuLabel('/dashboard', 'ภาพรวมระบบ') },
    { key: '/equipment-management', label: menuLabel('/equipment-management', 'จัดการอุปกรณ์') },
    { key: '/employees', label: menuLabel('/employees', 'จัดการพนักงาน') },
    { key: '/issuance-history', label: menuLabel('/issuance-history', 'ประวัติการเบิก') },
    { key: '/repair-history', label: menuLabel('/repair-history', 'ประวัติการซ่อม') },
    { key: '/profile', label: menuLabel('/profile', 'โปรไฟล์ของฉัน') },
    ...(isAdmin ? [{ key: '/user-management', label: menuLabel('/user-management', 'จัดการผู้ใช้งาน') }] : []),
  ], [isAdmin]);
  const selectedKey = useMemo(
    () => menuItems.find((item) => location.pathname.startsWith(item.key))?.key ?? '/dashboard',
    [location.pathname, menuItems],
  );

  const signOut = async () => {
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch {
      message.error('ไม่สามารถออกจากระบบได้');
    }
  };

  return (
    <Layout className="app-shell">
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed} breakpoint="lg" theme="dark" className="app-sider">
        <div className="brand-mark"><span className="brand-symbol">ED</span>{!collapsed && <span>Equipment Desk</span>}</div>
        <Menu theme="dark" mode="inline" selectedKeys={[selectedKey]} items={menuItems} onClick={({ key }) => navigate(key)} />
      </Sider>
      <Layout>
        <Header className="app-header">
          <div>
            <Typography.Text className="eyebrow">OPERATIONS CONSOLE</Typography.Text>
            <Typography.Title level={3} className="header-title">ระบบจัดการอุปกรณ์</Typography.Title>
          </div>
          <Space size="middle">
            {user && <div className="account-summary"><Typography.Text strong>{user.username}</Typography.Text><Tag>{roleLabel[user.role]}</Tag></div>}
            <Button size="small" onClick={() => void signOut()}>ออกจากระบบ</Button>
          </Space>
        </Header>
        <Content className="app-content"><Outlet /></Content>
      </Layout>
    </Layout>
  );
}
