import { Button, Layout, Menu, Space, Tag, Typography, message, Select } from 'antd';
import { useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { preloadRoute } from '../routes/lazyPages';
import { useLocaleTheme } from '../context/LocaleThemeContext';
import { useTranslation } from 'react-i18next';
import { DownOutlined, SunOutlined, MoonOutlined } from '@ant-design/icons';

const { Header, Sider, Content } = Layout;

const menuLabel = (path: string, label: string) => (
  <span onPointerEnter={() => preloadRoute(path)}>{label}</span>
);

const roleLabel = { admin: 'ผู้ดูแลระบบ', staff: 'เจ้าหน้าที่', viewer: 'ผู้ชม' } as const;

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAdmin } = useAuth();
  const { language, setLanguage, darkMode, setDarkMode } = useLocaleTheme();
  const { t } = useTranslation();

  const [collapsed, setCollapsed] = useState(false);
  const menuItems = useMemo(() => [
    { key: '/dashboard', label: menuLabel('/dashboard', t('dashboard')) },
    { key: '/equipment-management', label: menuLabel('/equipment-management', t('equipment_management')) },
    { key: '/employees', label: menuLabel('/employees', t('employees')) },
    { key: '/issuance-history', label: menuLabel('/issuance-history', t('issuance_history')) },
    { key: '/repair-history', label: menuLabel('/repair-history', t('repair_history')) },
    { key: '/profile', label: menuLabel('/profile', t('profile')) },
    ...(isAdmin ? [{ key: '/user-management', label: menuLabel('/user-management', t('user_management')) }] : []),
  ], [isAdmin, t]);
  const selectedKey = useMemo(
    () => menuItems.find((item) => location.pathname.startsWith(item.key))?.key ?? '/dashboard',
    [location.pathname, menuItems],
  );

  const signOut = async () => {
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch {
      message.error(t('logout_success') ?? 'ไม่สามารถออกจากระบบได้');
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
            <Typography.Text className="eyebrow">{t('operations_console')}</Typography.Text>
            <Typography.Title level={3} className="header-title">{t('equipment_management_system')}</Typography.Title>
          </div>
          <Space size="middle">
            {user && (
              <div className="account-summary">
                <Typography.Text strong>{user.username}</Typography.Text>
                <Tag>{roleLabel[user.role]}</Tag>
              </div>
            )}
            <Select value={language} onChange={setLanguage} style={{ width: 80 }}>
              <Select.Option value="th">ไทย</Select.Option>
              <Select.Option value="en">English</Select.Option>
            </Select>
            <Button type={darkMode ? 'default' : 'primary'} icon={darkMode ? <SunOutlined /> : <MoonOutlined />} onClick={() => setDarkMode(!darkMode)} size="small">
              {t(darkMode ? 'light_mode' : 'dark_mode')}
            </Button>
            <Button size="small" onClick={() => void signOut()}>
              {t('logout')}
            </Button>
          </Space>
        </Header>
        <Content className="app-content"><Outlet /></Content>
      </Layout>
    </Layout>
  );
}
