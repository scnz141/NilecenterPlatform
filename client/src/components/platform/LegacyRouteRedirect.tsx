import { useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { getStoredRole } from "@/lib/auth/session";
import { roleMeta, type Role } from "@/lib/platformData";

const exactLegacyTargets: Record<string, string> = {
  "/student": "/app/student/dashboard",
  "/student/courses": "/app/student/courses",
  "/student/grades": "/app/student/grades",
  "/student/attendance": "/app/student/attendance",
  "/student/schedule": "/app/student/calendar",
  "/teacher": "/app/teacher/dashboard",
  "/teacher/classes": "/app/teacher/classes",
  "/teacher/attendance": "/app/teacher/classes/class_ar_l3_a/attendance",
  "/teacher/scores": "/app/teacher/grading",
  "/teacher/schedule": "/app/teacher/calendar",
  "/registrar": "/app/registrar/dashboard",
  "/registrar/register": "/app/registrar/students",
  "/registrar/pending": "/app/registrar/enrollments",
  "/registrar/payments": "/app/registrar/payments",
};

const roleAwareTargets: Record<string, Partial<Record<Role, string>>> = {
  "/dashboard": {
    student: "/app/student/dashboard",
    teacher: "/app/teacher/dashboard",
    registrar: "/app/registrar/dashboard",
    headofdepartment: "/app/hod/dashboard",
    branchadmin: "/app/branch/dashboard",
    superadmin: "/app/admin/dashboard",
  },
  "/students": {
    registrar: "/app/registrar/students",
    branchadmin: "/app/branch/students",
    superadmin: "/app/admin/users",
  },
  "/classes": {
    teacher: "/app/teacher/classes",
    registrar: "/app/registrar/classes",
    headofdepartment: "/app/hod/classes",
    branchadmin: "/app/branch/classes",
  },
  "/users": {
    superadmin: "/app/admin/users",
  },
  "/messages": {
    student: "/app/student/messages",
    teacher: "/app/teacher/messages",
    registrar: "/app/registrar/messages",
    headofdepartment: "/app/hod/messages",
    branchadmin: "/app/branch/messages",
  },
  "/payments": {
    registrar: "/app/registrar/payments",
    branchadmin: "/app/branch/payments",
  },
  "/reports": {
    student: "/app/student/reports",
    teacher: "/app/teacher/reports",
    registrar: "/app/registrar/reports",
    headofdepartment: "/app/hod/reports",
    branchadmin: "/app/branch/reports",
    superadmin: "/app/admin/reports",
  },
  "/schedule": {
    student: "/app/student/calendar",
    teacher: "/app/teacher/calendar",
    registrar: "/app/registrar/schedule",
    branchadmin: "/app/branch/schedule",
  },
  "/profile": {
    student: "/app/student/settings",
    teacher: "/app/teacher/settings",
    registrar: "/app/registrar/settings/profile",
    headofdepartment: "/app/hod/settings/profile",
    branchadmin: "/app/branch/settings/profile",
    superadmin: "/app/admin/settings/profile",
  },
  "/notifications": {
    student: "/app/student/messages",
    teacher: "/app/teacher/messages",
    registrar: "/app/registrar/messages",
    headofdepartment: "/app/hod/messages",
    branchadmin: "/app/branch/messages",
  },
  "/settings": {
    registrar: "/app/registrar/settings",
    branchadmin: "/app/branch/settings",
    superadmin: "/app/admin/settings",
  },
};

function resolveLegacyTarget(legacyPath: string) {
  const explicitTarget = exactLegacyTargets[legacyPath];
  if (explicitTarget) return explicitTarget;

  const activeRole = getStoredRole();
  if (!activeRole) return "/auth/select-role";

  return (
    roleAwareTargets[legacyPath]?.[activeRole] ??
    roleMeta[activeRole].defaultRoute
  );
}

export default function LegacyRouteRedirect({
  legacyPath,
}: {
  legacyPath: string;
}) {
  const [, navigate] = useLocation();
  const target = useMemo(() => resolveLegacyTarget(legacyPath), [legacyPath]);

  useEffect(() => {
    navigate(target, { replace: true });
  }, [navigate, target]);

  return (
    <main className="platform-route-loading" aria-live="polite">
      <span />
      <strong>Opening current workspace</strong>
    </main>
  );
}
