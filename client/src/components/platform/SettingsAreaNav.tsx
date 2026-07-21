import { Link } from "wouter";
import type { Role } from "@/lib/platformData";

type SettingsAreaNavProps = {
  role: Role;
  active: "account" | "workspace";
};

const routeSegmentByRole: Record<Role, string> = {
  student: "student",
  teacher: "teacher",
  registrar: "registrar",
  headofdepartment: "hod",
  branchadmin: "branch",
  superadmin: "admin",
};

const rolesWithWorkspaceSettings = new Set<Role>([
  "registrar",
  "headofdepartment",
  "branchadmin",
  "superadmin",
]);

export default function SettingsAreaNav({
  role,
  active,
}: SettingsAreaNavProps) {
  const settingsRoot = `/app/${routeSegmentByRole[role]}/settings`;
  const accountHref = rolesWithWorkspaceSettings.has(role)
    ? `${settingsRoot}/profile`
    : settingsRoot;

  return (
    <nav
      className="portal-simple-tabs settings-area-nav"
      aria-label="Settings sections"
    >
      <Link className={active === "account" ? "active" : ""} href={accountHref}>
        Account
      </Link>
      {rolesWithWorkspaceSettings.has(role) ? (
        <Link
          className={active === "workspace" ? "active" : ""}
          href={settingsRoot}
        >
          Workspace
        </Link>
      ) : null}
    </nav>
  );
}
