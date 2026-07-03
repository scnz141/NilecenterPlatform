import { describe, expect, it } from "vitest";
import { canOpenPage, getRequiredPermissionForPage, getSidebarForRole } from "./rbac";

describe("RBAC page permission mapping", () => {
  it("maps protected pages to concrete permissions", () => {
    expect(getRequiredPermissionForPage("student", "attendance")).toBe("attendance:read");
    expect(getRequiredPermissionForPage("teacher", "grading")).toBe("assessments:read");
    expect(getRequiredPermissionForPage("branchadmin", "rooms")).toBe("rooms:read");
    expect(getRequiredPermissionForPage("headofdepartment", "certificates")).toBe("certificates:approve");
    expect(getRequiredPermissionForPage("superadmin", "audit-logs")).toBe("audit:read");
    expect(getRequiredPermissionForPage("superadmin", "users")).toBe("settings:write");
  });

  it("denies role pages when the role lacks the mapped capability", () => {
    expect(canOpenPage("student", "attendance")).toBe(true);
    expect(canOpenPage("student", "payments")).toBe(false);
    expect(canOpenPage("teacher", "classes")).toBe(true);
    expect(canOpenPage("teacher", "class-detail")).toBe(true);
    expect(canOpenPage("teacher", "students")).toBe(true);
    expect(canOpenPage("teacher", "materials")).toBe(true);
    expect(canOpenPage("teacher", "rooms")).toBe(false);
    expect(canOpenPage("registrar", "payments")).toBe(true);
    expect(canOpenPage("registrar", "classes")).toBe(true);
    expect(canOpenPage("registrar", "settings")).toBe(true);
    expect(canOpenPage("headofdepartment", "classes")).toBe(true);
    expect(canOpenPage("superadmin", "permissions")).toBe(true);
  });

  it("filters sidebar entries using the same permission map", () => {
    const studentSidebar = getSidebarForRole("student").map((item) => item.href);
    const superAdminSidebar = getSidebarForRole("superadmin").map((item) => item.href);

    expect(studentSidebar).toContain("/app/student/attendance");
    expect(studentSidebar).toContain("/app/student/profile");
    expect(superAdminSidebar).toContain("/app/admin/users");
    expect(superAdminSidebar).toContain("/app/admin/audit-logs");
  });
});
