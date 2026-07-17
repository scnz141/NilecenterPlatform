import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const backendMocks = vi.hoisted(() => ({
  logoutRequest: vi.fn(),
}));

vi.mock("@/lib/backend/api", () => ({
  fetchSessionRequest: vi.fn(),
  logoutRequest: backendMocks.logoutRequest,
  signInRequest: vi.fn(),
}));

import { clearStoredSession } from "@/lib/auth/session";

const AUTH_SESSION_KEY = "nilelearn.auth.session";
const ACTIVE_ROLE_KEY = "nilelearn.activeRole";

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

function seedSession(storage: Storage) {
  storage.setItem(
    AUTH_SESSION_KEY,
    JSON.stringify({
      userId: "usr_student_demo",
      email: "student.demo@nilelearn.local",
      name: "Student Demo",
      roles: ["student"],
      activeRole: "student",
      provider: "demo",
      expiresAt: "2099-01-01T00:00:00.000Z",
    })
  );
  storage.setItem(ACTIVE_ROLE_KEY, "student");
}

describe("clearStoredSession", () => {
  beforeEach(() => {
    backendMocks.logoutRequest.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("clears local session state only after the server confirms logout", async () => {
    const storage = installWindow();
    seedSession(storage);
    backendMocks.logoutRequest.mockResolvedValue({
      ok: true,
      data: { ok: true },
    });

    await expect(clearStoredSession()).resolves.toEqual({ ok: true });

    expect(storage.getItem(AUTH_SESSION_KEY)).toBeNull();
    expect(storage.getItem(ACTIVE_ROLE_KEY)).toBeNull();
    expect(window.dispatchEvent).toHaveBeenCalledOnce();
  });

  it("keeps local session state when the logout request cannot reach the server", async () => {
    const storage = installWindow();
    seedSession(storage);
    backendMocks.logoutRequest.mockResolvedValue({
      ok: false,
      error: "Failed to fetch",
    });

    await expect(clearStoredSession()).resolves.toEqual({
      ok: false,
      error: "Failed to fetch",
    });

    expect(storage.getItem(AUTH_SESSION_KEY)).not.toBeNull();
    expect(storage.getItem(ACTIVE_ROLE_KEY)).toBe("student");
    expect(window.dispatchEvent).not.toHaveBeenCalled();
  });

  it("keeps local session state when the server rejects logout", async () => {
    const storage = installWindow();
    seedSession(storage);
    backendMocks.logoutRequest.mockResolvedValue({
      ok: false,
      error: "Session revocation is unavailable.",
    });

    await expect(clearStoredSession()).resolves.toEqual({
      ok: false,
      error: "Session revocation is unavailable.",
    });

    expect(storage.getItem(AUTH_SESSION_KEY)).not.toBeNull();
    expect(storage.getItem(ACTIVE_ROLE_KEY)).toBe("student");
    expect(window.dispatchEvent).not.toHaveBeenCalled();
  });
});
