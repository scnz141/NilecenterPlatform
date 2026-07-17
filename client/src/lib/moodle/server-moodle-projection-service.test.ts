import { describe, expect, it } from "vitest";

import type { ServerSession } from "../../../../server/auth";
import {
  MoodleProjectionAuthorityError,
  MoodleProjectionMappingError,
  assertMoodleCatalogProjectionRole,
  projectMoodleCourseContent,
  projectMoodleCourses,
  resolveMoodleCourseAuthority,
  type MoodleCourseMapping,
} from "../../../../server/moodleProjectionService";
import { seedPlatformState } from "../domain/seed";

const session = (
  activeRole: ServerSession["activeRole"],
  userId: string,
  scope: Pick<ServerSession, "branchIds" | "departmentIds"> = {}
): ServerSession => ({
  id: `session-${activeRole}`,
  userId,
  email: `${activeRole}@nilelearn.local`,
  name: activeRole,
  roles: [activeRole],
  activeRole,
  provider: "supabase",
  authorizationModel: "normalized",
  createdAt: "2026-07-16T00:00:00.000Z",
  expiresAt: "2026-07-17T00:00:00.000Z",
  ...scope,
});

const mappings: MoodleCourseMapping[] = [
  {
    internalCourseId: "course_ar_l3",
    externalCourseId: "42",
    state: "synced",
  },
  {
    internalCourseId: "course_qt_1",
    externalCourseId: "43",
    state: "stale",
  },
];

const providerCourses = [
  {
    sourceId: "42",
    title: "Arabic Foundations",
    shortTitle: "AR-FND",
  },
  {
    sourceId: "43",
    title: "Tajweed",
    shortTitle: "QT-1",
  },
  {
    sourceId: "99",
    title: "Unmapped provider course",
    shortTitle: "UNMAPPED",
  },
];

describe("Moodle projection authority", () => {
  it("derives student courses from active or completed enrollments", () => {
    const result = resolveMoodleCourseAuthority(
      session("student", "usr_student_demo"),
      seedPlatformState
    );
    expect(result).toContain("course_ar_l3");
    expect(result).not.toContain("course_ar_l1");
  });

  it("derives teacher courses only from active assigned runs", () => {
    const result = resolveMoodleCourseAuthority(
      session("teacher", "usr_teacher_demo"),
      seedPlatformState
    );
    expect(result).toContain("course_ar_l3");
    expect(result).not.toContain("course_ar_l1");
  });

  it("uses normalized HOD department scope instead of request parameters", () => {
    const result = resolveMoodleCourseAuthority(
      session("headofdepartment", "usr_hod_demo", {
        departmentIds: ["dept_foundations"],
      }),
      seedPlatformState
    );
    expect([...result]).not.toContain("course_ar_l3");
  });

  it("keeps registrar and branch roles outside catalog/content ownership", () => {
    expect(() =>
      assertMoodleCatalogProjectionRole(
        session("registrar", "usr_registrar_demo")
      )
    ).toThrow(MoodleProjectionAuthorityError);
    expect(() =>
      assertMoodleCatalogProjectionRole(
        session("branchadmin", "usr_branch_demo")
      )
    ).toThrow(MoodleProjectionAuthorityError);
  });

  it("fails closed when the session user has no canonical record", () => {
    expect(() =>
      resolveMoodleCourseAuthority(
        session("teacher", "missing-user"),
        seedPlatformState
      )
    ).toThrow(MoodleProjectionAuthorityError);
    expect(() =>
      resolveMoodleCourseAuthority(
        session("superadmin", "missing-user"),
        seedPlatformState
      )
    ).toThrow(MoodleProjectionAuthorityError);
  });

  it("rejects inactive identities and stale role grants", () => {
    const inactiveState = structuredClone(seedPlatformState);
    inactiveState.users.find(user => user.id === "usr_teacher_demo")!.status =
      "paused";
    expect(() =>
      resolveMoodleCourseAuthority(
        session("teacher", "usr_teacher_demo"),
        inactiveState
      )
    ).toThrow(MoodleProjectionAuthorityError);

    const staleRoleState = structuredClone(seedPlatformState);
    staleRoleState.users.find(user => user.id === "usr_teacher_demo")!.roles = [
      "student",
    ];
    expect(() =>
      resolveMoodleCourseAuthority(
        session("teacher", "usr_teacher_demo"),
        staleRoleState
      )
    ).toThrow(MoodleProjectionAuthorityError);
  });

  it("rejects inactive role-specific profiles", () => {
    const state = structuredClone(seedPlatformState);
    state.staffProfiles.find(
      profile =>
        profile.userId === "usr_teacher_demo" && profile.role === "teacher"
    )!.status = "paused";
    expect(() =>
      resolveMoodleCourseAuthority(
        session("teacher", "usr_teacher_demo"),
        state
      )
    ).toThrow(MoodleProjectionAuthorityError);
  });
});

