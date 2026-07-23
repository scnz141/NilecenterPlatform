import { afterEach, describe, expect, it, vi } from "vitest";
import type { ServerRole, ServerSession } from "../../../../server/auth";
import type { PlatformRepository } from "../../../../server/platformRepository";
import { setPlatformStateRepository } from "../../../../server/platformRepository";
import {
  applyPlatformWorkflowAction,
  parsePlatformWorkflowAction,
} from "../../../../server/platformState";
import { scopePlatformStateForSession } from "../../../../server/routes";
import type { PlatformWorkflowAction } from "../domain/actions";
import { seedPlatformState } from "../domain/seed";
import type { PlatformState } from "../domain/types";
import type { Permission } from "../platformData";

const sessionUsers: Record<
  ServerRole,
  { userId: string; email: string; name: string }
> = {
  student: {
    userId: "usr_student_demo",
    email: "student.demo@nilelearn.local",
    name: "Student Demo",
  },
  teacher: {
    userId: "usr_teacher_demo",
    email: "teacher.demo@nilelearn.local",
    name: "Teacher Demo",
  },
  registrar: {
    userId: "usr_registrar_demo",
    email: "registrar.demo@nilelearn.local",
    name: "Registrar Demo",
  },
  headofdepartment: {
    userId: "usr_hod_demo",
    email: "hod.demo@nilelearn.local",
    name: "HOD Demo",
  },
  branchadmin: {
    userId: "usr_branch_demo",
    email: "branch.demo@nilelearn.local",
    name: "Branch Demo",
  },
  superadmin: {
    userId: "usr_admin_demo",
    email: "admin.demo@nilelearn.local",
    name: "Admin Demo",
  },
};

function cloneState(state: PlatformState = seedPlatformState): PlatformState {
  return JSON.parse(JSON.stringify(state)) as PlatformState;
}

function sessionFor(
  role: ServerRole,
  override: Partial<ServerSession> = {}
): ServerSession {
  const user = sessionUsers[role];
  return {
    id: `authority_${role}`,
    userId: user.userId,
    email: user.email,
    name: user.name,
    roles: [role],
    activeRole: role,
    provider: "demo",
    authorizationModel: "snapshot",
    createdAt: "2026-07-10T00:00:00.000Z",
    expiresAt: "2026-07-10T12:00:00.000Z",
    ...override,
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
  vi.useRealTimers();
});

function installRepository(state: PlatformState) {
  const repository = repositoryFor(state);
  restoreRepository = setPlatformStateRepository(repository);
  return repository;
}

type PermissionCase = {
  label: string;
  role: ServerRole;
  permission: Permission;
  action: PlatformWorkflowAction;
};

