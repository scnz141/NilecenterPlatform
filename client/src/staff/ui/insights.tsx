import type { ReactNode } from "react";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { copy } from "../copy";
import { PERIODS, type Period } from "../dashboard";
import { intlLocale } from "../i18n";
import { ActiveMark } from "./primitives";

/** Shared KPI/panel primitives used by the dashboard and Reports. */

export const fmt = (value: number) =>
  new Intl.NumberFormat(intlLocale()).format(value);

export function Tile({
  label,
  value,
  note,
  href,
  meter,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  href?: string;
  meter?: number;
}) {
  const body = (
    <>
      <span className="staff-tile-label">{label}</span>
      <span className="staff-tile-value">{value}</span>
      {meter !== undefined ? (
        <span className="staff-tile-meter" aria-hidden>
          <span style={{ inlineSize: `${meter}%` }} />
        </span>
      ) : null}
      {note ? <span className="staff-tile-note">{note}</span> : null}
    </>
  );
  return href ? (
    <Link href={href} className="staff-tile" data-link>
      {body}
    </Link>
  ) : (
    <div className="staff-tile">{body}</div>
  );
}

export function Panel({
  title,
  action,
  area,
  wide,
  children,
}: {
  title: string;
  action?: ReactNode;
  /** Grid area on the dashboard board. */
  area?: string;
  /** Spans the full row of a `staff-report-grid`. */
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={`staff-section staff-panel${wide ? " staff-panel-wide" : ""}`}
      data-area={area}
    >
      <div className="staff-section-head">
        <h2 className="staff-section-title">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function PanelLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="staff-panel-link">
      {label}
      <ArrowRight className="staff-rtl-flip" strokeWidth={1.75} aria-hidden />
    </Link>
  );
}

/** Delta chip: "+3 vs previous period", tone by direction. */
export function Change({
  value,
  unit = "",
}: {
  value: number | null;
  unit?: string;
}) {
  if (value === null) return null;
  if (value === 0)
    return (
      <span className="staff-change" data-tone="flat">
        {copy.dashboard.noChange}{" "}
        <span className="staff-change-note">{copy.dashboard.vsPrevious}</span>
      </span>
    );
  const tone = value > 0 ? "up" : "down";
  const sign = value > 0 ? "+" : "−";
  return (
    <span className="staff-change" data-tone={tone}>
      {sign}
      {fmt(Math.abs(value))}
      {unit} <span className="staff-change-note">{copy.dashboard.vsPrevious}</span>
    </span>
  );
}

export function PeriodSwitch({
  value,
  onChange,
  options = PERIODS,
  label = copy.dashboard.period,
}: {
  value: Period;
  onChange: (value: Period) => void;
  options?: Period[];
  label?: string;
}) {
  return (
    <div className="staff-segments" role="group" aria-label={label}>
      {options.map(item => (
        <button
          key={item}
          type="button"
          className="staff-segment"
          data-active={value === item}
          aria-pressed={value === item}
          onClick={() => onChange(item)}
        >
          {value === item ? <ActiveMark group="dash-period" /> : null}
          {copy.dashboard.periods[item]}
        </button>
      ))}
    </div>
  );
}
