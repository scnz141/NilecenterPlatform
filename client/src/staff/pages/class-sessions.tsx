import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  cancelNccSessionRequest,
  confirmNccClassSessionsRequest,
  patchNccSessionRequest,
  proposeNccClassSessionsRequest,
  type NccBranchDto,
  type NccClassDto,
  type NccSessionDto,
  type NccSessionSlotDto,
} from "@/lib/backend/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/staff/ui/kit";
import { staffWrite, useInvalidate, useNcc } from "../api";
import { copy } from "../copy";
import { zonedDateHour, zonedInstant } from "../hour-cells";
import { intlLocale } from "../i18n";
import { FormValidationError, runAction } from "../run-action";
import {
  WEEKDAYS,
  defaultPlanRows,
  sessionLocked,
  splitSessions,
  validatePlan,
  weekdayName,
  type PlanRow,
} from "../teaching";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { FormSheet, StaffField } from "../ui/form-sheet";
import { ActiveMark, EmptyState, ErrorState, LoadingRows } from "../ui/primitives";
import { useBranchRooms } from "./admissions-ui";
import { dayKey } from "./booking-list";

const S = copy.teaching.sessions;
const T = copy.teaching;

function timeIn(iso: string, timeZone?: string) {
  return new Date(iso).toLocaleTimeString(intlLocale(), {
    hour: "numeric",
    minute: "2-digit",
    ...(timeZone ? { timeZone } : {}),
  });
}

function dayHeading(iso: string, timeZone?: string) {
  return new Date(iso).toLocaleDateString(intlLocale(), {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(timeZone ? { timeZone } : {}),
  });
}

function groupByDay<T extends { startsAt: string }>(items: T[], timeZone?: string) {
  const days = new Map<string, T[]>();
  for (const item of items) {
    const key = dayKey(item.startsAt, timeZone);
    days.set(key, [...(days.get(key) ?? []), item]);
  }
  return Array.from(days.values());
}

