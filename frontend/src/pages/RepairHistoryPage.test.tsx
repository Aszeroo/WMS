import { message } from 'antd';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '../auth/AuthContext';
import { apiService } from '../services/api';
import { RepairHistoryPage } from './RepairHistoryPage';

vi.mock('../auth/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../services/api', () => ({
  apiService: {
    getEmployees: vi.fn(),
    getInstances: vi.fn(),
    getRepairs: vi.fn(),
    updateRepair: vi.fn(),
    createRepair: vi.fn(),
    deleteRepair: vi.fn(),
  },
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedApi = vi.mocked(apiService);
const repair = {
  id: 1,
  equipmentId: 11,
  repairDate: '2026-08-31T00:00:00.000Z',
  symptoms: 'จอไม่ติด',
  status: 'reported',
  equipment: {
    id: 11,
    serialNumber: 'SN-LOCKED-001',
    status: 'under_repair',
    typeId: 2,
    type: { id: 2, name: 'Notebook', unit: 'เครื่อง' },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(message, 'success').mockImplementation(() => ({ then: vi.fn() } as never));
  mockedUseAuth.mockReturnValue({
    user: { id: 1, username: 'staff', email: 'staff@test.local', role: 'staff' },
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
    canWrite: true,
    isAdmin: false,
  });
  mockedApi.getEmployees.mockResolvedValue([]);
  mockedApi.getInstances.mockResolvedValue({ data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 });
  mockedApi.getRepairs.mockResolvedValue({ data: [repair], total: 1, page: 1, pageSize: 10, totalPages: 1 });
  mockedApi.updateRepair.mockResolvedValue(repair);
});

describe('RepairHistoryPage', () => {
  it('locks the equipment and excludes equipmentId from an update', async () => {
    render(<RepairHistoryPage />);

    await screen.findByText('SN-LOCKED-001');
    fireEvent.click(screen.getByRole('button', { name: 'แก้ไข' }));

    const equipment = await screen.findByDisplayValue('SN-LOCKED-001 — Notebook');
    expect(equipment).toBeDisabled();
    expect(screen.getByText(/ไม่สามารถเปลี่ยนอุปกรณ์ของประวัติการซ่อมได้/)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('อธิบายอาการที่พบ'), { target: { value: 'เปลี่ยนหน้าจอแล้ว' } });
    fireEvent.click(screen.getByRole('button', { name: 'บันทึก' }));

    await waitFor(() => expect(mockedApi.updateRepair).toHaveBeenCalled());
    const [, payload] = mockedApi.updateRepair.mock.calls[0];
    expect(payload).not.toHaveProperty('equipmentId');
    expect(payload).toMatchObject({ symptoms: 'เปลี่ยนหน้าจอแล้ว' });
  });
});
