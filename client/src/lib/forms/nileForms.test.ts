import { describe, expect, it } from "vitest";

import {
  evaluateFormCalculations,
  evaluateFormLogic,
  getOfflineEligibility,
  normalizeAndValidateFormAnswers,
  validateFormVersionContent,
  type FormVersionContent,
} from "@shared/nileForms";
import {
  createNileFormsSeedState,
  nileFormsTemplateContent,
} from "@shared/nileFormsFixtures";

describe("Nile Forms schema and answer authority", () => {
  const calculationContent = (): FormVersionContent => ({
    contractVersion: 2,
    title: { en: "Fee summary", ar: "ملخص الرسوم", tr: "Ücret özeti" },
    description: { en: "", ar: "", tr: "" },
    defaultLanguage: "en",
    languages: ["en", "ar", "tr"],
    submitLabel: { en: "Submit", ar: "إرسال", tr: "Gönder" },
    confirmationMessage: {
      en: "Received",
      ar: "تم الاستلام",
      tr: "Alındı",
    },
    pages: [
      {
        id: "fees",
        title: { en: "Fees", ar: "الرسوم", tr: "Ücretler" },
        fields: [
          {
            id: "tuition",
            type: "number",
            label: { en: "Tuition", ar: "الرسوم", tr: "Öğrenim ücreti" },
            required: true,
          },
          {
            id: "materials",
            type: "number",
            label: { en: "Materials", ar: "المواد", tr: "Materyaller" },
            required: true,
          },
          {
            id: "subtotal",
            type: "number",
            label: {
              en: "Subtotal",
              ar: "المجموع الفرعي",
              tr: "Ara toplam",
            },
            required: true,
          },
          {
            id: "total",
            type: "number",
            label: { en: "Total", ar: "الإجمالي", tr: "Toplam" },
            required: true,
          },
        ],
      },
    ],
    logic: [],
    calculations: [
      {
        id: "subtotal_calculation",
        targetFieldId: "subtotal",
        operator: "sum",
        operands: [
          { type: "field", fieldId: "tuition" },
          { type: "field", fieldId: "materials" },
        ],
      },
      {
        id: "total_calculation",
        targetFieldId: "total",
        operator: "multiply",
        precision: 2,
        operands: [
          { type: "calculation", calculationId: "subtotal_calculation" },
          { type: "constant", value: 1.1 },
        ],
      },
    ],
  });

  it("validates all seven trilingual v2 initial templates", () => {
    const state = createNileFormsSeedState();

    expect(state.definitions).toHaveLength(7);
    expect(state.versions).toHaveLength(7);
    for (const version of state.versions) {
      const result = validateFormVersionContent(version.content);
      expect(result.issues).toEqual([]);
      expect(version.content.contractVersion).toBe(2);
      expect(version.content.languages).toEqual(["en", "ar", "tr"]);
    }
  });

  it("rejects cyclic conditional field rules", () => {
    const content: FormVersionContent = {
      ...structuredClone(nileFormsTemplateContent.support),
      logic: [
        {
          id: "rule_a",
          order: 1,
          when: {
            mode: "all",
            conditions: [
              { fieldId: "category", operator: "equals", value: "other" },
            ],
          },
          action: { type: "hide", targetFieldId: "subject" },
        },
        {
          id: "rule_b",
          order: 2,
          when: {
            mode: "all",
            conditions: [{ fieldId: "subject", operator: "not_empty" }],
          },
          action: { type: "hide", targetFieldId: "category" },
        },
      ],
    };

    const result = validateFormVersionContent(content);
    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual({
      path: "logic",
      message: "Conditional field rules cannot contain cycles",
    });
  });

  it("rejects condition operators and values that do not match the source field", () => {
    const content: FormVersionContent = {
      ...structuredClone(nileFormsTemplateContent.support),
      logic: [
        {
          id: "invalid_typed_logic",
          order: 1,
          when: {
            mode: "all",
            conditions: [
              { fieldId: "urgent", operator: "equals", value: "" },
              { fieldId: "category", operator: "greater_than", value: 2 },
            ],
          },
          action: { type: "show", targetFieldId: "details" },
        },
      ],
    };

    const result = validateFormVersionContent(content);
    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        {
          path: "logic.0.when",
          message: "Boolean fields require a boolean value",
        },
        {
          path: "logic.0.when",
          message: "greater_than is not supported for single_choice",
        },
      ])
    );
  });

  it("applies rules in deterministic order and clears hidden values", () => {
    const content: FormVersionContent = {
      ...structuredClone(nileFormsTemplateContent.support),
      logic: [
        {
          id: "hide_details",
          order: 1,
          when: {
            mode: "all",
            conditions: [
              { fieldId: "category", operator: "equals", value: "other" },
            ],
          },
          action: { type: "hide", targetFieldId: "details" },
        },
      ],
    };
    expect(validateFormVersionContent(content).ok).toBe(true);

    const logic = evaluateFormLogic(content, { category: "other" });
    expect(logic.hiddenFieldIds.has("details")).toBe(true);

    const result = normalizeAndValidateFormAnswers(content, {
      category: "other",
      subject: "Need a different team",
      details: "This value must not survive the hidden-field server pass.",
      urgent: false,
      injected_admin_role: "superadmin",
    });

    expect(result.ok).toBe(true);
    expect(result.answers).not.toHaveProperty("details");
    expect(result.answers).not.toHaveProperty("injected_admin_role");
  });

  it("hides show targets by default and gives matched hide rules precedence", () => {
    const content: FormVersionContent = {
      ...structuredClone(nileFormsTemplateContent.support),
      logic: [
        {
          id: "show_details",
          order: 1,
          when: {
            mode: "all",
            conditions: [
              { fieldId: "category", operator: "equals", value: "other" },
            ],
          },
          action: { type: "show", targetFieldId: "details" },
        },
        {
          id: "hide_details",
          order: 2,
          when: {
            mode: "all",
            conditions: [
              { fieldId: "urgent", operator: "equals", value: true },
            ],
          },
          action: { type: "hide", targetFieldId: "details" },
        },
        {
          id: "show_details_again",
          order: 3,
          when: {
            mode: "all",
            conditions: [
              { fieldId: "category", operator: "equals", value: "other" },
            ],
          },
          action: { type: "show", targetFieldId: "details" },
        },
      ],
    };

    expect(
      evaluateFormLogic(content, { category: "technical" }).hiddenFieldIds.has(
        "details"
      )
    ).toBe(true);
    expect(
      evaluateFormLogic(content, { category: "other" }).hiddenFieldIds.has(
        "details"
      )
    ).toBe(false);
    expect(
      evaluateFormLogic(content, {
        category: "other",
        urgent: true,
      }).hiddenFieldIds.has("details")
    ).toBe(true);
  });

  it("omits skipped-page answers and does not require skipped-page fields", () => {
    const content: FormVersionContent = {
      ...structuredClone(nileFormsTemplateContent.support),
      contractVersion: 1,
      languages: ["en", "ar"],
      pages: [
        {
          id: "start",
          title: { en: "Start", ar: "البداية" },
          fields: [
            {
              id: "route",
              type: "yes_no",
              label: { en: "Skip details", ar: "تخطي التفاصيل" },
              required: true,
            },
          ],
        },
        {
          id: "details_page",
          title: { en: "Details", ar: "التفاصيل" },
          fields: [
            {
              id: "skipped_secret",
              type: "short_text",
              label: { en: "Details", ar: "التفاصيل" },
              required: true,
            },
          ],
        },
        {
          id: "finish",
          title: { en: "Finish", ar: "النهاية" },
          fields: [
            {
              id: "confirmation",
              type: "short_text",
              label: { en: "Confirmation", ar: "التأكيد" },
              required: true,
            },
          ],
        },
      ],
      logic: [
        {
          id: "skip_details",
          order: 1,
          when: {
            mode: "all",
            conditions: [{ fieldId: "route", operator: "equals", value: true }],
          },
          action: { type: "skip_to_page", targetPageId: "finish" },
        },
      ],
    };

    expect(validateFormVersionContent(content).ok).toBe(true);
    expect(
      Array.from(evaluateFormLogic(content, { route: true }).reachablePageIds)
    ).toEqual(["start", "finish"]);

    const result = normalizeAndValidateFormAnswers(content, {
      route: true,
      skipped_secret: "must not survive",
      confirmation: "Confirmed",
    });

    expect(result.ok).toBe(true);
    expect(result.answers).toEqual({ route: true, confirmation: "Confirmed" });
    expect(result.errors).not.toHaveProperty("skipped_secret");

    const resultWithoutSkippedAnswer = normalizeAndValidateFormAnswers(
      content,
      {
        route: true,
        confirmation: "Confirmed",
      }
    );
    expect(resultWithoutSkippedAnswer.ok).toBe(true);
    expect(resultWithoutSkippedAnswer.errors).not.toHaveProperty(
      "skipped_secret"
    );
  });

  it("rejects impossible calendar dates and accepts leap days", () => {
    const invalid = normalizeAndValidateFormAnswers(
      nileFormsTemplateContent.placement,
      {
        full_name: "Nile Learner",
        email: "learner@example.test",
        phone: "+20 100 000 0000",
        course_interest: "arabic",
        preferred_date: "2025-02-29",
        preferred_time: "09:30",
        current_level: "beginner",
        online: true,
      }
    );
    const valid = normalizeAndValidateFormAnswers(
      nileFormsTemplateContent.placement,
      {
        full_name: "Nile Learner",
        email: "learner@example.test",
        phone: "+20 100 000 0000",
        course_interest: "arabic",
        preferred_date: "2024-02-29",
        preferred_time: "09:30",
        current_level: "beginner",
        online: true,
      }
    );

    expect(invalid.errors.preferred_date).toBeDefined();
    expect(valid.errors.preferred_date).toBeUndefined();
  });

  it("enforces required, bounded, typed and choice validation", () => {
    const result = normalizeAndValidateFormAnswers(
      nileFormsTemplateContent.enquiry,
      {
        full_name: "A",
        email: "not-an-email",
        phone: "x",
        course_interest: "made-up-course",
        preferred_contact: "email",
      }
    );

    expect(result.ok).toBe(false);
    expect(result.errors.full_name).toBeDefined();
    expect(result.errors.email).toBeDefined();
    expect(result.errors.phone).toBeDefined();
    expect(result.errors.course_interest).toBeDefined();
  });

  it("blocks restricted data classes from offline eligibility", () => {
    const eligible = getOfflineEligibility(nileFormsTemplateContent.incident);
    expect(eligible).toEqual({ eligible: true, restrictedFields: [] });

    const restricted = structuredClone(nileFormsTemplateContent.incident);
    restricted.pages[0].fields[0].dataClass = "health";
    expect(getOfflineEligibility(restricted)).toEqual({
      eligible: false,
      restrictedFields: ["location"],
    });
  });

  it("requires complete English, Arabic, and Turkish content for contract v2", () => {
    const incomplete = calculationContent();
    delete incomplete.pages[0].fields[0].label.tr;

    const result = validateFormVersionContent(incomplete);

    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual({
      path: "pages.0.fields.0.label.tr",
      message: "Turkish content is required for contract version 2",
    });
  });

  it("keeps field IDs stable while returning Turkish validation messages", () => {
    const content = calculationContent();
    const result = normalizeAndValidateFormAnswers(
      content,
      { tuition: "not-a-number", materials: 20 },
      "tr"
    );

    expect(result.ok).toBe(false);
    expect(Object.keys(result.errors)).toContain("tuition");
    expect(result.errors.tuition).toContain("Öğrenim ücreti sayı olmalıdır");
    expect(result.errorDetails.tuition).toContainEqual({
      key: "number",
      params: { label: "Öğrenim ücreti" },
    });
  });

  it("calculates deterministic derived values and ignores submitted overrides", () => {
    const content = calculationContent();
    expect(validateFormVersionContent(content).issues).toEqual([]);

    const evaluated = evaluateFormCalculations(content, {
      tuition: 100,
      materials: 25,
      subtotal: 9999,
      total: 9999,
    });
    const result = normalizeAndValidateFormAnswers(content, {
      tuition: 100,
      materials: 25,
      subtotal: 9999,
      total: 9999,
    });

    expect(evaluated.answers).toMatchObject({ subtotal: 125, total: 137.5 });
    expect(result.ok).toBe(true);
    expect(result.answers).toEqual({
      tuition: 100,
      materials: 25,
      subtotal: 125,
      total: 137.5,
    });
  });

  it("rejects unknown and cyclic calculation dependencies", () => {
    const unknown = calculationContent();
    unknown.calculations![1].operands[0] = {
      type: "calculation",
      calculationId: "missing_calculation",
    };
    expect(validateFormVersionContent(unknown).issues).toContainEqual({
      path: "calculations.1.operands",
      message: "Unknown calculation: missing_calculation",
    });

    const cyclic = calculationContent();
    cyclic.calculations![0].operands[0] = {
      type: "calculation",
      calculationId: "total_calculation",
    };
    expect(validateFormVersionContent(cyclic).issues).toContainEqual({
      path: "calculations",
      message: "Calculations cannot contain cycles",
    });
  });

  it("reports division-by-zero as a localized derived-field error", () => {
    const content = calculationContent();
    content.calculations = [
      {
        id: "total_calculation",
        targetFieldId: "total",
        operator: "divide",
        operands: [
          { type: "field", fieldId: "tuition" },
          { type: "field", fieldId: "materials" },
        ],
      },
    ];

    const result = normalizeAndValidateFormAnswers(
      content,
      { tuition: 100, materials: 0, subtotal: 0 },
      "tr"
    );

    expect(result.ok).toBe(false);
    expect(result.errors.total).toEqual(["Toplam hesaplanamadı"]);
  });
});
