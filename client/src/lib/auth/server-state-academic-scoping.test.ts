import { describe, expect, it } from "vitest";
import type { ServerRole, ServerSession } from "../../../../server/auth";
import { scopePlatformStateForSession } from "../../../../server/routes";
import { seedPlatformState } from "../domain/seed";
import type { PlatformState } from "../domain/types";

const roles: ServerRole[] = [
  "student",
  "teacher",
  "registrar",
  "headofdepartment",
  "branchadmin",
  "superadmin",
];

const staffRoles: Exclude<ServerRole, "student">[] = [
  "teacher",
  "registrar",
  "headofdepartment",
  "branchadmin",
  "superadmin",
];

const nonAdminRoles: Exclude<ServerRole, "superadmin">[] = [
  "student",
  "teacher",
  "registrar",
  "headofdepartment",
  "branchadmin",
];

const defaultUserIds: Record<ServerRole, string> = {
  student: "usr_student_demo",
  teacher: "usr_teacher_demo",
  registrar: "usr_registrar_demo",
  headofdepartment: "usr_hod_demo",
  branchadmin: "usr_branch_demo",
  superadmin: "usr_admin_demo",
};

const collectionKeys = [
  "portalSettings",
  "users",
  "branches",
  "departments",
  "programs",
  "levels",
  "courses",
  "modules",
  "lessons",
  "resources",
  "courseRuns",
  "classGroups",
  "students",
  "teachers",
  "staffProfiles",
  "enrollments",
  "lessonProgress",
  "assignments",
  "assignmentSubmissions",
  "quizzes",
  "questionBankItems",
  "quizQuestionPreviews",
  "quizAttempts",
  "grades",
  "events",
  "classSessions",
  "teacherAvailability",
  "rooms",
  "meetingLinks",
  "attendance",
  "leads",
  "applications",
  "placementTests",
  "placementResults",
  "enrollmentWorkflows",
  "invoices",
  "payments",
  "packages",
  "discounts",
  "certificates",
  "quranPlans",
  "quranProgress",
  "recitationSubmissions",
  "messages",
  "communicationLogs",
  "messageTemplates",
  "documents",
  "notifications",
  "supportTickets",
  "reportPresets",
  "auditLogs",
  "integrations",
] as const satisfies readonly (keyof PlatformState)[];

function cloneState() {
  return JSON.parse(JSON.stringify(seedPlatformState)) as PlatformState;
}

function sessionFor(
  role: ServerRole,
  userId = defaultUserIds[role]
): ServerSession {
  const user = seedPlatformState.users.find(item => item.id === userId);
  if (!user) throw new Error(`Missing test user ${userId}.`);
  return {
    id: `academic_scope_${role}_${userId}`,
    userId,
    email: user.email,
    name: user.name,
    roles: [role],
    activeRole: role,
    provider: "demo",
    authorizationModel: "snapshot",
    createdAt: "2026-07-10T00:00:00.000Z",
    expiresAt: "2026-07-10T12:00:00.000Z",
  };
}

function idSet(items: { id: string }[]) {
  return new Set(items.map(item => item.id));
}

function expectSafeEmptyState(state: PlatformState) {
  expect(state.settings).toEqual({
    organization: "Nile Learn",
    defaultLanguage: "English",
    academicTerm: "",
    retentionDays: 0,
  });
  collectionKeys.forEach(key => expect(state[key]).toEqual([]));
  expect(
    Object.values(state.permissions).every(items => items.length === 0)
  ).toBe(true);
}

