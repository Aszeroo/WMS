import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { pageLoaders } from './routes/lazyPages';

const LoginPage = lazy(pageLoaders.login);
const AppLayout = lazy(pageLoaders.layout);
const DashboardPage = lazy(pageLoaders.dashboard);
const EquipmentManagementPage = lazy(pageLoaders.equipment);
const IssuanceHistoryPage = lazy(pageLoaders.issuance);
const RepairHistoryPage = lazy(pageLoaders.repair);
const EmployeeManagementPage = lazy(pageLoaders.employees);

function NotFoundPage() {
  return <div className="not-found"><h1>ไม่พบหน้านี้</h1><p>กรุณาเลือกเมนูจากแถบด้านข้าง</p></div>;
}

function RouteFallback() {
  return <div className="route-loading">กำลังโหลดหน้า</div>;
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
