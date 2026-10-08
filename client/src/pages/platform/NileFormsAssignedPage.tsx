import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Clock3,
  RefreshCw,
} from "lucide-react";
import { Link, useLocation } from "wouter";

import NileFormRenderer from "@/components/forms/NileFormRenderer";
import PlatformShell from "@/components/platform/PlatformShell";
import { fetchAssignedForm, fetchAssignedForms } from "@/lib/forms/api";
import { formsRoute } from "@/lib/forms/routes";
import type { Role } from "@/lib/platformData";
import type { FormResponderBundle } from "../../../../server/nileFormsService";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export default function NileFormsAssignedPage({
  role,
  publicationId,
}: {
  role: Role;
  publicationId?: string;
}) {
  const [, navigate] = useLocation();
  const [items, setItems] = useState<FormResponderBundle[]>([]);
  const [selected, setSelected] = useState<FormResponderBundle | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const initialAnswers = useMemo(() => {
    if (typeof window === "undefined") return {};
    const attendanceRecord = new URLSearchParams(window.location.search).get(
      "attendanceRecord"
    );
    return attendanceRecord ? { attendance_record: attendanceRecord } : {};
  }, [publicationId]);
  const activePreviousSubmission = selected?.previousSubmissions.find(
    item => item.status !== "withdrawn"
  );

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setStatus("loading");
      setError("");
      const response = publicationId
        ? await fetchAssignedForm(publicationId)
        : await fetchAssignedForms();
      if (cancelled) return;
      if (!response.ok || !response.data) {
        const details = response.details;
        const submissionId =
          details &&
          typeof details === "object" &&
          !Array.isArray(details) &&
          typeof (details as Record<string, unknown>).submissionId === "string"
            ? (details as Record<string, string>).submissionId
            : undefined;
        if (
          publicationId &&
          response.code === "response_limit_reached" &&
          submissionId
        ) {
          navigate(
            formsRoute(
              role,
              `/${publicationId}/responses/${submissionId}`
            )
          );
          return;
        }
        setStatus("error");
        setError(response.error ?? "Assigned forms could not be loaded.");
        return;
      }
      if (publicationId) setSelected(response.data as FormResponderBundle);
      else setItems(response.data as FormResponderBundle[]);
      setStatus("ready");
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [navigate, publicationId, reload, role]);

  return (
    <PlatformShell role={role} title="Forms">
      <div className="nile-forms-page">
        {status === "loading" ? (
          <section className="nile-forms-state" aria-live="polite">
            <span className="nile-forms-spinner" />
            <strong>Loading forms</strong>
          </section>
        ) : status === "error" ? (
          <section className="nile-forms-state" role="alert">
            <ClipboardList size={24} />
            <strong>Forms unavailable</strong>
            <p>{error}</p>
            <button
              type="button"
              className="platform-secondary-button"
              onClick={() => setReload(value => value + 1)}
            >
              <RefreshCw size={15} />
              Retry
            </button>
          </section>
        ) : publicationId && selected ? (
          <section className="nile-forms-response-workspace">
            <header className="nile-forms-page-header compact">
              <div>
                <Link href={formsRoute(role)} className="nile-forms-back-link">
                  <ArrowLeft size={15} />
                  Assigned forms
                </Link>
                <h1>{selected.definition.title}</h1>
                <p>Complete the current published version.</p>
              </div>
              {activePreviousSubmission ? (
                <span className={`nile-form-status is-${activePreviousSubmission.status}`}>
                  {activePreviousSubmission.status.replaceAll("_", " ")}
                </span>
              ) : null}
            </header>
            <NileFormRenderer
              bundle={selected}
              mode="assigned"
              initialAnswers={initialAnswers}
              onSubmitted={() => setReload(value => value + 1)}
            />
          </section>
        ) : (
          <>
            <header className="nile-forms-page-header">
              <div>
                <span className="nile-forms-eyebrow">Assigned</span>
                <h1>Forms</h1>
                <p>Complete requests assigned to your active role and scope.</p>
              </div>
            </header>

            {items.length ? (
              <section className="nile-forms-assigned-list" aria-label="Assigned forms">
                {items.map(item => {
                  const latest = item.previousSubmissions[0];
                  const responseLocked =
                    Boolean(latest) &&
                    latest?.status !== "withdrawn" &&
                    !item.publication.allowMultiple;
                  const destination = responseLocked && latest
                    ? formsRoute(
                        role,
                        `/${item.publication.id}/responses/${latest.id}`
                      )
                    : formsRoute(role, `/${item.publication.id}`);
                  return (
                    <article key={item.publication.id} className="nile-form-assigned-row">
                      <div className="nile-form-assigned-icon">
                        {latest ? <CheckCircle2 size={19} /> : <ClipboardList size={19} />}
                      </div>
                      <div className="nile-form-assigned-copy">
                        <div>
                          <h2>{item.definition.title}</h2>
                          <p>{item.version.content.description.en}</p>
                        </div>
                        <div className="nile-form-assigned-meta">
                          <span>Version {item.version.versionNumber}</span>
                          {item.publication.closesAt ? (
                            <span>
                              <Clock3 size={13} />
                              Closes {formatDate(item.publication.closesAt)}
                            </span>
                          ) : (
                            <span>Open</span>
                          )}
                          {latest ? (
                            <span className={`nile-form-status is-${latest.status}`}>
                              {latest.status.replaceAll("_", " ")}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <Link
                        href={destination}
                        className="platform-primary-button"
                      >
                        {responseLocked ? "View response" : "Open"}
                      </Link>
                    </article>
                  );
                })}
              </section>
            ) : (
              <section className="nile-forms-state">
                <ClipboardList size={24} />
                <strong>No assigned forms</strong>
                <p>There is no form waiting for this role and scope.</p>
              </section>
            )}
          </>
        )}
      </div>
    </PlatformShell>
  );
}
