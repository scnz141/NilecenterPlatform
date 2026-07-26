import { getRequestSession } from "./auth.js";

type Request = {
  headers: { cookie?: string };
  get(name: string): string | undefined;
};

type Response = {
  status(code: number): Response;
  json(body: unknown): void;
};

type App = {
  get(
    path: string,
    handler: (request: Request, response: Response) => void | Promise<void>
  ): void;
};

type IntegrationHealthState =
  | "verified"
  | "configured"
  | "unavailable"
  | "disabled"
  | "incomplete"
  | "deferred";

type IntegrationCheckStatus =
  | "passed"
  | "failed"
  | "not_run"
  | "not_applicable";

type IntegrationProbeTarget = "moodle" | "storage" | "email";

type IntegrationProbeResult = {
  ok: boolean;
  checkedAt: string;
};

export type IntegrationHealthProbe = (
  target: IntegrationProbeTarget,
  env: NodeJS.ProcessEnv
) => Promise<IntegrationProbeResult>;

function configured(value: string | undefined) {
  return Boolean(value?.trim());
}

function provider(
  id: string,
  label: string,
  state: IntegrationHealthState,
  summary: string,
  checks: Array<{
    label: string;
    status: IntegrationCheckStatus;
  }>,
  verification: {
    status: "verified" | "failed" | "not_run" | "not_applicable";
    checkedAt?: string;
  }
) {
  return { id, label, state, summary, checks, verification };
}

function check(
  label: string,
  status: IntegrationCheckStatus
): { label: string; status: IntegrationCheckStatus } {
  return { label, status };
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs = 3500
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export const probeIntegrationHealth: IntegrationHealthProbe = async (
  target,
  env
) => {
  const checkedAt = new Date().toISOString();
  try {
    if (target === "moodle") {
      const baseUrl = (
        env.MOODLE_COMMAND_BASE_URL ||
        env.MOODLE_BASE_URL ||
        ""
      ).replace(/\/+$/, "");
      const token = env.MOODLE_COMMAND_TOKEN || env.MOODLE_TOKEN || "";
      const response = await fetchWithTimeout(
        `${baseUrl}/webservice/rest/server.php`,
        {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            wstoken: token,
            wsfunction: "core_webservice_get_site_info",
            moodlewsrestformat: "json",
          }),
        }
      );
      return { ok: response.ok, checkedAt };
    }

    if (target === "storage") {
      const baseUrl = (env.SUPABASE_URL || "").replace(/\/+$/, "");
      const secret =
        env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || "";
      const response = await fetchWithTimeout(
        `${baseUrl}/storage/v1/bucket?limit=1&offset=0`,
        {
          method: "GET",
          headers: {
            apikey: secret,
            authorization: `Bearer ${secret}`,
          },
        }
      );
      return { ok: response.ok, checkedAt };
    }

    const response = await fetchWithTimeout("https://api.resend.com/domains", {
      method: "GET",
      headers: { authorization: `Bearer ${env.RESEND_API_KEY || ""}` },
    });
    return { ok: response.ok, checkedAt };
  } catch {
    return { ok: false, checkedAt };
  }
};

async function safelyProbe(
  probe: IntegrationHealthProbe,
  target: IntegrationProbeTarget,
  env: NodeJS.ProcessEnv
) {
  try {
    return await probe(target, env);
  } catch {
    return { ok: false, checkedAt: new Date().toISOString() };
  }
}

