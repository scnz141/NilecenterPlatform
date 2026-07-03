import type { Role } from "@/lib/platformData";
import type {
  PlatformLearningAction,
  PlatformLearningActionResult,
  PlatformWorkflowAction,
  PlatformWorkflowActionResult,
} from "@/lib/domain/actions";
import type { CertificateVerificationResult, PlatformState } from "@/lib/domain/types";

export type AuthSessionDto = {
  userId: string;
  email: string;
  name: string;
  roles: Role[];
  activeRole: Role;
  provider: "supabase" | "demo";
  expiresAt: string;
};

type ApiResult<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};

async function apiJson<T>(path: string, init: RequestInit = {}): Promise<ApiResult<T>> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (init.method && init.method.toUpperCase() !== "GET") headers.set("X-Nile-Learn-Request", "browser");

  try {
    const response = await fetch(path, {
      ...init,
      credentials: "include",
      headers,
    });
    const data = (await response.json().catch(() => null)) as T | { error?: string } | null;
    const errorMessage =
      data && typeof data === "object" && "error" in data && typeof data.error === "string"
        ? data.error
        : `Request failed with ${response.status}`;
    if (!response.ok) {
      return { ok: false, error: errorMessage };
    }
    return { ok: true, data: data as T };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Network request failed" };
  }
}

export function signInRequest(input: { email: string; password: string; role: Role }) {
  return apiJson<AuthSessionDto>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function fetchSessionRequest() {
  return apiJson<AuthSessionDto | null>("/api/auth/session");
}

export function logoutRequest() {
  return apiJson<{ ok: true }>("/api/auth/logout", { method: "POST" });
}

export function saveBackendRecord(type: "lead" | "placement" | "operational", payload: Record<string, unknown>, actorId?: string) {
  return apiJson<{ id: string; type: string; createdAt: string }>("/api/platform/records", {
    method: "POST",
    body: JSON.stringify({ type, payload, actorId }),
  });
}

export type PlatformStateDto = {
  state: PlatformState;
  persistence: "supabase" | "local";
  syncedAt: string;
};

export type PlatformActionDto = PlatformStateDto & {
  result: PlatformLearningActionResult;
};

export type PlatformWorkflowActionDto = PlatformStateDto & {
  result: PlatformWorkflowActionResult;
};

export type PublicCertificateVerificationDto =
  | {
      valid: true;
      certificate: CertificateVerificationResult;
    }
  | {
      valid: false;
      error?: string;
    };

export function fetchPlatformStateRequest() {
  return apiJson<PlatformStateDto>("/api/platform/state");
}

export function runPlatformLearningActionRequest(action: PlatformLearningAction) {
  return apiJson<PlatformActionDto>("/api/platform/state/actions", {
    method: "POST",
    body: JSON.stringify(action),
  });
}

export function runPlatformWorkflowActionRequest(action: PlatformWorkflowAction) {
  return apiJson<PlatformWorkflowActionDto>("/api/platform/state/actions", {
    method: "POST",
    body: JSON.stringify(action),
  });
}

export function verifyPublicCertificateRequest(code: string) {
  return apiJson<PublicCertificateVerificationDto>(
    `/api/certificates/verify?code=${encodeURIComponent(code)}`,
  );
}
