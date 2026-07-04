import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ServerRole, ServerSession } from "../../../../server/auth";
import { applyPlatformWorkflowAction } from "../../../../server/platformState";

const originalLocalOnly = process.env.NILE_PLATFORM_STATE_LOCAL_ONLY;
const localStateFile = path.resolve(process.cwd(), ".local-data/platform-state.json");

const sessionUsers: Record<ServerRole, { userId: string; email: string; name: string }> = {
  student: { userId: "usr_student_demo", email: "student.demo@nilelearn.local", name: "Student Demo" },
  teacher: { userId: "usr_teacher_demo", email: "teacher.demo@nilelearn.local", name: "Teacher Demo" },
  registrar: { userId: "usr_registrar_demo", email: "registrar.demo@nilelearn.local", name: "Registrar Demo" },
  headofdepartment: { userId: "usr_hod_demo", email: "hod.demo@nilelearn.local", name: "HOD Demo" },
  branchadmin: { userId: "usr_branch_demo", email: "branch.demo@nilelearn.local", name: "Branch Demo" },
  superadmin: { userId: "usr_admin_demo", email: "admin.demo@nilelearn.local", name: "Admin Demo" },
};

function resetLocalPlatformState() {
  fs.rmSync(localStateFile, { force: true });
}

function sessionFor(role: ServerRole, override: Partial<ServerSession> = {}): ServerSession {
  const user = sessionUsers[role];
  return {
    id: `test_${role}`,
    userId: user.userId,
    email: user.email,
    name: user.name,
    roles: [role],
    activeRole: role,
    provider: "demo",
    createdAt: "2026-07-04T00:00:00.000Z",
    expiresAt: "2026-07-04T12:00:00.000Z",
    ...override,
  };
}

beforeEach(() => {
  process.env.NILE_PLATFORM_STATE_LOCAL_ONLY = "1";
  resetLocalPlatformState();
});

afterEach(() => {
  if (originalLocalOnly === undefined) {
    delete process.env.NILE_PLATFORM_STATE_LOCAL_ONLY;
  } else {
    process.env.NILE_PLATFORM_STATE_LOCAL_ONLY = originalLocalOnly;
  }
  resetLocalPlatformState();
});

describe("server platform action scope gates", () => {
  it("blocks unassigned teachers from class attendance actions", async () => {
    const spareTeacher = sessionFor("teacher", {
      userId: "usr_teacher_spare",
      email: "teacher.spare@nilelearn.local",
      name: "Teacher Spare",
    });

    await expect(
      applyPlatformWorkflowAction(
        {
          type: "attendance.save",
          classGroupId: "class_ar_l3_a",
          sessionId: "evt_ar_live",
          statuses: { stu_demo: "present" },
        },
        spareTeacher,
      ),
    ).rejects.toThrow("Teacher can only save attendance for assigned classes.");
  });

  it("blocks branch admins from mutating rooms and payments outside their branch", async () => {
    const branchSession = sessionFor("branchadmin");

    await expect(
      applyPlatformWorkflowAction(
        {
          type: "room.status.update",
          roomId: "room_online_a",
          status: "paused",
        },
        branchSession,
      ),
    ).rejects.toThrow("Branch admin can only update rooms in their branch.");

    await expect(
      applyPlatformWorkflowAction(
        {
          type: "payment.record",
          invoiceId: "inv_demo_1",
          amount: 100,
          method: "manual",
          reference: "outside-branch-test",
        },
        branchSession,
      ),
    ).rejects.toThrow("Branch admin can only record payments for their branch.");
  });

  it("blocks registrars from admissions actions outside configured branch scope", async () => {
    await expect(
      applyPlatformWorkflowAction(
        {
          type: "application.create",
          leadId: "lead_demo_1",
          branchId: "br_alex",
          courseInterest: "Arabic Language",
          schedulePreference: "Evening",
          status: "pending",
        },
        sessionFor("registrar"),
      ),
    ).rejects.toThrow("Registrar can only create applications inside admissions branches.");
  });

  it("blocks HOD finance report presets outside academic report scope", async () => {
    await expect(
      applyPlatformWorkflowAction(
        {
          type: "report.preset.save",
          role: "headofdepartment",
          label: "Finance leakage test",
          reportType: "finance",
          search: "",
          status: "all",
          rowCount: 0,
        },
        sessionFor("headofdepartment"),
      ),
    ).rejects.toThrow("Role headofdepartment cannot save finance report views.");
  });
});
