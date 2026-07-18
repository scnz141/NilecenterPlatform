import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  FileCheck2,
  MessageSquare,
  PlayCircle,
  RefreshCw,
  UserRoundCheck,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";

import PlatformShell from "@/components/platform/PlatformShell";
import { useUiLanguage } from "@/lib/i18n-context";
import type { Role } from "@/lib/platformData";
import {
  assignRequest,
  cancelRequest,
  commentOnRequest,
  fetchRequest,
  reprioritizeRequest,
  resolveRequest,
  startRequest,
  type NileRequestsApiResult,
} from "@/lib/requests/api";
import { requestText, requestUiLocale } from "@/lib/requests/copy";
import { requestCommandKey, requestsRoute } from "@/lib/requests/routes";
import type {
  NileRequestCommandResult,
  NileRequestPriority,
} from "@shared/nileRequests";
import type { NileRequestDetail } from "../../../../server/nileRequestsService";
import "@/styles/nile-requests.css";

function label(value: string) {
  return value.replaceAll("_", " ");
}

function NileRequestDetailContent({
  role,
  requestId,
}: {
  role: Role;
  requestId: string;
}) {
  const locale = requestUiLocale(useUiLanguage());
  const [detail, setDetail] = useState<NileRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [assigneeUserId, setAssigneeUserId] = useState("");
  const [assignmentReason, setAssignmentReason] = useState("");
  const [priority, setPriority] = useState<NileRequestPriority>("normal");
  const [priorityReason, setPriorityReason] = useState("");
  const [comment, setComment] = useState("");
  const [resolution, setResolution] = useState("");
  const [cancellationReason, setCancellationReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const response = await fetchRequest(requestId);
    if (response.ok && response.data) {
      setDetail(response.data);
      setAssigneeUserId(response.data.request.assigneeUserId ?? "");
      setPriority(response.data.request.priority);
    } else {
      setError(response.error ?? requestText(locale, "loadFailed"));
    }
    setLoading(false);
  }, [locale, requestId]);

  useEffect(() => {
    void load();
  }, [load]);

  const perform = async (
    operation: string,
    command: Promise<
      NileRequestsApiResult<NileRequestCommandResult & { replayed: boolean }>
    >,
    reset?: () => void
  ) => {
    setBusy(operation);
    setError("");
    setNotice("");
    const response = await command;
    if (response.ok) {
      reset?.();
      setNotice(requestText(locale, "saved"));
      await load();
    } else {
      setError(response.error ?? requestText(locale, "loadFailed"));
    }
    setBusy("");
  };

  const date = (value: string) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));

  return (
    <main
      className="nile-requests-page nile-request-detail-page"
      dir={locale === "ar" ? "rtl" : "ltr"}
      lang={locale}
    >
      {loading ? (
        <section className="nile-requests-state" aria-live="polite">
          <span className="nile-forms-spinner" />
          <strong>{requestText(locale, "loading")}</strong>
        </section>
      ) : error && !detail ? (
        <section className="nile-requests-state" role="alert">
          <AlertCircle size={24} />
          <strong>{error}</strong>
          <button type="button" onClick={() => void load()}>
            {requestText(locale, "retry")}
          </button>
        </section>
      ) : detail ? (
        <>
          <header className="nile-requests-header nile-request-detail-header">
            <div>
              <Link
                href={requestsRoute(role)}
                className="nile-request-back-link"
              >
                <ArrowLeft size={16} /> {requestText(locale, "back")}
              </Link>
              <div className="nile-request-title-line">
                <span className="nile-request-number">
                  {detail.request.requestNumber}
                </span>
                <span
                  className={`nile-request-chip is-${detail.request.status}`}
                >
                  {label(detail.request.status)}
                </span>
                <span
                  className={`nile-request-chip is-${detail.request.priority}`}
                >
                  {label(detail.request.priority)}
                </span>
              </div>
              <h1>{detail.request.summary}</h1>
              <p>
                {detail.requesterName} · {detail.branchName}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading || Boolean(busy)}
            >
              <RefreshCw size={16} /> {requestText(locale, "refresh")}
            </button>
          </header>

          {error ? (
            <p className="nile-request-banner is-error" role="alert">
              <AlertCircle size={16} /> {error}
            </p>
          ) : null}
          {notice ? (
            <p className="nile-request-banner is-success" role="status">
              <CheckCircle2 size={16} /> {notice}
            </p>
          ) : null}

          <section className="nile-request-detail-grid">
            <article className="nile-request-detail-main">
              <span className="nile-request-section-label">
                {requestText(locale, "details")}
              </span>
              <dl className="nile-request-facts">
                <div>
                  <dt>{requestText(locale, "location")}</dt>
                  <dd>{detail.request.location}</dd>
                </div>
                <div>
                  <dt>{requestText(locale, "category")}</dt>
                  <dd>{label(detail.request.category)}</dd>
                </div>
                <div>
                  <dt>{requestText(locale, "assignee")}</dt>
                  <dd>
                    {detail.assigneeName ?? requestText(locale, "unassigned")}
                  </dd>
                </div>
                <div>
                  <dt>{requestText(locale, "due")}</dt>
                  <dd>{date(detail.request.dueAt)}</dd>
                </div>
              </dl>
              <p className="nile-request-long-copy">{detail.request.details}</p>
              {detail.request.resolution ? (
                <div className="nile-request-outcome is-resolved">
                  <CheckCircle2 size={18} />
                  <div>
                    <strong>{requestText(locale, "resolution")}</strong>
                    <p>{detail.request.resolution}</p>
                  </div>
                </div>
              ) : null}
              {detail.request.cancellationReason ? (
                <div className="nile-request-outcome is-cancelled">
                  <XCircle size={18} />
                  <div>
                    <strong>{requestText(locale, "cancelled")}</strong>
                    <p>{detail.request.cancellationReason}</p>
                  </div>
                </div>
              ) : null}
              <div className="nile-request-source-line">
                <FileCheck2 size={17} />
                <span>
                  {requestText(locale, "submission")}:{" "}
                  {detail.request.sourceSubmissionId}
                </span>
                <span>
                  {requestText(locale, "version")}: {detail.request.version}
                </span>
              </div>
            </article>

            <aside className="nile-request-action-panel">
              <span className="nile-request-section-label">
                {requestText(locale, "actions")}
              </span>

              {detail.capabilities.canStart ? (
                <button
                  type="button"
                  onClick={() =>
                    void perform(
                      "start",
                      startRequest(requestId, {
                        expectedVersion: detail.request.version,
                        idempotencyKey: requestCommandKey("start"),
                      })
                    )
                  }
                  disabled={Boolean(busy)}
                >
                  <PlayCircle size={16} />
                  {busy === "start"
                    ? requestText(locale, "saving")
                    : requestText(locale, "start")}
                </button>
              ) : null}

              {detail.capabilities.canAssign ? (
                <details>
                  <summary>
                    <UserRoundCheck size={16} /> {requestText(locale, "assign")}
                  </summary>
                  <label>
                    <span>{requestText(locale, "assignee")}</span>
                    <select
                      value={assigneeUserId}
                      onChange={event => setAssigneeUserId(event.target.value)}
                    >
                      <option value="">
                        {requestText(locale, "selectAssignee")}
                      </option>
                      {detail.assigneeOptions.map(option => (
                        <option key={option.id} value={option.id}>
                          {option.label} · {option.context}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>{requestText(locale, "assignmentReason")}</span>
                    <textarea
                      value={assignmentReason}
                      onChange={event =>
                        setAssignmentReason(event.target.value)
                      }
                      rows={3}
                    />
                  </label>
                  <button
                    type="button"
                    disabled={
                      !assigneeUserId ||
                      assignmentReason.trim().length < 5 ||
                      Boolean(busy)
                    }
                    onClick={() =>
                      void perform(
                        "assign",
                        assignRequest(requestId, {
                          expectedVersion: detail.request.version,
                          assigneeUserId,
                          reason: assignmentReason,
                          idempotencyKey: requestCommandKey("assign"),
                        }),
                        () => setAssignmentReason("")
                      )
                    }
                  >
                    {busy === "assign"
                      ? requestText(locale, "saving")
                      : requestText(locale, "assign")}
                  </button>
                </details>
              ) : null}

              {detail.capabilities.canReprioritize ? (
                <details>
                  <summary>
                    <Clock3 size={16} /> {requestText(locale, "changePriority")}
                  </summary>
                  <label>
                    <span>{requestText(locale, "priority")}</span>
                    <select
                      value={priority}
                      onChange={event =>
                        setPriority(event.target.value as NileRequestPriority)
                      }
                    >
                      {(
                        [
                          "low",
                          "normal",
                          "high",
                          "urgent",
                        ] as NileRequestPriority[]
                      ).map(value => (
                        <option key={value} value={value}>
                          {label(value)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>{requestText(locale, "priorityReason")}</span>
                    <textarea
                      value={priorityReason}
                      onChange={event => setPriorityReason(event.target.value)}
                      rows={3}
                    />
                  </label>
                  <button
                    type="button"
                    disabled={
                      priority === detail.request.priority ||
                      priorityReason.trim().length < 5 ||
                      Boolean(busy)
                    }
                    onClick={() =>
                      void perform(
                        "priority",
                        reprioritizeRequest(requestId, {
                          expectedVersion: detail.request.version,
                          priority,
                          reason: priorityReason,
                          idempotencyKey: requestCommandKey("priority"),
                        }),
                        () => setPriorityReason("")
                      )
                    }
                  >
                    {busy === "priority"
                      ? requestText(locale, "saving")
                      : requestText(locale, "changePriority")}
                  </button>
                </details>
              ) : null}

              {detail.capabilities.canComment ? (
                <details
                  open={
                    !detail.capabilities.canAssign &&
                    !detail.capabilities.canResolve
                  }
                >
                  <summary>
                    <MessageSquare size={16} />{" "}
                    {requestText(locale, "addComment")}
                  </summary>
                  <label>
                    <span className="sr-only">
                      {requestText(locale, "addComment")}
                    </span>
                    <textarea
                      value={comment}
                      onChange={event => setComment(event.target.value)}
                      placeholder={requestText(locale, "commentPlaceholder")}
                      rows={4}
                    />
                  </label>
                  <button
                    type="button"
                    disabled={comment.trim().length < 2 || Boolean(busy)}
                    onClick={() =>
                      void perform(
                        "comment",
                        commentOnRequest(requestId, {
                          expectedVersion: detail.request.version,
                          body: comment,
                          idempotencyKey: requestCommandKey("comment"),
                        }),
                        () => setComment("")
                      )
                    }
                  >
                    {busy === "comment"
                      ? requestText(locale, "saving")
                      : requestText(locale, "sendComment")}
                  </button>
                </details>
              ) : null}

              {detail.capabilities.canResolve ? (
                <details>
                  <summary>
                    <CheckCircle2 size={16} /> {requestText(locale, "resolve")}
                  </summary>
                  <label>
                    <span className="sr-only">
                      {requestText(locale, "resolution")}
                    </span>
                    <textarea
                      value={resolution}
                      onChange={event => setResolution(event.target.value)}
                      placeholder={requestText(locale, "resolutionPlaceholder")}
                      rows={4}
                    />
                  </label>
                  <button
                    type="button"
                    disabled={resolution.trim().length < 5 || Boolean(busy)}
                    onClick={() =>
                      void perform(
                        "resolve",
                        resolveRequest(requestId, {
                          expectedVersion: detail.request.version,
                          resolution,
                          idempotencyKey: requestCommandKey("resolve"),
                        })
                      )
                    }
                  >
                    {busy === "resolve"
                      ? requestText(locale, "saving")
                      : requestText(locale, "resolve")}
                  </button>
                </details>
              ) : null}

              {detail.capabilities.canCancel ? (
                <details className="is-danger">
                  <summary>
                    <XCircle size={16} /> {requestText(locale, "cancel")}
                  </summary>
                  <label>
                    <span className="sr-only">
                      {requestText(locale, "cancelled")}
                    </span>
                    <textarea
                      value={cancellationReason}
                      onChange={event =>
                        setCancellationReason(event.target.value)
                      }
                      placeholder={requestText(locale, "cancelPlaceholder")}
                      rows={4}
                    />
                  </label>
                  <button
                    type="button"
                    disabled={
                      cancellationReason.trim().length < 5 || Boolean(busy)
                    }
                    onClick={() =>
                      void perform(
                        "cancel",
                        cancelRequest(requestId, {
                          expectedVersion: detail.request.version,
                          reason: cancellationReason,
                          idempotencyKey: requestCommandKey("cancel"),
                        })
                      )
                    }
                  >
                    {busy === "cancel"
                      ? requestText(locale, "saving")
                      : requestText(locale, "cancel")}
                  </button>
                </details>
              ) : null}
            </aside>
          </section>

          <section className="nile-request-history-grid">
            <article>
              <h2>{requestText(locale, "activity")}</h2>
              {detail.activities.length ? (
                <ol className="nile-request-timeline">
                  {detail.activities.map(item => (
                    <li key={item.id}>
                      <span />
                      <div>
                        <strong>{item.summary}</strong>
                        <p>{item.actorName}</p>
                        <time dateTime={item.createdAt}>
                          {date(item.createdAt)}
                        </time>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p>{requestText(locale, "noActivity")}</p>
              )}
            </article>
            <article>
              <h2>{requestText(locale, "comments")}</h2>
              {detail.comments.length ? (
                <div className="nile-request-comments">
                  {detail.comments.map(item => (
                    <div key={item.id}>
                      <strong>{item.authorName}</strong>
                      <p>{item.body}</p>
                      <time dateTime={item.createdAt}>
                        {date(item.createdAt)}
                      </time>
                    </div>
                  ))}
                </div>
              ) : (
                <p>{requestText(locale, "noComments")}</p>
              )}
            </article>
          </section>
        </>
      ) : null}
    </main>
  );
}

export default function NileRequestDetailPage(props: {
  role: Role;
  requestId: string;
}) {
  return (
    <PlatformShell role={props.role} title="Request details">
      <NileRequestDetailContent {...props} />
    </PlatformShell>
  );
}
