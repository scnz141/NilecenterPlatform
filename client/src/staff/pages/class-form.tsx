import { useEffect, useMemo, useState } from "react";
import {
  createNccClassRequest,
  patchNccClassRequest,
  type NccClassDto,
  type NccClassPatchInput,
} from "@/lib/backend/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/staff/ui/kit";
import { staffWrite, useInvalidate } from "../api";
import { copy } from "../copy";
import { DatePicker } from "../ui/date-picker";
import { FormValidationError, runAction } from "../run-action";
import { useStaffSession } from "../session";
import {
  WEEKDAYS,
  scheduleFromDraft,
  validateClassDraft,
  weekdayName,
  type ClassDraft,
} from "../teaching";
import { FormSheet, StaffField } from "../ui/form-sheet";
import { MultiSelect } from "../ui/multi-select";
import { useActiveCourses, useBranches, useMentorTeachers } from "./admissions-ui";

const T = copy.teaching;
const K = copy.teaching.classes;

function draftFrom(item: NccClassDto | null): ClassDraft {
  return {
    name: item?.name ?? "",
    courseId: item?.courseId ?? "",
    kind: item?.kind ?? "group",
    capacity: item ? String(item.capacity) : "",
    startDate: item?.startAt.slice(0, 10) ?? "",
    endDate: item?.endAt.slice(0, 10) ?? "",
    teacherIds: item?.teacherIds ?? [],
    days: item?.schedule.daysOfWeek ?? [],
    startTime: item?.schedule.startTime?.slice(0, 5) ?? "",
    endTime: item?.schedule.endTime?.slice(0, 5) ?? "",
    meetingUrl: item?.meetingUrl ?? "",
  };
}

const errorText = (key: string | undefined) =>
  key === "required"
    ? T.required
    : key === "wholeNumber"
      ? T.wholeNumber
      : key
        ? K[key as keyof typeof K]
        : null;

/** Dates are whole days; EMS stores the first and last instant of each. */
const startInstant = (date: string) => `${date}T00:00:00Z`;
const endInstant = (date: string) => `${date}T23:59:59Z`;

