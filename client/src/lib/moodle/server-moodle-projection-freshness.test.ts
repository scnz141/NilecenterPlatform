import { describe, expect, it } from "vitest";

import {
  MoodleProjectionSnapshotError,
  hashMoodleProjectionPayload,
  parseStoredMoodleActivityOutcomeProjection,
  parseStoredMoodleAssignmentResultProjection,
  parseStoredMoodleAssessmentStatusProjection,
  parseStoredMoodleEnrollmentGroupProjection,
  parseStoredMoodleGradeOutcomeProjection,
  parseStoredMoodleQuizAttemptProjection,
  resolveMoodleProjectionObservation,
} from "../../../../server/moodleProjectionFreshness";

const courses = [
  {
    sourceId: "42",
    title: "Arabic Level 3",
    shortTitle: "AR-L3",
    visible: true,
  },
];

function observation(
  latestOutcome:
    | "available"
    | "empty"
    | "unavailable"
    | "invalid_payload" = "available",
  payload: unknown = courses
) {
  return {
    projectionFamily: "course_catalog" as const,
    latestOutcome,
    lastAttemptedAt: "2026-07-17T02:00:00.000Z",
    lastSuccess: {
      runId: "70000000-0000-4000-8000-000000000001",
      payload,
      payloadHash: hashMoodleProjectionPayload(payload),
      itemCount: Array.isArray(payload) ? payload.length : 0,
      observedAt: "2026-07-17T01:00:00.000Z",
      freshUntil: "2026-07-17T03:00:00.000Z",
      retainUntil: "2026-07-18T01:00:00.000Z",
    },
  };
}

