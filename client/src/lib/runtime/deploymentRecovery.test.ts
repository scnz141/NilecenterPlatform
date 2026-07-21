import { describe, expect, it } from "vitest";
import { claimStaleDeploymentReload } from "./deploymentRecovery";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("stale deployment recovery", () => {
  it("claims the first reload attempt for a route", () => {
    const storage = new MemoryStorage();

    expect(
      claimStaleDeploymentReload(
        storage,
        "https://example.test/app/admin/users",
        1_000
      )
    ).toBe(true);
  });

  it("prevents a reload loop for the same route", () => {
    const storage = new MemoryStorage();
    const href = "https://example.test/app/admin/users/user-1";

    expect(claimStaleDeploymentReload(storage, href, 1_000)).toBe(true);
    expect(claimStaleDeploymentReload(storage, href, 10_000)).toBe(false);
    expect(claimStaleDeploymentReload(storage, href, 61_001)).toBe(true);
  });

  it("allows recovery immediately when navigating to another route", () => {
    const storage = new MemoryStorage();

    expect(
      claimStaleDeploymentReload(
        storage,
        "https://example.test/app/admin/users",
        1_000
      )
    ).toBe(true);
    expect(
      claimStaleDeploymentReload(
        storage,
        "https://example.test/app/admin/roles",
        2_000
      )
    ).toBe(true);
  });
});
