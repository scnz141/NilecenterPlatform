import crypto from "node:crypto";
import { sealInvitationActivationPayload } from "./invitationEnvelope.js";
import {
  SupabaseAuthInvitationService,
  SupabaseInvitationProviderUnavailableError,
} from "./supabaseAuthInvitations.js";
import {
  SupabaseUserInvitationRepository,
  type CreateStudentEnrollmentInvitationRecord,
  type CreateUserInvitationRecord,
  type CreatedStudentEnrollmentInvitation,
  type CreatedUserInvitation,
  type StudentInvitationSource,
  type UserInvitationRole,
} from "./userInvitationRepository.js";
import type { GeneratedSupabaseInvitation } from "./supabaseAuthInvitations.js";

const roles = new Set<UserInvitationRole>([
  "student",
  "teacher",
  "registrar",
  "headofdepartment",
  "branchadmin",
  "superadmin",
]);
const locales = new Set(["en", "ar", "zh", "ru", "ur", "tr"]);
const preferredLanguages = new Set([
  "English",
  "Arabic",
  "Chinese",
  "Russian",
  "Urdu",
  "Turkish",
]);
const studentSources = new Set<StudentInvitationSource>([
  "direct",
  "lead",
  "application",
  "placement",
]);
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class UserInvitationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserInvitationValidationError";
  }
}

function clean(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function list(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => clean(item, 120))
    .filter(Boolean)
    .slice(0, 24);
}

function publicAppUrl(env: NodeJS.ProcessEnv) {
  const explicit = clean(env.NILE_PUBLIC_APP_URL, 2_048).replace(/\/+$/, "");
  const vercel = clean(env.VERCEL_PROJECT_PRODUCTION_URL, 2_048);
  const candidate = explicit || (vercel ? `https://${vercel}` : "");
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "https:") throw new Error();
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    throw new UserInvitationValidationError(
      "NILE_PUBLIC_APP_URL must be configured with the HTTPS Nile Learn URL."
    );
  }
}

export type CreateUserInvitationInput = Readonly<{
  sessionToken: string;
  fullName: unknown;
  email: unknown;
  phone?: unknown;
  role: unknown;
  branchRef?: unknown;
  departmentRef?: unknown;
  title?: unknown;
  availabilityStatus?: unknown;
  subjects?: unknown;
  teachingLevels?: unknown;
  locale?: unknown;
  idempotencyKey?: unknown;
}>;

export type CreateStudentEnrollmentInvitationInput = Readonly<{
  sessionToken: string;
  fullName: unknown;
  email: unknown;
  phone: unknown;
  branchRef: unknown;
  preferredLanguage: unknown;
  courseInterest: unknown;
  ageGroup: unknown;
  guardianName?: unknown;
  guardianPhone?: unknown;
  currentLevel: unknown;
  notes?: unknown;
  courseRunId: unknown;
  classGroupId: unknown;
  source?: unknown;
  leadId?: unknown;
  applicationId?: unknown;
  placementBookingId?: unknown;
  locale?: unknown;
  idempotencyKey?: unknown;
}>;

export interface UserInvitationRepositoryPort {
  create(input: CreateUserInvitationRecord): Promise<CreatedUserInvitation>;
  createStudentEnrollment(
    input: CreateStudentEnrollmentInvitationRecord
  ): Promise<CreatedStudentEnrollmentInvitation>;
  accept(
    invitationId: string,
    authUserId: string
  ): Promise<{
    userId: string;
    role: UserInvitationRole;
    acceptedAt: string;
  }>;
}

export interface UserInvitationAuthPort {
  generate(
    email: string,
    redirectTo: string
  ): Promise<GeneratedSupabaseInvitation>;
  removeGeneratedUser(authUserId: string): Promise<void>;
  verifyEmailOtp(email: string, otp: string): Promise<string>;
  getVerifiedUser(accessToken: string): Promise<{ id: string; email: string }>;
  setPassword(accessToken: string, password: string): Promise<void>;
}

export class UserInvitationService {
  constructor(
    private readonly repository: UserInvitationRepositoryPort = new SupabaseUserInvitationRepository(),
    private readonly auth: UserInvitationAuthPort = new SupabaseAuthInvitationService(),
    private readonly env: NodeJS.ProcessEnv = process.env
  ) {}

