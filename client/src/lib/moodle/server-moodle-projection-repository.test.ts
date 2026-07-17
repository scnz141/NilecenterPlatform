import { describe, expect, it, vi } from "vitest";

import type { ServerSession } from "../../../../server/auth";
import {
  hashMoodleProjectionPayload,
  MoodleProjectionSnapshotError,
} from "../../../../server/moodleProjectionFreshness";
import {
  createSupabaseMoodleProjectionRepository,
  getMoodleProjectionRepository,
  MoodleProjectionRepositoryAuthorityError,
  MoodleProjectionRepositoryUnavailableError,
  resetDefaultMoodleProjectionRepository,
} from "../../../../server/moodleProjectionRepository";

const session: ServerSession = {
  id: "session-normalized",
  userId: "10000000-0000-4000-8000-000000000002",
  authUserId: "20000000-0000-4000-8000-000000000002",
  activeRoleGrantId: "30000000-0000-4000-8000-000000000002",
  email: "teacher@example.test",
  name: "Teacher Example",
  roles: ["teacher"],
  activeRole: "teacher",
  branchIds: ["40000000-0000-4000-8000-000000000001"],
  departmentIds: ["50000000-0000-4000-8000-000000000001"],
  provider: "supabase",
  authorizationModel: "normalized",
  createdAt: "2026-07-17T00:00:00.000Z",
  expiresAt: "2026-07-17T12:00:00.000Z",
};

const courseId = "60000000-0000-4000-8000-000000000001";
const otherCourseId = "60000000-0000-4000-8000-000000000002";
const connectionId = "70000000-0000-4000-8000-000000000001";
const externalRecordId = "80000000-0000-4000-8000-000000000001";
const syncRunId = "90000000-0000-4000-8000-000000000001";
const payloadHash = "a".repeat(64);
const userId = "10000000-0000-4000-8000-000000000002";
const otherUserId = "10000000-0000-4000-8000-000000000003";
const userExternalRecordId = "80000000-0000-4000-8000-000000000002";
const courseRunId = "61000000-0000-4000-8000-000000000001";
const classGroupId = "62000000-0000-4000-8000-000000000001";
const enrollmentId = "63000000-0000-4000-8000-000000000001";
const membershipId = "64000000-0000-4000-8000-000000000001";
const assignmentProjectionId = "81000000-0000-4000-8000-000000000001";
const quizProjectionId = "81000000-0000-4000-8000-000000000002";
const quizAttemptProjectionId = "82000000-0000-4000-8000-000000000001";
const gradeItemProjectionId = "83000000-0000-4000-8000-000000000001";
const activityProjectionId = "84000000-0000-4000-8000-000000000001";

const authority = {
  connectionId,
  activeRole: "teacher" as const,
  authorizedCourseIds: [courseId],
  observedAt: "2026-07-17T01:00:00.000Z",
};

function observationRow(overrides: Record<string, unknown> = {}) {
  return {
    connection_id: connectionId,
    active_role: "teacher",
    internal_course_id: courseId,
    external_course_id: "42",
    mapping_state: "synced",
    projection_family: "course_content",
    freshness_state: "fresh",
    latest_outcome: "available",
    reconciliation_reason: null,
    sanitized_payload: [{ sourceId: "section-1" }],
    projection_hash: `\\x${payloadHash.toUpperCase()}`,
    successful_sync_run_id: syncRunId,
    successful_observed_at: "2026-07-17T01:05:00.000Z",
    fresh_until: "2026-07-17T01:20:00.000Z",
    retain_until: "2026-07-24T01:05:00.000Z",
    latest_observed_at: "2026-07-17T01:05:00.000Z",
    ...overrides,
  };
}

function enrollmentContextRow(overrides: Record<string, unknown> = {}) {
  return {
    connection_id: connectionId,
    active_role: "teacher",
    projection_audience: "person_level",
    internal_course_id: courseId,
    internal_course_run_id: courseRunId,
    internal_class_group_id: classGroupId,
    authorized_user_ids: [otherUserId],
    course_mapping_status: "exact",
    group_mapping_status: "exact",
    user_mapping_status: "exact",
    observed_at: "2026-07-17T01:00:00.000Z",
    ...overrides,
  };
}

function enrollmentFreshnessRow(overrides: Record<string, unknown> = {}) {
  const sanitizedPayload = {
    internalCourseId: courseId,
    internalClassGroupId: classGroupId,
    providerState: "available",
    mappingStatus: "exact",
    learners: [
      {
        internalUserId: otherUserId,
        internalEnrollmentId: enrollmentId,
        internalMembershipId: membershipId,
        providerState: "enrolled",
        mappingStatus: "exact",
      },
    ],
  };
  const row = {
    connection_id: connectionId,
    active_role: "teacher",
    projection_audience: "person_level",
    internal_course_id: courseId,
    internal_class_group_id: classGroupId,
    course_mapping_status: "exact",
    group_mapping_status: "exact",
    user_mapping_status: "exact",
    freshness_state: "fresh",
    latest_outcome: "available",
    reconciliation_reason: null,
    sanitized_payload: sanitizedPayload,
    projection_hash: `\\x${hashMoodleProjectionPayload(sanitizedPayload)}`,
    successful_sync_run_id: syncRunId,
    successful_observed_at: "2026-07-17T01:05:00.000Z",
    fresh_until: "2026-07-17T01:20:00.000Z",
    retain_until: "2026-07-24T01:05:00.000Z",
    latest_observed_at: "2026-07-17T01:05:00.000Z",
    authority_observed_at: "2026-07-17T01:10:00.000Z",
    ...overrides,
  };
  if (
    Object.hasOwn(overrides, "sanitized_payload") &&
    !Object.hasOwn(overrides, "projection_hash") &&
    row.sanitized_payload
  ) {
    row.projection_hash = `\\x${hashMoodleProjectionPayload(
      row.sanitized_payload
    )}`;
  }
  return row;
}

function assessmentContextRow(overrides: Record<string, unknown> = {}) {
  return {
    connection_id: connectionId,
    active_role: "teacher",
    projection_audience: "class_staff",
    internal_course_id: courseId,
    internal_course_run_id: courseRunId,
    internal_class_group_id: classGroupId,
    subject_user_id: null,
    course_mapping_status: "exact",
    group_mapping_status: "exact",
    user_mapping_status: "not_required",
    assessment_mapping_status: "exact",
    observed_at: "2026-07-17T01:00:00.000Z",
    ...overrides,
  };
}

function assessmentFreshnessRow(overrides: Record<string, unknown> = {}) {
  const sanitizedPayload = {
    internalCourseId: courseId,
    internalClassGroupId: classGroupId,
    providerState: "available",
    mappingStatus: "exact",
    items: [
      {
        projectionId: assignmentProjectionId,
        kind: "assignment",
        title: "Grammar worksheet",
        visibility: "visible",
        scheduleState: "open",
        opensAt: "2026-07-17T00:00:00.000Z",
        dueAt: "2026-07-20T00:00:00.000Z",
        cutoffAt: "2026-07-21T00:00:00.000Z",
        acceptsSubmissions: true,
      },
      {
        projectionId: quizProjectionId,
        kind: "quiz",
        title: "Module quiz",
        visibility: "visible",
        scheduleState: "scheduled",
        opensAt: "2026-07-18T00:00:00.000Z",
        closesAt: "2026-07-19T00:00:00.000Z",
      },
    ],
  };
  const row = {
    ...assessmentContextRow(),
    freshness_state: "fresh",
    latest_outcome: "available",
    reconciliation_reason: null,
    sanitized_payload: sanitizedPayload,
    projection_hash: `\\x${hashMoodleProjectionPayload(sanitizedPayload)}`,
    successful_sync_run_id: syncRunId,
    successful_observed_at: "2026-07-17T01:05:00.000Z",
    fresh_until: "2026-07-17T01:20:00.000Z",
    retain_until: "2026-07-24T01:05:00.000Z",
    latest_observed_at: "2026-07-17T01:05:00.000Z",
    authority_observed_at: "2026-07-17T01:10:00.000Z",
    ...overrides,
  };
  if (
    Object.hasOwn(overrides, "sanitized_payload") &&
    !Object.hasOwn(overrides, "projection_hash") &&
    row.sanitized_payload
  ) {
    row.projection_hash = `\\x${hashMoodleProjectionPayload(
      row.sanitized_payload
    )}`;
  }
  return row;
}