export async function buildIntegrationHealth(
  env: NodeJS.ProcessEnv,
  probe: IntegrationHealthProbe = probeIntegrationHealth
) {
  const moodleBase = configured(
    env.MOODLE_COMMAND_BASE_URL || env.MOODLE_BASE_URL
  );
  const moodleToken = configured(env.MOODLE_COMMAND_TOKEN || env.MOODLE_TOKEN);
  const moodleRuntime = env.NILE_MOODLE_COMMAND_RUNTIME_ENABLED === "1";
  const moodlePluginAccepted = env.NILE_MOODLE_PLUGIN_ACCEPTED === "1";
  const moodleConfigured =
    moodleBase && moodleToken && moodleRuntime && moodlePluginAccepted;

  const supabaseUrl = configured(env.SUPABASE_URL);
  const supabaseSecret = configured(
    env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY
  );
  const storageConfigured = supabaseUrl && supabaseSecret;

  const resendSelected = env.EMAIL_PROVIDER?.trim() === "resend";
  const resendKey = configured(env.RESEND_API_KEY);
  const resendFrom = configured(env.RESEND_FROM_EMAIL);
  const resendConfigured = resendSelected && resendKey && resendFrom;

  const [moodleProbe, storageProbe, emailProbe] = await Promise.all([
    moodleConfigured
      ? safelyProbe(probe, "moodle", env)
      : Promise.resolve(null),
    storageConfigured
      ? safelyProbe(probe, "storage", env)
      : Promise.resolve(null),
    resendConfigured
      ? safelyProbe(probe, "email", env)
      : Promise.resolve(null),
  ]);

  const moodleState: IntegrationHealthState = !moodleRuntime
    ? "disabled"
    : !moodleConfigured
      ? "incomplete"
      : moodleProbe?.ok
        ? "verified"
        : "unavailable";
  const storageState: IntegrationHealthState = !storageConfigured
    ? "incomplete"
    : storageProbe?.ok
      ? "verified"
      : "unavailable";
  const emailState: IntegrationHealthState = !resendSelected
    ? "disabled"
    : !resendConfigured
      ? "incomplete"
      : emailProbe?.ok
        ? "verified"
        : "unavailable";

  return {
    checkedAt: new Date().toISOString(),
    authority: "server" as const,
    providers: [
      provider(
        "moodle",
        "Moodle learning",
        moodleState,
        moodleState === "verified"
          ? "The held command boundary answered a live server probe."
          : moodleState === "unavailable"
            ? "Configuration is present, but the provider did not pass the live probe."
            : "Read projections remain separate. Moodle writes and the local plugin are on hold.",
        [
          check(
            "Server endpoint configured",
            moodleBase ? "passed" : "failed"
          ),
          check(
            "Server credential configured",
            moodleToken ? "passed" : "failed"
          ),
          check(
            "Command runtime enabled",
            moodleRuntime ? "passed" : "not_run"
          ),
          check(
            "Plugin installation accepted",
            moodlePluginAccepted ? "passed" : "not_run"
          ),
          check(
            "Live provider probe",
            !moodleConfigured
              ? "not_run"
              : moodleProbe?.ok
                ? "passed"
                : "failed"
          ),
        ],
        {
          status: !moodleConfigured
            ? "not_run"
            : moodleProbe?.ok
              ? "verified"
              : "failed",
          checkedAt: moodleProbe?.checkedAt,
        }
      ),
      provider(
        "storage",
        "Private storage",
        storageState,
        storageState === "verified"
          ? "Supabase Storage answered the server's authenticated live probe."
          : storageState === "unavailable"
            ? "Storage is configured, but its live probe failed."
            : "Private storage requires server Supabase configuration.",
        [
          check(
            "Supabase project configured",
            supabaseUrl ? "passed" : "failed"
          ),
          check(
            "Server credential configured",
            supabaseSecret ? "passed" : "failed"
          ),
          check(
            "Authenticated storage probe",
            !storageConfigured
              ? "not_run"
              : storageProbe?.ok
                ? "passed"
                : "failed"
          ),
        ],
        {
          status: !storageConfigured
            ? "not_run"
            : storageProbe?.ok
              ? "verified"
              : "failed",
          checkedAt: storageProbe?.checkedAt,
        }
      ),
      provider(
        "email",
        "Transactional email",
        emailState,
        emailState === "verified"
          ? "Resend answered the server's authenticated live probe."
          : emailState === "unavailable"
            ? "Email is configured, but its live probe failed."
            : "Transactional delivery remains disabled or incomplete.",
        [
          check("Resend selected", resendSelected ? "passed" : "not_run"),
          check(
            "Server API key configured",
            resendKey ? "passed" : "failed"
          ),
          check("Sender configured", resendFrom ? "passed" : "failed"),
          check(
            "Authenticated provider probe",
            !resendConfigured
              ? "not_run"
              : emailProbe?.ok
                ? "passed"
                : "failed"
          ),
        ],
        {
          status: !resendConfigured
            ? "not_run"
            : emailProbe?.ok
              ? "verified"
              : "failed",
          checkedAt: emailProbe?.checkedAt,
        }
      ),
      provider(
        "ems",
        "Legacy EMS migration",
        "deferred",
        "Legacy EMS remains a finite migration source, not a live provider.",
        [check("Recurring synchronization disabled", "passed")],
        { status: "not_applicable" }
      ),
    ],
  };
}

export function registerIntegrationHealthRoutes(
  app: App,
  env: NodeJS.ProcessEnv = process.env,
  getSession: typeof getRequestSession = getRequestSession,
  probe: IntegrationHealthProbe = probeIntegrationHealth
) {
  app.get("/api/integrations/health", async (request, response) => {
    const session = await getSession(request);
    if (!session) {
      response.status(401).json({ error: "Sign in required." });
      return;
    }
    if (session.activeRole !== "superadmin") {
      response.status(403).json({ error: "Super Admin access is required." });
      return;
    }
    response.json(await buildIntegrationHealth(env, probe));
  });
}