function expectAcademicClosure(state: PlatformState) {
  const userIds = idSet(state.users);
  const branchIds = idSet(state.branches);
  const departmentIds = idSet(state.departments);
  const programIds = idSet(state.programs);
  const levelIds = idSet(state.levels);
  const courseIds = idSet(state.courses);
  const moduleIds = idSet(state.modules);
  const lessonIds = idSet(state.lessons);
  const courseRunIds = idSet(state.courseRuns);
  const classGroupIds = idSet(state.classGroups);
  const studentIds = idSet(state.students);
  const enrollmentIds = idSet(state.enrollments);
  const assignmentIds = idSet(state.assignments);
  const quizIds = idSet(state.quizzes);
  const invoiceIds = idSet(state.invoices);
  const leadIds = idSet(state.leads);
  const applicationIds = idSet(state.applications);
  const placementIds = idSet(state.placementTests);

  state.departments.forEach(department =>
    department.branchIds.forEach(branchId =>
      expect(branchIds.has(branchId)).toBe(true)
    )
  );
  state.programs.forEach(program =>
    expect(departmentIds.has(program.departmentId)).toBe(true)
  );
  state.levels.forEach(level =>
    expect(programIds.has(level.programId)).toBe(true)
  );
  state.courses.forEach(course => {
    expect(programIds.has(course.programId)).toBe(true);
    expect(levelIds.has(course.levelId)).toBe(true);
  });
  state.modules.forEach(module =>
    expect(courseIds.has(module.courseId)).toBe(true)
  );
  state.lessons.forEach(lesson =>
    expect(moduleIds.has(lesson.moduleId)).toBe(true)
  );
  state.resources.forEach(resource =>
    expect(lessonIds.has(resource.lessonId)).toBe(true)
  );
  state.students.forEach(student =>
    expect(userIds.has(student.userId)).toBe(true)
  );
  state.teachers.forEach(teacher => {
    expect(userIds.has(teacher.userId)).toBe(true);
    expect(branchIds.has(teacher.branchId)).toBe(true);
    expect(departmentIds.has(teacher.departmentId)).toBe(true);
    teacher.assignedClassIds.forEach(classId =>
      expect(classGroupIds.has(classId)).toBe(true)
    );
  });
  state.staffProfiles.forEach(profile => {
    expect(userIds.has(profile.userId)).toBe(true);
    profile.branchIds.forEach(branchId =>
      expect(branchId === "br_global" || branchIds.has(branchId)).toBe(true)
    );
    profile.departmentIds.forEach(departmentId =>
      expect(departmentIds.has(departmentId)).toBe(true)
    );
  });
  state.courseRuns.forEach(run => {
    expect(courseIds.has(run.courseId)).toBe(true);
    expect(branchIds.has(run.branchId)).toBe(true);
    expect(userIds.has(run.teacherId)).toBe(true);
  });
  state.classGroups.forEach(group => {
    expect(courseRunIds.has(group.courseRunId)).toBe(true);
    group.studentIds.forEach(studentId =>
      expect(studentIds.has(studentId)).toBe(true)
    );
  });
  state.enrollments.forEach(enrollment => {
    expect(studentIds.has(enrollment.studentId)).toBe(true);
    expect(courseRunIds.has(enrollment.courseRunId)).toBe(true);
    if (enrollment.classGroupId) {
      expect(classGroupIds.has(enrollment.classGroupId)).toBe(true);
    }
  });
  state.lessonProgress.forEach(progress => {
    expect(enrollmentIds.has(progress.enrollmentId)).toBe(true);
    expect(studentIds.has(progress.studentId)).toBe(true);
    expect(lessonIds.has(progress.lessonId)).toBe(true);
  });
  state.assignments.forEach(assignment =>
    expect(courseRunIds.has(assignment.courseRunId)).toBe(true)
  );
  state.assignmentSubmissions.forEach(submission => {
    expect(assignmentIds.has(submission.assignmentId)).toBe(true);
    expect(studentIds.has(submission.studentId)).toBe(true);
  });
  state.quizzes.forEach(quiz =>
    expect(courseRunIds.has(quiz.courseRunId)).toBe(true)
  );
  state.questionBankItems.forEach(question =>
    expect(courseRunIds.has(question.courseRunId)).toBe(true)
  );
  state.quizAttempts.forEach(attempt => {
    expect(quizIds.has(attempt.quizId)).toBe(true);
    expect(studentIds.has(attempt.studentId)).toBe(true);
  });
  state.grades.forEach(grade => {
    expect(courseRunIds.has(grade.courseRunId)).toBe(true);
    expect(studentIds.has(grade.studentId)).toBe(true);
  });
  state.attendance.forEach(record => {
    expect(classGroupIds.has(record.classGroupId)).toBe(true);
    expect(studentIds.has(record.studentId)).toBe(true);
  });
  state.certificates.forEach(certificate => {
    expect(studentIds.has(certificate.studentId)).toBe(true);
    expect(courseIds.has(certificate.courseId)).toBe(true);
  });
  state.quranPlans.forEach(plan => {
    expect(studentIds.has(plan.studentId)).toBe(true);
    expect(userIds.has(plan.teacherId)).toBe(true);
  });
  state.quranProgress.forEach(progress =>
    expect(studentIds.has(progress.studentId)).toBe(true)
  );
  state.recitationSubmissions.forEach(submission => {
    expect(studentIds.has(submission.studentId)).toBe(true);
    expect(userIds.has(submission.teacherId)).toBe(true);
  });
  state.invoices.forEach(invoice =>
    expect(studentIds.has(invoice.studentId)).toBe(true)
  );
  state.payments.forEach(payment =>
    expect(invoiceIds.has(payment.invoiceId)).toBe(true)
  );
  state.packages.forEach(item =>
    expect(courseIds.has(item.courseId)).toBe(true)
  );
  state.messages.forEach(message => {
    expect(userIds.has(message.fromUserId)).toBe(true);
    expect(userIds.has(message.toUserId)).toBe(true);
  });
  state.communicationLogs.forEach(log => {
    expect(userIds.has(log.actorId)).toBe(true);
    if (log.relatedUserId) expect(userIds.has(log.relatedUserId)).toBe(true);
  });
  state.notifications.forEach(item =>
    expect(userIds.has(item.userId)).toBe(true)
  );
  state.supportTickets.forEach(item =>
    expect(userIds.has(item.requesterId)).toBe(true)
  );
  state.reportPresets.forEach(item =>
    expect(userIds.has(item.ownerUserId)).toBe(true)
  );
  state.auditLogs.forEach(item => expect(userIds.has(item.actorId)).toBe(true));
  state.applications.forEach(item =>
    expect(leadIds.has(item.leadId)).toBe(true)
  );
  state.placementTests.forEach(item => {
    if (item.leadId) expect(leadIds.has(item.leadId)).toBe(true);
  });
  state.placementResults.forEach(item =>
    expect(placementIds.has(item.bookingId)).toBe(true)
  );
  state.enrollmentWorkflows.forEach(item => {
    if (item.leadId) expect(leadIds.has(item.leadId)).toBe(true);
    if (item.applicationId)
      expect(applicationIds.has(item.applicationId)).toBe(true);
    if (item.studentId) expect(studentIds.has(item.studentId)).toBe(true);
    if (item.placementTestId)
      expect(placementIds.has(item.placementTestId)).toBe(true);
    if (item.courseRunId) expect(courseRunIds.has(item.courseRunId)).toBe(true);
    if (item.classGroupId)
      expect(classGroupIds.has(item.classGroupId)).toBe(true);
  });
}

