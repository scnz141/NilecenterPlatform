import { useMemo, useState } from "react";
import {
  commitJotformMigrationRequest,
  inspectJotformMigrationRequest,
  previewJotformMigrationRequest,
  reconcileJotformMigrationRecordRequest,
  type JotformMigrationInspection,
  type JotformMigrationPreview,
  type JotformMigrationStatus,
} from "@/lib/forms/api";
import type { JotformForm } from "../../../../server/jotformClient";
import type { JotformMigrationRunBundle } from "../../../../server/nileFormsMigrationService";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/staff/ui/kit";
import { useNcc } from "../api";
import { copy } from "../copy";
import { formsWrite } from "../forms/write";
import { formatDateTime } from "../i18n";
import { runAction } from "../run-action";
import { useStaffSession } from "../session";
import { EmptyState, ErrorState, LoadingRows, PageHeader, StatusBadge } from "../ui/primitives";

const F = copy.forms;
const I = copy.forms.importer;
const SKIP = "__skip";

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Suggest the Jotform question whose name or text matches each target field. */
export function suggestMapping(inspection: Pick<JotformMigrationInspection, "questions" | "targetFields">) {
  return Object.fromEntries(
    inspection.targetFields.map(field => {
      const target = normalize(`${field.id} ${field.label.en}`);
      const question = inspection.questions.find(item => {
        const source = normalize(`${item.name ?? ""} ${item.text}`);
        return Boolean(source) && (source.includes(normalize(field.id)) || target.includes(source));
      });
      return [field.id, question?.qid ?? ""];
    })
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="staff-tile">
      <span className="staff-tile-label">{label}</span>
      <span className="staff-tile-value" data-tone={tone}>
        {value}
      </span>
    </div>
  );
}

