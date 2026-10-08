import { useEffect, useMemo, useRef, useState } from "react";
import { GlyphChevronLeft, GlyphChevronRight } from "./glyphs";
import { Spinner } from "@/staff/ui/kit";
import { cn } from "@/lib/utils";
import type {
  NccHourCellOpDto,
  NccHourCellRangeDto,
  NccHourCellStatusDto,
} from "@/lib/backend/api";
import { copy } from "../copy";
import {
  addDaysIso,
  cellKey,
  cellsToMap,
  DEFAULT_HOURS,
  diffOps,
  FULL_HOURS,
  sessionOverlays,
  toIsoDate,
  weekDates,
  zonedDateHour,
  type PaintStatus,
} from "../hour-cells";
import { intlLocale } from "../i18n";
import { ConfirmDialog } from "./confirm-dialog";
import { ActiveMark, LoadingRows } from "./primitives";

function weekdayLabel(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00Z`).toLocaleDateString(intlLocale(), {
    weekday: "short",
    timeZone: "UTC",
  });
}

/**
 * Reusable week grid for `hour-cells` resources (teachers now, rooms later).
 * Painting is local-only; the parent persists the batch diff via `onSave`,
 * which must resolve truthy on success.
 */
/** "5 Oct" for an ISO calendar date, in the UI language. */
function shortDate(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString(intlLocale(), {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function HourCellsGrid({
  range,
  loading,
  canPaint,
  anchor,
  onAnchorChange,
  onSave,
}: {
  /** Fetched range for the current week; `undefined` while loading. */
  range: NccHourCellRangeDto | null | undefined;
  loading: boolean;
  canPaint: boolean;
  /** ISO date inside the displayed week (parent owns it for the query). */
  anchor: string;
  /** Called after the discard-confirm when the week changes while dirty. */
  onAnchorChange: (nextAnchor: string) => void;
  onSave: (ops: NccHourCellOpDto[]) => Promise<boolean> | boolean;
}) {
  const C = copy.staffUsers;
  const [showFullDay, setShowFullDay] = useState(false);
  const [pen, setPen] = useState<PaintStatus>("available");
  const [edited, setEdited] = useState<Map<
    string,
    NccHourCellStatusDto
  > | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingNav, setPendingNav] = useState<(() => void) | null>(null);
  const dragging = useRef<PaintStatus | null>(null);

  const dates = useMemo(() => weekDates(anchor), [anchor]);
  const hours = showFullDay ? FULL_HOURS : DEFAULT_HOURS;
  const timezone = range?.timezone ?? "UTC";

  const baseline = useMemo(
    () => cellsToMap(range?.cells ?? []),
    [range?.cells]
  );
  const overlays = useMemo(
    () => sessionOverlays(range?.sessions ?? [], timezone),
    [range?.sessions, timezone]
  );

  // A fresh range (week change or refetch) replaces the working map.
  useEffect(() => {
    setEdited(baseline);
  }, [baseline]);

  useEffect(() => {
    const stop = () => {
      dragging.current = null;
    };
    window.addEventListener("pointerup", stop);
    return () => window.removeEventListener("pointerup", stop);
  }, []);

  const now = zonedDateHour(new Date().toISOString(), timezone);
  const cells = edited ?? baseline;
  const ops = diffOps(baseline, cells);
  const isDirty = ops.length > 0;

  function navigate(nextAnchor: string) {
    if (isDirty) {
      setPendingNav(() => () => {
        setEdited(null);
        onAnchorChange(nextAnchor);
      });
      return;
    }
    onAnchorChange(nextAnchor);
  }

  function paint(date: string, hour: number) {
    if (!canPaint || dragging.current === null) return;
    const key = cellKey(date, hour);
    if (overlays.has(key)) return;
    if (
      now &&
      (date < now.date || (date === now.date && hour <= now.hour))
    ) {
      return;
    }
    const status = dragging.current;
    setEdited(current => {
      const next = new Map(current ?? baseline);
      if (status === null) next.delete(key);
      else next.set(key, status);
      return next;
    });
  }

  async function save() {
    if (saving || ops.length === 0) return;
    setSaving(true);
    try {
      const ok = await onSave(ops);
      if (ok) setEdited(null); // resynced once the refetched range lands
    } finally {
      setSaving(false);
    }
  }

  function discard() {
    setEdited(new Map(baseline));
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="staff-toolbar">
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="staff-icon-btn"
            aria-label={C.weekPrevious}
            onClick={() => navigate(addDaysIso(anchor, -7))}
          >
            <GlyphChevronLeft />
          </button>
          <button
            type="button"
            className="staff-btn"
            data-size="sm"
            onClick={() => navigate(toIsoDate(new Date()))}
          >
            {C.weekToday}
          </button>
          <button
            type="button"
            className="staff-icon-btn"
            aria-label={C.weekNext}
            onClick={() => navigate(addDaysIso(anchor, 7))}
          >
            <GlyphChevronRight />
          </button>
          <span className="staff-muted ms-2">
            {shortDate(dates[0])} – {shortDate(dates[6])}
          </span>
          <span className="staff-muted ms-2">
            {C.timezoneLabel}: {timezone}
          </span>
        </div>
        <div className="ms-auto flex items-center gap-2">
          {canPaint ? (
            <div className="staff-tabs" role="toolbar" aria-label={C.availabilityTitle}>
              {(
                [
                  ["available", C.penAvailable],
                  ["unavailable", C.penUnavailable],
                  [null, C.penClear],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={label}
                  type="button"
                  className="staff-tab"
                  data-active={pen === value}
                  aria-pressed={pen === value}
                  onClick={() => setPen(value)}
                >
                  {pen === value ? <ActiveMark group="hour-pen" /> : null}
                  {label}
                </button>
              ))}
            </div>
          ) : null}
          <button
            type="button"
            className="staff-btn"
            data-size="sm"
            onClick={() => setShowFullDay(current => !current)}
          >
            {showFullDay ? C.showWorkHours : C.showAllHours}
          </button>
        </div>
      </div>

      {isDirty ? (
        <div className="staff-bulk-bar" role="status">
          <span>{C.unsavedBar}</span>
          <button
            type="button"
            className="staff-btn"
            data-size="sm"
            onClick={discard}
            disabled={saving}
          >
            {C.discardChanges}
          </button>
          <button
            type="button"
            className="staff-btn"
            data-variant="primary"
            data-size="sm"
            onClick={() => void save()}
            disabled={saving}
          >
            {saving ? (
              <Spinner aria-hidden />
            ) : null}
            {C.saveChanges}
          </button>
        </div>
      ) : null}

      {loading && !range ? (
        <LoadingRows rows={4} />
      ) : (
        <div
          className="staff-table-wrap"
          style={{ touchAction: "none" }}
        >
          <table className="staff-hours-grid">
            <thead>
              <tr>
                <th scope="col" className="staff-hours-hourcol" />
                {dates.map(date => (
                  <th
                    key={date}
                    scope="col"
                    data-today={date === toIsoDate(new Date())}
                  >
                    {weekdayLabel(date)}
                    <span className="block text-[11px] font-normal">
                      {shortDate(date)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {hours.map(hour => (
                <tr key={hour}>
                  <th scope="row" className="staff-hours-hourcol">
                    {String(hour).padStart(2, "0")}:00
                  </th>
                  {dates.map(date => {
                    const key = cellKey(date, hour);
                    const booked = overlays.get(key);
                    const status = cells.get(key);
                    return (
                      <td key={key} className="p-0.5">
                        <button
                          type="button"
                          className={cn("staff-hour-cell")}
                          data-status={
                            booked
                              ? "booked"
                              : (status ?? "empty")
                          }
                          data-start={booked?.isStart || undefined}
                          disabled={!canPaint || Boolean(booked)}
                          aria-label={`${date} ${String(hour).padStart(2, "0")}:00`}
                          title={booked ? booked.session.className : undefined}
                          onPointerDown={event => {
                            if (!canPaint || booked) return;
                            event.preventDefault();
                            dragging.current = pen;
                            const keyInner = key;
                            if (overlays.has(keyInner)) return;
                            if (
                              now &&
                              (date < now.date ||
                                (date === now.date && hour <= now.hour))
                            ) {
                              return;
                            }
                            setEdited(current => {
                              const next = new Map(current ?? baseline);
                              if (pen === null) next.delete(keyInner);
                              else next.set(keyInner, pen);
                              return next;
                            });
                          }}
                          onPointerEnter={() => paint(date, hour)}
                        >
                          {booked?.isStart ? (
                            <span className="staff-hour-session">
                              {booked.session.className}
                            </span>
                          ) : booked ? (
                            <span className="staff-hour-session-continued" />
                          ) : null}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="staff-muted">{C.availabilityHint}</p>

      <ConfirmDialog
        open={pendingNav !== null}
        onOpenChange={open => {
          if (!open) setPendingNav(null);
        }}
        title={C.discardTitle}
        description={C.discardBody}
        confirmLabel={C.discardChanges}
        destructive
        onConfirm={() => {
          pendingNav?.();
          setPendingNav(null);
        }}
      />
    </div>
  );
}
