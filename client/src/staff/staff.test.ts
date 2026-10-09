import { describe, expect, it } from "vitest";
import type {
  AuthSessionDto,
  NccEffectiveScopesDto,
  NccRole,
  NccStaffUserDto,
} from "@/lib/backend/api";
import {
  fetchAllPages,
  matchesStaffKey,
  staffQueryString,
  toStaffKey,
} from "./api";
import {
  staffGateDecision,
  staffLoginRedirect,
  staffNextTarget,
} from "./gate";
import {
  canAccess,
  navTrailForPath,
  staffNav,
  staffNavForRole,
  switchableRoles,
  titleForPath,
} from "./nav";
import { staffStatusCounts } from "./pages/staff-page";
import {
  canReadBranches,
  canReadDepartments,
  canReadStaffDirectory,
  canSwitchRoles,
  needsWorkspaceBranch,
  ROLE_ORDER,
  roleLabel,
} from "./roles";
import { staffScope } from "./session";

const ALL_ROLES: NccRole[] = [
  "super_admin",
  "branch_admin",
  "vice_manager",
  "hod",
  "registrar",
  "ssa",
  "teacher",
];

function nccSession(overrides: {
  assignedRole?: NccRole;
  activeRole?: NccRole;
  workspaceBranchId?: string | null;
  effectiveScopes?: NccEffectiveScopesDto | null;
} = {}): AuthSessionDto {
  return {
    userId: "u1",
    email: "qa@example.com",
    name: "QA",
    roles: ["superadmin"],
    activeRole: "superadmin",
    provider: "ncc",
    authorizationModel: "external",
    branchIds: [],
    departmentIds: [],
    expiresAt: "2099-01-01T00:00:00Z",
    ncc: {
      assignedRole: overrides.assignedRole ?? "super_admin",
      activeRole: overrides.activeRole ?? overrides.assignedRole ?? "super_admin",
      workspaceBranchId:
        overrides.workspaceBranchId === undefined
          ? "branch-1"
          : overrides.workspaceBranchId,
      workspaceAccess: null,
      effectiveScopes: overrides.effectiveScopes ?? null,
    },
  };
}

describe("staff roles", () => {
  it("orders all seven EMS roles by privilege", () => {
    expect(ROLE_ORDER).toEqual(ALL_ROLES);
  });

  it("labels every role", () => {
    for (const role of ALL_ROLES) {
      expect(roleLabel(role)).not.toBe(role);
      expect(roleLabel(role).length).toBeGreaterThan(0);
    }
  });

  it("marks branch-scoped roles", () => {
    expect(needsWorkspaceBranch("super_admin")).toBe(false);
    expect(needsWorkspaceBranch("hod")).toBe(false);
    expect(needsWorkspaceBranch("teacher")).toBe(false);
    expect(needsWorkspaceBranch("branch_admin")).toBe(true);
    expect(needsWorkspaceBranch("vice_manager")).toBe(true);
    expect(needsWorkspaceBranch("registrar")).toBe(true);
    expect(needsWorkspaceBranch("ssa")).toBe(true);
  });

  it("limits the branch directory read to roles EMS allows", () => {
    // Live-probed on EMS staging: GET /branches returns 200 for these.
    for (const role of [
      "super_admin",
      "branch_admin",
      "vice_manager",
      "registrar",
      "ssa",
    ] as NccRole[]) {
      expect(canReadBranches(role)).toBe(true);
    }
    // EMS returns 403 for HOD and teacher; null/undefined never fetch.
    for (const role of ["hod", "teacher"] as NccRole[]) {
      expect(canReadBranches(role)).toBe(false);
    }
    expect(canReadBranches(null)).toBe(false);
    expect(canReadBranches(undefined)).toBe(false);
  });

  it("limits the department directory read to Super Admin", () => {
    // Live-probed on EMS staging: GET /departments returns 200 only for
    // super_admin; every other role gets 403.
    expect(canReadDepartments("super_admin")).toBe(true);
    for (const role of [
      "branch_admin",
      "vice_manager",
      "registrar",
      "ssa",
      "hod",
      "teacher",
    ] as NccRole[]) {
      expect(canReadDepartments(role)).toBe(false);
    }
    expect(canReadDepartments(null)).toBe(false);
    expect(canReadDepartments(undefined)).toBe(false);
  });

  it("limits the staff directory read to management roles", () => {
    // Live-probed on the BFF with a workspace branch selected: super_admin,
    // branch_admin and vice_manager read /directory/users; registrar, ssa,
    // hod and teacher all get 403.
    for (const role of [
      "super_admin",
      "branch_admin",
      "vice_manager",
    ] as NccRole[]) {
      expect(canReadStaffDirectory(role)).toBe(true);
    }
    for (const role of [
      "registrar",
      "ssa",
      "hod",
      "teacher",
    ] as NccRole[]) {
      expect(canReadStaffDirectory(role)).toBe(false);
    }
    expect(canReadStaffDirectory(null)).toBe(false);
    expect(canReadStaffDirectory(undefined)).toBe(false);
  });

  it("allows switching only for management roles", () => {
    expect(canSwitchRoles("super_admin")).toBe(true);
    expect(canSwitchRoles("branch_admin")).toBe(true);
    expect(canSwitchRoles("vice_manager")).toBe(true);
    expect(canSwitchRoles("hod")).toBe(true);
    expect(canSwitchRoles("registrar")).toBe(false);
    expect(canSwitchRoles("ssa")).toBe(false);
    expect(canSwitchRoles("teacher")).toBe(false);
  });
});

