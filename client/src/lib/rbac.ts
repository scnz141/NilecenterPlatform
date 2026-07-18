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

export function hasRole(
  user: Pick<DemoUser, "roles"> | null | undefined,
  role: Role
): boolean {
  return Boolean(user?.roles.includes(role));
}

export function hasPermission(
  user: Pick<DemoUser, "roles"> | null | undefined,
  permission: Permission
): boolean {
  if (!user) return false;
  return user.roles.some(role => rolePermissions[role].includes(permission));
}

export function requireRole(
  user: DemoUser | null | undefined,
  role: Role
): DemoUser {
  if (!user || !hasRole(user, role)) {
    throw new Error(`Access denied: ${role} role required`);
  }
  return user;
}

export function requirePermission(
  user: DemoUser | null | undefined,
  permission: Permission
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
  return sidebarByRole[role].filter(item => {
    const pageId = getPageIdFromPath(role, item.href);
    const permission = pageId
      ? getRequiredPermissionForPage(role, pageId)
      : "dashboard:read";
    return roleHasPermission(role, permission);
  });
}

export function getUserForRole(role: Role): DemoUser {
  return demoUsers.find(user => user.activeRole === role) ?? demoUsers[0];
}

export function canOpenRoute(role: Role, pathname: string): boolean {
  const defaultRoute = roleMeta[role].defaultRoute;
  const roleRoot = defaultRoute.replace(/\/dashboard$/, "");
  return pathname === defaultRoute || pathname.startsWith(`${roleRoot}/`);
}

export function roleHasPermission(role: Role, permission: Permission): boolean {
  return rolePermissions[role].includes(permission);
}

export function getRequiredPermissionForPage(
  role: Role,
  pageId: string
): Permission {
  if (pageId === "dashboard") return "dashboard:read";
  if (pageId === "reports") return "reports:read";
  if (pageId === "messages" || pageId === "support") return "messages:write";
  if (pageId === "forms") return "forms:read";
  if (pageId === "requests" || pageId === "request-detail") return "forms:read";
  if (pageId === "request-create") return "form_submissions:read";
  if (pageId === "forms-manage" || pageId === "form-builder")
    return "forms:write";
  if (pageId === "form-publish") return "forms:publish";
  if (pageId === "form-assignments") return "forms:assign";
  if (pageId === "forms-review" || pageId === "form-submission")
    return "form_submissions:read";
  if (pageId === "profile") return "dashboard:read";
  if (
    pageId === "settings" ||
    pageId === "integrations" ||
    pageId === "system-health"
  )
    return "settings:write";
  if (pageId === "audit-logs" || pageId === "platform-blueprint")
    return "audit:read";
  if (pageId === "payments") return "payments:read";
  if (pageId === "attendance") return "attendance:read";
  if (pageId === "certificates")
    return role === "headofdepartment"
      ? "certificates:approve"
      : "certificates:read";
  if (
    pageId === "assignments" ||
    pageId === "assignment-detail" ||
    pageId === "quizzes" ||
    pageId === "quiz-detail" ||
    pageId === "question-bank" ||
    pageId === "grading" ||
    pageId === "assessments" ||
    pageId === "quran-review"
  ) {
    return "assessments:read";
  }
  if (
    pageId === "schedule" ||
    pageId === "calendar" ||
    pageId === "sessions" ||
    pageId === "live"
  )
    return "schedule:read";
  if (pageId === "rooms") return "rooms:read";
  if (pageId === "teachers") return "teachers:read";
  if (
    pageId === "users" ||
    pageId === "user-detail" ||
    pageId === "roles" ||
    pageId === "permissions"
  )
    return "settings:write";
  if (pageId === "students" || pageId === "student-detail")
    return "students:read";
  if (
    pageId === "classes" ||
    pageId === "class-detail" ||
    pageId === "materials"
  )
    return "classes:read";
  if (
    pageId === "leads" ||
    pageId === "lead-detail" ||
    pageId === "applications" ||
    pageId === "placement-tests" ||
    pageId === "placement-detail" ||
    pageId === "enrollments"
  )
    return "students:read";
  if (
    pageId === "branches" ||
    pageId === "departments" ||
    pageId === "programs" ||
    pageId === "courses" ||
    pageId === "course-detail" ||
    pageId === "lesson" ||
    pageId === "moodle-source" ||
    pageId === "levels" ||
    pageId === "curriculum" ||
    pageId === "quran-progress"
  )
    return "courses:read";
  return "dashboard:read";
}

export function canOpenPage(role: Role, pageId: string): boolean {
  return roleHasPermission(role, getRequiredPermissionForPage(role, pageId));
}

function getPageIdFromPath(role: Role, href: string): string | null {
  const root = roleMeta[role].defaultRoute.replace(/\/dashboard$/, "");
  if (href === roleMeta[role].defaultRoute) return "dashboard";
  if (!href.startsWith(`${root}/`)) return null;
  return href.slice(root.length + 1).split("/")[0] || null;
}
