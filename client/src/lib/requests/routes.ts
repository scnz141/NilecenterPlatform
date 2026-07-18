import type { Role } from "@/lib/platformData";

const prefixByRole: Record<Role, string> = {
  student: "/app/student",
  teacher: "/app/teacher",
  registrar: "/app/registrar",
  headofdepartment: "/app/hod",
  branchadmin: "/app/branch",
  superadmin: "/app/admin",
};

export function requestsRoute(role: Role, suffix = "") {
  return `${prefixByRole[role]}/requests${suffix}`;
}

export function requestCommandKey(operation: string) {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `request-${operation}-${id}`;
}
