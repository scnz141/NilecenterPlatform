import { afterEach, describe, expect, it, vi } from "vitest";
import type { ServerSession } from "../../../../server/auth";
import type { PlatformRepository } from "../../../../server/platformRepository";
import { setPlatformStateRepository } from "../../../../server/platformRepository";
import { scopePlatformStateForSession } from "../../../../server/routes";
import {
  applyPlatformWorkflowAction,
  parsePlatformWorkflowAction,
} from "../../../../server/platformState";
import { seedPlatformState } from "../domain/seed";
import type { PlatformState } from "../domain/types";

function cloneState(state: PlatformState = seedPlatformState) {
  return JSON.parse(JSON.stringify(state)) as PlatformState;
}

function session(
  role: ServerSession["activeRole"],
  userId: string,
  email: string
): ServerSession {
  return {
    id: `roster_${role}`,
    userId,
    email,
    name: role,
    roles: [role],
    activeRole: role,
    provider: "demo",
    authorizationModel: "snapshot",
    createdAt: "2026-07-11T00:00:00.000Z",
    expiresAt: "2026-07-11T12:00:00.000Z",
  };
}

const registrar = () =>
  session("registrar", "usr_registrar_demo", "registrar.demo@nilelearn.local");
const branchAdmin = () =>
  session("branchadmin", "usr_branch_demo", "branch.demo@nilelearn.local");
const teacher = () =>
  session("teacher", "usr_teacher_demo", "teacher.demo@nilelearn.local");
const cairoStudent = () =>
  session(
    "student",
    "usr_student_cairo_demo",
    "cairo.student.demo@nilelearn.local"
  );

function repositoryFor(state: PlatformState): PlatformRepository {
  return {
    readSnapshot: vi.fn(async () => ({
      state,
      persistence: "local" as const,
      syncedAt: "2026-07-11T00:00:00.000Z",
    })),
    writeSnapshot: vi.fn(async () => "local" as const),
    recordEvent: vi.fn(async () => undefined),
  };
}

let restoreRepository: (() => void) | undefined;

afterEach(() => {
  restoreRepository?.();
  restoreRepository = undefined;
});

function install(state: PlatformState) {
  const repository = repositoryFor(state);
  restoreRepository = setPlatformStateRepository(repository);
  return repository;
}

function addTargetClass(state: PlatformState) {
  state.classGroups.push({
    id: "class_ar_l3_cairo_transfer_qa",
    courseRunId: "run_ar_l3_cairo_2026",
    name: "Cairo Transfer Class",
    capacity: 12,
    schedule: "Wed 18:00",
    roomId: "room_cairo_4",
    studentIds: [],
    status: "active",
  });
}

