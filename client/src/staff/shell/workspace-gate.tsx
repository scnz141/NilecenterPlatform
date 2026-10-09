import { useEffect, useState } from "react";
import {
  fetchAuthWorkspacesRequest,
  type AuthWorkspaceDto,
} from "@/lib/backend/api";
import { NileRosette } from "@/components/brand/NileLogo";
import { copy } from "../copy";
import { useStaffSession } from "../session";
import { ErrorState, LoadingCenter } from "../ui/primitives";

/** Full-screen branch picker for roles that must run inside one workspace. */
export function WorkspaceGate() {
  const { session, setScopes, switchWorkspace, signOut } = useStaffSession();
  const [items, setItems] = useState<AuthWorkspaceDto[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [chooseError, setChooseError] = useState<string | null>(null);
  const [switching, setSwitching] = useState<string | null>(null);
  // Role-view sessions (activeRole ≠ assignedRole) cannot call
  // switch-workspace; the branch scope goes through session-scopes instead.
  const viewingAsRole = Boolean(
    session?.ncc && session.ncc.activeRole !== session.ncc.assignedRole
  );

  useEffect(() => {
    let cancelled = false;
    fetchAuthWorkspacesRequest().then(result => {
      if (cancelled) return;
      if (result.ok && result.data) setItems(result.data.items);
      else setError(result.error ?? copy.state.errorGeneric);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function choose(branchId: string) {
    setSwitching(branchId);
    setChooseError(null);
    try {
      if (viewingAsRole) {
        await setScopes(
          session?.ncc?.activeRole === "branch_admin"
            ? { branchIds: [branchId] }
            : { branchId }
        );
      } else {
        await switchWorkspace(branchId);
      }
    } catch (cause) {
      setChooseError(
        cause instanceof Error && cause.message
          ? cause.message
          : copy.state.errorGeneric
      );
    } finally {
      setSwitching(null);
    }
  }

  return (
    <div className="staff-app staff-gate">
      <div className="staff-gate-card">
        <div className="staff-brand">
          <NileRosette className="staff-brand-mark" />
          <span className="staff-brand-text">
            <span className="staff-brand-name">{copy.brand.name}</span>
            <span className="staff-brand-sub">{copy.brand.product}</span>
          </span>
        </div>
        <h1>{copy.shell.chooseWorkspace}</h1>
        <p className="staff-muted">{copy.shell.workspaceHint}</p>
        {error ? (
          <ErrorState
            error={error}
            onRetry={() => {
              setError(null);
              setItems(null);
              fetchAuthWorkspacesRequest().then(result => {
                if (result.ok && result.data) setItems(result.data.items);
                else setError(result.error ?? copy.state.errorGeneric);
              });
            }}
          />
        ) : items === null ? (
          <LoadingCenter />
        ) : items.length === 0 ? (
          <p className="staff-muted">{copy.shell.noWorkspaces}</p>
        ) : (
          <div className="flex flex-col gap-2 text-start">
            {items.map(workspace => (
              <button
                key={workspace.id}
                type="button"
                className="staff-gate-option"
                disabled={switching !== null}
                onClick={() => void choose(workspace.id)}
              >
                <span className="flex-1">{workspace.name}</span>
                {switching === workspace.id ? (
                  <span className="staff-muted">{copy.state.loading}</span>
                ) : null}
              </button>
            ))}
          </div>
        )}
        {chooseError ? (
          <p className="staff-field-error" role="alert">
            {chooseError}
          </p>
        ) : null}
        <button
          type="button"
          className="staff-btn"
          data-variant="ghost"
          onClick={() => void signOut()}
        >
          {copy.shell.signOut}
        </button>
      </div>
    </div>
  );
}
