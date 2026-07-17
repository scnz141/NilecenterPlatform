import type { PlatformState } from "../client/src/lib/domain/types.js";
import type { ServerSession } from "./auth.js";
import type {
  ExternalCourseReadModel,
  ExternalCourseSectionReadModel,
} from "./moodleReadModels.js";

export type MoodleMappingState =
  | "discovered"
  | "matched"
  | "synced"
  | "stale"
  | "error";

export const MOODLE_CATALOG_PROJECTION_ROLES = [
  "student",
  "teacher",
  "headofdepartment",
  "superadmin",
] as const;

const mappingStates = new Set<MoodleMappingState>([
  "discovered",
  "matched",
  "synced",
  "stale",
  "error",
]);

export type MoodleCourseMapping = Readonly<{
  internalCourseId: string;
  externalRecordId?: string;
  externalCourseId: string;
  state: MoodleMappingState;
  lastSeenAt?: string;
}>;

export type MoodleCourseProjection = Readonly<{
  internalCourseId?: string;
  mappingState: MoodleMappingState | "unmatched" | "missing";
  reconciliationReason?:
    | "missing_mapping"
    | "missing_provider_record"
    | "ambiguous_mapping";
  course?: ExternalCourseReadModel;
}>;

export type MoodleCourseContentProjection = Readonly<{
  internalCourseId: string;
  externalCourseId: string;
  mappingState: MoodleMappingState;
  sections: readonly ExternalCourseSectionReadModel[];
}>;

export class MoodleProjectionAuthorityError extends Error {
  constructor(message = "Moodle projection access is not authorized.") {
    super(message);
    this.name = "MoodleProjectionAuthorityError";
  }
}

export class MoodleProjectionMappingError extends Error {
  constructor(message = "Moodle projection mapping is invalid.") {
    super(message);
    this.name = "MoodleProjectionMappingError";
  }
}

export function assertMoodleProjectionIdentity(
  session: ServerSession,
  state: PlatformState
) {
  const user = state.users.find(item => item.id === session.userId);
  if (!user || user.status !== "active") {
    throw new MoodleProjectionAuthorityError(
      "The session has no active canonical Nile Learn identity."
    );
  }
  if (
    !session.roles.includes(session.activeRole) ||
    !user.roles.includes(session.activeRole)
  ) {
    throw new MoodleProjectionAuthorityError(
      "The active role is no longer granted."
    );
  }
  if (session.activeRole === "student") {
    const profile = state.students.find(
      item => item.userId === session.userId && item.status === "active"
    );
    if (!profile) throw new MoodleProjectionAuthorityError();
    return;
  }
  const staffProfile = state.staffProfiles.find(
    item =>
      item.userId === session.userId &&
      item.role === session.activeRole &&
      item.status === "active"
  );
  if (!staffProfile) throw new MoodleProjectionAuthorityError();
  if (session.activeRole === "teacher") {
    const teacherProfile = state.teachers.find(
      item => item.userId === session.userId && item.status === "active"
    );
    if (!teacherProfile) throw new MoodleProjectionAuthorityError();
  }
}