export function ClassForm({
  open,
  onOpenChange,
  item,
  defaultCourseId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: NccClassDto | null;
  defaultCourseId?: string;
  onSaved?: (item: NccClassDto) => void;
}) {
  const { session } = useStaffSession();
  const superAdmin = session?.ncc?.activeRole === "super_admin";
  const invalidate = useInvalidate();
  const branches = useBranches();
  const courses = useActiveCourses(open && !item);
  const initial = useMemo(
    () => ({
      ...draftFrom(item),
      ...(item ? {} : { courseId: defaultCourseId ?? "" }),
    }),
    [item, defaultCourseId]
  );
  const [draft, setDraft] = useState<ClassDraft>(initial);
  const [branchId, setBranchId] = useState(
    item?.branchId ?? session?.ncc?.workspaceBranchId ?? ""
  );
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>();
  const teachers = useMentorTeachers(branchId || item?.branchId, open);
  const teacherOptions = useMemo(() => {
    // Keep teachers already on the class even when the source cannot list them.
    const known = new Map(teachers.map(option => [option.value, option.label]));
    for (const teacher of item?.teachers ?? []) {
      if (!known.has(teacher.id)) known.set(teacher.id, teacher.name || teacher.email);
    }
    return Array.from(known, ([value, label]) => ({ value, label }));
  }, [teachers, item]);

  useEffect(() => {
    if (!open) return;
    setDraft(initial);
    setBranchId(item?.branchId ?? session?.ncc?.workspaceBranchId ?? "");
    setAttempted(false);
    setFieldErrors(undefined);
  }, [open, initial, item, session?.ncc?.workspaceBranchId]);

  const set = <K extends keyof ClassDraft>(key: K, value: ClassDraft[K]) =>
    setDraft(current => ({ ...current, [key]: value }));
  const errors = validateClassDraft(draft, !item);
  const branchMissing = !item && superAdmin && !branchId;
  const show = (key: keyof ClassDraft) => (attempted ? errorText(errors[key]) : null);

  async function submit() {
    setAttempted(true);
    if (Object.keys(errors).length || branchMissing) throw new FormValidationError();
    setSaving(true);
    setFieldErrors(undefined);
    const schedule = scheduleFromDraft(draft);
    const meetingUrl = draft.meetingUrl.trim() || null;
    try {
      let saved: NccClassDto;
      if (item) {
        const before = draftFrom(item);
        const patch: NccClassPatchInput = {};
        if (draft.name.trim() !== before.name) patch.name = draft.name.trim();
        if (draft.kind !== before.kind) patch.kind = draft.kind;
        if (draft.capacity !== before.capacity) patch.capacity = Number(draft.capacity);
        if (draft.startDate !== before.startDate) patch.startAt = startInstant(draft.startDate);
        if (draft.endDate !== before.endDate) patch.endAt = endInstant(draft.endDate);
        if (draft.teacherIds.join() !== before.teacherIds.join()) patch.teacherIds = draft.teacherIds;
        if (
          draft.days.join() !== before.days.join() ||
          draft.startTime !== before.startTime ||
          draft.endTime !== before.endTime
        ) {
          patch.schedule = schedule;
        }
        if ((meetingUrl ?? "") !== before.meetingUrl) patch.meetingUrl = meetingUrl;
        saved = Object.keys(patch).length
          ? (await staffWrite(patchNccClassRequest(item.id, patch))).class
          : item;
      } else {
        saved = (
          await staffWrite(
            createNccClassRequest({
              name: draft.name.trim(),
              courseId: draft.courseId,
              kind: draft.kind,
              capacity: Number(draft.capacity),
              startAt: startInstant(draft.startDate),
              endAt: endInstant(draft.endDate),
              teacherIds: draft.teacherIds,
              ...(schedule ? { schedule } : {}),
              ...(meetingUrl ? { meetingUrl } : {}),
              ...(superAdmin ? { branchId } : {}),
            })
          )
        ).class;
      }
      await invalidate("/api/ncc/delivery/classes");
      onOpenChange(false);
      onSaved?.(saved);
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
      title={item ? K.editTitle : K.createTitle}
      description={item ? K.editDescription : K.createDescription}
      dirty={JSON.stringify(draft) !== JSON.stringify(initial)}
      saving={saving}
      fieldErrors={fieldErrors}
      saveLabel={item ? copy.catalog.shared.saveChanges : K.createSubmit}
      onSubmit={() => runAction(submit, { success: item ? K.updatedToast : K.createdToast })}
    >
      {errorFor => (
        <>
          <StaffField label={K.name} htmlFor="class-name" error={show("name") ?? errorFor("name")}>
            <input
              id="class-name"
              className="staff-input"
              maxLength={150}
              value={draft.name}
              onChange={event => set("name", event.target.value)}
            />
          </StaffField>
          {!item ? (
            <StaffField label={K.course} error={show("courseId") ?? errorFor("course_id")}>
              <Select value={draft.courseId || undefined} onValueChange={value => set("courseId", value)}>
                <SelectTrigger aria-label={K.course}>
                  <SelectValue placeholder={copy.admissions.booking.chooseCourse} />
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
          ) : null}
          {!item && superAdmin ? (
            <StaffField label={T.branch} error={attempted && branchMissing ? T.required : errorFor("branch_id")}>
              <Select value={branchId || undefined} onValueChange={setBranchId}>
                <SelectTrigger aria-label={T.branch}>
                  <SelectValue placeholder={copy.admissions.leads.chooseBranch} />
                </SelectTrigger>
                <SelectContent>
                  {branches.active.map(branch => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </StaffField>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <fieldset className="staff-field">
              <legend className="staff-field-label">{K.kind}</legend>
              <div className="staff-check-row">
                {(["group", "individual"] as const).map(kind => (
                  <label key={kind} className="staff-check">
                    <input
                      type="radio"
                      name="class-kind"
                      checked={draft.kind === kind}
                      onChange={() => set("kind", kind)}
                    />
                    {kind === "group" ? K.group : K.individual}
                  </label>
                ))}
              </div>
            </fieldset>
            <StaffField label={K.capacity} htmlFor="class-capacity" error={show("capacity") ?? errorFor("capacity")}>
              <input
                id="class-capacity"
                inputMode="numeric"
                className="staff-input staff-figures"
                value={draft.capacity}
                onChange={event => set("capacity", event.target.value.replace(/\D/g, ""))}
              />
            </StaffField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <StaffField label={K.starts} htmlFor="class-start" error={show("startDate") ?? errorFor("start_at")}>
              <DatePicker
                id="class-start"
                value={draft.startDate}
                rangeStart={draft.startDate}
                rangeEnd={draft.endDate}
                invalid={Boolean(show("startDate") ?? errorFor("start_at"))}
                onChange={next => set("startDate", next)}
              />
            </StaffField>
            <StaffField label={K.ends} htmlFor="class-end" error={show("endDate") ?? errorFor("end_at")}>
              <DatePicker
                id="class-end"
                min={draft.startDate || undefined}
                value={draft.endDate}
                rangeStart={draft.startDate}
                rangeEnd={draft.endDate}
                invalid={Boolean(show("endDate") ?? errorFor("end_at"))}
                onChange={next => set("endDate", next)}
              />
            </StaffField>
          </div>
          <StaffField label={K.teachers} error={errorFor("teacher_ids")}>
            <MultiSelect
              options={teacherOptions}
              value={draft.teacherIds}
              onChange={value => set("teacherIds", value)}
              allLabel={K.noTeacher}
              noun={K.teachers.toLowerCase()}
              emptyLabel={K.noTeachers}
              ariaLabel={K.teachers}
            />
          </StaffField>
          <fieldset className="staff-field">
            <legend className="staff-field-label">{K.usualDays}</legend>
            <div className="staff-day-picker" role="group" aria-label={K.usualDays}>
              {WEEKDAYS.map(day => {
                const on = draft.days.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    className="staff-day-chip"
                    aria-pressed={on}
                    data-on={on || undefined}
                    onClick={() =>
                      set(
                        "days",
                        on ? draft.days.filter(item => item !== day) : [...draft.days, day].sort((a, b) => a - b)
                      )
                    }
                  >
                    {weekdayName(day)}
                  </button>
                );
              })}
            </div>
            {show("days") ? (
              <span className="staff-field-error" role="alert">
                {show("days")}
              </span>
            ) : null}
          </fieldset>
          <div className="grid grid-cols-2 gap-3">
            <StaffField label={K.from} htmlFor="class-time-from" error={show("startTime") ?? errorFor("schedule_start_time")}>
              <input
                id="class-time-from"
                type="time"
                step={900}
                className="staff-input"
                value={draft.startTime}
                onChange={event => set("startTime", event.target.value)}
              />
            </StaffField>
            <StaffField label={K.to} htmlFor="class-time-to" error={show("endTime") ?? errorFor("schedule_end_time")}>
              <input
                id="class-time-to"
                type="time"
                step={900}
                className="staff-input"
                value={draft.endTime}
                onChange={event => set("endTime", event.target.value)}
              />
            </StaffField>
          </div>
          <StaffField label={K.meetingLink} htmlFor="class-meeting" error={show("meetingUrl") ?? errorFor("meeting_url")}>
            <input
              id="class-meeting"
              type="url"
              inputMode="url"
              className="staff-input staff-ltr"
              placeholder="https://"
              value={draft.meetingUrl}
              onChange={event => set("meetingUrl", event.target.value)}
            />
            <span className="staff-hint">{K.meetingHint}</span>
          </StaffField>
        </>
      )}
    </FormSheet>
  );
}
