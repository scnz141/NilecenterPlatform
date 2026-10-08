import { useEffect, useMemo, useState } from "react";
import { useSearch } from "wouter";
import type { StaffQuery } from "../api";

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

/**
 * Builds the API query for a server-paged list from the URL that `ListPage`
 * writes: `q` (debounced), `page`, and the given filter keys. Values pass
 * through unchanged so the BFF allowlist stays the single validator.
 */
export function useListQuery(
  filterKeys: readonly string[],
  {
    pageSize = 25,
    debounceMs = 300,
  }: { pageSize?: number; debounceMs?: number } = {}
): StaffQuery {
  const search = useSearch();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const q = useDebounced((params.get("q") ?? "").trim(), debounceMs);
  const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
  const filterSignature = filterKeys
    .map(key => `${key}=${params.get(key) ?? ""}`)
    .join("&");

  return useMemo(() => {
    const query: StaffQuery = { pageSize };
    if (q) query.q = q;
    if (page > 1) query.page = page;
    for (const key of filterKeys) {
      const value = params.get(key);
      if (value) query[key] = value;
    }
    return query;
    // filterSignature captures the filter values that matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, page, pageSize, filterSignature]);
}
