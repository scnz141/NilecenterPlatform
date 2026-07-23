import { describe, expect, it, vi } from "vitest";

import type { ServerSession } from "../../../../server/auth";
import {
  createSupabaseNormalizedWorkflowRepository,
  NormalizedWorkflowConflictError,
  NormalizedWorkflowDeniedError,
  NormalizedWorkflowUnavailableError,
  NormalizedWorkflowValidationError,
} from "../../../../server/normalizedWorkflowRepository";

const session: ServerSession = {
  id: "normalized-secret-session-token",
  userId: "40000000-0000-4000-8000-000000000001",
  authUserId: "10000000-0000-4000-8000-000000000001",
  email: "student@example.test",
  name: "Normalized Student",
  roles: ["student"],
  activeRole: "student",
  activeRoleGrantId: "50000000-0000-4000-8000-000000000001",
  branchIds: ["20000000-0000-4000-8000-000000000001"],
  departmentIds: [],
  provider: "supabase",
  authorizationModel: "normalized",
  createdAt: "2026-07-22T00:00:00.000Z",
  expiresAt: "2026-07-22T12:00:00.000Z",
};

const workspace = {
  user: {
    id: session.userId,
    fullName: "Normalized Student",
    email: "student@example.test",
    phone: "+201000000000",
    status: "active",
    profileVersion: 3,
    preferredLanguage: "English",
    timezone: "Africa/Cairo",
    notificationPreferences: {
      messages: true,
      schedule: true,
      academic: true,
      billing: false,
      system: false,
    },
  },
  branches: [
    {
      id: session.branchIds![0],
      name: "Online",
      code: "ONLINE",
      timezone: "Africa/Cairo",
      address: "Online",
      status: "active",
    },
  ],
  departments: [],
  student: {
    id: "70000000-0000-4000-8000-000000000001",
    status: "active",
    country: "Egypt",
    ageGroup: "Adult",
  },
  supportTickets: [
    {
      id: "80000000-0000-4000-8000-000000000001",
      subject: "Schedule support",
      details: "Please confirm the next class schedule.",
      category: "schedule",
      priority: "normal",
      status: "pending",
      version: 1,
      updatedAt: "2026-07-22T09:00:00.000Z",
    },
  ],
  auditLogs: [
    {
      id: "1",
      action: "profile.updated",
      entityType: "User",
      entityId: session.userId,
      summary: "Updated own profile.",
      occurredAt: "2026-07-22T09:00:00.000Z",
    },
  ],
};

const registrarSession: ServerSession = {
  ...session,
  id: "normalized-registrar-session-token",
  userId: "40000000-0000-4000-8000-000000000002",
  authUserId: "10000000-0000-4000-8000-000000000002",
  email: "registrar@example.test",
  name: "Normalized Registrar",
  roles: ["registrar"],
  activeRole: "registrar",
  activeRoleGrantId: "50000000-0000-4000-8000-000000000002",
};

const registrarWorkspace = {
  ...workspace,
  user: {
    ...workspace.user,
    id: registrarSession.userId,
    fullName: registrarSession.name,
    email: registrarSession.email,
  },
  student: undefined,
  staff: {
    id: "70000000-0000-4000-8000-000000000002",
    title: "Registrar",
    availabilityStatus: "not_applicable",
    status: "active",
    subjects: [],
    teachingLevels: [],
  },
  supportTickets: [],
};

const teacherSession: ServerSession = {
  ...session,
  id: "normalized-teacher-session-token",
  userId: "40000000-0000-4000-8000-000000000003",
  authUserId: "10000000-0000-4000-8000-000000000003",
  email: "teacher@example.test",
  name: "Normalized Teacher",
  roles: ["teacher"],
  activeRole: "teacher",
  activeRoleGrantId: "50000000-0000-4000-8000-000000000003",
  departmentIds: ["65000000-0000-4000-8000-000000000001"],
};

const teacherWorkspace = {
  ...workspace,
  user: {
    ...workspace.user,
    id: teacherSession.userId,
    fullName: teacherSession.name,
    email: teacherSession.email,
  },
  student: undefined,
  staff: {
    id: "70000000-0000-4000-8000-000000000003",
    title: "Arabic Teacher",
    availabilityStatus: "available",
    status: "active",
    subjects: ["Arabic grammar"],
    teachingLevels: ["Arabic Level 3"],
  },
  supportTickets: [],
};

