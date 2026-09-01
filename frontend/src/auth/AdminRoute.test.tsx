import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { AdminRoute } from './AdminRoute';

vi.mock('./AuthContext', () => ({ useAuth: vi.fn() }));

const mockedUseAuth = vi.mocked(useAuth);
const authValue = {
  user: { id: 1, username: 'staff', email: 'staff@test.local', role: 'staff' as const },
  loading: false,
  login: vi.fn(),
  logout: vi.fn(),
  updateUser: vi.fn(),
  clearUser: vi.fn(),
  canWrite: true,
  isAdmin: false,
};

const renderRoutes = () => render(
  <MemoryRouter initialEntries={['/users']}>
    <Routes>
      <Route element={<AdminRoute />}>
        <Route path="/users" element={<div>จัดการผู้ใช้งาน</div>} />
      </Route>
      <Route path="/dashboard" element={<div>แดชบอร์ด</div>} />
    </Routes>
  </MemoryRouter>,
);

describe('AdminRoute', () => {
  beforeEach(() => vi.clearAllMocks());

  it('redirects non-admin users to the dashboard', () => {
    mockedUseAuth.mockReturnValue(authValue);
    renderRoutes();
    expect(screen.getByText('แดชบอร์ด')).toBeInTheDocument();
  });

  it('renders the child route for administrators', () => {
    mockedUseAuth.mockReturnValue({ ...authValue, user: { ...authValue.user, role: 'admin' }, isAdmin: true });
    renderRoutes();
    expect(screen.getByText('จัดการผู้ใช้งาน')).toBeInTheDocument();
  });
});
