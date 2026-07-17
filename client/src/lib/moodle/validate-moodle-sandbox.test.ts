import { describe, expect, it, vi } from "vitest";

import {
  MOODLE_READ_FUNCTIONS,
  type MoodleClient,
  type MoodleReadFunction,
} from "../../../../server/moodleClient";
import {
  MOODLE_PROJECTION_FUNCTIONS,
  runMoodleSandboxReadValidation,
} from "../../../../scripts/validate-moodle-sandbox";

function validEnvironment(): NodeJS.ProcessEnv {
  return {
    MOODLE_READ_ONLY_ENABLED: "1",
    MOODLE_BASE_URL: "https://moodle.example.test",
    MOODLE_SERVICE: "nilelearn_m2_read_sandbox",
    MOODLE_TOKEN: "read-token-only",
    MOODLE_ALLOWED_HOSTS: "moodle.example.test",
    MOODLE_FIXTURE_CATEGORY_ID: "1",
    MOODLE_FIXTURE_COURSE_ID: "2",
    MOODLE_FIXTURE_COURSE_MODULE_ID: "3",
    MOODLE_FIXTURE_USER_ID: "4",
    MOODLE_FIXTURE_INTERACTION_USER_ID: "13",
    MOODLE_FIXTURE_GROUPING_ID: "5",
    MOODLE_FIXTURE_ASSIGNMENT_ID: "6",
    MOODLE_FIXTURE_QUIZ_ID: "7",
    MOODLE_FIXTURE_QUIZ_ATTEMPT_ID: "8",
    MOODLE_FIXTURE_H5P_ACTIVITY_ID: "9",
    MOODLE_FIXTURE_H5P_ATTEMPT_ID: "10",
    MOODLE_FIXTURE_SCORM_SCO_ID: "11",
    MOODLE_FIXTURE_SCORM_ATTEMPT_NUMBER: "1",
    MOODLE_FIXTURE_LESSON_ID: "12",
  };
}

function contractPayload(functionName: MoodleReadFunction): unknown {
  switch (functionName) {
    case "core_course_get_categories":
    case "core_course_get_contents":
    case "core_enrol_get_enrolled_users":
    case "core_enrol_get_users_courses":
    case "core_user_get_users_by_field":
    case "core_group_get_course_groups":
    case "core_group_get_course_groupings":
      return [{}];
    case "core_course_get_courses_by_field":
      return { courses: [{}] };
    case "core_course_get_course_module":
      return { cm: {} };
    case "core_group_get_course_user_groups":
      return { groups: [{}] };
    case "core_completion_get_activities_completion_status":
      return { statuses: [{}] };
    case "core_completion_get_course_completion_status":
      return { completionstatus: {} };
    case "gradereport_user_get_grade_items":
      return { usergrades: [{}] };
    case "mod_assign_get_assignments":
      return { courses: [{ assignments: [{}] }] };
    case "mod_assign_get_submissions":
      return { assignments: [{ submissions: [{}] }] };
    case "mod_assign_get_grades":
      return { assignments: [{ grades: [{}] }] };
    case "mod_quiz_get_quizzes_by_courses":
      return { quizzes: [{}] };
    case "mod_quiz_get_user_attempts":
      return { attempts: [{}] };
    case "mod_quiz_get_attempt_review":
      return { questions: [{}] };
    case "mod_h5pactivity_get_h5pactivities_by_courses":
      return { h5pactivities: [{}] };
    case "mod_h5pactivity_get_attempts":
      return { attempts: [{}] };
    case "mod_h5pactivity_get_results":
      return { attempts: [{ results: [{}] }] };
    case "mod_scorm_get_scorms_by_courses":
      return { scorms: [{}] };
    case "mod_scorm_get_scorm_sco_tracks":
      return {
        data: {
          tracks: [{ element: "cmi.core.lesson_status", value: "completed" }],
        },
      };
    case "mod_lesson_get_lessons_by_courses":
      return { lessons: [{}] };
    case "mod_lesson_get_user_grade":
      return { grade: 0 };
    case "mod_book_get_books_by_courses":
      return { books: [{}] };
    case "mod_page_get_pages_by_courses":
      return { pages: [{}] };
    case "mod_resource_get_resources_by_courses":
      return { resources: [{}] };
    case "mod_url_get_urls_by_courses":
      return { urls: [{}] };
    default:
      throw new Error(`Unexpected contract function: ${functionName}`);
  }
}

