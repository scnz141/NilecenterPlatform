import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ServerRole, ServerSession } from "../../../../server/auth";
import { applyPlatformWorkflowAction } from "../../../../server/platformState";

const originalLocalOnly = process.env.NILE_PLATFORM_STATE_LOCAL_ONLY;
const localStateFile = path.resolve(
  process.cwd(),
  ".local-data/platform-state.json"
);

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

function resetLocalPlatformState() {
  fs.rmSync(localStateFile, { force: true });
}

function sessionFor(
  role: ServerRole,
  override: Partial<ServerSession> = {}
): ServerSession {
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
  it("overwrites spoofed student and actor ids with the authenticated student session", async () => {
    const result = await applyPlatformWorkflowAction(
      {
        type: "assignment.submit",
        assignmentId: "asg_ar_grammar",
        response: "Server-scoped student response",
        studentId: "stu_cairo_demo",
        actorId: "usr_admin_demo",
      },
      sessionFor("student")
    );

    const submission = result.state.assignmentSubmissions.find(
      item =>
        item.assignmentId === "asg_ar_grammar" &&
        item.response === "Server-scoped student response"
    );

    expect(submission).toMatchObject({
      studentId: "stu_demo",
      response: "Server-scoped student response",
    });
    expect(result.state.auditLogs[0]).toMatchObject({
      action: "assignment.resubmitted",
      actorId: "usr_student_demo",
    });
  });

  it("allows only super admins to create staff users and writes audit with the session actor", async () => {
    await expect(
      applyPlatformWorkflowAction(
        {
          type: "staff.user.create",
          name: "Blocked Registrar Staff",
          email: "blocked.registrar.staff@nilelearn.local",
          role: "registrar",
          branchId: "br_cairo",
          departmentId: "dep_admissions",
          permissionScope: "admissions",
        },
        sessionFor("registrar")
      )
    ).rejects.toThrow("Role registrar cannot run staff.user.create.");

    const result = await applyPlatformWorkflowAction(
      {
        type: "staff.user.create",
        name: "QA Registrar Staff",
        email: "qa.registrar.staff@nilelearn.local",
        role: "registrar",
        branchId: "br_cairo",
        departmentId: "dep_admissions",
        permissionScope: "admissions",
        actorId: "usr_registrar_demo",
      },
      sessionFor("superadmin")
    );

    const created = result.result.result as {
      user: {
        id: string;
        activeRole: string;
        branchId?: string;
        departmentId?: string;
      };
      staffProfile: {
        userId: string;
        role: string;
        branchIds: string[];
        departmentIds: string[];
      };
    };
    const audit = result.state.auditLogs.find(
      item => item.entityId === created.user.id
    );

    expect(created.user).toMatchObject({
      activeRole: "registrar",
      branchId: "br_cairo",
      departmentId: "dep_admissions",
    });
    expect(created.staffProfile).toMatchObject({
      userId: created.user.id,
      role: "registrar",
      branchIds: ["br_cairo"],
      departmentIds: ["dep_admissions"],
    });
    expect(audit).toMatchObject({
      action: "staff.user.created",
      actorId: "usr_admin_demo",
    });
  });

  it("keeps user updates super-admin-only and ignores client actor spoofing", async () => {
    await expect(
      applyPlatformWorkflowAction(
        {
          type: "user.update",
          userId: "usr_teacher_demo",
          activeRole: "teacher",
          roles: ["teacher"],
          branchId: "br_online",
          departmentId: "dep_arabic",
          status: "paused",
        },
        sessionFor("branchadmin")
      )
    ).rejects.toThrow("Role branchadmin cannot run user.update.");

    const result = await applyPlatformWorkflowAction(
      {
        type: "user.update",
        userId: "usr_teacher_demo",
        activeRole: "teacher",
        roles: ["teacher"],
        branchId: "br_online",
        departmentId: "dep_arabic",
        status: "paused",
        actorId: "usr_teacher_demo",
      },
      sessionFor("superadmin")
    );
    const updatedUser = result.state.users.find(
      item => item.id === "usr_teacher_demo"
    );
    const staffProfile = result.state.staffProfiles.find(
      item => item.userId === "usr_teacher_demo" && item.role === "teacher"
    );

    expect(updatedUser).toMatchObject({
      status: "paused",
      branchId: "br_online",
      departmentId: "dep_arabic",
    });
    expect(staffProfile).toMatchObject({
      status: "paused",
      branchIds: ["br_online"],
      departmentIds: ["dep_arabic"],
    });
    expect(result.result).toMatchObject({
      action: "user.updated",
      entityId: "usr_teacher_demo",
    });
    expect(result.state.auditLogs[0]).toMatchObject({
      action: "user.updated",
      actorId: "usr_admin_demo",
      entityId: "usr_teacher_demo",
    });
  });

  it("limits profile updates to the authenticated user and keeps role scope server-owned", async () => {
    await expect(
      applyPlatformWorkflowAction(
        {
          type: "profile.update",
          userId: "usr_student_demo",
          name: "Cross Account Edit",
        },
        sessionFor("teacher")
      )
    ).rejects.toThrow("Users can only update their own profile.");

    const result = await applyPlatformWorkflowAction(
      {
        type: "profile.update",
        name: "Teacher Server Profile",
        preferredLanguage: "Arabic",
        notificationPreferences: { messages: false },
        activeRole: "superadmin",
        roles: ["superadmin"],
        branchId: "br_global",
        departmentId: "dep_admin",
      } as any,
      sessionFor("teacher")
    );
    const user = result.state.users.find(
      item => item.id === "usr_teacher_demo"
    );

    expect(user).toMatchObject({
      name: "Teacher Server Profile",
      activeRole: "teacher",
      roles: ["teacher"],
      branchId: "br_online",
      departmentId: "dep_arabic",
      preferredLanguage: "Arabic",
    });
    expect(user?.notificationPreferences).toMatchObject({ messages: false });
    expect(result.state.auditLogs.map(item => item.action)).toEqual(
      expect.arrayContaining(["profile.updated", "preferences.updated"])
    );
    expect(result.state.auditLogs[0]).toMatchObject({
      actorId: "usr_teacher_demo",
    });
  });

  it("blocks students from submitting learning work outside their enrolled course runs", async () => {
    await expect(
      applyPlatformWorkflowAction(
        {
          type: "assignment.submit",
          assignmentId: "asg_ar_l1_letters",
          response: "This should not be accepted.",
          studentId: "stu_alex_demo",
          actorId: "usr_student_alex_demo",
        },
        sessionFor("student")
      )
    ).rejects.toThrow(
      "Student can only submit assignments for enrolled course runs."
    );

    await expect(
      applyPlatformWorkflowAction(
        {
          type: "quiz.submit",
          quizId: "quiz_ar_l1_letters",
          answers: { q1: "ب" },
          studentId: "stu_alex_demo",
          actorId: "usr_student_alex_demo",
        },
        sessionFor("student")
      )
    ).rejects.toThrow(
      "Student can only submit quizzes for enrolled course runs."
    );

    await expect(
      applyPlatformWorkflowAction(
        {
          type: "lesson.start",
          lessonId: "lesson_ar_letters",
          studentId: "stu_alex_demo",
          actorId: "usr_student_alex_demo",
        },
        sessionFor("student")
      )
    ).rejects.toThrow(
      "Student can only open lessons for enrolled course runs."
    );
  });

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
        spareTeacher
      )
    ).rejects.toThrow("Teacher can only save attendance for assigned classes.");
  });

  it("blocks teachers from unrelated class attendance, grading, and quiz review work", async () => {
    await expect(
      applyPlatformWorkflowAction(
        {
          type: "attendance.save",
          classGroupId: "class_hifz_1_online",
          sessionId: "evt_hifz_online",
          statuses: { stu_ready_demo: "present", stu_paused_demo: "present" },
        },
        sessionFor("teacher")
      )
    ).rejects.toThrow("Teacher can only save attendance for assigned classes.");

    await expect(
      applyPlatformWorkflowAction(
        {
          type: "assignment.grade",
          submissionId: "sub_ar_l1_letters_alex",
          score: 90,
          feedback: "This should not be accepted.",
        },
        sessionFor("teacher")
      )
    ).rejects.toThrow("Teacher can only grade assigned class submissions.");

    await expect(
      applyPlatformWorkflowAction(
        {
          type: "quiz.review",
          attemptId: "attempt_ar_l1_alex",
          score: 90,
          feedback: "This should not be accepted.",
        },
        sessionFor("teacher")
      )
    ).rejects.toThrow("Teacher can only review assigned class quiz attempts.");
  });

  it("writes assignment grading audit with the authenticated teacher actor", async () => {
    const result = await applyPlatformWorkflowAction(
      {
        type: "assignment.grade",
        submissionId: "sub_ar_grammar_draft",
        score: 91,
        feedback: "Server-scoped grading feedback.",
        actorId: "usr_admin_demo",
      },
      sessionFor("teacher")
    );
    const submission = result.state.assignmentSubmissions.find(
      item => item.id === "sub_ar_grammar_draft"
    );

    expect(submission).toMatchObject({
      status: "completed",
      score: 91,
      feedback: "Server-scoped grading feedback.",
    });
    expect(result.state.auditLogs[0]).toMatchObject({
      action: "assignment.graded",
      actorId: "usr_teacher_demo",
      entityId: "sub_ar_grammar_draft",
    });
  });

  it("overwrites spoofed teacher calendar owners with the authenticated teacher session", async () => {
    const result = await applyPlatformWorkflowAction(
      {
        type: "calendar.create",
        eventType: "reminder",
        title: "Teacher scoped reminder",
        startsAt: "2026-07-06T09:00:00+03:00",
        endsAt: "2026-07-06T09:15:00+03:00",
        branchId: "br_online",
        ownerId: "usr_admin_demo",
      },
      sessionFor("teacher")
    );

    const createdEvent = result.result.result as {
      event: { ownerId: string; branchId: string };
    };

    expect(createdEvent.event).toMatchObject({
      ownerId: "usr_teacher_demo",
      branchId: "br_online",
    });
    expect(result.state.auditLogs[0]).toMatchObject({
      action: "calendar.created",
      actorId: "usr_teacher_demo",
    });
  });

  it("blocks branch admins from attendance and room creation outside their branch", async () => {
    const branchSession = sessionFor("branchadmin");

    await expect(
      applyPlatformWorkflowAction(
        {
          type: "attendance.save",
          classGroupId: "class_ar_l3_a",
          sessionId: "evt_ar_live",
          statuses: { stu_demo: "present" },
        },
        branchSession
      )
    ).rejects.toThrow("Branch admin can only save attendance in their branch.");

    await expect(
      applyPlatformWorkflowAction(
        {
          type: "room.create",
          branchId: "br_alex",
          name: "Blocked Alexandria room",
          capacity: 12,
          equipment: ["Projector"],
        },
        branchSession
      )
    ).rejects.toThrow("Branch admin can only create rooms in their branch.");
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
        branchSession
      )
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
        branchSession
      )
    ).rejects.toThrow(
      "Branch admin can only record payments for their branch."
    );
  });

  it("blocks registrars from admissions actions outside configured branch scope", async () => {
    const allowed = await applyPlatformWorkflowAction(
      {
        type: "application.create",
        fullName: "Online Scope Applicant",
        email: "online.scope.applicant@nilelearn.local",
        phone: "+20 100 000 4141",
        branchId: "br_online",
        courseInterest: "Arabic Language",
        schedulePreference: "Evening",
      },
      sessionFor("registrar")
    );

    const application = allowed.result.result as {
      application: { branchId: string };
    };

    expect(application.application.branchId).toBe("br_online");
    expect(allowed.state.auditLogs[0]).toMatchObject({
      action: "application.created",
      actorId: "usr_registrar_demo",
    });

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
        sessionFor("registrar")
      )
    ).rejects.toThrow(
      "Registrar can only create applications inside admissions branches."
    );
  });

  it("blocks registrars from student creation and payments outside admissions scope", async () => {
    await expect(
      applyPlatformWorkflowAction(
        {
          type: "student.create",
          fullName: "Blocked Alexandria Student",
          email: "blocked.alex.student@nilelearn.local",
          phone: "+20 100 000 9090",
          branchId: "br_alex",
          preferredLanguage: "English",
          courseInterest: "Arabic Level 1",
          ageGroup: "Teen",
          courseRunId: "run_ar_l1_alex_2026",
          classGroupId: "class_ar_l1_alex",
          status: "active",
          source: "direct",
        },
        sessionFor("registrar")
      )
    ).rejects.toThrow(
      "Registrar can only create students inside admissions branches."
    );

    await expect(
      applyPlatformWorkflowAction(
        {
          type: "payment.record",
          invoiceId: "inv_alex_demo_1",
          amount: 100,
          method: "manual",
          reference: "outside-admissions-scope",
        },
        sessionFor("registrar")
      )
    ).rejects.toThrow(
      "Registrar can only record payments inside admissions branches."
    );
  });

  it("enforces role-scoped messaging recipients while preserving server actor ownership", async () => {
    const teacherResult = await applyPlatformWorkflowAction(
      {
        type: "message.send",
        fromUserId: "usr_admin_demo",
        toUserId: "usr_student_demo",
        subject: "Scoped class note",
        body: "Teacher can message an assigned student.",
        attachments: [
          {
            name: "class-note.pdf",
            type: "application/pdf",
            size: 182000,
            kind: "document",
            previewLabel: "PDF - 178 KB",
          },
        ],
      },
      sessionFor("teacher")
    );
    const sentMessage = teacherResult.state.messages[0];

    expect(sentMessage).toMatchObject({
      fromUserId: "usr_teacher_demo",
      toUserId: "usr_student_demo",
      subject: "Scoped class note",
      attachments: [
        {
          name: "class-note.pdf",
          kind: "document",
          previewLabel: "PDF - 178 KB",
        },
      ],
    });
    expect(teacherResult.state.communicationLogs[0]).toMatchObject({
      actorId: "usr_teacher_demo",
      relatedUserId: "usr_student_demo",
      attachments: sentMessage.attachments,
    });
    expect(teacherResult.state.auditLogs[0]).toMatchObject({
      action: "message.sent",
      actorId: "usr_teacher_demo",
      entityId: sentMessage.id,
    });

    await expect(
      applyPlatformWorkflowAction(
        {
          type: "message.send",
          toUserId: "usr_student_alex_demo",
          subject: "Blocked class note",
          body: "Teacher cannot message unrelated students.",
        },
        sessionFor("teacher")
      )
    ).rejects.toThrow("Message recipient is outside this role scope.");

    const adminResult = await applyPlatformWorkflowAction(
      {
        type: "message.send",
        toUserId: "usr_student_alex_demo",
        recipientUserIds: ["usr_student_alex_demo", "usr_teacher_demo"],
        subject: "Global announcement",
        body: "Super admin can message any active account.",
      },
      sessionFor("superadmin")
    );

    const broadcastMessages = adminResult.state.messages.filter(
      item => item.subject === "Global announcement"
    );

    expect(broadcastMessages).toHaveLength(2);
    expect(broadcastMessages.map(item => item.toUserId).sort()).toEqual([
      "usr_student_alex_demo",
      "usr_teacher_demo",
    ]);
    expect(
      broadcastMessages.every(item => item.fromUserId === "usr_admin_demo")
    ).toBe(true);
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
        sessionFor("headofdepartment")
      )
    ).rejects.toThrow(
      "Role headofdepartment cannot save finance report views."
    );
  });

  it("blocks HOD academic actions outside their department scope", async () => {
    await expect(
      applyPlatformWorkflowAction(
        {
          type: "course.status.update",
          courseId: "course_ar_l1",
          status: "paused",
        },
        sessionFor("headofdepartment")
      )
    ).rejects.toThrow("HOD can only update course status in their department.");

    await expect(
      applyPlatformWorkflowAction(
        {
          type: "assignment.grade",
          submissionId: "sub_hifz_revision_ready",
          score: 88,
          feedback: "This should not be accepted.",
        },
        sessionFor("headofdepartment")
      )
    ).rejects.toThrow("HOD can only grade department assignment submissions.");

    await expect(
      applyPlatformWorkflowAction(
        {
          type: "certificate.issue",
          certificateId: "cert_paused_rejected",
        },
        sessionFor("headofdepartment")
      )
    ).rejects.toThrow("HOD can only manage certificates in their department.");
  });

  it("allows super admins to perform global governance actions with audit evidence", async () => {
    const branchResult = await applyPlatformWorkflowAction(
      {
        type: "branch.update",
        branchId: "br_alex",
        status: "paused",
      },
      sessionFor("superadmin")
    );
    const branch = branchResult.state.branches.find(
      item => item.id === "br_alex"
    );

    expect(branch).toMatchObject({ status: "paused" });
    expect(branchResult.state.auditLogs[0]).toMatchObject({
      action: "branch.updated",
      actorId: "usr_admin_demo",
      entityId: "br_alex",
    });

    const permissionResult = await applyPlatformWorkflowAction(
      {
        type: "permission.update",
        role: "teacher",
        permission: "payments:read",
        granted: true,
      },
      sessionFor("superadmin")
    );

    expect(permissionResult.state.permissions.teacher).toContain(
      "payments:read"
    );
    expect(permissionResult.state.auditLogs[0]).toMatchObject({
      action: "permission.updated",
      actorId: "usr_admin_demo",
      entityId: "teacher",
    });
  });

  it("saves scoped portal settings for branch, registrar, and HOD roles", async () => {
    const branchResult = await applyPlatformWorkflowAction(
      {
        type: "portal.settings.save",
        role: "branchadmin",
        scopeId: "br_cairo",
        label: "Cairo branch desk",
        language: "English",
        timezone: "Africa/Cairo",
        notifications: true,
        attendanceCutoffMinutes: 20,
      },
      sessionFor("branchadmin")
    );
    expect(
      branchResult.state.portalSettings.find(
        item => item.role === "branchadmin" && item.scopeId === "br_cairo"
      )
    ).toMatchObject({
      label: "Cairo branch desk",
      updatedBy: "usr_branch_demo",
    });

    const registrarResult = await applyPlatformWorkflowAction(
      {
        type: "portal.settings.save",
        role: "registrar",
        scopeId: "br_cairo",
        label: "Admissions desk",
        language: "English",
        timezone: "Africa/Cairo",
        notifications: true,
        reviewCadenceDays: 2,
        paymentReminderDays: 5,
      },
      sessionFor("registrar")
    );
    expect(
      registrarResult.state.portalSettings.find(
        item => item.role === "registrar" && item.scopeId === "br_cairo"
      )
    ).toMatchObject({
      paymentReminderDays: 5,
      updatedBy: "usr_registrar_demo",
    });

    const hodResult = await applyPlatformWorkflowAction(
      {
        type: "portal.settings.save",
        role: "headofdepartment",
        scopeId: "dep_arabic",
        label: "Arabic review desk",
        language: "English",
        timezone: "Africa/Cairo",
        notifications: true,
        reviewCadenceDays: 7,
      },
      sessionFor("headofdepartment")
    );
    expect(
      hodResult.state.portalSettings.find(
        item =>
          item.role === "headofdepartment" && item.scopeId === "dep_arabic"
      )
    ).toMatchObject({
      reviewCadenceDays: 7,
      updatedBy: "usr_hod_demo",
    });
  });

  it("blocks scoped settings outside the active user's branch or department", async () => {
    await expect(
      applyPlatformWorkflowAction(
        {
          type: "portal.settings.save",
          role: "branchadmin",
          scopeId: "br_alex",
          label: "Other branch",
          language: "English",
          timezone: "Africa/Cairo",
          notifications: true,
        },
        sessionFor("branchadmin")
      )
    ).rejects.toThrow("Portal settings are limited to your branch.");

    await expect(
      applyPlatformWorkflowAction(
        {
          type: "portal.settings.save",
          role: "headofdepartment",
          scopeId: "dep_quran",
          label: "Other department",
          language: "English",
          timezone: "Africa/Cairo",
          notifications: true,
        },
        sessionFor("headofdepartment")
      )
    ).rejects.toThrow("Portal settings are limited to your department.");

    await expect(
      applyPlatformWorkflowAction(
        {
          type: "settings.save",
          organization: "Nile Center",
          defaultLanguage: "English",
          academicTerm: "Summer 2026",
          retentionDays: 365,
        },
        sessionFor("headofdepartment")
      )
    ).rejects.toThrow("Role headofdepartment cannot run settings.save.");
  });
});
