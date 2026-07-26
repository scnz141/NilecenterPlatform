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

  it("keeps teacher availability self-scoped through schedule authority", () => {
    expect(
      roleCanRunPlatformAction("teacher", "teacher.availability.update")
    ).toBe(true);
    expect(
      roleCanRunPlatformAction("branchadmin", "teacher.availability.update")
    ).toBe(false);
    expect(
      requiredPermissionForPlatformAction("teacher", {
        type: "teacher.availability.update",
        teacherId: "usr_teacher_demo",
        branchId: "br_online",
        availabilityStatus: "available",
        slots: [
          { weekday: "Monday", startsAt: "09:00", endsAt: "12:00" },
        ],
      })
    ).toBe("schedule:write");
  });

  it("keeps learner interventions teacher-scoped", () => {
    expect(
      roleCanRunPlatformAction("teacher", "student.intervention.create")
    ).toBe(true);
    expect(
      roleCanRunPlatformAction("branchadmin", "student.intervention.create")
    ).toBe(false);
    expect(
      roleCanRunPlatformAction(
        "headofdepartment",
        "student.intervention.status.update"
      )
    ).toBe(false);
    expect(
      requiredPermissionForPlatformAction("teacher", {
        type: "student.intervention.create",
        studentId: "stu_demo",
        classGroupId: "class_ar_l3_a",
        category: "academic",
        priority: "normal",
        summary: "A focused follow-up is required.",
        nextStep: "Review the next two learning outcomes.",
        studentVisible: true,
      })
    ).toBe("self_scoped");
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
