import { describe, expect, it } from "vitest";
import {
  ageOn,
  composeDob,
  dobError,
  formatDob,
  isValidDob,
  splitDob,
} from "./date-of-birth";
import { validateIdentity, type IdentityInput } from "./admissions";

const today = new Date(2026, 9, 9); // 9 Oct 2026, local time

describe("composeDob / splitDob", () => {
  it("pads a complete real date to ISO", () => {
    expect(composeDob({ day: "4", month: "3", year: "2012" })).toBe("2012-03-04");
  });

  it("keeps partial input as raw parts and round-trips it", () => {
    const value = composeDob({ day: "4", month: "", year: "20" });
    expect(value).toBe("20--4");
    expect(splitDob(value)).toEqual({ day: "4", month: "", year: "20" });
    expect(splitDob("2012-03-04")).toEqual({ day: "4", month: "3", year: "2012" });
  });

  it("returns empty for an empty field", () => {
    expect(composeDob({ day: "", month: "", year: "" })).toBe("");
    expect(splitDob("")).toEqual({ day: "", month: "", year: "" });
  });

  it("never turns an impossible date into ISO", () => {
    expect(composeDob({ day: "31", month: "4", year: "2012" })).toBe("2012-4-31");
    expect(composeDob({ day: "29", month: "2", year: "2023" })).toBe("2023-2-29");
    expect(composeDob({ day: "29", month: "2", year: "2024" })).toBe("2024-02-29");
  });
});

describe("dobError", () => {
  it("accepts empty and valid past dates", () => {
    expect(dobError("", today)).toBeNull();
    expect(dobError("2012-03-04", today)).toBeNull();
    expect(dobError("2026-10-09", today)).toBeNull();
  });

  it("rejects the year 0001 the native picker allowed", () => {
    expect(dobError("0001-03-01", today)).toBe("tooEarly");
    expect(dobError("1899-12-31", today)).toBe("tooEarly");
  });

  it("rejects future dates", () => {
    expect(dobError("2026-10-10", today)).toBe("futureDate");
    expect(dobError("2099-01-01", today)).toBe("futureDate");
  });

  it("separates incomplete from impossible input", () => {
    expect(dobError("20--4", today)).toBe("incompleteDate");
    expect(dobError("2012-3-", today)).toBe("incompleteDate");
    expect(dobError("2012-4-31", today)).toBe("invalidDate");
    expect(dobError("2012-02-30", today)).toBe("invalidDate");
  });

  it("isValidDob needs a value", () => {
    expect(isValidDob("", today)).toBe(false);
    expect(isValidDob("2012-03-04", today)).toBe(true);
  });
});

describe("ageOn", () => {
  it("counts whole years and ignores invalid input", () => {
    expect(ageOn("2008-10-09", today)).toBe(18);
    expect(ageOn("2008-10-10", today)).toBe(17);
    expect(ageOn("2012-4-31", today)).toBeNull();
  });
});

describe("formatDob", () => {
  it("formats date-only values without a time-zone shift", () => {
    expect(formatDob("2012-03-04")).toBe("4\u00a0Mar\u00a02012");
    expect(formatDob(null)).toBeNull();
  });
});

describe("validateIdentity date of birth", () => {
  const base: IdentityInput = {
    nationality: "SAU",
    address: "12 Nile St",
    gender: "female",
    dateOfBirth: "2000-01-01",
    nationalId: "",
    passportNumber: "",
    guardians: [],
  };

  it("maps each date problem to its own code", () => {
    expect(validateIdentity({ ...base, dateOfBirth: "" }, today).dateOfBirth).toBe("required");
    expect(validateIdentity({ ...base, dateOfBirth: "0001-03-01" }, today).dateOfBirth).toBe("tooEarly");
    expect(validateIdentity({ ...base, dateOfBirth: "2030-01-01" }, today).dateOfBirth).toBe("futureDate");
    expect(validateIdentity({ ...base, dateOfBirth: "2012-4-31" }, today).dateOfBirth).toBe("invalidDate");
    expect(validateIdentity({ ...base, dateOfBirth: "2012--" }, today).dateOfBirth).toBe("incompleteDate");
    expect(validateIdentity(base, today).dateOfBirth).toBeUndefined();
  });

  it("does not skip the guardian rule because of a year-0001 date", () => {
    const errors = validateIdentity({ ...base, dateOfBirth: "0001-03-01" }, today);
    expect(errors.dateOfBirth).toBe("tooEarly");
  });
});