describe("Moodle course projection", () => {
  it("returns only exact mapped courses for a student", () => {
    const rows = projectMoodleCourses({
      session: session("student", "usr_student_demo"),
      state: seedPlatformState,
      mappings,
      providerCourses,
    });
    expect(rows.some(row => row.course?.sourceId === "99")).toBe(false);
    expect(rows.find(row => row.internalCourseId === "course_ar_l3")).toEqual({
      internalCourseId: "course_ar_l3",
      mappingState: "synced",
      course: providerCourses[0],
    });
  });

  it("shows unmatched provider courses only to Super Admin", () => {
    const rows = projectMoodleCourses({
      session: session("superadmin", "usr_admin_demo"),
      state: seedPlatformState,
      mappings,
      providerCourses,
    });
    expect(rows.find(row => row.course?.sourceId === "99")).toEqual({
      mappingState: "unmatched",
      reconciliationReason: "missing_mapping",
      course: providerCourses[2],
    });
  });

  it("surfaces missing mappings and missing provider records", () => {
    const rows = projectMoodleCourses({
      session: session("superadmin", "usr_admin_demo"),
      state: seedPlatformState,
      mappings: [
        ...mappings,
        {
          internalCourseId: "course_ar_l1",
          externalCourseId: "404",
          state: "stale",
        },
      ],
      providerCourses,
    });
    expect(rows).toContainEqual({
      internalCourseId: "course_ar_l1",
      mappingState: "missing",
      reconciliationReason: "missing_provider_record",
    });
    expect(
      rows.some(row => row.reconciliationReason === "missing_mapping")
    ).toBe(true);
  });

  it("rejects duplicate or malformed mappings instead of title matching", () => {
    expect(() =>
      projectMoodleCourses({
        session: session("superadmin", "usr_admin_demo"),
        state: seedPlatformState,
        mappings: [mappings[0], { ...mappings[0], internalCourseId: "other" }],
        providerCourses,
      })
    ).toThrow(MoodleProjectionMappingError);
    expect(() =>
      projectMoodleCourses({
        session: session("superadmin", "usr_admin_demo"),
        state: seedPlatformState,
        mappings: [
          {
            internalCourseId: "course_ar_l3",
            externalCourseId: "9007199254740992",
            state: "matched",
          },
        ],
        providerCourses,
      })
    ).toThrow(MoodleProjectionMappingError);
    expect(() =>
      projectMoodleCourses({
        session: session("superadmin", "usr_admin_demo"),
        state: seedPlatformState,
        mappings: [
          {
            internalCourseId: "unknown-course",
            externalCourseId: "44",
            state: "matched",
          },
        ],
        providerCourses,
      })
    ).toThrow(MoodleProjectionMappingError);
    expect(() =>
      projectMoodleCourses({
        session: session("superadmin", "usr_admin_demo"),
        state: seedPlatformState,
        mappings: [
          {
            internalCourseId: "course_ar_l3",
            externalCourseId: "042",
            state: "matched",
          },
        ],
        providerCourses,
      })
    ).toThrow(MoodleProjectionMappingError);
    expect(() =>
      projectMoodleCourses({
        session: session("superadmin", "usr_admin_demo"),
        state: seedPlatformState,
        mappings: [
          {
            internalCourseId: "course_ar_l3",
            externalCourseId: "Arabic Foundations",
            state: "matched",
          },
        ],
        providerCourses,
      })
    ).toThrow(MoodleProjectionMappingError);
  });

  it("rejects duplicate provider identifiers", () => {
    expect(() =>
      projectMoodleCourses({
        session: session("superadmin", "usr_admin_demo"),
        state: seedPlatformState,
        mappings,
        providerCourses: [providerCourses[0], providerCourses[0]],
      })
    ).toThrow(MoodleProjectionMappingError);
  });

  it("does not expose hidden Moodle courses to students", () => {
    const rows = projectMoodleCourses({
      session: session("student", "usr_student_demo"),
      state: seedPlatformState,
      mappings,
      providerCourses: [{ ...providerCourses[0], visible: false }],
    });
    expect(rows.some(row => row.internalCourseId === "course_ar_l3")).toBe(
      false
    );
  });

  it("replays deterministically without mutating canonical state", () => {
    const state = structuredClone(seedPlatformState);
    const before = JSON.stringify(state);
    const input = {
      session: session("student", "usr_student_demo"),
      state,
      mappings,
      providerCourses,
    };
    expect(projectMoodleCourses(input)).toEqual(projectMoodleCourses(input));
    expect(JSON.stringify(state)).toBe(before);
  });

  it("keeps stale mapping state visible without changing authority", () => {
    const rows = projectMoodleCourses({
      session: session("student", "usr_student_demo"),
      state: seedPlatformState,
      mappings,
      providerCourses,
    });
    expect(rows.find(row => row.internalCourseId === "course_qt_1")).toEqual({
      internalCourseId: "course_qt_1",
      mappingState: "stale",
      course: providerCourses[1],
    });
  });
});

