import { message } from 'antd';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '../auth/AuthContext';
import { apiService } from '../services/api';
import { ProfilePage } from './ProfilePage';

const mockedNavigate = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockedNavigate };
});
vi.mock('../auth/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../services/api', () => ({
  apiService: {
    updateProfile: vi.fn(),
    changePassword: vi.fn(),
  },
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedApi = vi.mocked(apiService);
const user = { id: 1, username: 'staff', email: 'staff@test.local', role: 'staff' as const };
const clearUser = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(message, 'success').mockImplementation(() => ({ then: vi.fn() } as never));
  mockedUseAuth.mockReturnValue({
    user,
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
    updateUser: vi.fn(),
    clearUser,
    canWrite: true,
    isAdmin: false,
  });
  mockedApi.updateProfile.mockResolvedValue({ ...user, username: 'updated-staff' });
  mockedApi.changePassword.mockResolvedValue(undefined);
});

describe('ProfilePage', () => {
  it('updates the profile through the authenticated API', async () => {
    render(<MemoryRouter><ProfilePage /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('ชื่อผู้ใช้งาน'), { target: { value: 'updated-staff' } });
    fireEvent.click(screen.getByRole('button', { name: 'บันทึกข้อมูล' }));

    await waitFor(() => expect(mockedApi.updateProfile).toHaveBeenCalledWith({ username: 'updated-staff', email: 'staff@test.local' }));
  });

  it('clears the local session after changing the password', async () => {
    render(<MemoryRouter><ProfilePage /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('รหัสผ่านปัจจุบัน'), { target: { value: 'old-password' } });
    fireEvent.change(screen.getByLabelText('รหัสผ่านใหม่'), { target: { value: 'pass1234' } });
    fireEvent.change(screen.getByLabelText('ยืนยันรหัสผ่านใหม่'), { target: { value: 'pass1234' } });
    fireEvent.submit(screen.getByLabelText('รหัสผ่านปัจจุบัน').closest('form')!);

    await waitFor(() => expect(mockedApi.changePassword).toHaveBeenCalledWith({ currentPassword: 'old-password', newPassword: 'pass1234' }));
    await waitFor(() => expect(clearUser).toHaveBeenCalled());
    await waitFor(() => expect(mockedNavigate).toHaveBeenCalledWith('/login', { replace: true }));
  });
});
