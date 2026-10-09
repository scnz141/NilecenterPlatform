import { useMemo } from "react";
import { useLocation, useSearch } from "wouter";
import { GlyphSearch } from "../ui/glyphs";
import type {
  NccAuditEventDto,
  NccAuditStreamDto,
  NccRole,
} from "@/lib/backend/api";
import { useNcc } from "../api";
import { copy } from "../copy";
import { intlLocale } from "../i18n";
import { useStaffSession } from "../session";
import {
  ActiveMark,
  Avatar,
  EmptyState,
  ErrorState,
  LoadingRows,
  PageHeader,
} from "../ui/primitives";

const C = copy.audit;
const LIMIT = 100;

const AUDIT_ROLES: NccRole[] = ["super_admin", "branch_admin", "vice_manager"];

/** Streams grouped the way staff think about them. Each group has at most four. */
const GROUPS = {
  auth: ["auth"],
  admissions: ["lead", "student", "placement_test", "enrolment"],
  teaching: ["course", "class", "session", "room"],
  setup: ["branch", "department", "custom_field", "moodle_site"],
} satisfies Record<string, NccAuditStreamDto[]>;

type Group = keyof typeof GROUPS;
const GROUP_KEYS = Object.keys(GROUPS) as Group[];

type Tone = "positive" | "critical" | "neutral";

const POSITIVE = new Set([
  "login_success",
  "created",
  "enabled",
  "completed",
  "converted",
  "enrolled",
  "invitation_accepted",
  "moodle_group_created",
  "moodle_linked",
]);
const CRITICAL = new Set([
  "login_failed",
  "disabled",
  "cancelled",
  "moodle_group_deleted",
]);

function humanize(value: string) {
  return value.replace(/[_.-]/g, " ");
}

/** One plain sentence per event: actor, what they did, and to what. */
export function describeEvent(event: NccAuditEventDto) {
  const type = event.eventType.split(".").at(-1) ?? event.eventType;
  const noun = C.nouns[event.stream];
  const special = (C.actions as Record<string, string>)[type];
  const verb = (C.verbs as Record<string, string>)[type];
  const action = special
    ? special
    : verb
      ? verb.replace("{noun}", noun)
      : C.verbs.other.replace("{action}", humanize(type)).replace("{noun}", noun);
  const actor =
    event.actorDisplayName ??
    (type === "login_failed" ? C.failedSignIn : C.system);
  // Sign-in events name the same person twice; show the entity only when it adds something.
  const entity =
    event.entityLabel && event.entityLabel !== event.actorDisplayName
      ? event.entityLabel
      : null;
  const tone: Tone = POSITIVE.has(type)
    ? "positive"
    : CRITICAL.has(type)
      ? "critical"
      : "neutral";
  return { actor, action, entity, tone };
}

