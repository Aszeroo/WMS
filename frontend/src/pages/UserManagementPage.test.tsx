import { message } from 'antd';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '../auth/AuthContext';
import { apiService } from '../services/api';
import { UserManagementPage } from './UserManagementPage';

vi.mock('../auth/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../services/api', () => ({
  apiService: {
    getUsers: vi.fn(),
    createUser: vi.fn(),
    updateUser: vi.fn(),
    deleteUser: vi.fn(),
  },
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedApi = vi.mocked(apiService);
const admin = { id: 1, username: 'admin', email: 'admin@test.local', role: 'admin' as const };
const existingUser = { id: 2, username: 'viewer', email: 'viewer@test.local', role: 'viewer' as const };

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(message, 'success').mockImplementation(() => ({ then: vi.fn() } as never));
  mockedUseAuth.mockReturnValue({
    user: admin,
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
    updateUser: vi.fn(),
    clearUser: vi.fn(),
    canWrite: true,
    isAdmin: true,
  });
  mockedApi.getUsers.mockResolvedValue([existingUser]);
  mockedApi.createUser.mockResolvedValue({ id: 3, username: 'new-staff', email: 'new-staff@test.local', role: 'staff' });
});

describe('UserManagementPage', () => {
  it('loads users and creates an account without exposing secrets', async () => {
    render(<MemoryRouter><UserManagementPage /></MemoryRouter>);

    expect(await screen.findByText('viewer')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '+ เพิ่มผู้ใช้งาน' }));
    fireEvent.change(screen.getByLabelText('ชื่อผู้ใช้งาน'), { target: { value: 'new-staff' } });
    fireEvent.change(screen.getByLabelText('อีเมล'), { target: { value: 'new-staff@test.local' } });
    fireEvent.change(screen.getByLabelText('รหัสผ่าน'), { target: { value: 'pass1234' } });
    fireEvent.submit(screen.getByLabelText('ชื่อผู้ใช้งาน').closest('form')!);

    await waitFor(() => expect(mockedApi.createUser).toHaveBeenCalledWith({
      username: 'new-staff',
      email: 'new-staff@test.local',
      password: 'pass1234',
      role: 'viewer',
    }));
    expect(mockedApi.createUser.mock.calls[0][0]).not.toHaveProperty('passwordHash');
  });
});
