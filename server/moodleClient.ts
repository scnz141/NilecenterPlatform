import { lookup as lookupHostname } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { isIP, type LookupFunction } from "node:net";
import { Readable } from "node:stream";

export const MOODLE_READ_FUNCTIONS = [
  "core_webservice_get_site_info",
  "core_course_get_categories",
  "core_course_get_courses_by_field",
  "core_course_get_contents",
  "core_course_get_course_module",
  "core_enrol_get_enrolled_users",
  "core_enrol_get_users_courses",
  "core_user_get_users_by_field",
  "core_group_get_course_groups",
  "core_group_get_course_groupings",
  "core_group_get_course_user_groups",
  "core_completion_get_activities_completion_status",
  "core_completion_get_course_completion_status",
  "gradereport_user_get_grade_items",
  "mod_assign_get_assignments",
  "mod_assign_get_submissions",
  "mod_assign_get_grades",
  "mod_quiz_get_quizzes_by_courses",
  "mod_quiz_get_user_attempts",
  "mod_quiz_get_attempt_review",
  "mod_h5pactivity_get_h5pactivities_by_courses",
  "mod_h5pactivity_get_attempts",
  "mod_h5pactivity_get_results",
  "mod_scorm_get_scorms_by_courses",
  "mod_scorm_get_scorm_sco_tracks",
  "mod_lesson_get_lessons_by_courses",
  "mod_lesson_get_user_grade",
  "mod_book_get_books_by_courses",
  "mod_page_get_pages_by_courses",
  "mod_resource_get_resources_by_courses",
  "mod_url_get_urls_by_courses",
] as const;

export type MoodleReadFunction = (typeof MOODLE_READ_FUNCTIONS)[number];
export type MoodleErrorCode =
  | "configuration"
  | "function_not_allowed"
  | "authentication"
  | "permission"
  | "remote"
  | "timeout"
  | "invalid_response";

export type MoodleWarning = {
  item?: string;
  itemid?: number;
  warningcode?: string;
  message?: string;
};

export type MoodleSiteInfo = {
  sitename: string;
  siteurl: string;
  release?: string;
  version?: string;
  functions?: Array<{ name: string; version?: string }>;
  warnings?: MoodleWarning[];
};

export type MoodleCourse = {
  id: number;
  fullname: string;
  shortname: string;
  idnumber?: string;
  categoryid?: number;
  categoryname?: string;
  summary?: string;
  visible?: number;
  startdate?: number;
  enddate?: number;
};

export type MoodleCourseSection = {
  id: number;
  name: string;
  section: number;
  visible?: number;
  summary?: string;
  modules?: Array<{
    id: number;
    name: string;
    modname: string;
    instance: number;
    visible?: number;
    url?: string;
    completion?: number;
    dates?: Array<{
      label?: string;
      timestamp?: number;
    }>;
    contents?: Array<{
      type?: string;
      filename?: string;
      fileurl?: string;
      filesize?: number;
      mimetype?: string;
      timemodified?: number;
      isexternalfile?: boolean;
    }>;
  }>;
};

type MoodleScalar = string | number | boolean;
type MoodleParameter =
  | MoodleScalar
  | null
  | undefined
  | MoodleParameter[]
  | { [key: string]: MoodleParameter };

type MoodleErrorPayload = {
  exception?: unknown;
  errorcode?: unknown;
  message?: unknown;
};

type MoodleClientOptions = {
  enabled: boolean;
  baseUrl: string;
  token: string;
  allowedHosts: readonly string[];
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxResponseBytes?: number;
  allowInsecureLocalhost?: boolean;
  resolveHostname?: (
    hostname: string
  ) => Promise<Array<{ address: string; family: number }>>;
  now?: () => Date;
};

