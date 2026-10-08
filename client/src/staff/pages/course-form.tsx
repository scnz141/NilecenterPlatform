import { useEffect, useMemo, useState } from "react";
import {
  createNccCourseRequest,
  patchNccCourseRequest,
  type NccCourseDto,
  type NccDepartmentDto,
  type NccMoodleCoursePickerDto,
} from "@/lib/backend/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/staff/ui/kit";
import { staffWrite, useInvalidate, useNcc } from "../api";
import { copy } from "../copy";
import { FormValidationError, runAction } from "../run-action";
import { FormSheet, StaffField } from "../ui/form-sheet";
import { useActiveAreas } from "./admissions-ui";

const C = copy.teaching.courses;
const T = copy.teaching;
const NONE = "__none";

export function useDepartments(enabled = true) {
  const departments = useNcc<{ items: NccDepartmentDto[] }>(
    enabled ? "/api/ncc/directory/departments" : null
  );
  return useMemo(
    () => (departments.data?.items ?? []).filter(item => item.status === "active"),
    [departments.data]
  );
}

type Draft = {
  departmentId: string;
  moodleCourseId: number | null;
  totalHours: string;
  areaOfStudyId: string;
  previousCourseId: string;
  moodleAttendanceId: string;
};

/** Link a Moodle course (create) or edit a linked course. */
export function CourseForm({
  open,
  onOpenChange,
  course,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course: NccCourseDto | null;
  onSaved?: (course: NccCourseDto) => void;
}) {
  const invalidate = useInvalidate();
  const departments = useDepartments(open);
  const areas = useActiveAreas(open);
  const others = useNcc<{ items: NccCourseDto[] }>(open ? "/api/ncc/delivery/courses" : null, {
    status: "active",
    pageSize: 100,
  });
  const [search, setSearch] = useState("");
  const picker = useNcc<NccMoodleCoursePickerDto>(
    open && !course ? "/api/ncc/delivery/moodle-courses" : null,
    { unmapped: true, ...(search.trim() ? { q: search.trim() } : {}) },
    { keepPreviousData: true }
  );
  const initial = useMemo<Draft>(
    () => ({
      departmentId: course?.departmentId ?? "",
      moodleCourseId: course?.moodleCourseId ?? null,
      totalHours: course?.totalHours ? String(course.totalHours) : "",
      areaOfStudyId: course?.areaOfStudyId ?? "",
      previousCourseId: course?.previousCourseId ?? "",
      moodleAttendanceId: course?.moodleAttendanceId ? String(course.moodleAttendanceId) : "",
    }),
    [course]
  );
  const [draft, setDraft] = useState(initial);
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>();
  useEffect(() => {
    if (!open) return;
    setDraft(initial);
    setSearch("");
    setAttempted(false);
    setFieldErrors(undefined);
  }, [open, initial]);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft(current => ({ ...current, [key]: value }));

  const hours = Number(draft.totalHours);
  const attendance = draft.moodleAttendanceId.trim() ? Number(draft.moodleAttendanceId) : null;
  const errors = {
    departmentId: draft.departmentId ? null : T.required,
    moodleCourseId: course || draft.moodleCourseId !== null ? null : C.chooseMoodle,
    totalHours: Number.isInteger(hours) && hours > 0 ? null : T.wholeNumber,
    moodleAttendanceId:
      attendance === null || (Number.isInteger(attendance) && attendance > 0) ? null : T.wholeNumber,
  };
  const show = (message: string | null) => (attempted ? message : null);

  async function submit() {
    setAttempted(true);
    if (Object.values(errors).some(Boolean)) throw new FormValidationError();
    setSaving(true);
    setFieldErrors(undefined);
    try {
      let saved: NccCourseDto;
      if (course) {
        const patch: Parameters<typeof patchNccCourseRequest>[1] = {};
        if (draft.departmentId !== initial.departmentId) patch.departmentId = draft.departmentId;
        if (draft.totalHours !== initial.totalHours) patch.totalHours = hours;
        if (draft.areaOfStudyId !== initial.areaOfStudyId) patch.areaOfStudyId = draft.areaOfStudyId || null;
        if (draft.previousCourseId !== initial.previousCourseId) {
          patch.previousCourseId = draft.previousCourseId || null;
        }
        if (draft.moodleAttendanceId !== initial.moodleAttendanceId) patch.moodleAttendanceId = attendance;
        saved = Object.keys(patch).length
          ? (await staffWrite(patchNccCourseRequest(course.id, patch))).course
          : course;
      } else {
        saved = (
          await staffWrite(
            createNccCourseRequest({
              departmentId: draft.departmentId,
              moodleCourseId: draft.moodleCourseId as number,
              totalHours: hours,
              ...(draft.areaOfStudyId ? { areaOfStudyId: draft.areaOfStudyId } : {}),
              ...(draft.previousCourseId ? { previousCourseId: draft.previousCourseId } : {}),
            })
          )
        ).course;
      }
      await invalidate("/api/ncc/delivery/courses");
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

  const previousOptions = (others.data?.items ?? []).filter(item => item.id !== course?.id);
  const moodle = picker.data?.courses ?? [];

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={course ? C.editTitle : C.linkTitle}
      description={course ? C.editDescription : C.linkDescription}
      dirty={JSON.stringify(draft) !== JSON.stringify(initial)}
      saving={saving}
      fieldErrors={fieldErrors}
      saveLabel={course ? copy.catalog.shared.saveChanges : C.linkSubmit}
      onSubmit={() => runAction(submit, { success: course ? C.editToast : C.linkToast })}
    >
      {errorFor => (
        <>
          {!course ? (
            <StaffField label={copy.teaching.courses.moodle} error={show(errors.moodleCourseId) ?? errorFor("moodle_course_id")}>
              <input
                type="search"
                className="staff-input"
                placeholder={C.searchMoodle}
                value={search}
                onChange={event => setSearch(event.target.value)}
              />
              {picker.data && moodle.length === 0 ? (
                <span className="staff-hint">{C.noUnmapped}</span>
              ) : (
                <div className="staff-choice-list staff-choice-scroll" role="radiogroup" aria-label={C.moodle}>
                  {moodle.map(item => (
                    <label key={item.id} className="staff-choice">
                      <input
                        type="radio"
                        name="moodle-course"
                        checked={draft.moodleCourseId === item.id}
                        onChange={() => set("moodleCourseId", item.id)}
                      />
                      <span className="staff-choice-body">
                        <span className="staff-choice-title">{item.displayName ?? item.fullname}</span>
                        <span className="staff-muted">
                          {item.shortname}
                          {item.categoryName ? ` · ${item.categoryName}` : ""}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </StaffField>
          ) : null}
          <StaffField label={C.department} error={show(errors.departmentId) ?? errorFor("department_id")}>
            <Select value={draft.departmentId || undefined} onValueChange={value => set("departmentId", value)}>
              <SelectTrigger aria-label={C.department}>
                <SelectValue placeholder={C.department} />
              </SelectTrigger>
              <SelectContent>
                {departments.map(item => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </StaffField>
          <StaffField label={C.totalHours} htmlFor="course-hours" error={show(errors.totalHours) ?? errorFor("total_hours")}>
            <input
              id="course-hours"
              inputMode="numeric"
              className="staff-input staff-figures"
              value={draft.totalHours}
              onChange={event => set("totalHours", event.target.value.replace(/\D/g, ""))}
            />
          </StaffField>
          <StaffField label={C.area} error={errorFor("area_of_study_id")}>
            <Select
              value={draft.areaOfStudyId || NONE}
              onValueChange={value => set("areaOfStudyId", value === NONE ? "" : value)}
            >
              <SelectTrigger aria-label={C.area}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{C.noArea}</SelectItem>
                {areas.map(area => (
                  <SelectItem key={area.id} value={area.id}>
                    {area.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </StaffField>
          <StaffField label={C.previous} error={errorFor("previous_course_id")}>
            <Select
              value={draft.previousCourseId || NONE}
              onValueChange={value => set("previousCourseId", value === NONE ? "" : value)}
            >
              <SelectTrigger aria-label={C.previous}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{C.noPrevious}</SelectItem>
                {previousOptions.map(item => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.displayName ?? item.fullname}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </StaffField>
          {course ? (
            <StaffField
              label={C.attendanceId}
              htmlFor="course-attendance"
              error={show(errors.moodleAttendanceId) ?? errorFor("moodle_attendance_id")}
            >
              <input
                id="course-attendance"
                inputMode="numeric"
                className="staff-input staff-figures"
                value={draft.moodleAttendanceId}
                onChange={event => set("moodleAttendanceId", event.target.value.replace(/\D/g, ""))}
              />
              <span className="staff-hint">{C.attendanceHint}</span>
            </StaffField>
          ) : null}
        </>
      )}
    </FormSheet>
  );
}
