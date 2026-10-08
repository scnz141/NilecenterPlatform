import type {
  NccLeadDto,
  NccPlacementTestDto,
  NccRegistrationDto,
  NccTrialLessonDto,
} from "@/lib/backend/api";
import { intlLocale } from "./i18n";

/* ---------------- Lead journey -------------------------------------- */

export const JOURNEY_STEPS = [
  "contact",
  "placement",
  "trial",
  "fee",
  "student",
] as const;
export type JourneyStep = (typeof JOURNEY_STEPS)[number];
export type JourneyState = "done" | "now" | "skipped" | "later";

export type NextLeadAction =
  | "book_placement"
  | "record_placement"
  | "book_trial"
  | "record_trial"
  | "fee"
  | "convert"
  | "open_student"
  | "lost";

type Booking = Pick<NccPlacementTestDto | NccTrialLessonDto, "status">;

/**
 * Derives where a lead is in the admissions journey from EMS records, and
 * the one action that moves it forward. EMS status alone is not enough: a
 * lead can skip placement (direct entry) or trial, and bookings can be
 * cancelled or missed.
 */
export function leadJourney(
  lead: Pick<NccLeadDto, "status" | "entryPath" | "studentId"> & {
    registration?: NccRegistrationDto | null;
  },
  placements: Booking[],
  trials: Booking[]
): { steps: Record<JourneyStep, JourneyState>; next: NextLeadAction } {
  const placementDone = placements.some(item => item.status === "completed");
  const placementOpen = placements.some(item => item.status === "scheduled");
  const trialDone = trials.some(item => item.status === "completed");
  const trialOpen = trials.some(item => item.status === "scheduled");
  const feeRecorded = Boolean(lead.registration);
  const isStudent = Boolean(lead.studentId);

  let next: NextLeadAction;
  if (isStudent) next = "open_student";
  else if (lead.status === "lost") next = "lost";
  else if (placementOpen) next = "record_placement";
  else if (trialOpen) next = "record_trial";
  else if (feeRecorded) next = "convert";
  else if (placementDone || trialDone || lead.entryPath === "direct")
    next = "fee";
  else if (lead.entryPath === "trial") next = "book_trial";
  else next = "book_placement";

  const movedPast = (step: "placement" | "trial") =>
    isStudent ||
    feeRecorded ||
    (step === "placement" && (trialDone || trialOpen));

  const bookingState = (
    step: "placement" | "trial",
    done: boolean,
    open: boolean
  ): JourneyState => {
    if (done) return "done";
    if (open) return "now";
    if (movedPast(step)) return "skipped";
    if (
      (step === "placement" && next === "book_placement") ||
      (step === "trial" && next === "book_trial")
    ) {
      return "now";
    }
    if (step === "placement" && (next === "fee" || next === "book_trial")) {
      return "skipped";
    }
    return "later";
  };

  return {
    next,
    steps: {
      contact: "done",
      placement: bookingState("placement", placementDone, placementOpen),
      trial: bookingState("trial", trialDone, trialOpen),
      fee: feeRecorded
        ? "done"
        : next === "fee"
          ? "now"
          : isStudent
            ? "skipped"
            : "later",
      student: isStudent ? "done" : next === "convert" ? "now" : "later",
    },
  };
}

/* ---------------- Money --------------------------------------------- */

/** Parses a typed amount. Empty input is `null`; invalid input is `NaN`. */
export function parseAmount(value: string): number | null {
  const trimmed = value.trim().replace(/,/g, "");
  if (!trimmed) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return Number.NaN;
  return Number(trimmed);
}

export function formatAmount(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return new Intl.NumberFormat(intlLocale(), {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

export function paidShare(registration: {
  toBePaid: number;
  paid: number | null;
}): number {
  if (registration.toBePaid <= 0) return 1;
  return Math.min(
    1,
    Math.max(0, (registration.paid ?? 0) / registration.toBePaid)
  );
}

/* ---------------- Time --------------------------------------------- */

/** Date and time in a branch time zone, without line breaks. */
export function formatInZone(
  iso: string | null | undefined,
  timeZone?: string
) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return date
      .toLocaleString(intlLocale(), {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
        ...(timeZone ? { timeZone } : {}),
      })
      .replace(/ /g, "\u00a0");
  } catch {
    return date.toISOString();
  }
}

/* ---------------- Identity ------------------------------------------ */

export type GuardianInput = {
  name: string;
  phone: string;
  email: string;
  relationship: string;
};

export type IdentityInput = {
  nationality: string;
  address: string;
  gender: "" | "male" | "female";
  dateOfBirth: string;
  nationalId: string;
  passportNumber: string;
  guardians: GuardianInput[];
};

export type IdentityErrorKey =
  | "required"
  | "invalidNationality"
  | "invalidNationalId"
  | "nationalIdRequired"
  | "guardianRequired"
  | "guardianIncomplete";

export function ageOn(dateOfBirth: string, today = new Date()): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOfBirth);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  let age = today.getFullYear() - year;
  const beforeBirthday =
    today.getMonth() + 1 < month ||
    (today.getMonth() + 1 === month && today.getDate() < day);
  if (beforeBirthday) age -= 1;
  return age;
}

/**
 * Mirrors the EMS student rules learned from live staging: three-letter
 * nationality, a 14-digit national ID for Egyptian nationals, and a first
 * guardian for anyone under 18.
 */
export function validateIdentity(
  input: IdentityInput,
  today = new Date()
): Partial<Record<keyof IdentityInput, IdentityErrorKey>> {
  const errors: Partial<Record<keyof IdentityInput, IdentityErrorKey>> = {};
  const nationality = input.nationality.trim().toUpperCase();
  if (!nationality) errors.nationality = "required";
  else if (!/^[A-Z]{3}$/.test(nationality))
    errors.nationality = "invalidNationality";
  if (!input.address.trim()) errors.address = "required";
  if (!input.gender) errors.gender = "required";
  if (!input.dateOfBirth) errors.dateOfBirth = "required";
  const nationalId = input.nationalId.trim();
  if (nationalId && !/^\d{14}$/.test(nationalId))
    errors.nationalId = "invalidNationalId";
  else if (!nationalId && nationality === "EGY")
    errors.nationalId = "nationalIdRequired";
  const filled = input.guardians.filter(guardian =>
    Object.values(guardian).some(value => value.trim())
  );
  if (
    filled.some(guardian =>
      Object.values(guardian).some(value => !value.trim())
    )
  ) {
    errors.guardians = "guardianIncomplete";
  } else {
    const age = ageOn(input.dateOfBirth, today);
    if (age !== null && age < 18 && filled.length === 0)
      errors.guardians = "guardianRequired";
  }
  return errors;
}

export function identityPayload(input: IdentityInput) {
  const guardians = input.guardians
    .filter(guardian => Object.values(guardian).some(value => value.trim()))
    .map((guardian, index) => ({
      sortOrder: (index + 1) as 1 | 2,
      name: guardian.name.trim(),
      phone: guardian.phone.trim(),
      email: guardian.email.trim(),
      relationship: guardian.relationship.trim(),
    }));
  return {
    nationality: input.nationality.trim().toUpperCase(),
    address: input.address.trim(),
    gender: input.gender as "male" | "female",
    dateOfBirth: input.dateOfBirth,
    nationalId: input.nationalId.trim() || null,
    passportNumber: input.passportNumber.trim() || null,
    guardians,
  };
}

export const EMPTY_GUARDIAN: GuardianInput = {
  name: "",
  phone: "",
  email: "",
  relationship: "",
};
