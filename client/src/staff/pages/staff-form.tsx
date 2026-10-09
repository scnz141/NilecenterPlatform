import { useEffect, useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/staff/ui/kit";
import {
  createNccStaffUserRequest,
  fetchNccDirectoryUserRequest,
  patchNccStaffUserRequest,
  type NccBranchDto,
  type NccCourseDto,
  type NccDepartmentDto,
  type NccRole,
  type NccStaffUserDto,
} from "@/lib/backend/api";
import { staffWrite, useInvalidate, useNcc } from "../api";
import { copy } from "../copy";
import { dobError } from "../date-of-birth";
import { canReadBranches, canReadDepartments, roleLabel } from "../roles";
import { FormValidationError, runAction } from "../run-action";
import { useStaffSession } from "../session";
import {
  CustomFieldsEditor,
  type CustomFieldValues,
} from "../ui/custom-fields-editor";
import { DateOfBirthField } from "../ui/date-of-birth-field";
import { FormSheet, StaffField } from "../ui/form-sheet";
import { MultiSelect } from "../ui/multi-select";
import type { StaffSecret } from "../ui/secret-dialog";

const C = copy.staffUsers;

const SA_ROLES: NccRole[] = [
  "super_admin",
  "branch_admin",
  "vice_manager",
  "hod",
  "registrar",
  "ssa",
  "teacher",
];
const BA_ROLES: NccRole[] = [
  "vice_manager",
  "hod",
  "registrar",
  "ssa",
  "teacher",
];
const VM_ROLES: NccRole[] = ["hod", "registrar", "ssa", "teacher"];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * Create/edit staff sheet matching `User_Create_Request` / `User_Patch_Request`.
 * Super Admin targets (create, promote, demote) require the caller's own
 * password as `caller_password` per the EMS contract.
 */
export function StaffForm({
  open,
  onOpenChange,
  user,
  onSecrets,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: NccStaffUserDto | null;
  /** Receives one-time secrets produced by a create (invitation link/password). */
  onSecrets: (secrets: StaffSecret[]) => void;
}) {
  const { session } = useStaffSession();
  const invalidate = useInvalidate();
  const isEdit = Boolean(user);
  const callerRole = session?.ncc?.activeRole ?? null;
  const callerIsSuper = callerRole === "super_admin";
  const callerIsBa = callerRole === "branch_admin";
  const callerIsVm = callerRole === "vice_manager";
  const workspaceId = session?.ncc?.workspaceBranchId ?? null;

  const branches = useNcc<{ items: NccBranchDto[] }>(
    open && canReadBranches(callerRole) ? "/api/ncc/directory/branches" : null
  );
  const departments = useNcc<{ items: NccDepartmentDto[] }>(
    open && canReadDepartments(callerRole)
      ? "/api/ncc/directory/departments"
      : null
  );
  const courses = useNcc<{ items: NccCourseDto[] }>(
    open ? "/api/ncc/delivery/courses" : null
  );

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [nationality, setNationality] = useState("");
  const [address, setAddress] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [notes, setNotes] = useState("");
  const [role, setRole] = useState<NccRole>("registrar");
  const [provisioning, setProvisioning] = useState<"invitation" | "manual">(
    "invitation"
  );
  const [canTakePlacement, setCanTakePlacement] = useState(false);
  const [branchScopes, setBranchScopes] = useState<string[]>([]);
  const [deptIds, setDeptIds] = useState<string[]>([]);
  const [courseIds, setCourseIds] = useState<string[]>([]);
  const [customValues, setCustomValues] = useState<CustomFieldValues>({});
  const [callerPassword, setCallerPassword] = useState("");
  const [detailUser, setDetailUser] = useState<NccStaffUserDto | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] =
    useState<Record<string, string[]>>();

  useEffect(() => {
    if (!open) return;
    setAttempted(false);
    setFieldErrors(undefined);
    let cancelled = false;
    async function load() {
      // The detail payload adds custom_fields; fall back to the row on error.
      const result = user
        ? await fetchNccDirectoryUserRequest(user.id)
        : null;
      const source = result?.ok ? result.data?.user ?? null : user ?? null;
      if (cancelled) return;
      setDetailUser(source);
      setFirstName(source?.firstName ?? "");
      setLastName(source?.lastName ?? "");
      setEmail(source?.email ?? "");
      setPhone(source?.phone ?? "");
      setNationality(source?.nationality ?? "");
      setAddress(source?.address ?? "");
      setDateOfBirth(source?.dateOfBirth ?? "");
      setNotes(source?.notes ?? "");
      setRole(source?.emsRole ?? (callerIsSuper ? "registrar" : "teacher"));
      setCanTakePlacement(Boolean(source?.canTakePlacementTest));
      setProvisioning("invitation");
      setBranchScopes(
        !source && !callerIsSuper && workspaceId
          ? [workspaceId]
          : (source?.branchIds ?? [])
      );
      setDeptIds((source?.departments ?? []).map(d => d.id));
      setCourseIds(source?.courseIds ?? []);
      setCustomValues({ ...(source?.customFields ?? {}) });
      setCallerPassword("");
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [open, user, callerIsSuper, workspaceId]);

  const roleOptions = callerIsSuper ? SA_ROLES : callerIsBa ? BA_ROLES : VM_ROLES;
  const needsBranchScope = role !== "super_admin";
  // HOD may have empty branch scopes; VM always needs exactly one.
  const requiresBranchScope =
    role === "vice_manager" ||
    role === "registrar" ||
    role === "ssa" ||
    role === "teacher";
  const currentRole = (detailUser ?? user)?.emsRole;
  const creatingSa = !isEdit && role === "super_admin";
  const promotingToSa =
    isEdit && currentRole !== "super_admin" && role === "super_admin";
  const demotingFromSa =
    isEdit && currentRole === "super_admin" && role !== "super_admin";
  const stepUpPassword = creatingSa || promotingToSa || demotingFromSa;
  const needsDepartments = callerIsSuper && role === "hod";
  const needsCourses =
    role === "teacher" && (callerIsSuper || callerIsBa || callerIsVm);

  const firstNameErr = firstName.trim() ? null : C.firstNameRequired;
  const lastNameErr = lastName.trim() ? null : C.lastNameRequired;
  const emailErr = EMAIL_PATTERN.test(email.trim()) ? null : C.emailRequired;
  const branchScopeErr =
    role === "vice_manager" && branchScopes.length !== 1
      ? C.viceManagerScope
      : requiresBranchScope && branchScopes.length === 0
        ? C.branchScopeRequired
        : !callerIsSuper &&
            workspaceId &&
            !branchScopes.includes(workspaceId)
          ? C.workspaceScopeHint
          : null;
  const callerPasswordErr =
    stepUpPassword && !callerPassword ? C.yourPasswordRequired : null;
  const dobCode = dobError(dateOfBirth);
  const dateOfBirthErr = dobCode ? copy.dateOfBirth[dobCode] : null;

  const branchChoices = (branches.data?.items ?? []).filter(
    branch =>
      branch.status === "active" ||
      branchScopes.includes(branch.id) ||
      branch.id === workspaceId
  );
  const branchOptions = (() => {
    const options = branchChoices.map(branch => ({
      value: branch.id,
      label:
        !callerIsSuper && branch.id === workspaceId
          ? `${branch.name} (${copy.shell.workspace})`
          : branch.name,
    }));
    const known = new Set(options.map(option => option.value));
    const names = new Map(
      (branches.data?.items ?? []).map(branch => [branch.id, branch.name])
    );
    for (const id of branchScopes) {
      if (known.has(id)) continue;
      options.push({ value: id, label: names.get(id) ?? id });
      known.add(id);
    }
    return options;
  })();

  const departmentOptions = (() => {
    const all = departments.data?.items ?? [];
    const options = all
      .filter(d => d.status === "active" || deptIds.includes(d.id))
      .map(d => ({ value: d.id, label: d.name }));
    const known = new Set(options.map(option => option.value));
    const names = new Map(all.map(d => [d.id, d.name]));
    for (const id of deptIds) {
      if (known.has(id)) continue;
      options.push({ value: id, label: names.get(id) ?? id });
      known.add(id);
    }
    return options;
  })();

  const courseOptions = (() => {
    const all = courses.data?.items ?? [];
    const options = all
      .filter(c => c.status === "active" || courseIds.includes(c.id))
      .map(c => ({
        value: c.id,
        label: c.displayName ?? c.fullname ?? c.shortname,
      }));
    const known = new Set(options.map(option => option.value));
    for (const id of courseIds) {
      if (known.has(id)) continue;
      options.push({ value: id, label: id });
      known.add(id);
    }
    return options;
  })();

  const dirty = useMemo(() => {
    const source = detailUser ?? user ?? null;
    return (
      firstName !== (source?.firstName ?? "") ||
      lastName !== (source?.lastName ?? "") ||
      email !== (source?.email ?? "") ||
      phone !== (source?.phone ?? "") ||
      nationality !== (source?.nationality ?? "") ||
      address !== (source?.address ?? "") ||
      dateOfBirth !== (source?.dateOfBirth ?? "") ||
      notes !== (source?.notes ?? "") ||
      role !== (source?.emsRole ?? (callerIsSuper ? "registrar" : "teacher")) ||
      canTakePlacement !== Boolean(source?.canTakePlacementTest) ||
      JSON.stringify(branchScopes) !==
        JSON.stringify(source?.branchIds ?? []) ||
      JSON.stringify(deptIds) !==
        JSON.stringify((source?.departments ?? []).map(d => d.id)) ||
      JSON.stringify(courseIds) !==
        JSON.stringify(source?.courseIds ?? []) ||
      callerPassword.length > 0
    );
  }, [
    detailUser,
    user,
    firstName,
    lastName,
    email,
    phone,
    nationality,
    address,
    dateOfBirth,
    notes,
    role,
    canTakePlacement,
    branchScopes,
    deptIds,
    courseIds,
    callerPassword,
    callerIsSuper,
  ]);

  async function submit() {
    setAttempted(true);
    if (
      firstNameErr ||
      lastNameErr ||
      emailErr ||
      branchScopeErr ||
      callerPasswordErr ||
      dateOfBirthErr
    ) {
      throw new FormValidationError();
    }
    setSaving(true);
    setFieldErrors(undefined);
    try {
      const profile = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: blankToNull(phone),
        nationality: blankToNull(nationality)?.toUpperCase() ?? null,
        address: blankToNull(address),
        dateOfBirth: blankToNull(dateOfBirth),
        notes: blankToNull(notes),
      };
      if (isEdit && user) {
        await staffWrite(
          patchNccStaffUserRequest(user.id, {
            email: email.trim(),
            role,
            profile,
            branchIds: role === "super_admin" ? undefined : branchScopes,
            departmentIds: needsDepartments ? deptIds : undefined,
            courseIds: needsCourses ? courseIds : undefined,
            canTakePlacementTest: canTakePlacement,
            customFields: customValues,
            callerPassword: callerPassword || undefined,
          })
        );
      } else {
        const result = await staffWrite(
          createNccStaffUserRequest({
            email: email.trim(),
            role,
            provisioning,
            profile,
            branchIds: role === "super_admin" ? undefined : branchScopes,
            departmentIds: needsDepartments ? deptIds : undefined,
            courseIds: needsCourses ? courseIds : undefined,
            canTakePlacementTest: canTakePlacement,
            customFields: customValues,
            callerPassword: callerPassword || undefined,
          })
        );
        const secrets: StaffSecret[] = [];
        const origin = window.location.origin;
        if (result.oneTime.invitationPath) {
          secrets.push({
            label: C.invitationLink,
            value: `${origin}${result.oneTime.invitationPath}`,
          });
        }
        if (result.oneTime.generatedPassword) {
          secrets.push({
            label: C.temporaryPassword,
            value: result.oneTime.generatedPassword,
          });
        }
        if (secrets.length) onSecrets(secrets);
      }
      await invalidate("/api/ncc/directory/users");
      onOpenChange(false);
    } catch (error) {
      const details = (error as { details?: Record<string, string[]> })
        .details;
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
      title={isEdit ? C.editTitle : C.createTitle}
      description={isEdit ? C.editDescription : C.createDescription}
      dirty={dirty}
      saving={saving}
      fieldErrors={fieldErrors}
      saveLabel={
        isEdit ? copy.catalog.shared.saveChanges : C.createSubmit
      }
      onSubmit={() =>
        runAction(submit, {
          success: isEdit ? C.updatedToast : C.createdToast,
        })
      }
    >
      {errorFor => (
        <>
          <div className="grid grid-cols-2 gap-3">
            <StaffField label={C.firstName} error={errorFor("profile") ?? (attempted ? firstNameErr : null)}>
              <input
                className="staff-input"
                value={firstName}
                onChange={event => setFirstName(event.target.value)}
                autoComplete="given-name"
              />
            </StaffField>
            <StaffField label={C.lastName} error={attempted ? lastNameErr : null}>
              <input
                className="staff-input"
                value={lastName}
                onChange={event => setLastName(event.target.value)}
                autoComplete="family-name"
              />
            </StaffField>
          </div>
          <StaffField
            label={C.email}
            error={errorFor("email") ?? (attempted || email.trim() ? emailErr : null)}
          >
            <input
              type="email"
              className="staff-input"
              value={email}
              onChange={event => setEmail(event.target.value)}
              autoComplete="email"
            />
          </StaffField>

          {(callerIsSuper || !isEdit) && (
            <StaffField label={C.role} error={errorFor("assigned_role")}>
              <Select
                value={role}
                onValueChange={value =>
                  value && setRole(value as NccRole)
                }
                disabled={isEdit && !callerIsSuper}
              >
                <SelectTrigger className="w-full" aria-label={C.role}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map(option => (
                    <SelectItem key={option} value={option}>
                      {roleLabel(option)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!callerIsSuper ? (
                <span className="staff-muted text-xs">
                  {callerIsBa
                    ? "Branch Admin creates Vice Manager, HOD, Registrar, SSA, or Teacher."
                    : "Vice Manager creates HOD, Registrar, SSA, or Teacher."}
                </span>
              ) : null}
            </StaffField>
          )}

          {!isEdit && (
            <StaffField label={C.provisioning} error={errorFor("provisioning")}>
              <Select
                value={provisioning}
                onValueChange={value =>
                  value && setProvisioning(value as "invitation" | "manual")
                }
              >
                <SelectTrigger className="w-full" aria-label={C.provisioning}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="invitation">
                    {C.provisioningInvitation}
                  </SelectItem>
                  <SelectItem value="manual">
                    {C.provisioningManual}
                  </SelectItem>
                </SelectContent>
              </Select>
              <span className="staff-muted text-xs">{C.provisioningHint}</span>
            </StaffField>
          )}

          {needsBranchScope && (
            <StaffField
              label={C.branchScope}
              error={attempted ? branchScopeErr : null}
            >
              <MultiSelect
                options={branchOptions}
                value={branchScopes}
                onChange={setBranchScopes}
                allLabel={C.allBranches}
                noun={copy.shell.branchesNoun}
                searchPlaceholder={copy.shell.searchBranches}
                ariaLabel={C.branchScope}
              />
              <span className="staff-muted text-xs">{C.branchScopeHint}</span>
            </StaffField>
          )}

          {needsDepartments && (
            <StaffField label={C.departments} error={errorFor("departments")}>
              <MultiSelect
                options={departmentOptions}
                value={deptIds}
                onChange={setDeptIds}
                allLabel={C.allDepartments}
                noun={copy.shell.departmentsNoun}
                searchPlaceholder={copy.shell.searchDepartments}
                ariaLabel={C.departments}
              />
            </StaffField>
          )}

          {needsCourses && (
            <StaffField label={C.courses} error={errorFor("course_ids")}>
              <MultiSelect
                options={courseOptions}
                value={courseIds}
                onChange={setCourseIds}
                allLabel={C.coursesTitle}
                noun="courses"
                searchPlaceholder={C.coursesSearchPlaceholder}
                ariaLabel={C.courses}
              />
              <span className="staff-muted text-xs">{C.coursesHint}</span>
            </StaffField>
          )}

          <StaffField label={C.canTakePlacementTest}>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={canTakePlacement}
                onChange={event => setCanTakePlacement(event.target.checked)}
              />
              {C.placementYes}
            </label>
          </StaffField>

          <StaffField label={C.phone} error={errorFor("profile")}>
            <input
              className="staff-input"
              value={phone}
              onChange={event => setPhone(event.target.value)}
              autoComplete="tel"
            />
          </StaffField>
          <StaffField label={C.nationality}>
            <input
              className="staff-input"
              value={nationality}
              maxLength={3}
              onChange={event => setNationality(event.target.value)}
            />
            <span className="staff-muted text-xs">{C.nationalityHint}</span>
          </StaffField>
          <DateOfBirthField
            label={C.dateOfBirth}
            value={dateOfBirth}
            onChange={setDateOfBirth}
            error={attempted ? dateOfBirthErr : null}
            optional
          />
          <StaffField label={C.address}>
            <textarea
              className="staff-input"
              rows={2}
              value={address}
              onChange={event => setAddress(event.target.value)}
            />
          </StaffField>
          <StaffField label={C.notes}>
            <textarea
              className="staff-input"
              rows={2}
              value={notes}
              onChange={event => setNotes(event.target.value)}
            />
          </StaffField>

          <CustomFieldsEditor
            entityType="user_profile"
            value={customValues}
            onChange={setCustomValues}
          />

          {stepUpPassword && (
            <StaffField
              label={C.yourPassword}
              error={attempted ? callerPasswordErr : null}
            >
              <input
                type="password"
                className="staff-input"
                value={callerPassword}
                onChange={event => setCallerPassword(event.target.value)}
                autoComplete="current-password"
              />
              <span className="staff-muted text-xs">{C.yourPasswordHint}</span>
            </StaffField>
          )}
        </>
      )}
    </FormSheet>
  );
}
