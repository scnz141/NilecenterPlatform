import type {
  Enrollment,
  Invoice,
  PlatformState,
  StudentEntrySource,
} from "./types.js";

type StudentIntakeLineageInput = {
  source?: StudentEntrySource;
  email: string;
  branchId: string;
  leadId?: string;
  applicationId?: string;
  placementTestId?: string;
};

export function assertStudentIntakeLineage(
  state: PlatformState,
  input: StudentIntakeLineageInput
) {
  const source = input.source ?? "direct";
  const lead = input.leadId
    ? state.leads.find(item => item.id === input.leadId)
    : undefined;
  const application = input.applicationId
    ? state.applications.find(item => item.id === input.applicationId)
    : undefined;
  const placement = input.placementTestId
    ? state.placementTests.find(item => item.id === input.placementTestId)
    : undefined;

  if (input.leadId && !lead) {
    throw new Error(`Lead ${input.leadId} was not found.`);
  }
  if (input.applicationId && !application) {
    throw new Error(`Application ${input.applicationId} was not found.`);
  }
  if (input.placementTestId && !placement) {
    throw new Error(`Placement test ${input.placementTestId} was not found.`);
  }

  if (
    source === "direct" &&
    (input.leadId || input.applicationId || input.placementTestId)
  ) {
    throw new Error("Direct student creation cannot use intake record links.");
  }
  if (source === "lead" && (!lead || application || placement)) {
    throw new Error("Lead student creation requires one exact lead record.");
  }
  if (source === "application" && (!application || placement)) {
    throw new Error(
      "Application student creation requires one exact application record."
    );
  }
  if (source === "placement" && !placement) {
    throw new Error(
      "Placement student creation requires one exact placement test."
    );
  }

  const applicationLead = application
    ? state.leads.find(item => item.id === application.leadId)
    : undefined;
  if (application && !applicationLead) {
    throw new Error(
      `Application ${application.id} does not reference a valid lead.`
    );
  }
  if (lead && application && application.leadId !== lead.id) {
    throw new Error("Student intake records do not belong to the same lead.");
  }
  if (lead && placement?.leadId && placement.leadId !== lead.id) {
    throw new Error("Student intake records do not belong to the same lead.");
  }
  if (
    application &&
    placement &&
    (!placement.leadId || placement.leadId !== application.leadId)
  ) {
    throw new Error("Student intake records do not belong to the same lead.");
  }

  const resolvedLead = lead ?? applicationLead;
  const normalizedEmail = input.email.trim().toLowerCase();
  const intakeEmails = [resolvedLead?.email, placement?.email]
    .filter((value): value is string => Boolean(value))
    .map(value => value.trim().toLowerCase());
  if (intakeEmails.some(value => value !== normalizedEmail)) {
    throw new Error("Student identity must match the linked intake records.");
  }
  if (
    (application && application.branchId !== input.branchId) ||
    (placement && placement.branchId !== input.branchId)
  ) {
    throw new Error("Student branch must match the linked intake records.");
  }

  return { source, lead: resolvedLead, application, placement };
}

export function teacherIdForEnrollment(
  state: PlatformState,
  enrollment: Enrollment
) {
  return (
    state.courseRuns.find(item => item.id === enrollment.courseRunId)
      ?.teacherId ?? enrollment.teacherId
  );
}

export function enrollmentsWithAuthoritativeTeachers(
  state: PlatformState,
  enrollments: Enrollment[]
) {
  let changed = false;
  const next = enrollments.map(enrollment => {
    const teacherId = teacherIdForEnrollment(state, enrollment);
    if (teacherId === enrollment.teacherId) return enrollment;
    changed = true;
    return { ...enrollment, teacherId };
  });
  return changed ? next : enrollments;
}

export function enrollmentHasRosterMembership(
  state: PlatformState,
  enrollment: Enrollment
) {
  if (!enrollment.classGroupId) return false;
  const group = state.classGroups.find(
    item => item.id === enrollment.classGroupId
  );
  return Boolean(
    group &&
      group.courseRunId === enrollment.courseRunId &&
      group.studentIds.includes(enrollment.studentId)
  );
}

export function teacherHasStudentRosterAuthority(
  state: PlatformState,
  teacherUserId: string,
  courseRunId: string,
  studentId: string
) {
  const run = state.courseRuns.find(
    item =>
      item.id === courseRunId &&
      item.teacherId === teacherUserId &&
      item.status === "active"
  );
  const student = state.students.find(item => item.id === studentId);
  const studentUser = student
    ? state.users.find(item => item.id === student.userId)
    : undefined;
  if (
    !run ||
    student?.status !== "active" ||
    studentUser?.status !== "active"
  ) {
    return false;
  }

  return state.enrollments.some(enrollment => {
    if (
      enrollment.studentId !== studentId ||
      enrollment.courseRunId !== run.id ||
      enrollment.status !== "active" ||
      !enrollment.classGroupId
    ) {
      return false;
    }
    const group = state.classGroups.find(
      item => item.id === enrollment.classGroupId
    );
    return Boolean(
      group &&
        group.courseRunId === run.id &&
        group.studentIds.includes(studentId)
    );
  });
}

export function enrollmentsWithoutInvalidRosterLinks(
  state: PlatformState,
  enrollments: Enrollment[]
) {
  let changed = false;
  const next = enrollments.map(enrollment => {
    if (
      !enrollment.classGroupId ||
      enrollmentHasRosterMembership(state, enrollment)
    ) {
      return enrollment;
    }
    changed = true;
    return { ...enrollment, classGroupId: undefined };
  });
  return changed ? next : enrollments;
}

export function enrollmentForInvoice(state: PlatformState, invoice: Invoice) {
  if (invoice.enrollmentId) {
    return state.enrollments.find(
      item =>
        item.id === invoice.enrollmentId && item.studentId === invoice.studentId
    );
  }
  const candidates = state.enrollments.filter(
    item => item.studentId === invoice.studentId
  );
  return candidates.length === 1 ? candidates[0] : undefined;
}

export function branchIdForInvoice(state: PlatformState, invoice: Invoice) {
  const exactEnrollment = enrollmentForInvoice(state, invoice);
  if (exactEnrollment) {
    return state.courseRuns.find(
      item => item.id === exactEnrollment.courseRunId
    )?.branchId;
  }
  if (invoice.enrollmentId) return undefined;

  const branchIds = new Set(
    state.enrollments
      .filter(item => item.studentId === invoice.studentId)
      .map(
        item =>
          state.courseRuns.find(run => run.id === item.courseRunId)?.branchId
      )
      .filter((branchId): branchId is string => Boolean(branchId))
  );
  return branchIds.size === 1 ? Array.from(branchIds)[0] : undefined;
}
