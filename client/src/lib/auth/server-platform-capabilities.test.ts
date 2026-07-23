import { describe, expect, it } from "vitest";
import {
  platformActionTypesByRole,
  requiredPermissionForPlatformAction,
  roleCanRunPlatformAction,
  validateDefaultPlatformCapabilityContract,
} from "../../../../server/platformCapabilities";

describe("server platform capability contract", () => {
  it("keeps every allowed action reachable through the role permission map", () => {
    expect(validateDefaultPlatformCapabilityContract()).toEqual([]);
  });

  it("does not expose the retired generic record save command", () => {
    for (const actions of Object.values(platformActionTypesByRole)) {
      expect(actions).not.toContain("record.save");
    }
  });

  it("keeps class definition changes with branch operations", () => {
    expect(roleCanRunPlatformAction("branchadmin", "class.create")).toBe(true);
    expect(roleCanRunPlatformAction("headofdepartment", "class.create")).toBe(
      false
    );
    expect(platformActionTypesByRole.headofdepartment).toContain(
      "course-run.create"
    );
  });

  it("requires explicit global write permissions for accepted admin operations", () => {
    expect(
      requiredPermissionForPlatformAction("superadmin", {
        type: "class.session.cancel",
        sessionId: "session_ar_live",
        reason: "Capability contract test",
      })
    ).toBe("schedule:write");
    expect(
      requiredPermissionForPlatformAction("superadmin", {
        type: "attendance.exception.review",
        exceptionId: "attendance_exception_test",
        decision: "approved",
      })
    ).toBe("attendance:write");
  });
});
