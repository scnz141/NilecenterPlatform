import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock3,
  RefreshCw,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import { Link } from "wouter";

import PlatformShell from "@/components/platform/PlatformShell";
import {
  fetchFormSubmission,
  promoteFormSubmissionRequest,
  reviewFormSubmissionRequest,
  type FormSubmissionDetail,
} from "@/lib/forms/api";
import { formsRoute } from "@/lib/forms/routes";
import type { Role } from "@/lib/platformData";
import { requestsRoute } from "@/lib/requests/routes";
import { getLocalizedText } from "@shared/nileForms";
import { branchIncidentRequestProfile } from "@shared/nileRequests";

function displayValue(value: unknown) {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.join(", ");
  if (value === undefined || value === null || value === "")
    return "Not provided";
  return String(value);
}

const promotionCommandLabels: Record<string, string> = {
  public_enquiry: "lead.create",
  application_intake: "application.create",
  placement_request: "placement.create",
  student_support: "support-ticket command",
  attendance_exception: "attendance-exception command",
};

function promotionIdempotencyKey(detail: FormSubmissionDetail) {
  const failed = detail.promotions.find(item => item.status === "failed");
  const base = `promotion:${detail.submission.id}:${detail.submission.revision}`;
  return failed ? `${base}:retry:${failed.commandId}` : base;
}