function localDayKey(iso: string) {
  const date = new Date(iso);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function dayLabel(iso: string, now = new Date()) {
  const date = new Date(iso);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (localDayKey(iso) === localDayKey(now.toISOString())) return C.today;
  if (localDayKey(iso) === localDayKey(yesterday.toISOString())) return C.yesterday;
  return date.toLocaleDateString(intlLocale(), {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString(intlLocale(), {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AuditPage() {
  const { session } = useStaffSession();
  const role = session?.ncc?.activeRole ?? null;
  const allowed = role !== null && AUDIT_ROLES.includes(role);

  const search = useSearch();
  const [, navigate] = useLocation();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const groupParam = params.get("group");
  const group: Group | null = GROUP_KEYS.includes(groupParam as Group)
    ? (groupParam as Group)
    : null;
  const q = (params.get("q") ?? "").trim().toLowerCase();

  // "All" reads the newest events. A group reads each of its streams, so busy
  // sign-in traffic never pushes admissions or teaching events out of view.
  const streams: (NccAuditStreamDto | null)[] = group
    ? [...GROUPS[group], null, null, null].slice(0, 4)
    : [null, null, null, null];
  const path = (stream: NccAuditStreamDto | null) =>
    allowed && stream ? "/api/ncc/audit/events" : null;
  const all = useNcc<{ items: NccAuditEventDto[] }>(
    allowed && !group ? "/api/ncc/audit/events" : null,
    { limit: LIMIT }
  );
  const s0 = useNcc<{ items: NccAuditEventDto[] }>(path(streams[0]), { stream: streams[0] ?? undefined, limit: LIMIT });
  const s1 = useNcc<{ items: NccAuditEventDto[] }>(path(streams[1]), { stream: streams[1] ?? undefined, limit: LIMIT });
  const s2 = useNcc<{ items: NccAuditEventDto[] }>(path(streams[2]), { stream: streams[2] ?? undefined, limit: LIMIT });
  const s3 = useNcc<{ items: NccAuditEventDto[] }>(path(streams[3]), { stream: streams[3] ?? undefined, limit: LIMIT });
  const reads = group ? [s0, s1, s2, s3].filter((_, i) => streams[i]) : [all];

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(search);
    if (value === null || value === "") next.delete(key);
    else next.set(key, value);
    navigate(`?${next.toString()}`, { replace: true });
  }

  const error = reads.find(read => read.error)?.error;
  const loading = reads.some(read => read.isLoading || !read.data);
  const items = loading
    ? null
    : reads
        .flatMap(read => read.data?.items ?? [])
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  if (!allowed) {
    return <EmptyState title={copy.shell.noAccess} description={C.noAccess} />;
  }

  const rows = (items ?? [])
    .map(event => ({ event, text: describeEvent(event) }))
    .filter(({ event, text }) => {
      if (!q) return true;
      return [text.actor, text.action, text.entity, C.streams[event.stream]]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });

  const days: { key: string; label: string; rows: typeof rows }[] = [];
  for (const row of rows) {
    const key = localDayKey(row.event.createdAt);
    const last = days.at(-1);
    if (last?.key === key) last.rows.push(row);
    else days.push({ key, label: dayLabel(row.event.createdAt), rows: [row] });
  }

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <PageHeader title={C.title} description={C.description} />

      <div className="staff-toolbar">
        <div className="staff-segments" role="group" aria-label={C.stream}>
          {([null, ...GROUP_KEYS] as (Group | null)[]).map(key => (
            <button
              key={key ?? "all"}
              type="button"
              className="staff-segment"
              data-active={group === key}
              aria-pressed={group === key}
              onClick={() => setParam("group", key)}
            >
              {group === key ? <ActiveMark group="audit-group" /> : null}
              {key ? C.groups[key] : C.groups.all}
            </button>
          ))}
        </div>
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
      </div>

      {error ? (
        <ErrorState
          error={error}
          onRetry={() => reads.forEach(read => void read.mutate())}
        />
      ) : items === null ? (
        <LoadingRows />
      ) : rows.length === 0 ? (
        <EmptyState title={C.empty} description={C.emptyHint} />
      ) : (
        <div className="staff-log">
          {days.map(day => (
            <section key={day.key} className="staff-log-day" aria-label={day.label}>
              <h2 className="staff-log-day-label">
                {day.label}
                <span className="staff-log-day-count">{day.rows.length}</span>
              </h2>
              <ol className="staff-log-list">
                {day.rows.map(({ event, text }) => (
                  <li key={event.id} className="staff-log-row" data-tone={text.tone}>
                    <time className="staff-log-time" dateTime={event.createdAt}>
                      {timeLabel(event.createdAt)}
                    </time>
                    <Avatar name={text.actor} seed={event.actorUserId ?? text.actor} size="sm" />
                    <p className="staff-log-text">
                      <strong>{text.actor}</strong> {text.action}
                      {text.entity ? (
                        <>
                          {" "}
                          <span className="staff-log-entity">{text.entity}</span>
                        </>
                      ) : null}
                    </p>
                    <span className="staff-log-stream">{C.streams[event.stream]}</span>
                  </li>
                ))}
              </ol>
            </section>
          ))}
          <p className="staff-log-foot">
            {C.latest.replace("{n}", String(LIMIT))}
          </p>
        </div>
      )}
    </div>
  );
}
