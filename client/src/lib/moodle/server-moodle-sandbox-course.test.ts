import { describe, expect, it, vi } from "vitest";

import {
  createMoodleSandboxCourseClient,
  MOODLE_SANDBOX_COURSE_ACK,
  MOODLE_SANDBOX_COURSE_FUNCTIONS,
  MOODLE_SANDBOX_WRITE_HOST,
} from "../../../../server/moodleSandboxWriteClient";
import {
  runMoodleSandboxCourseWorkflow,
  type MoodleSandboxCourseWorkflowClient,
} from "../../../../server/moodleSandboxCourseWorkflow";

const marker = "NILE-M2CC-20260719T120000Z-a1b2c3d4";
const course = {
  marker,
  fullName: `Synthetic ${marker}`,
  updatedFullName: `Verified ${marker}`,
  shortName: `NILE-${marker}`,
  summary: `Synthetic fixture ${marker}`,
};
const publicResolution = async () => [{ address: "93.184.216.34", family: 4 }];

function response(value: unknown) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function siteInfo(functions = MOODLE_SANDBOX_COURSE_FUNCTIONS) {
  return {
    sitename: "Moodle No Data",
    siteurl: `https://${MOODLE_SANDBOX_WRITE_HOST}`,
    functions: functions.map(name => ({ name })),
  };
}

describe("Moodle synthetic sandbox course client", () => {
  it("is disabled by default and pins the approved HTTPS sandbox host", () => {
    expect(() =>
      createMoodleSandboxCourseClient({
        enabled: false,
        baseUrl: `https://${MOODLE_SANDBOX_WRITE_HOST}`,
        service: "nile_m2cc_course_fixture",
        token: "server-only-token",
        syntheticAck: MOODLE_SANDBOX_COURSE_ACK,
        allowedCategoryId: 1,
      })
    ).toThrowError(expect.objectContaining({ code: "configuration" }));
    expect(() =>
      createMoodleSandboxCourseClient({
        enabled: true,
        baseUrl: "https://example.test",
        service: "nile_m2cc_course_fixture",
        token: "server-only-token",
        syntheticAck: MOODLE_SANDBOX_COURSE_ACK,
        allowedCategoryId: 1,
      })
    ).toThrowError(expect.objectContaining({ code: "configuration" }));
  });

  it("requires an exact five-function probe and marker-bound reconciliation", async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn<typeof fetch>(async (_url, init) => {
      const body = init?.body as URLSearchParams;
      const name = String(body.get("wsfunction"));
      calls.push(name);
      if (name === "core_webservice_get_site_info") return response(siteInfo());
      if (name === "core_course_get_courses_by_field") {
        return response({ courses: [], warnings: [] });
      }
      if (name === "core_course_create_courses") {
        return response([{ id: 42, shortname: course.shortName }]);
      }
      return response([]);
    });
    const client = createMoodleSandboxCourseClient({
      enabled: true,
      baseUrl: `https://${MOODLE_SANDBOX_WRITE_HOST}`,
      service: "nile_m2cc_course_fixture",
      token: "server-only-token",
      syntheticAck: MOODLE_SANDBOX_COURSE_ACK,
      allowedCategoryId: 1,
      fetchImpl,
      resolveHostname: publicResolution,
    });

    await expect(client.probe()).resolves.toMatchObject({
      minimumPrivilegeVerified: true,
      approvedFunctionCount: 5,
    });
    await expect(client.findCourseByMarker(marker)).resolves.toBeUndefined();
    await expect(client.createCourse(course)).resolves.toEqual({
      id: 42,
      shortName: course.shortName,
    });
    await expect(
      client.updateCourse({ ...course, courseId: 99 })
    ).rejects.toMatchObject({ code: "guard", statusCode: 403 });
    await expect(
      client.call("core_user_create_users" as never)
    ).rejects.toMatchObject({ code: "function_not_allowed" });
    expect(calls).toEqual([
      "core_webservice_get_site_info",
      "core_course_get_courses_by_field",
      "core_course_create_courses",
    ]);
  });

  it("fails the capability probe when the service exposes an extra function", async () => {
    const client = createMoodleSandboxCourseClient({
      enabled: true,
      baseUrl: `https://${MOODLE_SANDBOX_WRITE_HOST}`,
      service: "nile_m2cc_course_fixture",
      token: "server-only-token",
      syntheticAck: MOODLE_SANDBOX_COURSE_ACK,
      allowedCategoryId: 1,
      fetchImpl: vi.fn<typeof fetch>(async () =>
        response(
          siteInfo([
            ...MOODLE_SANDBOX_COURSE_FUNCTIONS,
            "core_user_create_users",
          ] as never)
        )
      ),
      resolveHostname: publicResolution,
    });
    await expect(client.probe()).resolves.toMatchObject({
      minimumPrivilegeVerified: false,
      unexpectedFunctions: ["core_user_create_users"],
    });
  });
});