function assignmentResultContextRow(overrides: Record<string, unknown> = {}) {
  return {
    connection_id: connectionId,
    active_role: "teacher",
    projection_audience: "person_level",
    internal_course_id: courseId,
    internal_course_run_id: courseRunId,
    internal_class_group_id: classGroupId,
    assignment_projection_id: assignmentProjectionId,
    authorized_user_ids: [otherUserId],
    course_mapping_status: "exact",
    group_mapping_status: "exact",
    user_mapping_status: "exact",
    assignment_mapping_status: "exact",
    observed_at: "2026-07-17T01:00:00.000Z",
    ...overrides,
  };
}

function assignmentResultFreshnessRow(overrides: Record<string, unknown> = {}) {
  const sanitizedPayload = {
    internalCourseId: courseId,
    internalClassGroupId: classGroupId,
    assignmentProjectionId,
    providerState: "available",
    mappingStatus: "exact",
    learners: [
      {
        internalUserId: otherUserId,
        internalEnrollmentId: enrollmentId,
        internalMembershipId: membershipId,
        submissionState: "submitted",
        attemptNumber: 1,
        gradingState: "graded",
        latest: true,
        submittedAt: "2026-07-17T00:30:00.000Z",
        modifiedAt: "2026-07-17T00:35:00.000Z",
        score: 84,
        maximumScore: 100,
        gradedAt: "2026-07-17T00:50:00.000Z",
      },
    ],
  };
  const row = {
    ...assignmentResultContextRow(),
    freshness_state: "fresh",
    latest_outcome: "available",
    reconciliation_reason: null,
    sanitized_payload: sanitizedPayload,
    projection_hash: `\\x${hashMoodleProjectionPayload(sanitizedPayload)}`,
    successful_sync_run_id: syncRunId,
    successful_observed_at: "2026-07-17T01:05:00.000Z",
    fresh_until: "2026-07-17T01:20:00.000Z",
    retain_until: "2026-07-24T01:05:00.000Z",
    latest_observed_at: "2026-07-17T01:05:00.000Z",
    authority_observed_at: "2026-07-17T01:10:00.000Z",
    ...overrides,
  };
  if (
    Object.hasOwn(overrides, "sanitized_payload") &&
    !Object.hasOwn(overrides, "projection_hash") &&
    row.sanitized_payload
  ) {
    row.projection_hash = `\\x${hashMoodleProjectionPayload(
      row.sanitized_payload
    )}`;
  }
  return row;
}

function quizAttemptContextRow(overrides: Record<string, unknown> = {}) {
  return {
    connection_id: connectionId,
    active_role: "teacher",
    projection_audience: "person_level",
    internal_course_id: courseId,
    internal_course_run_id: courseRunId,
    internal_class_group_id: classGroupId,
    quiz_projection_id: quizProjectionId,
    authorized_user_ids: [otherUserId],
    course_mapping_status: "exact",
    group_mapping_status: "exact",
    user_mapping_status: "exact",
    quiz_mapping_status: "exact",
    observed_at: "2026-07-17T01:00:00.000Z",
    ...overrides,
  };
}

function quizAttemptFreshnessRow(overrides: Record<string, unknown> = {}) {
  const sanitizedPayload = {
    internalCourseId: courseId,
    internalClassGroupId: classGroupId,
    quizProjectionId,
    providerState: "available",
    mappingStatus: "exact",
    learners: [
      {
        internalUserId: otherUserId,
        internalEnrollmentId: enrollmentId,
        internalMembershipId: membershipId,
        attemptProjectionId: quizAttemptProjectionId,
        attemptState: "finished",
        attemptNumber: 1,
        gradingState: "graded",
        latest: true,
        preview: false,
        startedAt: "2026-07-17T00:30:00.000Z",
        finishedAt: "2026-07-17T00:45:00.000Z",
        score: 9,
        maximumScore: 10,
      },
    ],
  };
  const row = {
    ...quizAttemptContextRow(),
    freshness_state: "fresh",
    latest_outcome: "available",
    reconciliation_reason: null,
    sanitized_payload: sanitizedPayload,
    projection_hash: `\\x${hashMoodleProjectionPayload(sanitizedPayload)}`,
    successful_sync_run_id: syncRunId,
    successful_observed_at: "2026-07-17T01:05:00.000Z",
    fresh_until: "2026-07-17T01:20:00.000Z",
    retain_until: "2026-07-24T01:05:00.000Z",
    latest_observed_at: "2026-07-17T01:05:00.000Z",
    authority_observed_at: "2026-07-17T01:10:00.000Z",
    ...overrides,
  };
  if (
    Object.hasOwn(overrides, "sanitized_payload") &&
    !Object.hasOwn(overrides, "projection_hash") &&
    row.sanitized_payload
  ) {
    row.projection_hash = `\\x${hashMoodleProjectionPayload(
      row.sanitized_payload
    )}`;
  }
  return row;
}

function gradeOutcomeContextRow(overrides: Record<string, unknown> = {}) {
  return {
    connection_id: connectionId,
    active_role: "teacher",
    projection_audience: "person_level",
    internal_course_id: courseId,
    internal_course_run_id: courseRunId,
    internal_class_group_id: classGroupId,
    grade_item_projection_id: gradeItemProjectionId,
    authorized_user_ids: [otherUserId],
    course_mapping_status: "exact",
    group_mapping_status: "exact",
    user_mapping_status: "exact",
    grade_item_mapping_status: "exact",
    observed_at: "2026-07-17T01:00:00.000Z",
    ...overrides,
  };
}

function gradeOutcomeFreshnessRow(overrides: Record<string, unknown> = {}) {
  const sanitizedPayload = {
    internalCourseId: courseId,
    internalClassGroupId: classGroupId,
    gradeItemProjectionId,
    providerState: "available",
    mappingStatus: "exact",
    learners: [
      {
        internalUserId: otherUserId,
        internalEnrollmentId: enrollmentId,
        internalMembershipId: membershipId,
        gradingState: "released",
        score: 18,
        maximumScore: 20,
        gradedAt: "2026-07-17T00:50:00.000Z",
        releasedAt: "2026-07-17T01:00:00.000Z",
        feedback: "Accurate work with clear reasoning.",
      },
    ],
  };
  const row = {
    ...gradeOutcomeContextRow(),
    freshness_state: "fresh",
    latest_outcome: "available",
    reconciliation_reason: null,
    sanitized_payload: sanitizedPayload,
    projection_hash: `\\x${hashMoodleProjectionPayload(sanitizedPayload)}`,
    successful_sync_run_id: syncRunId,
    successful_observed_at: "2026-07-17T01:05:00.000Z",
    fresh_until: "2026-07-17T01:20:00.000Z",
    retain_until: "2026-07-24T01:05:00.000Z",
    latest_observed_at: "2026-07-17T01:05:00.000Z",
    authority_observed_at: "2026-07-17T01:10:00.000Z",
    ...overrides,
  };
  if (
    Object.hasOwn(overrides, "sanitized_payload") &&
    !Object.hasOwn(overrides, "projection_hash") &&
    row.sanitized_payload
  ) {
    row.projection_hash = `\\x${hashMoodleProjectionPayload(
      row.sanitized_payload
    )}`;
  }
  return row;
}

function activityOutcomeContextRow(overrides: Record<string, unknown> = {}) {
  return {
    connection_id: connectionId,
    active_role: "teacher",
    projection_audience: "person_level",
    internal_course_id: courseId,
    internal_course_run_id: courseRunId,
    internal_class_group_id: classGroupId,
    activity_projection_id: activityProjectionId,
    activity_kind: "h5p",
    authorized_user_ids: [otherUserId],
    course_mapping_status: "exact",
    group_mapping_status: "exact",
    user_mapping_status: "exact",
    activity_mapping_status: "exact",
    observed_at: "2026-07-17T01:00:00.000Z",
    ...overrides,
  };
}