const permissionCases: PermissionCase[] = [
  {
    label: "assessment authoring",
    role: "teacher",
    permission: "assessments:write",
    action: {
      type: "assignment.create",
      courseRunId: "run_ar_l3_2026",
      title: "Authority test assignment",
      dueAt: "2026-07-20T12:00:00.000Z",
      submissionType: "text",
      rubric: ["Complete response"],
      actorId: "usr_admin_demo",
    },
  },
  {
    label: "academic course governance",
    role: "headofdepartment",
    permission: "courses:write",
    action: {
      type: "course.status.update",
      courseId: "course_ar_l3",
      status: "paused",
      actorId: "usr_admin_demo",
    },
  },
  {
    label: "course material publishing",
    role: "teacher",
    permission: "courses:write",
    action: {
      type: "material.publish.update",
      id: "res_ar_pdf",
      published: false,
      actorId: "usr_admin_demo",
    },
  },
  {
    label: "certificate governance",
    role: "headofdepartment",
    permission: "certificates:approve",
    action: {
      type: "certificate.approve",
      certificateId: "cert_ar_2",
      actorId: "usr_admin_demo",
    },
  },
  {
    label: "admissions",
    role: "registrar",
    permission: "students:write",
    action: {
      type: "lead.create",
      fullName: "Authority Test Learner",
      email: "authority.learner@nilelearn.local",
      phone: "+20 100 000 0000",
      subject: "Arabic Language",
      notes: "Permission authority test",
      source: "manual",
      actorId: "usr_admin_demo",
    },
  },
  {
    label: "room operations",
    role: "branchadmin",
    permission: "rooms:write",
    action: {
      type: "room.status.update",
      roomId: "room_cairo_4",
      status: "paused",
      actorId: "usr_admin_demo",
    },
  },
  {
    label: "scheduling",
    role: "teacher",
    permission: "schedule:write",
    action: {
      type: "calendar.create",
      title: "Authority test reminder",
      eventType: "reminder",
      startsAt: "2031-07-20T09:00:00.000Z",
      endsAt: "2031-07-20T09:30:00.000Z",
      ownerId: "usr_admin_demo",
      branchId: "br_online",
      actorId: "usr_admin_demo",
    },
  },
  {
    label: "attendance",
    role: "teacher",
    permission: "attendance:write",
    action: {
      type: "attendance.save",
      classGroupId: "class_ar_l3_a",
      sessionId: "session_ar_live",
      statuses: { stu_demo: "present" },
      notes: { stu_demo: "Authority test" },
      actorId: "usr_admin_demo",
    },
  },
  {
    label: "payments",
    role: "registrar",
    permission: "payments:write",
    action: {
      type: "payment.record",
      invoiceId: "inv_cairo_demo_1",
      amount: 100,
      method: "cash",
      reference: "AUTHORITY-TEST",
      actorId: "usr_admin_demo",
    },
  },
  {
    label: "messaging",
    role: "teacher",
    permission: "messages:write",
    action: {
      type: "message.send",
      fromUserId: "usr_admin_demo",
      toUserId: "usr_student_demo",
      subject: "Authority test message",
      body: "This message verifies permission and actor authority.",
      actorId: "usr_admin_demo",
    },
  },
  {
    label: "Quran progress review",
    role: "teacher",
    permission: "assessments:write",
    action: {
      type: "quran.progress.update",
      recordId: "qr_demo",
      memorizedPercent: 78,
      tajweedScore: 91,
      notes: "Authority permission test",
      actorId: "usr_admin_demo",
    },
  },
  {
    label: "recitation review",
    role: "teacher",
    permission: "assessments:write",
    action: {
      type: "recitation.review",
      submissionId: "rec_demo",
      feedback: "Authority permission test feedback",
      actorId: "usr_admin_demo",
    },
  },
  {
    label: "report presets",
    role: "teacher",
    permission: "reports:read",
    action: {
      type: "report.preset.save",
      role: "teacher",
      label: "Authority attendance view",
      reportType: "attendance",
      rowCount: 1,
      actorId: "usr_admin_demo",
    },
  },
  {
    label: "platform settings",
    role: "superadmin",
    permission: "settings:write",
    action: {
      type: "settings.save",
      organization: "Nile Learn Authority Test",
      defaultLanguage: "English",
      academicTerm: "Authority Test Term",
      retentionDays: 365,
      actorId: "usr_teacher_demo",
    },
  },
  {
    label: "access settings",
    role: "superadmin",
    permission: "settings:write",
    action: {
      type: "permission.update",
      role: "teacher",
      permission: "attendance:write",
      granted: false,
      actorId: "usr_teacher_demo",
    },
  },
];

