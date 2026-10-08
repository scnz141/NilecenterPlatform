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

/** Invalidate cached list/detail queries by path prefix (this scope only). */
export function useInvalidate() {
  const { mutate } = useSWRConfig();
  const { session } = useStaffSession();
  const scope = staffScope(session);
  return async (prefix: string): Promise<void> => {
    await mutate(key => matchesStaffKey(key, scope, prefix));
  };
}