function activityOutcomeFreshnessRow(overrides: Record<string, unknown> = {}) {
  const sanitizedPayload = {
    internalCourseId: courseId,
    internalClassGroupId: classGroupId,
    activityProjectionId,
    activityKind: "h5p",
    providerState: "available",
    mappingStatus: "exact",
    learners: [
      {
        internalUserId: otherUserId,
        internalEnrollmentId: enrollmentId,
        internalMembershipId: membershipId,
        completionState: "passed",
        scoreState: "released",
        completedAt: "2026-07-17T00:50:00.000Z",
        score: 9,
        maximumScore: 10,
        releasedAt: "2026-07-17T01:00:00.000Z",
      },
    ],
  };
  const row = {
    ...activityOutcomeContextRow(),
    freshness_state: "fresh",
    latest_outcome: "available",
    reconciliation_reason: null,
    sanitized_payload: sanitizedPayload,
    projection_hash: `\\x${hashMoodleProjectionPayload(sanitizedPayload)}`,
    successful_sync_run_id: syncRunId,
    successful_observed_at: "2026-07-17T01:05:00.000Z",
    fresh_until: "2026-07-17T01:20:00.000Z",
    retain_until: "2026-07-24T01:05:00.000Z",
    latest_observed_at: "2026-07-17T01:05:00.000Z",
    authority_observed_at: "2026-07-17T01:10:00.000Z",
    ...overrides,
  };
  if (
    Object.hasOwn(overrides, "sanitized_payload") &&
    !Object.hasOwn(overrides, "projection_hash") &&
    row.sanitized_payload
  ) {
    row.projection_hash = `\\x${hashMoodleProjectionPayload(
      row.sanitized_payload
    )}`;
  }
  return row;
}

