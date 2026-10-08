import { useEffect, useMemo, useState } from "react";
import { Copy, ExternalLink, Plus } from "lucide-react";
import { toast } from "sonner";
import { formContentHasRecordLinks, type FormAssignment, type FormAssignmentTarget, type FormPublication, type FormRespondentRole, type FormVersion } from "@shared/nileForms";
import type { NccClassDto, NccStaffUserDto } from "@/lib/backend/api";
import {
  assignFormPublicationRequest,
  publishFormVersionRequest,
  retireFormPublicationRequest,
  revokeFormAssignmentRequest,
} from "@/lib/forms/api";
import type { FormDefinitionBundle } from "../../../../server/nileFormsService";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/staff/ui/kit";
import { copy } from "../copy";
import { useNcc } from "../api";
import { SLUG_PATTERN, toSlug } from "../forms/model";
import { formsWrite } from "../forms/write";
import { formatDateTime } from "../i18n";
import { canReadStaffDirectory, roleLabel } from "../roles";
import { FormValidationError, runAction } from "../run-action";
import { useStaffSession } from "../session";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { FormSheet, StaffField } from "../ui/form-sheet";
import { ActiveMark, StatusBadge } from "../ui/primitives";
import { useBranches } from "./admissions-ui";
import { useDepartments } from "./course-form";

const F = copy.forms;
const PUBLICATION_TONE: Record<FormPublication["status"], string> = {
  scheduled: "pending",
  open: "active",
  closed: "disabled",
  retired: "disabled",
};
const AUDIENCES: FormPublication["audience"][] = ["public", "authenticated", "assigned"];
const audienceLabel = (audience: FormPublication["audience"]) =>
  audience === "public" ? F.audiencePublic : audience === "authenticated" ? F.audienceAuthenticated : F.audienceAssigned;

export const publicLink = (slug: string) => `${window.location.origin}/forms/${slug}`;

/* ---------------- Publish ------------------------------------------- */

