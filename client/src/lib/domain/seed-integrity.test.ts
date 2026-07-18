import { describe, expect, it } from "vitest";
import { seedPlatformState as state } from "./seed";

type Identified = { id: string };

function indexById<T extends Identified>(rows: T[]) {
  return new Map(rows.map(row => [row.id, row]));
}

function expectNoIntegrityErrors(errors: string[]) {
  const details = errors.length ? `\n${errors.join("\n")}` : "";
  expect(errors, `Seed integrity violations:${details}`).toEqual([]);
}

function hasEnrollment(studentId: string, courseRunId: string) {
  return state.enrollments.some(
    enrollment =>
      enrollment.studentId === studentId &&
      enrollment.courseRunId === courseRunId
  );
}

function normalizeCertificateCourseLabel(value: string) {
  return value
    .toLowerCase()
    .replace(/\bl\s*(\d+)\b/g, "level $1")
    .replace(/\b(issued|certificate|standard)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

describe("seedPlatformState relationship integrity", () => {
  it("keeps class rosters and enrollments in the same group and run", () => {
    const errors: string[] = [];
    const studentsById = indexById(state.students);
    const runsById = indexById(state.courseRuns);
    const groupsById = indexById(state.classGroups);

    state.classGroups.forEach(group => {
      if (!runsById.has(group.courseRunId)) {
        errors.push(
          `[classGroup:${group.id}] course run ${group.courseRunId} does not exist`
        );
      }

      const seenStudents = new Set<string>();
      group.studentIds.forEach(studentId => {
        if (seenStudents.has(studentId)) {
          errors.push(
            `[classGroup:${group.id}] roster repeats student ${studentId}`
          );
        }
        seenStudents.add(studentId);

        if (!studentsById.has(studentId)) {
          errors.push(
            `[classGroup:${group.id}] roster student ${studentId} does not exist`
          );
        }

        const matchingEnrollments = state.enrollments.filter(
          enrollment =>
            enrollment.studentId === studentId &&
            enrollment.classGroupId === group.id &&
            enrollment.courseRunId === group.courseRunId
        );
        if (matchingEnrollments.length !== 1) {
          errors.push(
            `[classGroup:${group.id}] student ${studentId} has ${matchingEnrollments.length} matching enrollments for run ${group.courseRunId}`
          );
        }
      });
    });

    state.enrollments.forEach(enrollment => {
      if (!studentsById.has(enrollment.studentId)) {
        errors.push(
          `[enrollment:${enrollment.id}] student ${enrollment.studentId} does not exist`
        );
      }
      if (!runsById.has(enrollment.courseRunId)) {
        errors.push(
          `[enrollment:${enrollment.id}] course run ${enrollment.courseRunId} does not exist`
        );
      }
      if (!enrollment.classGroupId) return;

      const group = groupsById.get(enrollment.classGroupId);
      if (!group) {
        errors.push(
          `[enrollment:${enrollment.id}] class group ${enrollment.classGroupId} does not exist`
        );
        return;
      }
      if (group.courseRunId !== enrollment.courseRunId) {
        errors.push(
          `[enrollment:${enrollment.id}] class group ${group.id} uses run ${group.courseRunId}, not ${enrollment.courseRunId}`
        );
      }
      if (!group.studentIds.includes(enrollment.studentId)) {
        errors.push(
          `[enrollment:${enrollment.id}] student ${enrollment.studentId} is missing from class group ${group.id}`
        );
      }
    });

    expectNoIntegrityErrors(errors);
  });

  it("links every invoice to the exact enrollment for the same student", () => {
    const errors: string[] = [];
    const enrollmentsById = indexById(state.enrollments);

    state.invoices.forEach(invoice => {
      if (!invoice.enrollmentId) {
        errors.push(`[invoice:${invoice.id}] exact enrollment link is missing`);
        return;
      }
      const enrollment = enrollmentsById.get(invoice.enrollmentId);
      if (!enrollment) {
        errors.push(
          `[invoice:${invoice.id}] enrollment ${invoice.enrollmentId} does not exist`
        );
      } else if (enrollment.studentId !== invoice.studentId) {
        errors.push(
          `[invoice:${invoice.id}] enrollment ${enrollment.id} belongs to ${enrollment.studentId}, not ${invoice.studentId}`
        );
      }
    });

    expectNoIntegrityErrors(errors);
  });

  it("keeps lesson progress inside its student's enrolled course", () => {
    const errors: string[] = [];
    const enrollmentsById = indexById(state.enrollments);
    const runsById = indexById(state.courseRuns);
    const lessonsById = indexById(state.lessons);
    const modulesById = indexById(state.modules);

    state.lessonProgress.forEach(progress => {
      const enrollment = enrollmentsById.get(progress.enrollmentId);
      if (!enrollment) {
        errors.push(
          `[lessonProgress:${progress.id}] enrollment ${progress.enrollmentId} does not exist`
        );
        return;
      }
      if (enrollment.studentId !== progress.studentId) {
        errors.push(
          `[lessonProgress:${progress.id}] enrollment ${enrollment.id} belongs to ${enrollment.studentId}, not ${progress.studentId}`
        );
      }

      const run = runsById.get(enrollment.courseRunId);
      if (!run) {
        errors.push(
          `[lessonProgress:${progress.id}] enrollment ${enrollment.id} has missing run ${enrollment.courseRunId}`
        );
      }

      const lesson = lessonsById.get(progress.lessonId);
      if (!lesson) {
        errors.push(
          `[lessonProgress:${progress.id}] lesson ${progress.lessonId} does not exist`
        );
        return;
      }

      const module = modulesById.get(lesson.moduleId);
      if (!module) {
        errors.push(
          `[lessonProgress:${progress.id}] lesson ${lesson.id} has missing module ${lesson.moduleId}`
        );
      } else if (run && module.courseId !== run.courseId) {
        errors.push(
          `[lessonProgress:${progress.id}] lesson ${lesson.id} belongs to course ${module.courseId}, not enrollment ${enrollment.id} course ${run.courseId}`
        );
      }
    });

    expectNoIntegrityErrors(errors);
  });

  it("keeps certificates tied to a student enrollment in the same course", () => {
    const errors: string[] = [];
    const runsById = indexById(state.courseRuns);

    state.certificates.forEach(certificate => {
      const matchingEnrollment = state.enrollments.find(enrollment => {
        const run = runsById.get(enrollment.courseRunId);
        return (
          enrollment.studentId === certificate.studentId &&
          run?.courseId === certificate.courseId
        );
      });

      if (!matchingEnrollment) {
        errors.push(
          `[certificate:${certificate.id}] student ${certificate.studentId} has no enrollment in course ${certificate.courseId}`
        );
      }
    });

    expectNoIntegrityErrors(errors);
  });

  it("keeps certificate document titles aligned with linked issued certificates", () => {
    const errors: string[] = [];
    const coursesById = indexById(state.courses);

    state.documents
      .filter(document => document.type === "certificate")
      .forEach(document => {
        const issuedCertificates = state.certificates.filter(
          certificate =>
            certificate.studentId === document.ownerId &&
            certificate.status === "issued"
        );
        if (!issuedCertificates.length) return;

        const documentLabel = normalizeCertificateCourseLabel(document.title);
        const matchingCertificates = issuedCertificates.filter(certificate => {
          const course = coursesById.get(certificate.courseId);
          if (!course) {
            errors.push(
              `[document:${document.id}] linked certificate ${certificate.id} has missing course ${certificate.courseId}`
            );
            return false;
          }
          return (
            normalizeCertificateCourseLabel(course.title) === documentLabel
          );
        });

        if (matchingCertificates.length !== 1) {
          errors.push(
            `[document:${document.id}] title "${document.title}" matches ${matchingCertificates.length} of ${issuedCertificates.length} issued certificates for ${document.ownerId}`
          );
        }
      });

    expectNoIntegrityErrors(errors);
  });

  it("keeps assessment activity inside the student's enrolled run", () => {
    const errors: string[] = [];
    const assignmentsById = indexById(state.assignments);
    const quizzesById = indexById(state.quizzes);
    const questionsById = indexById(state.questionBankItems);
    const studentsById = indexById(state.students);
    const runsById = indexById(state.courseRuns);
    const assessmentItems = [...state.assignments, ...state.quizzes];
    const assessmentItemsById = indexById(assessmentItems);

    state.assignmentSubmissions.forEach(submission => {
      const assignment = assignmentsById.get(submission.assignmentId);
      if (!assignment) {
        errors.push(
          `[submission:${submission.id}] assignment ${submission.assignmentId} does not exist`
        );
        return;
      }
      if (!studentsById.has(submission.studentId)) {
        errors.push(
          `[submission:${submission.id}] student ${submission.studentId} does not exist`
        );
      }
      if (!hasEnrollment(submission.studentId, assignment.courseRunId)) {
        errors.push(
          `[submission:${submission.id}] student ${submission.studentId} is not enrolled in assignment run ${assignment.courseRunId}`
        );
      }
    });

    state.quizzes.forEach(quiz => {
      quiz.questionIds.forEach(questionId => {
        const question = questionsById.get(questionId);
        if (!question) {
          errors.push(
            `[quiz:${quiz.id}] attached question ${questionId} does not exist`
          );
        } else if (question.courseRunId !== quiz.courseRunId) {
          errors.push(
            `[quiz:${quiz.id}] question ${questionId} uses run ${question.courseRunId}, not ${quiz.courseRunId}`
          );
        }
      });
    });

    state.quizAttempts.forEach(attempt => {
      const quiz = quizzesById.get(attempt.quizId);
      if (!quiz) {
        errors.push(
          `[quizAttempt:${attempt.id}] quiz ${attempt.quizId} does not exist`
        );
        return;
      }
      if (!studentsById.has(attempt.studentId)) {
        errors.push(
          `[quizAttempt:${attempt.id}] student ${attempt.studentId} does not exist`
        );
      }
      if (!hasEnrollment(attempt.studentId, quiz.courseRunId)) {
        errors.push(
          `[quizAttempt:${attempt.id}] student ${attempt.studentId} is not enrolled in quiz run ${quiz.courseRunId}`
        );
      }

      const invalidQuestionIds = Object.keys(attempt.answers).filter(
        questionId => !quiz.questionIds.includes(questionId)
      );
      if (invalidQuestionIds.length) {
        errors.push(
          `[quizAttempt:${attempt.id}] answers unattached questions ${invalidQuestionIds.join(", ")} for quiz ${quiz.id}`
        );
      }
    });

    state.grades.forEach(grade => {
      if (!studentsById.has(grade.studentId)) {
        errors.push(
          `[grade:${grade.id}] student ${grade.studentId} does not exist`
        );
      }
      if (!runsById.has(grade.courseRunId)) {
        errors.push(
          `[grade:${grade.id}] course run ${grade.courseRunId} does not exist`
        );
      }
      if (!hasEnrollment(grade.studentId, grade.courseRunId)) {
        errors.push(
          `[grade:${grade.id}] student ${grade.studentId} is not enrolled in grade run ${grade.courseRunId}`
        );
      }

      const resolvableItems = assessmentItems.filter(
        item =>
          item.courseRunId === grade.courseRunId &&
          item.title === grade.itemTitle
      );
      if (!grade.itemId && resolvableItems.length === 1) {
        errors.push(
          `[grade:${grade.id}] itemTitle resolves to ${resolvableItems[0].id}; itemId is required`
        );
      }
      if (!grade.itemId) return;

      const item = assessmentItemsById.get(grade.itemId);
      if (!item) {
        errors.push(`[grade:${grade.id}] item ${grade.itemId} does not exist`);
        return;
      }
      if (item.courseRunId !== grade.courseRunId) {
        errors.push(
          `[grade:${grade.id}] item ${item.id} uses run ${item.courseRunId}, not ${grade.courseRunId}`
        );
      }
      if (item.title !== grade.itemTitle) {
        errors.push(
          `[grade:${grade.id}] item ${item.id} title is "${item.title}", not "${grade.itemTitle}"`
        );
      }
    });

    expectNoIntegrityErrors(errors);
  });

  it("keeps attendance tuples unique and joined to the roster session", () => {
    const errors: string[] = [];
    const groupsById = indexById(state.classGroups);
    const sessionsById = indexById(state.classSessions);
    const sessionsByEventId = new Map(
      state.classSessions.map(session => [session.eventId, session])
    );
    const tupleOwners = new Map<string, string>();

    state.attendance.forEach(record => {
      const group = groupsById.get(record.classGroupId);
      const session =
        sessionsById.get(record.sessionId) ??
        sessionsByEventId.get(record.sessionId);

      if (!group) {
        errors.push(
          `[attendance:${record.id}] class group ${record.classGroupId} does not exist`
        );
      }
      if (!session) {
        errors.push(
          `[attendance:${record.id}] session ${record.sessionId} does not exist`
        );
      }
      if (!group || !session) return;

      if (session.classGroupId !== group.id) {
        errors.push(
          `[attendance:${record.id}] session ${session.id} belongs to ${session.classGroupId}, not ${group.id}`
        );
      }
      if (!group.studentIds.includes(record.studentId)) {
        errors.push(
          `[attendance:${record.id}] student ${record.studentId} is not in class group ${group.id}`
        );
      }
      const matchingEnrollment = state.enrollments.some(
        enrollment =>
          enrollment.studentId === record.studentId &&
          enrollment.classGroupId === group.id &&
          enrollment.courseRunId === group.courseRunId
      );
      if (!matchingEnrollment) {
        errors.push(
          `[attendance:${record.id}] student ${record.studentId} lacks enrollment for class group ${group.id} and run ${group.courseRunId}`
        );
      }

      const tuple = `${group.id}/${session.id}/${record.studentId}`;
      const existingId = tupleOwners.get(tuple);
      if (existingId) {
        errors.push(
          `[attendance:${record.id}] duplicates ${existingId} for tuple ${tuple}`
        );
      } else {
        tupleOwners.set(tuple, record.id);
      }
    });

    expectNoIntegrityErrors(errors);
  });

  it("keeps attendance exceptions joined to one eligible attendance record", () => {
    const errors: string[] = [];
    const recordsById = indexById(state.attendance);
    const sessionsById = indexById(state.classSessions);
    const requestIds = new Set<string>();
    const pendingRecordIds = new Set<string>();

    state.attendanceExceptions.forEach(request => {
      const record = recordsById.get(request.attendanceRecordId);
      const session = sessionsById.get(request.sessionId);
      if (requestIds.has(request.id)) {
        errors.push(`[attendanceException:${request.id}] duplicate request id`);
      }
      requestIds.add(request.id);
      if (!record) {
        errors.push(
          `[attendanceException:${request.id}] attendance ${request.attendanceRecordId} does not exist`
        );
        return;
      }
      if (!session) {
        errors.push(
          `[attendanceException:${request.id}] session ${request.sessionId} does not exist`
        );
      }
      if (
        record.studentId !== request.studentId ||
        record.classGroupId !== request.classGroupId ||
        session?.classGroupId !== request.classGroupId ||
        (record.sessionId !== request.sessionId &&
          record.sessionId !== session?.eventId)
      ) {
        errors.push(
          `[attendanceException:${request.id}] request relationships do not match attendance`
        );
      }
      if (request.status === "pending") {
        if (pendingRecordIds.has(record.id)) {
          errors.push(
            `[attendanceException:${request.id}] duplicate pending request for ${record.id}`
          );
        }
        pendingRecordIds.add(record.id);
        if (record.status !== "absent" && record.status !== "late") {
          errors.push(
            `[attendanceException:${request.id}] pending request uses ${record.status} attendance`
          );
        }
      }
    });

    expectNoIntegrityErrors(errors);
  });

  it("keeps assigned teachers aligned with run, branch, and profile scope", () => {
    const errors: string[] = [];
    const usersById = indexById(state.users);
    const branchesById = indexById(state.branches);
    const coursesById = indexById(state.courses);
    const programsById = indexById(state.programs);
    const departmentsById = indexById(state.departments);
    const runsById = indexById(state.courseRuns);
    const groupsById = indexById(state.classGroups);
    const roomsById = indexById(state.rooms);
    const meetingLinksById = indexById(state.meetingLinks);
    const eventsById = indexById(state.events);

    state.courseRuns.forEach(run => {
      const course = coursesById.get(run.courseId);
      const program = course ? programsById.get(course.programId) : undefined;
      const department = program
        ? departmentsById.get(program.departmentId)
        : undefined;
      const user = usersById.get(run.teacherId);
      const teacherProfiles = state.teachers.filter(
        teacher => teacher.userId === run.teacherId
      );
      const staffProfiles = state.staffProfiles.filter(
        profile =>
          profile.userId === run.teacherId && profile.role === "teacher"
      );

      if (!branchesById.has(run.branchId)) {
        errors.push(
          `[courseRun:${run.id}] branch ${run.branchId} does not exist`
        );
      }
      if (!course) {
        errors.push(
          `[courseRun:${run.id}] course ${run.courseId} does not exist`
        );
      }
      if (!program && course) {
        errors.push(
          `[courseRun:${run.id}] program ${course.programId} does not exist`
        );
      }
      if (!department && program) {
        errors.push(
          `[courseRun:${run.id}] department ${program.departmentId} does not exist`
        );
      }
      if (!user?.roles.includes("teacher")) {
        errors.push(
          `[courseRun:${run.id}] teacher user ${run.teacherId} is missing the teacher role`
        );
      }
      if (teacherProfiles.length !== 1) {
        errors.push(
          `[courseRun:${run.id}] teacher ${run.teacherId} has ${teacherProfiles.length} teacher profiles`
        );
      }
      if (staffProfiles.length !== 1) {
        errors.push(
          `[courseRun:${run.id}] teacher ${run.teacherId} has ${staffProfiles.length} staff teacher profiles`
        );
      }

      const teacher = teacherProfiles[0];
      const staffProfile = staffProfiles[0];
      if (teacher && department && teacher.departmentId !== department.id) {
        errors.push(
          `[courseRun:${run.id}] teacher profile ${teacher.id} uses department ${teacher.departmentId}, not ${department.id}`
        );
      }
      if (staffProfile && !staffProfile.branchIds.includes(run.branchId)) {
        errors.push(
          `[courseRun:${run.id}] staff profile ${staffProfile.id} lacks branch ${run.branchId}`
        );
      }
      if (
        staffProfile &&
        department &&
        !staffProfile.departmentIds.includes(department.id)
      ) {
        errors.push(
          `[courseRun:${run.id}] staff profile ${staffProfile.id} lacks department ${department.id}`
        );
      }
      if (department && !department.branchIds.includes(run.branchId)) {
        errors.push(
          `[courseRun:${run.id}] department ${department.id} lacks branch ${run.branchId}`
        );
      }

      state.classGroups
        .filter(group => group.courseRunId === run.id)
        .forEach(group => {
          if (teacher && !teacher.assignedClassIds.includes(group.id)) {
            errors.push(
              `[courseRun:${run.id}] teacher profile ${teacher.id} is missing assigned class ${group.id}`
            );
          }
        });
    });

    state.teachers.forEach(teacher => {
      const user = usersById.get(teacher.userId);
      const staffProfiles = state.staffProfiles.filter(
        profile =>
          profile.userId === teacher.userId && profile.role === "teacher"
      );
      const staffProfile = staffProfiles[0];

      if (!user) {
        errors.push(
          `[teacherProfile:${teacher.id}] user ${teacher.userId} does not exist`
        );
      } else {
        if (user.branchId !== teacher.branchId) {
          errors.push(
            `[teacherProfile:${teacher.id}] primary branch ${teacher.branchId} does not match user ${user.id} branch ${user.branchId}`
          );
        }
        if (user.departmentId !== teacher.departmentId) {
          errors.push(
            `[teacherProfile:${teacher.id}] department ${teacher.departmentId} does not match user ${user.id} department ${user.departmentId}`
          );
        }
      }
      if (staffProfiles.length !== 1) {
        errors.push(
          `[teacherProfile:${teacher.id}] user ${teacher.userId} has ${staffProfiles.length} staff teacher profiles`
        );
      }
      if (staffProfile && !staffProfile.branchIds.includes(teacher.branchId)) {
        errors.push(
          `[teacherProfile:${teacher.id}] staff profile ${staffProfile.id} lacks primary branch ${teacher.branchId}`
        );
      }
      if (
        staffProfile &&
        !staffProfile.departmentIds.includes(teacher.departmentId)
      ) {
        errors.push(
          `[teacherProfile:${teacher.id}] staff profile ${staffProfile.id} lacks department ${teacher.departmentId}`
        );
      }

      const seenClasses = new Set<string>();
      teacher.assignedClassIds.forEach(classGroupId => {
        if (seenClasses.has(classGroupId)) {
          errors.push(
            `[teacherProfile:${teacher.id}] repeats assigned class ${classGroupId}`
          );
        }
        seenClasses.add(classGroupId);

        const group = groupsById.get(classGroupId);
        const run = group ? runsById.get(group.courseRunId) : undefined;
        if (!group) {
          errors.push(
            `[teacherProfile:${teacher.id}] assigned class ${classGroupId} does not exist`
          );
        } else if (!run) {
          errors.push(
            `[teacherProfile:${teacher.id}] assigned class ${group.id} has missing run ${group.courseRunId}`
          );
        } else if (run.teacherId !== teacher.userId) {
          errors.push(
            `[teacherProfile:${teacher.id}] class ${group.id} run ${run.id} is assigned to ${run.teacherId}`
          );
        }
      });
    });

    state.enrollments.forEach(enrollment => {
      const run = runsById.get(enrollment.courseRunId);
      if (
        run &&
        enrollment.teacherId &&
        enrollment.teacherId !== run.teacherId
      ) {
        errors.push(
          `[enrollment:${enrollment.id}] teacher ${enrollment.teacherId} does not match run ${run.id} teacher ${run.teacherId}`
        );
      }
    });

    state.classGroups.forEach(group => {
      const run = runsById.get(group.courseRunId);
      if (!run) return;

      if (group.roomId) {
        const room = roomsById.get(group.roomId);
        if (!room) {
          errors.push(
            `[classGroup:${group.id}] room ${group.roomId} does not exist`
          );
        } else if (room.branchId !== run.branchId) {
          errors.push(
            `[classGroup:${group.id}] room ${room.id} uses branch ${room.branchId}, not run branch ${run.branchId}`
          );
        }
      }
      if (group.meetingLinkId && !meetingLinksById.has(group.meetingLinkId)) {
        errors.push(
          `[classGroup:${group.id}] meeting link ${group.meetingLinkId} does not exist`
        );
      }
    });

    state.events.forEach(event => {
      if (!event.classGroupId) return;

      const group = groupsById.get(event.classGroupId);
      const run = group ? runsById.get(group.courseRunId) : undefined;
      if (!group) {
        errors.push(
          `[event:${event.id}] class group ${event.classGroupId} does not exist`
        );
        return;
      }
      if (!run) return;

      if (event.ownerId !== run.teacherId) {
        errors.push(
          `[event:${event.id}] owner ${event.ownerId} does not match run ${run.id} teacher ${run.teacherId}`
        );
      }
      if (event.branchId !== run.branchId) {
        errors.push(
          `[event:${event.id}] branch ${event.branchId ?? "missing"} does not match run ${run.id} branch ${run.branchId}`
        );
      }
    });

    state.classSessions.forEach(session => {
      const event = eventsById.get(session.eventId);
      if (!event) {
        errors.push(
          `[classSession:${session.id}] event ${session.eventId} does not exist`
        );
      } else if (event.classGroupId !== session.classGroupId) {
        errors.push(
          `[classSession:${session.id}] event ${event.id} uses class group ${event.classGroupId ?? "missing"}, not ${session.classGroupId}`
        );
      }
    });

    state.teacherAvailability.forEach(availability => {
      const teacher = state.teachers.find(
        profile => profile.userId === availability.teacherId
      );
      const staffProfile = state.staffProfiles.find(
        profile =>
          profile.userId === availability.teacherId &&
          profile.role === "teacher"
      );
      if (!teacher) {
        errors.push(
          `[teacherAvailability:${availability.id}] teacher ${availability.teacherId} has no teacher profile`
        );
      }
      if (!staffProfile?.branchIds.includes(availability.branchId)) {
        errors.push(
          `[teacherAvailability:${availability.id}] teacher staff profile lacks branch ${availability.branchId}`
        );
      }
    });

    expectNoIntegrityErrors(errors);
  });
});
