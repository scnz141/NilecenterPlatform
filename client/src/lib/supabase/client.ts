type SupabaseBrowserEnv = Record<string, unknown>;

export type SupabaseBrowserConfig = {
  configured: boolean;
  url: string;
  key: string;
  keyMode: "publishable" | "anon" | "missing";
  projectRef?: string;
};

export type SupabaseConnectionCheck = {
  ok: boolean;
  status: number;
  keyMode: SupabaseBrowserConfig["keyMode"];
  projectRef?: string;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeUrl(url: unknown) {
  return clean(url).replace(/\/+$/, "");
}

export function getSupabaseProjectRef(url: string) {
  try {
    const host = new URL(url).hostname;
    return host.endsWith(".supabase.co") ? host.split(".")[0] : undefined;
  } catch {
    return undefined;
  }
}

export function resolveSupabaseBrowserConfig(env: SupabaseBrowserEnv): SupabaseBrowserConfig {
  const url = normalizeUrl(env.VITE_SUPABASE_URL);
  const publishableKey = clean(env.VITE_SUPABASE_PUBLISHABLE_KEY);
  const anonKey = clean(env.VITE_SUPABASE_ANON_KEY);
  const key = publishableKey || anonKey;
  const keyMode = publishableKey ? "publishable" : anonKey ? "anon" : "missing";

  return {
    configured: Boolean(url && key),
    url,
    key,
    keyMode,
    projectRef: getSupabaseProjectRef(url),
  };
}

export function getSupabaseBrowserConfig() {
  return resolveSupabaseBrowserConfig(import.meta.env as unknown as SupabaseBrowserEnv);
}

export function assertSupabaseBrowserConfig() {
  const config = getSupabaseBrowserConfig();
  if (!config.configured) {
    throw new Error("Supabase browser config is missing VITE_SUPABASE_URL and a publishable or anon key.");
  }
  return config;
}

export async function supabaseRestFetch(path: string, init: RequestInit = {}) {
  const config = assertSupabaseBrowserConfig();
  const normalizedPath = path.replace(/^\/+/, "");
  const headers = new Headers(init.headers);
  headers.set("apikey", config.key);
  headers.set("Authorization", `Bearer ${config.key}`);
  headers.set("Content-Type", headers.get("Content-Type") ?? "application/json");

  return fetch(`${config.url}/rest/v1/${normalizedPath}`, {
    ...init,
    headers,
  });
}

export async function checkSupabaseBrowserConnection(): Promise<SupabaseConnectionCheck> {
  const config = assertSupabaseBrowserConfig();
  const response = await supabaseRestFetch("", { method: "GET" });

  return {
    ok: response.ok,
    status: response.status,
    keyMode: config.keyMode,
    projectRef: config.projectRef,
  };
}
