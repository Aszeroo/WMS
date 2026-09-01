export type UserRole = 'admin' | 'staff' | 'viewer';

export interface User {
  id: number;
  username: string;
  email: string;
  role: UserRole;
}

export interface ProfileUpdateInput {
  username?: string;
  email?: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface UserCreateInput {
  username: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface UserUpdateInput {
  username?: string;
  email?: string;
  password?: string;
  role?: UserRole;
}

export type EquipmentStatus = 'available' | 'issued' | 'under_repair' | string;
export type RepairStatus = 'reported' | 'in_progress' | 'completed' | 'rejected' | string;

export interface EquipmentType {
  id: number;
  name: string;
  unit: string;
  description?: string | null;
  _count?: { instances: number };
}

export interface EquipmentInstance {
  id: number;
  serialNumber: string;
  brand?: string | null;
  model?: string | null;
  purchaseDate?: string | null;
  status: EquipmentStatus;
  typeId: number;
  type?: Pick<EquipmentType, 'id' | 'name' | 'unit'>;
}

export interface Employee {
  id: number;
  employeeId: string;
  name: string;
  department?: string | null;
  position?: string | null;
}

export interface Issuance {
  id: number;
  equipmentId: number;
  employeeId: number;
  issueDate: string;
  returnDate?: string | null;
  building?: string | null;
  floor?: string | null;
  jobNumber?: string | null;
  notes?: string | null;
  equipment: EquipmentInstance;
  employee: Employee;
}

export interface Repair {
  id: number;
  equipmentId: number;
  employeeId?: number | null;
  repairDate: string;
  symptoms: string;
  status: RepairStatus;
  repairedBy?: string | null;
  notes?: string | null;
  equipment: EquipmentInstance;
  employee?: Employee | null;
}

export interface RepairHistoryQuery {
  startDate?: string;
  endDate?: string;
  status?: RepairStatus;
  equipmentId?: number;
  employeeId?: number;
  page?: number;
  pageSize?: number;
}

export interface RepairCreateInput {
  equipmentId: number;
  employeeId?: number | null;
  repairDate?: string;
  symptoms: string;
  status?: RepairStatus;
  repairedBy?: string | null;
  notes?: string | null;
}

export interface RepairUpdateInput {
  employeeId?: number | null;
  repairDate?: string;
  symptoms?: string;
  status?: RepairStatus;
  repairedBy?: string | null;
  notes?: string | null;
}

export interface PageResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface DashboardStats {
  total: number;
  available: number;
  issued: number;
  underRepair: number;
}
