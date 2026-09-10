type ApiResult<T> = {
  ok: boolean;
  data?: T;
  error?: string;
  status?: number;
};

async function emsStagingJson<T>(
  path: string,
  init: RequestInit = {}
): Promise<ApiResult<T>> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (init.method && init.method.toUpperCase() !== "GET") {
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
      | { error?: string }
      | null;
    if (!response.ok) {
      const message =
        payload &&
        typeof payload === "object" &&
        "error" in payload &&
        typeof payload.error === "string"
          ? payload.error
          : `Request failed with ${response.status}`;
      return { ok: false, error: message, status: response.status };
    }
    return { ok: true, data: payload as T, status: response.status };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Network request failed",
      status: 503,
    };
  }
}

export type EmsStagingStatus = {
  configured: boolean;
  reachable: boolean;
  linked: boolean;
  sessionProtectionConfigured: boolean;
};

export type EmsStagingLink = {
  assignedRole: string | null;
  activeRole: string | null;
  workspaceBranchId: string | null;
  scopes: Array<{
    scopeType: string;
    scopeId: string | null;
    isLive: boolean;
  }>;
};

export function emsStagingStatusRequest() {
  return emsStagingJson<EmsStagingStatus>("/api/ems-staging/status");
}

export function emsStagingLinkRequest(input: {
  email: string;
  password: string;
}) {
  return emsStagingJson<EmsStagingLink>("/api/ems-staging/session", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function emsStagingUnlinkRequest() {
  return emsStagingJson<{ ok: boolean }>("/api/ems-staging/logout", {
    method: "POST",
  });
}
