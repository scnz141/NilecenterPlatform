import { describe, expect, it } from "vitest";

import {
  createMoodleFileAccessToken,
  decorateMoodleFileResources,
  MoodleFileAccessError,
  parseMoodleFileAccessToken,
} from "../../../../server/moodleFileAccess.js";

const secret = "synthetic-moodle-file-secret-for-tests-only";
const now = Date.parse("2026-07-23T12:00:00.000Z");

describe("Moodle file access tickets", () => {
  it("creates opaque, expiring, tamper-resistant tickets", () => {
    const token = createMoodleFileAccessToken(
      { courseId: "course_ar_l3", resourceId: "81:1" },
      secret,
      now
    );
    expect(token).not.toContain("course_ar_l3");
    expect(parseMoodleFileAccessToken(token, secret, now)).toEqual({
      courseId: "course_ar_l3",
      resourceId: "81:1",
      expiresAt: Math.floor(now / 1000) + 300,
    });
    const replacement = token.endsWith("A") ? "B" : "A";
    expect(() =>
      parseMoodleFileAccessToken(
        `${token.slice(0, -1)}${replacement}`,
        secret,
        now
      )
    ).toThrow(MoodleFileAccessError);
    expect(() =>
      parseMoodleFileAccessToken(token, secret, now + 301_000)
    ).toThrow(MoodleFileAccessError);
  });

  it("adds proxy paths only to Moodle-hosted resources", () => {
    const projection = {
      internalCourseId: "course_ar_l3",
      sections: [
        {
          activities: [
            {
              resources: [
                { resourceId: "81:1", external: false },
                { resourceId: "81:2", external: true },
              ],
            },
          ],
        },
      ],
    };
    const decorated = decorateMoodleFileResources(
      projection,
      secret,
      now
    );
    expect(decorated.sections[0].activities[0].resources?.[0]).toHaveProperty(
      "downloadPath"
    );
    expect(
      decorated.sections[0].activities[0].resources?.[1]
    ).not.toHaveProperty("downloadPath");
  });
});
