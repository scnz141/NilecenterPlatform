import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import {
  addDays,
  addMonths,
  clampDate,
  formatDayNumber,
  formatFieldDate,
  formatLongDate,
  formatMonthYear,
  formatYear,
  inRange,
  isIsoDate,
  monthGrid,
  monthNamesShort,
  sameMonth,
  startOfMonth,
  startOfWeek,
  todayIso,
  weekStartsOn,
  weekdayNames,
} from "../calendar";
import { copy } from "../copy";
import { GlyphCalendar, GlyphChevronLeft, GlyphChevronRight } from "./glyphs";
import { Popover, PopoverContent, PopoverTrigger } from "./kit";

type View = "days" | "months";

/**
 * Date field for the staff app. The value is a plain ISO date ("2026-10-10")
 * or "". The field shows the date in the UI language; the calendar opens on
 * the selected date, respects `min` and `max`, and works fully by keyboard:
 * arrows move a day or a week (mirrored in right-to-left layouts), Home and
 * End go to the week's edges, Page Up and Page Down change month, with Shift
 * they change year, Enter picks, Escape closes.
 */
export function DatePicker({
  id,
  value,
  onChange,
  min,
  max,
  placeholder,
  invalid,
  clearable = false,
  disabled = false,
  rangeStart,
  rangeEnd,
  className,
  "aria-label": ariaLabel,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  invalid?: boolean;
  /** Shows Clear; for optional dates. */
  clearable?: boolean;
  disabled?: boolean;
  /** Shades a range in the calendar, for From and To pairs. */
  rangeStart?: string;
  rangeEnd?: string;
  className?: string;
  "aria-label"?: string;
}) {
  const D = copy.datePicker;
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("days");
  const [cursor, setCursor] = useState(() => initialCursor(value, min, max));
  const [direction, setDirection] = useState<"next" | "prev" | null>(null);
  const grid = useRef<HTMLDivElement>(null);
  const focusCursor = useRef(false);

  const today = todayIso();
  const firstDay = weekStartsOn();
  const valid = isIsoDate(value) ? value : "";
  const month = startOfMonth(cursor);
  const days = useMemo(() => monthGrid(month, firstDay), [month, firstDay]);
  const names = useMemo(() => weekdayNames(firstDay), [firstDay]);
  const rtl = typeof document !== "undefined" && document.documentElement.dir === "rtl";

  function openChange(next: boolean) {
    if (disabled) return;
    if (next) {
      setCursor(initialCursor(valid, min, max));
      setView("days");
      setDirection(null);
      focusCursor.current = true;
    }
    setOpen(next);
  }

  // Keyboard moves focus with the cursor; pointer use on the header keeps its focus.
  useEffect(() => {
    if (!open || view !== "days" || !focusCursor.current) return;
    focusCursor.current = false;
    const frame = requestAnimationFrame(() => {
      grid.current
        ?.querySelector<HTMLButtonElement>(`[data-iso="${cursor}"]`)
        ?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [open, view, cursor]);

  function move(next: string, focus = true) {
    if (!sameMonth(next, cursor)) setDirection(next > cursor ? "next" : "prev");
    focusCursor.current = focus;
    setCursor(next);
  }

  function pick(iso: string) {
    if (!inRange(iso, min, max)) return;
    onChange(iso);
    setOpen(false);
  }

  function onGridKey(event: KeyboardEvent<HTMLDivElement>) {
    const forward = rtl ? -1 : 1;
    const steps: Record<string, () => string> = {
      ArrowRight: () => addDays(cursor, forward),
      ArrowLeft: () => addDays(cursor, -forward),
      ArrowDown: () => addDays(cursor, 7),
      ArrowUp: () => addDays(cursor, -7),
      Home: () => startOfWeek(cursor, firstDay),
      End: () => addDays(startOfWeek(cursor, firstDay), 6),
      PageDown: () => addMonths(cursor, event.shiftKey ? 12 : 1),
      PageUp: () => addMonths(cursor, event.shiftKey ? -12 : -1),
    };
    const step = steps[event.key];
    if (step) {
      event.preventDefault();
      move(step());
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      pick(cursor);
    }
  }

  const canPrevMonth = !min || startOfMonth(min) < month;
  const canNextMonth = !max || startOfMonth(max) > month;
  const year = Number(cursor.slice(0, 4));
  const canPrevYear = !min || Number(min.slice(0, 4)) < year;
  const canNextYear = !max || Number(max.slice(0, 4)) > year;
  const todayAllowed = inRange(today, min, max);
  const lo = rangeStart && rangeEnd && rangeStart <= rangeEnd ? rangeStart : undefined;
  const hi = lo ? rangeEnd : undefined;

  return (
    <Popover open={open} onOpenChange={openChange}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          className={cn("ui-field staff-date-trigger", className)}
          data-empty={valid ? undefined : ""}
          aria-invalid={invalid || undefined}
          aria-haspopup="dialog"
          aria-label={ariaLabel ? `${ariaLabel}: ${valid ? formatLongDate(valid) : D.placeholder}` : undefined}
          disabled={disabled}
        >
          <span className="staff-date-text">
            {valid ? formatFieldDate(valid) : (placeholder ?? D.placeholder)}
          </span>
          <GlyphCalendar className="ui-glyph staff-date-glyph" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="staff-datepicker"
        aria-label={D.calendar}
        collisionPadding={12}
        onOpenAutoFocus={event => event.preventDefault()}
      >
        <div className="staff-dp-head">
          <button
            type="button"
            className="staff-dp-nav"
            onClick={() => (view === "days" ? move(addMonths(cursor, -1), false) : move(addMonths(cursor, -12), false))}
            disabled={view === "days" ? !canPrevMonth : !canPrevYear}
            aria-label={view === "days" ? D.previousMonth : D.previousYear}
          >
            <GlyphChevronLeft className="ui-glyph staff-rtl-flip" />
          </button>
          <button
            type="button"
            id={titleId}
            className="staff-dp-title"
            onClick={() => {
              setView(current => (current === "days" ? "months" : "days"));
              focusCursor.current = view === "months";
            }}
            aria-label={`${D.chooseMonth}: ${formatMonthYear(month)}`}
            aria-expanded={view === "months"}
            aria-live="polite"
          >
            {view === "days" ? formatMonthYear(month) : formatYear(year)}
          </button>
          <button
            type="button"
            className="staff-dp-nav"
            onClick={() => (view === "days" ? move(addMonths(cursor, 1), false) : move(addMonths(cursor, 12), false))}
            disabled={view === "days" ? !canNextMonth : !canNextYear}
            aria-label={view === "days" ? D.nextMonth : D.nextYear}
          >
            <GlyphChevronRight className="ui-glyph staff-rtl-flip" />
          </button>
        </div>

        {view === "months" ? (
          <div className="staff-dp-months" role="group" aria-labelledby={titleId}>
            {monthNamesShort().map((name, index) => {
              const first = `${String(year).padStart(4, "0")}-${String(index + 1).padStart(2, "0")}-01`;
              const last = addDays(addMonths(first, 1), -1);
              const allowed = (!min || last >= min) && (!max || first <= max);
              const current = first === month;
              return (
                <button
                  key={name}
                  type="button"
                  className="staff-dp-month"
                  data-current={current || undefined}
                  data-today={sameMonth(first, today) || undefined}
                  disabled={!allowed}
                  aria-pressed={current}
                  onClick={() => {
                    const day = Math.min(Number(cursor.slice(8, 10)), 28);
                    move(clampDate(`${first.slice(0, 8)}${String(day).padStart(2, "0")}`, min, max));
                    setView("days");
                  }}
                >
                  {name}
                </button>
              );
            })}
          </div>
        ) : (
          <div
            ref={grid}
            role="grid"
            aria-labelledby={titleId}
            className="staff-dp-grid"
            onKeyDown={onGridKey}
          >
            <div role="row" className="staff-dp-row staff-dp-weekdays">
              {names.map(name => (
                <span key={name.long} role="columnheader" className="staff-dp-weekday" title={name.long}>
                  <abbr title={name.long}>{name.short}</abbr>
                </span>
              ))}
            </div>
            <div key={month} className="staff-dp-weeks" data-dir={direction ?? undefined}>
              {Array.from({ length: 6 }, (_, week) => (
                <div key={week} role="row" className="staff-dp-row">
                  {days.slice(week * 7, week * 7 + 7).map(iso => {
                    const allowed = inRange(iso, min, max);
                    const selected = iso === valid;
                    const between = lo && hi && iso > lo && iso < hi;
                    const edge = lo && hi && (iso === lo || iso === hi);
                    return (
                      <span key={iso} role="gridcell" aria-selected={selected} className="staff-dp-cell" data-between={between || undefined} data-edge-start={(lo && iso === lo && lo !== hi) || undefined} data-edge-end={(hi && iso === hi && lo !== hi) || undefined}>
                        <button
                          type="button"
                          data-iso={iso}
                          className="staff-dp-day"
                          tabIndex={iso === cursor ? 0 : -1}
                          data-outside={!sameMonth(iso, month) || undefined}
                          data-today={iso === today || undefined}
                          data-selected={selected || undefined}
                          data-edge={edge || undefined}
                          aria-disabled={!allowed || undefined}
                          aria-current={iso === today ? "date" : undefined}
                          aria-label={allowed ? formatLongDate(iso) : `${formatLongDate(iso)}, ${D.unavailable}`}
                          onClick={() => {
                            setCursor(iso);
                            pick(iso);
                          }}
                        >
                          {formatDayNumber(iso)}
                        </button>
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="staff-dp-foot">
          <button
            type="button"
            className="staff-btn"
            data-variant="quiet"
            data-size="sm"
            disabled={!todayAllowed}
            onClick={() => pick(today)}
          >
            {D.today}
          </button>
          {clearable && valid ? (
            <button
              type="button"
              className="staff-btn"
              data-variant="quiet"
              data-size="sm"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              {D.clear}
            </button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function initialCursor(value: string, min?: string, max?: string): string {
  return clampDate(isIsoDate(value) ? value : todayIso(), min, max);
}