const admissionsWorkspace = {
  studentUsers: [],
  teacherUsers: [],
  students: [],
  enrollments: [],
  leads: [
    {
      id: "a0000000-0000-4000-8000-000000000001",
      branchId: session.branchIds![0],
      fullName: "Admissions Learner",
      email: "learner@example.test",
      phone: "+201000000009",
      country: "Egypt",
      subject: "Arabic Language",
      source: "manual",
      status: "lead",
      notes: "Requested weekday classes.",
      sourceKey: "lead-source-test-0001",
      version: 1,
      createdAt: "2026-07-22T10:00:00.000Z",
    },
  ],
  applications: [],
  placementTests: [],
  placementResults: [],
  programs: [],
  levels: [],
  courses: [],
  courseRuns: [],
  classGroups: [],
};

const studentLearningWorkspace = {
  student: {
    id: workspace.student.id,
    userId: session.userId,
    status: "active",
    source: "direct",
    currentLevel: "Arabic Level 3",
    ageGroup: "Adult",
    courseInterest: "Arabic Language",
    country: "Egypt",
  },
  teachers: [],
  programs: [],
  levels: [],
  courses: [],
  courseRuns: [],
  classGroups: [],
  enrollments: [],
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("normalized workflow repository", () => {
  it("reads only the authenticated normalized workspace without sending the raw token", async () => {
    const adminFetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([{ workspace }]))
      .mockResolvedValueOnce(
        jsonResponse([{ workspace: studentLearningWorkspace }])
      );
    const repository = createSupabaseNormalizedWorkflowRepository(adminFetch);

    const state = await repository.readWorkspace(session);

    expect(state.users).toEqual([
      expect.objectContaining({
        id: session.userId,
        name: "Normalized Student",
        version: 3,
        branchId: session.branchIds![0],
      }),
    ]);
    expect(state.students).toEqual([
      expect.objectContaining({
        userId: session.userId,
        country: "Egypt",
      }),
    ]);
    expect(state.supportTickets).toHaveLength(1);
    const body = String(adminFetch.mock.calls[0]?.[1]?.body);
    expect(body).not.toContain(session.id);
    expect(body).toMatch(/p_session_token_hash/);
  });

  it("projects only the authenticated student's enrolled course, class, and teacher", async () => {
    const teacherId = "41000000-0000-4000-8000-000000000001";
    const courseId = "61000000-0000-4000-8000-000000000001";
    const runId = "62000000-0000-4000-8000-000000000001";
    const classGroupId = "63000000-0000-4000-8000-000000000001";
    const learning = {
      ...studentLearningWorkspace,
      teachers: [
        {
          id: teacherId,
          fullName: "Assigned Teacher",
          email: "assigned.teacher@example.test",
        },
      ],
      programs: [
        {
          id: "64000000-0000-4000-8000-000000000001",
          title: "Arabic Language",
          category: "AR",
          departmentId: "65000000-0000-4000-8000-000000000001",
          language: "Arabic",
          status: "active",
        },
      ],
      levels: [
        {
          id: "66000000-0000-4000-8000-000000000001",
          programId: "64000000-0000-4000-8000-000000000001",
          title: "Arabic Level 3",
          order: 3,
        },
      ],
      courses: [
        {
          id: courseId,
          programId: "64000000-0000-4000-8000-000000000001",
          levelId: "66000000-0000-4000-8000-000000000001",
          slug: "arabic-level-3",
          title: "Standard Arabic Level 3",
          status: "active",
        },
      ],
      courseRuns: [
        {
          id: runId,
          courseId,
          branchId: session.branchIds![0],
          teacherId,
          term: "Summer 2026",
          startsOn: "2026-07-01",
          endsOn: "2026-09-30",
          status: "active",
        },
      ],
      classGroups: [
        {
          id: classGroupId,
          courseRunId: runId,
          name: "Arabic L3 - Group A",
          capacity: 16,
          schedule: "Schedule not configured",
          studentIds: [workspace.student.id],
          status: "active",
        },
      ],
      enrollments: [
        {
          id: "67000000-0000-4000-8000-000000000001",
          studentId: workspace.student.id,
          courseRunId: runId,
          levelId: "66000000-0000-4000-8000-000000000001",
          classGroupId,
          teacherId,
          source: "direct",
          status: "active",
          createdAt: "2026-07-22T12:00:00.000Z",
        },
      ],
    };
    const adminFetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([{ workspace }]))
      .mockResolvedValueOnce(jsonResponse([{ workspace: learning }]));
    const repository = createSupabaseNormalizedWorkflowRepository(adminFetch);

    const state = await repository.readWorkspace(session);

    expect(state.users).toContainEqual(
      expect.objectContaining({ id: teacherId, activeRole: "teacher" })
    );
    expect(state.courseRuns).toEqual([
      expect.objectContaining({ id: runId, teacherId }),
    ]);
    expect(state.classGroups).toEqual([
      expect.objectContaining({
        id: classGroupId,
        studentIds: [workspace.student.id],
      }),
    ]);
    expect(state.enrollments).toEqual([
      expect.objectContaining({
        studentId: workspace.student.id,
        classGroupId,
        teacherId,
      }),
    ]);
    expect(adminFetch.mock.calls.map(call => call[0])).toEqual([
      "rpc/nile_read_self_workspace",
      "rpc/nile_read_student_learning_workspace",
      "rpc/nile_read_student_attendance_workspace",
    ]);
  });

  it("projects branch-scoped invited students and class-derived teachers for Registrar", async () => {
    const studentUserId = "42000000-0000-4000-8000-000000000001";
    const studentProfileId = "72000000-0000-4000-8000-000000000001";
    const teacherId = "41000000-0000-4000-8000-000000000001";
    const admissions = {
      ...admissionsWorkspace,
      studentUsers: [
        {
          id: studentUserId,
          fullName: "Invited Student",
          email: "invited.student@example.test",
          phone: "+201000000020",
          branchId: session.branchIds![0],
          preferredLanguage: "English",
          timezone: "Africa/Cairo",
          status: "invited",
          version: 1,
        },
      ],
      teacherUsers: [
        {
          id: teacherId,
          fullName: "Assigned Teacher",
          email: "assigned.teacher@example.test",
          branchId: session.branchIds![0],
          departmentId: "65000000-0000-4000-8000-000000000001",
          status: "active",
          version: 1,
        },
      ],
      students: [
        {
          id: studentProfileId,
          userId: studentUserId,
          status: "ready_to_enroll",
          source: "direct",
          currentLevel: "Arabic Level 3",
          ageGroup: "Adult",
          courseInterest: "Arabic Language",
          country: "Egypt",
          branchId: session.branchIds![0],
          preferredLanguage: "English",
          timezone: "Africa/Cairo",
        },
      ],
      enrollments: [
        {
          id: "67000000-0000-4000-8000-000000000001",
          studentId: studentProfileId,
          courseRunId: "62000000-0000-4000-8000-000000000001",
          classGroupId: "63000000-0000-4000-8000-000000000001",
          teacherId,
          source: "direct",
          status: "enrolled",
          createdAt: "2026-07-22T12:00:00.000Z",
        },
      ],
    };
    const adminFetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([{ workspace: registrarWorkspace }]))
      .mockResolvedValueOnce(jsonResponse([{ workspace: admissions }]));
    const repository = createSupabaseNormalizedWorkflowRepository(adminFetch);

    const state = await repository.readWorkspace(registrarSession);

    expect(state.users).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: studentUserId, status: "pending" }),
        expect.objectContaining({ id: teacherId, activeRole: "teacher" }),
      ])
    );
    expect(state.students).toEqual([
      expect.objectContaining({
        id: studentProfileId,
        status: "ready_to_enroll",
      }),
    ]);
    expect(state.enrollments).toEqual([
      expect.objectContaining({
        studentId: studentProfileId,
        teacherId,
        status: "enrolled",
      }),
    ]);
  });

  it("projects only active students from a teacher's assigned classes", async () => {
    const studentUserId = "42000000-0000-4000-8000-000000000001";
    const studentProfileId = "72000000-0000-4000-8000-000000000001";
    const runId = "62000000-0000-4000-8000-000000000001";
    const classGroupId = "63000000-0000-4000-8000-000000000001";
    const classes = {
      studentUsers: [
        {
          id: studentUserId,
          fullName: "Assigned Student",
          email: "assigned.student@example.test",
          phone: "+201000000021",
          branchId: session.branchIds![0],
          preferredLanguage: "English",
          timezone: "Africa/Cairo",
          status: "active",
          version: 1,
        },
      ],
      students: [
        {
          id: studentProfileId,
          userId: studentUserId,
          status: "active",
          source: "direct",
          currentLevel: "Arabic Level 3",
          ageGroup: "Adult",
          courseInterest: "Arabic Language",
          country: "Egypt",
          branchId: session.branchIds![0],
          preferredLanguage: "English",
          timezone: "Africa/Cairo",
        },
      ],
      programs: [
        {
          id: "64000000-0000-4000-8000-000000000001",
          title: "Arabic Language",
          category: "AR",
          departmentId: teacherSession.departmentIds![0],
          language: "Arabic",
          status: "active",
        },
      ],
      levels: [
        {
          id: "66000000-0000-4000-8000-000000000001",
          programId: "64000000-0000-4000-8000-000000000001",
          title: "Arabic Level 3",
          order: 3,
        },
      ],
      courses: [
        {
          id: "61000000-0000-4000-8000-000000000001",
          programId: "64000000-0000-4000-8000-000000000001",
          levelId: "66000000-0000-4000-8000-000000000001",
          slug: "arabic-level-3",
          title: "Standard Arabic Level 3",
          status: "active",
        },
      ],
      courseRuns: [
        {
          id: runId,
          courseId: "61000000-0000-4000-8000-000000000001",
          branchId: session.branchIds![0],
          teacherId: teacherSession.userId,
          term: "Summer 2026",
          startsOn: "2026-07-01",
          endsOn: "2026-09-30",
          status: "active",
        },
      ],
      classGroups: [
        {
          id: classGroupId,
          courseRunId: runId,
          name: "Arabic L3 - Group A",
          capacity: 16,
          schedule: "Schedule not configured",
          studentIds: [studentProfileId],
          status: "active",
        },
      ],
      enrollments: [
        {
          id: "67000000-0000-4000-8000-000000000001",
          studentId: studentProfileId,
          courseRunId: runId,
          classGroupId,
          teacherId: teacherSession.userId,
          source: "direct",
          status: "active",
          createdAt: "2026-07-22T12:00:00.000Z",
        },
      ],
    };
    const adminFetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([{ workspace: teacherWorkspace }]))
      .mockResolvedValueOnce(jsonResponse([{ workspace: classes }]));
    const repository = createSupabaseNormalizedWorkflowRepository(adminFetch);

    const state = await repository.readWorkspace(teacherSession);

    expect(state.users).toContainEqual(
      expect.objectContaining({ id: studentUserId, activeRole: "student" })
    );
    expect(state.students).toEqual([
      expect.objectContaining({ id: studentProfileId, userId: studentUserId }),
    ]);
    expect(state.teachers[0]?.assignedClassIds).toEqual([classGroupId]);
    expect(state.enrollments[0]).toEqual(
      expect.objectContaining({
        studentId: studentProfileId,
        classGroupId,
        teacherId: teacherSession.userId,
      })
    );
    expect(adminFetch.mock.calls.map(call => call[0])).toEqual([
      "rpc/nile_read_self_workspace",
      "rpc/nile_read_teacher_class_workspace",
      "rpc/nile_read_teacher_attendance_workspace",
    ]);
  });

  it("creates an assigned teacher class session with command evidence", async () => {
    const sessionId = "91000000-0000-4000-8000-000000000001";
    const classGroupId = "66000000-0000-4000-8000-000000000001";
    const adminFetch = vi.fn(async (url: string) => {
      if (url === "rpc/nile_create_teacher_class_session_with_evidence") {
        return jsonResponse([
          {
            command_id: "command-1",
            class_session_id: sessionId,
            session_version: 1,
            outbox_event_id: "outbox-1",
            replayed: false,
          },
        ]);
      }
      if (url === "rpc/nile_read_self_workspace")
        return jsonResponse([{ workspace: teacherWorkspace }]);
      if (url === "rpc/nile_read_teacher_class_workspace") {
        return jsonResponse([
          {
            workspace: {
              studentUsers: [],
              students: [],
              programs: [],
              levels: [],
              courses: [],
              courseRuns: [],
              classGroups: [],
              enrollments: [],
            },
          },
        ]);
      }
      return jsonResponse([
        {
          workspace: {
            sessions: [
              {
                id: sessionId,
                classGroupId,
                eventType: "class_session",
                title: "Arabic class",
                startsAt: "2026-07-23T09:00:00.000Z",
                endsAt: "2026-07-23T10:00:00.000Z",
                status: "active",
                attendanceSaved: false,
                attendanceVersion: 1,
                createdBy: teacherSession.userId,
                branchId: teacherSession.branchIds![0],
              },
            ],
            attendance: [],
          },
        },
      ]);
    });
    const repository = createSupabaseNormalizedWorkflowRepository(adminFetch);
    const response = await repository.apply(
      {
        type: "calendar.create",
        title: "Arabic class",
        eventType: "class_session",
        startsAt: "2026-07-23T09:00:00.000Z",
        endsAt: "2026-07-23T10:00:00.000Z",
        classGroupId,
        idempotencyKey: "class.session:test-0001",
      },
      teacherSession
    );
    expect(response.result).toMatchObject({
      action: "calendar.created",
      entityId: sessionId,
      result: { version: 1, replayed: false },
    });
    expect(response.state.classSessions[0]).toMatchObject({
      id: sessionId,
      attendanceVersion: 1,
    });
    const body = JSON.parse(String(adminFetch.mock.calls[0]?.[1]?.body));
    expect(body).toMatchObject({
      p_class_group_id: classGroupId,
      p_idempotency_key: "class.session:test-0001",
    });
  });

  it("saves complete class attendance with optimistic concurrency evidence", async () => {
    const sessionId = "91000000-0000-4000-8000-000000000002";
    const classGroupId = "66000000-0000-4000-8000-000000000002";
    const studentId = "70000000-0000-4000-8000-000000000001";
    const adminFetch = vi.fn(async (url: string) => {
      if (url === "rpc/nile_save_teacher_attendance_with_evidence")
        return jsonResponse([
          {
            command_id: "command-2",
            class_session_id: sessionId,
            session_version: 2,
            attendance_count: 1,
            outbox_event_id: "outbox-2",
            replayed: false,
          },
        ]);
      if (url === "rpc/nile_read_self_workspace")
        return jsonResponse([{ workspace: teacherWorkspace }]);
      if (url === "rpc/nile_read_teacher_class_workspace")
        return jsonResponse([
          {
            workspace: {
              studentUsers: [],
              students: [],
              programs: [],
              levels: [],
              courses: [],
              courseRuns: [],
              classGroups: [],
              enrollments: [],
            },
          },
        ]);
      return jsonResponse([
        {
          workspace: {
            sessions: [
              {
                id: sessionId,
                classGroupId,
                eventType: "class_session",
                title: "Arabic class",
                startsAt: "2026-07-23T09:00:00.000Z",
                endsAt: "2026-07-23T10:00:00.000Z",
                status: "active",
                attendanceSaved: true,
                attendanceVersion: 2,
                attendanceSavedAt: "2026-07-23T10:01:00.000Z",
                createdBy: teacherSession.userId,
                branchId: teacherSession.branchIds![0],
              },
            ],
            attendance: [
              {
                id: "attendance-1",
                classGroupId,
                studentId,
                sessionId,
                status: "present",
                version: 1,
                markedBy: teacherSession.userId,
                markedAt: "2026-07-23T10:01:00.000Z",
              },
            ],
          },
        },
      ]);
    });
    const repository = createSupabaseNormalizedWorkflowRepository(adminFetch);
    const response = await repository.apply(
      {
        type: "attendance.save",
        classGroupId,
        sessionId,
        statuses: { [studentId]: "present" },
        notes: {},
        expectedVersion: 1,
        idempotencyKey: "attendance.save:test-0001",
      },
      teacherSession
    );
    expect(response.result).toMatchObject({
      action: "attendance.saved",
      result: { attendanceCount: 1, version: 2, replayed: false },
    });
    expect(response.state.attendance[0]).toMatchObject({
      studentId,
      status: "present",
    });
    const body = JSON.parse(String(adminFetch.mock.calls[0]?.[1]?.body));
    expect(body).toMatchObject({
      p_expected_version: 1,
      p_idempotency_key: "attendance.save:test-0001",
    });
  });

  it("updates a self profile with version and idempotency evidence", async () => {
    const adminFetch = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse([
          {
            command_id: "90000000-0000-4000-8000-000000000001",
            user_id: session.userId,
            profile_version: 4,
            changed_fields: ["name", "preferences"],
            replayed: false,
          },
        ])
      )
      .mockResolvedValueOnce(jsonResponse([{ workspace }]))
      .mockResolvedValueOnce(
        jsonResponse([{ workspace: studentLearningWorkspace }])
      );
    const repository = createSupabaseNormalizedWorkflowRepository(adminFetch);

    const response = await repository.apply(
      {
        type: "profile.update",
        name: "Updated Student",
        phone: "+201000000001",
        preferredLanguage: "English",
        timezone: "Africa/Cairo",
        notificationPreferences: workspace.user.notificationPreferences,
        country: "Egypt",
        guardianName: "",
        guardianPhone: "",
        expectedVersion: 3,
        idempotencyKey: "profile.update:test-0001",
      },
      session
    );

    expect(response.persistence).toBe("supabase");
    expect(response.result).toMatchObject({
      action: "profile.updated",
      entityId: session.userId,
      result: { version: 4, replayed: false },
    });
    expect(adminFetch.mock.calls[0]?.[0]).toBe(
      "rpc/nile_update_self_profile_with_evidence"
    );
    const mutationBody = JSON.parse(
      String(adminFetch.mock.calls[0]?.[1]?.body)
    );
    expect(mutationBody).toMatchObject({
      p_expected_version: 3,
      p_idempotency_key: "profile.update:test-0001",
    });
    expect(mutationBody.p_session_token_hash).toHaveLength(64);
  });

  it("creates a student support ticket and reloads its authoritative state", async () => {
    const adminFetch = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse([
          {
            command_id: "90000000-0000-4000-8000-000000000002",
            ticket_id: "80000000-0000-4000-8000-000000000002",
            ticket_version: 1,
            replayed: false,
          },
        ])
      )
      .mockResolvedValueOnce(jsonResponse([{ workspace }]))
      .mockResolvedValueOnce(
        jsonResponse([{ workspace: studentLearningWorkspace }])
      );
    const repository = createSupabaseNormalizedWorkflowRepository(adminFetch);

    const response = await repository.apply(
      {
        type: "support.ticket.create",
        subject: "Learning support",
        details: "I need help opening the assigned learning material.",
        category: "learning",
        priority: "normal",
        idempotencyKey: "support.ticket.create:test-0001",
      },
      session
    );

    expect(response.result).toMatchObject({
      action: "support.ticket_created",
      entityType: "SupportTicket",
      result: { version: 1, replayed: false },
    });
  });

  it("creates and reloads a branch-scoped admissions lead with command evidence", async () => {
    const adminFetch = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse([
          {
            command_id: "90000000-0000-4000-8000-000000000003",
            lead_id: admissionsWorkspace.leads[0].id,
            branch_id: session.branchIds![0],
            lead_version: 1,
            replayed: false,
          },
        ])
      )
      .mockResolvedValueOnce(jsonResponse([{ workspace: registrarWorkspace }]))
      .mockResolvedValueOnce(
        jsonResponse([{ workspace: admissionsWorkspace }])
      );
    const repository = createSupabaseNormalizedWorkflowRepository(adminFetch);

    const response = await repository.apply(
      {
        type: "lead.create",
        branchId: session.branchIds![0],
        fullName: "Admissions Learner",
        email: "learner@example.test",
        phone: "+201000000009",
        country: "Egypt",
        subject: "Arabic Language",
        source: "manual",
        notes: "Requested weekday classes.",
        sourceKey: "lead-source-test-0001",
        idempotencyKey: "lead.create:test-0001",
      },
      registrarSession
    );

    expect(response.result).toMatchObject({
      action: "lead.created",
      entityType: "Lead",
      entityId: admissionsWorkspace.leads[0].id,
      result: { version: 1, replayed: false },
    });
    expect(response.state.leads).toEqual([
      expect.objectContaining({
        id: admissionsWorkspace.leads[0].id,
        fullName: "Admissions Learner",
        sourceKey: "lead-source-test-0001",
      }),
    ]);
    expect(adminFetch.mock.calls.map(call => call[0])).toEqual([
      "rpc/nile_create_admission_lead_with_evidence",
      "rpc/nile_read_self_workspace",
      "rpc/nile_read_admissions_student_workspace",
    ]);
    const mutationBody = JSON.parse(
      String(adminFetch.mock.calls[0]?.[1]?.body)
    );
    expect(mutationBody).toMatchObject({
      p_branch_ref: session.branchIds![0],
      p_idempotency_key: "lead.create:test-0001",
    });
    expect(mutationBody.p_session_token_hash).toHaveLength(64);
  });

  it("creates an application and reloads both authoritative intake records", async () => {
    const applicationId = "b0000000-0000-4000-8000-000000000001";
    const applicationWorkspace = {
      ...admissionsWorkspace,
      applications: [
        {
          id: applicationId,
          leadId: admissionsWorkspace.leads[0].id,
          branchId: session.branchIds![0],
          courseInterest: "Arabic Language",
          schedulePreference: "Evenings",
          sourceKey: "application-source-test-0001",
          status: "pending",
          version: 1,
        },
      ],
    };
    const adminFetch = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse([
          {
            command_id: "90000000-0000-4000-8000-000000000004",
            application_id: applicationId,
            lead_id: admissionsWorkspace.leads[0].id,
            branch_id: session.branchIds![0],
            application_version: 1,
            lead_version: 1,
            replayed: false,
          },
        ])
      )
      .mockResolvedValueOnce(jsonResponse([{ workspace: registrarWorkspace }]))
      .mockResolvedValueOnce(
        jsonResponse([{ workspace: applicationWorkspace }])
      );
    const repository = createSupabaseNormalizedWorkflowRepository(adminFetch);

    const response = await repository.apply(
      {
        type: "application.create",
        fullName: "Admissions Learner",
        email: "learner@example.test",
        phone: "+201000000009",
        branchId: session.branchIds![0],
        courseInterest: "Arabic Language",
        schedulePreference: "Evenings",
        source: "manual",
        sourceKey: "application-source-test-0001",
        idempotencyKey: "application.create:test-0001",
      },
      registrarSession
    );

    expect(response.result).toMatchObject({
      action: "application.created",
      entityId: applicationId,
      result: { version: 1, leadVersion: 1, replayed: false },
    });
    expect(response.state.applications).toEqual([
      expect.objectContaining({ id: applicationId, status: "pending" }),
    ]);
    expect(adminFetch.mock.calls[0]?.[0]).toBe(
      "rpc/nile_create_admission_application_with_evidence"
    );
  });

  it("converts a versioned lead into an application", async () => {
    const applicationId = "b0000000-0000-4000-8000-000000000002";
    const adminFetch = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse([
          {
            command_id: "90000000-0000-4000-8000-000000000005",
            application_id: applicationId,
            lead_id: admissionsWorkspace.leads[0].id,
            branch_id: session.branchIds![0],
            application_version: 1,
            lead_version: 2,
            replayed: false,
          },
        ])
      )
      .mockResolvedValueOnce(jsonResponse([{ workspace: registrarWorkspace }]))
      .mockResolvedValueOnce(
        jsonResponse([
          {
            workspace: {
              studentUsers: [],
              teacherUsers: [],
              students: [],
              enrollments: [],
              leads: [{ ...admissionsWorkspace.leads[0], version: 2 }],
              applications: [
                {
                  id: applicationId,
                  leadId: admissionsWorkspace.leads[0].id,
                  branchId: session.branchIds![0],
                  courseInterest: "Arabic Language",
                  schedulePreference: "To confirm",
                  status: "pending",
                  version: 1,
                },
              ],
              placementTests: [],
              placementResults: [],
              programs: [],
              levels: [],
              courses: [],
              courseRuns: [],
              classGroups: [],
            },
          },
        ])
      );
    const repository = createSupabaseNormalizedWorkflowRepository(adminFetch);

    const response = await repository.apply(
      {
        type: "lead.convert",
        leadId: admissionsWorkspace.leads[0].id,
        expectedVersion: 1,
        idempotencyKey: "lead.convert:test-0001",
      },
      registrarSession
    );

    expect(response.result).toMatchObject({
      action: "lead.converted",
      entityId: applicationId,
      result: { leadVersion: 2, replayed: false },
    });
    const mutationBody = JSON.parse(
      String(adminFetch.mock.calls[0]?.[1]?.body)
    );
    expect(mutationBody).toMatchObject({
      p_expected_version: 1,
      p_idempotency_key: "lead.convert:test-0001",
    });
  });

  it("creates a branch-scoped placement booking with intake lineage", async () => {
    const bookingId = "c0000000-0000-4000-8000-000000000001";
    const placementWorkspace = {
      ...admissionsWorkspace,
      placementTests: [
        {
          id: bookingId,
          leadId: admissionsWorkspace.leads[0].id,
          fullName: "Admissions Learner",
          email: "learner@example.test",
          phone: "+201000000009",
          branchId: session.branchIds![0],
          subject: "Arabic Language",
          preferredDate: "2026-07-30",
          currentLevel: "Placement pending",
          sourceKey: "placement-source-test-0001",
          status: "pending",
          version: 1,
        },
      ],
    };
    const adminFetch = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse([
          {
            command_id: "90000000-0000-4000-8000-000000000006",
            booking_id: bookingId,
            lead_id: admissionsWorkspace.leads[0].id,
            branch_id: session.branchIds![0],
            booking_version: 1,
            lead_version: 2,
            result_id: null,
            result_version: null,
            replayed: false,
          },
        ])
      )
      .mockResolvedValueOnce(jsonResponse([{ workspace: registrarWorkspace }]))
      .mockResolvedValueOnce(jsonResponse([{ workspace: placementWorkspace }]));
    const repository = createSupabaseNormalizedWorkflowRepository(adminFetch);

    const response = await repository.apply(
      {
        type: "placement.create",
        leadId: admissionsWorkspace.leads[0].id,
        branchId: session.branchIds![0],
        fullName: "Admissions Learner",
        email: "learner@example.test",
        phone: "+201000000009",
        subject: "Arabic Language",
        preferredDate: "2026-07-30",
        currentLevel: "Placement pending",
        sourceKey: "placement-source-test-0001",
        idempotencyKey: "placement.create:test-0001",
      },
      registrarSession
    );

    expect(response.result).toMatchObject({
      action: "placement.created",
      entityId: bookingId,
      result: { version: 1, leadVersion: 2, replayed: false },
    });
    expect(response.state.placementTests).toEqual([
      expect.objectContaining({ id: bookingId, status: "pending" }),
    ]);
    expect(adminFetch.mock.calls[0]?.[0]).toBe(
      "rpc/nile_create_placement_booking_with_evidence"
    );
  });

  it("records a versioned placement result and reloads the completed booking", async () => {
    const bookingId = "c0000000-0000-4000-8000-000000000002";
    const resultId = "d0000000-0000-4000-8000-000000000001";
    const placementWorkspace = {
      ...admissionsWorkspace,
      placementTests: [
        {
          id: bookingId,
          leadId: admissionsWorkspace.leads[0].id,
          fullName: "Admissions Learner",
          email: "learner@example.test",
          phone: "+201000000009",
          branchId: session.branchIds![0],
          subject: "Arabic Language",
          preferredDate: "2026-07-30",
          currentLevel: "Placement pending",
          status: "completed",
          recommendedLevel: "Arabic Level 2",
          version: 2,
        },
      ],
      placementResults: [
        {
          id: resultId,
          bookingId,
          examinerId: registrarSession.userId,
          score: 84,
          recommendedLevel: "Arabic Level 2",
          notes: "Ready for the recommended level.",
          createdAt: "2026-07-22T12:00:00.000Z",
          version: 1,
        },
      ],
    };
    const adminFetch = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse([
          {
            command_id: "90000000-0000-4000-8000-000000000007",
            booking_id: bookingId,
            lead_id: admissionsWorkspace.leads[0].id,
            branch_id: session.branchIds![0],
            booking_version: 2,
            lead_version: 3,
            result_id: resultId,
            result_version: 1,
            replayed: false,
          },
        ])
      )
      .mockResolvedValueOnce(jsonResponse([{ workspace: registrarWorkspace }]))
      .mockResolvedValueOnce(jsonResponse([{ workspace: placementWorkspace }]));
    const repository = createSupabaseNormalizedWorkflowRepository(adminFetch);

    const response = await repository.apply(
      {
        type: "placement.result.record",
        bookingId,
        recommendedLevel: "Arabic Level 2",
        score: 84,
        notes: "Ready for the recommended level.",
        expectedVersion: 1,
        idempotencyKey: "placement.result.record:test-0001",
      },
      registrarSession
    );

    expect(response.result).toMatchObject({
      action: "placement.result_recorded",
      entityId: resultId,
      result: { bookingVersion: 2, leadVersion: 3, replayed: false },
    });
    expect(response.state.placementResults).toEqual([
      expect.objectContaining({ id: resultId, score: 84 }),
    ]);
    const mutationBody = JSON.parse(
      String(adminFetch.mock.calls[0]?.[1]?.body)
    );
    expect(mutationBody).toMatchObject({
      p_expected_version: 1,
      p_idempotency_key: "placement.result.record:test-0001",
    });
  });

  it("rejects the retired normalized native-assignment loop", async () => {
    const adminFetch = vi.fn();
    const repository = createSupabaseNormalizedWorkflowRepository(adminFetch);

    await expect(
      repository.apply(
        {
          type: "assignment.create",
          courseRunId: "62000000-0000-4000-8000-000000000001",
          classGroupId: "63000000-0000-4000-8000-000000000001",
          title: "Arabic worksheet",
          dueAt: "2026-08-01T12:00:00.000Z",
          submissionType: "text",
          rubric: ["Accuracy"],
          idempotencyKey: "assignment.create:test-0001",
        },
        teacherSession
      )
    ).rejects.toThrow("managed in Moodle");
    expect(adminFetch).not.toHaveBeenCalled();
  });

  it("keeps unsupported normalized commands unavailable", async () => {
    const repository = createSupabaseNormalizedWorkflowRepository(vi.fn());
    await expect(
      repository.apply(
        {
          type: "notification.read",
          notificationId: "notification-1",
        },
        session
      )
    ).rejects.toBeInstanceOf(NormalizedWorkflowUnavailableError);
  });

  it.each([
    [403, "42501", NormalizedWorkflowDeniedError],
    [409, "23505", NormalizedWorkflowConflictError],
    [422, "22023", NormalizedWorkflowValidationError],
    [503, "XX000", NormalizedWorkflowUnavailableError],
  ])(
    "classifies repository failures without exposing database text",
    async (status, code, ErrorType) => {
      const repository = createSupabaseNormalizedWorkflowRepository(
        vi.fn(async () =>
          jsonResponse({ code, message: "sensitive database detail" }, status)
        )
      );

      await expect(repository.readWorkspace(session)).rejects.toBeInstanceOf(
        ErrorType
      );
    }
  );
});