describe("switchableRoles", () => {
  it("returns strictly lower-privileged roles for each of the seven roles", () => {
    expect(switchableRoles("super_admin")).toEqual([
      "branch_admin",
      "vice_manager",
      "hod",
      "registrar",
      "ssa",
      "teacher",
    ]);
    expect(switchableRoles("branch_admin")).toEqual([
      "vice_manager",
      "hod",
      "registrar",
      "ssa",
      "teacher",
    ]);
    expect(switchableRoles("vice_manager")).toEqual([
      "hod",
      "registrar",
      "ssa",
      "teacher",
    ]);
    expect(switchableRoles("hod")).toEqual(["registrar", "ssa", "teacher"]);
    expect(switchableRoles("registrar")).toEqual([]);
    expect(switchableRoles("ssa")).toEqual([]);
    expect(switchableRoles("teacher")).toEqual([]);
  });
});

describe("canAccess", () => {
  it("lets every role open profile, dashboard, and notifications", () => {
    for (const role of ALL_ROLES) {
      expect(canAccess("/app/profile", role)).toBe(true);
      expect(canAccess("/app/dashboard", role)).toBe(true);
      expect(canAccess("/app/notifications", role)).toBe(true);
      expect(canAccess("/app/notifications/123", role)).toBe(true);
    }
  });

  it("gives reports to every role except teacher", () => {
    for (const role of ALL_ROLES) {
      expect(canAccess("/app/reports", role)).toBe(role !== "teacher");
    }
  });

  it("restricts staff, moodle, system, and audit to their roles", () => {
    const managers: NccRole[] = ["super_admin", "branch_admin", "vice_manager"];
    const rest = ALL_ROLES.filter(role => !managers.includes(role));
    for (const role of managers) {
      expect(canAccess("/app/staff", role)).toBe(true);
      expect(canAccess("/app/staff/user-1", role)).toBe(true);
      expect(canAccess("/app/audit", role)).toBe(true);
    }
    for (const role of rest) {
      expect(canAccess("/app/staff", role)).toBe(false);
      expect(canAccess("/app/staff/user-1", role)).toBe(false);
      expect(canAccess("/app/audit", role)).toBe(false);
    }
    for (const role of ALL_ROLES.filter(role => role !== "super_admin")) {
      expect(canAccess("/app/moodle", role)).toBe(false);
      expect(canAccess("/app/system", role)).toBe(false);
    }
    expect(canAccess("/app/moodle", "super_admin")).toBe(true);
    expect(canAccess("/app/system", "super_admin")).toBe(true);
  });

  it("allows catalog reads for branch-picker roles only", () => {
    const readers: NccRole[] = [
      "super_admin",
      "branch_admin",
      "vice_manager",
      "registrar",
      "ssa",
    ];
    for (const role of readers) {
      expect(canAccess("/app/branches", role)).toBe(true);
      expect(canAccess("/app/branches/branch-1", role)).toBe(true);
    }
    expect(canAccess("/app/branches", "hod")).toBe(false);
    expect(canAccess("/app/branches", "teacher")).toBe(false);
  });

  it("restricts settings catalogs to super_admin", () => {
    const paths = [
      "/app/departments",
      "/app/lost-reasons",
      "/app/action-reasons",
      "/app/areas-of-study",
      "/app/custom-fields",
    ];
    for (const path of paths) {
      expect(canAccess(path, "super_admin")).toBe(true);
      for (const role of ALL_ROLES.filter(role => role !== "super_admin")) {
        expect(canAccess(path, role)).toBe(false);
      }
    }
  });

  it("denies unknown staff paths for every role", () => {
    for (const role of ALL_ROLES) {
      expect(canAccess("/app/unknown", role)).toBe(false);
    }
  });
});