const readFunctionSet = new Set<string>(MOODLE_READ_FUNCTIONS);
const localHosts = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
const reservedParameterPattern =
  /^(?:wstoken|wsfunction|moodlewsrestformat)(?:\[|$)/i;

export class MoodleApiError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly code: MoodleErrorCode
  ) {
    super(message);
    this.name = "MoodleApiError";
  }
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeAllowedHosts(values: readonly string[]) {
  const hosts = values
    .map(value => clean(value).toLowerCase().replace(/\.$/, ""))
    .filter(Boolean);
  if (
    !hosts.length ||
    hosts.some(host => host.includes(":") || host.includes("/") || host === "*")
  ) {
    throw new MoodleApiError(
      "Moodle allowed hosts are not configured safely.",
      503,
      "configuration"
    );
  }
  return new Set(hosts);
}

function normalizeBaseUrl(
  value: string,
  allowInsecureLocalhost: boolean,
  allowedHosts: ReadonlySet<string>
) {
  let url: URL;
  try {
    url = new URL(clean(value));
  } catch {
    throw new MoodleApiError(
      "Moodle base URL is invalid.",
      503,
      "configuration"
    );
  }

  const isAllowedLocalHttp =
    allowInsecureLocalhost &&
    url.protocol === "http:" &&
    localHosts.has(url.hostname);
  if (url.protocol !== "https:" && !isAllowedLocalHttp) {
    throw new MoodleApiError("Moodle must use HTTPS.", 503, "configuration");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new MoodleApiError(
      "Moodle base URL must not contain credentials, a query, or a fragment.",
      503,
      "configuration"
    );
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!allowedHosts.has(hostname)) {
    throw new MoodleApiError(
      "Moodle host is outside the configured allowlist.",
      503,
      "configuration"
    );
  }
  if (isIP(hostname) && !(allowInsecureLocalhost && localHosts.has(hostname))) {
    throw new MoodleApiError(
      "Moodle must use an approved public hostname.",
      503,
      "configuration"
    );
  }

  url.pathname = `${url.pathname.replace(/\/+$/, "")}/`;
  return url;
}

function isPrivateOrLocalAddress(address: string) {
  const normalized = address.toLowerCase();
  if (normalized.startsWith("::ffff:")) {
    return isPrivateOrLocalAddress(normalized.slice("::ffff:".length));
  }
  if (isIP(normalized) === 4) {
    const [a, b] = normalized.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (isIP(normalized) === 6) {
    return (
      normalized === "::" ||
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      /^fe[89ab]/.test(normalized)
    );
  }
  return true;
}

async function resolvePublicDestination(
  hostname: string,
  allowInsecureLocalhost: boolean,
  resolveHostname: NonNullable<MoodleClientOptions["resolveHostname"]>,
  signal: AbortSignal
) {
  if (allowInsecureLocalhost && localHosts.has(hostname)) {
    return [{ address: hostname, family: isIP(hostname) || 4 }];
  }
  let addresses: Array<{ address: string; family: number }>;
  let onAbort: (() => void) | undefined;
  try {
    const aborted = new Promise<never>((_resolve, reject) => {
      onAbort = () => {
        const error = new Error("Moodle DNS resolution timed out.");
        error.name = "AbortError";
        reject(error);
      };
      if (signal.aborted) onAbort();
      else signal.addEventListener("abort", onAbort, { once: true });
    });
    addresses = await Promise.race([resolveHostname(hostname), aborted]);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new MoodleApiError(
      "Moodle host could not be resolved safely.",
      503,
      "configuration"
    );
  } finally {
    if (onAbort) signal.removeEventListener("abort", onAbort);
  }
  if (
    !addresses.length ||
    addresses.some(result => isPrivateOrLocalAddress(result.address))
  ) {
    throw new MoodleApiError(
      "Moodle host resolved to a private or local address.",
      503,
      "configuration"
    );
  }
  return addresses;
}

function createPinnedLookup(
  addresses: Array<{ address: string; family: number }>
): LookupFunction {
  return (_hostname, options, callback) => {
    const candidates = options.family
      ? addresses.filter(result => result.family === options.family)
      : addresses;
    if (!candidates.length) {
      const error = new Error(
        "Moodle host has no address for the requested family."
      ) as NodeJS.ErrnoException;
      error.code = "ENOTFOUND";
      callback(error, "", 0);
      return;
    }
    if (options.all) {
      callback(null, candidates);
      return;
    }
    callback(null, candidates[0].address, candidates[0].family);
  };
}

function headersFromIncoming(
  incoming: Record<string, string | string[] | undefined>
) {
  const headers = new Headers();
  Object.entries(incoming).forEach(([name, value]) => {
    if (Array.isArray(value)) {
      value.forEach(item => headers.append(name, item));
    } else if (value !== undefined) {
      headers.set(name, value);
    }
  });
  return headers;
}

function postPinnedHttps(
  endpoint: URL,
  body: URLSearchParams,
  signal: AbortSignal,
  addresses: Array<{ address: string; family: number }>
) {
  return new Promise<Response>((resolve, reject) => {
    const payload = Buffer.from(body.toString(), "utf8");
    const request = httpsRequest(
      endpoint,
      {
        method: "POST",
        agent: false,
        lookup: createPinnedLookup(addresses),
        servername: endpoint.hostname,
        signal,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          "Content-Length": String(payload.byteLength),
        },
      },
      incoming => {
        const status = incoming.statusCode ?? 502;
        const hasBody = status !== 204 && status !== 205 && status !== 304;
        const responseBody = hasBody
          ? (Readable.toWeb(incoming) as ReadableStream<Uint8Array>)
          : null;
        resolve(
          new Response(responseBody, {
            status,
            statusText: incoming.statusMessage,
            headers: headersFromIncoming(incoming.headers),
          })
        );
      }
    );
    request.once("error", reject);
    request.end(payload);
  });
}

