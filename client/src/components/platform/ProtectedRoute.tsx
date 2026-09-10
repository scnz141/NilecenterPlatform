import { useEffect, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { LockKeyhole, ShieldAlert } from "lucide-react";
import {
  canAccessRole,
  getStoredRole,
  refreshServerSession,
} from "@/lib/auth/session";
import { fetchPlatformStateRequest } from "@/lib/backend/api";
import { platformStore } from "@/lib/domain/store";
import { roleMeta, type Role } from "@/lib/platformData";
import { canOpenPage, getRequiredPermissionForPage } from "@/lib/rbac";

export default function ProtectedRoute({
  role,
  pageId = "dashboard",
  children,
}: {
  role: Role;
  pageId?: string;
  children: ReactNode;
}) {
  const [activeRole, setActiveRole] = useState<Role | null>(() =>
    getStoredRole()
  );
  const [checkedSession, setCheckedSession] = useState(false);
  const [scopeStatus, setScopeStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [scopeError, setScopeError] = useState("");
  const [workspaceRequired, setWorkspaceRequired] = useState(false);
  const [hydratedRole, setHydratedRole] = useState<Role | null>(null);
  const [retryVersion, setRetryVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const listener = () => setActiveRole(getStoredRole());
    window.addEventListener("storage", listener);
    window.addEventListener("nilelearn:session", listener);
    const hydrateScope = async () => {
      setScopeStatus("loading");
      setScopeError("");
      setWorkspaceRequired(false);
      setHydratedRole(null);
      const session = await refreshServerSession();
      if (cancelled) return;
      const storedRole = getStoredRole();
      setActiveRole(session?.activeRole ?? storedRole);
      setCheckedSession(true);
      if (!session) {
        if (storedRole) {
          setScopeStatus("error");
          setScopeError(
            "The authenticated server session could not be verified."
          );
        } else {
          setScopeStatus("ready");
        }
        return;
      }
      if (
        session.provider === "ncc" &&
        ["branchadmin", "registrar"].includes(session.activeRole) &&
        !session.workspaceBranchId
      ) {
        setWorkspaceRequired(true);
        setScopeStatus("ready");
        return;
      }
      const response = await fetchPlatformStateRequest();
      if (cancelled) return;
      if (!response.ok || !response.data) {
        setScopeStatus("error");
        setScopeError(
          response.error ?? "The scoped workspace could not be loaded."
        );
        return;
      }
      platformStore.setState(response.data.state);
      setHydratedRole(session.activeRole);
      setScopeStatus("ready");
    };
    void hydrateScope();
    return () => {
      cancelled = true;
      window.removeEventListener("storage", listener);
      window.removeEventListener("nilelearn:session", listener);
    };
  }, [retryVersion, role]);

  if (
    !checkedSession ||
    (activeRole &&
      !workspaceRequired &&
      (scopeStatus === "loading" ||
        (scopeStatus === "ready" && hydratedRole !== activeRole)))
  ) {
    return (
      <main className="platform-route-loading" aria-live="polite">
        <span />
        <strong>
          {checkedSession ? "Loading scoped workspace" : "Checking session"}
        </strong>
      </main>
    );
  }

  if (activeRole && workspaceRequired) {
    return (
      <main className="auth-flow-page">
        <section className="platform-access-denied" role="status">
          <span>
            <ShieldAlert size={26} />
          </span>
          <h1>Choose a branch</h1>
          <p>
            Select the branch you are working with before opening this
            workspace.
          </p>
          <div>
            <Link
              href="/auth/select-workspace"
              className="platform-primary-button"
            >
              Choose branch
            </Link>
            <Link href="/auth/logout" className="platform-secondary-button">
              Sign out
            </Link>
          </div>
        </section>
      </main>
    );
  }

  if (activeRole && scopeStatus === "error") {
    return (
      <main className="auth-flow-page">
        <section className="platform-access-denied" role="alert">
          <span>
            <ShieldAlert size={26} />
          </span>
          <h1>Workspace unavailable</h1>
          <p>{scopeError}</p>
          <div>
            <button
              type="button"
              className="platform-primary-button"
              onClick={() => setRetryVersion(value => value + 1)}
            >
              Retry
            </button>
            <Link href="/auth/login" className="platform-secondary-button">
              Sign in again
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const access = canAccessRole(role);
  const requiredPermission = getRequiredPermissionForPage(role, pageId);
  const permissionAllowed = access.ok && canOpenPage(role, pageId);
  if (permissionAllowed) return <>{children}</>;
  const deniedByPermission = access.ok && !permissionAllowed;

  if (access.reason === "not_authenticated") {
    return (
      <main className="auth-flow-page">
        <section className="platform-access-denied" aria-live="polite">
          <span>
            <LockKeyhole size={26} />
          </span>
          <h1>Sign in required</h1>
          <p>
            Sign in from the Nile Learn login page before opening protected
            workspaces.
          </p>
          <div>
            <Link
              href="/auth/login"
              className="platform-primary-button"
              style={{ background: roleMeta[role].color }}
            >
              Sign in
            </Link>
            <Link href="/" className="platform-secondary-button">
              Back to public site
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-flow-page">
      <section className="platform-access-denied" aria-live="polite">
        <span>
          <ShieldAlert size={26} />
        </span>
        <h1>Access denied</h1>
        <p>
          {deniedByPermission
            ? `${roleMeta[role].label} is signed in, but this page requires ${requiredPermission}.`
            : `Current role is ${roleMeta[activeRole ?? role].label}. This page requires ${roleMeta[role].label}.`}
        </p>
        <div>
          <Link
            href="/auth/login"
            className="platform-primary-button"
            style={{ background: roleMeta[role].color }}
          >
            Sign in
          </Link>
          <Link
            href={
              activeRole
                ? roleMeta[activeRole].defaultRoute
                : "/auth/select-role"
            }
            className="platform-secondary-button"
          >
            {activeRole ? "Go to my workspace" : "Select role"}
          </Link>
        </div>
      </section>
    </main>
  );
}