describe("Moodle synthetic sandbox course workflow", () => {
  function provider(options: { createTimeout?: boolean } = {}) {
    let state:
      | {
          id: number;
          marker: string;
          fullName: string;
          shortName: string;
          summary: string;
          categoryId: number;
        }
      | undefined;
    let createTimeout = options.createTimeout;
    const mutations: string[] = [];
    const client: MoodleSandboxCourseWorkflowClient = {
      async probe() {
        return {
          mode: "sandbox_course_write",
          verifiedAt: "2026-07-19T12:00:00.000Z",
          service: "nile_m2cc_course_fixture",
          site: {
            name: "Moodle No Data",
            url: `https://${MOODLE_SANDBOX_WRITE_HOST}`,
          },
          availableFunctionCount: 5,
          approvedFunctionCount: 5,
          missingApprovedFunctions: [],
          unexpectedFunctions: [],
          hasDuplicateFunctions: false,
          minimumPrivilegeVerified: true,
        };
      },
      async findCourseByMarker() {
        return state;
      },
      async createCourse(input) {
        mutations.push("create");
        state = {
          id: 42,
          marker: input.marker,
          fullName: input.fullName,
          shortName: input.shortName,
          summary: input.summary,
          categoryId: 1,
        };
        if (createTimeout) {
          createTimeout = false;
          throw Object.assign(new Error("timeout"), { code: "timeout" });
        }
        return { id: 42, shortName: input.shortName };
      },
      async updateCourse(input) {
        mutations.push("update");
        if (state) state.fullName = input.updatedFullName;
      },
      async deleteCourse() {
        mutations.push("delete");
        state = undefined;
      },
    };
    return { client, mutations, getState: () => state };
  }

  it("creates, updates, replays, deletes, and repeats cleanup", async () => {
    const fake = provider();
    const result = await runMoodleSandboxCourseWorkflow({
      client: fake.client,
      course,
    });
    expect(result).toMatchObject({
      outcome: "completed",
      ensurePasses: 2,
      cleanup: "absent",
    });
    expect(fake.mutations).toEqual(["create", "update", "delete"]);
    expect(fake.getState()).toBeUndefined();
    expect(
      result.evidence.filter(item => item.operation === "replay")
    ).toHaveLength(1);
    expect(
      result.evidence.filter(item => item.operation === "cleanup_verify")
    ).toHaveLength(2);
  });

  it("reconciles a create applied before timeout without duplicating it", async () => {
    const fake = provider({ createTimeout: true });
    const result = await runMoodleSandboxCourseWorkflow({
      client: fake.client,
      course,
    });
    expect(fake.mutations.filter(item => item === "create")).toHaveLength(1);
    expect(
      result.evidence.find(item => item.operation === "create")?.outcome
    ).toBe("reconciled");
    expect(fake.getState()).toBeUndefined();
  });

  it("does not attempt cleanup when the exact capability probe fails", async () => {
    const fake = provider();
    fake.client.probe = async () => {
      throw Object.assign(new Error("retired token"), {
        code: "authentication",
      });
    };
    await expect(
      runMoodleSandboxCourseWorkflow({ client: fake.client, course })
    ).rejects.toMatchObject({
      code: "probe_failed",
      evidence: [{ operation: "probe", outcome: "failed" }],
    });
    expect(fake.mutations).toEqual([]);
  });
});
