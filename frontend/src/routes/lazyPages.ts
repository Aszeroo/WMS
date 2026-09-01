export const pageLoaders = {
  login: () => import('../pages/LoginPage').then((module) => ({ default: module.LoginPage })),
  layout: () => import('../components/AppLayout').then((module) => ({ default: module.AppLayout })),
  dashboard: () => import('../pages/DashboardPage').then((module) => ({ default: module.DashboardPage })),
  equipment: () => import('../pages/EquipmentManagementPage').then((module) => ({ default: module.EquipmentManagementPage })),
  issuance: () => import('../pages/IssuanceHistoryPage').then((module) => ({ default: module.IssuanceHistoryPage })),
  repair: () => import('../pages/RepairHistoryPage').then((module) => ({ default: module.RepairHistoryPage })),
  employees: () => import('../pages/EmployeeManagementPage').then((module) => ({ default: module.EmployeeManagementPage })),
  profile: () => import('../pages/ProfilePage').then((module) => ({ default: module.ProfilePage })),
  userManagement: () => import('../pages/UserManagementPage').then((module) => ({ default: module.UserManagementPage })),
};

const routeLoaders: Record<string, () => Promise<unknown>> = {
  '/dashboard': pageLoaders.dashboard,
  '/equipment-management': pageLoaders.equipment,
  '/employees': pageLoaders.employees,
  '/issuance-history': pageLoaders.issuance,
  '/repair-history': pageLoaders.repair,
  '/profile': pageLoaders.profile,
  '/user-management': pageLoaders.userManagement,
  '/users': pageLoaders.userManagement,
};

export const preloadRoute = (path: string): void => {
  void routeLoaders[path]?.();
};

let authenticatedShellPreload: Promise<unknown[]> | undefined;

export const preloadAuthenticatedShell = (): void => {
  authenticatedShellPreload ??= Promise.all([pageLoaders.layout(), pageLoaders.dashboard()]).catch((error: unknown) => {
    authenticatedShellPreload = undefined;
    throw error;
  });
  void authenticatedShellPreload.catch(() => undefined);
};
