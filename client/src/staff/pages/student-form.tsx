import { useEffect, useMemo, useState } from "react";
import {
  createNccStudentRequest,
  patchNccStudentRequest,
  type NccStudentDto,
  type NccStudentWriteInput,
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
import { staffWrite, useInvalidate } from "../api";
import { copy } from "../copy";
import { canSetAssignee } from "../roles";
import { FormValidationError, runAction } from "../run-action";
import { useStaffSession } from "../session";
import { FormSheet, StaffField } from "../ui/form-sheet";
import type { StaffSecret } from "../ui/secret-dialog";
import { useAssignees, useBranches } from "./admissions-ui";
import { IdentityFields } from "./booking-sheets";

const S = copy.admissions.students;
const L = copy.admissions.leads;
const $ = copy.admissions.money;
const NONE = "__none";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function identityFrom(student: NccStudentDto | null): IdentityInput {
  const guardians = (student?.guardians ?? []).map(guardian => ({
    name: guardian.name,
    phone: guardian.phone,
    email: guardian.email,
    relationship: guardian.relationship,
  }));
  return {
    nationality: student?.nationality ?? "",
    address: student?.address ?? "",
    gender: student?.gender ?? "",
    dateOfBirth: student?.dateOfBirth ?? "",
    nationalId: student?.nationalId ?? "",
    passportNumber: student?.passportNumber ?? "",
    guardians: guardians.length ? guardians : [{ ...EMPTY_GUARDIAN }],
  };
}

export function StudentForm({
  open,
  onOpenChange,
  student,
  onSaved,
  onSecrets,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: NccStudentDto | null;
  onSaved?: (student: NccStudentDto) => void;
  onSecrets?: (secrets: StaffSecret[]) => void;
}) {
  const { session } = useStaffSession();
  const role = session?.ncc?.activeRole ?? null;
  const superAdmin = role === "super_admin";
  const invalidate = useInvalidate();
  const branches = useBranches();
  const initial = useMemo(
    () => ({
      firstName: student?.firstName ?? "",
      lastName: student?.lastName ?? "",
      email: student?.email ?? "",
      phone: student?.phone ?? "",
      note: student?.note ?? "",
      branchId:
        student?.homeBranchId ??
        (superAdmin ? "" : (session?.ncc?.workspaceBranchId ?? "")),
      assignedSsaId: student?.assignedSsaId ?? "",
      toBePaid: "",
      paid: "",
      identity: identityFrom(student),
    }),
    [student, superAdmin, session?.ncc?.workspaceBranchId]
  );
  const [draft, setDraft] = useState(initial);
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>();
  const assignees = useAssignees(draft.branchId, open && canSetAssignee(role));
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

  const toBePaid = parseAmount(draft.toBePaid);
  const paid = parseAmount(draft.paid);
  const errors = {
    firstName: draft.firstName.trim() ? null : L.required,
    lastName: draft.lastName.trim() ? null : L.required,
    email: !draft.email.trim()
      ? L.required
      : EMAIL_PATTERN.test(draft.email.trim())
        ? null
        : L.invalidEmail,
    branchId: !student && superAdmin && !draft.branchId ? L.chooseBranch : null,
    toBePaid: student
      ? null
      : toBePaid === null
        ? L.required
        : Number.isNaN(toBePaid)
          ? $.invalidAmount
          : null,
    paid:
      student || paid === null
        ? null
        : Number.isNaN(paid)
          ? $.invalidAmount
          : toBePaid !== null && paid > toBePaid
            ? $.paidTooHigh
            : null,
  };
  const identityErrors = validateIdentity(draft.identity);

  async function submit() {
    setAttempted(true);
    if (
      Object.values(errors).some(Boolean) ||
      Object.keys(identityErrors).length
    ) {
      throw new FormValidationError();
    }
    setSaving(true);
    setFieldErrors(undefined);
    const identity = identityPayload(draft.identity);
    try {
      let saved: NccStudentDto;
      if (student) {
        const patch: NccStudentWriteInput = {
          ...identity,
          firstName: draft.firstName.trim(),
          lastName: draft.lastName.trim(),
          email: draft.email.trim(),
          phone: draft.phone.trim() || null,
          note: draft.note.trim() || null,
          ...(canSetAssignee(role)
            ? { assignedSsaId: draft.assignedSsaId || null }
            : {}),
          ...(superAdmin && draft.branchId !== student.homeBranchId
            ? { homeBranchId: draft.branchId }
            : {}),
        };
        saved = (await staffWrite(patchNccStudentRequest(student.id, patch)))
          .student;
      } else {
        const result = await staffWrite(
          createNccStudentRequest({
            ...identity,
            firstName: draft.firstName.trim(),
            lastName: draft.lastName.trim(),
            email: draft.email.trim(),
            phone: draft.phone.trim() || null,
            note: draft.note.trim() || null,
            registration: {
              toBePaid: toBePaid as number,
              ...(paid !== null ? { paid } : {}),
            },
            ...(draft.assignedSsaId
              ? { assignedSsaId: draft.assignedSsaId }
              : {}),
            ...(superAdmin ? { branchId: draft.branchId } : {}),
          })
        );
        saved = result.student;
        if (result.oneTime?.generatedMoodlePassword) {
          onSecrets?.([
            {
              label: S.moodlePassword,
              value: result.oneTime.generatedMoodlePassword,
            },
          ]);
        }
      }
      await invalidate("/api/ncc/admissions/students");
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
  const show = (message: string | null) => (attempted ? message : null);

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={student ? S.editTitle : S.createTitle}
      description={student ? S.editDescription : S.createDescription}
      dirty={JSON.stringify(draft) !== JSON.stringify(initial)}
      saving={saving}
      fieldErrors={fieldErrors}
      saveLabel={student ? copy.catalog.shared.saveChanges : S.createSubmit}
      onSubmit={() =>
        runAction(submit, {
          success: student ? S.updatedToast : S.createdToast,
        })
      }
    >
      {errorFor => (
        <>
          <div className="grid grid-cols-2 gap-3">
            <StaffField
              label={L.firstName}
              htmlFor="student-first"
              error={show(errors.firstName) ?? errorFor("first_name")}
            >
              <input
                id="student-first"
                className="staff-input"
                value={draft.firstName}
                onChange={event => set("firstName", event.target.value)}
              />
            </StaffField>
            <StaffField
              label={L.lastName}
              htmlFor="student-last"
              error={show(errors.lastName) ?? errorFor("last_name")}
            >
              <input
                id="student-last"
                className="staff-input"
                value={draft.lastName}
                onChange={event => set("lastName", event.target.value)}
              />
            </StaffField>
          </div>
          <StaffField
            label={L.email}
            htmlFor="student-email"
            error={show(errors.email) ?? errorFor("email")}
          >
            <input
              id="student-email"
              type="email"
              className="staff-input staff-ltr"
              value={draft.email}
              onChange={event => set("email", event.target.value)}
            />
          </StaffField>
          <StaffField
            label={L.phone}
            htmlFor="student-phone"
            error={errorFor("phone")}
          >
            <input
              id="student-phone"
              type="tel"
              className="staff-input staff-ltr"
              value={draft.phone}
              onChange={event => set("phone", event.target.value)}
            />
          </StaffField>
          {superAdmin ? (
            <StaffField
              label={S.branch}
              error={show(errors.branchId) ?? errorFor("home_branch_id")}
            >
              <Select
                value={draft.branchId || undefined}
                onValueChange={value => set("branchId", value)}
              >
                <SelectTrigger aria-label={S.branch}>
                  <SelectValue placeholder={L.chooseBranch} />
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
          {canSetAssignee(role) ? (
            <StaffField label={S.owner} error={errorFor("assigned_ssa_id")}>
              <Select
                value={draft.assignedSsaId || NONE}
                onValueChange={value =>
                  set("assignedSsaId", value === NONE ? "" : value)
                }
              >
                <SelectTrigger aria-label={S.owner}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{L.unassigned}</SelectItem>
                  {assignees.map(person => (
                    <SelectItem key={person.id} value={person.id}>
                      {person.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </StaffField>
          ) : null}
          {!student ? (
            <div className="grid grid-cols-2 gap-3">
              <StaffField
                label={`${S.registration} · ${$.toBePaid}`}
                htmlFor="student-fee"
                error={show(errors.toBePaid) ?? errorFor("registration")}
              >
                <input
                  id="student-fee"
                  inputMode="decimal"
                  className="staff-input staff-figures"
                  value={draft.toBePaid}
                  onChange={event => set("toBePaid", event.target.value)}
                />
              </StaffField>
              <StaffField
                label={$.paid}
                htmlFor="student-paid"
                error={show(errors.paid)}
              >
                <input
                  id="student-paid"
                  inputMode="decimal"
                  className="staff-input staff-figures"
                  value={draft.paid}
                  onChange={event => set("paid", event.target.value)}
                />
              </StaffField>
            </div>
          ) : null}
          <IdentityFields
            value={draft.identity}
            onChange={identity => set("identity", identity)}
            attempted={attempted}
            errorFor={errorFor}
          />
          <StaffField
            label={S.note}
            htmlFor="student-note"
            error={errorFor("note")}
          >
            <textarea
              id="student-note"
              className="staff-input"
              rows={3}
              value={draft.note}
              onChange={event => set("note", event.target.value)}
            />
          </StaffField>
        </>
      )}
    </FormSheet>
  );
}