function appendParameter(
  target: URLSearchParams,
  key: string,
  value: MoodleParameter
) {
  if (value === null || value === undefined) return;
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      appendParameter(target, `${key}[${index}]`, item)
    );
    return;
  }
  if (typeof value === "object") {
    Object.entries(value).forEach(([childKey, childValue]) =>
      appendParameter(target, `${key}[${childKey}]`, childValue)
    );
    return;
  }
  target.append(
    key,
    typeof value === "boolean" ? (value ? "1" : "0") : String(value)
  );
}

function assertSafeParameterKey(key: string) {
  if (reservedParameterPattern.test(key)) {
    throw new MoodleApiError(
      "Moodle protocol parameters cannot be overridden.",
      403,
      "function_not_allowed"
    );
  }
}

function isMoodleError(payload: unknown): payload is MoodleErrorPayload {
  return Boolean(
    payload &&
      typeof payload === "object" &&
      ("exception" in payload || "errorcode" in payload)
  );
}

function classifyMoodleError(errorCode: string) {
  if (errorCode === "invalidtoken" || errorCode === "missingtoken") {
    return { code: "authentication" as const, statusCode: 401 };
  }
  if (
    errorCode === "webservice_access_exception" ||
    errorCode === "nopermissions" ||
    errorCode === "requireloginerror"
  ) {
    return { code: "permission" as const, statusCode: 403 };
  }
  return { code: "remote" as const, statusCode: 502 };
}

function safeRemoteMessage(code: MoodleErrorCode) {
  if (code === "authentication") return "Moodle credentials were rejected.";
  if (code === "permission") {
    return "Moodle service account lacks required read access.";
  }
  return "Moodle rejected the read request.";
}

async function readBoundedResponse(response: Response, maxBytes: number) {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    await response.body?.cancel().catch(() => undefined);
    throw new MoodleApiError(
      "Moodle response exceeded the configured limit.",
      502,
      "invalid_response"
    );
  }
  if (!response.body) return "";

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      throw new MoodleApiError(
        "Moodle response exceeded the configured limit.",
        502,
        "invalid_response"
      );
    }
    chunks.push(value);
  }
  return Buffer.concat(
    chunks.map(chunk => Buffer.from(chunk)),
    totalBytes
  ).toString("utf8");
}