export default function FormsImportPage() {
  const { session } = useStaffSession();
  const superAdmin = session?.activeRole === "superadmin";
  const status = useNcc<JotformMigrationStatus>(superAdmin ? "/api/forms/migration/jotform/status" : null);
  const remote = useNcc<{ forms: JotformForm[] }>(
    status.data?.configured ? "/api/forms/migration/jotform/forms" : null
  );
  const runs = useNcc<JotformMigrationRunBundle[]>(superAdmin ? "/api/forms/migration/jotform/runs" : null);
  const [sourceFormId, setSourceFormId] = useState("");
  const [targetPublicationId, setTargetPublicationId] = useState("");
  const [inspection, setInspection] = useState<JotformMigrationInspection | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [offset, setOffset] = useState("0");
  const [limit, setLimit] = useState("500");
  const [preview, setPreview] = useState<JotformMigrationPreview | null>(null);
  const [busy, setBusy] = useState(false);

  const mapped = useMemo(
    () =>
      Object.entries(mapping)
        .filter(([, question]) => question)
        .map(([targetFieldId, sourceQuestionId]) => ({ targetFieldId, sourceQuestionId })),
    [mapping]
  );

  if (!superAdmin) return <EmptyState title={copy.shell.noAccess} />;
  if (status.error) return <ErrorState error={status.error} onRetry={() => void status.mutate()} />;
  if (!status.data) return <LoadingRows />;

  const run = async (work: () => Promise<void>, success?: string) => {
    setBusy(true);
    await runAction(work, success ? { success } : undefined);
    setBusy(false);
  };

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <PageHeader title={I.title} description={I.description} />
      {!status.data.configured ? (
        <p className="staff-banner" data-tone="caution" role="status">
          {I.notConnected}
        </p>
      ) : null}

      {status.data.configured ? (
        <>
          <section className="staff-section">
            <h2 className="staff-section-title">{I.step1}</h2>
            {status.data.targets.length === 0 ? <p className="staff-muted">{I.noTargets}</p> : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="staff-field">
                <span className="staff-field-label">{I.source}</span>
                <Select
                  value={sourceFormId || undefined}
                  onValueChange={value => {
                    setSourceFormId(value);
                    setInspection(null);
                    setPreview(null);
                  }}
                >
                  <SelectTrigger aria-label={I.source}>
                    <SelectValue placeholder="…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(remote.data?.forms ?? []).map(form => (
                      <SelectItem key={form.id} value={form.id}>
                        {form.title} · {form.count} {I.submissions}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label className="staff-field">
                <span className="staff-field-label">{I.target}</span>
                <Select
                  value={targetPublicationId || undefined}
                  onValueChange={value => {
                    setTargetPublicationId(value);
                    setInspection(null);
                    setPreview(null);
                  }}
                >
                  <SelectTrigger aria-label={I.target}>
                    <SelectValue placeholder="…" />
                  </SelectTrigger>
                  <SelectContent>
                    {status.data.targets.map(target => (
                      <SelectItem key={target.publication.id} value={target.publication.id}>
                        {target.definition.title} · /{target.publication.slug}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            </div>
            <button
              type="button"
              className="staff-btn w-fit"
              data-variant="primary"
              disabled={!sourceFormId || !targetPublicationId || busy}
              onClick={() =>
                void run(async () => {
                  const result = await formsWrite(inspectJotformMigrationRequest(sourceFormId, targetPublicationId));
                  setInspection(result);
                  setMapping(suggestMapping(result));
                  setPreview(null);
                })
              }
            >
              {I.inspect}
            </button>
          </section>

          {inspection ? (
            <section className="staff-section">
              <h2 className="staff-section-title">{I.step2}</h2>
              <ul className="staff-attention">
                {inspection.targetFields.map(field => (
                  <li key={field.id} className="staff-map-row">
                    <span className="staff-cell-stack">
                      <span>
                        {field.label.en}
                        {field.required ? <span className="staff-q-required"> *</span> : null}
                      </span>
                      <span className="staff-muted">{F.types[field.type as keyof typeof F.types] ?? field.type}</span>
                    </span>
                    <Select
                      value={mapping[field.id] || SKIP}
                      onValueChange={value => {
                        setMapping(current => ({ ...current, [field.id]: value === SKIP ? "" : value }));
                        setPreview(null);
                      }}
                    >
                      <SelectTrigger aria-label={`${I.fromJotform}: ${field.label.en}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SKIP}>{I.skip}</SelectItem>
                        {inspection.questions.map(question => (
                          <SelectItem key={question.qid} value={question.qid}>
                            {question.text || question.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-end gap-3">
                <label className="staff-field">
                  <span className="staff-field-label">{I.offset}</span>
                  <input className="staff-input staff-figures" inputMode="numeric" value={offset} onChange={event => setOffset(event.target.value.replace(/\D/g, ""))} />
                </label>
                <label className="staff-field">
                  <span className="staff-field-label">{I.limit}</span>
                  <input className="staff-input staff-figures" inputMode="numeric" value={limit} onChange={event => setLimit(event.target.value.replace(/\D/g, ""))} />
                </label>
                <button
                  type="button"
                  className="staff-btn"
                  data-variant="primary"
                  disabled={mapped.length === 0 || busy}
                  onClick={() =>
                    void run(async () => {
                      setPreview(
                        await formsWrite(
                          previewJotformMigrationRequest({
                            sourceFormId,
                            targetPublicationId,
                            mapping: mapped,
                            offset: Number(offset || 0),
                            limit: Math.min(1000, Math.max(1, Number(limit || 500))),
                          })
                        )
                      );
                    })
                  }
                >
                  {I.dryRun}
                </button>
              </div>
            </section>
          ) : null}

          {preview ? (
            <section className="staff-section">
              <h2 className="staff-section-title">{I.step3}</h2>
              <div className="staff-tiles">
                <Stat label={I.total} value={preview.run.totalRows} />
                <Stat label={I.valid} value={preview.run.validRows} />
                <Stat label={I.duplicates} value={preview.run.duplicateRows} />
                <Stat label={I.errors} value={preview.run.exceptionRows} />
              </div>
              {preview.sample.some(row => row.errors.length) ? (
                <>
                  <h3 className="staff-day-label">{I.sample}</h3>
                  <ul className="staff-attention">
                    {preview.sample
                      .filter(row => row.errors.length)
                      .slice(0, 10)
                      .map(row => (
                        <li key={row.sourceSubmissionId} className="staff-sync-step">
                          <span className="staff-cell-stack">
                            <span className="staff-ltr">#{row.sourceSubmissionId}</span>
                            <span className="staff-muted">{row.errors.join(" ")}</span>
                          </span>
                          <StatusBadge status="failed" label={I.errors} />
                        </li>
                      ))}
                  </ul>
                </>
              ) : null}
              <button
                type="button"
                className="staff-btn w-fit"
                data-variant="primary"
                disabled={preview.run.validRows === 0 || busy}
                onClick={() =>
                  void run(async () => {
                    await formsWrite(commitJotformMigrationRequest(preview.run.id, preview.run.previewHash));
                    setPreview(null);
                    setInspection(null);
                    await runs.mutate();
                  }, I.importedToast)
                }
              >
                {I.commit}
              </button>
            </section>
          ) : null}
        </>
      ) : null}

      <section className="staff-section">
        <h2 className="staff-section-title">{I.history}</h2>
        {!runs.data ? (
          <LoadingRows rows={2} />
        ) : runs.data.length === 0 ? (
          <p className="staff-muted">{I.noHistory}</p>
        ) : (
          <ul className="staff-class-list">
            {[...runs.data]
              .sort((a, b) => b.run.createdAt.localeCompare(a.run.createdAt))
              .map(({ run: item, records }) => {
                const open = records.filter(record => record.reconciliationStatus === "pending" && record.errors.length);
                return (
                  <li key={item.id} className="staff-share-row">
                    <span className="staff-cell-stack">
                      <span className="staff-agenda-name">{item.sourceFormTitle}</span>
                      <span className="staff-muted">
                        {formatDateTime(item.createdAt)} · {I.imported} {item.importedRows} · {I.duplicates} {item.duplicateRows} ·{" "}
                        {I.exceptions} {item.exceptionRows}
                      </span>
                      {open.length ? (
                        <ul className="staff-attention">
                          {open.slice(0, 20).map(record => (
                            <li key={record.id} className="staff-sync-step">
                              <span className="staff-cell-stack">
                                <span className="staff-ltr">#{record.sourceSubmissionId}</span>
                                <span className="staff-muted">{record.errors.join(" ")}</span>
                              </span>
                              <span className="staff-row-actions">
                                <button
                                  type="button"
                                  className="staff-btn"
                                  data-size="sm"
                                  onClick={() =>
                                    void run(async () => {
                                      await formsWrite(reconcileJotformMigrationRecordRequest(record.id, "matched"));
                                      await runs.mutate();
                                    }, I.reconciledToast)
                                  }
                                >
                                  {I.markMatched}
                                </button>
                                <button
                                  type="button"
                                  className="staff-btn"
                                  data-size="sm"
                                  data-variant="quiet-danger"
                                  onClick={() =>
                                    void run(async () => {
                                      await formsWrite(reconcileJotformMigrationRecordRequest(record.id, "exception"));
                                      await runs.mutate();
                                    }, I.reconciledToast)
                                  }
                                >
                                  {I.markException}
                                </button>
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </span>
                    <StatusBadge
                      status={item.status === "failed" ? "failed" : item.status === "previewed" ? "pending" : "completed"}
                      label={{ previewed: I.dryRun, imported: I.imported, reconciled: I.matched, failed: I.errors }[item.status]}
                    />
                  </li>
                );
              })}
          </ul>
        )}
      </section>
    </div>
  );
}
