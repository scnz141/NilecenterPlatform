import { useEffect, useMemo, useState, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import {
  attachNccClassEnrolmentRequest,
  closeNccEnrolmentRequest,
  createNccEnrolmentRequest,
  type NccClassDto,
  type NccEnrolmentDto,
  type NccPageDto,
  type NccStudentDto,
} from "@/lib/backend/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/staff/ui/kit";
import { formatAmount, parseAmount } from "../admissions";
import { scheduleText as scheduleFromClass } from "../teaching";
import { staffWrite, useInvalidate, useNcc } from "../api";
import { copy } from "../copy";
import { FormValidationError, runAction } from "../run-action";
import { useStaffSession } from "../session";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { FormSheet, StaffField } from "../ui/form-sheet";
import { useActiveCourses, useBranches } from "./admissions-ui";
import { FeeSheet } from "./booking-sheets";

const E = copy.admissions.enrolments;
const $ = copy.admissions.money;

/** Which follow-up actions EMS accepts for an enrolment status. */
export function enrolmentActions(
  enrolment: Pick<NccEnrolmentDto, "status" | "nextLevel" | "classId">
) {
  const waiting =
    enrolment.status === "pending_payment" ||
    enrolment.status === "pending_class" ||
    enrolment.status === "pending_group";
  return {
    payment: waiting,
    attach:
      (enrolment.status === "pending_class" ||
        enrolment.status === "pending_group") &&
      !enrolment.classId,
    complete: enrolment.status === "enrolled",
    leave: enrolment.nextLevel && (waiting || enrolment.status === "enrolled"),
    cancel: waiting,
  };
}

export function kindLabel(kind: NccEnrolmentDto["kind"]) {
  return kind === "individual" ? E.individual : E.group;
}

export function BalanceCell({ enrolment }: { enrolment: NccEnrolmentDto }) {
  if (enrolment.toBePaid === null)
    return <span className="staff-muted">{copy.state.notSet}</span>;
  const remaining =
    enrolment.remaining ?? enrolment.toBePaid - (enrolment.paid ?? 0);
  if (remaining <= 0)
    return (
      <span className="staff-balance" data-settled="true">
        {$.settled}
      </span>
    );
  return (
    <span
      className="staff-balance staff-figures"
      title={`${$.toBePaid}: ${formatAmount(enrolment.toBePaid)}`}
    >
      {formatAmount(remaining)}{" "}
      <span className="staff-muted">{$.remaining.toLowerCase()}</span>
    </span>
  );
}

export function scheduleText(item: NccClassDto): string | null {
  return scheduleFromClass(item.schedule);
}

/* ---------------- Add to class -------------------------------------- */

function AttachSheet({
  enrolment,
  onOpenChange,
}: {
  enrolment: NccEnrolmentDto | null;
  onOpenChange: (open: boolean) => void;
}) {
  const invalidate = useInvalidate();
  const open = enrolment !== null;
  const classes = useNcc<NccPageDto<NccClassDto>>(
    open ? "/api/ncc/delivery/classes" : null,
    enrolment
      ? {
          courseId: enrolment.courseId,
          branchId: enrolment.branchId,
          status: "active",
          pageSize: 100,
        }
      : undefined
  );
  const [classId, setClassId] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => setClassId(""), [enrolment?.id]);

  const options = (classes.data?.items ?? []).filter(
    item => !item.kind || !enrolment || item.kind === enrolment.kind
  );
  const moodleMissing = enrolment ? !enrolment.student.moodleLinked : false;

  async function submit() {
    if (!enrolment || !classId || moodleMissing)
      throw new FormValidationError();
    setSaving(true);
    try {
      await staffWrite(
        attachNccClassEnrolmentRequest(classId, { enrolmentId: enrolment.id })
      );
      await Promise.all([
        invalidate("/api/ncc/admissions/enrolments"),
        invalidate("/api/ncc/admissions/students"),
        invalidate("/api/ncc/delivery/classes"),
      ]);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={E.attachTitle}
      description={
        enrolment
          ? `${enrolment.courseName} · ${enrolment.branchName}`
          : undefined
      }
      dirty={false}
      saving={saving}
      saveLabel={E.attach}
      onSubmit={() => runAction(submit, { success: E.attachToast })}
    >
      <p className="staff-hint">{E.attachDescription}</p>
      {moodleMissing ? (
        <p className="staff-banner" data-tone="caution" role="alert">
          {E.moodleRequired}
        </p>
      ) : null}
      {!classes.data ? (
        <p className="staff-muted">{copy.state.loading}</p>
      ) : options.length === 0 ? (
        <p className="staff-muted">{E.noClasses}</p>
      ) : (
        <div
          className="staff-choice-list"
          role="radiogroup"
          aria-label={E.class}
        >
          {options.map(item => {
            const left = item.capacity - item.activeEnrolmentCount;
            const full = left <= 0;
            const schedule = scheduleText(item);
            return (
              <label
                key={item.id}
                className="staff-choice"
                data-disabled={full || undefined}
              >
                <input
                  type="radio"
                  name="attach-class"
                  value={item.id}
                  disabled={full}
                  checked={classId === item.id}
                  onChange={() => setClassId(item.id)}
                />
                <span className="staff-choice-body">
                  <span className="staff-choice-title">{item.name}</span>
                  {schedule ? (
                    <span className="staff-muted">{schedule}</span>
                  ) : null}
                  {item.teachers.length ? (
                    <span className="staff-muted">
                      {E.teachers}:{" "}
                      {item.teachers.map(teacher => teacher.name).join(", ")}
                    </span>
                  ) : null}
                </span>
                <span className="staff-choice-meta">
                  {full ? (
                    <span className="staff-badge" data-tone="red">
                      {E.full}
                    </span>
                  ) : (
                    <span className="staff-figures">
                      {left} {E.seatsLeft}
                    </span>
                  )}
                </span>
              </label>
            );
          })}
        </div>
      )}
    </FormSheet>
  );
}

/* ---------------- Action menu + dialogs ----------------------------- */

type Pending =
  | { type: "payment"; enrolment: NccEnrolmentDto }
  | { type: "attach"; enrolment: NccEnrolmentDto }
  | { type: "complete" | "leave" | "cancel"; enrolment: NccEnrolmentDto };

/**
 * One enrolment action menu and the dialogs behind it, shared by the student
 * Courses tab and the Enrolments queue.
 */
export function useEnrolmentActions(): {
  menu: (enrolment: NccEnrolmentDto) => ReactNode;
  dialogs: ReactNode;
} {
  const invalidate = useInvalidate();
  const [pending, setPending] = useState<Pending | null>(null);
  const close = (open: boolean) => !open && setPending(null);

  async function refresh() {
    await Promise.all([
      invalidate("/api/ncc/admissions/enrolments"),
      invalidate("/api/ncc/admissions/students"),
    ]);
  }

  function menu(enrolment: NccEnrolmentDto) {
    const allowed = enrolmentActions(enrolment);
    if (!Object.values(allowed).some(Boolean)) return null;
    return (
      <div className="staff-row-actions">
        {allowed.attach ? (
          <button
            type="button"
            className="staff-btn"
            data-size="sm"
            data-variant="primary"
            onClick={() => setPending({ type: "attach", enrolment })}
          >
            {E.attach}
          </button>
        ) : allowed.payment ? (
          <button
            type="button"
            className="staff-btn"
            data-size="sm"
            onClick={() => setPending({ type: "payment", enrolment })}
          >
            {E.recordPayment}
          </button>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="staff-icon-btn"
              aria-label={copy.actions.rowActions}
            >
              <MoreHorizontal strokeWidth={1.75} aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {allowed.payment ? (
              <DropdownMenuItem
                onSelect={() => setPending({ type: "payment", enrolment })}
              >
                {E.recordPayment}
              </DropdownMenuItem>
            ) : null}
            {allowed.attach ? (
              <DropdownMenuItem
                onSelect={() => setPending({ type: "attach", enrolment })}
              >
                {E.attach}
              </DropdownMenuItem>
            ) : null}
            {allowed.complete ? (
              <DropdownMenuItem
                onSelect={() => setPending({ type: "complete", enrolment })}
              >
                {E.complete}
              </DropdownMenuItem>
            ) : null}
            {allowed.leave ? (
              <DropdownMenuItem
                onSelect={() => setPending({ type: "leave", enrolment })}
              >
                {E.leave}
              </DropdownMenuItem>
            ) : null}
            {allowed.cancel ? (
              <DropdownMenuItem
                className="text-[var(--staff-red)]"
                onSelect={() => setPending({ type: "cancel", enrolment })}
              >
                {E.cancel}
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  const target = pending?.enrolment;
  const close_ = (type: "complete" | "leave" | "cancel", reasonId?: string) =>
    runAction(
      async () => {
        if (!target) return;
        await staffWrite(closeNccEnrolmentRequest(target.id, type, reasonId));
        await refresh();
      },
      {
        success:
          type === "complete"
            ? E.completeToast
            : type === "leave"
              ? E.leaveToast
              : E.cancelToast,
      }
    );

  const dialogs = (
    <>
      <FeeSheet
        open={pending?.type === "payment"}
        onOpenChange={close}
        target={{ type: "enrolment", id: target?.id ?? "" }}
        registration={
          target && target.toBePaid !== null
            ? { toBePaid: target.toBePaid, paid: target.paid }
            : null
        }
        title={E.paymentTitle}
        description={
          target
            ? `${target.studentName} · ${target.courseName}`
            : E.paymentDescription
        }
        success={E.paymentToast}
      />
      <AttachSheet
        enrolment={pending?.type === "attach" ? pending.enrolment : null}
        onOpenChange={close}
      />
      <ConfirmDialog
        open={pending?.type === "complete"}
        onOpenChange={close}
        title={E.completeTitle}
        description={E.completeBody}
        confirmLabel={E.complete}
        onConfirm={() => close_("complete")}
      />
      <ConfirmDialog
        open={pending?.type === "leave"}
        onOpenChange={close}
        title={E.leaveTitle}
        description={E.leaveBody}
        confirmLabel={E.leave}
        destructive
        reasonKind="left_enrolment"
        reasonRequired
        onConfirm={reasonId => close_("leave", reasonId)}
      />
      <ConfirmDialog
        open={pending?.type === "cancel"}
        onOpenChange={close}
        title={E.cancelTitle}
        description={E.cancelBody}
        confirmLabel={E.cancel}
        destructive
        reasonKind="cancel_enrolment"
        reasonRequired
        onConfirm={reasonId => close_("cancel", reasonId)}
      />
    </>
  );

  return { menu, dialogs };
}

/* ---------------- Sell a course ------------------------------------- */

export function SaleSheet({
  open,
  onOpenChange,
  student,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fixed student (student page). Without it the sheet searches students. */
  student?: Pick<NccStudentDto, "id" | "name" | "homeBranchId"> | null;
}) {
  const { session } = useStaffSession();
  const superAdmin = session?.ncc?.activeRole === "super_admin";
  const invalidate = useInvalidate();
  const courses = useActiveCourses(open);
  const branches = useBranches();
  const empty = useMemo(
    () => ({
      studentId: student?.id ?? "",
      query: "",
      courseId: "",
      kind: "group" as "group" | "individual",
      branchId: student?.homeBranchId ?? "",
      toBePaid: "",
      paid: "",
    }),
    [student]
  );
  const [draft, setDraft] = useState(empty);
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>();
  useEffect(() => {
    if (!open) return;
    setDraft(empty);
    setAttempted(false);
    setFieldErrors(undefined);
  }, [open, empty]);
  const set = <K extends keyof typeof draft>(
    key: K,
    value: (typeof draft)[K]
  ) => setDraft(current => ({ ...current, [key]: value }));

  const search = draft.query.trim();
  const matches = useNcc<NccPageDto<NccStudentDto>>(
    open && !student && search.length >= 2
      ? "/api/ncc/admissions/students"
      : null,
    { q: search, status: "active", pageSize: 8 },
    { keepPreviousData: true }
  );

  const toBePaid = parseAmount(draft.toBePaid);
  const paid = parseAmount(draft.paid);
  const errors = {
    studentId: draft.studentId ? null : copy.admissions.leads.required,
    courseId: draft.courseId ? null : copy.admissions.booking.chooseCourse,
    branchId:
      superAdmin && !draft.branchId ? copy.admissions.leads.chooseBranch : null,
    toBePaid:
      toBePaid === null
        ? copy.admissions.leads.required
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
    if (Object.values(errors).some(Boolean) || toBePaid === null)
      throw new FormValidationError();
    setSaving(true);
    setFieldErrors(undefined);
    try {
      await staffWrite(
        createNccEnrolmentRequest({
          studentId: draft.studentId,
          courseId: draft.courseId,
          kind: draft.kind,
          toBePaid,
          ...(paid !== null ? { paid } : {}),
          ...(superAdmin ? { branchId: draft.branchId } : {}),
        })
      );
      await Promise.all([
        invalidate("/api/ncc/admissions/enrolments"),
        invalidate("/api/ncc/admissions/students"),
      ]);
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
      title={E.saleTitle}
      description={
        student ? `${student.name} · ${E.saleDescription}` : E.saleDescription
      }
      dirty={JSON.stringify(draft) !== JSON.stringify(empty)}
      saving={saving}
      fieldErrors={fieldErrors}
      saveLabel={E.sell}
      onSubmit={() => runAction(submit, { success: E.saleToast })}
    >
      {errorFor => (
        <>
          {!student ? (
            <StaffField
              label={E.student}
              htmlFor="sale-student"
              error={show(errors.studentId)}
            >
              <input
                id="sale-student"
                type="search"
                className="staff-input"
                placeholder={E.findStudent}
                value={draft.query}
                onChange={event => {
                  set("query", event.target.value);
                  set("studentId", "");
                }}
              />
              {search.length < 2 ? (
                <span className="staff-hint">{E.typeToSearch}</span>
              ) : (matches.data?.items ?? []).length === 0 && matches.data ? (
                <span className="staff-hint">{E.noStudents}</span>
              ) : (
                <div
                  className="staff-choice-list"
                  role="radiogroup"
                  aria-label={E.student}
                >
                  {(matches.data?.items ?? []).map(item => (
                    <label key={item.id} className="staff-choice">
                      <input
                        type="radio"
                        name="sale-student"
                        checked={draft.studentId === item.id}
                        onChange={() => {
                          set("studentId", item.id);
                          if (!draft.branchId)
                            set("branchId", item.homeBranchId);
                        }}
                      />
                      <span className="staff-choice-body">
                        <span className="staff-choice-title">{item.name}</span>
                        <span className="staff-muted staff-ltr">
                          {item.email}
                        </span>
                      </span>
                      <span className="staff-muted">{item.branchName}</span>
                    </label>
                  ))}
                </div>
              )}
            </StaffField>
          ) : null}
          <StaffField
            label={E.course}
            error={show(errors.courseId) ?? errorFor("course_id")}
          >
            <Select
              value={draft.courseId || undefined}
              onValueChange={value => set("courseId", value)}
            >
              <SelectTrigger aria-label={E.course}>
                <SelectValue
                  placeholder={copy.admissions.booking.chooseCourse}
                />
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
          <fieldset className="staff-field">
            <legend className="staff-field-label">{E.kind}</legend>
            <div className="staff-check-row">
              {(["group", "individual"] as const).map(kind => (
                <label key={kind} className="staff-check">
                  <input
                    type="radio"
                    name="sale-kind"
                    checked={draft.kind === kind}
                    onChange={() => set("kind", kind)}
                  />
                  {kindLabel(kind)}
                </label>
              ))}
            </div>
          </fieldset>
          {superAdmin ? (
            <StaffField
              label={E.branch}
              error={show(errors.branchId) ?? errorFor("branch_id")}
            >
              <Select
                value={draft.branchId || undefined}
                onValueChange={value => set("branchId", value)}
              >
                <SelectTrigger aria-label={E.branch}>
                  <SelectValue
                    placeholder={copy.admissions.leads.chooseBranch}
                  />
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
            <StaffField
              label={$.toBePaid}
              htmlFor="sale-total"
              error={show(errors.toBePaid) ?? errorFor("to_be_paid")}
            >
              <input
                id="sale-total"
                inputMode="decimal"
                className="staff-input staff-figures"
                value={draft.toBePaid}
                onChange={event => set("toBePaid", event.target.value)}
              />
            </StaffField>
            <StaffField
              label={$.paid}
              htmlFor="sale-paid"
              error={show(errors.paid) ?? errorFor("paid")}
            >
              <input
                id="sale-paid"
                inputMode="decimal"
                className="staff-input staff-figures"
                value={draft.paid}
                onChange={event => set("paid", event.target.value)}
              />
            </StaffField>
          </div>
        </>
      )}
    </FormSheet>
  );
}