function requireObject<T>(payload: unknown, label: string): T {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new MoodleApiError(
      `Moodle returned an invalid ${label} response.`,
      502,
      "invalid_response"
    );
  }
  return payload as T;
}

export function getMoodleServerStatus(env: NodeJS.ProcessEnv = process.env) {
  const enabled = clean(env.MOODLE_READ_ONLY_ENABLED) === "1";
  const baseUrlConfigured = Boolean(clean(env.MOODLE_BASE_URL));
  const serviceConfigured = Boolean(clean(env.MOODLE_SERVICE));
  const tokenConfigured = Boolean(clean(env.MOODLE_TOKEN));
  const allowedHostsConfigured = Boolean(clean(env.MOODLE_ALLOWED_HOSTS));
  return {
    enabled,
    baseUrlConfigured,
    serviceConfigured,
    tokenConfigured,
    allowedHostsConfigured,
    configured:
      enabled &&
      baseUrlConfigured &&
      serviceConfigured &&
      tokenConfigured &&
      allowedHostsConfigured,
    mode: "read_only" as const,
  };
}

export function createMoodleClient({
  enabled,
  baseUrl,
  token,
  allowedHosts,
  fetchImpl,
  timeoutMs = 15_000,
  maxResponseBytes = 10 * 1024 * 1024,
  allowInsecureLocalhost = false,
  resolveHostname = async hostname =>
    lookupHostname(hostname, { all: true, verbatim: true }),
  now = () => new Date(),
}: MoodleClientOptions) {
  if (!enabled) {
    throw new MoodleApiError(
      "Moodle read-only integration is disabled.",
      503,
      "configuration"
    );
  }
  const safeToken = clean(token);
  if (!safeToken) {
    throw new MoodleApiError(
      "Moodle read-only credentials are not configured.",
      503,
      "configuration"
    );
  }
  const safeAllowedHosts = normalizeAllowedHosts(allowedHosts);
  const safeBaseUrl = normalizeBaseUrl(
    baseUrl,
    allowInsecureLocalhost,
    safeAllowedHosts
  );
  const endpoint = new URL("webservice/rest/server.php", safeBaseUrl);
  const boundedTimeout = Math.min(60_000, Math.max(1_000, timeoutMs));
  const boundedMaxResponse = Math.min(
    25 * 1024 * 1024,
    Math.max(1_024, maxResponseBytes)
  );

  const call = async <T>(
    functionName: MoodleReadFunction,
    parameters: Record<string, MoodleParameter> = {}
  ): Promise<T> => {
    if (!readFunctionSet.has(functionName)) {
      throw new MoodleApiError(
        "Moodle function is not approved for read-only use.",
        403,
        "function_not_allowed"
      );
    }

    const body = new URLSearchParams();
    Object.entries(parameters).forEach(([key, value]) => {
      assertSafeParameterKey(key);
      appendParameter(body, key, value);
    });
    body.set("wstoken", safeToken);
    body.set("wsfunction", functionName);
    body.set("moodlewsrestformat", "json");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), boundedTimeout);
    timeout.unref?.();
    try {
      const addresses = await resolvePublicDestination(
        safeBaseUrl.hostname,
        allowInsecureLocalhost,
        resolveHostname,
        controller.signal
      );
      const response = fetchImpl
        ? await fetchImpl(endpoint, {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
            },
            body,
            redirect: "error",
            signal: controller.signal,
          })
        : await postPinnedHttps(endpoint, body, controller.signal, addresses);
      const raw = await readBoundedResponse(response, boundedMaxResponse);
      let payload: unknown;
      try {
        payload = JSON.parse(raw);
      } catch {
        throw new MoodleApiError(
          "Moodle returned a non-JSON response.",
          502,
          "invalid_response"
        );
      }
      if (isMoodleError(payload)) {
        const errorCode = clean(payload.errorcode);
        const classification = classifyMoodleError(errorCode);
        throw new MoodleApiError(
          safeRemoteMessage(classification.code),
          classification.statusCode,
          classification.code
        );
      }
      if (!response.ok) {
        throw new MoodleApiError(
          `Moodle returned HTTP ${response.status}.`,
          502,
          "remote"
        );
      }
      return payload as T;
    } catch (error) {
      if (error instanceof MoodleApiError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new MoodleApiError(
          "Moodle did not respond before the read timeout.",
          504,
          "timeout"
        );
      }
      throw new MoodleApiError("Moodle could not be reached.", 502, "remote");
    } finally {
      clearTimeout(timeout);
    }
  };

  return {
    mode: "read_only" as const,
    call,
    async probe() {
      const site = requireObject<MoodleSiteInfo>(
        await call<MoodleSiteInfo>("core_webservice_get_site_info"),
        "site information"
      );
      if (!clean(site.sitename) || !clean(site.siteurl)) {
        throw new MoodleApiError(
          "Moodle site information is incomplete.",
          502,
          "invalid_response"
        );
      }
      const availableFunctions = Array.isArray(site.functions)
        ? Array.from(
            new Set(
              site.functions
                .map(item => clean(item?.name))
                .filter((name): name is string => Boolean(name))
            )
          )
        : [];
      const availableSet = new Set(availableFunctions);
      const missingApprovedFunctions = MOODLE_READ_FUNCTIONS.filter(
        name => !availableSet.has(name)
      );
      const unexpectedFunctions = availableFunctions.filter(
        name => !readFunctionSet.has(name)
      );
      return {
        mode: "read_only" as const,
        verifiedAt: now().toISOString(),
        site: {
          name: site.sitename,
          url: site.siteurl,
          release: clean(site.release) || undefined,
          version: clean(site.version) || undefined,
        },
        availableFunctionCount: availableFunctions.length,
        approvedFunctionCount: MOODLE_READ_FUNCTIONS.length,
        missingApprovedFunctions,
        unexpectedFunctions,
        minimumPrivilegeVerified:
          missingApprovedFunctions.length === 0 &&
          unexpectedFunctions.length === 0,
      };
    },
    async getCourses() {
      const payload = requireObject<{
        courses?: MoodleCourse[];
        warnings?: MoodleWarning[];
      }>(
        await call("core_course_get_courses_by_field", {
          field: "",
          value: "",
        }),
        "course list"
      );
      return {
        courses: Array.isArray(payload.courses) ? payload.courses : [],
        warnings: Array.isArray(payload.warnings) ? payload.warnings : [],
      };
    },
    async getCourseContents(courseId: number) {
      if (!Number.isSafeInteger(courseId) || courseId <= 0) {
        throw new MoodleApiError(
          "Moodle course ID is invalid.",
          400,
          "invalid_response"
        );
      }
      const payload = await call<unknown>("core_course_get_contents", {
        courseid: courseId,
      });
      if (!Array.isArray(payload)) {
        throw new MoodleApiError(
          "Moodle returned an invalid course content response.",
          502,
          "invalid_response"
        );
      }
      return payload as MoodleCourseSection[];
    },
  };
}

export type MoodleClient = ReturnType<typeof createMoodleClient>;

export function createMoodleClientFromEnvironment(
  env: NodeJS.ProcessEnv = process.env
) {
  const timeoutMs = Number(env.MOODLE_TIMEOUT_MS);
  return createMoodleClient({
    enabled: clean(env.MOODLE_READ_ONLY_ENABLED) === "1",
    baseUrl: env.MOODLE_BASE_URL ?? "",
    token: env.MOODLE_TOKEN ?? "",
    allowedHosts: (env.MOODLE_ALLOWED_HOSTS ?? "")
      .split(",")
      .map(host => host.trim())
      .filter(Boolean),
    timeoutMs:
      Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : undefined,
  });
}