function contractProjection(functionName: MoodleReadFunction): unknown {
  switch (functionName) {
    case "mod_h5pactivity_get_h5pactivities_by_courses":
      return [
        {
          sourceId: "9",
          activitySourceId: "109",
          courseSourceId: "2",
          title: "Nile Learn M2C-R TrueFalse Fixture",
        },
      ];
    case "mod_h5pactivity_get_attempts":
      return {
        activitySourceId: "9",
        users: [
          {
            sourceUserId: "13",
            attempts: [
              {
                sourceId: "10",
                activityInstanceSourceId: "9",
                sourceUserId: "13",
              },
            ],
          },
        ],
      };
    case "mod_h5pactivity_get_results":
      return {
        activitySourceId: "9",
        attempts: [
          {
            sourceId: "10",
            activityInstanceSourceId: "9",
            sourceUserId: "13",
            results: [{ sourceId: "110" }],
          },
        ],
      };
    case "mod_scorm_get_scorms_by_courses":
      return [
        {
          sourceId: "111",
          activitySourceId: "112",
          courseSourceId: "2",
          title: "Nile Learn M2C-R SCORM 1.2 Fixture",
        },
      ];
    case "mod_scorm_get_scorm_sco_tracks":
      return { attempt: 1, status: "completed" };
    default:
      return [{ sourceId: functionName }];
  }
}

function fakeClient(
  payloadFor: (functionName: MoodleReadFunction) => unknown = contractPayload,
  onCall?: (
    functionName: MoodleReadFunction,
    parameters: Record<string, unknown> | undefined
  ) => void
): Pick<MoodleClient, "call" | "probe"> {
  return {
    async call<T>(
      functionName: MoodleReadFunction,
      parameters?: Record<string, unknown>
    ) {
      onCall?.(functionName, parameters);
      return payloadFor(functionName) as T;
    },
    async probe() {
      return {
        mode: "read_only" as const,
        verifiedAt: "2026-07-13T12:00:00.000Z",
        site: {
          name: "M2C Sandbox",
          url: "https://moodle.example.test",
        },
        availableFunctionCount: MOODLE_READ_FUNCTIONS.length,
        approvedFunctionCount: MOODLE_READ_FUNCTIONS.length,
        missingApprovedFunctions: [],
        unexpectedFunctions: [],
        minimumPrivilegeVerified: true,
      };
    },
  };
}

