import { useEffect, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { LockKeyhole, ShieldAlert } from "lucide-react";
import PlatformShell from "./PlatformShell";
import { canAccessRole, getStoredRole, refreshServerSession } from "@/lib/auth/session";
import { roleMeta, type Role } from "@/lib/platformData";

export default function ProtectedRoute({ role, children }: { role: Role; children: ReactNode }) {
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
  if (access.ok) return <>{children}</>;

  return (
    <PlatformShell role={activeRole ?? role} title="Access">
      <section className="platform-access-denied">
        <span>{access.reason === "not_authenticated" ? <LockKeyhole size={26} /> : <ShieldAlert size={26} />}</span>
        <h1>{access.reason === "not_authenticated" ? "Sign in required" : "Access denied"}</h1>
        <p>
          {access.reason === "not_authenticated"
            ? "Choose a demo role from the login page before opening protected workspaces."
            : `Current role is ${roleMeta[activeRole ?? role].label}. This page requires ${roleMeta[role].label}.`}
        </p>
        <div>
          <Link href="/auth/login" className="platform-primary-button" style={{ background: roleMeta[role].color }}>
            Sign in
          </Link>
          <Link href={activeRole ? roleMeta[activeRole].defaultRoute : "/auth/select-role"} className="platform-secondary-button">
            {activeRole ? "Go to my workspace" : "Select role"}
          </Link>
        </div>
      </section>
    </PlatformShell>
  );
}