const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T12:00:00Z`) + days * 864e5).toISOString().slice(0, 10);

/* ---------------- Plan sessions ------------------------------------- */

function PlanSheet({
  open,
  onOpenChange,
  item,
  timeZone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: NccClassDto;
  timeZone: string;
}) {
  const invalidate = useInvalidate();
  const rooms = useBranchRooms(item.branchId, open);
  const today = zonedDateHour(new Date().toISOString(), timeZone)?.date ?? new Date().toISOString().slice(0, 10);
  const classEnd = item.endAt.slice(0, 10);
  const initial = useMemo(() => {
    const from = addDays(today, 1);
    const to = classEnd < addDays(from, 27) ? classEnd : addDays(from, 27);
    const rows = defaultPlanRows(item);
    return { rows: rows.length ? rows : [{ weekday: 0, hours: 1 }], from, to };
  }, [item, today, classEnd]);
  const [rows, setRows] = useState<PlanRow[]>(initial.rows);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [slots, setSlots] = useState<NccSessionSlotDto[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRows(initial.rows);
    setFrom(initial.from);
    setTo(initial.to);
    setSlots(null);
    setMessage(null);
    setAttempted(false);
  }, [open, initial]);

  const edit = (next: () => void) => {
    next();
    setSlots(null);
    setMessage(null);
  };
  const problem = validatePlan(rows, from, to);
  const roomName = (id: string | null) => rooms.find(room => room.id === id)?.name ?? null;

  async function submit() {
    setAttempted(true);
    if (problem) throw new FormValidationError();
    setSaving(true);
    try {
      if (!slots) {
        const result = await proposeNccClassSessionsRequest(item.id, {
          weekdayHours: rows,
          fromDate: from,
          toDate: to,
        });
        if (!result.ok || !result.data) {
          // EMS explains availability gaps in words; show them in place.
          setMessage(result.status === 400 ? S.noMatch : (result.error ?? copy.state.errorGeneric));
          throw new FormValidationError();
        }
        setSlots(result.data.slots);
        if (result.data.slots.length === 0) setMessage(S.noMatch);
        throw new FormValidationError();
      }
      await staffWrite(
        confirmNccClassSessionsRequest(item.id, {
          slots: slots.map(slot => ({
            startsAt: slot.startsAt,
            durationHours: slot.durationHours,
            teacherId: slot.teacherId,
            roomId: slot.roomId,
          })),
        })
      );
      await invalidate(`/api/ncc/delivery/classes/${item.id}`);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  const ready = Boolean(slots && slots.length);
  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={S.planTitle}
      description={S.planDescription}
      dirty={ready}
      saving={saving}
      saveLabel={ready ? S.book : S.findTimes}
      onSubmit={() => runAction(submit, { success: S.bookedToast })}
    >
      <div className="staff-plan-rows">
        {rows.map((row, index) => (
          <div key={index} className="staff-plan-row">
            <StaffField label={S.weekday}>
              <Select
                value={String(row.weekday)}
                onValueChange={value =>
                  edit(() => setRows(rows.map((r, i) => (i === index ? { ...r, weekday: Number(value) } : r))))
                }
              >
                <SelectTrigger aria-label={S.weekday}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEEKDAYS.map(day => (
                    <SelectItem key={day} value={String(day)}>
                      {weekdayName(day, "long")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </StaffField>
            <StaffField label={S.hours}>
              <Select
                value={String(row.hours)}
                onValueChange={value =>
                  edit(() => setRows(rows.map((r, i) => (i === index ? { ...r, hours: Number(value) } : r))))
                }
              >
                <SelectTrigger aria-label={S.hours}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6].map(hours => (
                    <SelectItem key={hours} value={String(hours)}>
                      {hours} {T.hourUnit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </StaffField>
            <button
              type="button"
              className="staff-icon-btn staff-plan-remove"
              aria-label={S.removeDay}
              title={S.removeDay}
              disabled={rows.length === 1}
              onClick={() => edit(() => setRows(rows.filter((_, i) => i !== index)))}
            >
              <Trash2 strokeWidth={1.75} aria-hidden />
            </button>
          </div>
        ))}
        {rows.length < 7 ? (
          <button
            type="button"
            className="staff-btn w-fit"
            data-size="sm"
            onClick={() =>
              edit(() => {
                const free = WEEKDAYS.find(day => !rows.some(row => row.weekday === day)) ?? 0;
                setRows([...rows, { weekday: free, hours: rows.at(-1)?.hours ?? 1 }]);
              })
            }
          >
            <Plus strokeWidth={1.75} aria-hidden />
            {S.addDay}
          </button>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <StaffField label={S.fromDate} htmlFor="plan-from">
          <input
            id="plan-from"
            type="date"
            className="staff-input"
            value={from}
            min={today}
            onChange={event => edit(() => setFrom(event.target.value))}
          />
        </StaffField>
        <StaffField label={S.toDate} htmlFor="plan-to">
          <input
            id="plan-to"
            type="date"
            className="staff-input"
            value={to}
            min={from}
            max={classEnd}
            onChange={event => edit(() => setTo(event.target.value))}
          />
        </StaffField>
      </div>
      {attempted && problem ? (
        <p className="staff-field-error" role="alert">
          {problem === "wholeNumber" ? T.wholeNumber : S[problem]}
        </p>
      ) : null}
      {message ? (
        <p className="staff-banner" data-tone="caution" role="status">
          {message}
        </p>
      ) : null}
      {slots && slots.length ? (
        <section className="staff-proposal" aria-label={S.proposed}>
          <h3 className="staff-day-label">
            {S.proposed} · {slots.length}
          </h3>
          <ul className="staff-agenda-list">
            {slots.map(slot => {
              const end = new Date(Date.parse(slot.startsAt) + slot.durationHours * 3600e3).toISOString();
              return (
                <li key={slot.startsAt} className="staff-agenda-item">
                  <span className="staff-agenda-time">
                    {new Date(slot.startsAt).toLocaleDateString(intlLocale(), {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      timeZone,
                    })}
                  </span>
                  <span className="staff-agenda-body">
                    <span className="staff-agenda-name">
                      {timeIn(slot.startsAt, timeZone)}–{timeIn(end, timeZone)}
                    </span>
                    <span className="staff-muted">
                      {slot.durationHours} {T.hourUnit}
                      {roomName(slot.roomId) ? ` · ${roomName(slot.roomId)}` : item.meetingUrl ? ` · ${S.online}` : ""}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </FormSheet>
  );
}

/* ---------------- Change one session -------------------------------- */

function RescheduleSheet({
  session,
  onOpenChange,
  timeZone,
}: {
  session: NccSessionDto | null;
  onOpenChange: (open: boolean) => void;
  timeZone: string;
}) {
  const invalidate = useInvalidate();
  const start = session ? zonedDateHour(session.startsAt, timeZone) : null;
  const [date, setDate] = useState(start?.date ?? "");
  const [hour, setHour] = useState(String(start?.hour ?? 10));
  const [length, setLength] = useState(String(session?.durationHours ?? 1));
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!session) return;
    const value = zonedDateHour(session.startsAt, timeZone);
    setDate(value?.date ?? "");
    setHour(String(value?.hour ?? 10));
    setLength(String(session.durationHours));
    setMessage(null);
  }, [session, timeZone]);

  async function submit() {
    if (!session) return;
    const startsAt = zonedInstant(date, Number(hour), timeZone);
    if (!startsAt) throw new FormValidationError();
    setSaving(true);
    setMessage(null);
    try {
      const result = await patchNccSessionRequest(session.id, {
        startsAt,
        durationHours: Number(length),
      });
      if (!result.ok) {
        setMessage(
          result.status === 400 && /availability/i.test(result.error ?? "")
            ? S.noMatch
            : (result.error ?? copy.state.errorGeneric)
        );
        throw new FormValidationError();
      }
      await invalidate(`/api/ncc/delivery/classes/${session.classId}`);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormSheet
      open={session !== null}
      onOpenChange={onOpenChange}
      title={S.rescheduleTitle}
      description={S.rescheduleDescription}
      dirty={false}
      saving={saving}
      saveLabel={copy.catalog.shared.saveChanges}
      onSubmit={() => runAction(submit, { success: S.movedToast })}
    >
      <StaffField label={copy.admissions.booking.when} htmlFor="session-date">
        <div className="staff-when">
          <input
            id="session-date"
            type="date"
            className="staff-input"
            value={date}
            onChange={event => setDate(event.target.value)}
          />
          <Select value={hour} onValueChange={setHour}>
            <SelectTrigger aria-label={copy.admissions.booking.hour}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 24 }, (_, value) => (
                <SelectItem key={value} value={String(value)}>
                  {new Date(Date.UTC(2026, 0, 1, value)).toLocaleTimeString(intlLocale(), {
                    hour: "numeric",
                    minute: "2-digit",
                    timeZone: "UTC",
                  })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <span className="staff-hint">
          {copy.admissions.booking.timeZone}: {timeZone}. {copy.admissions.booking.onTheHour}
        </span>
      </StaffField>
      <StaffField label={S.length}>
        <Select value={length} onValueChange={setLength}>
          <SelectTrigger aria-label={S.length}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 3, 4, 5, 6].map(value => (
              <SelectItem key={value} value={String(value)}>
                {value} {T.hourUnit}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </StaffField>
      {message ? (
        <p className="staff-banner" data-tone="caution" role="status">
          {message}
        </p>
      ) : null}
    </FormSheet>
  );
}

/* ---------------- Tab ----------------------------------------------- */

type View = "upcoming" | "past" | "cancelled";

export function ClassSessions({
  item,
  branch,
  canWrite,
}: {
  item: NccClassDto;
  branch: NccBranchDto | undefined;
  canWrite: boolean;
}) {
  // Teachers cannot read branches; fall back to the device's zone.
  const timeZone = branch?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const invalidate = useInvalidate();
  const sessions = useNcc<{ items: NccSessionDto[] }>(
    `/api/ncc/delivery/classes/${encodeURIComponent(item.id)}/sessions`
  );
  const [view, setView] = useState<View>("upcoming");
  const [planning, setPlanning] = useState(false);
  const [moving, setMoving] = useState<NccSessionDto | null>(null);
  const [cancelling, setCancelling] = useState<NccSessionDto | null>(null);

  if (sessions.error) return <ErrorState error={sessions.error} onRetry={() => void sessions.mutate()} />;
  if (!sessions.data) return <LoadingRows rows={4} />;
  const split = splitSessions(sessions.data.items);
  const shown = split[view];
  const labels: Record<View, string> = { upcoming: S.upcoming, past: S.past, cancelled: S.cancelled };

  return (
    <section className="flex flex-col gap-4">
      <div className="staff-toolbar">
        <div className="staff-segments" role="group" aria-label={copy.teaching.classes.tabSessions}>
          {(["upcoming", "past", "cancelled"] as const).map(value => (
            <button
              key={value}
              type="button"
              className="staff-segment"
              data-active={view === value}
              aria-pressed={view === value}
              onClick={() => setView(value)}
            >
              {view === value ? <ActiveMark group="class-sessions" /> : null}
              {labels[value]}
              <span className="staff-segment-count">{split[value].length}</span>
            </button>
          ))}
        </div>
        {canWrite && item.status === "active" ? (
          <div className="staff-toolbar-end">
            <button type="button" className="staff-btn" data-variant="primary" data-size="sm" onClick={() => setPlanning(true)}>
              <Plus strokeWidth={1.75} aria-hidden />
              {S.plan}
            </button>
          </div>
        ) : null}
      </div>

      {shown.length === 0 ? (
        <EmptyState title={S.empty} description={canWrite && view === "upcoming" ? S.emptyHint : undefined} />
      ) : (
        <div className="staff-section staff-sessions">
          {groupByDay(shown, timeZone).map(day => (
            <div key={day[0].id} className="staff-session-day">
              <h3 className="staff-day-label">{dayHeading(day[0].startsAt, timeZone)}</h3>
              <ul className="staff-agenda-list">
                {day.map(session => {
                  const locked = sessionLocked(session);
                  return (
                    <li key={session.id} className="staff-agenda-item staff-session-item" data-status={session.status}>
                      <span className="staff-agenda-time">
                        {timeIn(session.startsAt, timeZone)}–{timeIn(session.endsAt, timeZone)}
                      </span>
                      <span className="staff-agenda-body">
                        <span className="staff-agenda-name">
                          {session.teacherName ?? copy.teaching.classes.noTeacher}
                        </span>
                        <span className="staff-muted">
                          {session.durationHours} {T.hourUnit} · {session.roomName ?? S.online}
                        </span>
                      </span>
                      {canWrite && !locked ? (
                        <span className="staff-row-actions">
                          <button type="button" className="staff-btn" data-size="sm" onClick={() => setMoving(session)}>
                            {S.reschedule}
                          </button>
                          <button
                            type="button"
                            className="staff-btn"
                            data-size="sm"
                            data-variant="quiet-danger"
                            onClick={() => setCancelling(session)}
                          >
                            {S.cancel}
                          </button>
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      <PlanSheet open={planning} onOpenChange={setPlanning} item={item} timeZone={timeZone} />
      <RescheduleSheet session={moving} onOpenChange={open => !open && setMoving(null)} timeZone={timeZone} />
      <ConfirmDialog
        open={cancelling !== null}
        onOpenChange={open => !open && setCancelling(null)}
        title={S.cancelTitle}
        description={S.cancelBody}
        confirmLabel={S.cancel}
        destructive
        onConfirm={() =>
          runAction(
            async () => {
              if (!cancelling) return;
              await staffWrite(cancelNccSessionRequest(cancelling.id));
              await invalidate(`/api/ncc/delivery/classes/${item.id}`);
            },
            { success: S.cancelledToast }
          )
        }
      />
    </section>
  );
}