describe("canAccess matrix", () => {
  const MANAGERS: NccRole[] = ["super_admin", "branch_admin", "vice_manager"];
  const ADMISSIONS: NccRole[] = [
    "super_admin",
    "branch_admin",
    "vice_manager",
    "registrar",
    "ssa",
  ];
  const BRANCH_PICKER: NccRole[] = [
    "super_admin",
    "branch_admin",
    "vice_manager",
    "registrar",
    "ssa",
  ];
  // Hard-coded expectation of the role × path matrix the shell relied on
  // before the navigation regroup; the redesign must not change any cell.
  const MATRIX: { path: string; allow: NccRole[] }[] = [
    { path: "/app/notifications", allow: ALL_ROLES },
    { path: "/app/staff", allow: MANAGERS },
    { path: "/app/staff/user-1", allow: MANAGERS },
    { path: "/app/branches", allow: BRANCH_PICKER },
    { path: "/app/branches/branch-1", allow: BRANCH_PICKER },
    { path: "/app/departments", allow: ["super_admin"] },
    { path: "/app/lost-reasons", allow: ["super_admin"] },
    { path: "/app/action-reasons", allow: ["super_admin"] },
    { path: "/app/areas-of-study", allow: ["super_admin"] },
    { path: "/app/custom-fields", allow: ["super_admin"] },
    { path: "/app/moodle", allow: ["super_admin"] },
    { path: "/app/system", allow: ["super_admin"] },
    { path: "/app/audit", allow: MANAGERS },
    { path: "/app/profile", allow: ALL_ROLES },
    { path: "/app/dashboard", allow: ALL_ROLES },
    { path: "/app/students/stu-1/report", allow: ALL_ROLES },
    { path: "/app/students", allow: ADMISSIONS },
    { path: "/app/students/stu-1", allow: ADMISSIONS },
    { path: "/app/enrolments", allow: ADMISSIONS },
    { path: "/app/leads", allow: ADMISSIONS },
    { path: "/app/leads/lead-1", allow: ADMISSIONS },
    { path: "/app/placement-tests", allow: ADMISSIONS },
    { path: "/app/trial-lessons", allow: ADMISSIONS },
    { path: "/app/courses/course-1", allow: ALL_ROLES },
    { path: "/app/classes/class-1", allow: ALL_ROLES },
    { path: "/app/rooms/room-1", allow: ALL_ROLES.filter(role => role !== "teacher") },
    { path: "/app/unknown", allow: [] },
  ];

  it("matches the expected role × path result for every cell", () => {
    for (const { path, allow } of MATRIX) {
      for (const role of ALL_ROLES) {
        expect(canAccess(path, role), `${role} × ${path}`).toBe(
          allow.includes(role)
        );
      }
    }
  });
});