  async create(input: CreateUserInvitationInput) {
    const fullName = clean(input.fullName, 160);
    const email = clean(input.email, 320).toLowerCase();
    const role = clean(input.role) as UserInvitationRole;
    const branchRef = clean(input.branchRef, 160) || undefined;
    const departmentRef = clean(input.departmentRef, 160) || undefined;
    const subjects = list(input.subjects);
    const teachingLevels = list(input.teachingLevels);
    const availabilityStatus = clean(input.availabilityStatus, 40) || undefined;
    const localeValue = clean(input.locale, 8) || "en";
    const idempotencyKey =
      clean(input.idempotencyKey, 256) || `user-invite:${crypto.randomUUID()}`;
    if (fullName.length < 2) {
      throw new UserInvitationValidationError("Full name is required.");
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      throw new UserInvitationValidationError("A valid email is required.");
    }
    if (!roles.has(role)) {
      throw new UserInvitationValidationError("A supported role is required.");
    }
    if (!locales.has(localeValue)) {
      throw new UserInvitationValidationError(
        "A supported language is required."
      );
    }
    if (role === "superadmin" && (branchRef || departmentRef)) {
      throw new UserInvitationValidationError(
        "Super Admin invitations use global scope only."
      );
    }
    if (["student", "registrar", "branchadmin"].includes(role)) {
      if (!branchRef || departmentRef) {
        throw new UserInvitationValidationError(
          "This role requires branch scope only."
        );
      }
    }
    if (role === "headofdepartment" && !departmentRef) {
      throw new UserInvitationValidationError("HOD requires department scope.");
    }
    if (
      role === "teacher" &&
      (!branchRef ||
        !departmentRef ||
        subjects.length === 0 ||
        teachingLevels.length === 0 ||
        !["available", "limited", "unavailable"].includes(
          availabilityStatus ?? ""
        ))
    ) {
      throw new UserInvitationValidationError(
        "Teacher requires branch, department, subjects, levels, and availability."
      );
    }

    const invitationId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1_000).toISOString();
    const redirectTo = `${publicAppUrl(this.env)}/auth/accept-invitation?invitation=${encodeURIComponent(invitationId)}`;
    const generated = await this.auth.generate(email, redirectTo);
    try {
      const activationEnvelope = sealInvitationActivationPayload(
        { actionUrl: generated.actionUrl, emailOtp: generated.emailOtp },
        this.env
      );
      return await this.repository.create({
        sessionToken: input.sessionToken,
        invitationId,
        authUserId: generated.authUserId,
        fullName,
        email,
        phone: clean(input.phone, 80) || undefined,
        role,
        branchRef,
        departmentRef,
        title: clean(input.title, 120) || undefined,
        availabilityStatus,
        subjects,
        teachingLevels,
        locale: localeValue,
        activationEnvelope,
        expiresAt,
        idempotencyKey,
      });
    } catch (error) {
      try {
        await this.auth.removeGeneratedUser(generated.authUserId);
      } catch (cleanupError) {
        if (
          cleanupError instanceof SupabaseInvitationProviderUnavailableError
        ) {
          // The primary failure is returned; provider reconciliation is required.
        }
      }
      throw error;
    }
  }

  async createStudentEnrollment(input: CreateStudentEnrollmentInvitationInput) {
    const fullName = clean(input.fullName, 160);
    const email = clean(input.email, 320).toLowerCase();
    const phone = clean(input.phone, 40);
    const branchRef = clean(input.branchRef, 160);
    const preferredLanguage = clean(input.preferredLanguage, 40);
    const courseInterest = clean(input.courseInterest, 160);
    const ageGroup = clean(input.ageGroup, 80);
    const guardianName = clean(input.guardianName, 160) || undefined;
    const guardianPhone = clean(input.guardianPhone, 80) || undefined;
    const currentLevel = clean(input.currentLevel, 160);
    const notes = clean(input.notes, 3_000) || undefined;
    const courseRunId = clean(input.courseRunId, 64);
    const classGroupId = clean(input.classGroupId, 64);
    const source = (clean(input.source, 32) ||
      "direct") as StudentInvitationSource;
    const leadId = clean(input.leadId, 64) || undefined;
    const applicationId = clean(input.applicationId, 64) || undefined;
    const placementBookingId = clean(input.placementBookingId, 64) || undefined;
    const localeValue = clean(input.locale, 8) || "en";
    const idempotencyKey =
      clean(input.idempotencyKey, 256) ||
      `student-invite:${crypto.randomUUID()}`;

    if (fullName.length < 2) {
      throw new UserInvitationValidationError("Full name is required.");
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      throw new UserInvitationValidationError("A valid email is required.");
    }
    if (phone.length < 7) {
      throw new UserInvitationValidationError(
        "A valid phone or WhatsApp number is required."
      );
    }
    if (!branchRef) {
      throw new UserInvitationValidationError("A branch is required.");
    }
    if (!preferredLanguages.has(preferredLanguage)) {
      throw new UserInvitationValidationError(
        "A supported preferred language is required."
      );
    }
    if (courseInterest.length < 2 || !currentLevel || ageGroup.length < 2) {
      throw new UserInvitationValidationError(
        "Course interest, age group, and current level are required."
      );
    }
    if (!uuidPattern.test(courseRunId) || !uuidPattern.test(classGroupId)) {
      throw new UserInvitationValidationError(
        "A normalized course run and class group are required."
      );
    }
    if (!locales.has(localeValue) || !studentSources.has(source)) {
      throw new UserInvitationValidationError(
        "The invitation language or intake source is invalid."
      );
    }
    if (
      /minor|child|teen/i.test(ageGroup) &&
      (!guardianName || !guardianPhone || guardianPhone.length < 7)
    ) {
      throw new UserInvitationValidationError(
        "Guardian name and phone are required for a minor student."
      );
    }
    const lineage = [leadId, applicationId, placementBookingId].filter(Boolean);
    if (
      (source === "direct" && lineage.length > 0) ||
      (source === "lead" && (!leadId || lineage.length !== 1)) ||
      (source === "application" && (!applicationId || lineage.length !== 1)) ||
      (source === "placement" && (!placementBookingId || lineage.length !== 1))
    ) {
      throw new UserInvitationValidationError(
        "The selected intake source requires matching lineage."
      );
    }

    const invitationId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1_000).toISOString();
    const redirectTo = `${publicAppUrl(this.env)}/auth/accept-invitation?invitation=${encodeURIComponent(invitationId)}`;
    const generated = await this.auth.generate(email, redirectTo);
    try {
      const activationEnvelope = sealInvitationActivationPayload(
        { actionUrl: generated.actionUrl, emailOtp: generated.emailOtp },
        this.env
      );
      return await this.repository.createStudentEnrollment({
        sessionToken: input.sessionToken,
        invitationId,
        authUserId: generated.authUserId,
        fullName,
        email,
        phone,
        branchRef,
        preferredLanguage,
        courseInterest,
        ageGroup,
        guardianName,
        guardianPhone,
        currentLevel,
        notes,
        courseRunId,
        classGroupId,
        source,
        leadId,
        applicationId,
        placementBookingId,
        locale: localeValue,
        activationEnvelope,
        expiresAt,
        idempotencyKey,
      });
    } catch (error) {
      try {
        await this.auth.removeGeneratedUser(generated.authUserId);
      } catch (cleanupError) {
        if (
          cleanupError instanceof SupabaseInvitationProviderUnavailableError
        ) {
          // The durable provider record must be reconciled after the primary failure.
        }
      }
      throw error;
    }
  }

  async accept(input: {
    invitationId: unknown;
    email?: unknown;
    otp?: unknown;
    accessToken?: unknown;
    password: unknown;
  }) {
    const invitationId = clean(input.invitationId, 64);
    const email = clean(input.email, 320).toLowerCase();
    const otp = clean(input.otp, 128);
    const password = typeof input.password === "string" ? input.password : "";
    let accessToken = clean(input.accessToken, 4_096);
    if (!/^[0-9a-f-]{36}$/i.test(invitationId)) {
      throw new UserInvitationValidationError(
        "Invitation reference is invalid."
      );
    }
    if (password.length < 12) {
      throw new UserInvitationValidationError("Use at least 12 characters.");
    }
    if (!accessToken) {
      if (!email || !otp) {
        throw new UserInvitationValidationError(
          "Open the invitation link or enter the email verification code."
        );
      }
      accessToken = await this.auth.verifyEmailOtp(email, otp);
    }
    const user = await this.auth.getVerifiedUser(accessToken);
    if (email && user.email !== email) {
      throw new UserInvitationValidationError(
        "The verified email does not match this invitation."
      );
    }
    await this.auth.setPassword(accessToken, password);
    const accepted = await this.repository.accept(invitationId, user.id);
    return { ...accepted, email: user.email };
  }
}
