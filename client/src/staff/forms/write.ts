import type { NileFormsApiResult } from "@/lib/forms/api";
import { StaffApiError } from "../session";

/** Field errors only when the server sent `{ field: string[] }`. */
function fieldDetails(details: unknown): Record<string, string[]> | undefined {
  if (!details || typeof details !== "object" || Array.isArray(details)) return undefined;
  const entries = Object.entries(details as Record<string, unknown>);
  return entries.every(([, value]) => Array.isArray(value) && value.every(item => typeof item === "string"))
    ? (details as Record<string, string[]>)
    : undefined;
}

/** Unwrap a Nile Forms result like `staffWrite`, so toasts and field errors match. */
export async function formsWrite<T>(result: Promise<NileFormsApiResult<T>>): Promise<T> {
  const resolved = await result;
  if (!resolved.ok) {
    // Schema errors arrive as [{ path, message }]; name the first few.
    const issues = Array.isArray(resolved.details)
      ? (resolved.details as Array<{ message?: unknown }>)
          .map(item => (typeof item?.message === "string" ? item.message : ""))
          .filter(Boolean)
          .slice(0, 3)
      : [];
    throw new StaffApiError(
      [resolved.error ?? "The request failed. Try again.", ...issues].join(" "),
      resolved.status,
      fieldDetails(resolved.details)
    );
  }
  return resolved.data as T;
}
