import { useMemo } from "react";
import { useLocation, useSearch } from "wouter";
import { GlyphSearch } from "../ui/glyphs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/staff/ui/kit";
import type {
  NccAuditEventDto,
  NccAuditStreamDto,
  NccRole,
} from "@/lib/backend/api";
import { useNcc } from "../api";
import { copy } from "../copy";
import { useStaffSession } from "../session";
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  PageHeader,
  StatusBadge,
} from "../ui/primitives";
import { formatDate } from "./catalog-shared";

const C = copy.audit;

const AUDIT_ROLES: NccRole[] = ["super_admin", "branch_admin", "vice_manager"];

const STREAMS: NccAuditStreamDto[] = [
  "auth",
  "branch",
  "department",
  "course",
  "custom_field",
  "moodle_site",
  "student",
  "lead",
  "placement_test",
  "class",
  "enrolment",
  "room",
  "session",
];

function humanize(value: string) {
  return value
    .replace(/[_.-]/g, " ")
    .replace(/\b\w/g, character => character.toUpperCase());
}

export default function AuditPage() {
  const { session } = useStaffSession();
  const role = session?.ncc?.activeRole ?? null;
  const allowed = role !== null && AUDIT_ROLES.includes(role);

  const search = useSearch();
  const [, navigate] = useLocation();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const stream = params.get("stream") ?? "";
  const q = (params.get("q") ?? "").trim().toLowerCase();

  const events = useNcc<{ items: NccAuditEventDto[] }>(
    allowed ? "/api/ncc/audit/events" : null,
    {
      stream:
        stream && STREAMS.includes(stream as NccAuditStreamDto)
          ? stream
          : undefined,
      limit: 100,
    }
  );

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(search);
    if (value === null || value === "") next.delete(key);
    else next.set(key, value);
    navigate(`?${next.toString()}`, { replace: true });
  }

  if (!allowed) {
    return (
      <EmptyState title={copy.shell.noAccess} description={C.noAccess} />
    );
  }
  if (events.error) {
    return (
      <ErrorState
        error={events.error}
        onRetry={() => void events.mutate()}
      />
    );
  }

  const items = events.data?.items ?? null;
  const filtered = (items ?? []).filter(event => {
    if (!q) return true;
    const text = [
      event.actorDisplayName,
      event.eventType,
      event.stream,
      event.entityLabel,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return text.includes(q);
  });

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader title={C.title} description={C.description} />

      <div className="staff-toolbar">
        <label className="staff-search">
          <GlyphSearch className="ui-glyph staff-search-glyph" />
          <input
            type="search"
            className="staff-input staff-search-input"
            placeholder={C.search}
            value={params.get("q") ?? ""}
            onChange={event => setParam("q", event.target.value || null)}
            aria-label={C.search}
          />
        </label>
        <Select
          value={stream || "__all"}
          onValueChange={value =>
            setParam("stream", value === "__all" || !value ? null : value)
          }
        >
          <SelectTrigger
            size="sm"
            className="min-w-[9rem]"
            aria-label={C.stream}
          >
            <SelectValue placeholder={C.allStreams} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">{C.allStreams}</SelectItem>
            {STREAMS.map(item => (
              <SelectItem key={item} value={item}>
                {C.streams[item]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {events.isLoading || items === null ? (
        <LoadingRows />
      ) : filtered.length === 0 ? (
        <EmptyState title={C.empty} description={C.emptyHint} />
      ) : (
        <div className="staff-card !py-0">
          <div className="flex flex-col divide-y divide-[var(--staff-border)]">
            {filtered.map(event => (
              <div
                key={event.id}
                className="flex items-start justify-between gap-4 py-3"
              >
                <div className="min-w-0">
                  <span className="staff-muted text-xs">
                    {C.streams[event.stream]}
                  </span>
                  <strong className="block text-sm">
                    {humanize(event.eventType)}
                  </strong>
                  {event.entityLabel ? (
                    <p className="staff-muted break-words">
                      {event.entityLabel}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 text-end">
                  <StatusBadge
                    status={event.eventType.split(".").at(-1) ?? "active"}
                    label={humanize(
                      event.eventType.split(".").at(-1) ?? event.eventType
                    )}
                  />
                  <span className="staff-muted text-xs">
                    {event.actorDisplayName ?? C.system} ·{" "}
                    {formatDate(event.createdAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