function addGlobalCollectionSentinels(state: PlatformState) {
  state.settings.retentionDays = 9999;
  state.settings.updatedBy = "sentinel_global_actor";
  state.packages.push({
    id: "sentinel_global_package",
    title: "Global package sentinel",
    courseId: "sentinel_global_course",
    amount: 1,
    currency: "EGP",
    sessions: 1,
    status: "active",
  });
  state.messageTemplates.push({
    id: "sentinel_global_template",
    title: "Global template sentinel",
    channel: "email",
    subject: "Global",
    body: "Must not cross role scope.",
    category: "system",
    status: "active",
  });
  state.portalSettings.push({
    role: "registrar",
    scopeId: "br_alex",
    label: "sentinel_global_portal_setting",
    language: "English",
    timezone: "Africa/Cairo",
    notifications: true,
  });
  state.reportPresets.push({
    id: "sentinel_global_report",
    ownerUserId: "usr_admin_demo",
    role: "superadmin",
    label: "Global report sentinel",
    reportType: "audit",
    search: "global",
    status: "all",
    rowCount: 1,
    createdAt: "2026-07-10T09:00:00.000Z",
  });
  state.auditLogs.push({
    id: "sentinel_global_audit",
    actorId: "usr_admin_demo",
    action: "global.read",
    entityType: "PlatformState",
    entityId: "sentinel_global_state",
    summary: "Must not cross role scope.",
    createdAt: "2026-07-10T09:00:00.000Z",
  });
}

function expectNoGlobalCollectionLeak(state: PlatformState) {
  expect(state.settings.retentionDays).toBe(0);
  expect(state.settings.updatedBy).toBeUndefined();
  expect(state.integrations).toEqual([]);
  expect(state.discounts).toEqual([]);
  expect(
    Object.values(state.permissions).every(items => items.length === 0)
  ).toBe(true);
  expect(state.packages.map(item => item.id)).not.toContain(
    "sentinel_global_package"
  );
  expect(state.messageTemplates.map(item => item.id)).not.toContain(
    "sentinel_global_template"
  );
  expect(state.portalSettings.map(item => item.label)).not.toContain(
    "sentinel_global_portal_setting"
  );
  expect(state.reportPresets.map(item => item.id)).not.toContain(
    "sentinel_global_report"
  );
  expect(state.auditLogs.map(item => item.id)).not.toContain(
    "sentinel_global_audit"
  );
}

type ForeignSentinelOptions = {
  actorId: string;
  scopedStudentId: string;
  foreignUserId: string;
  foreignBranchId: string;
  foreignTeacherId: string;
  foreignCourseId: string;
  foreignLessonId: string;
  enrollmentStatus?: PlatformState["enrollments"][number]["status"];
};

function addForeignAcademicSentinels(
  state: PlatformState,
  options: ForeignSentinelOptions
) {
  state.courseRuns.push({
    id: "sentinel_foreign_run",
    courseId: options.foreignCourseId,
    branchId: options.foreignBranchId,
    teacherId: options.foreignTeacherId,
    term: "Foreign scope sentinel",
    startsOn: "2026-07-01",
    endsOn: "2026-08-31",
    status: options.enrollmentStatus ?? "active",
  });
  state.classGroups.push({
    id: "sentinel_foreign_class",
    courseRunId: "sentinel_foreign_run",
    name: "Foreign class sentinel",
    capacity: 1,
    schedule: "Never",
    meetingLinkId: "sentinel_foreign_meeting",
    studentIds: [options.scopedStudentId],
    status: "active",
  });
  state.enrollments.push({
    id: "sentinel_foreign_enrollment",
    studentId: options.scopedStudentId,
    courseRunId: "sentinel_foreign_run",
    classGroupId: "sentinel_foreign_class",
    teacherId: options.foreignTeacherId,
    status: "active",
    progress: 1,
    attendanceRate: 1,
    currentGrade: 1,
  });
  state.lessonProgress.push({
    id: "sentinel_foreign_lesson_progress",
    enrollmentId: "sentinel_foreign_enrollment",
    studentId: options.scopedStudentId,
    lessonId: options.foreignLessonId,
    status: "in_progress",
  });
  state.assignments.push({
    id: "sentinel_foreign_assignment",
    courseRunId: "sentinel_foreign_run",
    title: "Foreign assignment sentinel",
    dueAt: "2026-07-31T12:00:00.000Z",
    submissionType: "text",
    rubric: [],
    status: "active",
  });
  state.assignmentSubmissions.push({
    id: "sentinel_foreign_submission",
    assignmentId: "sentinel_foreign_assignment",
    studentId: options.scopedStudentId,
    submittedAt: "2026-07-10T09:00:00.000Z",
    status: "pending",
    response: "Must remain outside the role projection.",
  });
  state.quizzes.push({
    id: "sentinel_foreign_quiz",
    courseRunId: "sentinel_foreign_run",
    title: "Foreign quiz sentinel",
    dueAt: "2026-07-31T12:00:00.000Z",
    durationMinutes: 10,
    questionTypes: [],
    questionIds: [],
    attemptsAllowed: 1,
    status: "active",
  });
  state.quizAttempts.push({
    id: "sentinel_foreign_attempt",
    quizId: "sentinel_foreign_quiz",
    studentId: options.scopedStudentId,
    startedAt: "2026-07-10T09:00:00.000Z",
    submittedAt: "2026-07-10T09:05:00.000Z",
    status: "completed",
    score: 1,
    maxScore: 10,
    answers: {},
  });
  state.grades.push({
    id: "sentinel_foreign_grade",
    studentId: options.scopedStudentId,
    courseRunId: "sentinel_foreign_run",
    itemTitle: "Foreign grade sentinel",
    score: 1,
    maxScore: 10,
    feedback: "Must remain outside the role projection.",
  });
  state.attendance.push({
    id: "sentinel_foreign_attendance",
    classGroupId: "sentinel_foreign_class",
    studentId: options.scopedStudentId,
    sessionId: "sentinel_foreign_session",
    status: "present",
  });
  state.meetingLinks.push({
    id: "sentinel_foreign_meeting",
    provider: "mock",
    url: "https://meet.nilelearn.local/foreign-sentinel",
    status: "active",
  });
  state.certificates.push({
    id: "sentinel_foreign_certificate",
    studentId: "sentinel_missing_student",
    courseId: options.foreignCourseId,
    status: "pending_approval",
    grade: 1,
    attendanceRate: 1,
    verificationCode: "SENTINEL-FOREIGN-CERTIFICATE",
  });
  state.quranPlans.push({
    id: "sentinel_foreign_quran_plan",
    studentId: options.scopedStudentId,
    target: "Foreign plan sentinel",
    currentJuz: "Foreign",
    revisionCycle: "Never",
    teacherId: options.foreignTeacherId,
  });
  state.quranProgress.push({
    id: "sentinel_foreign_quran_progress",
    studentId: "sentinel_missing_student",
    surah: "Foreign",
    juz: "Foreign",
    memorizedPercent: 1,
    tajweedScore: 1,
    notes: "Must remain outside the role projection.",
  });
  state.recitationSubmissions.push({
    id: "sentinel_foreign_recitation",
    studentId: options.scopedStudentId,
    teacherId: options.foreignTeacherId,
    title: "Foreign recitation sentinel",
    submittedAt: "2026-07-10T09:00:00.000Z",
    status: "pending",
  });
  state.communicationLogs.push({
    id: "sentinel_foreign_communication",
    actorId: options.actorId,
    channel: "manual",
    subject: "Foreign communication sentinel",
    body: "Must remain outside the role projection.",
    relatedUserId: options.foreignUserId,
    status: "active",
    createdAt: "2026-07-10T09:00:00.000Z",
  });
  state.documents.push({
    id: "sentinel_foreign_document",
    ownerId: "sentinel_missing_owner",
    title: "Foreign document sentinel",
    type: "receipt",
    url: "#foreign-document-sentinel",
    status: "active",
  });
}