describe("server enrollment and roster authority", () => {
  it("persists a registrar-scoped transfer and projects it consistently", async () => {
    const state = cloneState();
    addTargetClass(state);
    const repository = install(state);
    const output = await applyPlatformWorkflowAction(
      {
        type: "enrollment.transfer",
        enrollmentId: "enr_ar_l3_cairo",
        classGroupId: "class_ar_l3_cairo_transfer_qa",
        reason: "Schedule moved",
      },
      registrar()
    );

    expect(repository.writeSnapshot).toHaveBeenCalledTimes(1);
    expect(repository.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "enrollment.transferred",
        entityType: "Enrollment",
        entityId: "enr_ar_l3_cairo",
        actorId: "usr_registrar_demo",
      })
    );
    const registrarState = scopePlatformStateForSession(
      output.state,
      registrar()
    );
    const teacherState = scopePlatformStateForSession(output.state, teacher());
    const studentState = scopePlatformStateForSession(
      output.state,
      cairoStudent()
    );
    for (const scoped of [registrarState, teacherState, studentState]) {
      expect(
        scoped.enrollments.find(item => item.id === "enr_ar_l3_cairo")
      ).toMatchObject({
        classGroupId: "class_ar_l3_cairo_transfer_qa",
        teacherId: "usr_teacher_demo",
      });
      expect(
        scoped.classGroups.find(
          item => item.id === "class_ar_l3_cairo_transfer_qa"
        )?.studentIds
      ).toContain("stu_cairo_demo");
    }
    expect(registrarState.auditLogs).toContainEqual(
      expect.objectContaining({
        action: "enrollment.transferred",
        entityId: "enr_ar_l3_cairo",
      })
    );
  });

  it("rejects registrar transfer when the source enrollment is outside branch scope", async () => {
    const state = cloneState();
    state.classGroups.push({
      id: "class_ar_l1_alex_transfer",
      courseRunId: "run_ar_l1_alex_2026",
      name: "Alex Transfer Class",
      capacity: 12,
      schedule: "Tue 18:00",
      roomId: "room_alex_2",
      studentIds: [],
      status: "active",
    });
    const before = cloneState(state);
    const repository = install(state);
    await expect(
      applyPlatformWorkflowAction(
        {
          type: "enrollment.transfer",
          enrollmentId: "enr_ar_l1_alex",
          classGroupId: "class_ar_l1_alex_transfer",
          reason: "Out of scope",
        },
        registrar()
      )
    ).rejects.toThrow(
      "Registrar can only manage enrollments inside admissions branches."
    );
    expect(state).toEqual(before);
    expect(repository.writeSnapshot).not.toHaveBeenCalled();
  });

  it("rejects an enrollment status update when another student enrollment is outside scope", async () => {
    const state = cloneState();
    state.enrollments.push({
      id: "enr_cairo_student_alex_sentinel",
      studentId: "stu_cairo_demo",
      courseRunId: "run_ar_l1_alex_2026",
      levelId: "lvl_ar_l1",
      classGroupId: "class_ar_l1_alex",
      teacherId: "usr_teacher_alex_demo",
      source: "direct",
      status: "active",
      progress: 0,
      attendanceRate: 0,
      currentGrade: 0,
    });
    state.classGroups = state.classGroups.map(group =>
      group.id === "class_ar_l1_alex"
        ? {
            ...group,
            studentIds: Array.from(
              new Set([...group.studentIds, "stu_cairo_demo"])
            ),
          }
        : group
    );
    const before = cloneState(state);
    const repository = install(state);

    await expect(
      applyPlatformWorkflowAction(
        {
          type: "enrollment.status.update",
          enrollmentId: "enr_ar_l3_cairo",
          status: "paused",
          reason: "Must not alter a cross-branch student account",
        },
        registrar()
      )
    ).rejects.toThrow(
      "Registrar cannot update an enrollment when the student has enrollments outside admissions branch scope."
    );
    expect(state).toEqual(before);
    expect(repository.writeSnapshot).not.toHaveBeenCalled();
    expect(repository.recordEvent).not.toHaveBeenCalled();
  });

  it("does not grant branch admins registrar enrollment mutations", async () => {
    const state = cloneState();
    addTargetClass(state);
    install(state);
    await expect(
      applyPlatformWorkflowAction(
        {
          type: "enrollment.transfer",
          enrollmentId: "enr_ar_l3_cairo",
          classGroupId: "class_ar_l3_cairo_transfer_qa",
          reason: "Unauthorized",
        },
        branchAdmin()
      )
    ).rejects.toThrow("Role branchadmin cannot run enrollment.transfer.");
  });

  it("uses the invoice enrollment link for branch payment scope", async () => {
    const state = cloneState();
    state.enrollments = [
      {
        id: "enr_multibranch_cairo_sentinel",
        studentId: "stu_demo",
        courseRunId: "run_ar_l3_cairo_2026",
        levelId: "lvl_ar_l3",
        classGroupId: "class_ar_l3_cairo",
        teacherId: "usr_teacher_demo",
        source: "direct",
        status: "active",
        progress: 0,
        attendanceRate: 0,
        currentGrade: 0,
      },
      ...state.enrollments,
    ];
    const repository = install(state);

    const scoped = scopePlatformStateForSession(state, branchAdmin());
    expect(scoped.students.map(item => item.id)).toContain("stu_demo");
    expect(scoped.invoices.map(item => item.id)).not.toContain("inv_demo_1");
    await expect(
      applyPlatformWorkflowAction(
        {
          type: "payment.record",
          invoiceId: "inv_demo_1",
          amount: 100,
          method: "manual",
          reference: "wrong-branch-sentinel",
        },
        branchAdmin()
      )
    ).rejects.toThrow(
      "Branch admin can only record payments for their branch."
    );
    expect(repository.writeSnapshot).not.toHaveBeenCalled();
  });

  it("projects the course-run teacher instead of a stale enrollment cache", () => {
    const state = cloneState();
    state.enrollments = state.enrollments.map(enrollment =>
      enrollment.id === "enr_ar_l3_cairo"
        ? { ...enrollment, teacherId: "usr_teacher_alex_demo" }
        : enrollment
    );

    for (const scoped of [
      scopePlatformStateForSession(state, registrar()),
      scopePlatformStateForSession(state, teacher()),
      scopePlatformStateForSession(state, cairoStudent()),
      scopePlatformStateForSession(
        state,
        session("superadmin", "usr_admin_demo", "admin.demo@nilelearn.local")
      ),
    ]) {
      expect(
        scoped.enrollments.find(item => item.id === "enr_ar_l3_cairo")
          ?.teacherId
      ).toBe("usr_teacher_demo");
    }
  });

  it("does not expose a roster orphan through the teacher snapshot", () => {
    const state = cloneState();
    state.classGroups = state.classGroups.map(group =>
      group.id === "class_ar_l3_cairo"
        ? {
            ...group,
            studentIds: group.studentIds.filter(
              studentId => studentId !== "stu_cairo_demo"
            ),
          }
        : group
    );

    const teacherState = scopePlatformStateForSession(state, teacher());
    const studentState = scopePlatformStateForSession(state, cairoStudent());

    expect(teacherState.students.map(item => item.id)).not.toContain(
      "stu_cairo_demo"
    );
    expect(teacherState.enrollments.map(item => item.id)).not.toContain(
      "enr_ar_l3_cairo"
    );
    expect(studentState.classGroups.map(item => item.id)).not.toContain(
      "class_ar_l3_cairo"
    );
  });

  it("parses exact transfer and status commands and rejects incomplete payloads", () => {
    expect(
      parsePlatformWorkflowAction({
        type: "enrollment.transfer",
        enrollmentId: "enr_ar_l3_cairo",
        classGroupId: "class_ar_l3_cairo_transfer_qa",
        reason: "Schedule moved",
      })
    ).toEqual({
      type: "enrollment.transfer",
      enrollmentId: "enr_ar_l3_cairo",
      classGroupId: "class_ar_l3_cairo_transfer_qa",
      reason: "Schedule moved",
    });
    expect(
      parsePlatformWorkflowAction({
        type: "enrollment.status.update",
        enrollmentId: "enr_ar_l3_cairo",
        status: "paused",
        reason: "Travel",
      })
    ).toEqual({
      type: "enrollment.status.update",
      enrollmentId: "enr_ar_l3_cairo",
      status: "paused",
      reason: "Travel",
    });
    expect(
      parsePlatformWorkflowAction({
        type: "enrollment.transfer",
        enrollmentId: "enr_ar_l3_cairo",
      })
    ).toBeNull();
    expect(
      parsePlatformWorkflowAction({
        type: "enrollment.status.update",
        enrollmentId: "enr_ar_l3_cairo",
        status: "paused",
      })
    ).toBeNull();
  });
});
