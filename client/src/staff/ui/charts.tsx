import type { CSSProperties, ReactNode } from "react";

/**
 * Small, dependency-free charts in the staff palette. Tones map to tokens
 * (ink, gold, positive, caution, critical, neutral); every chart carries a
 * text summary for assistive tech, and growth animates only when motion is
 * allowed (see staff.css).
 */
export type ChartTone = "ink" | "gold" | "positive" | "caution" | "critical" | "neutral";

const pct = (value: number, total: number) => (total > 0 ? Math.round((value / total) * 100) : 0);

export function Donut({
  segments,
  centerValue,
  centerLabel,
  empty,
  size = 148,
  thickness = 16,
}: {
  segments: Array<{ label: string; value: number; tone: ChartTone }>;
  centerValue: string;
  centerLabel: string;
  /** Rendered in place of the ring when every segment is zero. */
  empty?: ReactNode;
  size?: number;
  thickness?: number;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  if (total === 0 && empty !== undefined) {
    return <div className="staff-donut staff-donut-empty">{empty}</div>;
  }
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const visible = segments.filter(segment => segment.value > 0);
  const gap = visible.length > 1 ? 3 : 0;
  let offset = 0;
  const summary = segments.map(segment => `${segment.label} ${segment.value}`).join(", ");
  return (
    <div className="staff-donut">
      <div className="staff-donut-figure" style={{ inlineSize: size, blockSize: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${centerLabel} ${centerValue}. ${summary}`}>
          <circle className="staff-donut-track" cx={size / 2} cy={size / 2} r={radius} strokeWidth={thickness} />
          {visible.map(segment => {
            const length = (segment.value / total) * circumference;
            const dash = Math.max(0, length - gap);
            const node = (
              <circle
                key={segment.label}
                className="staff-donut-arc"
                data-tone={segment.tone}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                strokeWidth={thickness}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              />
            );
            offset += length;
            return node;
          })}
        </svg>
        <span className="staff-donut-center" aria-hidden>
          <span className="staff-donut-value">{centerValue}</span>
          <span className="staff-donut-label">{centerLabel}</span>
        </span>
      </div>
      <ul className="staff-legend">
        {segments.map(segment => (
          <li key={segment.label}>
            <span className="staff-legend-swatch" data-tone={segment.tone} aria-hidden />
            <span className="staff-legend-label">{segment.label}</span>
            <span className="staff-legend-value">{segment.value}</span>
            <span className="staff-legend-share">{pct(segment.value, total)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Vertical columns for a short series, e.g. weekly intake. */
export function Columns({
  points,
  label,
  height = 168,
}: {
  points: Array<{ label: string; value: number | null; hint?: string }>;
  label: string;
  height?: number;
}) {
  const max = Math.max(1, ...points.map(point => point.value ?? 0));
  const summary = points.map(point => `${point.label}: ${point.value ?? "–"}`).join(", ");
  return (
    <figure className="staff-columns" role="img" aria-label={`${label}. ${summary}`} style={{ "--chart-h": `${height}px` } as CSSProperties}>
      <div className="staff-columns-plot" aria-hidden>
        <span className="staff-columns-grid" />
        {points.map((point, index) => (
          <div key={point.label} className="staff-column" title={point.hint ?? `${point.label}: ${point.value ?? "–"}`}>
            <span className="staff-column-value">{point.value ?? "–"}</span>
            <span
              className="staff-column-bar"
              data-current={index === points.length - 1 || undefined}
              data-empty={!point.value || undefined}
              style={{ blockSize: `${Math.max(2, ((point.value ?? 0) / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="staff-columns-axis" aria-hidden>
        {points.map(point => (
          <span key={point.label}>{point.label}</span>
        ))}
      </div>
    </figure>
  );
}

/** A tiny trend line for a tile. */
export function Sparkline({ values, label }: { values: number[]; label: string }) {
  if (values.length < 2) return null;
  const width = 120;
  const height = 32;
  const max = Math.max(1, ...values);
  const step = width / (values.length - 1);
  const points = values.map((value, index) => `${index * step},${height - 3 - (value / max) * (height - 6)}`);
  return (
    <svg className="staff-spark" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={label}>
      <polyline className="staff-spark-area" points={`0,${height} ${points.join(" ")} ${width},${height}`} />
      <polyline className="staff-spark-line" points={points.join(" ")} />
    </svg>
  );
}

/** Steps that narrow, with the share kept between each step. */
export function Funnel({ steps }: { steps: Array<{ label: string; value: number }> }) {
  const first = Math.max(1, steps[0]?.value ?? 0);
  return (
    <ol className="staff-funnel">
      {steps.map((step, index) => {
        const previous = index ? steps[index - 1].value : null;
        return (
          <li key={step.label} className="staff-funnel-step">
            <div className="staff-funnel-head">
              <span>{step.label}</span>
              <span className="staff-funnel-value">
                {step.value}
                {previous ? <span className="staff-funnel-rate"> · {pct(step.value, previous)}%</span> : null}
              </span>
            </div>
            <span className="staff-funnel-track" aria-hidden>
              <span className="staff-funnel-bar" data-step={index} style={{ inlineSize: `${Math.max(2, (step.value / first) * 100)}%` }} />
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** One full-width bar split into parts, with a legend. */
export function SplitBar({
  segments,
  label,
}: {
  segments: Array<{ label: string; value: number; tone: ChartTone }>;
  label: string;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  return (
    <div className="staff-split">
      <div
        className="staff-split-bar"
        role="img"
        aria-label={`${label}. ${segments.map(segment => `${segment.label} ${segment.value}`).join(", ")}`}
      >
        {total === 0 ? (
          <span className="staff-split-part" data-tone="neutral" style={{ inlineSize: "100%" }} data-empty />
        ) : (
          segments
            .filter(segment => segment.value > 0)
            .map(segment => (
              <span
                key={segment.label}
                className="staff-split-part"
                data-tone={segment.tone}
                style={{ inlineSize: `${(segment.value / total) * 100}%` }}
              />
            ))
        )}
      </div>
      <ul className="staff-legend staff-legend-inline">
        {segments.map(segment => (
          <li key={segment.label}>
            <span className="staff-legend-swatch" data-tone={segment.tone} aria-hidden />
            <span className="staff-legend-label">{segment.label}</span>
            <span className="staff-legend-value">{segment.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
