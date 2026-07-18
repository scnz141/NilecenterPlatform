import type {
  NileRequestCommandResult,
  NileRequestPriority,
} from "@shared/nileRequests";
import type {
  NileRequestCreationCandidate,
  NileRequestDetail,
  NileRequestListItem,
} from "../../../../server/nileRequestsService";

export type NileRequestsApiResult<T> = {
  ok: boolean;
  data?: T;
  error?: string;
  code?: string;
  status?: number;
  details?: unknown;
};

async function requestsJson<T>(
  path: string,
  init: RequestInit = {}
): Promise<NileRequestsApiResult<T>> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (init.method && !["GET", "HEAD"].includes(init.method.toUpperCase())) {
    headers.set("X-Nile-Learn-Request", "browser");
  }
  try {
    const response = await fetch(path, {
      ...init,
      credentials: "include",
      headers,
    });
    const payload = (await response.json().catch(() => null)) as
      | T
      | { error?: string; code?: string; details?: unknown }
      | null;
    if (!response.ok) {
      const errorPayload =
        payload && typeof payload === "object" ? payload : undefined;
      return {
        ok: false,
        error:
          errorPayload && "error" in errorPayload && errorPayload.error
            ? errorPayload.error
            : `Request failed with ${response.status}`,
        code:
          errorPayload && "code" in errorPayload && errorPayload.code
            ? errorPayload.code
            : "http_error",
        details:
          errorPayload && "details" in errorPayload
            ? errorPayload.details
            : undefined,
        status: response.status,
      };
    }
    return { ok: true, data: payload as T };
  } catch {
    return {
      ok: false,
      error: "The request service is unavailable.",
      code: "network_error",
      status: 503,
    };
  }
}

function command(
  requestId: string,
  operation:
    | "assign"
    | "reprioritize"
    | "start"
    | "comment"
    | "resolve"
    | "cancel",
  input: Record<string, unknown>
) {
  return requestsJson<NileRequestCommandResult & { replayed: boolean }>(
    `/api/requests/${encodeURIComponent(requestId)}/${operation}`,
    { method: "POST", body: JSON.stringify(input) }
  );
}

export function fetchRequests() {
  return requestsJson<NileRequestListItem[]>("/api/requests");
}

export function fetchRequest(requestId: string) {
  return requestsJson<NileRequestDetail>(
    `/api/requests/${encodeURIComponent(requestId)}`
  );
}

export function fetchRequestCreationCandidate(submissionId: string) {
  return requestsJson<NileRequestCreationCandidate>(
    `/api/requests/from-submission/${encodeURIComponent(submissionId)}`
  );
}

export function createRequestFromSubmission(
  submissionId: string,
  input: { expectedSubmissionRevision: number; idempotencyKey: string }
) {
  return requestsJson<NileRequestCommandResult & { replayed: boolean }>(
    `/api/requests/from-submission/${encodeURIComponent(submissionId)}`,
    { method: "POST", body: JSON.stringify(input) }
  );
}

export function assignRequest(
  requestId: string,
  input: {
    expectedVersion: number;
    assigneeUserId: string;
    reason: string;
    idempotencyKey: string;
  }
) {
  return command(requestId, "assign", input);
}

export function reprioritizeRequest(
  requestId: string,
  input: {
    expectedVersion: number;
    priority: NileRequestPriority;
    reason: string;
    idempotencyKey: string;
  }
) {
  return command(requestId, "reprioritize", input);
}

export function startRequest(
  requestId: string,
  input: { expectedVersion: number; idempotencyKey: string }
) {
  return command(requestId, "start", input);
}

export function commentOnRequest(
  requestId: string,
  input: {
    expectedVersion: number;
    body: string;
    idempotencyKey: string;
  }
) {
  return command(requestId, "comment", input);
}

export function resolveRequest(
  requestId: string,
  input: {
    expectedVersion: number;
    resolution: string;
    idempotencyKey: string;
  }
) {
  return command(requestId, "resolve", input);
}

export function cancelRequest(
  requestId: string,
  input: {
    expectedVersion: number;
    reason: string;
    idempotencyKey: string;
  }
) {
  return command(requestId, "cancel", input);
}
