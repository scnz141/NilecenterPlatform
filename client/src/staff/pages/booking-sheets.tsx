import { useEffect, useMemo, useState } from "react";
import {
  bookNccPlacementTestRequest,
  convertNccLeadRequest,
  patchNccEnrolmentRequest,
  createNccTrialLessonRequest,
  patchNccStudentRegistrationRequest,
  patchNccTrialLessonRequest,
  putNccLeadRegistrationRequest,
  recordNccPlacementResultRequest,
  recordNccTrialLessonResultRequest,
  rescheduleNccPlacementTestRequest,
  type NccBranchDto,
  type NccPlacementTestDto,
  type NccRegistrationDto,
  type NccStudentDto,
  type NccTrialLessonDto,
} from "@/lib/backend/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/staff/ui/kit";
import {
  EMPTY_GUARDIAN,
  identityPayload,
  parseAmount,
  validateIdentity,
  type IdentityInput,
} from "../admissions";
import { zonedDateHour, zonedInstant } from "../hour-cells";
import { intlLocale } from "../i18n";
import { staffWrite, useInvalidate } from "../api";
import { copy } from "../copy";
import { FormValidationError, runAction } from "../run-action";
import type { DobError } from "../date-of-birth";
import { DateOfBirthField } from "../ui/date-of-birth-field";
import { FormSheet, StaffField } from "../ui/form-sheet";
import type { StaffSecret } from "../ui/secret-dialog";
import {
  useActiveAreas,
  useActiveCourses,
  useBranchRooms,
  useMentorTeachers,
} from "./admissions-ui";

const B = copy.admissions.booking;
const L = copy.admissions.leads;
const I = copy.admissions.identity;
const $ = copy.admissions.money;
const NONE = "__none";

type Subject = {
  type: "lead" | "student";
  id: string;
  branch: NccBranchDto | undefined;
};
type Booking =
  | { kind: "placement"; item: NccPlacementTestDto }
  | { kind: "trial"; item: NccTrialLessonDto };