describe("Moodle projection freshness", () => {
  it("returns a fresh available sanitized projection", () => {
    expect(
      resolveMoodleProjectionObservation({
        observation: observation(),
        now: new Date("2026-07-17T02:30:00.000Z"),
      })
    ).toMatchObject({
      availability: "available",
      freshness: "fresh",
      latestOutcome: "available",
      payload: courses,
    });
  });

  it("marks a retained successful projection stale after its freshness window", () => {
    expect(
      resolveMoodleProjectionObservation({
        observation: observation(),
        now: new Date("2026-07-17T04:00:00.000Z"),
      })
    ).toMatchObject({ availability: "available", freshness: "stale" });
  });

  it("retains safe stale data after a failed latest attempt", () => {
    const result = resolveMoodleProjectionObservation({
      observation: observation("unavailable"),
      now: new Date("2026-07-17T02:30:00.000Z"),
    });
    expect(result).toMatchObject({
      availability: "unavailable",
      freshness: "stale",
      latestOutcome: "unavailable",
      payload: courses,
    });
  });

  it("does not return a projection after retention expires", () => {
    expect(
      resolveMoodleProjectionObservation({
        observation: observation(),
        now: new Date("2026-07-18T02:00:00.000Z"),
      })
    ).toEqual({
      availability: "unavailable",
      freshness: "unavailable",
      latestOutcome: "available",
      lastAttemptedAt: "2026-07-17T02:00:00.000Z",
    });
  });

  it("represents a successful empty observation without inventing data", () => {
    expect(
      resolveMoodleProjectionObservation({
        observation: observation("empty", []),
        now: new Date("2026-07-17T02:30:00.000Z"),
      })
    ).toMatchObject({
      availability: "empty",
      freshness: "fresh",
      payload: [],
    });
  });

  it("fails closed for tampered hashes and raw or unknown fields", () => {
    expect(() =>
      resolveMoodleProjectionObservation({
        observation: {
          ...observation(),
          lastSuccess: {
            ...observation().lastSuccess!,
            payloadHash: "0".repeat(64),
          },
        },
      })
    ).toThrow(MoodleProjectionSnapshotError);
    const raw = [{ ...courses[0], summary: "raw Moodle HTML" }];
    expect(() =>
      resolveMoodleProjectionObservation({
        observation: observation("available", raw),
      })
    ).toThrow(MoodleProjectionSnapshotError);

    for (const title of [
      "<script>alert(1)</script>Arabic Level 3",
      "student@example.test Arabic Level 3",
      "https://private.example.test Arabic Level 3",
    ]) {
      const unsafe = [{ ...courses[0], title }];
      expect(() =>
        resolveMoodleProjectionObservation({
          observation: observation("available", unsafe),
        })
      ).toThrow(MoodleProjectionSnapshotError);
    }
  });

  it("fails closed for malformed timestamp ordering", () => {
    expect(() =>
      resolveMoodleProjectionObservation({
        observation: {
          ...observation(),
          lastSuccess: {
            ...observation().lastSuccess!,
            freshUntil: "2026-07-16T00:00:00.000Z",
          },
        },
      })
    ).toThrow(MoodleProjectionSnapshotError);
  });

  it("does not invent an attempt timestamp when no observation exists", () => {
    expect(resolveMoodleProjectionObservation({ observation: null })).toEqual({
      availability: "unavailable",
      freshness: "unavailable",
      latestOutcome: "unavailable",
    });
  });

  it("parses only the exact enrollment-group snapshot shape", () => {
    const payload = {
      internalCourseId: "50000000-0000-4000-8000-000000000001",
      internalClassGroupId: "60000000-0000-4000-8000-000000000001",
      providerState: "available",
      mappingStatus: "exact",
      learners: [
        {
          internalUserId: "10000000-0000-4000-8000-000000000001",
          internalEnrollmentId: "70000000-0000-4000-8000-000000000001",
          internalMembershipId: "80000000-0000-4000-8000-000000000001",
          providerState: "enrolled",
          mappingStatus: "exact",
        },
      ],
    };
    expect(
      parseStoredMoodleEnrollmentGroupProjection("person_level", payload)
    ).toEqual(payload);

    for (const invalid of [
      { ...payload, email: "student@example.test" },
      {
        ...payload,
        learners: [{ ...payload.learners[0], providerState: "deleted" }],
      },
      {
        ...payload,
        learners: [{ ...payload.learners[0], internalUserId: "not-a-uuid" }],
      },
      { ...payload, learners: [payload.learners[0], payload.learners[0]] },
    ]) {
      expect(() =>
        parseStoredMoodleEnrollmentGroupProjection("person_level", invalid)
      ).toThrow(MoodleProjectionSnapshotError);
    }
  });

  it("parses only consistent aggregate enrollment-group counts", () => {
    const payload = {
      internalCourseId: "50000000-0000-4000-8000-000000000001",
      internalClassGroupId: "60000000-0000-4000-8000-000000000001",
      providerState: "available",
      mappingStatus: "reconciliation",
      learnerCount: 3,
      mappedLearnerCount: 2,
      unmappedLearnerCount: 1,
    };
    expect(
      parseStoredMoodleEnrollmentGroupProjection("aggregate", payload)
    ).toEqual(payload);
    expect(() =>
      parseStoredMoodleEnrollmentGroupProjection("aggregate", {
        ...payload,
        mappedLearnerCount: 3,
      })
    ).toThrow(MoodleProjectionSnapshotError);
    expect(() =>
      parseStoredMoodleEnrollmentGroupProjection("aggregate", {
        ...payload,
        learners: [],
      })
    ).toThrow(MoodleProjectionSnapshotError);
  });

  it("parses only bounded assessment definition and schedule status", () => {
    const payload = {
      internalCourseId: "50000000-0000-4000-8000-000000000001",
      internalClassGroupId: "60000000-0000-4000-8000-000000000001",
      providerState: "available",
      mappingStatus: "exact",
      items: [
        {
          projectionId: "90000000-0000-4000-8000-000000000001",
          kind: "assignment",
          title: "Writing practice",
          visibility: "visible",
          scheduleState: "open",
          opensAt: "2026-07-17T01:00:00.000Z",
          dueAt: "2026-07-20T01:00:00.000Z",
          cutoffAt: "2026-07-21T01:00:00.000Z",
          acceptsSubmissions: true,
        },
        {
          projectionId: "90000000-0000-4000-8000-000000000002",
          kind: "quiz",
          title: "Grammar check",
          visibility: "hidden",
          scheduleState: "scheduled",
          opensAt: "2026-07-22T01:00:00.000Z",
          closesAt: "2026-07-23T01:00:00.000Z",
        },
      ],
    } as const;
    expect(parseStoredMoodleAssessmentStatusProjection(payload)).toEqual(
      payload
    );

    for (const invalid of [
      { ...payload, rawProviderId: "42" },
      { ...payload, items: [{ ...payload.items[0], score: 88 }] },
      { ...payload, items: [{ ...payload.items[0], feedback: "Private" }] },
      {
        ...payload,
        items: [{ ...payload.items[0], closesAt: payload.items[0].dueAt }],
      },
      { ...payload, items: [payload.items[0], payload.items[0]] },
      { ...payload, providerState: "empty", items: payload.items },
    ]) {
      expect(() =>
        parseStoredMoodleAssessmentStatusProjection(invalid)
      ).toThrow(MoodleProjectionSnapshotError);
    }
  });

  it("accepts an exact empty assessment status snapshot", () => {
    expect(
      parseStoredMoodleAssessmentStatusProjection({
        internalCourseId: "50000000-0000-4000-8000-000000000001",
        internalClassGroupId: "60000000-0000-4000-8000-000000000001",
        providerState: "empty",
        mappingStatus: "exact",
        items: [],
      })
    ).toMatchObject({ providerState: "empty", items: [] });
  });

  it("parses only the exact person-level assignment result shape", () => {
    const payload = {
      internalCourseId: "50000000-0000-4000-8000-000000000001",
      internalClassGroupId: "60000000-0000-4000-8000-000000000001",
      assignmentProjectionId: "90000000-0000-4000-8000-000000000001",
      providerState: "available",
      mappingStatus: "exact",
      learners: [
        {
          internalUserId: "10000000-0000-4000-8000-000000000001",
          internalEnrollmentId: "70000000-0000-4000-8000-000000000001",
          internalMembershipId: "80000000-0000-4000-8000-000000000001",
          submissionState: "submitted",
          attemptNumber: 1,
          gradingState: "graded",
          latest: true,
          submittedAt: "2026-07-17T01:00:00.000Z",
          modifiedAt: "2026-07-17T02:00:00.000Z",
          score: 88.5,
          maximumScore: 100,
          gradedAt: "2026-07-17T03:00:00.000Z",
        },
      ],
    } as const;
    expect(
      parseStoredMoodleAssignmentResultProjection("person_level", payload)
    ).toEqual(payload);
    expect(
      parseStoredMoodleAssignmentResultProjection("learner", payload)
    ).toEqual(payload);

    for (const invalid of [
      { ...payload, subjectUserId: payload.learners[0].internalUserId },
      {
        ...payload,
        learners: [{ ...payload.learners[0], feedback: "Private feedback" }],
      },
      {
        ...payload,
        learners: [{ ...payload.learners[0], submissionState: "removed" }],
      },
      {
        ...payload,
        learners: [{ ...payload.learners[0], gradingState: "pending" }],
      },
      {
        ...payload,
        learners: [{ ...payload.learners[0], internalUserId: "not-a-uuid" }],
      },
      { ...payload, learners: [payload.learners[0], payload.learners[0]] },
    ]) {
      expect(() =>
        parseStoredMoodleAssignmentResultProjection("person_level", invalid)
      ).toThrow(MoodleProjectionSnapshotError);
    }
    expect(() =>
      parseStoredMoodleAssignmentResultProjection("learner", {
        ...payload,
        learners: [],
      })
    ).toThrow(MoodleProjectionSnapshotError);
  });

  it("rejects invalid assignment result scores, timestamps, and bounds", () => {
    const learner = {
      internalUserId: "10000000-0000-4000-8000-000000000001",
      internalEnrollmentId: "70000000-0000-4000-8000-000000000001",
      internalMembershipId: "80000000-0000-4000-8000-000000000001",
      submissionState: "submitted",
      attemptNumber: 1,
      gradingState: "graded",
      latest: true,
      score: 8,
      maximumScore: 10,
    };
    const payload = {
      internalCourseId: "50000000-0000-4000-8000-000000000001",
      internalClassGroupId: "60000000-0000-4000-8000-000000000001",
      assignmentProjectionId: "90000000-0000-4000-8000-000000000001",
      providerState: "available",
      mappingStatus: "exact",
      learners: [learner],
    };
    for (const invalidLearner of [
      { ...learner, score: 11 },
      { ...learner, score: -1 },
      { ...learner, score: Number.NaN },
      { ...learner, maximumScore: Number.POSITIVE_INFINITY },
      { ...learner, maximumScore: undefined },
      { ...learner, attemptNumber: -1 },
      { ...learner, attemptNumber: 21 },
      { ...learner, attemptNumber: 0 },
      { ...learner, gradingState: "not_graded" },
      { ...learner, maximumScore: 0 },
      { ...learner, submittedAt: "not-a-timestamp" },
    ]) {
      expect(() =>
        parseStoredMoodleAssignmentResultProjection("person_level", {
          ...payload,
          learners: [invalidLearner],
        })
      ).toThrow(MoodleProjectionSnapshotError);
    }

    expect(() =>
      parseStoredMoodleAssignmentResultProjection("person_level", {
        ...payload,
        learners: Array.from({ length: 501 }, (_, index) => ({
          ...learner,
          internalUserId: `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
        })),
      })
    ).toThrow(MoodleProjectionSnapshotError);
  });

  it("parses only consistent aggregate assignment result counts", () => {
    const payload = {
      internalCourseId: "50000000-0000-4000-8000-000000000001",
      internalClassGroupId: "60000000-0000-4000-8000-000000000001",
      assignmentProjectionId: "90000000-0000-4000-8000-000000000001",
      providerState: "available",
      mappingStatus: "exact",
      learnerCount: 8,
      submittedCount: 6,
      gradedCount: 4,
    } as const;
    expect(
      parseStoredMoodleAssignmentResultProjection("aggregate", payload)
    ).toEqual(payload);

    for (const invalid of [
      { ...payload, learners: [] },
      { ...payload, submittedCount: 9 },
      { ...payload, gradedCount: 7 },
      { ...payload, learnerCount: -1 },
      { ...payload, mappingStatus: "missing" },
      { ...payload, mappingStatus: "reconciliation" },
    ]) {
      expect(() =>
        parseStoredMoodleAssignmentResultProjection("aggregate", invalid)
      ).toThrow(MoodleProjectionSnapshotError);
    }
  });

  it("parses sanitized quiz attempts and rejects question or preview data", () => {
    const payload = {
      internalCourseId: "50000000-0000-4000-8000-000000000001",
      internalClassGroupId: "60000000-0000-4000-8000-000000000001",
      quizProjectionId: "90000000-0000-4000-8000-000000000002",
      providerState: "available",
      mappingStatus: "exact",
      learners: [
        {
          internalUserId: "10000000-0000-4000-8000-000000000001",
          internalEnrollmentId: "70000000-0000-4000-8000-000000000001",
          internalMembershipId: "80000000-0000-4000-8000-000000000001",
          attemptProjectionId: "a0000000-0000-4000-8000-000000000001",
          attemptState: "finished",
          attemptNumber: 1,
          gradingState: "graded",
          latest: true,
          preview: false,
          startedAt: "2026-07-17T01:00:00.000Z",
          finishedAt: "2026-07-17T01:30:00.000Z",
          modifiedAt: "2026-07-17T01:30:00.000Z",
          score: 9,
          maximumScore: 10,
        },
      ],
    } as const;
    expect(parseStoredMoodleQuizAttemptProjection("learner", payload)).toEqual(
      payload
    );
    for (const invalidLearner of [
      { ...payload.learners[0], preview: true },
      { ...payload.learners[0], answer: "private" },
      { ...payload.learners[0], attemptProjectionId: undefined },
      { ...payload.learners[0], finishedAt: undefined },
      { ...payload.learners[0], score: 11 },
      { ...payload.learners[0], attemptState: "in_progress" },
    ]) {
      expect(() =>
        parseStoredMoodleQuizAttemptProjection("person_level", {
          ...payload,
          learners: [invalidLearner],
        })
      ).toThrow(MoodleProjectionSnapshotError);
    }
  });

  it("keeps aggregate quiz attempt counts consistent and person-free", () => {
    const payload = {
      internalCourseId: "50000000-0000-4000-8000-000000000001",
      internalClassGroupId: "60000000-0000-4000-8000-000000000001",
      quizProjectionId: "90000000-0000-4000-8000-000000000002",
      providerState: "available",
      mappingStatus: "exact",
      learnerCount: 8,
      attemptedCount: 7,
      finishedCount: 6,
      gradedCount: 5,
    } as const;
    expect(
      parseStoredMoodleQuizAttemptProjection("aggregate", payload)
    ).toEqual(payload);
    for (const invalid of [
      { ...payload, learners: [] },
      { ...payload, attemptedCount: 9 },
      { ...payload, finishedCount: 8 },
      { ...payload, gradedCount: 7 },
      { ...payload, internalUserId: "10000000-0000-4000-8000-000000000001" },
    ]) {
      expect(() =>
        parseStoredMoodleQuizAttemptProjection("aggregate", invalid)
      ).toThrow(MoodleProjectionSnapshotError);
    }
  });

  it("exposes only released feedback to learners", () => {
    const payload = {
      internalCourseId: "50000000-0000-4000-8000-000000000001",
      internalClassGroupId: "60000000-0000-4000-8000-000000000001",
      gradeItemProjectionId: "b0000000-0000-4000-8000-000000000001",
      providerState: "available",
      mappingStatus: "exact",
      learners: [
        {
          internalUserId: "10000000-0000-4000-8000-000000000001",
          internalEnrollmentId: "70000000-0000-4000-8000-000000000001",
          internalMembershipId: "80000000-0000-4000-8000-000000000001",
          gradingState: "released",
          score: 18,
          maximumScore: 20,
          gradedAt: "2026-07-17T10:00:00.000Z",
          releasedAt: "2026-07-17T11:00:00.000Z",
          feedback: "Accurate work with clear reasoning.",
        },
      ],
    } as const;
    expect(parseStoredMoodleGradeOutcomeProjection("learner", payload)).toEqual(
      payload
    );
    for (const invalidLearner of [
      {
        ...payload.learners[0],
        gradingState: "graded",
        releasedAt: undefined,
        feedback: undefined,
      },
      { ...payload.learners[0], feedback: "<script>unsafe</script>" },
      { ...payload.learners[0], score: 21 },
      { ...payload.learners[0], releasedAt: undefined },
      { ...payload.learners[0], answer: "private" },
    ]) {
      expect(() =>
        parseStoredMoodleGradeOutcomeProjection("learner", {
          ...payload,
          learners: [invalidLearner],
        })
      ).toThrow(MoodleProjectionSnapshotError);
    }
  });

  it("keeps aggregate grade outcomes person-free and monotonic", () => {
    const payload = {
      internalCourseId: "50000000-0000-4000-8000-000000000001",
      internalClassGroupId: "60000000-0000-4000-8000-000000000001",
      gradeItemProjectionId: "b0000000-0000-4000-8000-000000000001",
      providerState: "available",
      mappingStatus: "exact",
      learnerCount: 10,
      gradedCount: 8,
      releasedCount: 6,
      feedbackReleasedCount: 4,
    } as const;
    expect(
      parseStoredMoodleGradeOutcomeProjection("aggregate", payload)
    ).toEqual(payload);
    for (const invalid of [
      { ...payload, gradedCount: 11 },
      { ...payload, releasedCount: 9 },
      { ...payload, feedbackReleasedCount: 7 },
      { ...payload, learners: [] },
      { ...payload, internalUserId: "10000000-0000-4000-8000-000000000001" },
    ]) {
      expect(() =>
        parseStoredMoodleGradeOutcomeProjection("aggregate", invalid)
      ).toThrow(MoodleProjectionSnapshotError);
    }
  });

  it("projects only bounded completion and released activity scores", () => {
    const payload = {
      internalCourseId: "50000000-0000-4000-8000-000000000001",
      internalClassGroupId: "60000000-0000-4000-8000-000000000001",
      activityProjectionId: "c0000000-0000-4000-8000-000000000001",
      activityKind: "h5p",
      providerState: "available",
      mappingStatus: "exact",
      learners: [
        {
          internalUserId: "10000000-0000-4000-8000-000000000001",
          internalEnrollmentId: "70000000-0000-4000-8000-000000000001",
          internalMembershipId: "80000000-0000-4000-8000-000000000001",
          completionState: "passed",
          scoreState: "released",
          completedAt: "2026-07-17T10:00:00.000Z",
          score: 9,
          maximumScore: 10,
          releasedAt: "2026-07-17T11:00:00.000Z",
        },
      ],
    } as const;
    expect(
      parseStoredMoodleActivityOutcomeProjection("learner", payload)
    ).toEqual(payload);
    for (const invalid of [
      { ...payload, activityKind: "quiz" },
      {
        ...payload,
        learners: [{ ...payload.learners[0], scoreState: "not_scored" }],
      },
      {
        ...payload,
        learners: [{ ...payload.learners[0], releasedAt: undefined }],
      },
      {
        ...payload,
        learners: [{ ...payload.learners[0], score: 11 }],
      },
      {
        ...payload,
        learners: [{ ...payload.learners[0], track: "cmi.core.score.raw" }],
      },
    ]) {
      expect(() =>
        parseStoredMoodleActivityOutcomeProjection("learner", invalid)
      ).toThrow(MoodleProjectionSnapshotError);
    }
  });

  it("keeps aggregate activity outcomes person-free and monotonic", () => {
    const payload = {
      internalCourseId: "50000000-0000-4000-8000-000000000001",
      internalClassGroupId: "60000000-0000-4000-8000-000000000001",
      activityProjectionId: "c0000000-0000-4000-8000-000000000001",
      activityKind: "scorm",
      providerState: "available",
      mappingStatus: "exact",
      learnerCount: 10,
      startedCount: 8,
      completedCount: 6,
      passedCount: 4,
      failedCount: 2,
      scoredCount: 5,
    } as const;
    expect(
      parseStoredMoodleActivityOutcomeProjection("aggregate", payload)
    ).toEqual(payload);
    for (const invalid of [
      { ...payload, startedCount: 11 },
      { ...payload, completedCount: 9 },
      { ...payload, passedCount: 5, failedCount: 3 },
      { ...payload, scoredCount: 11 },
      { ...payload, learners: [] },
    ]) {
      expect(() =>
        parseStoredMoodleActivityOutcomeProjection("aggregate", invalid)
      ).toThrow(MoodleProjectionSnapshotError);
    }
  });
});
