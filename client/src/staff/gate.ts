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
  // Role-view sessions keep workspaceBranchId null and carry the branch in
  // effectiveScopes instead (e.g. branch_admin scopes are multi-branch).
  const hasBranchScope = Boolean(
    ncc.workspaceBranchId ||
      ncc.effectiveScopes?.branchId ||
      ncc.effectiveScopes?.branchIds?.length
  );
  if (needsWorkspaceBranch(ncc.activeRole) && !hasBranchScope) {
    return "workspace";
  }
  if (!canAccess(path, ncc.activeRole)) return "denied";
  return "ok";
}

/** Sign-in URL that returns the user to the guarded location after login. */
export function staffLoginRedirect(path: string, search: string): string {
  const here = search ? `${path}?${search}` : path;
  return `/auth/administration-login?next=${encodeURIComponent(here)}`;
}

/** Safe post-login target: only in-app absolute paths are honored. */
export function staffNextTarget(raw: string | null): string | null {
  if (!raw || raw.startsWith("//") || !/^\/app([/?#]|$)/.test(raw)) {
    return null;
  }
  return raw;
}