describe("server academic workflow authority", () => {
  it.each(permissionCases)(
    "denies revoked $label permission and allows it after restoration",
    async ({ role, permission, action }) => {
      const state = cloneState();
      state.permissions[role] = state.permissions[role].filter(
        item => item !== permission
      );
      const stateBeforeDenial = cloneState(state);
      const repository = repositoryFor(state);
      restoreRepository = setPlatformStateRepository(repository);
      const session = sessionFor(role);

      await expect(
        applyPlatformWorkflowAction(action, session)
      ).rejects.toThrow(`Role ${role} lacks ${permission} for ${action.type}.`);

      expect(state).toEqual(stateBeforeDenial);
      expect(repository.writeSnapshot).not.toHaveBeenCalled();
      expect(repository.recordEvent).not.toHaveBeenCalled();

      state.permissions[role] = [...state.permissions[role], permission];
      const auditCount = state.auditLogs.length;
      const result = await applyPlatformWorkflowAction(action, session);

      expect(repository.writeSnapshot).toHaveBeenCalledTimes(1);
      expect(repository.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: session.userId,
          payload: expect.objectContaining({
            request: expect.objectContaining({
              actorId: session.userId,
            }),
          }),
        })
      );
      if (action.type === "message.send") {
        expect(repository.recordEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            payload: expect.objectContaining({
              redacted: true,
              request: {
                type: "message.send",
                actorId: session.userId,
              },
            }),
          })
        );
        expect(
          JSON.stringify(vi.mocked(repository.recordEvent).mock.calls)
        ).not.toContain(action.body);
      }
      if (action.type === "calendar.create") {
        expect(repository.recordEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            payload: expect.objectContaining({
              request: expect.objectContaining({
                ownerId: session.userId,
              }),
            }),
          })
        );
      }
      expect(result.state.auditLogs).toHaveLength(auditCount + 1);
      expect(result.state.auditLogs[0]?.actorId).toBe(session.userId);
    }
  );

  it.each([
    {
      label: "missing",
      prepare: (state: PlatformState) => {
        const profile = state.staffProfiles.find(
          item => item.userId === "usr_admin_demo"
        );
        if (profile) profile.userId = "usr_unmapped_admin_profile";
      },
    },
    {
      label: "inactive",
      prepare: (state: PlatformState) => {
        const profile = state.staffProfiles.find(
          item => item.userId === "usr_admin_demo"
        );
        if (profile) profile.status = "paused";
      },
    },
    {
      label: "role-mismatched",
      prepare: (state: PlatformState) => {
        const profile = state.staffProfiles.find(
          item => item.userId === "usr_admin_demo"
        );
        if (profile) profile.role = "registrar";
      },
    },
  ])(
    "denies a staff action with a $label active-role StaffProfile",
    async ({ prepare }) => {
      const state = cloneState();
      prepare(state);
      const stateBeforeDenial = cloneState(state);
      const repository = installRepository(state);

      await expect(
        applyPlatformWorkflowAction(
          {
            type: "settings.save",
            organization: "Must not be written",
            defaultLanguage: "English",
            academicTerm: "Denied staff profile term",
            retentionDays: 365,
          },
          sessionFor("superadmin")
        )
      ).rejects.toThrow(
        "Snapshot staff actions require an active superadmin staff profile."
      );

      expect(state).toEqual(stateBeforeDenial);
      expect(repository.writeSnapshot).not.toHaveBeenCalled();
      expect(repository.recordEvent).not.toHaveBeenCalled();
    }
  );

  it.each([
    {
      label: "missing",
      prepare: (state: PlatformState) => {
        state.teachers = state.teachers.filter(
          profile => profile.userId !== "usr_teacher_demo"
        );
      },
    },
    {
      label: "inactive",
      prepare: (state: PlatformState) => {
        const profile = state.teachers.find(
          item => item.userId === "usr_teacher_demo"
        );
        if (profile) profile.status = "paused";
      },
    },
  ])(
    "denies a teacher action with a $label TeacherProfile",
    async ({ prepare }) => {
      const state = cloneState();
      prepare(state);
      const stateBeforeDenial = cloneState(state);
      const repository = installRepository(state);

      await expect(
        applyPlatformWorkflowAction(
          {
            type: "message.send",
            toUserId: "usr_student_demo",
            subject: "Must not be sent",
            body: "Teacher profile authority denial",
          },
          sessionFor("teacher")
        )
      ).rejects.toThrow(
        "Snapshot teacher actions require an active teacher profile."
      );

      expect(state).toEqual(stateBeforeDenial);
      expect(repository.writeSnapshot).not.toHaveBeenCalled();
      expect(repository.recordEvent).not.toHaveBeenCalled();
    }
  );

  it.each([
    {
      label: "missing",
      prepare: (state: PlatformState) => {
        state.students = state.students.filter(
          profile => profile.userId !== "usr_student_demo"
        );
      },
    },
    {
      label: "inactive",
      prepare: (state: PlatformState) => {
        const profile = state.students.find(
          item => item.userId === "usr_student_demo"
        );
        if (profile) profile.status = "paused";
      },
    },
  ])(
    "denies a student action with a $label StudentProfile",
    async ({ prepare }) => {
      const state = cloneState();
      prepare(state);
      const stateBeforeDenial = cloneState(state);
      const repository = installRepository(state);

      await expect(
        applyPlatformWorkflowAction(
          {
            type: "message.send",
            toUserId: "usr_teacher_demo",
            subject: "Must not be sent",
            body: "Student profile authority denial",
          },
          sessionFor("student")
        )
      ).rejects.toThrow(
        "Snapshot student actions require an active student profile."
      );

      expect(state).toEqual(stateBeforeDenial);
      expect(repository.writeSnapshot).not.toHaveBeenCalled();
      expect(repository.recordEvent).not.toHaveBeenCalled();
    }
  );

  it("authorizes the deduped union of primary and listed message recipients", async () => {
    const state = cloneState();
    const stateBeforeDenial = cloneState(state);
    const repository = installRepository(state);

    await expect(
      applyPlatformWorkflowAction(
        {
          type: "message.send",
          toUserId: "usr_student_alex_demo",
          recipientUserIds: ["usr_student_demo", "usr_student_demo"],
          subject: "Recipient smuggling test",
          body: "The primary recipient must also pass scope checks.",
        },
        sessionFor("teacher")
      )
    ).rejects.toThrow("Message recipient is outside this role scope.");

    expect(state).toEqual(stateBeforeDenial);
    expect(repository.writeSnapshot).not.toHaveBeenCalled();
    expect(repository.recordEvent).not.toHaveBeenCalled();
  });

  it("uses StaffProfile branchIds without expanding department branches", async () => {
    const state = cloneState();
    const registrarProfile = state.staffProfiles.find(
      profile => profile.userId === "usr_registrar_demo"
    );
    if (!registrarProfile) {
      throw new Error("Registrar staff profile fixture is required.");
    }
    registrarProfile.branchIds = ["br_cairo"];
    const repository = installRepository(state);

    await expect(
      applyPlatformWorkflowAction(
        {
          type: "application.create",
          fullName: "Out of staff scope",
          email: "out.of.staff.scope@nilelearn.local",
          phone: "+20 100 000 0101",
          branchId: "br_online",
          courseInterest: "Arabic Language",
          schedulePreference: "Evening",
        },
        sessionFor("registrar")
      )
    ).rejects.toThrow(
      "Registrar can only create applications inside admissions branches."
    );

    expect(repository.writeSnapshot).not.toHaveBeenCalled();

    await applyPlatformWorkflowAction(
      {
        type: "application.create",
        fullName: "Inside staff scope",
        email: "inside.staff.scope@nilelearn.local",
        phone: "+20 100 000 0102",
        branchId: "br_cairo",
        courseInterest: "Arabic Language",
        schedulePreference: "Evening",
      },
      sessionFor("registrar")
    );

    expect(repository.writeSnapshot).toHaveBeenCalledTimes(1);
  });

  it("uses StaffProfile departmentIds instead of legacy user ownership", async () => {
    const state = cloneState();
    const profile = state.staffProfiles.find(
      item => item.userId === "usr_hod_demo"
    );
    if (!profile) throw new Error("HOD staff profile fixture is missing.");
    profile.departmentIds = ["dep_quran"];
    const repository = installRepository(state);

    await expect(
      applyPlatformWorkflowAction(
        {
          type: "course.status.update",
          courseId: "course_ar_l3",
          status: "paused",
        },
        sessionFor("headofdepartment")
      )
    ).rejects.toThrow("HOD can only update course status in their department.");

    expect(repository.writeSnapshot).not.toHaveBeenCalled();

    profile.departmentIds = ["dep_arabic"];
    await applyPlatformWorkflowAction(
      {
        type: "course.status.update",
        courseId: "course_ar_l3",
        status: "paused",
      },
      sessionFor("headofdepartment")
    );

    expect(repository.writeSnapshot).toHaveBeenCalledTimes(1);
  });

  it("uses StaffProfile branchIds for branch-admin actions", async () => {
    const state = cloneState();
    const profile = state.staffProfiles.find(
      item => item.userId === "usr_branch_demo"
    );
    if (!profile) throw new Error("Branch staff profile fixture is missing.");
    profile.branchIds = ["br_alex"];
    const repository = installRepository(state);

    await expect(
      applyPlatformWorkflowAction(
        {
          type: "room.status.update",
          roomId: "room_cairo_4",
          status: "paused",
        },
        sessionFor("branchadmin")
      )
    ).rejects.toThrow("Branch admin can only update rooms in their branch.");

    expect(repository.writeSnapshot).not.toHaveBeenCalled();

    await applyPlatformWorkflowAction(
      {
        type: "room.status.update",
        roomId: "room_alex_2",
        status: "paused",
      },
      sessionFor("branchadmin")
    );

    expect(repository.writeSnapshot).toHaveBeenCalledTimes(1);
  });

  it("preserves a valid lesson enrollmentId through parsing and mutation", async () => {
    const action = parsePlatformWorkflowAction({
      type: "lesson.start",
      lessonId: "lesson_ar_reading_market",
      enrollmentId: "enr_ar_l3",
      studentId: "stu_alex_demo",
      actorId: "usr_admin_demo",
    });
    expect(action).toMatchObject({
      type: "lesson.start",
      lessonId: "lesson_ar_reading_market",
      enrollmentId: "enr_ar_l3",
    });
    if (!action) throw new Error("Lesson action fixture did not parse.");

    const state = cloneState();
    const repository = installRepository(state);
    const result = await applyPlatformWorkflowAction(
      action,
      sessionFor("student")
    );

    expect(result.state.lessonProgress).toContainEqual(
      expect.objectContaining({
        studentId: "stu_demo",
        enrollmentId: "enr_ar_l3",
        lessonId: "lesson_ar_reading_market",
        status: "in_progress",
      })
    );
    expect(repository.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          request: expect.objectContaining({ enrollmentId: "enr_ar_l3" }),
        }),
      })
    );
  });

  it("rejects malformed lesson enrollmentId values instead of dropping them", () => {
    expect(
      parsePlatformWorkflowAction({
        type: "lesson.start",
        lessonId: "lesson_ar_reading_market",
        enrollmentId: "   ",
      })
    ).toBeNull();
    expect(
      parsePlatformWorkflowAction({
        type: "lesson.complete",
        lessonId: "lesson_ar_reading_market",
        enrollmentId: 42,
      })
    ).toBeNull();
  });

  it("keeps assignment lifecycle commands scoped, audited, and hidden from student drafts", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-10T12:00:00.000Z"));
    const state = cloneState();
    state.assignments.push(
      {
        id: "asg_lifecycle_publish",
        courseRunId: "run_ar_l3_2026",
        title: "Scoped publication",
        dueAt: "2026-07-20T18:00:00+03:00",
        submissionType: "text",
        rubric: ["Accuracy"],
        status: "draft",
      },
      {
        id: "asg_lifecycle_hidden_draft",
        courseRunId: "run_ar_l3_2026",
        title: "Hidden draft",
        dueAt: "2026-07-20T18:00:00+03:00",
        submissionType: "text",
        rubric: ["Accuracy"],
        status: "draft",
      },
      {
        id: "asg_lifecycle_cancelled",
        courseRunId: "run_ar_l3_2026",
        title: "Cancelled work",
        dueAt: "2026-07-20T18:00:00+03:00",
        submissionType: "text",
        rubric: ["Accuracy"],
        status: "cancelled",
      }
    );
    const repository = installRepository(state);

    expect(
      parsePlatformWorkflowAction({
        type: "assignment.status.update",
        assignmentId: "asg_lifecycle_publish",
        status: "active",
      })
    ).toMatchObject({
      type: "assignment.status.update",
      status: "active",
    });
    expect(
      parsePlatformWorkflowAction({
        type: "assignment.status.update",
        assignmentId: "asg_lifecycle_publish",
        status: "draft",
      })
    ).toBeNull();

    await expect(
      applyPlatformWorkflowAction(
        {
          type: "assignment.status.update",
          assignmentId: "asg_hifz_revision",
          status: "cancelled",
          reason: "Outside teacher scope.",
        },
        sessionFor("teacher")
      )
    ).rejects.toThrow(
      "Teacher can only manage assignments for assigned course runs."
    );
    await expect(
      applyPlatformWorkflowAction(
        {
          type: "assignment.status.update",
          assignmentId: "asg_hifz_revision",
          status: "cancelled",
          reason: "Outside department scope.",
        },
        sessionFor("headofdepartment")
      )
    ).rejects.toThrow("HOD can only manage assignments in their department.");

    const published = await applyPlatformWorkflowAction(
      {
        type: "assignment.status.update",
        assignmentId: "asg_lifecycle_publish",
        status: "active",
      },
      sessionFor("headofdepartment")
    );

    expect(repository.writeSnapshot).toHaveBeenCalledTimes(1);
    expect(
      published.state.assignments.find(
        assignment => assignment.id === "asg_lifecycle_publish"
      )
    ).toMatchObject({ status: "active" });
    const audit = published.state.auditLogs.find(
      item =>
        item.action === "assignment.published" &&
        item.entityId === "asg_lifecycle_publish"
    );
    expect(audit).toMatchObject({ actorId: "usr_hod_demo" });
    expect(published.state.notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: "usr_student_demo",
          title: "New assignment",
        }),
      ])
    );

    const studentProjection = scopePlatformStateForSession(
      published.state,
      sessionFor("student")
    );
    expect(studentProjection.assignments.map(item => item.id)).toEqual(
      expect.arrayContaining(["asg_lifecycle_publish"])
    );
    expect(studentProjection.assignments.map(item => item.id)).not.toEqual(
      expect.arrayContaining([
        "asg_lifecycle_hidden_draft",
        "asg_lifecycle_cancelled",
      ])
    );
    expect(studentProjection.notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: "New assignment" }),
      ])
    );

    const teacherProjection = scopePlatformStateForSession(
      published.state,
      sessionFor("teacher")
    );
    const hodProjection = scopePlatformStateForSession(
      published.state,
      sessionFor("headofdepartment")
    );
    const adminProjection = scopePlatformStateForSession(
      published.state,
      sessionFor("superadmin")
    );
    for (const projection of [
      teacherProjection,
      hodProjection,
      adminProjection,
    ]) {
      expect(projection.auditLogs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            action: "assignment.published",
            entityId: "asg_lifecycle_publish",
            actorId: "usr_hod_demo",
          }),
        ])
      );
    }
  });

  it("accepts any matching active course run when lesson enrollmentId is omitted", async () => {
    const state = cloneState();
    const enrolledRun = state.courseRuns.find(
      item => item.id === "run_ar_l3_2026"
    );
    if (!enrolledRun)
      throw new Error("Enrolled course run fixture is missing.");
    state.courseRuns = [
      { ...enrolledRun, id: "run_ar_l3_unenrolled_first" },
      ...state.courseRuns,
    ];
    const repository = installRepository(state);

    await applyPlatformWorkflowAction(
      {
        type: "lesson.start",
        lessonId: "lesson_ar_reading_market",
      },
      sessionFor("student")
    );

    expect(repository.writeSnapshot).toHaveBeenCalledTimes(1);
    expect(state.lessonProgress).toContainEqual(
      expect.objectContaining({
        enrollmentId: "enr_ar_l3",
        lessonId: "lesson_ar_reading_market",
        status: "in_progress",
      })
    );
  });

  it.each([
    {
      label: "another course",
      enrollmentId: "enr_qt_1",
      prepare: (_state: PlatformState) => undefined,
    },
    {
      label: "another student",
      enrollmentId: "enr_ar_l3_cairo",
      prepare: (_state: PlatformState) => undefined,
    },
    {
      label: "inactive enrollment",
      enrollmentId: "enr_ar_l3",
      prepare: (state: PlatformState) => {
        const enrollment = state.enrollments.find(
          item => item.id === "enr_ar_l3"
        );
        if (enrollment) enrollment.status = "paused";
      },
    },
    {
      label: "inactive course run",
      enrollmentId: "enr_ar_l3",
      prepare: (state: PlatformState) => {
        const courseRun = state.courseRuns.find(
          item => item.id === "run_ar_l3_2026"
        );
        if (courseRun) courseRun.status = "paused";
      },
    },
  ])(
    "rejects an explicit lesson enrollment for $label",
    async ({ enrollmentId, prepare }) => {
      const state = cloneState();
      prepare(state);
      const stateBeforeDenial = cloneState(state);
      const repository = installRepository(state);

      await expect(
        applyPlatformWorkflowAction(
          {
            type: "lesson.complete",
            lessonId: "lesson_ar_conditional",
            enrollmentId,
          },
          sessionFor("student")
        )
      ).rejects.toThrow(
        "Student can only open lessons for enrolled course runs."
      );

      expect(state).toEqual(stateBeforeDenial);
      expect(repository.writeSnapshot).not.toHaveBeenCalled();
      expect(repository.recordEvent).not.toHaveBeenCalled();
    }
  );

  it.each([
    {
      label: "unmapped",
      prepare: (state: PlatformState) => state,
      session: () =>
        sessionFor("superadmin", {
          userId: "usr_unmapped_superadmin",
        }),
      error: "Session identity is not mapped to an active state user.",
    },
    {
      label: "inactive",
      prepare: (state: PlatformState) => {
        const user = state.users.find(item => item.id === "usr_admin_demo");
        if (user) user.status = "paused";
        return state;
      },
      session: () => sessionFor("superadmin"),
      error: "Session identity is not active in platform state.",
    },
    {
      label: "stale after role revocation",
      prepare: (state: PlatformState) => {
        const user = state.users.find(item => item.id === "usr_admin_demo");
        if (user) user.roles = [];
        return state;
      },
      session: () => sessionFor("superadmin"),
      error: "Session active role is no longer granted in platform state.",
    },
    {
      label: "mismatched",
      prepare: (state: PlatformState) => state,
      session: () =>
        sessionFor("superadmin", {
          roles: ["teacher"],
        }),
      error: "Session active role does not match its granted roles.",
    },
  ])(
    "denies an $label superadmin session without mutation or audit",
    async ({ prepare, session: createSession, error }) => {
      const state = prepare(cloneState());
      const stateBeforeDenial = cloneState(state);
      const repository = repositoryFor(state);
      restoreRepository = setPlatformStateRepository(repository);

      await expect(
        applyPlatformWorkflowAction(
          {
            type: "settings.save",
            organization: "Must not be written",
            defaultLanguage: "English",
            academicTerm: "Denied authority term",
            retentionDays: 365,
            actorId: "usr_teacher_demo",
          },
          createSession()
        )
      ).rejects.toThrow(error);

      expect(state).toEqual(stateBeforeDenial);
      expect(repository.writeSnapshot).not.toHaveBeenCalled();
      expect(repository.recordEvent).not.toHaveBeenCalled();
    }
  );
});
