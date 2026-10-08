import type { Role } from "@/lib/platformData";

export function roleAppPrefix(_role: Role) {
  return "/app/student";
}

export function formsRoute(role: Role, suffix = "") {
  return `${roleAppPrefix(role)}/forms${suffix}`;
}
