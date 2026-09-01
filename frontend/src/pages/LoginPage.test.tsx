import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '../auth/AuthContext';
import { preloadAuthenticatedShell } from '../routes/lazyPages';
import { LoginPage } from './LoginPage';

const mockedNavigate = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockedNavigate };
});
vi.mock('../auth/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../routes/lazyPages', () => ({ preloadAuthenticatedShell: vi.fn() }));

const mockedUseAuth = vi.mocked(useAuth);
const mockedPreload = vi.mocked(preloadAuthenticatedShell);
const login = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  login.mockResolvedValue({ id: 1, username: 'staff', email: 'staff@test.local', role: 'staff' });
  mockedUseAuth.mockReturnValue({
    user: null,
    loading: false,
    login,
    logout: vi.fn(),
    updateUser: vi.fn(),
    clearUser: vi.fn(),
    canWrite: false,
    isAdmin: false,
  });
});

describe('LoginPage', () => {
  it('preloads the authenticated shell while navigating after login', async () => {
    render(<MemoryRouter><LoginPage /></MemoryRouter>);

    fireEvent.change(screen.getByLabelText('ชื่อผู้ใช้หรืออีเมล'), { target: { value: 'staff' } });
    fireEvent.change(screen.getByLabelText('รหัสผ่าน'), { target: { value: 'password-123456' } });
    fireEvent.submit(screen.getByLabelText('ชื่อผู้ใช้หรืออีเมล').closest('form')!);

    await waitFor(() => expect(login).toHaveBeenCalledWith('staff', 'password-123456'));
    expect(mockedPreload).toHaveBeenCalledTimes(1);
    expect(mockedNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 500));
    });
  });
});