export default function NileFormsReviewDetailPage({
  role,
  submissionId,
}: {
  role: Role;
  submissionId: string;
}) {
  const [detail, setDetail] = useState<FormSubmissionDetail | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [message, setMessage] = useState("");
  const [comments, setComments] = useState("");
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setStatus("loading");
      const response = await fetchFormSubmission(submissionId);
      if (cancelled) return;
      if (!response.ok || !response.data) {
        setStatus("error");
        setMessage(response.error ?? "The submission could not be loaded.");
        return;
      }
      setDetail(response.data);
      setStatus("ready");
      setMessage("");
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [reload, submissionId]);

  const fields = useMemo(
    () => detail?.version.content.pages.flatMap(page => page.fields) ?? [],
    [detail]
  );
  const canPromote = detail
    ? [
        "public_enquiry",
        "application_intake",
        "placement_request",
        "student_support",
        "attendance_exception",
      ].includes(detail.definition.key)
    : false;
  const failedPromotion = detail?.promotions.find(
    item => item.status === "failed"
  );
  const canCreateRequest = Boolean(
    detail &&
      (role === "branchadmin" || role === "superadmin") &&
      detail.submission.status === "accepted" &&
      detail.definition.id ===
        branchIncidentRequestProfile.sourceDefinitionId &&
      detail.definition.key ===
        branchIncidentRequestProfile.sourceDefinitionKey &&
      detail.version.id === branchIncidentRequestProfile.sourceVersionId
  );

  const decide = async (decision: "under_review" | "accepted" | "rejected") => {
    if (!detail) return;
    setBusy(true);
    setMessage("");
    const response = await reviewFormSubmissionRequest(detail.submission.id, {
      decision,
      expectedRevision: detail.submission.revision,
      comments,
    });
    setBusy(false);
    if (!response.ok) {
      setMessage(response.error ?? "The review decision could not be saved.");
      return;
    }
    setComments("");
    setReload(value => value + 1);
  };

  const promote = async () => {
    if (!detail) return;
    setBusy(true);
    setMessage("");
    const response = await promoteFormSubmissionRequest(detail.submission.id, {
      expectedRevision: detail.submission.revision,
      idempotencyKey: promotionIdempotencyKey(detail),
    });
    setBusy(false);
    if (!response.ok) {
      setMessage(response.error ?? "The submission could not be promoted.");
      return;
    }
    if (response.data?.status === "failed") {
      setDetail(current =>
        current
          ? {
              ...current,
              promotions: [
                response.data!,
                ...current.promotions.filter(
                  item => item.id !== response.data!.id
                ),
              ],
            }
          : current
      );
      return;
    }
    setReload(value => value + 1);
  };

  if (status !== "ready" || !detail) {
    return (
      <PlatformShell role={role} title="Review submission">
        <div className="nile-forms-page">
          <section
            className="nile-forms-state"
            role={status === "error" ? "alert" : undefined}
          >
            {status === "loading" ? (
              <span className="nile-forms-spinner" />
            ) : (
              <ShieldCheck size={24} />
            )}
            <strong>
              {status === "loading"
                ? "Loading submission"
                : "Submission unavailable"}
            </strong>
            {message ? <p>{message}</p> : null}
            {status === "error" ? (
              <button
                type="button"
                className="platform-secondary-button"
                onClick={() => setReload(value => value + 1)}
              >
                <RefreshCw size={15} /> Retry
              </button>
            ) : null}
          </section>
        </div>
      </PlatformShell>
    );
  }

  const submission = detail.submission;
  return (
    <PlatformShell role={role} title="Review submission">
      <div className="nile-forms-page nile-form-review-detail">
        <header className="nile-forms-page-header compact">
          <div>
            <Link
              href={formsRoute(role, "/review")}
              className="nile-forms-back-link"
            >
              <ArrowLeft size={15} /> Submission inbox
            </Link>
            <h1>{detail.definition.title}</h1>
            <p>{submission.id}</p>
          </div>
          <span className={`nile-form-status is-${submission.status}`}>
            {submission.status.replaceAll("_", " ")}
          </span>
        </header>

        {message ? (
          <p className="nile-form-notice is-error" role="alert">
            {message}
          </p>
        ) : null}

        {canPromote &&
        ["under_review", "accepted"].includes(submission.status) ? (
          <aside className="nile-form-review-authority">
            <ShieldCheck size={18} />
            <p>
              Promotion runs the registered{" "}
              <strong>{promotionCommandLabels[detail.definition.key]}</strong>{" "}
              adapter. Form answers never write directly to operational tables.
            </p>
          </aside>
        ) : null}

        <section className="nile-form-review-grid">
          <div className="nile-form-review-answers">
            <header>
              <div>
                <span>Version {detail.version.versionNumber}</span>
                <h2>Submitted answers</h2>
              </div>
              <span>{new Date(submission.submittedAt).toLocaleString()}</span>
            </header>
            <dl>
              {fields
                .filter(field => Object.hasOwn(submission.answers, field.id))
                .map(field => {
                  const raw = submission.answers[field.id];
                  const optionLabels = field.options
                    ?.filter(option =>
                      Array.isArray(raw)
                        ? raw.includes(option.id)
                        : option.id === raw
                    )
                    .map(option => getLocalizedText(option.label, "en"));
                  return (
                    <div key={field.id}>
                      <dt>{field.label.en}</dt>
                      <dd>
                        {optionLabels?.length
                          ? optionLabels.join(", ")
                          : displayValue(raw)}
                      </dd>
                    </div>
                  );
                })}
            </dl>
          </div>

          <aside className="nile-form-review-context">
            <section>
              <header>
                <h2>Context</h2>
              </header>
              <dl>
                <div>
                  <dt>Form</dt>
                  <dd>{detail.definition.key}</dd>
                </div>
                <div>
                  <dt>Source</dt>
                  <dd>{submission.source.replaceAll("_", " ")}</dd>
                </div>
                <div>
                  <dt>Branch</dt>
                  <dd>{submission.branchId ?? "Global"}</dd>
                </div>
                <div>
                  <dt>Department</dt>
                  <dd>{submission.departmentId ?? "Not scoped"}</dd>
                </div>
                <div>
                  <dt>Revision</dt>
                  <dd>{submission.revision}</dd>
                </div>
              </dl>
            </section>

            {submission.status === "submitted" ? (
              <section className="nile-form-review-actions">
                <header>
                  <h2>Begin review</h2>
                </header>
                <button
                  type="button"
                  className="platform-primary-button"
                  disabled={busy}
                  onClick={() => decide("under_review")}
                >
                  <Clock3 size={16} /> Start review
                </button>
              </section>
            ) : submission.status === "under_review" ? (
              <section className="nile-form-review-actions">
                <header>
                  <h2>Decision</h2>
                </header>
                <label>
                  Reviewer note
                  <textarea
                    rows={4}
                    value={comments}
                    onChange={event => setComments(event.target.value)}
                    placeholder="Required when rejecting"
                  />
                </label>
                <div>
                  <button
                    type="button"
                    className="platform-secondary-button is-danger"
                    disabled={busy}
                    onClick={() => decide("rejected")}
                  >
                    <X size={16} /> Reject
                  </button>
                  <button
                    type="button"
                    className="platform-primary-button"
                    disabled={busy}
                    onClick={() => decide("accepted")}
                  >
                    <Check size={16} /> Accept
                  </button>
                </div>
              </section>
            ) : submission.status === "accepted" ? (
              <section className="nile-form-review-actions">
                <header>
                  <h2>{canPromote ? "Promote" : "Accepted evidence"}</h2>
                </header>
                {canPromote ? (
                  <>
                    {failedPromotion ? (
                      <p className="nile-form-notice is-error" role="alert">
                        Promotion failed:{" "}
                        {failedPromotion.error ?? "Try again."}
                      </p>
                    ) : null}
                    <button
                      type="button"
                      className="platform-primary-button"
                      disabled={busy}
                      onClick={promote}
                    >
                      {failedPromotion ? (
                        <RefreshCw size={16} />
                      ) : (
                        <Send size={16} />
                      )}
                      {failedPromotion
                        ? "Retry promotion"
                        : "Promote to workflow"}
                    </button>
                  </>
                ) : (
                  <p>This response remains versioned evidence.</p>
                )}
              </section>
            ) : submission.status === "promoted" ? (
              <section className="nile-form-review-actions is-complete">
                <CheckCircle2 size={20} />
                <div>
                  <h2>Promotion complete</h2>
                  <p>
                    {detail.promotions[0]?.resultingEntityType}{" "}
                    {detail.promotions[0]?.resultingEntityId}
                  </p>
                </div>
              </section>
            ) : null}

            {canCreateRequest ? (
              <section className="nile-form-review-actions">
                <header>
                  <h2>Create operational request</h2>
                </header>
                <p>
                  Confirm the mapped incident before creating a separate,
                  auditable request. This submission remains unchanged.
                </p>
                <Link
                  href={requestsRoute(
                    role,
                    `/from-submission/${submission.id}`
                  )}
                  className="platform-primary-button"
                >
                  <Send size={16} /> Continue to request
                </Link>
              </section>
            ) : null}

            <section className="nile-form-review-timeline">
              <header>
                <h2>Evidence</h2>
              </header>
              <ol>
                {[...detail.auditEvents]
                  .sort((left, right) =>
                    right.createdAt.localeCompare(left.createdAt)
                  )
                  .map(event => (
                    <li key={event.id}>
                      <span />
                      <div>
                        <strong>{event.action.replaceAll("_", " ")}</strong>
                        <small>
                          {new Date(event.createdAt).toLocaleString()} ·{" "}
                          {event.actorUserId}
                        </small>
                      </div>
                    </li>
                  ))}
              </ol>
            </section>
          </aside>
        </section>
      </div>
    </PlatformShell>
  );
}
