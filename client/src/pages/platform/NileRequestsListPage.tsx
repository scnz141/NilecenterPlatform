import {
  AlertCircle,
  ArrowRight,
  ClipboardCheck,
  RefreshCw,
  Search,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";

import PlatformShell from "@/components/platform/PlatformShell";
import { useUiLanguage } from "@/lib/i18n-context";
import type { Role } from "@/lib/platformData";
import { fetchRequests } from "@/lib/requests/api";
import { requestText, requestUiLocale } from "@/lib/requests/copy";
import { requestsRoute } from "@/lib/requests/routes";
import type { NileRequestListItem } from "../../../../server/nileRequestsService";
import "@/styles/nile-requests.css";

function label(value: string) {
  return value.replaceAll("_", " ");
}

function NileRequestsListContent({ role }: { role: Role }) {
  const locale = requestUiLocale(useUiLanguage());
  const direction = locale === "ar" ? "rtl" : "ltr";
  const [items, setItems] = useState<NileRequestListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const response = await fetchRequests();
    if (response.ok && response.data) {
      setItems(response.data);
    } else {
      setError(response.error ?? requestText(locale, "loadFailed"));
    }
    setLoading(false);
  }, [locale]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter(item => {
      if (status !== "all" && item.request.status !== status) return false;
      if (!query) return true;
      return [
        item.request.requestNumber,
        item.request.summary,
        item.request.location,
        item.requesterName,
        item.assigneeName,
        item.branchName,
      ]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(query));
    });
  }, [items, search, status]);

  const reviewHref =
    role === "branchadmin"
      ? "/app/branch/forms/review"
      : role === "superadmin"
        ? "/app/admin/forms/review"
        : null;

  return (
    <main className="nile-requests-page" dir={direction} lang={locale}>
      <header className="nile-requests-header">
        <div>
          <h1>{requestText(locale, "requests")}</h1>
          <p>{requestText(locale, "listDescription")}</p>
        </div>
        <div className="nile-requests-header-actions">
          {reviewHref ? (
            <Link href={reviewHref} className="nile-request-secondary-link">
              <ClipboardCheck size={16} />
              {requestText(locale, "reviewForms")}
            </Link>
          ) : null}
          <button type="button" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={16} />
            {requestText(locale, "refresh")}
          </button>
        </div>
      </header>

      <section className="nile-requests-toolbar" aria-label="Request filters">
        <label className="nile-requests-search">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">{requestText(locale, "search")}</span>
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder={requestText(locale, "search")}
          />
        </label>
        <label>
          <span className="sr-only">{requestText(locale, "status")}</span>
          <select
            value={status}
            onChange={event => setStatus(event.target.value)}
          >
            <option value="all">{requestText(locale, "allStatuses")}</option>
            {["open", "assigned", "in_progress", "resolved", "cancelled"].map(
              value => (
                <option key={value} value={value}>
                  {label(value)}
                </option>
              )
            )}
          </select>
        </label>
      </section>

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
      ) : filtered.length ? (
        <section
          className="nile-request-list"
          aria-label={requestText(locale, "requests")}
        >
          {filtered.map(item => (
            <Link
              key={item.request.id}
              href={requestsRoute(role, `/${item.request.id}`)}
              className="nile-request-row"
            >
              <div className="nile-request-row-primary">
                <span className="nile-request-number">
                  {item.request.requestNumber}
                </span>
                <strong>{item.request.summary}</strong>
                <small>
                  {item.requesterName} · {item.branchName}
                </small>
              </div>
              <div className="nile-request-row-meta">
                <span
                  className={`nile-request-chip is-${item.request.priority}`}
                >
                  {label(item.request.priority)}
                </span>
                <span className={`nile-request-chip is-${item.request.status}`}>
                  {label(item.request.status)}
                </span>
                <span>
                  {requestText(locale, "assignee")}:{" "}
                  {item.assigneeName ?? requestText(locale, "unassigned")}
                </span>
                <time dateTime={item.request.dueAt}>
                  {requestText(locale, "due")}:{" "}
                  {new Intl.DateTimeFormat(locale, {
                    dateStyle: "medium",
                  }).format(new Date(item.request.dueAt))}
                </time>
              </div>
              <ArrowRight size={18} className="nile-request-row-arrow" />
            </Link>
          ))}
        </section>
      ) : (
        <section className="nile-requests-state">
          <ClipboardCheck size={26} />
          <strong>{requestText(locale, "empty")}</strong>
          <p>{requestText(locale, "emptyHelp")}</p>
        </section>
      )}
    </main>
  );
}

export default function NileRequestsListPage({ role }: { role: Role }) {
  return (
    <PlatformShell role={role} title="Requests">
      <NileRequestsListContent role={role} />
    </PlatformShell>
  );
}
