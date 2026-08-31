import { Spin } from 'antd';
import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { AppLayout } from './components/AppLayout';

const LoginPage = lazy(() => import('./pages/LoginPage').then((module) => ({ default: module.LoginPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })));
const EquipmentManagementPage = lazy(() => import('./pages/EquipmentManagementPage').then((module) => ({ default: module.EquipmentManagementPage })));
const IssuanceHistoryPage = lazy(() => import('./pages/IssuanceHistoryPage').then((module) => ({ default: module.IssuanceHistoryPage })));
const RepairHistoryPage = lazy(() => import('./pages/RepairHistoryPage').then((module) => ({ default: module.RepairHistoryPage })));
const EmployeeManagementPage = lazy(() => import('./pages/EmployeeManagementPage').then((module) => ({ default: module.EmployeeManagementPage })));

function NotFoundPage() {
  return <div className="not-found"><h1>ไม่พบหน้านี้</h1><p>กรุณาเลือกเมนูจากแถบด้านข้าง</p></div>;
}

function RouteFallback() {
  return <div className="route-loading"><Spin size="large" tip="กำลังโหลดหน้า" /></div>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/equipment-management" element={<EquipmentManagementPage />} />
                <Route path="/employees" element={<EmployeeManagementPage />} />
                <Route path="/issuance-history" element={<IssuanceHistoryPage />} />
                <Route path="/repair-history" element={<RepairHistoryPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
