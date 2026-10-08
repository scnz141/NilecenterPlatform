import type { AuthSessionDto } from "@/lib/backend/api";
import { canAccess } from "./nav";
import { needsWorkspaceBranch } from "./roles";

export type StaffGateDecision =
  | "loading"
  | "login"
  | "workspace"
  | "denied"
  | "ok";

/** Pure StaffRoute guard decision so it can be tested without a DOM. */
export function staffGateDecision(
  session: AuthSessionDto | null,
  loading: boolean,
  path: string
): StaffGateDecision {
  if (loading) return "loading";
  const ncc = session?.ncc;
  if (!session || session.provider !== "ncc" || !ncc) return "login";
  if (needsWorkspaceBranch(ncc.activeRole) && !ncc.workspaceBranchId) {
    return "workspace";
  }
  if (!canAccess(path, ncc.activeRole)) return "denied";
  return "ok";
}
