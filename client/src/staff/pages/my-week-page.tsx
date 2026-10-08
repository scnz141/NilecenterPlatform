import { useMemo, useState } from "react";
import useSWR from "swr";
import { Link } from "wouter";
import type {
  NccAttendanceSessionSummaryDto,
  NccSessionDto,
  NccTeacherWorkspaceDto,
} from "@/lib/backend/api";
import { staffGet, useNcc } from "../api";
import { copy } from "../copy";
import { addDaysIso, toIsoDate, weekDates } from "../hour-cells";
import { intlLocale } from "../i18n";
import { useStaffSession } from "../session";
import { attendanceFor, weekAgenda, type WeekEntry } from "../teaching";
import { GlyphChevronLeft, GlyphChevronRight } from "../ui/glyphs";
import { EmptyState, ErrorState, LoadingRows, PageHeader, StatusBadge } from "../ui/primitives";
import { dayKey } from "./booking-list";
import { AttendanceSheet } from "./class-attendance";

const W = copy.teaching.week;
const A = copy.teaching.attendance;

type ClassWeek = {
  classId: string;
  className: string;
  sessions: NccSessionDto[];
  attendance: NccAttendanceSessionSummaryDto[];
};

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString(intlLocale(), { hour: "numeric", minute: "2-digit" });
const shortDate = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString(intlLocale(), {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

/** A teacher's week across every class they teach, with attendance to take. */
export default function MyWeekPage() {
  const { session } = useStaffSession();
  const workspace = useNcc<{ workspace: NccTeacherWorkspaceDto }>("/api/ncc/delivery/teacher-workspace");
  const classes = workspace.data?.workspace.classes ?? [];
  const ids = classes.map(item => item.id).join(",");
  // One key for the whole week feed; refreshed after attendance is saved.
  const feed = useSWR<ClassWeek[]>(
    workspace.data ? [session?.userId, "teacher-week", ids] : null,
    () =>
      Promise.all(
        classes.map(async item => {
          const base = `/api/ncc/delivery/classes/${encodeURIComponent(item.id)}`;
          const [sessions, attendance] = await Promise.all([
            staffGet<{ items: NccSessionDto[] }>(`${base}/sessions`),
            // A class without a Moodle group has no attendance sessions yet.
            staffGet<{ items: NccAttendanceSessionSummaryDto[] }>(`${base}/attendance/sessions`).catch(() => ({
              items: [],
            })),
          ]);
          return { classId: item.id, className: item.name, sessions: sessions.items, attendance: attendance.items };
        })
      ),
    { revalidateOnFocus: false }
  );
  const [anchor, setAnchor] = useState(() => toIsoDate(new Date()));
  const [open, setOpen] = useState<{ classId: string; summary: NccAttendanceSessionSummaryDto } | null>(null);
  const dates = useMemo(() => weekDates(anchor), [anchor]);
  const today = toIsoDate(new Date());

  const entries: WeekEntry<NccSessionDto>[] = (feed.data ?? []).flatMap(item =>
    item.sessions.map(value => ({ session: value, classId: item.classId, className: item.className }))
  );
  const days = weekAgenda(entries, dates, iso => dayKey(iso));
  const attendanceOf = (classId: string) => feed.data?.find(item => item.classId === classId)?.attendance ?? [];
  const weekEntries = Array.from(days.values()).flat();
  const hours = weekEntries.reduce((sum, entry) => sum + entry.session.durationHours, 0);
  const pending = weekEntries.filter(entry => {
    const moodle = attendanceFor(entry.session.id, attendanceOf(entry.classId));
    return moodle && !moodle.lastTaken && Date.parse(entry.session.startsAt) <= Date.now();
  }).length;

  const error = workspace.error ?? feed.error;
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader title={W.title} description={W.description} />
      <div className="staff-toolbar">
        <div className="flex items-center gap-1">
          <button type="button" className="staff-icon-btn" aria-label={W.previous} onClick={() => setAnchor(addDaysIso(anchor, -7))}>
            <GlyphChevronLeft />
          </button>
          <button type="button" className="staff-btn" data-size="sm" onClick={() => setAnchor(today)}>
            {W.thisWeek}
          </button>
          <button type="button" className="staff-icon-btn" aria-label={W.next} onClick={() => setAnchor(addDaysIso(anchor, 7))}>
            <GlyphChevronRight />
          </button>
          <span className="staff-muted ms-2">
            {shortDate(dates[0])} – {shortDate(dates[6])}
          </span>
        </div>
        {feed.data ? (
          <span className="staff-muted staff-figures ms-auto">
            {weekEntries.length} {W.sessions} · {hours} {W.hours}
            {pending ? (
              <>
                {" · "}
                <strong className="staff-text-caution">
                  {pending} {W.needAttendance}
                </strong>
              </>
            ) : null}
          </span>
        ) : null}
      </div>

      {error ? (
        <ErrorState error={error} onRetry={() => void (workspace.error ? workspace.mutate() : feed.mutate())} />
      ) : !feed.data ? (
        <LoadingRows rows={5} />
      ) : weekEntries.length === 0 ? (
        <EmptyState title={W.empty} />
      ) : (
        <div className="staff-section staff-week">
          {dates.map(date => {
            const list = days.get(date) ?? [];
            return (
              <div key={date} className="staff-week-day" data-today={date === today || undefined}>
                <h3 className="staff-day-label">
                  {new Date(`${date}T12:00:00Z`).toLocaleDateString(intlLocale(), {
                    weekday: "long",
                    day: "numeric",
                    month: "short",
                    timeZone: "UTC",
                  })}
                  {date === today ? <span className="staff-tag">{copy.teaching.sessions.today}</span> : null}
                </h3>
                {list.length === 0 ? (
                  <p className="staff-muted staff-week-free">{W.dayOff}</p>
                ) : (
                  <ul className="staff-agenda-list">
                    {list.map(entry => {
                      const moodle = attendanceFor(entry.session.id, attendanceOf(entry.classId));
                      const started = Date.parse(entry.session.startsAt) <= Date.now();
                      return (
                        <li key={entry.session.id} className="staff-agenda-item staff-session-item">
                          <span className="staff-agenda-time">
                            {time(entry.session.startsAt)}–{time(entry.session.endsAt)}
                          </span>
                          <span className="staff-agenda-body">
                            <Link href={`/app/classes/${entry.classId}`} className="staff-agenda-name">
                              {entry.className}
                            </Link>
                            <span className="staff-muted">{entry.session.roomName ?? copy.teaching.sessions.online}</span>
                          </span>
                          <span className="staff-row-actions">
                            {moodle ? (
                              <>
                                {started ? (
                                  <StatusBadge
                                    status={moodle.lastTaken ? "completed" : "pending"}
                                    label={moodle.lastTaken ? A.taken : A.notTaken}
                                  />
                                ) : null}
                                <button
                                  type="button"
                                  className="staff-btn"
                                  data-size="sm"
                                  data-variant={started && !moodle.lastTaken ? "primary" : undefined}
                                  onClick={() => setOpen({ classId: entry.classId, summary: moodle })}
                                >
                                  {A.take}
                                </button>
                              </>
                            ) : (
                              <span className="staff-muted">{W.noMoodle}</span>
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      <AttendanceSheet
        classId={open?.classId ?? ""}
        session={open?.summary ?? null}
        onOpenChange={value => !value && setOpen(null)}
        onSaved={() => void feed.mutate()}
      />
    </div>
  );
}
