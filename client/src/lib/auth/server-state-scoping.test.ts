import { describe, expect, it } from "vitest";
import type { ServerRole, ServerSession } from "../../../../server/auth";
import { scopePlatformStateForSession } from "../../../../server/routes";
import { seedPlatformState } from "../domain/seed";

const sessionUsers: Record<ServerRole, { userId: string; email: string; name: string }> = {
  student: { userId: "usr_student_demo", email: "student.demo@nilelearn.local", name: "Student Demo" },
  teacher: { userId: "usr_teacher_demo", email: "teacher.demo@nilelearn.local", name: "Teacher Demo" },
  registrar: { userId: "usr_registrar_demo", email: "registrar.demo@nilelearn.local", name: "Registrar Demo" },
  headofdepartment: { userId: "usr_hod_demo", email: "hod.demo@nilelearn.local", name: "HOD Demo" },
  branchadmin: { userId: "usr_branch_demo", email: "branch.demo@nilelearn.local", name: "Branch Demo" },
  superadmin: { userId: "usr_admin_demo", email: "admin.demo@nilelearn.local", name: "Admin Demo" },
};

function sessionFor(role: ServerRole): ServerSession {
  const user = sessionUsers[role];
  return {
    id: `scope_${role}`,
    userId: user.userId,
    email: user.email,
    name: user.name,
    roles: [role],
    activeRole: role,
    provider: "demo",
    createdAt: "2026-07-04T00:00:00.000Z",
    expiresAt: "2026-07-04T12:00:00.000Z",
  };
}

function ids<T extends { id: string }>(items: T[]) {
  return items.map((item) => item.id).sort();
}

describe("server platform state read scopes", () => {
  it("returns only the student's own learning records and assigned teachers", () => {
    const scoped = scopePlatformStateForSession(seedPlatformState, sessionFor("student"));

    expect(ids(scoped.students)).toEqual(["stu_demo"]);
    expect(ids(scoped.users)).toEqual(["usr_student_demo", "usr_teacher_demo"]);
    expect(ids(scoped.courseRuns)).toEqual(["run_ar_l3_2026", "run_qt_1_2026"]);
    expect(ids(scoped.classGroups)).toEqual(["class_ar_l3_a", "class_qt_1_b"]);
    expect(ids(scoped.branches)).toEqual(["br_online"]);
    expect(scoped.staffProfiles).toEqual([]);
    expect(scoped.leads).toEqual([]);
    expect(scoped.applications).toEqual([]);
    expect(scoped.questionBankItems).toEqual([]);
    expect(scoped.attendance.every((item) => item.studentId === "stu_demo")).toBe(true);
    expect(scoped.invoices.every((item) => item.studentId === "stu_demo")).toBe(true);
    expect(scoped.auditLogs).toEqual([]);
  });

  it("returns only classes, students, and assessment work assigned to the teacher", () => {
    const scoped = scopePlatformStateForSession(seedPlatformState, sessionFor("teacher"));

    expect(ids(scoped.teachers)).toEqual(["tch_demo"]);
    expect(scoped.courseRuns.every((item) => item.teacherId === "usr_teacher_demo")).toBe(true);
    expect(ids(scoped.students)).toEqual(["stu_cairo_demo", "stu_demo"]);
    expect(scoped.users.every((item) => item.id === "usr_teacher_demo" || item.activeRole === "student")).toBe(true);
    expect(scoped.staffProfiles).toHaveLength(1);
    expect(scoped.staffProfiles[0]).toMatchObject({ userId: "usr_teacher_demo", role: "teacher" });
    expect(scoped.leads).toEqual([]);
    expect(scoped.applications).toEqual([]);
    expect(scoped.invoices).toEqual([]);
    expect(scoped.payments).toEqual([]);
    expect(scoped.questionBankItems.length).toBeGreaterThan(0);
    expect(scoped.questionBankItems.every((item) => scoped.courseRuns.some((run) => run.id === item.courseRunId))).toBe(true);
  });

  it("limits branch admins to their branch operations and payment records", () => {
    const scoped = scopePlatformStateForSession(seedPlatformState, sessionFor("branchadmin"));

    expect(ids(scoped.branches)).toEqual(["br_cairo"]);
    expect(scoped.courseRuns.every((item) => item.branchId === "br_cairo")).toBe(true);
    expect(scoped.rooms.every((item) => item.branchId === "br_cairo")).toBe(true);
    expect(ids(scoped.students)).toEqual(["stu_cairo_demo"]);
    expect(ids(scoped.invoices)).toEqual(["inv_cairo_demo_1"]);
    expect(scoped.payments).toEqual([]);
    expect(scoped.leads).toEqual([]);
    expect(scoped.applications).toEqual([]);
    expect(scoped.certificates).toEqual([]);
  });

  it("uses registrar branch plus department scope without exposing academic mutation data", () => {
    const scoped = scopePlatformStateForSession(seedPlatformState, sessionFor("registrar"));

    expect(ids(scoped.branches)).toEqual(["br_cairo", "br_online"]);
    expect(scoped.courseRuns.every((item) => ["br_cairo", "br_online"].includes(item.branchId))).toBe(true);
    expect(ids(scoped.students)).toEqual(["stu_cairo_demo", "stu_demo"]);
    expect(ids(scoped.applications)).toEqual(["app_demo_1"]);
    expect(ids(scoped.placementTests)).toEqual(["pt_demo_1"]);
    expect(scoped.attendance).toEqual([]);
    expect(scoped.assignments).toEqual([]);
    expect(scoped.quizzes).toEqual([]);
    expect(scoped.questionBankItems).toEqual([]);
    expect(scoped.certificates).toEqual([]);
  });

  it("limits HODs to department academic data and excludes finance/admissions queues", () => {
    const scoped = scopePlatformStateForSession(seedPlatformState, sessionFor("headofdepartment"));

    expect(ids(scoped.departments)).toEqual(["dep_arabic"]);
    expect(scoped.programs.every((item) => item.departmentId === "dep_arabic")).toBe(true);
    expect(ids(scoped.students)).toEqual(["stu_cairo_demo", "stu_demo"]);
    expect(scoped.courses.length).toBeGreaterThan(0);
    expect(scoped.certificates.length).toBeGreaterThan(0);
    expect(scoped.invoices).toEqual([]);
    expect(scoped.payments).toEqual([]);
    expect(scoped.leads).toEqual([]);
    expect(scoped.applications).toEqual([]);
    expect(scoped.placementTests).toEqual([]);
  });

  it("keeps super admin globally scoped while preserving own saved report views", () => {
    const scoped = scopePlatformStateForSession(seedPlatformState, sessionFor("superadmin"));

    expect(scoped.users).toHaveLength(seedPlatformState.users.length);
    expect(scoped.students).toHaveLength(seedPlatformState.students.length);
    expect(scoped.branches).toHaveLength(seedPlatformState.branches.length);
    expect(scoped.auditLogs).toHaveLength(seedPlatformState.auditLogs.length);
    expect(ids(scoped.reportPresets)).toEqual(["rptpreset_admin_finance"]);
  });
});
