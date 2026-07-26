import { describe, expect, it } from "vitest";
import {
  MoodleCommandValidationError,
  hashMoodlePayload,
  parseMoodleCommandCreateDto,
  parseMoodleLaunchCreateDto,
  stableMoodleJson,
} from "../../../../server/moodleCommandRuntime";

describe("Moodle command runtime DTOs", () => {
  it("accepts a closed internal-ID command without provider IDs", () => {
    const value = parseMoodleCommandCreateDto({
      operation: "page.upsert",
      targetInternalId: "b6000000-0000-4000-8000-000000000001",
      targetEntityType: "course",
      expectedProviderVersion: "2026072301",
      payload: {
        mode: "create",
        name: "Synthetic page",
        content: "<p>Synthetic content</p>",
        sectionNumber: 2,
      },
      idempotencyKey: "phase6l.page.synthetic.001",
    });
    expect(value.operation).toBe("page.upsert");
    expect(value.payload).toEqual({
      mode: "create",
      name: "Synthetic page",
      content: "<p>Synthetic content</p>",
      sectionNumber: 2,
    });
  });

  it("requires targetless delivery clone and rejects unknown keys", () => {
    expect(
      parseMoodleCommandCreateDto({
        operation: "delivery_course.clone",
        expectedProviderVersion: "2026072301",
        payload: {
          sourceTemplateInternalId: "b6000000-0000-4000-8000-000000000002",
          fullname: "Synthetic delivery",
          shortname: "NILE-6L-SYNTHETIC",
        },
        idempotencyKey: "phase6l.clone.synthetic.001",
      }).targetInternalId
    ).toBeUndefined();
    expect(() =>
      parseMoodleCommandCreateDto({
        operation: "delivery_course.clone",
        targetInternalId: "b6000000-0000-4000-8000-000000000001",
        targetEntityType: "course",
        expectedProviderVersion: "2026072301",
        payload: {},
        idempotencyKey: "phase6l.clone.synthetic.002",
      })
    ).toThrow(MoodleCommandValidationError);
  });

  it("rejects credentials anywhere in a command payload", () => {
    expect(() =>
      parseMoodleCommandCreateDto({
        operation: "page.upsert",
        targetInternalId: "b6000000-0000-4000-8000-000000000001",
        targetEntityType: "course",
        expectedProviderVersion: "2026072301",
        payload: {
          mode: "create",
          name: "Synthetic page",
          content: "<p>Content</p>",
          options: { wstoken: "forbidden" },
        },
        idempotencyKey: "phase6l.page.synthetic.003",
      })
    ).toThrow("Moodle command is invalid.");
  });

  it("rejects provider IDs in browser-authored command payloads", () => {
    expect(() =>
      parseMoodleCommandCreateDto({
        operation: "grade.update",
        targetInternalId: "b6000000-0000-4000-8000-000000000001",
        targetEntityType: "grade_item",
        expectedProviderVersion: "2026072301",
        payload: { userExternalId: 42, grade: 88 },
        idempotencyKey: "phase6l.grade.synthetic.001",
      })
    ).toThrow("Moodle command payload is invalid.");
  });

  it("hashes canonical payload order deterministically", () => {
    expect(stableMoodleJson({ b: 2, a: { d: 4, c: 3 } })).toBe(
      '{"a":{"c":3,"d":4},"b":2}'
    );
    expect(hashMoodlePayload({ b: 2, a: 1 })).toBe(
      hashMoodlePayload({ a: 1, b: 2 })
    );
  });

  it("accepts only the six closed launch kinds and app return paths", () => {
    expect(
      parseMoodleLaunchCreateDto({
        kind: "quiz_attempt",
        targetInternalId: "b6000000-0000-4000-8000-000000000001",
        targetEntityType: "quiz",
        returnPath: "/app/student/quizzes",
      }).kind
    ).toBe("quiz_attempt");
    expect(() =>
      parseMoodleLaunchCreateDto({
        kind: "admin_any_url",
        targetInternalId: "b6000000-0000-4000-8000-000000000001",
        targetEntityType: "quiz",
        returnPath: "https://evil.example/",
      })
    ).toThrow(MoodleCommandValidationError);
  });
});