describe("staffNavForRole", () => {
  it("groups the nav into the six signature sections in order", () => {
    expect(staffNav().map(group => group.label)).toEqual([
      "Home",
      "Admissions",
      "Teaching",
      "People and places",
      "Setup",
      "System",
    ]);
    // Groups with no wired pages drop out per role.
    expect(staffNavForRole("super_admin").map(group => group.label)).toEqual([
      "Home",
      "Admissions",
      "Teaching",
      "People and places",
      "Setup",
      "System",
    ]);
    expect(staffNavForRole("teacher").map(group => group.label)).toEqual([
      "Home",
      "Teaching",
    ]);
    expect(
      staffNavForRole("registrar").flatMap(group => group.items.map(item => item.href))
    ).toContain("/app/leads");
  });

  it("labels the people and places items and gives items icons", () => {
    const groups = staffNavForRole("super_admin");
    const people = groups.find(group => group.label === "People and places");
    expect(people?.items.map(item => item.label)).toEqual([
      "Staff",
      "Branches",
      "Departments",
    ]);
    for (const group of groups) {
      for (const item of group.items) {
        expect(item.icon, item.href).toBeTruthy();
      }
    }
  });

  it("shows only available items for every role", () => {
    for (const role of ALL_ROLES) {
      const groups = staffNavForRole(role);
      const hrefs = groups.flatMap(group =>
        group.items.map(item => item.href)
      );
      expect(hrefs).toContain("/app/notifications");
      // Profile is reachable via the user menu, not sidebar navigation.
      expect(hrefs).not.toContain("/app/profile");
      expect(canAccess("/app/profile", role)).toBe(true);
      expect(hrefs.includes("/app/sessions")).toBe(role === "teacher");
      expect(hrefs.includes("/app/classes")).toBe(true);
      expect(hrefs.includes("/app/rooms")).toBe(role !== "teacher");
      expect(hrefs.includes("/app/students")).toBe(
        ["super_admin", "branch_admin", "vice_manager", "registrar", "ssa"].includes(role)
      );
      expect(groups.every(group => group.items.length > 0)).toBe(true);
    }
  });

  it("shows catalog items to the roles the contract allows", () => {
    const adminHrefs = staffNavForRole("super_admin").flatMap(group =>
      group.items.map(item => item.href)
    );
    for (const href of [
      "/app/branches",
      "/app/departments",
      "/app/lost-reasons",
      "/app/action-reasons",
      "/app/areas-of-study",
      "/app/custom-fields",
    ]) {
      expect(adminHrefs).toContain(href);
    }
    const registrarHrefs = staffNavForRole("registrar").flatMap(group =>
      group.items.map(item => item.href)
    );
    expect(registrarHrefs).toContain("/app/branches");
    expect(registrarHrefs).not.toContain("/app/departments");
    expect(registrarHrefs).not.toContain("/app/action-reasons");
    const teacherHrefs = staffNavForRole("teacher").flatMap(group =>
      group.items.map(item => item.href)
    );
    expect(teacherHrefs).not.toContain("/app/branches");
  });
});

describe("titleForPath", () => {
  it("resolves known paths and falls back", () => {
    expect(titleForPath("/app/notifications")).toBe("Notifications");
    expect(titleForPath("/app/profile")).toBe("Profile");
    expect(titleForPath("/app/elsewhere")).toBe("Nile Center");
  });
});

describe("navTrailForPath", () => {
  it("returns the group and item for the staff list and staff detail", () => {
    const list = navTrailForPath("/app/staff");
    expect(list).not.toBeNull();
    expect(list!.group).toBe("People and places");
    expect(list!.item.href).toBe("/app/staff");
    const detail = navTrailForPath("/app/staff/abc");
    expect(detail).not.toBeNull();
    expect(detail!.group).toBe("People and places");
    expect(detail!.item.href).toBe("/app/staff");
  });

  it("returns the Setup group for a settings page", () => {
    const trail = navTrailForPath("/app/lost-reasons");
    expect(trail).not.toBeNull();
    expect(trail!.group).toBe("Setup");
    expect(trail!.item.href).toBe("/app/lost-reasons");
  });

  it("returns null for a path outside the navigation", () => {
    expect(navTrailForPath("/app/unknown")).toBeNull();
  });
});

