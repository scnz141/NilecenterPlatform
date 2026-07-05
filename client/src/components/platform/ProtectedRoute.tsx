import { useEffect, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { LockKeyhole, ShieldAlert } from "lucide-react";
import PlatformShell from "./PlatformShell";
import { canAccessRole, getStoredRole, refreshServerSession } from "@/lib/auth/session";
import { roleMeta, type Role } from "@/lib/platformData";
import { canOpenPage, getRequiredPermissionForPage } from "@/lib/rbac";

export default function ProtectedRoute({ role, pageId = "dashboard", children }: { role: Role; pageId?: string; children: ReactNode }) {
  const [activeRole, setActiveRole] = useState<Role | null>(() => getStoredRole());
  const [checkedSession, setCheckedSession] = useState(Boolean(getStoredRole()));

  useEffect(() => {
    const listener = () => setActiveRole(getStoredRole());
    window.addEventListener("storage", listener);
    window.addEventListener("nilelearn:session", listener);
    refreshServerSession()
      .then((session) => {
        setActiveRole(session?.activeRole ?? getStoredRole());
      })
      .finally(() => setCheckedSession(true));
    return () => {
      window.removeEventListener("storage", listener);
      window.removeEventListener("nilelearn:session", listener);
    };
  }, []);

  if (!checkedSession && !activeRole) {
    return (
      <main className="platform-route-loading" aria-live="polite">
        <span />
        <strong>Checking session</strong>
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
    <PlatformShell role={activeRole ?? role} title="Access">
      <section className="platform-access-denied">
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
    </PlatformShell>
  );
}