function isHttps(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

async function refreshAdmissions(
  invalidate: (prefix: string) => Promise<void>
) {
  await Promise.all([
    invalidate("/api/ncc/admissions/leads"),
    invalidate("/api/ncc/admissions/placement-tests"),
    invalidate("/api/ncc/admissions/trial-lessons"),
    invalidate("/api/ncc/admissions/students"),
  ]);
}

const HOURS = Array.from({ length: 24 }, (_, index) => index);

function hourLabel(hour: number) {
  return new Date(Date.UTC(2026, 0, 1, hour)).toLocaleTimeString(intlLocale(), {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

/* ---------------- Book or change a placement test / trial lesson ---- */

export function BookingSheet({
  open,
  onOpenChange,
  kind,
  subject,
  booking,
  defaultAreaId,
  defaultCourseId,
  onSecrets,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: "placement" | "trial";
  subject: Subject;
  booking?: Booking | null;
  defaultAreaId?: string | null;
  defaultCourseId?: string | null;
  onSecrets?: (secrets: StaffSecret[]) => void;
}) {
  const invalidate = useInvalidate();
  const online = subject.branch?.isOnline ?? false;
  const rooms = useBranchRooms(subject.branch?.id, open && !online);
  const areas = useActiveAreas(open);
  const courses = useActiveCourses(open && kind === "trial");
  const existing = booking?.item ?? null;
  const timeZone = subject.branch?.timezone ?? "UTC";

  const initial = useMemo(() => {
    const trial = booking?.kind === "trial" ? booking.item : null;
    const start =
      (existing?.scheduledAt &&
        zonedDateHour(existing.scheduledAt, timeZone)) ||
      zonedDateHour(new Date(Date.now() + 864e5).toISOString(), timeZone);
    return {
      date: start?.date ?? "",
      hour: existing?.scheduledAt && start ? String(start.hour) : "10",
      roomId: existing?.roomId ?? "",
      meetingUrl: existing?.meetingUrl ?? "",
      areaOfStudyId: existing?.areaOfStudyId ?? defaultAreaId ?? "",
      courseId:
        trial?.courseId ?? (kind === "trial" ? (defaultCourseId ?? "") : ""),
      topic: (trial?.areaOfStudyId && !trial.courseId
        ? "area"
        : kind === "trial" && !defaultCourseId && defaultAreaId
          ? "area"
          : "course") as "course" | "area",
    };
  }, [booking, existing, defaultAreaId, defaultCourseId, kind, timeZone]);
  const [draft, setDraft] = useState(initial);
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>();

  useEffect(() => {
    if (!open) return;
    setDraft(initial);
    setAttempted(false);
    setFieldErrors(undefined);
  }, [open, initial]);

  const set = <K extends keyof typeof draft>(
    key: K,
    value: (typeof draft)[K]
  ) => setDraft(current => ({ ...current, [key]: value }));

  const area = areas.find(item => item.id === draft.areaOfStudyId);
  const scheduledAtValue = zonedInstant(
    draft.date,
    Number(draft.hour),
    timeZone
  );
  const errors = {
    when: scheduledAtValue ? null : L.required,
    meetingUrl: !online
      ? null
      : !draft.meetingUrl.trim()
        ? B.meetingRequired
        : isHttps(draft.meetingUrl.trim())
          ? null
          : B.meetingInvalid,
    roomId: online || draft.roomId ? null : B.chooseRoom,
    topic:
      kind !== "trial"
        ? null
        : draft.topic === "course"
          ? draft.courseId
            ? null
            : B.chooseCourse
          : draft.areaOfStudyId
            ? null
            : B.chooseArea,
  };
  const placementCourseMissing =
    kind === "placement" && area && area.placementCourses.length === 0;
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  async function submit() {
    setAttempted(true);
    if (Object.values(errors).some(Boolean)) throw new FormValidationError();
    const scheduledAt = scheduledAtValue as string;
    const place = online
      ? { meetingUrl: draft.meetingUrl.trim() || null }
      : { roomId: draft.roomId || null };
    setSaving(true);
    setFieldErrors(undefined);
    try {
      if (kind === "placement") {
        const fields = {
          scheduledAt,
          ...place,
          areaOfStudyId: draft.areaOfStudyId || null,
        };
        if (existing) {
          await staffWrite(
            rescheduleNccPlacementTestRequest(existing.id, fields)
          );
        } else {
          const result = await staffWrite(
            bookNccPlacementTestRequest({
              subject: { type: subject.type, id: subject.id },
              ...fields,
            })
          );
          if (result.oneTime?.generatedMoodlePassword) {
            onSecrets?.([
              {
                label: B.moodlePassword,
                value: result.oneTime.generatedMoodlePassword,
              },
            ]);
          }
        }
      } else {
        const topic =
          draft.topic === "course"
            ? { courseId: draft.courseId, areaOfStudyId: null }
            : { areaOfStudyId: draft.areaOfStudyId, courseId: null };
        if (existing) {
          await staffWrite(
            patchNccTrialLessonRequest(existing.id, {
              scheduledAt,
              ...place,
              ...topic,
            })
          );
        } else {
          await staffWrite(
            createNccTrialLessonRequest({
              subject: { type: subject.type, id: subject.id },
              scheduledAt,
              ...place,
              ...(draft.topic === "course"
                ? { courseId: draft.courseId }
                : { areaOfStudyId: draft.areaOfStudyId }),
            })
          );
        }
      }
      await refreshAdmissions(invalidate);
      onOpenChange(false);
    } catch (error) {
      const details = (error as { details?: Record<string, string[]> }).details;
      if (details) setFieldErrors(details);
      throw error;
    } finally {
      setSaving(false);
    }
  }

  const show = (message: string | null) => (attempted ? message : null);

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={
        existing
          ? B.editTitle
          : kind === "placement"
            ? B.placementTitle
            : B.trialTitle
      }
      description={`${subject.branch?.name ?? ""} · ${
        online
          ? copy.admissions.mode.onlineBranch
          : copy.admissions.mode.onsiteBranch
      }`}
      dirty={dirty}
      saving={saving}
      fieldErrors={fieldErrors}
      saveLabel={existing ? B.saveChanges : B.book}
      onSubmit={() =>
        runAction(submit, {
          success: existing ? B.updatedToast : B.bookedToast,
        })
      }
    >
      {errorFor => (
        <>
          <StaffField
            label={B.when}
            htmlFor="booking-date"
            error={show(errors.when) ?? errorFor("scheduled_at")}
          >
            <div className="staff-when">
              <input
                id="booking-date"
                type="date"
                className="staff-input"
                value={draft.date}
                onChange={event => set("date", event.target.value)}
              />
              <Select
                value={draft.hour}
                onValueChange={value => set("hour", value)}
              >
                <SelectTrigger aria-label={B.hour}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOURS.map(hour => (
                    <SelectItem key={hour} value={String(hour)}>
                      {hourLabel(hour)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <span className="staff-hint">
              {B.timeZone}: {timeZone}. {B.onTheHour}
            </span>
          </StaffField>

          {online ? (
            <StaffField
              label={B.meetingLink}
              htmlFor="booking-link"
              error={show(errors.meetingUrl) ?? errorFor("meeting_url")}
            >
              <input
                id="booking-link"
                type="url"
                inputMode="url"
                className="staff-input staff-ltr"
                placeholder="https://"
                value={draft.meetingUrl}
                onChange={event => set("meetingUrl", event.target.value)}
              />
              <span className="staff-hint">{B.meetingHint}</span>
            </StaffField>
          ) : (
            <StaffField
              label={B.room}
              error={show(errors.roomId) ?? errorFor("room_id")}
            >
              <Select
                value={draft.roomId || undefined}
                onValueChange={value => set("roomId", value)}
              >
                <SelectTrigger aria-label={B.room}>
                  <SelectValue
                    placeholder={rooms.length ? B.chooseRoom : B.noRoom}
                  />
                </SelectTrigger>
                <SelectContent>
                  {rooms.map(room => (
                    <SelectItem key={room.id} value={room.id}>
                      {room.name}
                      {room.capacity ? ` · ${room.capacity}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </StaffField>
          )}

          {kind === "trial" ? (
            <fieldset className="staff-field">
              <legend className="staff-field-label">{B.topic}</legend>
              <div className="staff-check-row">
                {(["course", "area"] as const).map(topic => (
                  <label key={topic} className="staff-check">
                    <input
                      type="radio"
                      name="trial-topic"
                      checked={draft.topic === topic}
                      onChange={() => set("topic", topic)}
                    />
                    {topic === "course" ? B.byCourse : B.byArea}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          {kind === "trial" && draft.topic === "course" ? (
            <StaffField
              label={B.course}
              error={show(errors.topic) ?? errorFor("course_id")}
            >
              <Select
                value={draft.courseId || undefined}
                onValueChange={value => set("courseId", value)}
              >
                <SelectTrigger aria-label={B.course}>
                  <SelectValue placeholder={B.chooseCourse} />
                </SelectTrigger>
                <SelectContent>
                  {courses.map(course => (
                    <SelectItem key={course.value} value={course.value}>
                      {course.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </StaffField>
          ) : (
            <StaffField
              label={L.areaOfStudy}
              error={
                (kind === "trial" ? show(errors.topic) : null) ??
                errorFor("area_of_study_id")
              }
            >
              <Select
                value={
                  draft.areaOfStudyId || (kind === "trial" ? undefined : NONE)
                }
                onValueChange={value =>
                  set("areaOfStudyId", value === NONE ? "" : value)
                }
              >
                <SelectTrigger aria-label={L.areaOfStudy}>
                  <SelectValue placeholder={B.chooseArea} />
                </SelectTrigger>
                <SelectContent>
                  {kind === "placement" ? (
                    <SelectItem value={NONE}>{L.noArea}</SelectItem>
                  ) : null}
                  {areas.map(item => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {placementCourseMissing ? (
                <span className="staff-hint" data-tone="caution">
                  {B.placementCourseMissing}
                </span>
              ) : null}
            </StaffField>
          )}
        </>
      )}
    </FormSheet>
  );
}

/* ---------------- Record a result ----------------------------------- */

export function ResultSheet({
  open,
  onOpenChange,
  booking,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: Booking | null;
}) {
  const invalidate = useInvalidate();
  const placement = booking?.kind === "placement";
  const mentors = useMentorTeachers(booking?.item.branchId, open && placement);
  const courses = useActiveCourses(open);
  const empty = { score: "", mentorId: "", recommendedCourseId: "", notes: "" };
  const [draft, setDraft] = useState(empty);
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>();

  useEffect(() => {
    if (!open) return;
    setDraft({
      ...empty,
      recommendedCourseId:
        booking?.kind === "trial" ? (booking.item.courseId ?? "") : "",
    });
    setAttempted(false);
    setFieldErrors(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, booking]);

  const set = <K extends keyof typeof draft>(
    key: K,
    value: (typeof draft)[K]
  ) => setDraft(current => ({ ...current, [key]: value }));

  const errors = {
    score: placement && !draft.score.trim() ? L.required : null,
    mentorId: placement && !draft.mentorId ? L.required : null,
  };

  async function submit() {
    setAttempted(true);
    if (!booking || Object.values(errors).some(Boolean)) {
      throw new FormValidationError();
    }
    setSaving(true);
    setFieldErrors(undefined);
    try {
      const common = {
        recommendedCourseId: draft.recommendedCourseId || null,
        resultNotes: draft.notes.trim() || null,
      };
      if (booking.kind === "placement") {
        await staffWrite(
          recordNccPlacementResultRequest(booking.item.id, {
            resultScore: draft.score.trim(),
            mentoringTeacherId: draft.mentorId,
            ...common,
          })
        );
      } else {
        await staffWrite(
          recordNccTrialLessonResultRequest(booking.item.id, {
            resultScore: draft.score.trim() || null,
            ...common,
          })
        );
      }
      await refreshAdmissions(invalidate);
      onOpenChange(false);
    } catch (error) {
      const details = (error as { details?: Record<string, string[]> }).details;
      if (details) setFieldErrors(details);
      throw error;
    } finally {
      setSaving(false);
    }
  }

  const show = (message: string | null) => (attempted ? message : null);

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={B.resultTitle}
      description={B.resultDescription}
      dirty={JSON.stringify(draft) !== JSON.stringify(empty)}
      saving={saving}
      fieldErrors={fieldErrors}
      saveLabel={copy.actions.save}
      onSubmit={() => runAction(submit, { success: B.resultToast })}
    >
      {errorFor => (
        <>
          <StaffField
            label={B.score}
            htmlFor="result-score"
            error={show(errors.score) ?? errorFor("result_score")}
          >
            <input
              id="result-score"
              className="staff-input"
              placeholder={B.scoreHint}
              value={draft.score}
              onChange={event => set("score", event.target.value)}
            />
          </StaffField>
          {placement ? (
            <StaffField
              label={B.mentor}
              error={show(errors.mentorId) ?? errorFor("mentoring_teacher_id")}
            >
              <Select
                value={draft.mentorId || undefined}
                onValueChange={value => set("mentorId", value)}
                disabled={mentors.length === 0}
              >
                <SelectTrigger aria-label={B.mentor}>
                  <SelectValue
                    placeholder={mentors.length ? B.mentor : B.noMentors}
                  />
                </SelectTrigger>
                <SelectContent>
                  {mentors.map(mentor => (
                    <SelectItem key={mentor.value} value={mentor.value}>
                      {mentor.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </StaffField>
          ) : null}
          <StaffField
            label={B.recommended}
            error={errorFor("recommended_course_id")}
          >
            <Select
              value={draft.recommendedCourseId || NONE}
              onValueChange={value =>
                set("recommendedCourseId", value === NONE ? "" : value)
              }
            >
              <SelectTrigger aria-label={B.recommended}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{B.noRecommendation}</SelectItem>
                {courses.map(course => (
                  <SelectItem key={course.value} value={course.value}>
                    {course.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </StaffField>
          <StaffField
            label={B.notes}
            htmlFor="result-notes"
            error={errorFor("result_notes")}
          >
            <textarea
              id="result-notes"
              className="staff-input"
              rows={3}
              value={draft.notes}
              onChange={event => set("notes", event.target.value)}
            />
          </StaffField>
        </>
      )}
    </FormSheet>
  );
}

/* ---------------- Registration fee ---------------------------------- */

/**
 * Total and paid amounts for a lead or student registration fee, or for a
 * course sale (enrolment).
 */
export function FeeSheet({
  open,
  onOpenChange,
  target,
  registration,
  title = L.feeTitle,
  description = L.feeDescription,
  success = L.feeToast,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: { type: "lead" | "student" | "enrolment"; id: string };
  registration:
    | Pick<NccRegistrationDto, "toBePaid" | "paid">
    | null
    | undefined;
  title?: string;
  description?: string;
  success?: string;
}) {
  const invalidate = useInvalidate();
  const initial = useMemo(
    () => ({
      toBePaid: registration ? String(registration.toBePaid) : "",
      paid: registration?.paid != null ? String(registration.paid) : "",
    }),
    [registration]
  );
  const [draft, setDraft] = useState(initial);
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(initial);
    setAttempted(false);
  }, [open, initial]);

  const toBePaid = parseAmount(draft.toBePaid);
  const paid = parseAmount(draft.paid);
  const errors = {
    toBePaid:
      toBePaid === null
        ? L.required
        : Number.isNaN(toBePaid)
          ? $.invalidAmount
          : null,
    paid:
      paid !== null && Number.isNaN(paid)
        ? $.invalidAmount
        : paid !== null && toBePaid !== null && paid > toBePaid
          ? $.paidTooHigh
          : null,
  };

  async function submit() {
    setAttempted(true);
    if (Object.values(errors).some(Boolean) || toBePaid === null) {
      throw new FormValidationError();
    }
    setSaving(true);
    try {
      const input = { toBePaid, ...(paid !== null ? { paid } : {}) };
      if (target.type === "lead") {
        await staffWrite(putNccLeadRegistrationRequest(target.id, input));
      } else if (target.type === "student") {
        await staffWrite(patchNccStudentRegistrationRequest(target.id, input));
      } else {
        await staffWrite(patchNccEnrolmentRequest(target.id, input));
        await invalidate("/api/ncc/admissions/enrolments");
      }
      await refreshAdmissions(invalidate);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  const show = (message: string | null) => (attempted ? message : null);

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      dirty={JSON.stringify(draft) !== JSON.stringify(initial)}
      saving={saving}
      onSubmit={() => runAction(submit, { success })}
    >
      <div className="grid grid-cols-2 gap-3">
        <StaffField
          label={$.toBePaid}
          htmlFor="fee-total"
          error={show(errors.toBePaid)}
        >
          <input
            id="fee-total"
            inputMode="decimal"
            className="staff-input staff-figures"
            value={draft.toBePaid}
            onChange={event =>
              setDraft(d => ({ ...d, toBePaid: event.target.value }))
            }
          />
        </StaffField>
        <StaffField label={$.paid} htmlFor="fee-paid" error={show(errors.paid)}>
          <input
            id="fee-paid"
            inputMode="decimal"
            className="staff-input staff-figures"
            value={draft.paid}
            onChange={event =>
              setDraft(d => ({ ...d, paid: event.target.value }))
            }
          />
        </StaffField>
      </div>
    </FormSheet>
  );
}

/* ---------------- Identity fields (convert, student create) --------- */

export const EMPTY_IDENTITY: IdentityInput = {
  nationality: "",
  address: "",
  gender: "",
  dateOfBirth: "",
  nationalId: "",
  passportNumber: "",
  guardians: [{ ...EMPTY_GUARDIAN }],
};

export function IdentityFields({
  value,
  onChange,
  attempted,
  errorFor,
}: {
  value: IdentityInput;
  onChange: (next: IdentityInput) => void;
  attempted: boolean;
  errorFor: (name: string) => string | null;
}) {
  const errors = validateIdentity(value);
  const message = (key: keyof IdentityInput) => {
    const code = attempted ? errors[key] : undefined;
    if (!code) return null;
    if (code === "required") return L.required;
    return code in copy.dateOfBirth
      ? copy.dateOfBirth[code as DobError]
      : I[code as Exclude<typeof code, DobError>];
  };
  const set = <K extends keyof IdentityInput>(key: K, next: IdentityInput[K]) =>
    onChange({ ...value, [key]: next });
  const setGuardian = (
    index: number,
    key: keyof IdentityInput["guardians"][number],
    next: string
  ) =>
    set(
      "guardians",
      value.guardians.map((guardian, i) =>
        i === index ? { ...guardian, [key]: next } : guardian
      )
    );

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <StaffField
          label={I.nationality}
          htmlFor="id-nationality"
          error={message("nationality") ?? errorFor("nationality")}
        >
          <input
            id="id-nationality"
            className="staff-input staff-ltr"
            maxLength={3}
            placeholder="EGY"
            value={value.nationality}
            onChange={event =>
              set("nationality", event.target.value.toUpperCase())
            }
          />
        </StaffField>
        <StaffField
          label={I.gender}
          error={message("gender") ?? errorFor("gender")}
        >
          <Select
            value={value.gender || undefined}
            onValueChange={next =>
              set("gender", next as IdentityInput["gender"])
            }
          >
            <SelectTrigger aria-label={I.gender}>
              <SelectValue placeholder={I.gender} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="female">{I.female}</SelectItem>
              <SelectItem value="male">{I.male}</SelectItem>
            </SelectContent>
          </Select>
        </StaffField>
      </div>
      <DateOfBirthField
        label={I.dateOfBirth}
        value={value.dateOfBirth}
        onChange={next => set("dateOfBirth", next)}
        error={message("dateOfBirth") ?? errorFor("date_of_birth")}
      />
      <div className="grid grid-cols-2 gap-3">
        <StaffField
          label={I.nationalId}
          htmlFor="id-national"
          error={message("nationalId") ?? errorFor("national_id")}
        >
          <input
            id="id-national"
            inputMode="numeric"
            className="staff-input staff-ltr staff-figures"
            maxLength={14}
            value={value.nationalId}
            onChange={event =>
              set("nationalId", event.target.value.replace(/\D/g, ""))
            }
          />
        </StaffField>
        <StaffField
          label={I.passport}
          htmlFor="id-passport"
          error={errorFor("passport_number")}
        >
          <input
            id="id-passport"
            className="staff-input staff-ltr"
            maxLength={32}
            value={value.passportNumber}
            onChange={event => set("passportNumber", event.target.value)}
          />
        </StaffField>
      </div>
      <StaffField
        label={I.address}
        htmlFor="id-address"
        error={message("address") ?? errorFor("address")}
      >
        <textarea
          id="id-address"
          className="staff-input"
          rows={2}
          value={value.address}
          onChange={event => set("address", event.target.value)}
        />
      </StaffField>

      <fieldset className="staff-field staff-guardians">
        <legend className="staff-field-label">{I.guardian}</legend>
        <span className="staff-hint">{I.guardianHint}</span>
        {value.guardians.map((guardian, index) => (
          <div key={index} className="staff-guardian">
            {index > 0 ? (
              <div className="staff-guardian-head">
                <span>{I.secondGuardian}</span>
                <button
                  type="button"
                  className="staff-btn"
                  data-variant="ghost"
                  data-size="sm"
                  onClick={() =>
                    set(
                      "guardians",
                      value.guardians.filter((_, i) => i !== index)
                    )
                  }
                >
                  {I.removeGuardian}
                </button>
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <StaffField label={I.guardianName}>
                <input
                  className="staff-input"
                  value={guardian.name}
                  onChange={event =>
                    setGuardian(index, "name", event.target.value)
                  }
                />
              </StaffField>
              <StaffField label={I.relationship}>
                <input
                  className="staff-input"
                  placeholder={I.relationshipHint}
                  value={guardian.relationship}
                  onChange={event =>
                    setGuardian(index, "relationship", event.target.value)
                  }
                />
              </StaffField>
              <StaffField label={I.guardianPhone}>
                <input
                  type="tel"
                  className="staff-input staff-ltr"
                  value={guardian.phone}
                  onChange={event =>
                    setGuardian(index, "phone", event.target.value)
                  }
                />
              </StaffField>
              <StaffField label={I.guardianEmail}>
                <input
                  type="email"
                  className="staff-input staff-ltr"
                  value={guardian.email}
                  onChange={event =>
                    setGuardian(index, "email", event.target.value)
                  }
                />
              </StaffField>
            </div>
          </div>
        ))}
        {(message("guardians") ?? errorFor("guardians")) ? (
          <span className="staff-field-error" role="alert">
            {message("guardians") ?? errorFor("guardians")}
          </span>
        ) : null}
        {value.guardians.length < 2 ? (
          <button
            type="button"
            className="staff-btn w-fit"
            data-size="sm"
            onClick={() =>
              set("guardians", [...value.guardians, { ...EMPTY_GUARDIAN }])
            }
          >
            {I.addGuardian}
          </button>
        ) : null}
      </fieldset>
    </>
  );
}

/* ---------------- Convert lead to student --------------------------- */

export function ConvertSheet({
  open,
  onOpenChange,
  leadId,
  onConverted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  onConverted: (student: NccStudentDto) => void;
}) {
  const invalidate = useInvalidate();
  const [identity, setIdentity] = useState<IdentityInput>(EMPTY_IDENTITY);
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>();

  useEffect(() => {
    if (!open) return;
    setIdentity(EMPTY_IDENTITY);
    setAttempted(false);
    setFieldErrors(undefined);
  }, [open]);

  async function submit() {
    setAttempted(true);
    if (Object.keys(validateIdentity(identity)).length) {
      throw new FormValidationError();
    }
    setSaving(true);
    setFieldErrors(undefined);
    try {
      const result = await staffWrite(
        convertNccLeadRequest(leadId, identityPayload(identity))
      );
      await refreshAdmissions(invalidate);
      onOpenChange(false);
      onConverted(result.student);
    } catch (error) {
      const details = (error as { details?: Record<string, string[]> }).details;
      if (details) setFieldErrors(details);
      throw error;
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={L.convertTitle}
      description={L.convertDescription}
      dirty={JSON.stringify(identity) !== JSON.stringify(EMPTY_IDENTITY)}
      saving={saving}
      fieldErrors={fieldErrors}
      saveLabel={L.convert}
      onSubmit={() => runAction(submit, { success: L.convertToast })}
    >
      {errorFor => (
        <IdentityFields
          value={identity}
          onChange={setIdentity}
          attempted={attempted}
          errorFor={errorFor}
        />
      )}
    </FormSheet>
  );
}
