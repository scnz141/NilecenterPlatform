import "@/styles/nile-forms.css";
import { useCallback, useState } from "react";
import { useLocation, useParams, useSearch } from "wouter";
import { Pencil } from "lucide-react";
import { createFormDraftVersionRequest, type FormSubmissionListItem } from "@/lib/forms/api";
import type { FormDefinitionBundle } from "../../../../server/nileFormsService";
import NileFormRenderer from "@/components/forms/NileFormRenderer";
import { useNcc } from "../api";
import { copy } from "../copy";
import { canManageForms } from "../forms/model";
import { formsWrite } from "../forms/write";
import { formatDateTime } from "../i18n";
import { runAction } from "../run-action";
import { useStaffSession } from "../session";
import { useStaffCrumb } from "../shell/staff-shell";
import { ActiveMark, ErrorState, LoadingRows, StatusBadge } from "../ui/primitives";
import { FormBuilder } from "./form-builder";
import { FormShare } from "./form-share";
import { ResponsesTable } from "./forms-page";

const F = copy.forms;
const TABS = ["build", "share", "responses"] as const;
type Tab = (typeof TABS)[number];

export default function FormPage() {
  const { formId } = useParams<{ formId: string }>();
  const { session } = useStaffSession();
  const manager = canManageForms(session?.activeRole);
  const search = useSearch();
  const [, navigate] = useLocation();
  const [dirty, setDirty] = useState(false);
  const [starting, setStarting] = useState(false);
  const bundle = useNcc<FormDefinitionBundle>(formId ? `/api/forms/definitions/${encodeURIComponent(formId)}` : null);
  const submissions = useNcc<FormSubmissionListItem[]>(manager ? "/api/forms/submissions" : null);
  const data = bundle.data;
  useStaffCrumb(data?.definition.title ?? null);
  const onDirtyChange = useCallback((value: boolean) => setDirty(value), []);

  if (bundle.error) return <ErrorState error={bundle.error} onRetry={() => void bundle.mutate()} />;
  if (!data) return <LoadingRows />;

  const { definition } = data;
  const draft = data.versions.find(item => item.id === definition.currentDraftVersionId && item.status === "draft") ?? null;
  const live = data.versions.find(item => item.id === definition.currentPublishedVersionId) ?? null;
  const responses = (submissions.data ?? []).filter(item => item.definition.id === definition.id);
  const requested = new URLSearchParams(search).get("tab") as Tab | null;
  const tab: Tab = requested && TABS.includes(requested) ? requested : "build";
  const labels: Record<Tab, string> = { build: F.tabBuild, share: F.tabShare, responses: F.tabResponses2 };
  const refresh = () => bundle.mutate();

  async function startDraft() {
    setStarting(true);
    await runAction(async () => {
      await formsWrite(createFormDraftVersionRequest(definition.id));
      await refresh();
    });
    setStarting(false);
  }

  return (
    <div className="staff-detail flex min-w-0 flex-col gap-6">
      <header className="staff-detail-head">
        <div className="min-w-0">
          <div className="staff-eyebrow">{F.categories[definition.category]}</div>
          <h1 className="staff-detail-name">{definition.title}</h1>
          <div className="staff-detail-meta">
            <StatusBadge
              status={definition.status === "active" ? "active" : definition.status === "draft" ? "pending" : "disabled"}
              label={F.status[definition.status]}
            />
            {live ? (
              <span className="staff-muted">
                {F.publishedVersion}: {live.versionNumber}
              </span>
            ) : null}
            <span className="staff-muted">
              {F.updated} {formatDateTime(definition.updatedAt)}
            </span>
          </div>
        </div>
        {manager && !draft && definition.status !== "retired" ? (
          <div className="staff-detail-actions">
            <button type="button" className="staff-btn" data-size="sm" disabled={starting} onClick={() => void startDraft()}>
              <Pencil strokeWidth={1.75} aria-hidden />
              {F.editDraft}
            </button>
          </div>
        ) : null}
      </header>

      <div className="staff-tabs" role="tablist" aria-label={definition.title}>
        {TABS.map(value => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            className="staff-tab"
            data-active={tab === value}
            onClick={() => navigate(value === "build" ? "?" : `?tab=${value}`, { replace: true })}
          >
            {tab === value ? <ActiveMark group="form-tabs" /> : null}
            {labels[value]}
            {value === "responses" && responses.length ? <span className="staff-segment-count">{responses.length}</span> : null}
          </button>
        ))}
      </div>

      {tab === "build" ? (
        draft && manager ? (
          <FormBuilder bundle={data} draft={draft} onSaved={refresh} onDirtyChange={onDirtyChange} />
        ) : live ? (
          <div className="flex flex-col gap-3">
            <p className="staff-hint">{F.readOnlyVersion}</p>
            <div className="staff-builder-preview staff-builder-preview-solo">
              <NileFormRenderer
                bundle={{
                  definition,
                  publication: data.publications[0],
                  version: live,
                  previousSubmissions: [],
                  entityOptions: {},
                }}
                mode="preview"
              />
            </div>
          </div>
        ) : null
      ) : null}
      {tab === "share" ? (
        <FormShare bundle={data} draft={draft} draftDirty={dirty} canPublish={manager} onChanged={refresh} />
      ) : null}
      {tab === "responses" ? (
        !submissions.data ? <LoadingRows /> : <ResponsesTable items={responses} showForm={false} />
      ) : null}
    </div>
  );
}
