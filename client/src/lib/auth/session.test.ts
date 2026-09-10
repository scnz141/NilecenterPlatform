import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const backendMocks = vi.hoisted(() => ({
  fetchSessionRequest: vi.fn(),
  logoutRequest: vi.fn(),
  signInRequest: vi.fn(),
  switchRoleRequest: vi.fn(),
  switchWorkspaceRequest: vi.fn(),
}));

vi.mock("@/lib/backend/api", () => ({
  fetchSessionRequest: backendMocks.fetchSessionRequest,
  logoutRequest: backendMocks.logoutRequest,
  signInRequest: backendMocks.signInRequest,
  switchRoleRequest: backendMocks.switchRoleRequest,
  switchWorkspaceRequest: backendMocks.switchWorkspaceRequest,
}));

import {
  clearStoredSession,
  getActiveUser,
  refreshServerSession,
  setStoredRole,
  setStoredWorkspace,
  signInWithPassword,
} from "@/lib/auth/session";

const AUTH_SESSION_KEY = "nilelearn.auth.session";
const ACTIVE_ROLE_KEY = "nilelearn.activeRole";
const studentSession = {
  userId: "usr_student_demo",
  email: "student.demo@nilelearn.local",
  name: "Student Demo",
  roles: ["student"] as const,
  activeRole: "student" as const,
  provider: "demo" as const,
  authorizationModel: "snapshot" as const,
  branchIds: [],
  departmentIds: [],
  expiresAt: "2099-01-01T00:00:00.000Z",
};

function installWindow() {
  const values = new Map<string, string>();
  const localStorage = {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => [...values.keys()][index] ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
  } satisfies Storage;

  vi.stubGlobal("window", {
    localStorage,
    dispatchEvent: vi.fn(),
  });
  return localStorage;
}

async function seedSession() {
  backendMocks.signInRequest.mockResolvedValue({
    ok: true,
    data: studentSession,
  });
  await signInWithPassword(
    studentSession.email,
    "irrelevant-test-password",
    "student"
  );
}

describe("clearStoredSession", () => {
  beforeEach(() => {
    backendMocks.fetchSessionRequest.mockReset();
    backendMocks.logoutRequest.mockReset();
    backendMocks.signInRequest.mockReset();
    backendMocks.switchRoleRequest.mockReset();
    backendMocks.switchWorkspaceRequest.mockReset();
  });

  afterEach(async () => {
    backendMocks.logoutRequest.mockResolvedValue({
      ok: true,
      data: { ok: true },
    });
    await clearStoredSession();
    vi.unstubAllGlobals();
  });

  it("clears in-memory session state only after the server confirms logout", async () => {
    const storage = installWindow();
    await seedSession();
    backendMocks.logoutRequest.mockResolvedValue({
      ok: true,
      data: { ok: true },
    });

    await expect(clearStoredSession()).resolves.toEqual({ ok: true });

    expect(getActiveUser()).toBeNull();
    expect(storage.getItem(AUTH_SESSION_KEY)).toBeNull();
    expect(storage.getItem(ACTIVE_ROLE_KEY)).toBeNull();
    expect(window.dispatchEvent).toHaveBeenCalledTimes(2);
  });

  it("keeps in-memory session state when logout cannot reach the server", async () => {
    const storage = installWindow();
    await seedSession();
    vi.mocked(window.dispatchEvent).mockClear();
    backendMocks.logoutRequest.mockResolvedValue({
      ok: false,
      error: "Failed to fetch",
    });

    await expect(clearStoredSession()).resolves.toEqual({
      ok: false,
      error: "Failed to fetch",
    });

    expect(getActiveUser()).toMatchObject({ id: "usr_student_demo" });
    expect(storage.getItem(AUTH_SESSION_KEY)).toBeNull();
    expect(storage.getItem(ACTIVE_ROLE_KEY)).toBeNull();
    expect(window.dispatchEvent).not.toHaveBeenCalled();
  });

  it("keeps in-memory session state when the server rejects logout", async () => {
    const storage = installWindow();
    await seedSession();
    vi.mocked(window.dispatchEvent).mockClear();
    backendMocks.logoutRequest.mockResolvedValue({
      ok: false,
      error: "Session revocation is unavailable.",
    });

    await expect(clearStoredSession()).resolves.toEqual({
      ok: false,
      error: "Session revocation is unavailable.",
    });

    expect(getActiveUser()).toMatchObject({ id: "usr_student_demo" });
    expect(storage.getItem(AUTH_SESSION_KEY)).toBeNull();
    expect(storage.getItem(ACTIVE_ROLE_KEY)).toBeNull();
    expect(window.dispatchEvent).not.toHaveBeenCalled();
  });
});

