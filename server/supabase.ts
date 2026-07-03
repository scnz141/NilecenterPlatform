type SupabaseServerEnv = NodeJS.ProcessEnv;

export type SupabaseServerStatus = {
  urlConfigured: boolean;
  publishableKeyConfigured: boolean;
  secretKeyConfigured: boolean;
  adminAvailable: boolean;
  projectRef?: string;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeUrl(url: string) {
  return clean(url).replace(/\/+$/, "");
}

function getProjectRef(url: string) {
  try {
    const host = new URL(url).hostname;
    return host.endsWith(".supabase.co") ? host.split(".")[0] : undefined;
  } catch {
    return undefined;
  }
}

function getRestTimeoutMs(env: SupabaseServerEnv) {
  const value = Number(env.SUPABASE_REST_TIMEOUT_MS);
  return Number.isFinite(value) && value > 0 ? value : 4500;
}

export function getSupabaseServerConfig(env: SupabaseServerEnv = process.env) {
  const url = normalizeUrl(env.SUPABASE_URL || env.VITE_SUPABASE_URL || "");
  const publishableKey = clean(env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY);
  const secretKey = clean(env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY);

  return {
    url,
    publishableKey,
    secretKey,
    projectRef: getProjectRef(url),
  };
}

export function getSupabaseServerStatus(env: SupabaseServerEnv = process.env): SupabaseServerStatus {
  const config = getSupabaseServerConfig(env);
  return {
    urlConfigured: Boolean(config.url),
    publishableKeyConfigured: Boolean(config.publishableKey),
    secretKeyConfigured: Boolean(config.secretKey),
    adminAvailable: Boolean(config.url && config.secretKey),
    projectRef: config.projectRef,
  };
}

export async function supabaseAdminRestFetch(path: string, init: RequestInit = {}, env: SupabaseServerEnv = process.env) {
  const config = getSupabaseServerConfig(env);
  if (!config.url || !config.secretKey) {
    throw new Error("Supabase admin config is missing SUPABASE_URL and SUPABASE_SECRET_KEY.");
  }

  const headers = new Headers(init.headers);
  headers.set("apikey", config.secretKey);
  headers.set("Authorization", `Bearer ${config.secretKey}`);
  headers.set("Content-Type", headers.get("Content-Type") ?? "application/json");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getRestTimeoutMs(env));
  timeout.unref?.();

  try {
    return await fetch(`${config.url}/rest/v1/${path.replace(/^\/+/, "")}`, {
      ...init,
      headers,
      signal: init.signal ?? controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}