describe("Moodle M2C read validator", () => {
  it("parses every one of the 30 dispatched read contracts before accepting it", async () => {
    const parsedFunctions: MoodleReadFunction[] = [];
    const parseResponse = vi.fn((functionName: MoodleReadFunction) => {
      parsedFunctions.push(functionName);
      return contractProjection(functionName);
    });

    const result = await runMoodleSandboxReadValidation(validEnvironment(), {
      createClient: () => fakeClient(),
      parseResponse,
    });

    expect(result.exitCode).toBe(0);
    expect(result.results).toHaveLength(MOODLE_READ_FUNCTIONS.length);
    expect(parseResponse).toHaveBeenCalledTimes(30);
    expect(parsedFunctions).toEqual(MOODLE_PROJECTION_FUNCTIONS);
    expect(result.results.every(item => item.ok)).toBe(true);
  });

  it("fails closed when the parser rejects a malformed provider payload", async () => {
    const result = await runMoodleSandboxReadValidation(validEnvironment(), {
      createClient: () =>
        fakeClient(functionName =>
          functionName === "core_course_get_categories"
            ? [{}]
            : contractPayload(functionName)
        ),
    });

    expect(
      result.results.find(
        item => item.function === "core_course_get_categories"
      )
    ).toMatchObject({ ok: false, errorCode: "invalid_response" });
    expect(result.exitCode).toBe(1);
  });

  it("rejects a leaky parsed projection instead of accepting the contract", async () => {
    const result = await runMoodleSandboxReadValidation(validEnvironment(), {
      createClient: () => fakeClient(),
      parseResponse: functionName =>
        functionName === "core_course_get_categories"
          ? [{ sourceId: "1", email: "private@example.test" }]
          : [],
    });

    expect(
      result.results.find(
        item => item.function === "core_course_get_categories"
      )
    ).toMatchObject({ ok: false, errorCode: "invalid_response" });
    expect(result.exitCode).toBe(1);
  });

  it("keeps zero-count and warning fixture gaps distinct from parser failures", async () => {
    const result = await runMoodleSandboxReadValidation(validEnvironment(), {
      createClient: () =>
        fakeClient(functionName => {
          if (functionName === "core_course_get_categories") return [];
          if (functionName === "core_course_get_courses_by_field") {
            return { courses: [{}], warnings: [{ warningcode: "missing" }] };
          }
          return contractPayload(functionName);
        }),
      parseResponse: contractProjection,
    });

    expect(result.exitCode).toBe(2);
    expect(
      result.results.find(
        item => item.function === "core_course_get_categories"
      )
    ).toMatchObject({ ok: false, errorCode: "fixture_absent", count: 0 });
    expect(
      result.results.find(
        item => item.function === "core_course_get_courses_by_field"
      )
    ).toMatchObject({ ok: false, errorCode: "fixture_absent", count: 1 });
  });

  it("requires nested H5P interaction results, not only an attempt row", async () => {
    const result = await runMoodleSandboxReadValidation(validEnvironment(), {
      createClient: () =>
        fakeClient(functionName =>
          functionName === "mod_h5pactivity_get_results"
            ? { attempts: [{ results: [] }] }
            : contractPayload(functionName)
        ),
      parseResponse: functionName =>
        functionName === "mod_h5pactivity_get_results"
          ? {
              activitySourceId: "9",
              attempts: [
                {
                  sourceId: "10",
                  activityInstanceSourceId: "9",
                  sourceUserId: "13",
                  results: [],
                },
              ],
            }
          : contractProjection(functionName),
    });

    expect(
      result.results.find(
        item => item.function === "mod_h5pactivity_get_results"
      )
    ).toMatchObject({ ok: false, errorCode: "fixture_absent", count: 0 });
    expect(result.exitCode).toBe(2);
  });

  it("requires a supported SCORM progress metric instead of private state only", async () => {
    const result = await runMoodleSandboxReadValidation(validEnvironment(), {
      createClient: () =>
        fakeClient(functionName =>
          functionName === "mod_scorm_get_scorm_sco_tracks"
            ? {
                data: {
                  tracks: [{ element: "cmi.suspend_data", value: "private" }],
                },
              }
            : contractPayload(functionName)
        ),
      parseResponse: functionName =>
        functionName === "mod_scorm_get_scorm_sco_tracks"
          ? { attempt: 1 }
          : contractProjection(functionName),
    });

    expect(
      result.results.find(
        item => item.function === "mod_scorm_get_scorm_sco_tracks"
      )
    ).toMatchObject({ ok: false, errorCode: "fixture_absent", count: 0 });
    expect(result.exitCode).toBe(2);
  });

  it("binds H5P and SCORM interaction reads to the disposable learner", async () => {
    const calls = new Map<MoodleReadFunction, Record<string, unknown>>();
    await runMoodleSandboxReadValidation(validEnvironment(), {
      createClient: () =>
        fakeClient(contractPayload, (functionName, parameters) => {
          calls.set(functionName, parameters ?? {});
        }),
      parseResponse: contractProjection,
    });

    expect(calls.get("mod_h5pactivity_get_attempts")).toEqual({
      h5pactivityid: 9,
      userids: [13],
    });
    expect(calls.get("mod_scorm_get_scorm_sco_tracks")).toEqual({
      scoid: 11,
      userid: 13,
      attempt: 1,
    });
  });

  it.each([undefined, "0", "not-an-id"])(
    "fails only interaction-user reads for invalid disposable learner %s",
    async interactionUserId => {
      const environment = validEnvironment();
      environment.MOODLE_FIXTURE_INTERACTION_USER_ID = interactionUserId;
      const result = await runMoodleSandboxReadValidation(environment, {
        createClient: () => fakeClient(),
        parseResponse: () => [],
      });

      const affected = result.results.filter(item =>
        [
          "mod_h5pactivity_get_attempts",
          "mod_h5pactivity_get_results",
          "mod_scorm_get_scorm_sco_tracks",
        ].includes(item.function)
      );
      expect(affected.every(item => !item.ok)).toBe(true);
      expect(
        affected.every(item =>
          item.errorCode?.includes("MOODLE_FIXTURE_INTERACTION_USER_ID")
        )
      ).toBe(true);
      expect(affected).toHaveLength(3);
    }
  );

  it("produces stable sanitized function, family, and combined fingerprints", async () => {
    const dependencies = {
      createClient: () => fakeClient(),
      parseResponse: contractProjection,
    };
    const first = await runMoodleSandboxReadValidation(
      validEnvironment(),
      dependencies
    );
    const replay = await runMoodleSandboxReadValidation(
      validEnvironment(),
      dependencies
    );
    const changed = await runMoodleSandboxReadValidation(validEnvironment(), {
      createClient: () => fakeClient(),
      parseResponse: (functionName: MoodleReadFunction) => {
        const projection = contractProjection(functionName);
        return functionName === "core_course_get_categories"
          ? [{ sourceId: functionName, marker: "changed" }]
          : projection;
      },
    });

    expect(first.fingerprints).toEqual(replay.fingerprints);
    expect(Object.values(first.fingerprints.functions).every(Boolean)).toBe(
      true
    );
    expect(Object.keys(first.fingerprints.families)).toEqual([
      "course_content",
      "identity_access",
      "interactive_content",
      "progress_outcomes",
    ]);
    expect(changed.fingerprints.combined).not.toBe(first.fingerprints.combined);
    expect(changed.fingerprints.functions.core_course_get_categories).not.toBe(
      first.fingerprints.functions.core_course_get_categories
    );
    expect(changed.fingerprints.families.course_content).not.toBe(
      first.fingerprints.families.course_content
    );
    expect(changed.fingerprints.families.identity_access).toBe(
      first.fingerprints.families.identity_access
    );
  });

  it("rejects H5P attempts and results that are not owned by the disposable learner", async () => {
    const result = await runMoodleSandboxReadValidation(validEnvironment(), {
      createClient: () => fakeClient(),
      parseResponse: functionName => {
        if (functionName === "mod_h5pactivity_get_attempts") {
          return {
            activitySourceId: "9",
            users: [
              {
                sourceUserId: "13",
                attempts: [
                  {
                    sourceId: "10",
                    activityInstanceSourceId: "9",
                    sourceUserId: "99",
                  },
                ],
              },
            ],
          };
        }
        if (functionName === "mod_h5pactivity_get_results") {
          return {
            activitySourceId: "9",
            attempts: [
              {
                sourceId: "10",
                activityInstanceSourceId: "9",
                sourceUserId: "99",
                results: [{ sourceId: "110" }],
              },
            ],
          };
        }
        return contractProjection(functionName);
      },
    });

    expect(
      result.results.find(
        item => item.function === "mod_h5pactivity_get_attempts"
      )
    ).toMatchObject({ ok: false, errorCode: "invalid_response" });
    expect(
      result.results.find(
        item => item.function === "mod_h5pactivity_get_results"
      )
    ).toMatchObject({ ok: false, errorCode: "invalid_response" });
    expect(result.fingerprints.combined).toBeNull();
  });

  it("classifies absent H5P results separately from malformed results", async () => {
    const absent = await runMoodleSandboxReadValidation(validEnvironment(), {
      createClient: () =>
        fakeClient(functionName =>
          functionName === "mod_h5pactivity_get_results"
            ? { attempts: [{}] }
            : contractPayload(functionName)
        ),
      parseResponse: functionName =>
        functionName === "mod_h5pactivity_get_results"
          ? {
              activitySourceId: "9",
              attempts: [
                {
                  sourceId: "10",
                  activityInstanceSourceId: "9",
                  sourceUserId: "13",
                  results: [],
                },
              ],
            }
          : contractProjection(functionName),
    });
    const malformed = await runMoodleSandboxReadValidation(validEnvironment(), {
      createClient: () =>
        fakeClient(functionName =>
          functionName === "mod_h5pactivity_get_results"
            ? { attempts: [{ results: "invalid" }] }
            : contractPayload(functionName)
        ),
      parseResponse: contractProjection,
    });

    expect(
      absent.results.find(
        item => item.function === "mod_h5pactivity_get_results"
      )
    ).toMatchObject({ errorCode: "fixture_absent", count: 0 });
    expect(
      malformed.results.find(
        item => item.function === "mod_h5pactivity_get_results"
      )
    ).toMatchObject({ errorCode: "invalid_response", count: null });
  });

  it("aggregates nested H5P results and rejects a mismatched SCORM attempt", async () => {
    const result = await runMoodleSandboxReadValidation(validEnvironment(), {
      createClient: () =>
        fakeClient(functionName => {
          if (functionName === "mod_h5pactivity_get_results") {
            return {
              attempts: [{ results: [{}, {}] }, { results: [{}] }],
            };
          }
          return contractPayload(functionName);
        }),
      parseResponse: functionName =>
        functionName === "mod_scorm_get_scorm_sco_tracks"
          ? { attempt: 2, status: "completed" }
          : contractProjection(functionName),
    });

    expect(
      result.results.find(
        item => item.function === "mod_h5pactivity_get_results"
      )
    ).toMatchObject({ ok: true, count: 3 });
    expect(
      result.results.find(
        item => item.function === "mod_scorm_get_scorm_sco_tracks"
      )
    ).toMatchObject({ ok: false, errorCode: "invalid_response" });
  });

  it("normalizes SCORM metric case and whitespace", async () => {
    const result = await runMoodleSandboxReadValidation(validEnvironment(), {
      createClient: () =>
        fakeClient(functionName =>
          functionName === "mod_scorm_get_scorm_sco_tracks"
            ? {
                data: {
                  tracks: [{ element: " CMI.CORE.SCORE.RAW ", value: "100" }],
                },
              }
            : contractPayload(functionName)
        ),
      parseResponse: functionName =>
        functionName === "mod_scorm_get_scorm_sco_tracks"
          ? { attempt: 1, score: 100 }
          : contractProjection(functionName),
    });

    expect(
      result.results.find(
        item => item.function === "mod_scorm_get_scorm_sco_tracks"
      )
    ).toMatchObject({ ok: true, count: 1 });
  });

  it.each([undefined, "0", "-1", "1.5", "not-an-id", "2147483648"])(
    "rejects invalid interaction learner ID %s",
    async interactionUserId => {
      const environment = validEnvironment();
      environment.MOODLE_FIXTURE_INTERACTION_USER_ID = interactionUserId;
      const result = await runMoodleSandboxReadValidation(environment, {
        createClient: () => fakeClient(),
        parseResponse: contractProjection,
      });

      expect(
        result.results.filter(item =>
          [
            "mod_h5pactivity_get_attempts",
            "mod_h5pactivity_get_results",
            "mod_scorm_get_scorm_sco_tracks",
          ].includes(item.function)
        )
      ).toHaveLength(3);
      expect(result.fingerprints.combined).toBeNull();
    }
  );

  it("sorts true sets while preserving semantic course-section order", async () => {
    const runWith = (
      groupOrder: readonly string[],
      sectionOrder: readonly string[]
    ) =>
      runMoodleSandboxReadValidation(validEnvironment(), {
        createClient: () => fakeClient(),
        parseResponse: functionName => {
          if (functionName === "core_group_get_course_groups") {
            return groupOrder.map(sourceId => ({ sourceId }));
          }
          if (functionName === "core_course_get_contents") {
            return sectionOrder.map(sourceId => ({ sourceId }));
          }
          return contractProjection(functionName);
        },
      });

    const first = await runWith(["2", "1"], ["section-1", "section-2"]);
    const reorderedSet = await runWith(["1", "2"], ["section-1", "section-2"]);
    const reorderedSections = await runWith(
      ["2", "1"],
      ["section-2", "section-1"]
    );

    expect(first.fingerprints.combined).toBe(
      reorderedSet.fingerprints.combined
    );
    expect(first.fingerprints.combined).not.toBe(
      reorderedSections.fingerprints.combined
    );
  });

  it("suppresses aggregate fingerprints for partial runs", async () => {
    const result = await runMoodleSandboxReadValidation(validEnvironment(), {
      createClient: () =>
        fakeClient(functionName =>
          functionName === "core_course_get_categories"
            ? []
            : contractPayload(functionName)
        ),
      parseResponse: contractProjection,
    });

    expect(result.exitCode).toBe(2);
    expect(result.fingerprints.families.course_content).toBeNull();
    expect(result.fingerprints.combined).toBeNull();
    Object.values(result.fingerprints.functions)
      .filter((value): value is string => Boolean(value))
      .forEach(value => expect(value).toMatch(/^[a-f0-9]{64}$/));
  });
});
