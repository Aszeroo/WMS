import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { ProtectedRoute } from './ProtectedRoute';

vi.mock('./AuthContext', () => ({ useAuth: vi.fn() }));

const mockedUseAuth = vi.mocked(useAuth);

const renderRoutes = () => render(
  <MemoryRouter initialEntries={['/private']}>
    <Routes>
      <Route element={<ProtectedRoute />}>
        <Route path="/private" element={<div>ข้อมูลที่ป้องกันไว้</div>} />
      </Route>
      <Route path="/login" element={<div>หน้าเข้าสู่ระบบ</div>} />
    </Routes>
  </MemoryRouter>,
);

describe('ProtectedRoute', () => {
  beforeEach(() => vi.clearAllMocks());

  it('redirects users who are not signed in', () => {
    mockedUseAuth.mockReturnValue({ user: null, loading: false, login: vi.fn(), logout: vi.fn(), canWrite: false, isAdmin: false });
    renderRoutes();
    expect(screen.getByText('หน้าเข้าสู่ระบบ')).toBeInTheDocument();
  });

  it('renders the protected page after authentication', () => {
    mockedUseAuth.mockReturnValue({ user: { id: 1, username: 'staff', email: 'staff@test.local', role: 'staff' }, loading: false, login: vi.fn(), logout: vi.fn(), canWrite: true, isAdmin: false });
    renderRoutes();
    expect(screen.getByText('ข้อมูลที่ป้องกันไว้')).toBeInTheDocument();
  });
});