function expectNoForeignSentinels(state: PlatformState) {
  const rows = [
    ...state.courseRuns,
    ...state.classGroups,
    ...state.enrollments,
    ...state.lessonProgress,
    ...state.assignments,
    ...state.assignmentSubmissions,
    ...state.quizzes,
    ...state.quizAttempts,
    ...state.grades,
    ...state.attendance,
    ...state.meetingLinks,
    ...state.certificates,
    ...state.quranPlans,
    ...state.quranProgress,
    ...state.recitationSubmissions,
    ...state.communicationLogs,
    ...state.documents,
  ];
  expect(rows.filter(item => item.id.startsWith("sentinel_foreign_"))).toEqual(
    []
  );
}

describe("server academic snapshot read scopes", () => {
  it.each(nonAdminRoles)(
    "explicitly replaces global collections for %s projections",
    role => {
      const state = cloneState();
      addGlobalCollectionSentinels(state);

      const scoped = scopePlatformStateForSession(state, sessionFor(role));

      expectNoGlobalCollectionLeak(scoped);
      expectAcademicClosure(scoped);
    }
  );

  it("keeps active and completed student history while excluding paused and foreign enrollment progress", () => {
    const state = cloneState();
    state.enrollments.push(
      {
        id: "sentinel_completed_enrollment",
        studentId: "stu_demo",
        courseRunId: "run_ar_l1_alex_2026",
        classGroupId: "class_ar_l1_alex",
        teacherId: "usr_teacher_alex_demo",
        status: "completed",
        progress: 100,
        attendanceRate: 96,
        currentGrade: 93,
      },
      {
        id: "sentinel_paused_enrollment",
        studentId: "stu_demo",
        courseRunId: "run_hifz_1_2026",
        classGroupId: "class_hifz_1_online",
        teacherId: "usr_teacher_quran_demo",
        status: "paused",
        progress: 30,
        attendanceRate: 70,
        currentGrade: 60,
      }
    );
    state.lessonProgress.push(
      {
        id: "sentinel_completed_progress",
        enrollmentId: "sentinel_completed_enrollment",
        studentId: "stu_demo",
        lessonId: "lesson_ar_letters",
        status: "completed",
      },
      {
        id: "sentinel_paused_progress",
        enrollmentId: "sentinel_paused_enrollment",
        studentId: "stu_demo",
        lessonId: "lesson_hifz_revision",
        status: "in_progress",
      },
      {
        id: "sentinel_wrong_enrollment_progress",
        enrollmentId: "enr_ar_l3_cairo",
        studentId: "stu_demo",
        lessonId: "lesson_ar_conditional",
        status: "completed",
      }
    );
    state.certificates.push({
      id: "sentinel_completed_certificate",
      studentId: "stu_demo",
      courseId: "course_ar_l1",
      status: "issued",
      grade: 93,
      attendanceRate: 96,
      verificationCode: "SENTINEL-COMPLETED-CERTIFICATE",
    });

    const scoped = scopePlatformStateForSession(state, sessionFor("student"));

    expect(scoped.enrollments.map(item => item.id)).toEqual(
      expect.arrayContaining([
        "enr_ar_l3",
        "enr_qt_1",
        "sentinel_completed_enrollment",
      ])
    );
    expect(scoped.enrollments.map(item => item.id)).not.toContain(
      "sentinel_paused_enrollment"
    );
    expect(scoped.lessonProgress.map(item => item.id)).toContain(
      "sentinel_completed_progress"
    );
    const progressIds = scoped.lessonProgress.map(item => item.id);
    expect(progressIds).not.toContain("sentinel_paused_progress");
    expect(progressIds).not.toContain("sentinel_wrong_enrollment_progress");
    expect(scoped.certificates.map(item => item.id)).toContain(
      "sentinel_completed_certificate"
    );
    expectAcademicClosure(scoped);
  });

  it("limits students to enrollment-bound academic outcomes", () => {
    const state = cloneState();
    addForeignAcademicSentinels(state, {
      actorId: "usr_student_demo",
      scopedStudentId: "stu_demo",
      foreignUserId: "usr_student_alex_demo",
      foreignBranchId: "br_alex",
      foreignTeacherId: "usr_teacher_alex_demo",
      foreignCourseId: "course_ar_l1",
      foreignLessonId: "lesson_ar_letters",
      enrollmentStatus: "paused",
    });

    const scoped = scopePlatformStateForSession(state, sessionFor("student"));

    expectNoForeignSentinels(scoped);
    expect(scoped.lessonProgress.map(item => item.id)).toContain(
      "lp_ar_conditional"
    );
    expect(scoped.assignmentSubmissions.map(item => item.id)).toContain(
      "sub_ar_grammar_draft"
    );
    expect(scoped.quizAttempts.map(item => item.id)).toContain(
      "attempt_ar_3_demo"
    );
    expectAcademicClosure(scoped);
  });

  it("limits teachers to profile-authorized owned runs and class-assigned enrollments", () => {
    const state = cloneState();
    const ownedClass = state.classGroups.find(
      item => item.id === "class_ar_l3_a"
    );
    ownedClass?.studentIds.push("stu_alex_demo");
    state.enrollments.push({
      id: "sentinel_unassigned_teacher_enrollment",
      studentId: "stu_alex_demo",
      courseRunId: "run_ar_l3_2026",
      teacherId: "usr_teacher_demo",
      status: "active",
      progress: 1,
      attendanceRate: 1,
      currentGrade: 1,
    });
    state.courseRuns.push(
      {
        id: "sentinel_teacher_foreign_branch_run",
        courseId: "course_ar_l3",
        branchId: "br_alex",
        teacherId: "usr_teacher_demo",
        term: "Foreign branch",
        startsOn: "2026-07-01",
        endsOn: "2026-08-31",
        status: "active",
      },
      {
        id: "sentinel_teacher_foreign_department_run",
        courseId: "course_ar_l1",
        branchId: "br_cairo",
        teacherId: "usr_teacher_demo",
        term: "Foreign department",
        startsOn: "2026-07-01",
        endsOn: "2026-08-31",
        status: "active",
      }
    );
    state.users = state.users.map(user =>
      user.id === "usr_teacher_demo"
        ? { ...user, branchId: "br_alex", departmentId: "dep_foundations" }
        : user
    );

    const scoped = scopePlatformStateForSession(state, sessionFor("teacher"));

    const courseRunIds = scoped.courseRuns.map(item => item.id);
    expect(courseRunIds).not.toContain("sentinel_teacher_foreign_branch_run");
    expect(courseRunIds).not.toContain(
      "sentinel_teacher_foreign_department_run"
    );
    expect(scoped.enrollments.map(item => item.id)).not.toContain(
      "sentinel_unassigned_teacher_enrollment"
    );
    expect(scoped.students.map(item => item.id)).not.toContain("stu_alex_demo");
    expect(
      scoped.classGroups.find(item => item.id === "class_ar_l3_a")?.studentIds
    ).not.toContain("stu_alex_demo");
    expect(scoped.courses.map(item => item.id)).not.toContain("course_ar_l1");
    expectAcademicClosure(scoped);
  });

  it("derives visible teacher classes from scoped course runs instead of the profile cache", () => {
    const state = cloneState();
    state.teachers = state.teachers.map(teacher =>
      teacher.userId === "usr_teacher_demo"
        ? { ...teacher, assignedClassIds: ["class_ar_l1_alex"] }
        : teacher
    );

    const scoped = scopePlatformStateForSession(state, sessionFor("teacher"));
    const scopedTeacher = scoped.teachers.find(
      teacher => teacher.userId === "usr_teacher_demo"
    );

    expect(scopedTeacher?.assignedClassIds).toEqual(
      scoped.classGroups.map(group => group.id)
    );
    expect(scopedTeacher?.assignedClassIds).not.toContain("class_ar_l1_alex");
  });

  it("redacts private directory fields for teacher-visible users who are not messageable", () => {
    const state = cloneState();
    state.users = state.users.map(user => {
      if (user.id === "usr_teacher_alex_demo") {
        return {
          ...user,
          phone: "+20 100 000 9999",
          notes: "Private foreign staff note",
          preferredLanguage: "Arabic",
          timezone: "Africa/Cairo",
          notificationPreferences: {
            messages: true,
            schedule: true,
            academic: true,
            billing: true,
            system: true,
          },
        };
      }
      if (user.id === "usr_student_demo") {
        return { ...user, phone: "+20 100 000 1111" };
      }
      return user;
    });

    const scoped = scopePlatformStateForSession(state, sessionFor("teacher"));
    const foreignUser = scoped.users.find(
      item => item.id === "usr_teacher_alex_demo"
    );
    const assignedStudent = scoped.users.find(
      item => item.id === "usr_student_demo"
    );

    expect(foreignUser).toBeDefined();
    expect(foreignUser?.phone).toBeUndefined();
    expect(foreignUser?.notes).toBeUndefined();
    expect(foreignUser?.preferredLanguage).toBeUndefined();
    expect(foreignUser?.timezone).toBeUndefined();
    expect(foreignUser?.notificationPreferences).toBeUndefined();
    expect(foreignUser?.branchId).toBeUndefined();
    expect(foreignUser?.departmentId).toBeUndefined();
    expect(assignedStudent?.phone).toBe("+20 100 000 1111");
  });

  it("uses branch-admin staff scope and includes same-branch students plus run-assigned teachers", () => {
    const state = cloneState();
    state.users.push({
      id: "sentinel_alex_student_user",
      name: "Alex Unenrolled Student",
      email: "alex.unenrolled@nilelearn.local",
      roles: ["student"],
      activeRole: "student",
      branchId: "br_alex",
      departmentId: "dep_foundations",
      status: "active",
    });
    state.students.push({
      id: "sentinel_alex_student",
      userId: "sentinel_alex_student_user",
      status: "active",
      country: "Egypt",
      preferredLanguage: "English",
      timezone: "Africa/Cairo",
    });
    state.users = state.users.map(user =>
      user.id === "usr_branch_alex_demo"
        ? { ...user, branchId: "br_cairo", departmentId: "dep_platform" }
        : user.id === "usr_teacher_quran_demo"
          ? { ...user, branchId: "br_online" }
          : user
    );
    state.teachers = state.teachers.map(teacher =>
      teacher.userId === "usr_teacher_quran_demo"
        ? { ...teacher, branchId: "br_online" }
        : teacher
    );

    const scoped = scopePlatformStateForSession(
      state,
      sessionFor("branchadmin", "usr_branch_alex_demo")
    );

    expect(scoped.branches.map(item => item.id)).toEqual(["br_alex"]);
    expect(scoped.students.map(item => item.id)).toContain(
      "sentinel_alex_student"
    );
    expect(scoped.teachers.map(item => item.userId)).toEqual(
      expect.arrayContaining([
        "usr_teacher_alex_demo",
        "usr_teacher_quran_demo",
      ])
    );
    expectAcademicClosure(scoped);
  });

  it("keeps registrar leads and workflows on unambiguous branch or actor evidence", () => {
    const state = cloneState();
    state.staffProfiles = state.staffProfiles.map(profile =>
      profile.id === "staff_registrar_demo"
        ? { ...profile, branchIds: ["br_cairo"] }
        : profile
    );
    state.leads.push(
      {
        id: "sentinel_registrar_local_lead",
        fullName: "Cairo Local Lead",
        email: "cairo.local@nilelearn.local",
        phone: "+20 100 000 0101",
        subject: "Arabic",
        source: "manual",
        status: "lead",
        createdAt: "2026-07-10T09:00:00.000Z",
      },
      {
        id: "sentinel_registrar_owned_lead",
        fullName: "Owned Lead",
        email: "owned@nilelearn.local",
        phone: "+20 100 000 0102",
        subject: "Arabic",
        source: "manual",
        status: "lead",
        createdAt: "2026-07-10T09:00:00.000Z",
      },
      {
        id: "sentinel_registrar_foreign_lead",
        fullName: "Online Foreign Lead",
        email: "foreign@nilelearn.local",
        phone: "+20 100 000 0103",
        subject: "Arabic",
        source: "manual",
        status: "lead",
        createdAt: "2026-07-10T09:00:00.000Z",
      },
      {
        id: "sentinel_registrar_ambiguous_lead",
        fullName: "Ambiguous Lead",
        email: "ambiguous@nilelearn.local",
        phone: "+20 100 000 0104",
        subject: "Arabic",
        source: "manual",
        status: "lead",
        createdAt: "2026-07-10T09:00:00.000Z",
      },
      {
        id: "sentinel_registrar_branchless_lead",
        fullName: "Branchless Lead",
        email: "branchless@nilelearn.local",
        phone: "+20 100 000 0105",
        subject: "Arabic",
        source: "manual",
        status: "lead",
        createdAt: "2026-07-10T09:00:00.000Z",
      }
    );
    state.applications.push(
      {
        id: "sentinel_registrar_local_application",
        leadId: "sentinel_registrar_local_lead",
        branchId: "br_cairo",
        courseInterest: "Arabic",
        schedulePreference: "Morning",
        status: "pending",
      },
      {
        id: "sentinel_registrar_foreign_application",
        leadId: "sentinel_registrar_foreign_lead",
        branchId: "br_online",
        courseInterest: "Arabic",
        schedulePreference: "Evening",
        status: "pending",
      },
      {
        id: "sentinel_registrar_ambiguous_local_application",
        leadId: "sentinel_registrar_ambiguous_lead",
        branchId: "br_cairo",
        courseInterest: "Arabic",
        schedulePreference: "Morning",
        status: "pending",
      },
      {
        id: "sentinel_registrar_ambiguous_foreign_application",
        leadId: "sentinel_registrar_ambiguous_lead",
        branchId: "br_online",
        courseInterest: "Arabic",
        schedulePreference: "Evening",
        status: "pending",
      }
    );
    state.placementTests.push({
      id: "sentinel_registrar_branchless_placement",
      leadId: "sentinel_registrar_branchless_lead",
      fullName: "Branchless Lead",
      email: "branchless@nilelearn.local",
      phone: "+20 100 000 0105",
      branchId: "",
      subject: "Arabic",
      preferredDate: "2026-07-20",
      currentLevel: "Unknown",
      status: "pending",
    });
    state.placementResults.push({
      id: "sentinel_registrar_branchless_result",
      bookingId: "sentinel_registrar_branchless_placement",
      examinerId: "usr_teacher_demo",
      score: 1,
      recommendedLevel: "Unknown",
      notes: "Must remain outside the registrar projection.",
      createdAt: "2026-07-10T09:00:00.000Z",
    });
    state.enrollmentWorkflows.push(
      {
        id: "sentinel_registrar_local_workflow",
        leadId: "sentinel_registrar_local_lead",
        applicationId: "sentinel_registrar_local_application",
        targetCourseId: "course_ar_l3",
        status: "ready_to_enroll",
        nextStep: "Confirm Cairo class",
        updatedAt: "2026-07-10T09:00:00.000Z",
      },
      {
        id: "sentinel_registrar_ambiguous_workflow",
        applicationId: "sentinel_registrar_ambiguous_local_application",
        targetCourseId: "course_ar_l3",
        status: "ready_to_enroll",
        nextStep: "Must not inherit one side of ambiguous lead evidence",
        updatedAt: "2026-07-10T09:00:00.000Z",
      },
      {
        id: "sentinel_registrar_mismatched_course_workflow",
        leadId: "sentinel_registrar_local_lead",
        applicationId: "sentinel_registrar_local_application",
        targetCourseId: "course_hifz_1",
        status: "ready_to_enroll",
        nextStep: "Must not cross the profile branch through target course",
        updatedAt: "2026-07-10T09:00:00.000Z",
      },
      {
        id: "sentinel_registrar_unlinked_workflow",
        targetCourseId: "course_ar_l3",
        status: "ready_to_enroll",
        nextStep: "Must not inherit target-course branch scope",
        updatedAt: "2026-07-10T09:00:00.000Z",
      }
    );
    state.auditLogs.push({
      id: "sentinel_registrar_owned_lead_audit",
      actorId: "usr_registrar_demo",
      action: "lead.created",
      entityType: "Lead",
      entityId: "sentinel_registrar_owned_lead",
      summary: "Registrar owns this otherwise unlinked lead.",
      createdAt: "2026-07-10T09:00:00.000Z",
    });
    state.users = state.users.map(user => {
      if (user.id === "usr_registrar_demo") {
        return { ...user, branchId: "br_alex", departmentId: "dep_arabic" };
      }
      if (user.id === "usr_student_alex_demo") {
        return {
          ...user,
          phone: "+20 100 000 0199",
          notes: "Foreign directory note",
          notificationPreferences: {
            messages: true,
            schedule: true,
            academic: true,
            billing: true,
            system: true,
          },
        };
      }
      return user;
    });

    const scoped = scopePlatformStateForSession(state, sessionFor("registrar"));

    expect(scoped.branches.map(item => item.id)).toEqual(["br_cairo"]);
    expect(scoped.leads.map(item => item.id)).toEqual(
      expect.arrayContaining([
        "sentinel_registrar_local_lead",
        "sentinel_registrar_owned_lead",
      ])
    );
    const leadIds = scoped.leads.map(item => item.id);
    expect(leadIds).not.toContain("sentinel_registrar_foreign_lead");
    expect(leadIds).not.toContain("sentinel_registrar_ambiguous_lead");
    expect(leadIds).not.toContain("sentinel_registrar_branchless_lead");
    expect(scoped.placementTests.map(item => item.id)).not.toContain(
      "sentinel_registrar_branchless_placement"
    );
    expect(scoped.placementResults.map(item => item.id)).not.toContain(
      "sentinel_registrar_branchless_result"
    );
    expect(scoped.enrollmentWorkflows.map(item => item.id)).toContain(
      "sentinel_registrar_local_workflow"
    );
    expect(scoped.enrollmentWorkflows.map(item => item.id)).not.toContain(
      "sentinel_registrar_unlinked_workflow"
    );
    expect(scoped.enrollmentWorkflows.map(item => item.id)).not.toContain(
      "sentinel_registrar_ambiguous_workflow"
    );
    expect(scoped.enrollmentWorkflows.map(item => item.id)).not.toContain(
      "sentinel_registrar_mismatched_course_workflow"
    );
    expect(scoped.communicationLogs.map(item => item.id)).not.toContain(
      "comm_demo_1"
    );
    const foreignDirectoryUser = scoped.users.find(
      item => item.id === "usr_student_alex_demo"
    );
    expect(foreignDirectoryUser).toBeUndefined();
    expectAcademicClosure(scoped);
  });

  it("applies both HOD department and branch scope with br_global as a wildcard", () => {
    const state = cloneState();
    state.courseRuns.push({
      id: "sentinel_hod_online_department_run",
      courseId: "course_hifz_1",
      branchId: "br_online",
      teacherId: "usr_teacher_quran_demo",
      term: "Online Hifz sentinel",
      startsOn: "2026-07-01",
      endsOn: "2026-08-31",
      status: "active",
    });
    state.staffProfiles = state.staffProfiles.map(profile =>
      profile.userId === "usr_hod_quran_demo"
        ? {
            ...profile,
            branchIds: ["br_alex"],
            departmentIds: ["dep_quran"],
          }
        : profile
    );
    state.users = state.users.map(user =>
      user.id === "usr_hod_quran_demo"
        ? { ...user, branchId: "br_cairo", departmentId: "dep_platform" }
        : user
    );

    const branchScoped = scopePlatformStateForSession(
      state,
      sessionFor("headofdepartment", "usr_hod_quran_demo")
    );

    expect(branchScoped.courseRuns.map(item => item.id)).toContain(
      "run_hifz_1_2026"
    );
    expect(branchScoped.courseRuns.map(item => item.id)).not.toContain(
      "sentinel_hod_online_department_run"
    );
    expect(branchScoped.courses.map(item => item.id)).not.toContain(
      "course_ar_l1"
    );

    const globalState = cloneState();
    globalState.courseRuns.push(
      state.courseRuns.find(
        item => item.id === "sentinel_hod_online_department_run"
      )!
    );
    globalState.staffProfiles = globalState.staffProfiles.map(profile =>
      profile.userId === "usr_hod_quran_demo"
        ? {
            ...profile,
            branchIds: ["br_global"],
            departmentIds: ["dep_quran"],
          }
        : profile
    );
    const globalScoped = scopePlatformStateForSession(
      globalState,
      sessionFor("headofdepartment", "usr_hod_quran_demo")
    );

    expect(globalScoped.courseRuns.map(item => item.id)).toEqual(
      expect.arrayContaining([
        "run_hifz_1_2026",
        "sentinel_hod_online_department_run",
      ])
    );
    expectAcademicClosure(branchScoped);
    expectAcademicClosure(globalScoped);
  });

  it("excludes foreign academic sentinels from branch, registrar, teacher, and HOD scopes", () => {
    const scenarios: Array<{
      session: ServerSession;
      sentinel: ForeignSentinelOptions;
    }> = [
      {
        session: sessionFor("teacher"),
        sentinel: {
          actorId: "usr_teacher_demo",
          scopedStudentId: "stu_demo",
          foreignUserId: "usr_student_alex_demo",
          foreignBranchId: "br_alex",
          foreignTeacherId: "usr_teacher_alex_demo",
          foreignCourseId: "course_ar_l1",
          foreignLessonId: "lesson_ar_letters",
        },
      },
      {
        session: sessionFor("branchadmin"),
        sentinel: {
          actorId: "usr_branch_demo",
          scopedStudentId: "stu_cairo_demo",
          foreignUserId: "usr_student_alex_demo",
          foreignBranchId: "br_alex",
          foreignTeacherId: "usr_teacher_alex_demo",
          foreignCourseId: "course_ar_l1",
          foreignLessonId: "lesson_ar_letters",
        },
      },
      {
        session: sessionFor("registrar"),
        sentinel: {
          actorId: "usr_registrar_demo",
          scopedStudentId: "stu_demo",
          foreignUserId: "usr_student_alex_demo",
          foreignBranchId: "br_alex",
          foreignTeacherId: "usr_teacher_alex_demo",
          foreignCourseId: "course_ar_l1",
          foreignLessonId: "lesson_ar_letters",
        },
      },
      {
        session: sessionFor("headofdepartment"),
        sentinel: {
          actorId: "usr_hod_demo",
          scopedStudentId: "stu_demo",
          foreignUserId: "usr_student_alex_demo",
          foreignBranchId: "br_alex",
          foreignTeacherId: "usr_teacher_alex_demo",
          foreignCourseId: "course_ar_l1",
          foreignLessonId: "lesson_ar_letters",
        },
      },
    ];

    scenarios.forEach(({ session, sentinel }) => {
      const state = cloneState();
      addForeignAcademicSentinels(state, sentinel);
      expectNoForeignSentinels(scopePlatformStateForSession(state, session));
    });
  });

  it.each(staffRoles)(
    "fails closed when %s has no unique active StaffProfile authority",
    role => {
      const state = cloneState();
      const userId = defaultUserIds[role];
      state.staffProfiles = state.staffProfiles.map(profile =>
        profile.userId === userId && profile.role === role
          ? { ...profile, status: "paused" }
          : profile
      );
      expectSafeEmptyState(
        scopePlatformStateForSession(state, sessionFor(role))
      );

      const duplicateState = cloneState();
      const profile = duplicateState.staffProfiles.find(
        item => item.userId === userId && item.role === role
      );
      if (!profile) throw new Error(`Missing ${role} staff profile.`);
      duplicateState.staffProfiles.push({
        ...profile,
        id: `sentinel_duplicate_${role}_profile`,
      });
      expectSafeEmptyState(
        scopePlatformStateForSession(duplicateState, sessionFor(role))
      );
    }
  );

  it.each(roles)(
    "returns the safe empty shape for invalid %s snapshot sessions",
    role => {
      const validSession = sessionFor(role);
      expectSafeEmptyState(
        scopePlatformStateForSession(seedPlatformState, {
          ...validSession,
          userId: `missing_${role}`,
        })
      );

      const inactiveState = cloneState();
      inactiveState.users = inactiveState.users.map(user =>
        user.id === validSession.userId ? { ...user, status: "paused" } : user
      );
      expectSafeEmptyState(
        scopePlatformStateForSession(inactiveState, validSession)
      );

      const ungrantedState = cloneState();
      ungrantedState.users = ungrantedState.users.map(user =>
        user.id === validSession.userId ? { ...user, roles: [] } : user
      );
      expectSafeEmptyState(
        scopePlatformStateForSession(ungrantedState, validSession)
      );

      expectSafeEmptyState(
        scopePlatformStateForSession(seedPlatformState, {
          ...validSession,
          roles: [],
        })
      );
    }
  );

  it("keeps normalized sessions on the safe snapshot projection", () => {
    expectSafeEmptyState(
      scopePlatformStateForSession(seedPlatformState, {
        ...sessionFor("student"),
        provider: "supabase",
        authorizationModel: "normalized",
        authUserId: "10000000-0000-4000-8000-000000000001",
        activeRoleGrantId: "50000000-0000-4000-8000-000000000001",
      })
    );
  });

  it("keeps normalized superadmins off the seeded compatibility workspace", () => {
    const state = cloneState();
    const scoped = scopePlatformStateForSession(state, {
      ...sessionFor("superadmin"),
      userId: "60000000-0000-4000-8000-000000000001",
      provider: "supabase",
      authorizationModel: "normalized",
      authUserId: "10000000-0000-4000-8000-000000000001",
      activeRoleGrantId: "50000000-0000-4000-8000-000000000001",
      branchIds: [],
      departmentIds: [],
    });

    expectSafeEmptyState(scoped);
    expect(scoped).not.toBe(state);
  });

  it("returns the full unmodified state for a valid superadmin", () => {
    const state = cloneState();
    const scoped = scopePlatformStateForSession(
      state,
      sessionFor("superadmin")
    );

    expect(scoped).toBe(state);
    expect(scoped).toEqual(state);
  });
});
