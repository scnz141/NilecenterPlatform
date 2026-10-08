import type { NccRole } from "@/lib/backend/api";
import { copy } from "./copy";

/** Lower-privilege ordering shared with the EMS backend. */
export const ROLE_ORDER: NccRole[] = [
  "super_admin",
  "branch_admin",
  "vice_manager",
  "hod",
  "registrar",
  "ssa",
  "teacher",
];

export const ROLE_LABELS: Record<NccRole, string> = copy.roles;

export function roleLabel(role: NccRole): string {
  return ROLE_LABELS[role] ?? role;
}

export function isBranchOperator(role: NccRole | null | undefined): boolean {
  return role === "branch_admin" || role === "vice_manager";
}

export function isAdmissionsRole(role: NccRole | null | undefined): boolean {
  return (
    role === "super_admin" ||
    isBranchOperator(role) ||
    role === "registrar" ||
    role === "ssa"
  );
}

export function isClassCatalogWriter(
  role: NccRole | null | undefined
): boolean {
  return (
    role === "super_admin" || isBranchOperator(role) || role === "registrar"
  );
}

export function canSetAssignee(role: NccRole | null | undefined): boolean {
  return (
    role === "super_admin" || isBranchOperator(role) || role === "registrar"
  );
}

export function isStaffManager(role: NccRole | null | undefined): boolean {
  return role === "super_admin" || isBranchOperator(role);
}

/** Roles EMS allows to read the branch directory (HOD and teacher get 403). */
export function canReadBranches(role: NccRole | null | undefined): boolean {
  return isAdmissionsRole(role);
}

/** Roles EMS allows to read the department directory (everyone else gets 403). */
export function canReadDepartments(role: NccRole | null | undefined): boolean {
  return role === "super_admin";
}

/** Roles that must choose a workspace branch before operating. */
export function needsWorkspaceBranch(
  role: NccRole | null | undefined
): boolean {
  return isBranchOperator(role) || role === "registrar" || role === "ssa";
}

/** Roles that may switch into a strictly lower-privileged view. */
export function canSwitchRoles(
  assigned: NccRole | null | undefined
): boolean {
  return (
    assigned === "super_admin" ||
    assigned === "branch_admin" ||
    assigned === "vice_manager" ||
    assigned === "hod"
  );
}

/** SSA may mutate only records assigned to the signed-in staff user. */
export function canMutateAssignedRecord(
  role: NccRole | null | undefined,
  actorId: string | null | undefined,
  assignedStaffId: string | null | undefined
): boolean {
  if (role !== "ssa") return true;
  return Boolean(actorId && assignedStaffId && actorId === assignedStaffId);
}