function response(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function repository(adminFetch: ReturnType<typeof vi.fn>) {
  return createSupabaseMoodleProjectionRepository({
    env: {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SECRET_KEY: "server-only-test-key",
    },
    adminFetch,
  });
}

describe("Supabase Moodle projection repository", () => {
  it("rejects missing server-only Supabase configuration", () => {
    expect(() => createSupabaseMoodleProjectionRepository({ env: {} })).toThrow(
      MoodleProjectionRepositoryUnavailableError
    );
  });

  it("rejects demo and non-normalized sessions before database access", async () => {
    const adminFetch = vi.fn();
    const store = repository(adminFetch);

    await expect(
      store.resolveCourseAuthority({
        ...session,
        provider: "demo",
        authorizationModel: "compatibility",
      })
    ).rejects.toThrow(MoodleProjectionRepositoryAuthorityError);
    expect(adminFetch).not.toHaveBeenCalled();
  });

  it("resolves exactly one normalized authority row through the service RPC", async () => {
    const adminFetch = vi.fn(async () =>
      response([
        {
          connection_id: connectionId,
          active_role: "teacher",
          authorized_course_ids: [courseId],
          observed_at: "2026-07-17T01:00:00.000Z",
        },
      ])
    );
    const store = repository(adminFetch);

    await expect(store.resolveCourseAuthority(session)).resolves.toEqual({
      connectionId,
      activeRole: "teacher",
      authorizedCourseIds: [courseId],
      observedAt: "2026-07-17T01:00:00.000Z",
    });
    expect(adminFetch).toHaveBeenCalledWith(
      "rpc/resolve_moodle_projection_context",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          p_user_id: session.userId,
          p_active_role_grant_id: session.activeRoleGrantId,
        }),
      }),
      expect.any(Object)
    );
  });

  it.each([
    [[], "ambiguous"],
    [
      [
        {
          active_role: "teacher",
          authorized_course_ids: [courseId],
          observed_at: "2026-07-17T01:00:00.000Z",
        },
        {
          active_role: "teacher",
          authorized_course_ids: [courseId],
          observed_at: "2026-07-17T01:00:00.000Z",
        },
      ],
      "ambiguous",
    ],
  ])("fails closed for %s authority rows", async payload => {
    const store = repository(vi.fn(async () => response(payload)));
    await expect(store.resolveCourseAuthority(session)).rejects.toThrow(
      MoodleProjectionRepositoryUnavailableError
    );
  });

  it("rejects role drift and duplicate authority IDs", async () => {
    const roleDrift = repository(
      vi.fn(async () =>
        response([
          {
            active_role: "superadmin",
            authorized_course_ids: [courseId],
            observed_at: "2026-07-17T01:00:00.000Z",
          },
        ])
      )
    );
    await expect(roleDrift.resolveCourseAuthority(session)).rejects.toThrow(
      MoodleProjectionRepositoryAuthorityError
    );

    const duplicates = repository(
      vi.fn(async () =>
        response([
          {
            active_role: "teacher",
            authorized_course_ids: [courseId, courseId],
            observed_at: "2026-07-17T01:00:00.000Z",
          },
        ])
      )
    );
    await expect(duplicates.resolveCourseAuthority(session)).rejects.toThrow(
      MoodleProjectionRepositoryUnavailableError
    );
  });

  it("loads exact Moodle course mappings through the service RPC", async () => {
    const adminFetch = vi.fn(async () =>
      response([
        {
          external_record_id: externalRecordId,
          internal_course_id: courseId,
          external_course_id: "42",
          sync_state: "synced",
          last_seen_at: "2026-07-17T01:00:00.000Z",
        },
      ])
    );
    const store = repository(adminFetch);

    await expect(
      store.listCourseMappings(connectionId, [courseId, courseId])
    ).resolves.toEqual([
      {
        externalRecordId,
        internalCourseId: courseId,
        externalCourseId: "42",
        state: "synced",
        lastSeenAt: "2026-07-17T01:00:00.000Z",
      },
    ]);
    expect(adminFetch).toHaveBeenCalledWith(
      "rpc/list_moodle_course_mappings_for_connection",
      expect.objectContaining({
        body: JSON.stringify({
          p_connection_id: connectionId,
          p_internal_course_ids: [courseId],
        }),
      }),
      expect.any(Object)
    );
  });

  it("short-circuits empty mapping scope without database access", async () => {
    const adminFetch = vi.fn();
    await expect(
      repository(adminFetch).listCourseMappings(connectionId, [])
    ).resolves.toEqual([]);
    expect(adminFetch).not.toHaveBeenCalled();
  });

  it("resolves exact normalized user authority through the service RPC", async () => {
    const adminFetch = vi.fn(async () =>
      response([
        {
          active_role: "teacher",
          authorized_user_ids: [userId, otherUserId],
          observed_at: "2026-07-17T01:00:00.000Z",
        },
      ])
    );

    await expect(
      repository(adminFetch).resolveUserAuthority(session)
    ).resolves.toEqual({
      activeRole: "teacher",
      authorizedUserIds: [userId, otherUserId],
      observedAt: "2026-07-17T01:00:00.000Z",
    });
    expect(adminFetch).toHaveBeenCalledWith(
      "rpc/resolve_moodle_user_projection_authority",
      expect.objectContaining({
        body: JSON.stringify({
          p_user_id: session.userId,
          p_active_role_grant_id: session.activeRoleGrantId,
        }),
      }),
      expect.any(Object)
    );
  });

  it("rejects unsupported, demo, role-drift, and duplicate user authority", async () => {
    const adminFetch = vi.fn();
    await expect(
      repository(adminFetch).resolveUserAuthority({
        ...session,
        activeRole: "registrar",
        roles: ["registrar"],
      })
    ).rejects.toThrow(MoodleProjectionRepositoryAuthorityError);
    await expect(
      repository(adminFetch).resolveUserAuthority({
        ...session,
        provider: "demo",
        authorizationModel: "compatibility",
      })
    ).rejects.toThrow(MoodleProjectionRepositoryAuthorityError);
    expect(adminFetch).not.toHaveBeenCalled();

    const roleDrift = repository(
      vi.fn(async () =>
        response([
          {
            active_role: "superadmin",
            authorized_user_ids: [userId],
            observed_at: "2026-07-17T01:00:00.000Z",
          },
        ])
      )
    );
    await expect(roleDrift.resolveUserAuthority(session)).rejects.toThrow(
      MoodleProjectionRepositoryAuthorityError
    );

    const duplicates = repository(
      vi.fn(async () =>
        response([
          {
            active_role: "teacher",
            authorized_user_ids: [userId, userId],
            observed_at: "2026-07-17T01:00:00.000Z",
          },
        ])
      )
    );
    await expect(duplicates.resolveUserAuthority(session)).rejects.toThrow(
      MoodleProjectionRepositoryUnavailableError
    );
  });

  it("loads exact Moodle user mappings through the bounded service RPC", async () => {
    const adminFetch = vi.fn(async () =>
      response([
        {
          external_record_id: userExternalRecordId,
          internal_user_id: userId,
          external_user_id: "1042",
          sync_state: "matched",
          last_seen_at: "2026-07-17T01:00:00.000Z",
        },
      ])
    );

    await expect(
      repository(adminFetch).listUserMappings(connectionId, [userId, userId])
    ).resolves.toEqual([
      {
        externalRecordId: userExternalRecordId,
        internalUserId: userId,
        externalUserId: "1042",
        state: "matched",
        lastSeenAt: "2026-07-17T01:00:00.000Z",
      },
    ]);
    expect(adminFetch).toHaveBeenCalledWith(
      "rpc/list_moodle_user_mappings_for_connection",
      expect.objectContaining({
        body: JSON.stringify({
          p_connection_id: connectionId,
          p_internal_user_ids: [userId],
        }),
      }),
      expect.any(Object)
    );
  });

  it("short-circuits empty user mapping scope", async () => {
    const adminFetch = vi.fn();
    await expect(
      repository(adminFetch).listUserMappings(connectionId, [])
    ).resolves.toEqual([]);
    expect(adminFetch).not.toHaveBeenCalled();
  });

  it("rejects malformed, out-of-scope, and duplicate user mappings", async () => {
    const malformed = repository(
      vi.fn(async () =>
        response([
          {
            external_record_id: userExternalRecordId,
            internal_user_id: userId,
            external_user_id: "not-an-id",
            sync_state: "matched",
          },
        ])
      )
    );
    await expect(
      malformed.listUserMappings(connectionId, [userId])
    ).rejects.toThrow(MoodleProjectionRepositoryUnavailableError);

    const outsideScope = repository(
      vi.fn(async () =>
        response([
          {
            external_record_id: userExternalRecordId,
            internal_user_id: otherUserId,
            external_user_id: "1042",
            sync_state: "matched",
          },
        ])
      )
    );
    await expect(
      outsideScope.listUserMappings(connectionId, [userId])
    ).rejects.toThrow(MoodleProjectionRepositoryAuthorityError);

    const duplicateExternal = repository(
      vi.fn(async () =>
        response([
          {
            external_record_id: userExternalRecordId,
            internal_user_id: userId,
            external_user_id: "1042",
            sync_state: "matched",
          },
          {
            external_record_id: externalRecordId,
            internal_user_id: otherUserId,
            external_user_id: "1042",
            sync_state: "synced",
          },
        ])
      )
    );
    await expect(
      duplicateExternal.listUserMappings(connectionId, [userId, otherUserId])
    ).rejects.toThrow(MoodleProjectionRepositoryUnavailableError);
  });

  it.each([
    { external_course_id: "not-an-id", sync_state: "synced" },
    { external_course_id: "42", sync_state: "ignored" },
  ])("rejects malformed mapping data", async malformed => {
    const store = repository(
      vi.fn(async () =>
        response([
          {
            internal_course_id: courseId,
            last_seen_at: "2026-07-17T01:00:00.000Z",
            ...malformed,
          },
        ])
      )
    );
    await expect(
      store.listCourseMappings(connectionId, [courseId])
    ).rejects.toThrow(MoodleProjectionRepositoryUnavailableError);
  });

  it("rejects mappings outside the requested scope and duplicate identities", async () => {
    const otherCourseId = "40000000-0000-4000-8000-000000000099";
    const outsideScope = repository(
      vi.fn(async () =>
        response([
          {
            external_record_id: externalRecordId,
            internal_course_id: otherCourseId,
            external_course_id: "99",
            sync_state: "synced",
          },
        ])
      )
    );
    await expect(
      outsideScope.listCourseMappings(connectionId, [courseId])
    ).rejects.toThrow(MoodleProjectionRepositoryAuthorityError);

    const duplicateExternal = repository(
      vi.fn(async () =>
        response([
          {
            external_record_id: externalRecordId,
            internal_course_id: courseId,
            external_course_id: "42",
            sync_state: "synced",
          },
          {
            external_record_id: "60000000-0000-4000-8000-000000000099",
            internal_course_id: otherCourseId,
            external_course_id: "42",
            sync_state: "synced",
          },
        ])
      )
    );
    await expect(
      duplicateExternal.listCourseMappings(connectionId, [
        courseId,
        otherCourseId,
      ])
    ).rejects.toThrow(MoodleProjectionRepositoryUnavailableError);
  });

  it("parses a fresh retained observation and sends the exact scoped RPC body", async () => {
    const adminFetch = vi.fn(async () => response([observationRow()]));
    const store = repository(adminFetch);

    await expect(
      store.listProjectionObservations({
        session,
        authority,
        projectionFamily: "course_content",
        asOf: "2026-07-17T01:10:00.000Z",
        internalCourseIds: [courseId],
      })
    ).resolves.toEqual([
      {
        internalCourseId: courseId,
        externalCourseId: "42",
        mappingState: "synced",
        observation: {
          projectionFamily: "course_content",
          internalCourseId: courseId,
          externalCourseId: "42",
          latestOutcome: "available",
          lastAttemptedAt: "2026-07-17T01:05:00.000Z",
          lastSuccess: {
            runId: syncRunId,
            payload: [{ sourceId: "section-1" }],
            payloadHash,
            itemCount: 1,
            observedAt: "2026-07-17T01:05:00.000Z",
            freshUntil: "2026-07-17T01:20:00.000Z",
            retainUntil: "2026-07-24T01:05:00.000Z",
          },
        },
      },
    ]);
    expect(adminFetch).toHaveBeenCalledWith(
      "rpc/list_authorized_moodle_projection_freshness",
      {
        method: "POST",
        body: JSON.stringify({
          p_user_id: session.userId,
          p_active_role_grant_id: session.activeRoleGrantId,
          p_connection_id: connectionId,
          p_projection_family: "course_content",
          p_as_of: "2026-07-17T01:10:00.000Z",
          p_internal_course_ids: [courseId],
        }),
      },
      expect.any(Object)
    );
  });

  it("keeps catalog observations all-authorized when no course filter is provided", async () => {
    const adminFetch = vi.fn(async () =>
      response([observationRow({ projection_family: "course_catalog" })])
    );
    const store = repository(adminFetch);

    await store.listProjectionObservations({
      session,
      authority,
      projectionFamily: "course_catalog",
      asOf: "2026-07-17T01:10:00.000Z",
    });

    expect(adminFetch).toHaveBeenCalledWith(
      "rpc/list_authorized_moodle_projection_freshness",
      {
        method: "POST",
        body: JSON.stringify({
          p_user_id: session.userId,
          p_active_role_grant_id: session.activeRoleGrantId,
          p_connection_id: connectionId,
          p_projection_family: "course_catalog",
          p_as_of: "2026-07-17T01:10:00.000Z",
          p_internal_course_ids: null,
        }),
      },
      expect.any(Object)
    );
  });

  it("rejects exact-course filters and rows outside their authorized subset", async () => {
    const adminFetch = vi.fn();
    const store = repository(adminFetch);
    await expect(
      store.listProjectionObservations({
        session,
        authority,
        projectionFamily: "course_content",
        asOf: "2026-07-17T01:10:00.000Z",
        internalCourseIds: [otherCourseId],
      })
    ).rejects.toThrow(MoodleProjectionRepositoryAuthorityError);
    expect(adminFetch).not.toHaveBeenCalled();

    const broadAuthority = {
      ...authority,
      authorizedCourseIds: [courseId, otherCourseId],
    };
    const escapingStore = repository(
      vi.fn(async () =>
        response([observationRow({ internal_course_id: otherCourseId })])
      )
    );
    await expect(
      escapingStore.listProjectionObservations({
        session,
        authority: broadAuthority,
        projectionFamily: "course_content",
        asOf: "2026-07-17T01:10:00.000Z",
        internalCourseIds: [courseId],
      })
    ).rejects.toThrow(MoodleProjectionRepositoryAuthorityError);
  });

  it("retains the last successful projection when the latest attempt is unavailable", async () => {
    const store = repository(
      vi.fn(async () =>
        response([
          observationRow({
            freshness_state: "stale",
            latest_outcome: "unavailable",
            latest_observed_at: "2026-07-17T01:15:00.000Z",
          }),
        ])
      )
    );

    const [result] = await store.listProjectionObservations({
      session,
      authority,
      projectionFamily: "course_content",
      asOf: "2026-07-17T01:16:00.000Z",
    });

    expect(result.observation).toMatchObject({
      latestOutcome: "unavailable",
      lastAttemptedAt: "2026-07-17T01:15:00.000Z",
      lastSuccess: {
        runId: syncRunId,
        payloadHash,
        payload: [{ sourceId: "section-1" }],
      },
    });
  });

  it("returns a null observation when the authorized course has no observation", async () => {
    const store = repository(
      vi.fn(async () =>
        response([
          observationRow({
            latest_outcome: null,
            sanitized_payload: null,
            projection_hash: null,
            successful_sync_run_id: null,
            successful_observed_at: null,
            fresh_until: null,
            retain_until: null,
            latest_observed_at: null,
          }),
        ])
      )
    );

    await expect(
      store.listProjectionObservations({
        session,
        authority,
        projectionFamily: "course_content",
        asOf: "2026-07-17T01:10:00.000Z",
      })
    ).resolves.toEqual([
      {
        internalCourseId: courseId,
        externalCourseId: "42",
        mappingState: "synced",
        observation: null,
      },
    ]);
  });

  it.each([
    ["projection hash", { projection_hash: "\\xnot-a-sha256" }],
    ["latest timestamp", { latest_observed_at: "not-a-timestamp" }],
    ["successful timestamp", { successful_observed_at: "invalid" }],
    ["fresh timestamp", { fresh_until: "invalid" }],
    ["retention timestamp", { retain_until: "invalid" }],
    ["retained metadata", { projection_hash: null }],
    [
      "retained payload",
      {
        sanitized_payload: null,
        projection_hash: `\\x${payloadHash}`,
      },
    ],
  ])("rejects malformed observation %s", async (_label, overrides) => {
    const store = repository(
      vi.fn(async () => response([observationRow(overrides)]))
    );

    await expect(
      store.listProjectionObservations({
        session,
        authority,
        projectionFamily: "course_content",
        asOf: "2026-07-17T01:10:00.000Z",
      })
    ).rejects.toThrow(MoodleProjectionRepositoryUnavailableError);
  });

  it("rejects session role drift before observation database access", async () => {
    const adminFetch = vi.fn();
    const store = repository(adminFetch);

    await expect(
      store.listProjectionObservations({
        session: { ...session, activeRole: "superadmin" },
        authority,
        projectionFamily: "course_content",
        asOf: "2026-07-17T01:10:00.000Z",
      })
    ).rejects.toThrow(MoodleProjectionRepositoryAuthorityError);
    expect(adminFetch).not.toHaveBeenCalled();
  });

  it.each([
    ["connection", { connection_id: externalRecordId }],
    ["role", { active_role: "superadmin" }],
    ["projection family", { projection_family: "course_catalog" }],
  ])("rejects observation %s context drift", async (_label, overrides) => {
    const store = repository(
      vi.fn(async () => response([observationRow(overrides)]))
    );

    await expect(
      store.listProjectionObservations({
        session,
        authority,
        projectionFamily: "course_content",
        asOf: "2026-07-17T01:10:00.000Z",
      })
    ).rejects.toThrow(MoodleProjectionRepositoryAuthorityError);
  });

  it("rejects duplicate and out-of-authority observation rows", async () => {
    const duplicateStore = repository(
      vi.fn(async () => response([observationRow(), observationRow()]))
    );
    await expect(
      duplicateStore.listProjectionObservations({
        session,
        authority,
        projectionFamily: "course_content",
        asOf: "2026-07-17T01:10:00.000Z",
      })
    ).rejects.toThrow(MoodleProjectionRepositoryUnavailableError);

    const foreignStore = repository(
      vi.fn(async () =>
        response([observationRow({ internal_course_id: otherCourseId })])
      )
    );
    await expect(
      foreignStore.listProjectionObservations({
        session,
        authority,
        projectionFamily: "course_content",
        asOf: "2026-07-17T01:10:00.000Z",
      })
    ).rejects.toThrow(MoodleProjectionRepositoryAuthorityError);
  });

  it("resolves exact-class teacher enrollment authority", async () => {
    const adminFetch = vi.fn(async () => response([enrollmentContextRow()]));
    const store = repository(adminFetch);

    await expect(
      store.resolveEnrollmentGroupContext(session, classGroupId)
    ).resolves.toEqual({
      connectionId,
      activeRole: "teacher",
      audience: "person_level",
      internalCourseId: courseId,
      internalCourseRunId: courseRunId,
      internalClassGroupId: classGroupId,
      authorizedUserIds: [otherUserId],
      courseMappingStatus: "exact",
      groupMappingStatus: "exact",
      userMappingStatus: "exact",
      observedAt: "2026-07-17T01:00:00.000Z",
    });
    expect(adminFetch).toHaveBeenCalledWith(
      "rpc/resolve_moodle_enrollment_group_context",
      expect.objectContaining({
        body: JSON.stringify({
          p_user_id: session.userId,
          p_active_role_grant_id: session.activeRoleGrantId,
          p_internal_class_group_id: classGroupId,
        }),
      }),
      expect.any(Object)
    );
  });

  it("returns only authorized person-level enrollment observations", async () => {
    const context = {
      connectionId,
      activeRole: "teacher" as const,
      audience: "person_level" as const,
      internalCourseId: courseId,
      internalCourseRunId: courseRunId,
      internalClassGroupId: classGroupId,
      authorizedUserIds: [otherUserId],
      courseMappingStatus: "exact" as const,
      groupMappingStatus: "exact" as const,
      userMappingStatus: "exact" as const,
      observedAt: "2026-07-17T01:00:00.000Z",
    };
    const store = repository(
      vi.fn(async () => response([enrollmentFreshnessRow()]))
    );

    await expect(
      store.getEnrollmentGroupFreshness({
        session,
        context,
        asOf: "2026-07-17T01:10:00.000Z",
      })
    ).resolves.toMatchObject({
      freshnessState: "fresh",
      latestOutcome: "available",
      context: {
        audience: "person_level",
        observedAt: "2026-07-17T01:10:00.000Z",
      },
      projection: {
        internalClassGroupId: classGroupId,
        learners: [{ internalUserId: otherUserId }],
      },
    });
  });

  it("rejects enrollment role, class, audience, and learner authority drift", async () => {
    const store = repository(vi.fn());
    await expect(
      store.resolveEnrollmentGroupContext(
        { ...session, activeRole: "student", roles: ["student"] },
        classGroupId
      )
    ).rejects.toThrow(MoodleProjectionRepositoryAuthorityError);

    for (const row of [
      enrollmentContextRow({ internal_class_group_id: otherCourseId }),
      enrollmentContextRow({ active_role: "superadmin" }),
      enrollmentContextRow({ projection_audience: "aggregate" }),
      enrollmentContextRow({ authorized_user_ids: [otherUserId, otherUserId] }),
    ]) {
      const scopedStore = repository(vi.fn(async () => response([row])));
      await expect(
        scopedStore.resolveEnrollmentGroupContext(session, classGroupId)
      ).rejects.toThrow();
    }

    const context = {
      connectionId,
      activeRole: "teacher" as const,
      audience: "person_level" as const,
      internalCourseId: courseId,
      internalCourseRunId: courseRunId,
      internalClassGroupId: classGroupId,
      authorizedUserIds: [otherUserId],
      courseMappingStatus: "exact" as const,
      groupMappingStatus: "exact" as const,
      userMappingStatus: "exact" as const,
      observedAt: "2026-07-17T01:00:00.000Z",
    };
    const foreignLearnerStore = repository(
      vi.fn(async () =>
        response([
          enrollmentFreshnessRow({
            sanitized_payload: {
              ...enrollmentFreshnessRow().sanitized_payload,
              learners: [
                {
                  internalUserId: userId,
                  internalEnrollmentId: enrollmentId,
                  internalMembershipId: membershipId,
                  providerState: "enrolled",
                  mappingStatus: "exact",
                },
              ],
            },
          }),
        ])
      )
    );
    await expect(
      foreignLearnerStore.getEnrollmentGroupFreshness({
        session,
        context,
        asOf: "2026-07-17T01:10:00.000Z",
      })
    ).rejects.toThrow(MoodleProjectionRepositoryAuthorityError);

    const hashMismatchStore = repository(
      vi.fn(async () =>
        response([
          enrollmentFreshnessRow({ projection_hash: `\\x${"b".repeat(64)}` }),
        ])
      )
    );
    await expect(
      hashMismatchStore.getEnrollmentGroupFreshness({
        session,
        context,
        asOf: "2026-07-17T01:10:00.000Z",
      })
    ).rejects.toThrow(MoodleProjectionRepositoryUnavailableError);
  });

  it("enforces aggregate-only HOD enrollment observations", async () => {
    const hodSession: ServerSession = {
      ...session,
      activeRole: "headofdepartment",
      roles: ["headofdepartment"],
    };
    const contextStore = repository(
      vi.fn(async () =>
        response([
          enrollmentContextRow({
            active_role: "headofdepartment",
            projection_audience: "aggregate",
            authorized_user_ids: [],
          }),
        ])
      )
    );
    const context = await contextStore.resolveEnrollmentGroupContext(
      hodSession,
      classGroupId
    );
    const aggregateStore = repository(
      vi.fn(async () =>
        response([
          enrollmentFreshnessRow({
            active_role: "headofdepartment",
            projection_audience: "aggregate",
            sanitized_payload: {
              internalCourseId: courseId,
              internalClassGroupId: classGroupId,
              providerState: "available",
              mappingStatus: "exact",
              learnerCount: 3,
              mappedLearnerCount: 2,
              unmappedLearnerCount: 1,
            },
          }),
        ])
      )
    );
    await expect(
      aggregateStore.getEnrollmentGroupFreshness({
        session: hodSession,
        context,
        asOf: "2026-07-17T01:10:00.000Z",
      })
    ).resolves.toMatchObject({
      context: { audience: "aggregate" },
      projection: { learnerCount: 3, mappedLearnerCount: 2 },
    });
  });

  it("resolves teacher assessment status through exact service RPCs", async () => {
    const contextFetch = vi.fn(async () => response([assessmentContextRow()]));
    const contextStore = repository(contextFetch);
    const context = await contextStore.resolveAssessmentStatusContext(
      session,
      classGroupId
    );

    expect(context).toMatchObject({
      activeRole: "teacher",
      audience: "class_staff",
      internalCourseId: courseId,
      internalClassGroupId: classGroupId,
      userMappingStatus: "not_required",
      assessmentMappingStatus: "exact",
    });
    expect(contextFetch).toHaveBeenCalledWith(
      "rpc/resolve_moodle_assessment_status_context",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          p_user_id: session.userId,
          p_active_role_grant_id: session.activeRoleGrantId,
          p_internal_class_group_id: classGroupId,
        }),
      }),
      expect.any(Object)
    );

    const freshnessFetch = vi.fn(async () =>
      response([assessmentFreshnessRow()])
    );
    const result = await repository(
      freshnessFetch
    ).getAssessmentStatusFreshness({
      session,
      context,
      asOf: "2026-07-17T01:10:00.000Z",
    });
    expect(result).toMatchObject({
      freshnessState: "fresh",
      latestOutcome: "available",
      projection: {
        providerState: "available",
        mappingStatus: "exact",
        items: [
          { kind: "assignment", acceptsSubmissions: true },
          { kind: "quiz", scheduleState: "scheduled" },
        ],
      },
    });
    expect(freshnessFetch).toHaveBeenCalledWith(
      "rpc/list_authorized_moodle_assessment_status_freshness",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          p_user_id: session.userId,
          p_active_role_grant_id: session.activeRoleGrantId,
          p_connection_id: connectionId,
          p_internal_class_group_id: classGroupId,
          p_as_of: "2026-07-17T01:10:00.000Z",
        }),
      }),
      expect.any(Object)
    );
  });

  it("requires the signed-in student as the exact assessment subject", async () => {
    const studentSession: ServerSession = {
      ...session,
      activeRole: "student",
      roles: ["student"],
    };
    const validStore = repository(
      vi.fn(async () =>
        response([
          assessmentContextRow({
            active_role: "student",
            projection_audience: "learner",
            subject_user_id: studentSession.userId,
            user_mapping_status: "exact",
          }),
        ])
      )
    );
    await expect(
      validStore.resolveAssessmentStatusContext(studentSession, classGroupId)
    ).resolves.toMatchObject({
      audience: "learner",
      subjectUserId: studentSession.userId,
    });

    const foreignSubjectStore = repository(
      vi.fn(async () =>
        response([
          assessmentContextRow({
            active_role: "student",
            projection_audience: "learner",
            subject_user_id: otherUserId,
            user_mapping_status: "exact",
          }),
        ])
      )
    );
    await expect(
      foreignSubjectStore.resolveAssessmentStatusContext(
        studentSession,
        classGroupId
      )
    ).rejects.toThrow(MoodleProjectionRepositoryAuthorityError);
  });

  it.each([
    ["demo", { provider: "demo", authorizationModel: "compatibility" }],
    ["registrar", { activeRole: "registrar", roles: ["registrar"] }],
    ["branch admin", { activeRole: "branchadmin", roles: ["branchadmin"] }],
  ])(
    "denies %s assessment access before database contact",
    async (_label, patch) => {
      const adminFetch = vi.fn();
      await expect(
        repository(adminFetch).resolveAssessmentStatusContext(
          { ...session, ...patch } as ServerSession,
          classGroupId
        )
      ).rejects.toThrow(MoodleProjectionRepositoryAuthorityError);
      expect(adminFetch).not.toHaveBeenCalled();
    }
  );

  it("rejects cross-scope and malformed assessment observations", async () => {
    const context = {
      connectionId,
      activeRole: "teacher" as const,
      audience: "class_staff" as const,
      internalCourseId: courseId,
      internalCourseRunId: courseRunId,
      internalClassGroupId: classGroupId,
      courseMappingStatus: "exact" as const,
      groupMappingStatus: "exact" as const,
      userMappingStatus: "not_required" as const,
      assessmentMappingStatus: "exact" as const,
      observedAt: "2026-07-17T01:00:00.000Z",
    };
    const read = (row: Record<string, unknown>) =>
      repository(
        vi.fn(async () => response([row]))
      ).getAssessmentStatusFreshness({
        session,
        context,
        asOf: "2026-07-17T01:10:00.000Z",
      });

    await expect(
      read(assessmentFreshnessRow({ internal_course_id: otherCourseId }))
    ).rejects.toThrow(MoodleProjectionRepositoryAuthorityError);
    await expect(
      read(
        assessmentFreshnessRow({
          sanitized_payload: {
            ...assessmentFreshnessRow().sanitized_payload,
            score: 100,
          },
        })
      )
    ).rejects.toThrow(MoodleProjectionSnapshotError);
    await expect(
      read(assessmentFreshnessRow({ projection_hash: `\\x${"b".repeat(64)}` }))
    ).rejects.toThrow(MoodleProjectionRepositoryUnavailableError);
    await expect(
      read(
        assessmentFreshnessRow({
          fresh_until: "2026-07-25T01:20:00.000Z",
          retain_until: "2026-07-24T01:05:00.000Z",
        })
      )
    ).rejects.toThrow(MoodleProjectionRepositoryUnavailableError);
    await expect(
      read(assessmentFreshnessRow({ freshness_state: "expired" }))
    ).rejects.toThrow(MoodleProjectionRepositoryUnavailableError);
  });

  it("returns reconciliation metadata without projecting missing mappings", async () => {
    const contextStore = repository(
      vi.fn(async () =>
        response([
          assessmentContextRow({
            assessment_mapping_status: "missing",
          }),
        ])
      )
    );
    const context = await contextStore.resolveAssessmentStatusContext(
      session,
      classGroupId
    );
    const freshnessStore = repository(
      vi.fn(async () =>
        response([
          assessmentFreshnessRow({
            assessment_mapping_status: "missing",
            freshness_state: "reconciliation",
            latest_outcome: "reconciliation",
            reconciliation_reason: "missing_assessment_mapping",
            sanitized_payload: null,
            projection_hash: null,
            successful_sync_run_id: null,
            successful_observed_at: null,
            fresh_until: null,
            retain_until: null,
          }),
        ])
      )
    );
    await expect(
      freshnessStore.getAssessmentStatusFreshness({
        session,
        context,
        asOf: "2026-07-17T01:10:00.000Z",
      })
    ).resolves.toEqual(
      expect.objectContaining({
        freshnessState: "reconciliation",
        latestOutcome: "reconciliation",
        reconciliationReason: "missing_assessment_mapping",
      })
    );
  });

  it("resolves exact-class teacher assignment results through service RPCs", async () => {
    const contextFetch = vi.fn(async () =>
      response([assignmentResultContextRow()])
    );
    const context = await repository(
      contextFetch
    ).resolveAssignmentResultContext(
      session,
      classGroupId,
      assignmentProjectionId
    );

    expect(context).toMatchObject({
      activeRole: "teacher",
      audience: "person_level",
      internalClassGroupId: classGroupId,
      assignmentProjectionId,
      authorizedUserIds: [otherUserId],
    });
    expect(contextFetch).toHaveBeenCalledWith(
      "rpc/resolve_moodle_assignment_result_context",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          p_user_id: session.userId,
          p_active_role_grant_id: session.activeRoleGrantId,
          p_internal_class_group_id: classGroupId,
          p_assignment_projection_id: assignmentProjectionId,
        }),
      }),
      expect.any(Object)
    );

    const freshnessFetch = vi.fn(async () =>
      response([assignmentResultFreshnessRow()])
    );
    await expect(
      repository(freshnessFetch).getAssignmentResultFreshness({
        session,
        context,
        asOf: "2026-07-17T01:10:00.000Z",
      })
    ).resolves.toMatchObject({
      freshnessState: "fresh",
      latestOutcome: "available",
      projection: {
        assignmentProjectionId,
        learners: [
          {
            internalUserId: otherUserId,
            submissionState: "submitted",
            gradingState: "graded",
            score: 84,
            maximumScore: 100,
          },
        ],
      },
    });
    expect(freshnessFetch).toHaveBeenCalledWith(
      "rpc/list_authorized_moodle_assignment_result_freshness",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          p_user_id: session.userId,
          p_active_role_grant_id: session.activeRoleGrantId,
          p_connection_id: connectionId,
          p_internal_class_group_id: classGroupId,
          p_assignment_projection_id: assignmentProjectionId,
          p_as_of: "2026-07-17T01:10:00.000Z",
        }),
      }),
      expect.any(Object)
    );
  });

  it("resolves exact-class quiz attempts without provider calls", async () => {
    const contextFetch = vi.fn(async () => response([quizAttemptContextRow()]));
    const context = await repository(contextFetch).resolveQuizAttemptContext(
      session,
      classGroupId,
      quizProjectionId
    );
    expect(context).toMatchObject({
      activeRole: "teacher",
      audience: "person_level",
      quizProjectionId,
      authorizedUserIds: [otherUserId],
    });
    expect(contextFetch).toHaveBeenCalledWith(
      "rpc/resolve_moodle_quiz_attempt_context",
      expect.objectContaining({
        body: JSON.stringify({
          p_user_id: session.userId,
          p_active_role_grant_id: session.activeRoleGrantId,
          p_internal_class_group_id: classGroupId,
          p_quiz_projection_id: quizProjectionId,
        }),
      }),
      expect.any(Object)
    );

    const freshnessFetch = vi.fn(async () =>
      response([quizAttemptFreshnessRow()])
    );
    await expect(
      repository(freshnessFetch).getQuizAttemptFreshness({
        session,
        context,
        asOf: "2026-07-17T01:10:00.000Z",
      })
    ).resolves.toMatchObject({
      freshnessState: "fresh",
      latestOutcome: "available",
      projection: {
        quizProjectionId,
        learners: [
          {
            internalUserId: otherUserId,
            attemptProjectionId: quizAttemptProjectionId,
            attemptState: "finished",
            preview: false,
            score: 9,
            maximumScore: 10,
          },
        ],
      },
    });
    expect(freshnessFetch).toHaveBeenCalledWith(
      "rpc/list_authorized_moodle_quiz_attempt_freshness",
      expect.objectContaining({
        body: JSON.stringify({
          p_user_id: session.userId,
          p_active_role_grant_id: session.activeRoleGrantId,
          p_connection_id: connectionId,
          p_internal_class_group_id: classGroupId,
          p_quiz_projection_id: quizProjectionId,
          p_as_of: "2026-07-17T01:10:00.000Z",
        }),
      }),
      expect.any(Object)
    );
  });

  it("resolves exact-class released grade outcomes through service RPCs", async () => {
    const contextFetch = vi.fn(async () =>
      response([gradeOutcomeContextRow()])
    );
    const context = await repository(contextFetch).resolveGradeOutcomeContext(
      session,
      classGroupId,
      gradeItemProjectionId
    );
    expect(context).toMatchObject({
      activeRole: "teacher",
      audience: "person_level",
      gradeItemProjectionId,
      authorizedUserIds: [otherUserId],
    });
    expect(contextFetch).toHaveBeenCalledWith(
      "rpc/resolve_moodle_grade_outcome_context",
      expect.objectContaining({
        body: JSON.stringify({
          p_user_id: session.userId,
          p_active_role_grant_id: session.activeRoleGrantId,
          p_internal_class_group_id: classGroupId,
          p_grade_item_projection_id: gradeItemProjectionId,
        }),
      }),
      expect.any(Object)
    );

    const freshnessFetch = vi.fn(async () =>
      response([gradeOutcomeFreshnessRow()])
    );
    await expect(
      repository(freshnessFetch).getGradeOutcomeFreshness({
        session,
        context,
        asOf: "2026-07-17T01:10:00.000Z",
      })
    ).resolves.toMatchObject({
      freshnessState: "fresh",
      latestOutcome: "available",
      projection: {
        gradeItemProjectionId,
        learners: [
          {
            internalUserId: otherUserId,
            gradingState: "released",
            score: 18,
            maximumScore: 20,
            feedback: "Accurate work with clear reasoning.",
          },
        ],
      },
    });
    expect(freshnessFetch).toHaveBeenCalledWith(
      "rpc/list_authorized_moodle_grade_outcome_freshness",
      expect.objectContaining({
        body: JSON.stringify({
          p_user_id: session.userId,
          p_active_role_grant_id: session.activeRoleGrantId,
          p_connection_id: connectionId,
          p_internal_class_group_id: classGroupId,
          p_grade_item_projection_id: gradeItemProjectionId,
          p_as_of: "2026-07-17T01:10:00.000Z",
        }),
      }),
      expect.any(Object)
    );
  });

  it.each([
    ["demo", { provider: "demo", authorizationModel: "compatibility" }],
    ["registrar", { activeRole: "registrar", roles: ["registrar"] }],
    ["branch admin", { activeRole: "branchadmin", roles: ["branchadmin"] }],
  ])(
    "denies %s grade outcomes before database contact",
    async (_label, patch) => {
      const adminFetch = vi.fn();
      await expect(
        repository(adminFetch).resolveGradeOutcomeContext(
          { ...session, ...patch } as ServerSession,
          classGroupId,
          gradeItemProjectionId
        )
      ).rejects.toThrow(MoodleProjectionRepositoryAuthorityError);
      expect(adminFetch).not.toHaveBeenCalled();
    }
  );

  it("resolves exact-class bounded activity outcomes through service RPCs", async () => {
    const contextFetch = vi.fn(async () =>
      response([activityOutcomeContextRow()])
    );
    const context = await repository(
      contextFetch
    ).resolveActivityOutcomeContext(
      session,
      classGroupId,
      activityProjectionId
    );
    expect(context).toMatchObject({
      activeRole: "teacher",
      audience: "person_level",
      activityProjectionId,
      activityKind: "h5p",
      authorizedUserIds: [otherUserId],
    });
    expect(contextFetch).toHaveBeenCalledWith(
      "rpc/resolve_moodle_activity_outcome_context",
      expect.objectContaining({
        body: JSON.stringify({
          p_user_id: session.userId,
          p_active_role_grant_id: session.activeRoleGrantId,
          p_internal_class_group_id: classGroupId,
          p_activity_projection_id: activityProjectionId,
        }),
      }),
      expect.any(Object)
    );

    const freshnessFetch = vi.fn(async () =>
      response([activityOutcomeFreshnessRow()])
    );
    await expect(
      repository(freshnessFetch).getActivityOutcomeFreshness({
        session,
        context,
        asOf: "2026-07-17T01:10:00.000Z",
      })
    ).resolves.toMatchObject({
      freshnessState: "fresh",
      latestOutcome: "available",
      projection: {
        activityProjectionId,
        activityKind: "h5p",
        learners: [
          {
            internalUserId: otherUserId,
            completionState: "passed",
            scoreState: "released",
            score: 9,
            maximumScore: 10,
          },
        ],
      },
    });
    expect(freshnessFetch).toHaveBeenCalledWith(
      "rpc/list_authorized_moodle_activity_outcome_freshness",
      expect.objectContaining({
        body: JSON.stringify({
          p_user_id: session.userId,
          p_active_role_grant_id: session.activeRoleGrantId,
          p_connection_id: connectionId,
          p_internal_class_group_id: classGroupId,
          p_activity_projection_id: activityProjectionId,
          p_as_of: "2026-07-17T01:10:00.000Z",
        }),
      }),
      expect.any(Object)
    );
  });

  it.each([
    ["demo", { provider: "demo", authorizationModel: "compatibility" }],
    ["registrar", { activeRole: "registrar", roles: ["registrar"] }],
    ["branch admin", { activeRole: "branchadmin", roles: ["branchadmin"] }],
  ])(
    "denies %s activity outcomes before database contact",
    async (_label, patch) => {
      const adminFetch = vi.fn();
      await expect(
        repository(adminFetch).resolveActivityOutcomeContext(
          { ...session, ...patch } as ServerSession,
          classGroupId,
          activityProjectionId
        )
      ).rejects.toThrow(MoodleProjectionRepositoryAuthorityError);
      expect(adminFetch).not.toHaveBeenCalled();
    }
  );

  it("derives a student learner audience from the signed-in user", async () => {
    const studentSession: ServerSession = {
      ...session,
      activeRole: "student",
      roles: ["student"],
    };
    const contextStore = repository(
      vi.fn(async () =>
        response([
          assignmentResultContextRow({
            active_role: "student",
            projection_audience: "learner",
            authorized_user_ids: [studentSession.userId],
          }),
        ])
      )
    );

    await expect(
      contextStore.resolveAssignmentResultContext(
        studentSession,
        classGroupId,
        assignmentProjectionId
      )
    ).resolves.toMatchObject({
      audience: "learner",
      authorizedUserIds: [studentSession.userId],
    });

    const foreignStore = repository(
      vi.fn(async () =>
        response([
          assignmentResultContextRow({
            active_role: "student",
            projection_audience: "learner",
            authorized_user_ids: [otherUserId],
          }),
        ])
      )
    );
    await expect(
      foreignStore.resolveAssignmentResultContext(
        studentSession,
        classGroupId,
        assignmentProjectionId
      )
    ).rejects.toThrow(MoodleProjectionRepositoryAuthorityError);
  });

  it.each([
    ["demo", { provider: "demo", authorizationModel: "compatibility" }],
    ["registrar", { activeRole: "registrar", roles: ["registrar"] }],
    ["branch admin", { activeRole: "branchadmin", roles: ["branchadmin"] }],
  ])(
    "denies %s assignment results before database contact",
    async (_label, patch) => {
      const adminFetch = vi.fn();
      await expect(
        repository(adminFetch).resolveAssignmentResultContext(
          { ...session, ...patch } as ServerSession,
          classGroupId,
          assignmentProjectionId
        )
      ).rejects.toThrow(MoodleProjectionRepositoryAuthorityError);
      expect(adminFetch).not.toHaveBeenCalled();
    }
  );

  it.each(["headofdepartment", "superadmin"] as const)(
    "enforces aggregate-only %s assignment results",
    async activeRole => {
      const staffSession: ServerSession = {
        ...session,
        activeRole,
        roles: [activeRole],
      };
      const contextStore = repository(
        vi.fn(async () =>
          response([
            assignmentResultContextRow({
              active_role: activeRole,
              projection_audience: "aggregate",
              authorized_user_ids: [],
            }),
          ])
        )
      );
      const context = await contextStore.resolveAssignmentResultContext(
        staffSession,
        classGroupId,
        assignmentProjectionId
      );
      const freshnessStore = repository(
        vi.fn(async () =>
          response([
            assignmentResultFreshnessRow({
              active_role: activeRole,
              projection_audience: "aggregate",
              authorized_user_ids: [],
              sanitized_payload: {
                internalCourseId: courseId,
                internalClassGroupId: classGroupId,
                assignmentProjectionId,
                providerState: "available",
                mappingStatus: "exact",
                learnerCount: 4,
                submittedCount: 3,
                gradedCount: 2,
              },
            }),
          ])
        )
      );

      await expect(
        freshnessStore.getAssignmentResultFreshness({
          session: staffSession,
          context,
          asOf: "2026-07-17T01:10:00.000Z",
        })
      ).resolves.toMatchObject({
        context: { audience: "aggregate" },
        projection: { learnerCount: 4, submittedCount: 3, gradedCount: 2 },
      });
    }
  );

  it.each([
    [
      "partial evidence",
      () => assignmentResultFreshnessRow({ projection_hash: null }),
      MoodleProjectionRepositoryUnavailableError,
    ],
    [
      "stale retained evidence",
      () => assignmentResultFreshnessRow({ freshness_state: "stale_retained" }),
      MoodleProjectionRepositoryUnavailableError,
    ],
    [
      "a mismatched payload hash",
      () =>
        assignmentResultFreshnessRow({
          projection_hash: `\\x${"b".repeat(64)}`,
        }),
      MoodleProjectionRepositoryUnavailableError,
    ],
    [
      "a mismatched course context",
      () => assignmentResultFreshnessRow({ internal_course_id: otherCourseId }),
      MoodleProjectionRepositoryAuthorityError,
    ],
    [
      "a mismatched assignment context",
      () =>
        assignmentResultFreshnessRow({
          assignment_projection_id: quizProjectionId,
        }),
      MoodleProjectionRepositoryAuthorityError,
    ],
    [
      "retention beyond 30 days",
      () =>
        assignmentResultFreshnessRow({
          retain_until: "2026-08-17T01:05:00.000Z",
        }),
      MoodleProjectionRepositoryUnavailableError,
    ],
  ])("fails closed for %s", async (_label, buildRow, ErrorType) => {
    const context = {
      connectionId,
      activeRole: "teacher" as const,
      audience: "person_level" as const,
      internalCourseId: courseId,
      internalCourseRunId: courseRunId,
      internalClassGroupId: classGroupId,
      assignmentProjectionId,
      authorizedUserIds: [otherUserId],
      courseMappingStatus: "exact" as const,
      groupMappingStatus: "exact" as const,
      userMappingStatus: "exact" as const,
      assignmentMappingStatus: "exact" as const,
      observedAt: "2026-07-17T01:00:00.000Z",
    };
    const read = repository(
      vi.fn(async () => response([buildRow()]))
    ).getAssignmentResultFreshness({
      session,
      context,
      asOf: "2026-07-17T01:10:00.000Z",
    });

    await expect(read).rejects.toThrow(ErrorType);
  });

  it("returns assignment reconciliation without a retained projection", async () => {
    const contextStore = repository(
      vi.fn(async () =>
        response([
          assignmentResultContextRow({
            assignment_mapping_status: "missing",
          }),
        ])
      )
    );
    const context = await contextStore.resolveAssignmentResultContext(
      session,
      classGroupId,
      assignmentProjectionId
    );
    const freshnessStore = repository(
      vi.fn(async () =>
        response([
          assignmentResultFreshnessRow({
            assignment_mapping_status: "missing",
            freshness_state: "reconciliation",
            latest_outcome: "reconciliation",
            reconciliation_reason: "missing_assignment_mapping",
            sanitized_payload: null,
            projection_hash: null,
            successful_sync_run_id: null,
            successful_observed_at: null,
            fresh_until: null,
            retain_until: null,
          }),
        ])
      )
    );

    await expect(
      freshnessStore.getAssignmentResultFreshness({
        session,
        context,
        asOf: "2026-07-17T01:10:00.000Z",
      })
    ).resolves.toEqual(
      expect.objectContaining({
        freshnessState: "reconciliation",
        latestOutcome: "reconciliation",
        reconciliationReason: "missing_assignment_mapping",
      })
    );
  });

  it("distinguishes authority denial from repository outage", async () => {
    const denied = repository(
      vi.fn(async () => response({ error: true }, 403))
    );
    await expect(denied.resolveCourseAuthority(session)).rejects.toThrow(
      MoodleProjectionRepositoryAuthorityError
    );

    const unavailable = repository(
      vi.fn(async () => response({ error: true }, 500))
    );
    await expect(unavailable.resolveCourseAuthority(session)).rejects.toThrow(
      MoodleProjectionRepositoryUnavailableError
    );
  });

  it("keeps normalized projections disabled unless explicitly configured", () => {
    resetDefaultMoodleProjectionRepository();
    expect(() => getMoodleProjectionRepository({})).toThrow(
      MoodleProjectionRepositoryUnavailableError
    );
  });
});
