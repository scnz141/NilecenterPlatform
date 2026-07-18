import { describe, expect, it } from "vitest";
import {
  applyPlatformWorkflowAction,
  type PlatformWorkflowAction,
} from "./actions";
import { seedPlatformState } from "./seed";
import type { PlatformState } from "./types";

function cloneState() {
  return JSON.parse(JSON.stringify(seedPlatformState)) as PlatformState;
}

function createContext() {
  let sequence = 0;
  return {
    createId: (prefix: string) => `${prefix}_delivery_integrity_${++sequence}`,
    now: () => "2026-07-10T12:00:00.000Z",
  };
}

function applyAction(state: PlatformState, action: PlatformWorkflowAction) {
  return applyPlatformWorkflowAction(state, action, createContext());
}

function expectRejectedWithoutMutation(
  state: PlatformState,
  action: PlatformWorkflowAction,
  message: string
) {
  const before = JSON.stringify(state);
  expect(() => applyAction(state, action)).toThrow(message);
  expect(JSON.stringify(state)).toBe(before);
}

const exactActivationAction: PlatformWorkflowAction = {
  type: "enrollment.activate",
  workflowId: "ew_demo_1",
  courseRunId: "run_ar_l3_2026",
  classGroupId: "class_ar_l3_a",
  actorId: "usr_registrar_demo",
};

