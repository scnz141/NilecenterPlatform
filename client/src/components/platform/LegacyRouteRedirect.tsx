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
  "/teacher": "/app/dashboard",
  "/teacher/classes": "/app/classes",
  "/teacher/attendance": "/app/classes",
  "/teacher/scores": "/app/classes",
  "/teacher/schedule": "/app/sessions",
  "/registrar": "/app/dashboard",
  "/registrar/register": "/app/students",
  "/registrar/pending": "/app/enrolments",
  "/registrar/payments": "/app/enrolments",
};

const roleAwareTargets: Record<string, Partial<Record<Role, string>>> = {
  "/dashboard": {
    student: "/app/student/dashboard",
    teacher: "/app/dashboard",
    registrar: "/app/dashboard",
    headofdepartment: "/app/dashboard",
    branchadmin: "/app/dashboard",
    superadmin: "/app/dashboard",
  },
  "/students": {
    registrar: "/app/students",
    branchadmin: "/app/students",
    superadmin: "/app/staff",
  },
  "/classes": {
    teacher: "/app/classes",
    registrar: "/app/classes",
    headofdepartment: "/app/classes",
    branchadmin: "/app/classes",
  },
  "/users": {
    superadmin: "/app/staff",
  },
  "/messages": {
    student: "/app/student/messages",
    teacher: "/app/notifications",
    registrar: "/app/notifications",
    headofdepartment: "/app/notifications",
    branchadmin: "/app/notifications",
  },
  "/payments": {
    registrar: "/app/enrolments",
    branchadmin: "/app/enrolments",
  },
  "/reports": {
    student: "/app/student/reports",
    teacher: "/app/dashboard",
    registrar: "/app/dashboard",
    headofdepartment: "/app/dashboard",
    branchadmin: "/app/dashboard",
    superadmin: "/app/dashboard",
  },
  "/schedule": {
    student: "/app/student/calendar",
    teacher: "/app/sessions",
    registrar: "/app/classes",
    branchadmin: "/app/classes",
  },
  "/profile": {
    student: "/app/student/settings",
    teacher: "/app/profile",
    registrar: "/app/profile",
    headofdepartment: "/app/profile",
    branchadmin: "/app/profile",
    superadmin: "/app/profile",
  },
  "/notifications": {
    student: "/app/student/messages",
    teacher: "/app/notifications",
    registrar: "/app/notifications",
    headofdepartment: "/app/notifications",
    branchadmin: "/app/notifications",
  },
  "/settings": {
    registrar: "/app/dashboard",
    branchadmin: "/app/dashboard",
    superadmin: "/app/dashboard",
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