function PublishSheet({
  open,
  onOpenChange,
  bundle,
  draft,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bundle: FormDefinitionBundle;
  draft: FormVersion;
  onDone: () => Promise<unknown>;
}) {
  const live = bundle.publications.find(item => item.status === "open" || item.status === "scheduled");
  const [slug, setSlug] = useState("");
  const [audience, setAudience] = useState<FormPublication["audience"]>("public");
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [allowDrafts, setAllowDrafts] = useState(true);
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!open) return;
    // A new version keeps the live link's settings; the link name must be new.
    setSlug(live ? `${live.slug}-v${draft.versionNumber}` : toSlug(bundle.definition.title));
    setAudience(live?.audience ?? (bundle.definition.category === "admissions" ? "public" : "assigned"));
    setOpensAt("");
    setClosesAt("");
    setAllowMultiple(live?.allowMultiple ?? false);
    setAllowDrafts(live?.allowDrafts ?? true);
    setAttempted(false);
  }, [open, live, draft.versionNumber, bundle.definition]);

  const slugError = SLUG_PATTERN.test(slug) ? null : F.slugHint;
  const rangeError = opensAt && closesAt && closesAt <= opensAt ? copy.teaching.classes.endBeforeStart : null;

  async function submit() {
    setAttempted(true);
    if (slugError || rangeError) throw new FormValidationError();
    setSaving(true);
    try {
      await formsWrite(
        publishFormVersionRequest(bundle.definition.id, draft.id, {
          slug,
          audience,
          ...(opensAt ? { opensAt: new Date(opensAt).toISOString() } : {}),
          ...(closesAt ? { closesAt: new Date(closesAt).toISOString() } : {}),
          allowMultiple,
          allowDrafts,
        })
      );
      await onDone();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={F.publishTitle}
      description={F.publishDescription}
      dirty={false}
      saving={saving}
      saveLabel={F.publishSubmit}
      onSubmit={() => runAction(submit, { success: F.publishedToast })}
    >
      <StaffField label={F.slug} htmlFor="form-slug" error={attempted ? slugError : null}>
        <input
          id="form-slug"
          className="staff-input staff-ltr"
          value={slug}
          onChange={event => setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
        />
        <span className="staff-hint staff-ltr">{publicLink(slug || "…")}</span>
      </StaffField>
      <fieldset className="staff-field">
        <legend className="staff-field-label">{F.audience}</legend>
        <div className="staff-choice-list" role="radiogroup" aria-label={F.audience}>
          {AUDIENCES.map(value => (
            <label key={value} className="staff-choice">
              <input type="radio" name="form-audience" checked={audience === value} onChange={() => setAudience(value)} />
              <span className="staff-choice-body">
                <span className="staff-choice-title">{audienceLabel(value)}</span>
                <span className="staff-muted">
                  {value === "public" ? F.audiencePublicHint : value === "authenticated" ? F.audienceAuthenticatedHint : F.audienceAssignedHint}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <StaffField label={F.opensAt} htmlFor="form-opens">
          <input id="form-opens" type="datetime-local" className="staff-input" value={opensAt} onChange={event => setOpensAt(event.target.value)} />
        </StaffField>
        <StaffField label={F.closesAt} htmlFor="form-closes" error={attempted ? rangeError : null}>
          <input id="form-closes" type="datetime-local" className="staff-input" value={closesAt} onChange={event => setClosesAt(event.target.value)} />
        </StaffField>
      </div>
      <label className="staff-check">
        <input type="checkbox" checked={allowMultiple} onChange={event => setAllowMultiple(event.target.checked)} />
        {F.allowMultiple}
      </label>
      <label className="staff-check">
        <input type="checkbox" checked={allowDrafts} onChange={event => setAllowDrafts(event.target.checked)} />
        {F.allowDrafts}
      </label>
    </FormSheet>
  );
}

/* ---------------- Assign -------------------------------------------- */

/** One checkable person row — shared by the staff list and class teachers. */
function PersonPickRow({
  name,
  meta,
  checked,
  onToggle,
}: {
  name: string;
  meta: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="staff-people-row" data-active={checked}>
      <input type="checkbox" checked={checked} onChange={onToggle} />
      <span className="staff-person-meta">
        <span className="staff-person-name" title={name}>
          {name}
        </span>
        <span className="staff-person-email" title={meta}>
          {meta}
        </span>
      </span>
    </label>
  );
}

function AssignSheet({
  publication,
  bundle,
  onOpenChange,
  onDone,
}: {
  publication: FormPublication | null;
  bundle: FormDefinitionBundle;
  onOpenChange: (open: boolean) => void;
  onDone: () => Promise<unknown>;
}) {
  const { session } = useStaffSession();
  const superAdmin = session?.activeRole === "superadmin";
  const branches = useBranches();
  const departments = useDepartments(publication !== null);
  const staffPickEnabled = Boolean(
    session?.ncc && canReadStaffDirectory(session.ncc.activeRole)
  );
  // Every EMS staff role can read classes through the BFF within its scope.
  const classPickEnabled = Boolean(session?.ncc);
  const peopleEnabled = staffPickEnabled || classPickEnabled;
  const directory = useNcc<{ items: NccStaffUserDto[] }>(
    publication !== null && staffPickEnabled ? "/api/ncc/directory/users" : null
  );
  const classesResult = useNcc<{ items: NccClassDto[] }>(
    publication !== null && classPickEnabled ? "/api/ncc/delivery/classes" : null
  );
  const activeClasses = useMemo(
    () =>
      (classesResult.data?.items ?? []).filter(item => item.status === "active"),
    [classesResult.data]
  );
  const [type, setType] = useState<"role" | "branch" | "department" | "people">(
    "role"
  );
  const [value, setValue] = useState("");
  const [expires, setExpires] = useState("");
  const [saving, setSaving] = useState(false);
  const [peopleMode, setPeopleMode] = useState<"staff" | "class">("staff");
  const [staffSearch, setStaffSearch] = useState("");
  const [peoplePicks, setPeoplePicks] = useState<Map<string, string>>(
    () => new Map()
  );
  const [classId, setClassId] = useState("");
  const [classPicks, setClassPicks] = useState<Map<string, string>>(
    () => new Map()
  );
  const [failures, setFailures] = useState<
    Array<{ name: string; reason: string }>
  >([]);
  useEffect(() => {
    setType("role");
    setValue("");
    setExpires("");
    setPeopleMode("staff");
    setStaffSearch("");
    setPeoplePicks(new Map());
    setClassId("");
    setClassPicks(new Map());
    setFailures([]);
  }, [publication?.id]);

  const effectivePeopleMode = staffPickEnabled ? peopleMode : "class";
  const staffOptions = useMemo(() => {
    const items = (directory.data?.items ?? []).filter(user => user.isActive);
    const query = staffSearch.trim().toLowerCase();
    if (!query) return items;
    return items.filter(user =>
      `${user.name} ${user.email}`.toLowerCase().includes(query)
    );
  }, [directory.data, staffSearch]);
  const selectedClass = activeClasses.find(item => item.id === classId);
  const peoplePicksActive =
    effectivePeopleMode === "staff" ? peoplePicks : classPicks;

  const roles = bundle.assignmentOptions.roles.map(option => ({ value: option.id, label: F.roles[option.id] ?? option.label }));
  const branchOptions = branches.active
    .filter(branch => superAdmin || (session?.branchIds ?? []).includes(branch.id))
    .filter(branch => !bundle.definition.branchId || branch.id === bundle.definition.branchId)
    .map(branch => ({ value: branch.id, label: branch.name }));
  // Only Super Admin can read the department directory; everyone else gets
  // department names from the classes list (HOD stays inside session scope).
  const departmentOptions = useMemo(() => {
    const names = new Map(departments.map(item => [item.id, item.name]));
    for (const item of activeClasses) {
      if (!names.has(item.departmentId)) names.set(item.departmentId, item.departmentName);
    }
    return Array.from(names)
      .map(([id, name]) => ({ value: id, label: name }))
      .filter(item => superAdmin || session?.activeRole !== "headofdepartment" || (session?.departmentIds ?? []).includes(item.value))
      .filter(item => !bundle.definition.departmentId || item.value === bundle.definition.departmentId);
  }, [departments, activeClasses, superAdmin, session?.activeRole, session?.departmentIds, bundle.definition.departmentId]);
  const options = type === "role" ? roles : type === "branch" ? branchOptions : departmentOptions;

  const togglePick = (
    map: Map<string, string>,
    setMap: (next: Map<string, string>) => void,
    id: string,
    name: string
  ) => {
    const next = new Map(map);
    if (next.has(id)) next.delete(id);
    else next.set(id, name);
    setMap(next);
  };

  async function submit() {
    if (!publication) throw new FormValidationError();
    const expiry = expires ? new Date(`${expires}T23:59:59`).toISOString() : undefined;
    if (type === "people") {
      const picks = Array.from(peoplePicksActive);
      if (picks.length === 0) throw new FormValidationError();
      setSaving(true);
      setFailures([]);
      try {
        const failed: Array<{ name: string; reason: string }> = [];
        let added = 0;
        for (const [userId, name] of picks) {
          try {
            await formsWrite(
              assignFormPublicationRequest(
                publication.id,
                { type: "user", userId },
                expiry,
                effectivePeopleMode === "class" ? selectedClass?.id : undefined
              )
            );
            added += 1;
            if (effectivePeopleMode === "staff") {
              setPeoplePicks(map => {
                const next = new Map(map);
                next.delete(userId);
                return next;
              });
            } else {
              setClassPicks(map => {
                const next = new Map(map);
                next.delete(userId);
                return next;
              });
            }
          } catch (error) {
            failed.push({
              name,
              reason:
                error instanceof Error ? error.message : copy.state.errorGeneric,
            });
          }
        }
        setFailures(failed);
        if (added > 0) {
          toast.success(F.assignedPeopleToast.replace("{n}", String(added)));
        }
        await onDone();
        if (failed.length === 0) onOpenChange(false);
      } finally {
        setSaving(false);
      }
      return;
    }
    if (!value) throw new FormValidationError();
    const target: FormAssignmentTarget =
      type === "role"
        ? { type: "role", role: value as FormRespondentRole }
        : type === "branch"
          ? { type: "branch", branchId: value }
          : { type: "department", departmentId: value };
    setSaving(true);
    try {
      await formsWrite(
        assignFormPublicationRequest(publication.id, target, expiry)
      );
      await onDone();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormSheet
      open={publication !== null}
      onOpenChange={onOpenChange}
      title={F.assignTitle}
      description={F.assignDescription}
      dirty={false}
      saving={saving}
      saveLabel={
        type === "people"
          ? peoplePicksActive.size === 0
            ? F.assign
            : peoplePicksActive.size === 1
              ? F.assignToOne
              : F.assignToMany.replace("{n}", String(peoplePicksActive.size))
          : F.assign
      }
      saveDisabled={type === "people" ? peoplePicksActive.size === 0 : !value}
      onSubmit={() =>
        runAction(submit, {
          success: type === "people" ? undefined : F.assignedToast,
        })
      }
    >
      <fieldset className="staff-field">
        <legend className="staff-field-label">{F.target}</legend>
        <div className="staff-segments" role="group" aria-label={F.target}>
          {(["role", "branch", "department", "people"] as const)
            .filter(option => option !== "people" || peopleEnabled)
            .map(option => (
              <button
                key={option}
                type="button"
                className="staff-segment"
                data-active={type === option}
                aria-pressed={type === option}
                onClick={() => {
                  setType(option);
                  setValue("");
                  setFailures([]);
                }}
              >
                {type === option ? <ActiveMark group="assign-target" /> : null}
                {option === "role"
                  ? F.targetRole
                  : option === "branch"
                    ? F.targetBranch
                    : option === "department"
                      ? F.targetDepartment
                      : F.targetPeople}
              </button>
            ))}
        </div>
      </fieldset>
      {type === "people" ? (
        <>
          {staffPickEnabled && classPickEnabled ? (
            <div
              className="staff-segments"
              role="group"
              aria-label={F.targetPeople}
            >
              {(["staff", "class"] as const).map(mode => (
                <button
                  key={mode}
                  type="button"
                  className="staff-segment"
                  data-active={effectivePeopleMode === mode}
                  aria-pressed={effectivePeopleMode === mode}
                  onClick={() => setPeopleMode(mode)}
                >
                  {effectivePeopleMode === mode ? (
                    <ActiveMark group="assign-people" />
                  ) : null}
                  {mode === "staff" ? F.peopleModeStaff : F.peopleModeClass}
                </button>
              ))}
            </div>
          ) : null}
          {effectivePeopleMode === "staff" ? (
            <>
              <StaffField label={F.peopleModeStaff} htmlFor="assign-staff-search">
                <input
                  id="assign-staff-search"
                  type="search"
                  className="staff-input"
                  placeholder={F.staffSearch}
                  value={staffSearch}
                  onChange={event => setStaffSearch(event.target.value)}
                />
              </StaffField>
              <div className="staff-people-list">
                {directory.isLoading ? (
                  <p className="staff-muted">…</p>
                ) : staffOptions.length === 0 ? (
                  <p className="staff-muted">{F.noStaffFound}</p>
                ) : (
                  staffOptions.map(user => (
                    <PersonPickRow
                      key={user.id}
                      name={user.name || user.email}
                      meta={`${roleLabel(user.emsRole)} · ${user.email}`}
                      checked={peoplePicks.has(user.id)}
                      onToggle={() =>
                        togglePick(
                          peoplePicks,
                          setPeoplePicks,
                          user.id,
                          user.name || user.email
                        )
                      }
                    />
                  ))
                )}
              </div>
            </>
          ) : (
            <>
              <StaffField label={F.peopleModeClass}>
                <Select
                  value={classId || undefined}
                  onValueChange={next => {
                    setClassId(next);
                    setClassPicks(new Map());
                  }}
                >
                  <SelectTrigger aria-label={F.peopleClass}>
                    <SelectValue placeholder="…" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeClasses.map(item => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} · {item.courseName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </StaffField>
              {selectedClass ? (
                selectedClass.teachers.length === 0 ? (
                  <p className="staff-muted">{F.classNoTeachers}</p>
                ) : (
                  <div className="staff-people-list">
                    {selectedClass.teachers.map(teacher => (
                      <PersonPickRow
                        key={teacher.id}
                        name={teacher.name || teacher.email}
                        meta={teacher.email}
                        checked={classPicks.has(teacher.id)}
                        onToggle={() =>
                          togglePick(
                            classPicks,
                            setClassPicks,
                            teacher.id,
                            teacher.name || teacher.email
                          )
                        }
                      />
                    ))}
                  </div>
                )
              ) : null}
            </>
          )}
          {peoplePicksActive.size > 0 ? (
            <p className="staff-muted staff-people-count">
              {F.peopleSelected.replace(
                "{n}",
                String(peoplePicksActive.size)
              )}
            </p>
          ) : null}
          {failures.length > 0 ? (
            <div className="staff-people-failures" role="alert">
              <span className="staff-field-label">{F.assignFailures}</span>
              <ul>
                {failures.map(item => (
                  <li key={item.name}>
                    {item.name} — {item.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : (
        <StaffField label={type === "role" ? F.targetRole : type === "branch" ? F.targetBranch : F.targetDepartment}>
          <Select value={value || undefined} onValueChange={setValue}>
            <SelectTrigger aria-label={F.target}>
              <SelectValue placeholder="…" />
            </SelectTrigger>
            <SelectContent>
              {options.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </StaffField>
      )}
      <StaffField label={F.expires} htmlFor="assign-expires">
        <input id="assign-expires" type="date" className="staff-input" value={expires} onChange={event => setExpires(event.target.value)} />
      </StaffField>
    </FormSheet>
  );
}

/* ---------------- Tab ----------------------------------------------- */

export function FormShare({
  bundle,
  draft,
  draftDirty,
  canPublish,
  onChanged,
}: {
  bundle: FormDefinitionBundle;
  draft: FormVersion | null;
  draftDirty: boolean;
  canPublish: boolean;
  onChanged: () => Promise<unknown>;
}) {
  const { session } = useStaffSession();
  const branches = useBranches();
  const departments = useDepartments();
  // Non-Super Admin roles cannot read the department or branch directories;
  // class records still carry the names, so labels never fall back to raw ids.
  const classesResult = useNcc<{ items: NccClassDto[] }>(
    session?.ncc ? "/api/ncc/delivery/classes" : null
  );
  const [publishing, setPublishing] = useState(false);
  const [assigning, setAssigning] = useState<FormPublication | null>(null);
  const [retiring, setRetiring] = useState<FormPublication | null>(null);
  const publications = [...bundle.publications].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const versionOf = (id: string) => bundle.versions.find(item => item.id === id)?.versionNumber;
  const scopeNames = useMemo(() => {
    const departmentNames = new Map(
      departments.map(item => [item.id, item.name])
    );
    const branchNames = new Map<string, string>();
    for (const item of classesResult.data?.items ?? []) {
      if (!departmentNames.has(item.departmentId))
        departmentNames.set(item.departmentId, item.departmentName);
      if (!branchNames.has(item.branchId))
        branchNames.set(item.branchId, item.branchName);
    }
    return { departmentNames, branchNames };
  }, [departments, classesResult.data]);
  const targetLabel = (assignment: FormAssignment) => {
    const target = assignment.target;
    if (target.type === "role") return F.roles[target.role];
    if (target.type === "user") return assignment.targetLabel ?? F.personFallback;
    if (target.type === "branch")
      return (
        branches.get(target.branchId)?.name ??
        scopeNames.branchNames.get(target.branchId) ??
        F.targetBranch
      );
    if (target.type === "department")
      return (
        scopeNames.departmentNames.get(target.departmentId) ?? F.targetDepartment
      );
    return target.type;
  };

  return (
    <div className="flex flex-col gap-4">
      {canPublish && draft ? (
        <div className="staff-banner" data-tone={formContentHasRecordLinks(draft.content) ? "caution" : "neutral"}>
          <span>
            {F.version} {draft.versionNumber} · {F.editingDraft}
            {draftDirty ? ` · ${F.unsaved}` : ""}
            {formContentHasRecordLinks(draft.content) ? ` · ${F.publishBlockedRecordLinks}` : ""}
          </span>
          <button type="button" className="staff-btn" data-variant="primary" data-size="sm" disabled={draftDirty || formContentHasRecordLinks(draft.content)} onClick={() => setPublishing(true)}>
            {F.publish}
          </button>
        </div>
      ) : null}

      <section className="staff-section">
        <h2 className="staff-section-title">{F.publications}</h2>
        {publications.length === 0 ? (
          <p className="staff-muted">{F.noPublications}</p>
        ) : (
          <ul className="staff-class-list">
            {publications.map(publication => {
              const active = publication.status === "open" || publication.status === "scheduled";
              const assignments = bundle.assignments.filter(item => item.publicationId === publication.id && !item.revokedAt);
              return (
                <li key={publication.id} className="staff-share-row">
                  <span className="staff-cell-stack">
                    <span className="staff-agenda-name staff-ltr">/forms/{publication.slug}</span>
                    <span className="staff-muted">
                      {audienceLabel(publication.audience)} · {F.version} {versionOf(publication.versionId)}
                      {publication.closesAt ? ` · ${F.closesAt} ${formatDateTime(publication.closesAt)}` : ""}
                    </span>
                    {publication.audience === "assigned" ? (
                      <span className="staff-share-targets">
                        {assignments.length === 0 ? (
                          <span className="staff-muted">{F.noAssignments}</span>
                        ) : (
                          assignments.map(assignment => (
                            <span key={assignment.id} className="staff-tag">
                              {targetLabel(assignment)}
                              {canPublish && active ? (
                                <button
                                  type="button"
                                  className="staff-tag-remove"
                                  aria-label={`${F.revoke} ${targetLabel(assignment)}`}
                                  onClick={() =>
                                    void runAction(
                                      async () => {
                                        await formsWrite(revokeFormAssignmentRequest(assignment.id));
                                        await onChanged();
                                      },
                                      { success: F.revokedToast }
                                    )
                                  }
                                >
                                  ×
                                </button>
                              ) : null}
                            </span>
                          ))
                        )}
                      </span>
                    ) : null}
                  </span>
                  <span className="staff-row-actions">
                    <StatusBadge status={PUBLICATION_TONE[publication.status]} label={F.publicationStatus[publication.status]} />
                    {active && publication.audience === "public" ? (
                      <>
                        <button
                          type="button"
                          className="staff-icon-btn"
                          aria-label={F.copyLink}
                          title={F.copyLink}
                          onClick={() => void navigator.clipboard.writeText(publicLink(publication.slug)).then(() => toast.success(F.copied))}
                        >
                          <Copy strokeWidth={1.75} aria-hidden />
                        </button>
                        <a className="staff-icon-btn" href={`/forms/${publication.slug}`} target="_blank" rel="noreferrer" aria-label={F.openLink} title={F.openLink}>
                          <ExternalLink strokeWidth={1.75} aria-hidden />
                        </a>
                      </>
                    ) : null}
                    {canPublish && active && publication.audience === "assigned" ? (
                      <button type="button" className="staff-btn" data-size="sm" onClick={() => setAssigning(publication)}>
                        <Plus strokeWidth={1.75} aria-hidden />
                        {F.assign}
                      </button>
                    ) : null}
                    {canPublish && active ? (
                      <button type="button" className="staff-btn" data-size="sm" data-variant="quiet-danger" onClick={() => setRetiring(publication)}>
                        {F.retire}
                      </button>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {draft ? <PublishSheet open={publishing} onOpenChange={setPublishing} bundle={bundle} draft={draft} onDone={onChanged} /> : null}
      <AssignSheet publication={assigning} bundle={bundle} onOpenChange={open => !open && setAssigning(null)} onDone={onChanged} />
      <ConfirmDialog
        open={retiring !== null}
        onOpenChange={open => !open && setRetiring(null)}
        title={F.retireTitle}
        description={F.retireBody}
        confirmLabel={F.retire}
        destructive
        onConfirm={() =>
          runAction(
            async () => {
              if (!retiring) return;
              await formsWrite(retireFormPublicationRequest(retiring.id));
              await onChanged();
            },
            { success: F.retiredToast }
          )
        }
      />
    </div>
  );
}
