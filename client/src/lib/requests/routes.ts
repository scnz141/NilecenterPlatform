import type { Role } from "@/lib/platformData";

export function requestsRoute(_role: Role, suffix = "") {
  return `/app/student/requests${suffix}`;
}

export function requestCommandKey(operation: string) {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `request-${operation}-${id}`;
}
