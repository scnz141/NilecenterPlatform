import { AlertCircle, ArrowLeft, CheckCircle2, FileCheck2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";

import PlatformShell from "@/components/platform/PlatformShell";
import { useUiLanguage } from "@/lib/i18n-context";
import type { Role } from "@/lib/platformData";
import {
  createRequestFromSubmission,
  fetchRequestCreationCandidate,
} from "@/lib/requests/api";
import { requestText, requestUiLocale } from "@/lib/requests/copy";
import { requestCommandKey, requestsRoute } from "@/lib/requests/routes";
import type { NileRequestCreationCandidate } from "../../../../server/nileRequestsService";
import "@/styles/nile-requests.css";

function NileRequestCreateContent({
  role,
  submissionId,
}: {
  role: Role;
  submissionId: string;
}) {
  const locale = requestUiLocale(useUiLanguage());
  const [, navigate] = useLocation();
  const [candidate, setCandidate] =
    useState<NileRequestCreationCandidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const response = await fetchRequestCreationCandidate(submissionId);
    if (response.ok && response.data) setCandidate(response.data);
    else setError(response.error ?? requestText(locale, "loadFailed"));
    setLoading(false);
  }, [locale, submissionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!candidate || candidate.existingRequest) return;
    setSaving(true);
    setError("");
    const response = await createRequestFromSubmission(submissionId, {
      expectedSubmissionRevision: candidate.submission.revision,
      idempotencyKey: requestCommandKey("create"),
    });
    setSaving(false);
    if (response.ok && response.data) {
      navigate(requestsRoute(role, `/${response.data.request.id}`));
    } else {
      setError(response.error ?? requestText(locale, "loadFailed"));
    }
  };

  return (
    <main
      className="nile-requests-page nile-request-create-page"
      dir={locale === "ar" ? "rtl" : "ltr"}
      lang={locale}
    >
      <header className="nile-requests-header">
        <div>
          <Link href={requestsRoute(role)} className="nile-request-back-link">
            <ArrowLeft size={16} /> {requestText(locale, "back")}
          </Link>
          <h1>{requestText(locale, "createTitle")}</h1>
          <p>{requestText(locale, "createDescription")}</p>
        </div>
      </header>

      {loading ? (
        <section className="nile-requests-state" aria-live="polite">
          <span className="nile-forms-spinner" />
          <strong>{requestText(locale, "loading")}</strong>
        </section>
      ) : error ? (
        <section className="nile-requests-state" role="alert">
          <AlertCircle size={24} />
          <strong>{error}</strong>
          <button type="button" onClick={() => void load()}>
            {requestText(locale, "retry")}
          </button>
        </section>
      ) : candidate ? (
        <section className="nile-request-confirmation">
          <div className="nile-request-confirmation-main">
            <span className="nile-request-section-label">
              {requestText(locale, "details")}
            </span>
            <h2>{candidate.mappedRequest.summary}</h2>
            <dl className="nile-request-facts">
              <div>
                <dt>{requestText(locale, "requester")}</dt>
                <dd>{candidate.requesterName}</dd>
              </div>
              <div>
                <dt>{requestText(locale, "branch")}</dt>
                <dd>{candidate.branchName}</dd>
              </div>
              <div>
                <dt>{requestText(locale, "location")}</dt>
                <dd>{candidate.mappedRequest.location}</dd>
              </div>
              <div>
                <dt>{requestText(locale, "priority")}</dt>
                <dd>{candidate.mappedRequest.priority}</dd>
              </div>
            </dl>
            <p className="nile-request-long-copy">
              {candidate.mappedRequest.details}
            </p>
          </div>
          <aside className="nile-request-source-panel">
            <FileCheck2 size={24} />
            <span>{requestText(locale, "sourceReview")}</span>
            <strong>{candidate.submission.id}</strong>
            <small>{requestText(locale, "immutable")}</small>
            {candidate.existingRequest ? (
              <>
                <p className="nile-request-inline-notice">
                  <CheckCircle2 size={16} /> {requestText(locale, "existing")}
                </p>
                <Link
                  href={requestsRoute(role, `/${candidate.existingRequest.id}`)}
                  className="nile-request-primary-link"
                >
                  {requestText(locale, "openRequest")}
                </Link>
              </>
            ) : (
              <button
                type="button"
                onClick={() => void create()}
                disabled={saving}
              >
                {saving
                  ? requestText(locale, "saving")
                  : requestText(locale, "create")}
              </button>
            )}
          </aside>
        </section>
      ) : null}
    </main>
  );
}

export default function NileRequestCreatePage(props: {
  role: Role;
  submissionId: string;
}) {
  return (
    <PlatformShell role={props.role} title="Create request">
      <NileRequestCreateContent {...props} />
    </PlatformShell>
  );
}