describe("class delivery integrity", () => {
  it("creates an empty class in an exact active run and assigns it to the run teacher", () => {
    const state = cloneState();
    const result = applyAction(state, {
      type: "class.create",
      courseRunId: "run_ar_l3_cairo_2026",
      name: "Arabic L3 Cairo Evening",
      capacity: 12,
      schedule: "Wed 17:00",
      roomId: "room_cairo_4",
      actorId: "usr_branch_demo",
    }).result as {
      classGroup: PlatformState["classGroups"][number];
    };

    expect(result.classGroup).toMatchObject({
      courseRunId: "run_ar_l3_cairo_2026",
      name: "Arabic L3 Cairo Evening",
      capacity: 12,
      schedule: "Wed 17:00",
      roomId: "room_cairo_4",
      studentIds: [],
    });
    expect(
      state.teachers.find(item => item.userId === "usr_teacher_demo")
        ?.assignedClassIds
    ).toContain(result.classGroup.id);
    expect(state.auditLogs[0]).toMatchObject({
      action: "class.created",
      entityType: "ClassGroup",
      entityId: result.classGroup.id,
      actorId: "usr_branch_demo",
    });
  });

  it.each([
    {
      label: "cross-branch room",
      roomId: "room_online_a",
      capacity: 12,
      schedule: "Wed 17:00",
      message: "Class room must belong to the course run branch.",
    },
    {
      label: "room capacity",
      roomId: "room_cairo_4",
      capacity: 21,
      schedule: "Wed 17:00",
      message: "Class capacity cannot exceed room capacity.",
    },
    {
      label: "room schedule conflict",
      roomId: "room_cairo_4",
      capacity: 12,
      schedule: "Sun/Tue 14:00",
      message: "Cairo Room 4 is already assigned at Sun/Tue 14:00.",
    },
  ])(
    "rejects class creation with $label before mutation",
    ({ roomId, capacity, schedule, message }) => {
      const state = cloneState();
      expectRejectedWithoutMutation(
        state,
        {
          type: "class.create",
          courseRunId: "run_ar_l3_cairo_2026",
          name: "Rejected Cairo class",
          capacity,
          schedule,
          roomId,
          actorId: "usr_branch_demo",
        },
        message
      );
    }
  );

  it("creates an exact pending course run with teacher and audit evidence", () => {
    const state = cloneState();
    const result = applyAction(state, {
      type: "course-run.create",
      courseId: "course_ar_l3",
      branchId: "br_cairo",
      teacherId: "usr_teacher_demo",
      term: "Autumn 2026 Cairo",
      startsOn: "2026-09-01",
      endsOn: "2026-11-30",
      actorId: "usr_hod_demo",
    }).result as { courseRun: PlatformState["courseRuns"][number] };

    expect(result.courseRun).toMatchObject({
      courseId: "course_ar_l3",
      branchId: "br_cairo",
      teacherId: "usr_teacher_demo",
      term: "Autumn 2026 Cairo",
      status: "pending",
    });
    expect(state.auditLogs[0]).toMatchObject({
      action: "course_run.created",
      entityType: "CourseRun",
      entityId: result.courseRun.id,
      actorId: "usr_hod_demo",
    });
  });

  it.each([
    {
      label: "reversed dates",
      mutate: () => undefined,
      startsOn: "2026-12-01",
      endsOn: "2026-09-01",
      teacherId: "usr_teacher_demo",
      message: "Course run dates must be valid",
    },
    {
      label: "teacher outside branch",
      mutate: () => undefined,
      startsOn: "2026-09-01",
      endsOn: "2026-12-01",
      teacherId: "usr_teacher_alex_demo",
      message: "Choose an active teacher scoped to the course run branch.",
    },
    {
      label: "duplicate term",
      mutate: (state: PlatformState) => {
        state.courseRuns.push({
          id: "run_duplicate_term",
          courseId: "course_ar_l3",
          branchId: "br_cairo",
          teacherId: "usr_teacher_demo",
          term: "Autumn 2026 Cairo",
          startsOn: "2026-09-01",
          endsOn: "2026-12-01",
          status: "pending",
        });
      },
      startsOn: "2026-09-01",
      endsOn: "2026-12-01",
      teacherId: "usr_teacher_demo",
      message: "Autumn 2026 Cairo already exists",
    },
  ])("rejects course-run creation with $label before mutation", input => {
    const state = cloneState();
    input.mutate(state);
    expectRejectedWithoutMutation(
      state,
      {
        type: "course-run.create",
        courseId: "course_ar_l3",
        branchId: "br_cairo",
        teacherId: input.teacherId,
        term: "Autumn 2026 Cairo",
        startsOn: input.startsOn,
        endsOn: input.endsOn,
        actorId: "usr_hod_demo",
      },
      input.message
    );
  });

  it("updates an active class without changing its roster or run", () => {
    const state = cloneState();
    const beforeRoster = [...state.classGroups.find(item => item.id === "class_ar_l3_cairo")!.studentIds];
    const result = applyAction(state, {
      type: "class.update",
      classGroupId: "class_ar_l3_cairo",
      name: "Arabic L3 Cairo Updated",
      capacity: 18,
      schedule: "Wed 17:30",
      roomId: "room_cairo_4",
      actorId: "usr_branch_demo",
    }).result as { classGroup: PlatformState["classGroups"][number] };

    expect(result.classGroup).toMatchObject({
      id: "class_ar_l3_cairo",
      courseRunId: "run_ar_l3_cairo_2026",
      name: "Arabic L3 Cairo Updated",
      capacity: 18,
      schedule: "Wed 17:30",
      status: "active",
    });
    expect(result.classGroup.studentIds).toEqual(beforeRoster);
    expect(state.auditLogs[0]).toMatchObject({
      action: "class.updated",
      entityId: "class_ar_l3_cairo",
      actorId: "usr_branch_demo",
    });
  });

  it("pauses a class and blocks attendance until it is active again", () => {
    const state = cloneState();
    applyAction(state, {
      type: "class.status.update",
      classGroupId: "class_ar_l3_a",
      status: "paused",
      actorId: "usr_branch_demo",
    });
    expect(state.classGroups.find(item => item.id === "class_ar_l3_a")?.status).toBe("paused");
    expect(state.auditLogs[0]).toMatchObject({
      action: "class.status_updated",
      entityId: "class_ar_l3_a",
    });
    expectRejectedWithoutMutation(
      state,
      {
        type: "attendance.save",
        classGroupId: "class_ar_l3_a",
        sessionId: "session_ar_live",
        statuses: { stu_demo: "present" },
        actorId: "usr_teacher_demo",
      },
      "Attendance can only be saved for an active class."
    );
  });

  it("rejects destructive class transitions while active delivery records remain", () => {
    const state = cloneState();
    expectRejectedWithoutMutation(
      state,
      {
        type: "class.status.update",
        classGroupId: "class_ar_l3_a",
        status: "cancelled",
        actorId: "usr_branch_demo",
      },
      "A class with active enrollments cannot be cancelled."
    );
    expectRejectedWithoutMutation(
      state,
      {
        type: "class.status.update",
        classGroupId: "class_ar_l3_a",
        status: "completed",
        actorId: "usr_branch_demo",
      },
      "Complete all class sessions before completing the class."
    );
  });

  it("requires exact run and class targets for an initial enrollment activation without mutation", () => {
    const state = cloneState();

    expectRejectedWithoutMutation(
      state,
      {
        type: "enrollment.activate",
        workflowId: "ew_demo_1",
        actorId: "usr_registrar_demo",
      },
      "Enrollment activation requires an exact course run and class group."
    );
  });

  it("activates an enrollment against the explicitly selected run and class", () => {
    const state = cloneState();
    const before = {
      users: state.users.length,
      students: state.students.length,
      enrollments: state.enrollments.length,
      invoices: state.invoices.length,
    };

    const result = applyAction(state, exactActivationAction)
      .result as PlatformState["students"][number];
    const workflow = state.enrollmentWorkflows.find(
      item => item.id === "ew_demo_1"
    );
    const enrollment = state.enrollments.find(
      item => item.studentId === result.id
    );
    const classGroup = state.classGroups.find(
      item => item.id === "class_ar_l3_a"
    );

    expect(state.users).toHaveLength(before.users + 1);
    expect(state.students).toHaveLength(before.students + 1);
    expect(state.enrollments).toHaveLength(before.enrollments + 1);
    expect(state.invoices).toHaveLength(before.invoices + 1);
    expect(result.status).toBe("active");
    expect(workflow).toMatchObject({
      studentId: result.id,
      courseRunId: "run_ar_l3_2026",
      classGroupId: "class_ar_l3_a",
      status: "active",
    });
    expect(enrollment).toMatchObject({
      studentId: result.id,
      courseRunId: "run_ar_l3_2026",
      classGroupId: "class_ar_l3_a",
      teacherId: "usr_teacher_demo",
      status: "active",
    });
    expect(classGroup?.studentIds).toContain(result.id);
    expect(
      state.auditLogs.some(
        item =>
          item.action === "enrollment.activated" &&
          item.entityId === "ew_demo_1"
      )
    ).toBe(true);
  });

  it.each([
    {
      label: "course run",
      mutate: (state: PlatformState) => {
        state.courseRuns.find(item => item.id === "run_ar_l3_2026")!.status =
          "paused";
      },
      message: "Course run run_ar_l3_2026 must be active",
    },
    {
      label: "course",
      mutate: (state: PlatformState) => {
        state.courses.find(item => item.id === "course_ar_l3")!.status =
          "paused";
      },
      message: "Course course_ar_l3 must be active",
    },
    {
      label: "branch",
      mutate: (state: PlatformState) => {
        state.branches.find(item => item.id === "br_online")!.status = "paused";
      },
      message: "Branch br_online must be active",
    },
    {
      label: "teacher profile",
      mutate: (state: PlatformState) => {
        state.teachers.find(
          item => item.userId === "usr_teacher_demo"
        )!.status = "paused";
      },
      message: "requires an active, branch-scoped teacher",
    },
    {
      label: "teacher staff profile",
      mutate: (state: PlatformState) => {
        state.staffProfiles.find(
          item => item.userId === "usr_teacher_demo" && item.role === "teacher"
        )!.status = "paused";
      },
      message: "requires an active, branch-scoped teacher",
    },
  ])(
    "rejects enrollment activation when the delivery $label is inactive",
    ({ mutate, message }) => {
      const state = cloneState();
      mutate(state);

      expectRejectedWithoutMutation(state, exactActivationAction, message);
    }
  );

  it.each(["pending", "cancelled"] as const)(
    "rejects attendance for a %s class session without mutation",
    status => {
      const state = cloneState();
      state.classSessions.find(item => item.id === "session_ar_live")!.status =
        status;

      expectRejectedWithoutMutation(
        state,
        {
          type: "attendance.save",
          classGroupId: "class_ar_l3_a",
          sessionId: "session_ar_live",
          statuses: { stu_demo: "present" },
          actorId: "usr_teacher_demo",
        },
        "Attendance can only be saved for active or completed sessions."
      );
    }
  );

  it.each([
    {
      label: "missing paired calendar event",
      mutate: (state: PlatformState) => {
        state.events = state.events.filter(item => item.id !== "evt_ar_live");
      },
      message: "is missing its calendar event",
    },
    {
      label: "cancelled paired calendar event",
      mutate: (state: PlatformState) => {
        state.events.find(item => item.id === "evt_ar_live")!.status =
          "cancelled";
      },
      message: "paired calendar event is active or completed",
    },
    {
      label: "session outside the course run",
      mutate: (state: PlatformState) => {
        const session = state.classSessions.find(
          item => item.id === "session_ar_live"
        )!;
        const event = state.events.find(item => item.id === "evt_ar_live")!;
        session.startsAt = event.startsAt = "2026-09-01T09:00:00+03:00";
        session.endsAt = event.endsAt = "2026-09-01T10:30:00+03:00";
      },
      message: "must stay inside the course run date range",
    },
    {
      label: "inactive selected room",
      mutate: (state: PlatformState) => {
        state.events.find(item => item.id === "evt_ar_live")!.roomId =
          "room_online_a";
        state.rooms.find(item => item.id === "room_online_a")!.status =
          "paused";
      },
      message: "Attendance requires an active room.",
    },
    {
      label: "undersized selected room",
      mutate: (state: PlatformState) => {
        state.events.find(item => item.id === "evt_ar_live")!.roomId =
          "room_online_a";
        state.rooms.find(item => item.id === "room_online_a")!.capacity = 15;
      },
      message: "Attendance room capacity is smaller than the class capacity.",
    },
  ])(
    "rejects attendance with $label without mutation",
    ({ mutate, message }) => {
      const state = cloneState();
      mutate(state);

      expectRejectedWithoutMutation(
        state,
        {
          type: "attendance.save",
          classGroupId: "class_ar_l3_a",
          sessionId: "session_ar_live",
          statuses: { stu_demo: "present" },
          actorId: "usr_teacher_demo",
        },
        message
      );
    }
  );

  it.each([
    {
      label: "outside the course run dates",
      mutate: (_state: PlatformState) => undefined,
      startsAt: "2026-09-07T09:00:00+03:00",
      endsAt: "2026-09-07T10:30:00+03:00",
      message: "Class sessions must stay inside the course run date range.",
    },
    {
      label: "with an inactive room",
      mutate: (state: PlatformState) => {
        state.rooms.find(item => item.id === "room_online_a")!.status =
          "paused";
      },
      startsAt: "2026-07-13T09:00:00+03:00",
      endsAt: "2026-07-13T10:30:00+03:00",
      message: "Calendar events require an active room.",
    },
    {
      label: "with an undersized room",
      mutate: (state: PlatformState) => {
        state.rooms.find(item => item.id === "room_online_a")!.capacity = 15;
      },
      startsAt: "2026-07-13T09:00:00+03:00",
      endsAt: "2026-07-13T10:30:00+03:00",
      message: "Calendar room capacity is smaller than the class capacity.",
    },
  ])(
    "rejects a class session $label without creating calendar or session rows",
    ({ mutate, startsAt, endsAt, message }) => {
      const state = cloneState();
      mutate(state);

      expectRejectedWithoutMutation(
        state,
        {
          type: "calendar.create",
          title: "Integrity test class",
          eventType: "class_session",
          startsAt,
          endsAt,
          ownerId: "usr_teacher_demo",
          branchId: "br_online",
          roomId: "room_online_a",
          classGroupId: "class_ar_l3_a",
          actorId: "usr_teacher_demo",
        },
        message
      );
    }
  );

  it.each([
    {
      label: "assignment",
      action: {
        type: "assignment.create",
        courseRunId: "run_ar_l3_2026",
        title: "Inactive run assignment",
        dueAt: "2026-07-20T18:00:00+03:00",
        submissionType: "text",
        rubric: ["Accuracy"],
        actorId: "usr_teacher_demo",
      } satisfies PlatformWorkflowAction,
    },
    {
      label: "quiz",
      action: {
        type: "quiz.create",
        courseRunId: "run_ar_l3_2026",
        title: "Inactive run quiz",
        dueAt: "2026-07-20T18:00:00+03:00",
        durationMinutes: 20,
        questionTypes: ["short_answer"],
        attemptsAllowed: 1,
        actorId: "usr_teacher_demo",
      } satisfies PlatformWorkflowAction,
    },
  ])(
    "rejects $label creation for an inactive delivery run without mutation",
    ({ action }) => {
      const state = cloneState();
      state.courseRuns.find(item => item.id === "run_ar_l3_2026")!.status =
        "paused";

      expectRejectedWithoutMutation(
        state,
        action,
        "Course run run_ar_l3_2026 must be active for assessment creation."
      );
    }
  );
});