describe("staffStatusCounts", () => {
  it("counts each status across the loaded list", () => {
    const user = (status: NccStaffUserDto["status"]) =>
      ({ status }) as NccStaffUserDto;
    expect(
      staffStatusCounts([
        user("active"),
        user("active"),
        user("invited"),
        user("disabled"),
        user("canceled"),
      ])
    ).toEqual({ active: 2, invited: 1, disabled: 1, canceled: 1 });
    expect(staffStatusCounts([])).toEqual({
      active: 0,
      invited: 0,
      disabled: 0,
      canceled: 0,
    });
  });
});

describe("staffGateDecision", () => {
  it("returns loading while the session resolves", () => {
    expect(
      staffGateDecision(null, true, "/app/notifications")
    ).toBe("loading");
  });

  it("redirects to login without an NCC session", () => {
    expect(staffGateDecision(null, false, "/app/profile")).toBe("login");
    const legacy = { ...nccSession(), provider: "demo" as const };
    expect(staffGateDecision(legacy, false, "/app/profile")).toBe("login");
    const noNcc = { ...nccSession(), ncc: null };
    expect(staffGateDecision(noNcc, false, "/app/profile")).toBe("login");
  });

  it("gates branch-scoped roles behind a workspace", () => {
    const registrar = nccSession({
      assignedRole: "registrar",
      workspaceBranchId: null,
    });
    expect(staffGateDecision(registrar, false, "/app/profile")).toBe(
      "workspace"
    );
    const ssa = nccSession({ assignedRole: "ssa", workspaceBranchId: null });
    expect(staffGateDecision(ssa, false, "/app/profile")).toBe("workspace");
    const teacher = nccSession({
      assignedRole: "teacher",
      workspaceBranchId: null,
    });
    expect(staffGateDecision(teacher, false, "/app/profile")).toBe("ok");
  });

  it("accepts effective-scope branches on role-view sessions", () => {
    // EMS never sets workspaceBranchId for a viewed-as branch_admin; the
    // branch lives in effectiveScopes.
    const viewed = nccSession({
      assignedRole: "super_admin",
      activeRole: "branch_admin",
      workspaceBranchId: null,
      effectiveScopes: {
        branchId: null,
        branchIds: ["branch-9"],
        departmentIds: [],
        classIds: [],
        courseIds: [],
      },
    });
    expect(staffGateDecision(viewed, false, "/app/profile")).toBe("ok");
  });

  it("denies paths outside the active role", () => {
    const teacher = nccSession({ assignedRole: "teacher" });
    expect(staffGateDecision(teacher, false, "/app/audit")).toBe("denied");
    expect(staffGateDecision(teacher, false, "/app/profile")).toBe("ok");
    const admin = nccSession({ assignedRole: "super_admin" });
    expect(staffGateDecision(admin, false, "/app/notifications")).toBe("ok");
  });
});

describe("staffLoginRedirect", () => {
  it("carries the current location into the login redirect", () => {
    expect(staffLoginRedirect("/app/forms", "")).toBe(
      "/auth/administration-login?next=%2Fapp%2Fforms"
    );
    expect(staffLoginRedirect("/app/forms", "tab=share")).toBe(
      "/auth/administration-login?next=%2Fapp%2Fforms%3Ftab%3Dshare"
    );
  });
});

describe("staffNextTarget", () => {
  it("accepts only in-app absolute paths", () => {
    expect(staffNextTarget("/app/forms?tab=share")).toBe("/app/forms?tab=share");
    expect(staffNextTarget("/app")).toBe("/app");
    expect(staffNextTarget("/apple")).toBeNull();
    expect(staffNextTarget("//evil.example")).toBeNull();
    expect(staffNextTarget("https://evil.example/app")).toBeNull();
    expect(staffNextTarget("/login")).toBeNull();
    expect(staffNextTarget(null)).toBeNull();
    expect(staffNextTarget("")).toBeNull();
  });
});

