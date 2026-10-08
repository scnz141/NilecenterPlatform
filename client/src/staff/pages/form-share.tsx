import { useEffect, useState } from "react";
import { Copy, ExternalLink, Plus } from "lucide-react";
import { toast } from "sonner";
import type { FormAssignmentTarget, FormPublication, FormRespondentRole, FormVersion } from "@shared/nileForms";
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
import { SLUG_PATTERN, toSlug } from "../forms/model";
import { formsWrite } from "../forms/write";
import { formatDateTime } from "../i18n";
import { FormValidationError, runAction } from "../run-action";
import { useStaffSession } from "../session";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { FormSheet, StaffField } from "../ui/form-sheet";
import { StatusBadge } from "../ui/primitives";
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
  const [type, setType] = useState<"role" | "branch" | "department">("role");
  const [value, setValue] = useState("");
  const [expires, setExpires] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setType("role");
    setValue("");
    setExpires("");
  }, [publication?.id]);

  const roles = bundle.assignmentOptions.roles.map(option => ({ value: option.id, label: F.roles[option.id] ?? option.label }));
  const branchOptions = branches.active
    .filter(branch => superAdmin || (session?.branchIds ?? []).includes(branch.id))
    .filter(branch => !bundle.definition.branchId || branch.id === bundle.definition.branchId)
    .map(branch => ({ value: branch.id, label: branch.name }));
  const departmentOptions = departments
    .filter(item => superAdmin || session?.activeRole !== "headofdepartment" || (session?.departmentIds ?? []).includes(item.id))
    .filter(item => !bundle.definition.departmentId || item.id === bundle.definition.departmentId)
    .map(item => ({ value: item.id, label: item.name }));
  const options = type === "role" ? roles : type === "branch" ? branchOptions : departmentOptions;

  async function submit() {
    if (!publication || !value) throw new FormValidationError();
    const target: FormAssignmentTarget =
      type === "role"
        ? { type: "role", role: value as FormRespondentRole }
        : type === "branch"
          ? { type: "branch", branchId: value }
          : { type: "department", departmentId: value };
    setSaving(true);
    try {
      await formsWrite(
        assignFormPublicationRequest(publication.id, target, expires ? new Date(`${expires}T23:59:59`).toISOString() : undefined)
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
      saveLabel={F.assign}
      saveDisabled={!value}
      onSubmit={() => runAction(submit, { success: F.assignedToast })}
    >
      <fieldset className="staff-field">
        <legend className="staff-field-label">{F.target}</legend>
        <div className="staff-segments" role="group" aria-label={F.target}>
          {(["role", "branch", "department"] as const).map(option => (
            <button
              key={option}
              type="button"
              className="staff-segment"
              data-active={type === option}
              aria-pressed={type === option}
              onClick={() => {
                setType(option);
                setValue("");
              }}
            >
              {option === "role" ? F.targetRole : option === "branch" ? F.targetBranch : F.targetDepartment}
            </button>
          ))}
        </div>
      </fieldset>
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
  const branches = useBranches();
  const departments = useDepartments();
  const [publishing, setPublishing] = useState(false);
  const [assigning, setAssigning] = useState<FormPublication | null>(null);
  const [retiring, setRetiring] = useState<FormPublication | null>(null);
  const publications = [...bundle.publications].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const versionOf = (id: string) => bundle.versions.find(item => item.id === id)?.versionNumber;
  const targetLabel = (target: FormAssignmentTarget) => {
    if (target.type === "role") return F.roles[target.role];
    if (target.type === "branch") return branches.get(target.branchId)?.name ?? target.branchId;
    if (target.type === "department") return departments.find(item => item.id === target.departmentId)?.name ?? target.departmentId;
    return target.type;
  };

  return (
    <div className="flex flex-col gap-4">
      {canPublish && draft ? (
        <div className="staff-banner" data-tone="neutral">
          <span>
            {F.version} {draft.versionNumber} · {F.editingDraft}
            {draftDirty ? ` · ${F.unsaved}` : ""}
          </span>
          <button type="button" className="staff-btn" data-variant="primary" data-size="sm" disabled={draftDirty} onClick={() => setPublishing(true)}>
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
                              {targetLabel(assignment.target)}
                              {canPublish && active ? (
                                <button
                                  type="button"
                                  className="staff-tag-remove"
                                  aria-label={`${F.revoke} ${targetLabel(assignment.target)}`}
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
