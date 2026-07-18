import { afterEach, describe, expect, it, vi } from "vitest";
import type { ServerSession } from "../../../../server/auth";
import type { PlatformRepository } from "../../../../server/platformRepository";
import { setPlatformStateRepository } from "../../../../server/platformRepository";
import {
  applyPlatformWorkflowAction,
  parsePlatformWorkflowAction,
} from "../../../../server/platformState";
import { scopePlatformStateForSession } from "../../../../server/routes";
import { seedPlatformState } from "../domain/seed";
import type { PlatformState } from "../domain/types";

function cloneState(state: PlatformState = seedPlatformState): PlatformState {
  return JSON.parse(JSON.stringify(state)) as PlatformState;
}

function registrarSession(): ServerSession {
  return {
    id: "class_delivery_authority_registrar",
    userId: "usr_registrar_demo",
    email: "registrar.demo@nilelearn.local",
    name: "Registrar Demo",
    roles: ["registrar"],
    activeRole: "registrar",
    provider: "demo",
    authorizationModel: "snapshot",
    createdAt: "2026-07-10T00:00:00.000Z",
    expiresAt: "2026-07-10T12:00:00.000Z",
  };
}

function branchAdminSession(): ServerSession {
  return {
    id: "class_delivery_authority_branch",
    userId: "usr_branch_demo",
    email: "branch.demo@nilelearn.local",
    name: "Branch Demo",
    roles: ["branchadmin"],
    activeRole: "branchadmin",
    provider: "demo",
    authorizationModel: "snapshot",
    createdAt: "2026-07-10T00:00:00.000Z",
    expiresAt: "2026-07-10T12:00:00.000Z",
  };
}

function hodSession(): ServerSession {
  return {
    id: "class_delivery_authority_hod",
    userId: "usr_hod_demo",
    email: "hod.demo@nilelearn.local",
    name: "HOD Demo",
    roles: ["headofdepartment"],
    activeRole: "headofdepartment",
    provider: "demo",
    authorizationModel: "snapshot",
    createdAt: "2026-07-10T00:00:00.000Z",
    expiresAt: "2026-07-10T12:00:00.000Z",
  };
}