describe("Moodle course content projection", () => {
  it("projects content only after canonical authorization and exact mapping", () => {
    expect(
      projectMoodleCourseContent({
        session: session("student", "usr_student_demo"),
        state: seedPlatformState,
        mappings,
        internalCourseId: "course_ar_l3",
        sections: [],
      })
    ).toEqual({
      internalCourseId: "course_ar_l3",
      externalCourseId: "42",
      mappingState: "synced",
      sections: [],
    });
  });

  it("denies unrelated content before consulting provider data", () => {
    expect(() =>
      projectMoodleCourseContent({
        session: session("student", "usr_student_demo"),
        state: seedPlatformState,
        mappings,
        internalCourseId: "course_ar_l1",
        sections: [],
      })
    ).toThrow(MoodleProjectionAuthorityError);
  });

  it("fails closed when an authorized course has no exact mapping", () => {
    expect(() =>
      projectMoodleCourseContent({
        session: session("student", "usr_student_demo"),
        state: seedPlatformState,
        mappings: [],
        internalCourseId: "course_ar_l3",
        sections: [],
      })
    ).toThrow(MoodleProjectionMappingError);
  });

  it("filters hidden sections and activities from student content", () => {
    const projection = projectMoodleCourseContent({
      session: session("student", "usr_student_demo"),
      state: seedPlatformState,
      mappings,
      internalCourseId: "course_ar_l3",
      sections: [
        {
          sourceId: "1",
          position: 1,
          visible: true,
          activities: [
            {
              sourceId: "10",
              instanceSourceId: "100",
              type: "page",
              title: "Visible",
              visible: true,
            },
            {
              sourceId: "11",
              instanceSourceId: "101",
              type: "page",
              title: "Hidden",
              visible: false,
            },
          ],
        },
        {
          sourceId: "2",
          position: 2,
          visible: false,
          activities: [],
        },
        {
          sourceId: "3",
          position: 3,
          activities: [
            {
              sourceId: "12",
              instanceSourceId: "102",
              type: "page",
              title: "Unknown visibility",
            },
          ],
        },
        {
          sourceId: "4",
          position: 4,
          visible: true,
          activities: [
            {
              sourceId: "13",
              instanceSourceId: "103",
              type: "page",
              title: "Unknown activity visibility",
            },
          ],
        },
      ],
    });
    expect(projection.sections).toHaveLength(2);
    expect(
      projection.sections[0].activities.map(item => item.sourceId)
    ).toEqual(["10"]);
    expect(projection.sections[1].activities).toEqual([]);
  });
});
