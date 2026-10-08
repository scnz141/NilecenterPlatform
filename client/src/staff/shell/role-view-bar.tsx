import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Eye, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/staff/ui/kit";
import type { NccRole, NccSessionScopeOptionsDto } from "@/lib/backend/api";
import { useNcc } from "../api";
import { copy } from "../copy";
import { roleLabel } from "../roles";
import { switchableRoles } from "../nav";
import { useStaffSession } from "../session";
import { runAction } from "../run-action";
import { MultiSelect } from "../ui/multi-select";

function toOptions(list: { id: string; label: string }[]) {
  return list.map(item => ({ value: item.id, label: item.label }));
}

/**
 * Top-bar chip shown while activeRole ≠ assignedRole: who you are viewing as,
 * the scope in words, and a one-click way back. The popover owns role and
 * scope editing. Scope options are only fetched while viewing as another
 * role, so the provider's scope-options denial never fires in normal use.
 */
export function RoleViewChip() {
  const { session, switchRole, setScopes } = useStaffSession();
  const ncc = session?.ncc;
  const actingDown = Boolean(ncc && ncc.activeRole !== ncc.assignedRole);
  // useNcc is skipped while actingDown is false; the bar is also unmounted
  // below, so options only load for a switched session.
  const { data: options } = useNcc<NccSessionScopeOptionsDto>(
    actingDown ? "/api/ncc/auth/session-scope-options" : null
  );
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const effective = ncc?.effectiveScopes;
  const [branchId, setBranchId] = useState("");
  const [branchIds, setBranchIds] = useState<string[]>([]);
  const [departmentIds, setDepartmentIds] = useState<string[]>([]);
  const [classIds, setClassIds] = useState<string[]>([]);

  useEffect(() => {
    setBranchId(effective?.branchIds?.[0] ?? ncc?.workspaceBranchId ?? "");
    setBranchIds(
      effective?.branchIds ??
        (ncc?.workspaceBranchId ? [ncc.workspaceBranchId] : [])
    );
    setDepartmentIds(effective?.departmentIds ?? []);
    setClassIds(effective?.classIds ?? []);
  }, [
    effective?.branchIds,
    effective?.departmentIds,
    effective?.classIds,
    ncc?.workspaceBranchId,
  ]);

  const targets = useMemo(
    () => (ncc ? switchableRoles(ncc.assignedRole) : []),
    [ncc]
  );

  if (!ncc || !actingDown) return null;

  const role = ncc.activeRole;
  const branchOptions = toOptions(options?.branches ?? []);
  const departmentOptions = toOptions(options?.departments ?? []);
  const classOptions = toOptions(options?.classes ?? []);

  const currentBranchId =
    effective?.branchIds?.[0] ?? ncc.workspaceBranchId ?? "";
  const currentBranchIds =
    effective?.branchIds ??
    (ncc.workspaceBranchId ? [ncc.workspaceBranchId] : []);
  const dirty = (() => {
    switch (role) {
      case "branch_admin":
        return (
          JSON.stringify(branchIds.slice().sort()) !==
          JSON.stringify(currentBranchIds.slice().sort())
        );
      case "hod":
        return (
          JSON.stringify(departmentIds.slice().sort()) !==
          JSON.stringify((effective?.departmentIds ?? []).slice().sort())
        );
      case "vice_manager":
      case "registrar":
      case "ssa":
        return branchId !== currentBranchId;
      case "teacher":
        return (
          branchId !== currentBranchId ||
          JSON.stringify(classIds.slice().sort()) !==
            JSON.stringify((effective?.classIds ?? []).slice().sort())
        );
      default:
        return false;
    }
  })();

  function apply() {
    const scopes =
      role === "branch_admin"
        ? { branchIds }
        : role === "hod"
          ? { departmentIds }
          : role === "teacher"
            ? {
                branchId: branchId || null,
                classIds,
                courseIds: effective?.courseIds ?? [],
              }
            : { branchId: branchId || null };
    setBusy(true);
    void runAction(() => setScopes(scopes), {
      success: copy.shell.scopesApplied,
    }).finally(() => {
      setBusy(false);
      setOpen(false);
    });
  }

  function returnToAssigned() {
    setBusy(true);
    void runAction(() => switchRole(ncc!.assignedRole), {
      success: copy.shell.roleViewEnded,
    }).finally(() => setBusy(false));
  }

  const branchSingle = (
    <Select
      value={branchId || undefined}
      onValueChange={value => setBranchId(value ?? "")}
      disabled={busy}
    >
      <SelectTrigger size="sm" aria-label={copy.shell.scopeBranch}>
        <SelectValue placeholder={copy.shell.scopeBranch} />
      </SelectTrigger>
      <SelectContent>
        {branchOptions.map(option => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const labelOf = (list: { value: string; label: string }[], ids: string[]) =>
    ids.length === 0
      ? null
      : ids.length === 1
        ? (list.find(option => option.value === ids[0])?.label ?? null)
        : `${ids.length} ${role === "hod" ? copy.shell.departmentsNoun : copy.shell.branchesNoun}`;
  const scopeText =
    role === "hod"
      ? labelOf(departmentOptions, effective?.departmentIds ?? [])
      : role === "branch_admin"
        ? labelOf(branchOptions, currentBranchIds)
        : labelOf(branchOptions, currentBranchId ? [currentBranchId] : []);

  return (
    <div className="staff-roleview" role="region" aria-label={copy.shell.roleView}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" className="staff-roleview-chip" aria-haspopup="dialog">
            <Eye className="staff-roleview-icon" strokeWidth={1.75} aria-hidden />
            <span className="staff-roleview-text">
              <span className="staff-roleview-prefix">{copy.shell.viewingAs}</span>{" "}
              <strong>{roleLabel(role)}</strong>
              {scopeText ? <span className="staff-roleview-scope"> · {scopeText}</span> : null}
            </span>
            <ChevronDown className="staff-roleview-caret" strokeWidth={1.75} aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" sideOffset={8} className="staff-roleview-panel">
          <p className="staff-roleview-title">{copy.shell.viewingAs}</p>
          <div className="staff-roleview-roles" role="radiogroup" aria-label={copy.shell.viewingAs}>
            {[ncc.assignedRole, ...targets].map(item => (
              <button
                key={item}
                type="button"
                role="radio"
                aria-checked={item === role}
                className="staff-roleview-role"
                data-on={item === role || undefined}
                disabled={busy}
                onClick={() => {
                  if (item === role) return;
                  setBusy(true);
                  void runAction(() => switchRole(item), {
                    success:
                      item === ncc.assignedRole
                        ? copy.shell.roleViewEnded
                        : `${copy.shell.roleViewChanged} ${roleLabel(item)}.`,
                  }).finally(() => setBusy(false));
                }}
              >
                {roleLabel(item)}
                {item === ncc.assignedRole ? <span className="staff-muted">&nbsp;· {copy.shell.ownRole}</span> : null}
              </button>
            ))}
          </div>
          <div className="staff-roleview-scopes">
            {role === "branch_admin" ? (
              <MultiSelect
                size="sm"
                options={branchOptions}
                value={branchIds}
                onChange={setBranchIds}
                allLabel={copy.shell.allBranches}
                noun={copy.shell.branchesNoun}
                searchPlaceholder={copy.shell.searchBranches}
                ariaLabel={copy.shell.scopeBranches}
              />
            ) : null}
            {role === "hod" ? (
              <MultiSelect
                size="sm"
                options={departmentOptions}
                value={departmentIds}
                onChange={setDepartmentIds}
                allLabel={copy.shell.allDepartments}
                noun={copy.shell.departmentsNoun}
                searchPlaceholder={copy.shell.searchDepartments}
                ariaLabel={copy.shell.scopeDepartments}
              />
            ) : null}
            {role === "vice_manager" || role === "registrar" || role === "ssa" ? branchSingle : null}
            {role === "teacher" ? (
              <>
                {branchSingle}
                <MultiSelect
                  size="sm"
                  options={classOptions}
                  value={classIds}
                  onChange={setClassIds}
                  allLabel={copy.shell.allClasses}
                  noun={copy.shell.classesNoun}
                  searchPlaceholder={copy.shell.searchClasses}
                  ariaLabel={copy.shell.scopeClasses}
                />
              </>
            ) : null}
            <button
              type="button"
              className="staff-btn"
              data-variant="primary"
              data-size="sm"
              disabled={!dirty || busy}
              onClick={apply}
            >
              {copy.shell.applyScopes}
            </button>
          </div>
        </PopoverContent>
      </Popover>
      <button
        type="button"
        className="staff-roleview-exit"
        onClick={returnToAssigned}
        disabled={busy}
        aria-label={copy.shell.returnToRole}
        title={copy.shell.returnToRole}
      >
        <X strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
}
