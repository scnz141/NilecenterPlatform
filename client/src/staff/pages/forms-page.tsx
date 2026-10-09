import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { Download, Plus, Upload } from "lucide-react";
import type { FormDefinition } from "@shared/nileForms";
import { nileFormsTemplateCatalog, type NileFormsTemplateKey } from "@shared/nileFormsTemplateCatalog";
import {
  createFormDefinitionRequest,
  exportFormSubmissionsRequest,
  type FormSubmissionListItem,
} from "@/lib/forms/api";
import { formCategoriesForRole } from "@/lib/forms/management";
import type { FormResponderBundle } from "../../../../server/nileFormsService";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/staff/ui/kit";
import { useInvalidate, useNcc } from "../api";
import { formsWrite } from "../forms/write";
import { copy } from "../copy";
import { canManageForms, formLocaleFor, text, toKey } from "../forms/model";
import { formatDateTime, useStaffLocale } from "../i18n";
import { FormValidationError, runAction } from "../run-action";
import { useStaffSession } from "../session";
import { FormSheet, StaffField } from "../ui/form-sheet";
import { ActiveMark, EmptyState, ErrorState, LoadingRows, PageHeader, StatusBadge } from "../ui/primitives";
import { useBranches } from "./admissions-ui";
import { useDepartments } from "./course-form";

const F = copy.forms;
type Tab = "forms" | "responses" | "fill";

const DEFINITION_TONE: Record<FormDefinition["status"], string> = {
  draft: "pending",
  active: "active",
  retired: "disabled",
};
export const RESPONSE_TONE: Record<string, string> = {
  submitted: "pending",
  under_review: "pending",
  accepted: "completed",
  promoted: "completed",
  rejected: "failed",
  withdrawn: "disabled",
  quarantined: "failed",
};

/* ---------------- New form ------------------------------------------ */

function NewFormSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { session } = useStaffSession();
  const role = session?.activeRole ?? null;
  const locale = formLocaleFor(useStaffLocale());
  const [, navigate] = useLocation();
  const invalidate = useInvalidate();
  const branches = useBranches();
  const departments = useDepartments(open && role === "headofdepartment");
  const categories = role ? formCategoriesForRole(role) : [];
  const [titleEn, setTitleEn] = useState("");
  const [titleAr, setTitleAr] = useState("");
  const [category, setCategory] = useState<FormDefinition["category"]>(categories[0] ?? "admissions");
  const [template, setTemplate] = useState<NileFormsTemplateKey | "">("");
  const [branchId, setBranchId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const branchScoped = role === "registrar" || role === "branchadmin";
  const branchChoices = (session?.branchIds ?? []).map(id => ({ id, name: branches.get(id)?.name ?? id }));
  const departmentChoices = departments.filter(item => (session?.departmentIds ?? []).includes(item.id));

  useEffect(() => {
    if (!open) return;
    setTitleEn("");
    setTitleAr("");
    setCategory(categories[0] ?? "admissions");
    setTemplate("");
    setBranchId(session?.workspaceBranchId ?? session?.branchIds?.[0] ?? "");
    setDepartmentId(session?.departmentIds?.[0] ?? "");
    setAttempted(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const templates = nileFormsTemplateCatalog.filter(item => item.category === category);
  const missing = !titleEn.trim() || !titleAr.trim() || (branchScoped && !branchId) || (role === "headofdepartment" && !departmentId);

  async function submit() {
    setAttempted(true);
    if (missing) throw new FormValidationError();
    setSaving(true);
    try {
      const result = await formsWrite(
        createFormDefinitionRequest({
          key: `${toKey(titleEn)}_${Date.now().toString(36)}`,
          titleEn: titleEn.trim(),
          titleAr: titleAr.trim(),
          // Turkish stays available in the renderer; it defaults to English.
          titleTr: titleEn.trim(),
          category,
          ...(template ? { templateKey: template } : {}),
          ...(branchScoped ? { branchId } : {}),
          ...(role === "headofdepartment" ? { departmentId } : {}),
        })
      );
      await invalidate("/api/forms");
      onOpenChange(false);
      navigate(`/app/forms/${result.definition.id}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={F.newTitle}
      description={F.newDescription}
      dirty={Boolean(titleEn || titleAr)}
      saving={saving}
      saveLabel={F.createSubmit}
      onSubmit={() => runAction(submit, { success: F.createdToast })}
    >
      <StaffField label={F.titleEn} htmlFor="form-title-en" error={attempted && !titleEn.trim() ? copy.teaching.required : null}>
        <input id="form-title-en" className="staff-input" maxLength={200} value={titleEn} onChange={event => setTitleEn(event.target.value)} />
      </StaffField>
      <StaffField label={F.titleAr} htmlFor="form-title-ar" error={attempted && !titleAr.trim() ? copy.teaching.required : null}>
        <input id="form-title-ar" dir="rtl" className="staff-input" maxLength={200} value={titleAr} onChange={event => setTitleAr(event.target.value)} />
      </StaffField>
      {categories.length > 1 ? (
        <StaffField label={F.category}>
          <Select
            value={category}
            onValueChange={value => {
              setCategory(value as FormDefinition["category"]);
              setTemplate("");
            }}
          >
            <SelectTrigger aria-label={F.category}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories.map(item => (
                <SelectItem key={item} value={item}>
                  {F.categories[item]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </StaffField>
      ) : null}
      {branchScoped && branchChoices.length > 1 ? (
        <StaffField label={F.branch} error={attempted && !branchId ? copy.teaching.required : null}>
          <Select value={branchId || undefined} onValueChange={setBranchId}>
            <SelectTrigger aria-label={F.branch}>
              <SelectValue placeholder={copy.admissions.leads.chooseBranch} />
            </SelectTrigger>
            <SelectContent>
              {branchChoices.map(item => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </StaffField>
      ) : null}
      {role === "headofdepartment" && departmentChoices.length > 1 ? (
        <StaffField label={copy.teaching.courses.department}>
          <Select value={departmentId || undefined} onValueChange={setDepartmentId}>
            <SelectTrigger aria-label={copy.teaching.courses.department}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {departmentChoices.map(item => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </StaffField>
      ) : null}
      <fieldset className="staff-field">
        <legend className="staff-field-label">{F.template}</legend>
        <div className="staff-choice-list" role="radiogroup" aria-label={F.template}>
          {[{ key: "" as const, title: { en: F.blank, ar: F.blank } }, ...templates].map(item => (
            <label key={item.key || "blank"} className="staff-choice">
              <input type="radio" name="form-template" checked={template === item.key} onChange={() => setTemplate(item.key)} />
              <span className="staff-choice-body">
                <span className="staff-choice-title">{text(item.title, locale)}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </FormSheet>
  );
}

/* ---------------- Tabs ---------------------------------------------- */

function MyForms({ submissions }: { submissions: FormSubmissionListItem[] }) {
  const definitions = useNcc<FormDefinition[]>("/api/forms/definitions");
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of submissions) map.set(item.definition.id, (map.get(item.definition.id) ?? 0) + 1);
    return map;
  }, [submissions]);
  if (definitions.error) return <ErrorState error={definitions.error} onRetry={() => void definitions.mutate()} />;
  if (!definitions.data) return <LoadingRows />;
  if (definitions.data.length === 0) return <EmptyState title={F.empty} description={F.emptyHint} />;
  const rows = [...definitions.data].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return (
    <div className="staff-table-wrap">
      <table className="staff-table">
        <thead>
          <tr>
            <th scope="col">{F.form}</th>
            <th scope="col">{F.category}</th>
            <th scope="col">{copy.catalog.shared.status}</th>
            <th scope="col">{F.responses}</th>
            <th scope="col">{F.updated}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id} className="staff-row-link">
              <td>
                <Link href={`/app/forms/${row.id}`} className="staff-stretch staff-link-quiet">
                  {row.title}
                </Link>
              </td>
              <td>{F.categories[row.category]}</td>
              <td>
                <StatusBadge status={DEFINITION_TONE[row.status]} label={F.status[row.status]} />
              </td>
              <td className="staff-figures">{counts.get(row.id) ?? 0}</td>
              <td className="staff-muted">{formatDateTime(row.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ResponsesTable({ items, showForm = true }: { items: FormSubmissionListItem[]; showForm?: boolean }) {
  if (items.length === 0) return <EmptyState title={F.responsesEmpty} />;
  const rows = [...items].sort((a, b) => b.submission.submittedAt.localeCompare(a.submission.submittedAt));
  return (
    <div className="staff-table-wrap">
      <table className="staff-table">
        <thead>
          <tr>
            <th scope="col">{F.submitted}</th>
            {showForm ? <th scope="col">{F.form}</th> : null}
            <th scope="col">{F.respondent}</th>
            <th scope="col">{copy.catalog.shared.status}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ submission, definition }) => (
            <tr key={submission.id} className="staff-row-link">
              <td>
                <Link href={`/app/forms/responses/${submission.id}`} className="staff-stretch staff-link-quiet">
                  {formatDateTime(submission.submittedAt)}
                </Link>
              </td>
              {showForm ? <td>{definition.title}</td> : null}
              <td className="staff-muted">
                {submission.respondentRole ? F.roles[submission.respondentRole] : F.anonymous}
                {submission.legacySource ? " · Jotform" : ""}
              </td>
              <td>
                <StatusBadge status={RESPONSE_TONE[submission.status]} label={F.responseStatus[submission.status]} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ToFill() {
  const assigned = useNcc<FormResponderBundle[]>("/api/forms/assigned");
  if (assigned.error) return <ErrorState error={assigned.error} onRetry={() => void assigned.mutate()} />;
  if (!assigned.data) return <LoadingRows />;
  if (assigned.data.length === 0) return <EmptyState title={F.toFillEmpty} description={F.toFillHint} />;
  return (
    <ul className="staff-section staff-class-list">
      {assigned.data.map(item => {
        const sent = item.previousSubmissions.length > 0;
        const canAnswer = !sent || item.publication.allowMultiple;
        return (
          <li key={item.publication.id}>
            <span className="staff-cell-stack">
              <span className="staff-agenda-name">{item.definition.title}</span>
              <span className="staff-muted">
                {F.categories[item.definition.category]}
                {item.publication.closesAt ? ` · ${F.due} ${formatDateTime(item.publication.closesAt)}` : ""}
              </span>
            </span>
            <span className="staff-row-actions">
              {sent ? <StatusBadge status="completed" label={F.filled} /> : null}
              {canAnswer ? (
                <Link href={`/app/forms/fill/${item.publication.id}`} className="staff-btn" data-size="sm" data-variant={sent ? undefined : "primary"}>
                  {F.fill}
                </Link>
              ) : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------------- Page ---------------------------------------------- */

export default function FormsPage() {
  const { session } = useStaffSession();
  const manager = canManageForms(session?.activeRole);
  const superAdmin = session?.activeRole === "superadmin";
  const search = useSearch();
  const [, navigate] = useLocation();
  const [creating, setCreating] = useState(false);
  const submissions = useNcc<FormSubmissionListItem[]>(manager ? "/api/forms/submissions" : null);
  const tabs: Tab[] = manager ? ["forms", "responses", "fill"] : ["fill"];
  const requested = new URLSearchParams(search).get("tab") as Tab | null;
  const tab: Tab = requested && tabs.includes(requested) ? requested : tabs[0];
  const fresh = (submissions.data ?? []).filter(item => item.submission.status === "submitted").length;
  const labels: Record<Tab, string> = { forms: F.tabForms, responses: F.tabResponses, fill: F.tabToFill };

  async function exportCsv() {
    await runAction(
      async () => {
        const result = await formsWrite(exportFormSubmissionsRequest());
        const url = URL.createObjectURL(new Blob([result.csv], { type: "text/csv;charset=utf-8" }));
        const link = Object.assign(document.createElement("a"), { href: url, download: result.filename });
        link.click();
        URL.revokeObjectURL(url);
      },
      { success: F.exportedToast }
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader
        title={F.title}
        description={F.description}
        actions={
          manager ? (
            <>
              {superAdmin ? (
                <Link href="/app/forms/import" className="staff-btn">
                  <Upload strokeWidth={1.75} aria-hidden />
                  {F.import}
                </Link>
              ) : null}
              {tab === "responses" ? (
                <button type="button" className="staff-btn" onClick={() => void exportCsv()}>
                  <Download strokeWidth={1.75} aria-hidden />
                  {F.export}
                </button>
              ) : null}
              <button type="button" className="staff-btn" data-variant="primary" onClick={() => setCreating(true)}>
                <Plus strokeWidth={1.75} aria-hidden />
                {F.newForm}
              </button>
            </>
          ) : undefined
        }
      />
      {tabs.length > 1 ? (
        <div className="staff-tabs" role="tablist" aria-label={F.title}>
          {tabs.map(value => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              className="staff-tab"
              data-active={tab === value}
              onClick={() => navigate(value === tabs[0] ? "?" : `?tab=${value}`, { replace: true })}
            >
              {tab === value ? <ActiveMark group="forms-tabs" /> : null}
              {labels[value]}
              {value === "responses" && fresh ? <span className="staff-segment-count">{fresh}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
      {tab === "forms" ? <MyForms submissions={submissions.data ?? []} /> : null}
      {tab === "responses" ? (
        submissions.error ? (
          <ErrorState error={submissions.error} onRetry={() => void submissions.mutate()} />
        ) : !submissions.data ? (
          <LoadingRows />
        ) : (
          <ResponsesTable items={submissions.data} />
        )
      ) : null}
      {tab === "fill" ? <ToFill /> : null}
      {manager ? <NewFormSheet open={creating} onOpenChange={setCreating} /> : null}
    </div>
  );
}
