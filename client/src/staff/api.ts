import useSWR, { useSWRConfig, type SWRConfiguration } from "swr";
import { apiJson, type ApiResult } from "@/lib/backend/api";
import { staffScope, useStaffSession, StaffApiError } from "./session";

export type StaffQuery = Record<string, string | number | boolean | undefined>;

export function staffQueryString(query?: StaffQuery): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === "") continue;
    params.set(key, String(value));
  }
  const raw = params.toString();
  return raw ? `?${raw}` : "";
}

export async function staffGet<T>(path: string, query?: StaffQuery): Promise<T> {
  const result = await apiJson<T>(`${path}${staffQueryString(query)}`);
  if (!result.ok) {
    throw new StaffApiError(
      result.error ?? "The request failed. Try again.",
      result.status,
      result.details
    );
  }
  return result.data as T;
}

/** Unwrap an apiJson result into data or a StaffApiError (status + 422 fields). */
export async function staffWrite<T>(
  result: Promise<ApiResult<T>>
): Promise<T> {
  const resolved = await result;
  if (!resolved.ok) {
    throw new StaffApiError(
      resolved.error ?? "The request failed. Try again.",
      resolved.status,
      resolved.details
    );
  }
  return resolved.data as T;
}

// Keys are [scope, path, query?]. Scope includes the active EMS role and the
// workspace branch so switch-role / switch-workspace cannot reuse another
// view's cache.
export type StaffKey =
  | readonly [string, string]
  | readonly [string, string, StaffQuery]
  | null;

export function toStaffKey(
  scope: string,
  path: string,
  query?: StaffQuery
): StaffKey {
  if (!query || Object.keys(query).length === 0) return [scope, path] as const;
  return [scope, path, query] as const;
}

function pathFromKey(key: unknown): string | null {
  if (Array.isArray(key) && key.length >= 2 && typeof key[1] === "string") {
    return key[1];
  }
  return null;
}

/** Does a cached SWR key belong to `scope` and match `prefix`? Exported for tests. */
export function matchesStaffKey(
  key: unknown,
  scope: string,
  prefix: string
): boolean {
  if (!Array.isArray(key) || key[0] !== scope) return false;
  const path = pathFromKey(key);
  return path != null && path.startsWith(prefix);
}

export function useNcc<T>(
  path: string | null,
  query?: StaffQuery,
  config?: SWRConfiguration<T>
) {
  const { session } = useStaffSession();
  const scope = staffScope(session);
  const key: StaffKey = path ? toStaffKey(scope, path, query) : null;
  return useSWR<T, StaffApiError>(
    key,
    async () => staffGet<T>(path as string, query),
    { revalidateOnFocus: false, ...config }
  );
}

export type AllPagesResult<T> = {
  items: T[];
  total: number;
  /** EMS has more rows than the page cap allowed us to fetch. */
  truncated: boolean;
};

const ALL_PAGES_SIZE = 100;
const ALL_PAGES_BATCH = 4;
const ALL_PAGES_MAX = 50;

/**
 * Reads a whole paged list: page 1 gives `total`, the rest run in parallel
 * batches. Capped at 5,000 rows; `truncated` reports the cap being hit.
 * Exported for tests — any page failing rejects the whole read.
 */
export async function fetchAllPages<T>(
  path: string,
  query: StaffQuery | undefined,
  get: (
    path: string,
    query: StaffQuery
  ) => Promise<{ items: T[]; total: number }> = staffGet
): Promise<AllPagesResult<T>> {
  const first = await get(path, {
    ...query,
    pageSize: ALL_PAGES_SIZE,
    page: 1,
  });
  const total = first.total;
  const pages = Math.min(
    Math.max(1, Math.ceil(total / ALL_PAGES_SIZE)),
    ALL_PAGES_MAX
  );
  const items = [...first.items];
  for (let cursor = 2; cursor <= pages; cursor += ALL_PAGES_BATCH) {
    const batch = Array.from(
      { length: Math.min(ALL_PAGES_BATCH, pages - cursor + 1) },
      (_, index) => cursor + index
    );
    const results = await Promise.all(
      batch.map(page =>
        get(path, { ...query, pageSize: ALL_PAGES_SIZE, page })
      )
    );
    for (const result of results) items.push(...result.items);
  }
  return {
    items,
    total,
    truncated: Math.ceil(total / ALL_PAGES_SIZE) > ALL_PAGES_MAX,
  };
}

/** SWR over `fetchAllPages`, keyed by role/workspace scope like `useNcc`. */
export function useAllPages<T>(path: string | null, query?: StaffQuery) {
  const { session } = useStaffSession();
  const scope = staffScope(session);
  const key: StaffKey = path ? toStaffKey(scope, `${path}#all`, query) : null;
  const result = useSWR<AllPagesResult<T>, StaffApiError>(
    key,
    async () => fetchAllPages<T>(path as string, query),
    { revalidateOnFocus: false }
  );
  return {
    items: result.data?.items ?? [],
    total: result.data?.total ?? 0,
    truncated: result.data?.truncated ?? false,
    isLoading: result.isLoading,
    error: result.error,
    mutate: result.mutate,
  };
}

/** Invalidate cached list/detail queries by path prefix (this scope only). */
export function useInvalidate() {
  const { mutate } = useSWRConfig();
  const { session } = useStaffSession();
  const scope = staffScope(session);
  return async (prefix: string): Promise<void> => {
    await mutate(key => matchesStaffKey(key, scope, prefix));
  };
}