describe("getActiveUser", () => {
  beforeEach(() => {
    backendMocks.fetchSessionRequest.mockReset();
    backendMocks.logoutRequest.mockReset();
    backendMocks.signInRequest.mockReset();
    backendMocks.switchRoleRequest.mockReset();
    backendMocks.switchWorkspaceRequest.mockReset();
  });

  afterEach(async () => {
    backendMocks.logoutRequest.mockResolvedValue({
      ok: true,
      data: { ok: true },
    });
    await clearStoredSession();
    vi.unstubAllGlobals();
  });

  it("uses the server session identity instead of the role demo user", async () => {
    const storage = installWindow();
    backendMocks.fetchSessionRequest.mockResolvedValue({
      ok: true,
      data: {
        userId: "usr_teacher_e2e",
        email: "teacher.e2e@nilelearn.local",
        name: "E2E Teacher",
        roles: ["teacher"],
        activeRole: "teacher",
        provider: "supabase",
        authorizationModel: "normalized",
        branchIds: ["branch-real"],
        departmentIds: ["department-real"],
        expiresAt: "2099-01-01T00:00:00.000Z",
      },
    });

    await refreshServerSession();

    expect(getActiveUser()).toMatchObject({
      id: "usr_teacher_e2e",
      email: "teacher.e2e@nilelearn.local",
      name: "E2E Teacher",
      roles: ["teacher"],
      activeRole: "teacher",
      avatar: "ET",
      branch: "Assigned branch",
      department: "Assigned department",
    });
    expect(storage.getItem(AUTH_SESSION_KEY)).toBeNull();
    expect(storage.getItem(ACTIVE_ROLE_KEY)).toBeNull();
  });

  it("does not substitute a demo identity without a server session", () => {
    installWindow();

    expect(getActiveUser()).toBeNull();
  });

  it("removes session authority left by older browser releases", () => {
    const storage = installWindow();
    storage.setItem(AUTH_SESSION_KEY, JSON.stringify(studentSession));
    storage.setItem(ACTIVE_ROLE_KEY, "student");

    expect(getActiveUser()).toBeNull();
    expect(storage.getItem(AUTH_SESSION_KEY)).toBeNull();
    expect(storage.getItem(ACTIVE_ROLE_KEY)).toBeNull();
  });

  it("changes role only after the server returns a replacement session", async () => {
    installWindow();
    await seedSession();
    const adminSession = {
      ...studentSession,
      roles: ["superadmin"] as const,
      activeRole: "superadmin" as const,
    };
    backendMocks.switchRoleRequest.mockResolvedValue({
      ok: true,
      data: adminSession,
    });

    await expect(setStoredRole("superadmin")).resolves.toMatchObject({
      ok: true,
      session: adminSession,
    });
    expect(backendMocks.switchRoleRequest).toHaveBeenCalledWith("superadmin");
    expect(getActiveUser()).toMatchObject({
      activeRole: "superadmin",
      id: studentSession.userId,
    });
  });

  it("updates the active NCC workspace only after server confirmation", async () => {
    installWindow();
    backendMocks.fetchSessionRequest.mockResolvedValue({
      ok: true,
      data: {
        ...studentSession,
        userId: "ncc-registrar",
        roles: ["registrar"],
        activeRole: "registrar",
        assignedRole: "registrar",
        workspaceBranchId: null,
        provider: "ncc",
        authorizationModel: "external",
      },
    });
    await refreshServerSession();
    const nextSession = {
      ...studentSession,
      userId: "ncc-registrar",
      roles: ["registrar"] as const,
      activeRole: "registrar" as const,
      assignedRole: "registrar" as const,
      workspaceBranchId: "branch-1",
      provider: "ncc" as const,
      authorizationModel: "external" as const,
      branchIds: ["branch-1"],
    };
    backendMocks.switchWorkspaceRequest.mockResolvedValue({
      ok: true,
      data: nextSession,
    });

    await expect(setStoredWorkspace("branch-1")).resolves.toMatchObject({
      ok: true,
      session: nextSession,
    });
    expect(backendMocks.switchWorkspaceRequest).toHaveBeenCalledWith(
      "branch-1"
    );
    expect(getActiveUser()).toMatchObject({
      id: "ncc-registrar",
      activeRole: "registrar",
      branch: "Assigned branch",
    });
  });

  it("preserves the current role when the server denies a switch", async () => {
    installWindow();
    await seedSession();
    backendMocks.switchRoleRequest.mockResolvedValue({
      ok: false,
      error: "This account is not authorized for that role.",
    });

    await expect(setStoredRole("teacher")).resolves.toEqual({
      ok: false,
      error: "This account is not authorized for that role.",
    });
    expect(getActiveUser()).toMatchObject({ activeRole: "student" });
  });
});
