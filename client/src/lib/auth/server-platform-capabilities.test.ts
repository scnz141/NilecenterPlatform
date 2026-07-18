import { describe, expect, it } from "vitest";
import {
  platformActionTypesByRole,
  recordSavePermissionByRole,
  requiredPermissionForPlatformAction,
  roleCanRunPlatformAction,
  validateDefaultPlatformCapabilityContract,
} from "../../../../server/platformCapabilities";

describe("server platform capability contract", () => {
  it("keeps every allowed action reachable through the role permission map", () => {
    expect(validateDefaultPlatformCapabilityContract()).toEqual([]);
  });

  it("keeps operational ownership explicit for generic compatibility records", () => {
    expect(recordSavePermissionByRole.registrar).not.toHaveProperty("Classes");
    expect(recordSavePermissionByRole.headofdepartment).not.toHaveProperty(
      "Classes"
    );
    expect(recordSavePermissionByRole.branchadmin).not.toHaveProperty(
      "Students"
    );
    expect(recordSavePermissionByRole.branchadmin).not.toHaveProperty(
      "Teachers"
    );
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