function repositoryFor(state: PlatformState): PlatformRepository {
  return {
    readSnapshot: vi.fn(async () => ({
      state,
      persistence: "local" as const,
      syncedAt: "2026-07-10T00:00:00.000Z",
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

function installRepository(state: PlatformState) {
  const repository = repositoryFor(state);
  restoreRepository = setPlatformStateRepository(repository);
  return repository;
}

describe("server class-delivery authority", () => {
  it("creates a branch-scoped class and persists command evidence", async () => {
    const state = cloneState();
    const repository = installRepository(state);

    const output = await applyPlatformWorkflowAction(
      {
        type: "class.create",
        courseRunId: "run_ar_l3_cairo_2026",
        name: "Server authority evening class",
        capacity: 12,
        schedule: "Wed 17:00",
        roomId: "room_cairo_4",
      },
      branchAdminSession()
    );
    const created = output.state.classGroups.find(
      item => item.name === "Server authority evening class"
    );

    expect(created).toMatchObject({
      courseRunId: "run_ar_l3_cairo_2026",
      roomId: "room_cairo_4",
      capacity: 12,
      studentIds: [],
    });
    expect(repository.writeSnapshot).toHaveBeenCalledTimes(1);
    expect(repository.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "class.created",
        actorId: "usr_branch_demo",
        entityType: "ClassGroup",
        entityId: created?.id,
      })
    );
    const scoped = scopePlatformStateForSession(
      output.state,
      branchAdminSession()
    );
    expect(scoped.auditLogs).toContainEqual(
      expect.objectContaining({
        action: "class.created",
        entityType: "ClassGroup",
        entityId: created?.id,
        actorId: "usr_branch_demo",
      })
    );
  });

  it("rejects class creation outside branch-admin scope without persistence", async () => {
    const state = cloneState();
    const stateBeforeDenial = cloneState(state);
    const repository = installRepository(state);

    await expect(
      applyPlatformWorkflowAction(
        {
          type: "class.create",
          courseRunId: "run_ar_l1_alex_2026",
          name: "Out of scope class",
          capacity: 12,
          schedule: "Tue 12:00",
          roomId: "room_alex_2",
        },
        branchAdminSession()
      )
    ).rejects.toThrow(
      "Branch admin can only create classes in their branch."
    );

    expect(state).toEqual(stateBeforeDenial);
    expect(repository.writeSnapshot).not.toHaveBeenCalled();
    expect(repository.recordEvent).not.toHaveBeenCalled();
  });

  it("parses complete class creation commands only", () => {
    expect(
      parsePlatformWorkflowAction({
        type: "class.create",
        courseRunId: "run_ar_l3_cairo_2026",
        name: "Parsed class",
        capacity: 12,
        schedule: "Wed 17:00",
        roomId: "room_cairo_4",
      })
    ).toMatchObject({
      type: "class.create",
      courseRunId: "run_ar_l3_cairo_2026",
      roomId: "room_cairo_4",
    });
    expect(
      parsePlatformWorkflowAction({
        type: "class.create",
        courseRunId: "run_ar_l3_cairo_2026",
        name: "Missing room",
        capacity: 12,
        schedule: "Wed 17:00",
      })
    ).toBeNull();
  });

  it("creates an HOD department course run and persists audit evidence", async () => {
    const state = cloneState();
    const repository = installRepository(state);
    const output = await applyPlatformWorkflowAction(
      {
        type: "course-run.create",
        courseId: "course_ar_l3",
        branchId: "br_cairo",
        teacherId: "usr_teacher_demo",
        term: "Server Autumn 2026",
        startsOn: "2026-09-01",
        endsOn: "2026-11-30",
      },
      hodSession()
    );
    const run = output.state.courseRuns.find(item => item.term === "Server Autumn 2026");

    expect(run).toMatchObject({
      courseId: "course_ar_l3",
      branchId: "br_cairo",
      teacherId: "usr_teacher_demo",
      status: "pending",
    });
    expect(repository.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "course_run.created",
        actorId: "usr_hod_demo",
        entityType: "CourseRun",
        entityId: run?.id,
      })
    );
    const scoped = scopePlatformStateForSession(output.state, hodSession());
    expect(scoped.courseRuns.map(item => item.id)).toContain(run?.id);
    expect(scoped.auditLogs).toContainEqual(
      expect.objectContaining({
        action: "course_run.created",
        entityType: "CourseRun",
        entityId: run?.id,
        actorId: "usr_hod_demo",
      })
    );
  });

  it("allows branch class updates only inside the active branch scope", async () => {
    const state = cloneState();
    const repository = installRepository(state);
    const output = await applyPlatformWorkflowAction(
      {
        type: "class.update",
        classGroupId: "class_ar_l3_cairo",
        name: "Server Cairo class update",
        capacity: 18,
        schedule: "Wed 17:30",
        roomId: "room_cairo_4",
      },
      branchAdminSession()
    );
    expect(output.state.classGroups.find(item => item.id === "class_ar_l3_cairo")).toMatchObject({
      name: "Server Cairo class update",
      schedule: "Wed 17:30",
    });
    expect(repository.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "class.updated", actorId: "usr_branch_demo" })
    );

    await expect(
      applyPlatformWorkflowAction(
        {
          type: "class.status.update",
          classGroupId: "class_ar_l1_alex",
          status: "paused",
        },
        branchAdminSession()
      )
    ).rejects.toThrow("Branch admin can only update classes in their branch.");
  });

  it("parses course-run and class lifecycle commands only with exact targets", () => {
    expect(
      parsePlatformWorkflowAction({
        type: "course-run.create",
        courseId: "course_ar_l3",
        branchId: "br_cairo",
        teacherId: "usr_teacher_demo",
        term: "Parsed run",
        startsOn: "2026-09-01",
        endsOn: "2026-11-30",
      })
    ).toMatchObject({ type: "course-run.create", courseId: "course_ar_l3" });
    expect(
      parsePlatformWorkflowAction({
        type: "class.update",
        classGroupId: "class_ar_l3_cairo",
        name: "Parsed class",
        capacity: 12,
        schedule: "Wed 18:00",
        roomId: "room_cairo_4",
      })
    ).toMatchObject({ type: "class.update", classGroupId: "class_ar_l3_cairo" });
    expect(
      parsePlatformWorkflowAction({
        type: "class.status.update",
        classGroupId: "class_ar_l3_cairo",
        status: "paused",
      })
    ).toEqual({
      type: "class.status.update",
      classGroupId: "class_ar_l3_cairo",
      status: "paused",
    });
    expect(
      parsePlatformWorkflowAction({
        type: "course-run.create",
        courseId: "course_ar_l3",
        branchId: "br_cairo",
      })
    ).toBeNull();
  });

  it.each([
    {
      label: "both exact targets are omitted",
      action: {},
    },
    {
      label: "the exact class group is omitted",
      action: { courseRunId: "run_ar_l3_cairo_2026" },
    },
    {
      label: "the exact course run is omitted",
      action: { classGroupId: "class_ar_l3_cairo" },
    },
  ])(
    "rejects initial enrollment activation when $label",
    async ({ action }) => {
      const state = cloneState();
      const stateBeforeDenial = cloneState(state);
      const repository = installRepository(state);

      await expect(
        applyPlatformWorkflowAction(
          {
            type: "enrollment.activate",
            workflowId: "ew_demo_1",
            ...action,
          },
          registrarSession()
        )
      ).rejects.toThrow(
        "Enrollment activation requires an exact course run and class group."
      );

      expect(state).toEqual(stateBeforeDenial);
      expect(repository.writeSnapshot).not.toHaveBeenCalled();
      expect(repository.recordEvent).not.toHaveBeenCalled();
    }
  );

  it("rejects stored workflow targets when the initial activation request omits them", async () => {
    const state = cloneState();
    const workflow = state.enrollmentWorkflows.find(
      item => item.id === "ew_demo_1"
    );
    if (!workflow) throw new Error("Enrollment workflow fixture is required.");
    workflow.courseRunId = "run_ar_l3_cairo_2026";
    workflow.classGroupId = "class_ar_l3_cairo";
    const stateBeforeDenial = cloneState(state);
    const repository = installRepository(state);

    await expect(
      applyPlatformWorkflowAction(
        { type: "enrollment.activate", workflowId: workflow.id },
        registrarSession()
      )
    ).rejects.toThrow(
      "Enrollment activation requires an exact course run and class group."
    );

    expect(state).toEqual(stateBeforeDenial);
    expect(repository.writeSnapshot).not.toHaveBeenCalled();
    expect(repository.recordEvent).not.toHaveBeenCalled();
  });

  it("authorizes and persists the exact course run and class group selected by the registrar", async () => {
    const state = cloneState();
    const repository = installRepository(state);

    const output = await applyPlatformWorkflowAction(
      {
        type: "enrollment.activate",
        workflowId: "ew_demo_1",
        courseRunId: "run_ar_l3_cairo_2026",
        classGroupId: "class_ar_l3_cairo",
      },
      registrarSession()
    );

    const workflow = output.state.enrollmentWorkflows.find(
      item => item.id === "ew_demo_1"
    );
    expect(workflow).toMatchObject({
      courseRunId: "run_ar_l3_cairo_2026",
      classGroupId: "class_ar_l3_cairo",
      status: "active",
    });
    expect(
      output.state.enrollments.find(
        item => item.studentId === workflow?.studentId
      )
    ).toMatchObject({
      courseRunId: "run_ar_l3_cairo_2026",
      classGroupId: "class_ar_l3_cairo",
      teacherId: "usr_teacher_demo",
      status: "active",
    });
    expect(repository.writeSnapshot).toHaveBeenCalledTimes(1);
    expect(repository.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "enrollment.activated",
        actorId: "usr_registrar_demo",
        payload: expect.objectContaining({
          request: expect.objectContaining({
            courseRunId: "run_ar_l3_cairo_2026",
            classGroupId: "class_ar_l3_cairo",
          }),
        }),
      })
    );
  });

  it("rejects an exact enrollment target outside the registrar branch scope", async () => {
    const state = cloneState();
    state.courseRuns.push({
      id: "run_ar_l3_alex_authority",
      courseId: "course_ar_l3",
      branchId: "br_alex",
      teacherId: "usr_teacher_alex_demo",
      term: "Authority test",
      startsOn: "2026-06-01",
      endsOn: "2026-08-31",
      status: "active",
    });
    state.classGroups.push({
      id: "class_ar_l3_alex_authority",
      courseRunId: "run_ar_l3_alex_authority",
      name: "Arabic L3 Alexandria Authority",
      capacity: 12,
      schedule: "Sun/Tue 09:00",
      studentIds: [],
      status: "active",
    });
    const stateBeforeDenial = cloneState(state);
    const repository = installRepository(state);

    await expect(
      applyPlatformWorkflowAction(
        {
          type: "enrollment.activate",
          workflowId: "ew_demo_1",
          courseRunId: "run_ar_l3_alex_authority",
          classGroupId: "class_ar_l3_alex_authority",
        },
        registrarSession()
      )
    ).rejects.toThrow(
      "Registrar can only activate enrollments inside admissions branches."
    );

    expect(state).toEqual(stateBeforeDenial);
    expect(repository.writeSnapshot).not.toHaveBeenCalled();
    expect(repository.recordEvent).not.toHaveBeenCalled();
  });

  it("rejects a global student status update when any enrollment is outside registrar scope", async () => {
    const state = cloneState();
    const existingEnrollment = state.enrollments.find(
      item => item.studentId === "stu_demo"
    );
    if (!existingEnrollment) {
      throw new Error("Student enrollment fixture is required.");
    }
    state.enrollments.push({
      ...existingEnrollment,
      id: "enr_stu_demo_alex_authority",
      courseRunId: "run_ar_l1_alex_2026",
      classGroupId: "class_ar_l1_alex",
      teacherId: "usr_teacher_alex_demo",
    });
    const stateBeforeDenial = cloneState(state);
    const repository = installRepository(state);

    await expect(
      applyPlatformWorkflowAction(
        {
          type: "student.status.update",
          studentId: "stu_demo",
          status: "paused",
          notes: "Must not cross branch authority.",
        },
        registrarSession()
      )
    ).rejects.toThrow(
      "Registrar cannot update a student whose enrollments extend outside admissions branch scope."
    );

    expect(state).toEqual(stateBeforeDenial);
    expect(repository.writeSnapshot).not.toHaveBeenCalled();
    expect(repository.recordEvent).not.toHaveBeenCalled();
  });

  it("allows a student status update when every enrollment is inside registrar scope", async () => {
    const state = cloneState();
    const repository = installRepository(state);

    const output = await applyPlatformWorkflowAction(
      {
        type: "student.status.update",
        studentId: "stu_demo",
        status: "paused",
        notes: "Same-scope authority test.",
      },
      registrarSession()
    );

    expect(
      output.state.students.find(item => item.id === "stu_demo")
    ).toMatchObject({ status: "paused" });
    expect(
      output.state.users.find(item => item.id === "usr_student_demo")
    ).toMatchObject({ status: "paused" });
    expect(
      output.state.enrollments.filter(item => item.studentId === "stu_demo")
    ).toEqual(
      expect.arrayContaining([expect.objectContaining({ status: "paused" })])
    );
    expect(repository.writeSnapshot).toHaveBeenCalledTimes(1);
    expect(repository.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "student.status_updated",
        actorId: "usr_registrar_demo",
      })
    );
  });

  it("preserves teaching levels while parsing teacher assignment commands", () => {
    expect(
      parsePlatformWorkflowAction({
        type: "teacher.assign",
        userId: "usr_teacher_demo",
        courseRunId: "run_ar_l3_2026",
        specialties: ["Arabic grammar", "Tajweed"],
        teachingLevels: ["Arabic Level 3", "Tajweed 1"],
        availability: ["Monday 09:00", "Wednesday 09:00"],
      })
    ).toMatchObject({
      type: "teacher.assign",
      userId: "usr_teacher_demo",
      courseRunId: "run_ar_l3_2026",
      teachingLevels: ["Arabic Level 3", "Tajweed 1"],
    });
  });
});
