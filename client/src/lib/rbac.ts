import {
  demoUsers,
  roleMeta,
  rolePermissions,
  sidebarByRole,
  type DemoUser,
  type NavItem,
  type Permission,
  type Role,
} from "./platformData";

export function hasRole(user: Pick<DemoUser, "roles"> | null | undefined, role: Role): boolean {
  return Boolean(user?.roles.includes(role));
}

export function hasPermission(
  user: Pick<DemoUser, "roles"> | null | undefined,
  permission: Permission,
): boolean {
  if (!user) return false;
  return user.roles.some((role) => rolePermissions[role].includes(permission));
}

export function requireRole(user: DemoUser | null | undefined, role: Role): DemoUser {
  if (!user || !hasRole(user, role)) {
    throw new Error(`Access denied: ${role} role required`);
  }
  return user;
}

export function requirePermission(
  user: DemoUser | null | undefined,
  permission: Permission,
): DemoUser {
  if (!user || !hasPermission(user, permission)) {
    throw new Error(`Access denied: ${permission} permission required`);
  }
  return user;
}

export function getDefaultRouteForRole(role: Role): string {
  return roleMeta[role].defaultRoute;
}

export function getSidebarForRole(role: Role): NavItem[] {
  return sidebarByRole[role];
}

export function getUserForRole(role: Role): DemoUser {
  return demoUsers.find((user) => user.activeRole === role) ?? demoUsers[0];
}

export function canOpenRoute(role: Role, pathname: string): boolean {
  const defaultRoute = roleMeta[role].defaultRoute;
  const roleRoot = defaultRoute.replace(/\/dashboard$/, "");
  return pathname === defaultRoute || pathname.startsWith(`${roleRoot}/`);
}
