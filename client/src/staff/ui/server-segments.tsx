import { useId } from "react";
import { useLocation, useSearch } from "wouter";
import { useNcc, type StaffQuery } from "../api";
import { ActiveMark } from "./primitives";

function SegmentCount({ path, query }: { path: string; query: StaffQuery }) {
  const counted = useNcc<{ total: number }>(
    path,
    { ...query, pageSize: 1 },
    {
      keepPreviousData: true,
    }
  );
  return (
    <span className="staff-segment-count">
      {counted.data ? counted.data.total : "\u00a0"}
    </span>
  );
}

/**
 * Segmented filter backed by one URL param, with a live server total per
 * segment for the other active filters. Each count is a one-row page read.
 */
export function ServerSegments({
  path,
  base,
  param,
  segments,
  defaultValue = "",
  label,
}: {
  path: string;
  /** The list query without this param and without paging. */
  base: StaffQuery;
  param: string;
  segments: { value: string; label: string; query: StaffQuery }[];
  defaultValue?: string;
  label: string;
}) {
  const search = useSearch();
  const [, navigate] = useLocation();
  const active = new URLSearchParams(search).get(param) ?? defaultValue;
  const group = useId();

  function choose(value: string) {
    const next = new URLSearchParams(search);
    if (value && value !== defaultValue) next.set(param, value);
    else next.delete(param);
    next.delete("page");
    navigate(`?${next.toString()}`, { replace: true });
  }

  return (
    <div
      className="staff-segments staff-segments-scroll"
      role="group"
      aria-label={label}
    >
      {segments.map(segment => (
        <button
          key={segment.value || "all"}
          type="button"
          className="staff-segment"
          data-active={active === segment.value}
          aria-pressed={active === segment.value}
          onClick={() => choose(segment.value)}
        >
          {active === segment.value ? <ActiveMark group={group} /> : null}
          {segment.label}
          <SegmentCount path={path} query={{ ...base, ...segment.query }} />
        </button>
      ))}
    </div>
  );
}