describe("SWR key scoping", () => {
  it("scopes keys by active role and workspace branch", () => {
    expect(staffScope(nccSession({ assignedRole: "registrar" }))).toBe(
      "registrar:branch-1"
    );
    expect(
      staffScope(
        nccSession({
          assignedRole: "super_admin",
          activeRole: "registrar",
          workspaceBranchId: null,
        })
      )
    ).toBe("registrar:");
    expect(staffScope(null)).toBe("anon");
  });

  it("builds [scope, path] or [scope, path, query] keys", () => {
    expect(toStaffKey("registrar:b1", "/api/ncc/notifications")).toEqual([
      "registrar:b1",
      "/api/ncc/notifications",
    ]);
    expect(
      toStaffKey("registrar:b1", "/api/ncc/notifications", { limit: 6 })
    ).toEqual(["registrar:b1", "/api/ncc/notifications", { limit: 6 }]);
    expect(toStaffKey("a", "/api/x", {})).toEqual(["a", "/api/x"]);
  });

  it("matches invalidation keys only inside the same scope", () => {
    const key = toStaffKey("registrar:b1", "/api/ncc/notifications", {
      limit: 6,
    });
    expect(matchesStaffKey(key, "registrar:b1", "/api/ncc")).toBe(true);
    expect(matchesStaffKey(key, "registrar:b2", "/api/ncc")).toBe(false);
    expect(matchesStaffKey(key, "hod:b1", "/api/ncc")).toBe(false);
    expect(matchesStaffKey(key, "registrar:b1", "/api/ncc/students")).toBe(
      false
    );
    expect(matchesStaffKey("plain", "registrar:b1", "/api/ncc")).toBe(false);
  });

  it("serializes queries deterministically, skipping empty values", () => {
    expect(staffQueryString({ unread: "true", limit: 6 })).toBe(
      "?unread=true&limit=6"
    );
    expect(staffQueryString({ unread: undefined, q: "" })).toBe("");
    expect(staffQueryString(undefined)).toBe("");
  });
});

describe("fetchAllPages", () => {
  const pages = (total: number, size = 100) =>
    Array.from({ length: Math.ceil(total / size) }, (_, index) => ({
      items: Array.from(
        { length: Math.min(size, total - index * size) },
        (__, row) => index * size + row
      ),
      total,
    }));

  it("fetches exactly ceil(total/100) pages and merges them", async () => {
    const data = pages(250);
    const calls: number[] = [];
    const result = await fetchAllPages("/api/x", undefined, async (_path, q) => {
      calls.push(q.page as number);
      return data[(q.page as number) - 1];
    });
    expect(calls.sort((a, b) => a - b)).toEqual([1, 2, 3]);
    expect(result.items).toHaveLength(250);
    expect(result.items[249]).toBe(249);
    expect(result.total).toBe(250);
    expect(result.truncated).toBe(false);
  });

  it("stops after page 1 when everything fits", async () => {
    const calls: number[] = [];
    const result = await fetchAllPages("/api/x", { status: "x" }, async (_p, q) => {
      calls.push(q.page as number);
      return { items: [1, 2], total: 2 };
    });
    expect(calls).toEqual([1]);
    expect(result.items).toEqual([1, 2]);
  });

  it("caps at 50 pages and reports truncation", async () => {
    const calls: number[] = [];
    const result = await fetchAllPages("/api/x", undefined, async (_p, q) => {
      calls.push(q.page as number);
      return { items: [q.page], total: 9999 };
    });
    expect(calls).toHaveLength(50);
    expect(result.items).toHaveLength(50);
    expect(result.truncated).toBe(true);
    expect(result.total).toBe(9999);
  });

  it("rejects when any later page fails", async () => {
    await expect(
      fetchAllPages("/api/x", undefined, async (_p, q) => {
        if (q.page === 3) throw new Error("boom");
        return { items: [q.page], total: 400 };
      })
    ).rejects.toThrow("boom");
  });
});