export function assertMoodleCatalogProjectionRole(session: ServerSession) {
  if (
    !MOODLE_CATALOG_PROJECTION_ROLES.some(role => role === session.activeRole)
  ) {
    throw new MoodleProjectionAuthorityError(
      "The active role cannot read Moodle catalog content."
    );
  }
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function sessionScopeIds(
  session: ServerSession,
  key: "branchIds" | "departmentIds",
  fallback?: string
) {
  const values = session[key] ?? (fallback ? [fallback] : []);
  return new Set(values.filter(Boolean));
}

export function resolveMoodleCourseAuthority(
  session: ServerSession,
  state: PlatformState
) {
  assertMoodleProjectionIdentity(session, state);

  if (session.activeRole === "superadmin") {
    return new Set(state.courses.map(course => course.id));
  }

  const user = state.users.find(item => item.id === session.userId)!;

  if (session.activeRole === "student") {
    const profile = state.students.find(item => item.userId === session.userId);
    if (!profile) return new Set<string>();
    return new Set(
      state.enrollments
        .filter(
          enrollment =>
            enrollment.studentId === profile.id &&
            ["active", "completed"].includes(enrollment.status)
        )
        .flatMap(enrollment => {
          const run = state.courseRuns.find(
            item => item.id === enrollment.courseRunId
          );
          return run ? [run.courseId] : [];
        })
    );
  }

  if (session.activeRole === "teacher") {
    return new Set(
      state.courseRuns
        .filter(
          run => run.teacherId === session.userId && run.status === "active"
        )
        .map(run => run.courseId)
    );
  }

  if (session.activeRole === "headofdepartment") {
    const departments = sessionScopeIds(
      session,
      "departmentIds",
      user.departmentId
    );
    const programIds = new Set(
      state.programs
        .filter(program => departments.has(program.departmentId))
        .map(program => program.id)
    );
    return new Set(
      state.courses
        .filter(course => programIds.has(course.programId))
        .map(course => course.id)
    );
  }

  return new Set<string>();
}

function indexMappings(mappings: readonly MoodleCourseMapping[]) {
  const byInternal = new Map<string, MoodleCourseMapping>();
  const byExternal = new Map<string, MoodleCourseMapping>();
  for (const mapping of mappings) {
    if (
      !mapping.internalCourseId ||
      !/^[1-9]\d*$/.test(mapping.externalCourseId) ||
      !Number.isSafeInteger(Number(mapping.externalCourseId)) ||
      !mappingStates.has(mapping.state)
    ) {
      throw new MoodleProjectionMappingError();
    }
    if (
      byInternal.has(mapping.internalCourseId) ||
      byExternal.has(mapping.externalCourseId)
    ) {
      throw new MoodleProjectionMappingError(
        "Moodle course mapping is ambiguous."
      );
    }
    byInternal.set(mapping.internalCourseId, mapping);
    byExternal.set(mapping.externalCourseId, mapping);
  }
  return { byInternal, byExternal };
}

export function validateMoodleCourseMappings(
  mappings: readonly MoodleCourseMapping[],
  state: PlatformState
) {
  const indexed = indexMappings(mappings);
  const courseIds = new Set(state.courses.map(course => course.id));
  if (mappings.some(mapping => !courseIds.has(mapping.internalCourseId))) {
    throw new MoodleProjectionMappingError(
      "Moodle course mapping references an unknown canonical course."
    );
  }
  return indexed;
}

export function validateMoodleCourseMappingsForAuthority(
  mappings: readonly MoodleCourseMapping[],
  authorizedCourseIds: Iterable<string>
) {
  const indexed = indexMappings(mappings);
  const courseIds = new Set(authorizedCourseIds);
  if (mappings.some(mapping => !courseIds.has(mapping.internalCourseId))) {
    throw new MoodleProjectionMappingError(
      "Moodle course mapping is outside canonical course authority."
    );
  }
  return indexed;
}

export function resolveMappedExternalCourseId(
  internalCourseId: string,
  mappings: readonly MoodleCourseMapping[]
) {
  const mapping = indexMappings(mappings).byInternal.get(internalCourseId);
  if (!mapping) {
    throw new MoodleProjectionMappingError(
      "Moodle course content requires an exact mapping."
    );
  }
  return mapping;
}

export function projectMoodleCourses(input: {
  session: ServerSession;
  state: PlatformState;
  mappings: readonly MoodleCourseMapping[];
  providerCourses: readonly ExternalCourseReadModel[];
}) {
  const authorizedCourseIds = resolveMoodleCourseAuthority(
    input.session,
    input.state
  );
  validateMoodleCourseMappings(input.mappings, input.state);
  return projectMoodleCoursesFromAuthority({
    activeRole: input.session.activeRole,
    authorizedCourseIds,
    mappings: input.mappings,
    providerCourses: input.providerCourses,
  });
}

export function projectMoodleCoursesFromAuthority(input: {
  activeRole: ServerSession["activeRole"];
  authorizedCourseIds: Iterable<string>;
  mappings: readonly MoodleCourseMapping[];
  providerCourses: readonly ExternalCourseReadModel[];
}) {
  const authorizedCourseIds = new Set(input.authorizedCourseIds);
  const { byInternal, byExternal } = validateMoodleCourseMappingsForAuthority(
    input.mappings,
    authorizedCourseIds
  );
  const providerById = new Map(
    input.providerCourses.map(course => [course.sourceId, course])
  );
  if (providerById.size !== input.providerCourses.length) {
    throw new MoodleProjectionMappingError(
      "Moodle returned duplicate course identifiers."
    );
  }

  const rows: MoodleCourseProjection[] = [];
  for (const internalCourseId of Array.from(authorizedCourseIds)) {
    const mapping = byInternal.get(internalCourseId);
    if (!mapping) {
      rows.push({
        internalCourseId,
        mappingState: "missing",
        reconciliationReason: "missing_mapping",
      });
      continue;
    }
    const course = providerById.get(mapping.externalCourseId);
    if (input.activeRole === "student" && course?.visible === false) {
      continue;
    }
    rows.push(
      course
        ? {
            internalCourseId,
            mappingState: mapping.state,
            course,
          }
        : {
            internalCourseId,
            mappingState: "missing",
            reconciliationReason: "missing_provider_record",
          }
    );
  }

  if (input.activeRole === "superadmin") {
    for (const course of input.providerCourses) {
      if (!byExternal.has(course.sourceId)) {
        rows.push({
          mappingState: "unmatched",
          reconciliationReason: "missing_mapping",
          course,
        });
      }
    }
  }

  return rows;
}

export function projectMoodleCourseContent(input: {
  session: ServerSession;
  state: PlatformState;
  mappings: readonly MoodleCourseMapping[];
  internalCourseId: string;
  sections: readonly ExternalCourseSectionReadModel[];
}) {
  const authorizedCourseIds = resolveMoodleCourseAuthority(
    input.session,
    input.state
  );
  validateMoodleCourseMappings(input.mappings, input.state);
  return projectMoodleCourseContentFromAuthority({
    activeRole: input.session.activeRole,
    authorizedCourseIds,
    mappings: input.mappings,
    internalCourseId: input.internalCourseId,
    sections: input.sections,
  });
}

export function projectMoodleCourseContentFromAuthority(input: {
  activeRole: ServerSession["activeRole"];
  authorizedCourseIds: Iterable<string>;
  mappings: readonly MoodleCourseMapping[];
  internalCourseId: string;
  sections: readonly ExternalCourseSectionReadModel[];
}) {
  const authorizedCourseIds = new Set(input.authorizedCourseIds);
  if (!authorizedCourseIds.has(input.internalCourseId)) {
    throw new MoodleProjectionAuthorityError();
  }
  validateMoodleCourseMappingsForAuthority(input.mappings, authorizedCourseIds);
  const mapping = resolveMappedExternalCourseId(
    input.internalCourseId,
    input.mappings
  );
  const sections =
    input.activeRole === "student"
      ? input.sections
          .filter(section => section.visible === true)
          .map(section => ({
            ...section,
            activities: section.activities.filter(
              activity => activity.visible === true
            ),
          }))
      : input.sections;
  return {
    internalCourseId: input.internalCourseId,
    externalCourseId: mapping.externalCourseId,
    mappingState: mapping.state,
    sections,
  } satisfies MoodleCourseContentProjection;
}

export function mappedExternalCourseIds(
  internalCourseIds: Iterable<string>,
  mappings: readonly MoodleCourseMapping[]
) {
  const { byInternal } = indexMappings(mappings);
  return unique(
    Array.from(internalCourseIds).flatMap(id => {
      const mapping = byInternal.get(id);
      return mapping ? [mapping.externalCourseId] : [];
    })
  );
}
