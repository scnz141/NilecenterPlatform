import { describe, expect, it } from "vitest";
import type { FormField, FormVersionContent } from "@shared/nileForms";
import {
  answerText,
  canManageForms,
  contactFromAnswers,
  contentProblems,
  fieldsInUse,
  moveItem,
  newField,
  toKey,
  toSlug,
} from "./model";

const words = { yes: "Yes", no: "No", agreed: "Agreed" };
const content = (fields: FormField[], extra: Partial<FormVersionContent> = {}): FormVersionContent => ({
  title: { en: "T", ar: "ع" },
  description: { en: "", ar: "" },
  defaultLanguage: "en",
  languages: ["en", "ar"],
  submitLabel: { en: "Send", ar: "إرسال" },
  confirmationMessage: { en: "", ar: "" },
  pages: [{ id: "p1", title: { en: "", ar: "" }, fields }],
  logic: [],
  ...extra,
});

describe("forms model", () => {
  it("lets only form owners manage", () => {
    expect(canManageForms("registrar")).toBe(true);
    expect(canManageForms("superadmin")).toBe(true);
    expect(canManageForms("teacher")).toBe(false);
  });

  it("derives keys and link names from titles", () => {
    expect(toKey("Free Trial Enquiry!")).toBe("free_trial_enquiry");
    expect(toSlug("Free Trial Enquiry!")).toBe("free-trial-enquiry");
    expect(toKey("استمارة")).toBe("form");
  });

  it("creates choice questions with two choices and moves items", () => {
    const field = newField("single_choice", { en: "Pick", ar: "اختر" });
    expect(field.options).toHaveLength(2);
    expect(newField("consent", { en: "OK", ar: "موافق" }).required).toBe(true);
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveItem(["a", "b"], 0, -1)).toEqual(["a", "b"]);
  });

  it("finds problems before save", () => {
    expect(contentProblems(content([]))).toContain("problemEmpty");
    const choice = { ...newField("single_choice", { en: "Pick", ar: "" }), options: [] };
    const blank = newField("short_text", { en: " ", ar: "" });
    expect(contentProblems(content([choice, blank])).sort()).toEqual(["problemArabic", "problemLabel", "problemOptions"]);
  });

  it("knows which questions rules depend on", () => {
    const used = fieldsInUse(
      content([], {
        logic: [
          {
            id: "r1",
            order: 1,
            when: { mode: "all", conditions: [{ fieldId: "a", operator: "equals", value: "x" }] },
            action: { type: "show", targetFieldId: "b" },
          },
        ],
      })
    );
    expect([...used].sort()).toEqual(["a", "b"]);
  });

  it("renders answers in words", () => {
    const choice: FormField = {
      id: "c",
      type: "multiple_choice",
      label: { en: "C", ar: "" },
      options: [
        { id: "o1", label: { en: "Mornings", ar: "صباحًا" } },
        { id: "o2", label: { en: "Evenings", ar: "مساءً" } },
      ],
    };
    expect(answerText(choice, ["o2", "o1"], "en", words)).toBe("Evenings, Mornings");
    expect(answerText(choice, ["o1"], "ar", words)).toBe("صباحًا");
    expect(answerText({ id: "y", type: "yes_no", label: { en: "", ar: "" } }, true, "en", words)).toBe("Yes");
  });

  it("finds contact details for a lead", () => {
    const fields: FormField[] = [
      { id: "n", type: "short_text", label: { en: "Full name", ar: "" } },
      { id: "e", type: "email", label: { en: "Email", ar: "" } },
      { id: "p", type: "phone", label: { en: "Phone", ar: "" } },
    ];
    expect(contactFromAnswers(fields, { n: "Mariam Abdel Rahman", e: "m@x.test", p: "+20100" })).toEqual({
      firstName: "Mariam",
      lastName: "Abdel Rahman",
      email: "m@x.test",
      phone: "+20100",
    });
  });
});

describe("Turkish fallback", () => {
  it("fills empty Turkish from English only when the form offers Turkish", async () => {
    const { withTurkishFallback } = await import("./model");
    const field: FormField = {
      id: "q",
      type: "single_choice",
      label: { en: "Time", ar: "الوقت" },
      options: [{ id: "o", label: { en: "Mornings", ar: "صباحًا", tr: "Sabah" } }],
    };
    const filled = withTurkishFallback(content([field], { languages: ["en", "ar", "tr"] }));
    expect(filled.pages[0].fields[0].label.tr).toBe("Time");
    expect(filled.pages[0].fields[0].options?.[0].label.tr).toBe("Sabah");
    expect(withTurkishFallback(content([field])).pages[0].fields[0].label.tr).toBeUndefined();
  });
});

describe("branch choices", () => {
  it("turns EMS branches into valid choice ids and reads the pick back", async () => {
    const { branchChoices, branchFromAnswers } = await import("./model");
    const choices = branchChoices([{ id: "ccab89aa-58a9-4db9-a413-61017ad9709b", name: "Nasr City" }]);
    expect(choices[0].id).toMatch(/^[a-z][a-z0-9_:-]*$/i);
    const field: FormField = { id: "branch", type: "single_choice", label: { en: "Branch", ar: "الفرع" }, options: choices };
    expect(branchFromAnswers([field], { branch: choices[0].id })).toBe("ccab89aa-58a9-4db9-a413-61017ad9709b");
    expect(branchFromAnswers([field], {})).toBeNull();
  });
});
