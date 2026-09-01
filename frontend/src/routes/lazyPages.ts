export const pageLoaders = {
  login: () => import('../pages/LoginPage').then((module) => ({ default: module.LoginPage })),
  layout: () => import('../components/AppLayout').then((module) => ({ default: module.AppLayout })),
  dashboard: () => import('../pages/DashboardPage').then((module) => ({ default: module.DashboardPage })),
  equipment: () => import('../pages/EquipmentManagementPage').then((module) => ({ default: module.EquipmentManagementPage })),
  issuance: () => import('../pages/IssuanceHistoryPage').then((module) => ({ default: module.IssuanceHistoryPage })),
  repair: () => import('../pages/RepairHistoryPage').then((module) => ({ default: module.RepairHistoryPage })),
  employees: () => import('../pages/EmployeeManagementPage').then((module) => ({ default: module.EmployeeManagementPage })),
};

const routeLoaders: Record<string, () => Promise<unknown>> = {
  '/dashboard': pageLoaders.dashboard,
  '/equipment-management': pageLoaders.equipment,
  '/employees': pageLoaders.employees,
  '/issuance-history': pageLoaders.issuance,
  '/repair-history': pageLoaders.repair,
};

export const preloadRoute = (path: string): void => {
  void routeLoaders[path]?.();
};
