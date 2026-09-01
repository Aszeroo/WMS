import axios from 'axios';
import { getCached, invalidateCache } from './cache';
import type {
  DashboardStats,
  Employee,
  EquipmentInstance,
  EquipmentType,
  Issuance,
  PageResult,
  Repair,
  RepairCreateInput,
  RepairHistoryQuery,
  RepairUpdateInput,
  User,
} from '../types';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
  withCredentials: true,
});

export const apiService = {
  login: (payload: { identifier: string; password: string }) =>
    api.post<{ user: User }>('/auth/login', payload).then((response) => response.data),
  logout: () => api.post('/auth/logout').then((response) => response.data),
  me: () => api.get<{ user: User }>('/auth/me').then((response) => response.data.user),

  getStats: () => api.get<DashboardStats>('/dashboard/stats').then((response) => response.data),

  getTypes: () => getCached('equipment-types', () =>
    api.get<EquipmentType[]>('/equipment-types').then((response) => response.data),
  ),
  createType: (payload: { name: string; unit: string; description?: string }) =>
    api.post<EquipmentType>('/equipment-types', payload).then((response) => {
      invalidateCache('equipment-types');
      return response.data;
    }),
  updateType: (id: number, payload: Partial<{ name: string; unit: string; description: string }>) =>
    api.put<EquipmentType>(`/equipment-types/${id}`, payload).then((response) => {
      invalidateCache('equipment-types');
      return response.data;
    }),
  deleteType: (id: number) => api.delete(`/equipment-types/${id}`).then((response) => {
    invalidateCache('equipment-types');
    return response;
  }),

  getInstances: (params?: { page?: number; pageSize?: number; search?: string; status?: string; typeId?: number }) =>
    api.get<PageResult<EquipmentInstance>>('/equipment-instances', { params }).then((response) => response.data),
  createInstances: (payload: {
    typeId: number;
    serialNumbers: string[];
    brand?: string;
    model?: string;
    purchaseDate?: string;
  }) => api.post<EquipmentInstance | EquipmentInstance[]>('/equipment-instances', payload).then((response) => response.data),
  updateInstance: (id: number, payload: Partial<EquipmentInstance>) =>
    api.put<EquipmentInstance>(`/equipment-instances/${id}`, payload).then((response) => response.data),
  deleteInstance: (id: number) => api.delete(`/equipment-instances/${id}`),

  getEmployees: () => getCached('employees', () =>
    api.get<Employee[]>('/employees').then((response) => response.data),
  ),
  createEmployee: (payload: { employeeId: string; name: string; department?: string; position?: string }) =>
    api.post<Employee>('/employees', payload).then((response) => {
      invalidateCache('employees');
      return response.data;
    }),
  updateEmployee: (id: number, payload: Partial<{ employeeId: string; name: string; department: string; position: string }>) =>
    api.put<Employee>(`/employees/${id}`, payload).then((response) => {
      invalidateCache('employees');
      return response.data;
    }),
  deleteEmployee: (id: number) => api.delete(`/employees/${id}`).then((response) => {
    invalidateCache('employees');
    return response;
  }),

  getIssuances: (params?: Record<string, string | number | boolean | undefined>) =>
    api.get<PageResult<Issuance>>('/issuance-history', { params }).then((response) => response.data),
  createIssuance: (payload: Record<string, unknown>) =>
    api.post<Issuance>('/issuance-history', payload).then((response) => response.data),
  updateIssuance: (id: number, payload: Record<string, unknown>) =>
    api.put<Issuance>(`/issuance-history/${id}`, payload).then((response) => response.data),
  deleteIssuance: (id: number) => api.delete(`/issuance-history/${id}`),

  getRepairs: (params?: RepairHistoryQuery) =>
    api.get<PageResult<Repair>>('/repair-history', { params }).then((response) => response.data),
  createRepair: (payload: RepairCreateInput) =>
    api.post<Repair>('/repair-history', payload).then((response) => response.data),
  updateRepair: (id: number, payload: RepairUpdateInput) =>
    api.put<Repair>(`/repair-history/${id}`, payload).then((response) => response.data),
  deleteRepair: (id: number) => api.delete(`/repair-history/${id}`),
};

export default api;
