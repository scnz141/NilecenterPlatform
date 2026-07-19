import { lookup as lookupHostname } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { isIP, type LookupFunction } from "node:net";
import { Readable } from "node:stream";

export const MOODLE_SANDBOX_WRITE_HOST = "moodle-no-data.enesekremergunesh.com";

export const MOODLE_SANDBOX_WRITE_ACK =
  "I_ACKNOWLEDGE_NILE_M2B_SYNTHETIC_SANDBOX_WRITES_ONLY";

export const MOODLE_SANDBOX_WRITE_FUNCTIONS = [
  "core_webservice_get_site_info",
  "core_user_get_users",
  "core_user_create_users",
  "core_user_update_users",
  "core_user_delete_users",
  "enrol_manual_enrol_users",
  "enrol_manual_unenrol_users",
  "core_group_create_groups",
  "core_group_delete_groups",
  "core_group_add_group_members",
  "core_group_delete_group_members",
] as const;

export const MOODLE_SANDBOX_WRITE_LIMITS = {
  requestBytes: 32 * 1024,
  responseBytes: 1024 * 1024,
  serviceCharacters: 64,
  usernameCharacters: 64,
  nameCharacters: 100,
  emailCharacters: 254,
  passwordCharacters: 128,
  groupNameCharacters: 255,
  groupDescriptionCharacters: 1_024,
} as const;

export type MoodleSandboxWriteFunction =
  (typeof MOODLE_SANDBOX_WRITE_FUNCTIONS)[number];

export type MoodleSandboxWriteErrorCode =
  | "configuration"
  | "function_not_allowed"
  | "guard"
  | "authentication"
  | "permission"
  | "remote"
  | "timeout"
  | "invalid_response";

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

export type MoodleSandboxWriteGuard = {
  marker: string;
};

export type MoodleSandboxWriteClientOptions = {
  enabled: boolean;
  baseUrl: string;
  service: string;
  token: string;
  syntheticAck: string;
  allowedCourseId: number;
  allowedRoleId: number;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxResponseBytes?: number;
  resolveHostname?: (
    hostname: string
  ) => Promise<Array<{ address: string; family: number }>>;
  now?: () => Date;
};

export type MoodleSandboxSyntheticUserInput = {
  marker: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
};

export type MoodleSandboxSyntheticUserUpdate =
  MoodleSandboxSyntheticUserInput & {
    userId: number;
  };

export type MoodleSandboxMarkedUser = {
  marker: string;
  userId: number;
};

export type MoodleSandboxMarkedGroup = {
  marker: string;
  groupId: number;
};

export type MoodleSandboxMarkedMembership = MoodleSandboxMarkedUser &
  MoodleSandboxMarkedGroup;

export type MoodleSandboxCreatedUser = {
  id: number;
  username: string;
};

export type MoodleSandboxFoundUser = {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  email?: string;
  marker: string;
};

export type MoodleSandboxCreatedGroup = {
  id: number;
  name: string;
};

const writeFunctionSet = new Set<string>(MOODLE_SANDBOX_WRITE_FUNCTIONS);
const reservedProtocolKeys = new Set([
  "wstoken",
  "wsfunction",
  "moodlewsrestformat",
]);
const markerPattern =
  /^NILE-M2B-(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z-[0-9a-fA-F]{8}$/;

export class MoodleSandboxWriteError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly code: MoodleSandboxWriteErrorCode
  ) {
    super(message);
    this.name = "MoodleSandboxWriteError";
  }
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function configurationError(message: string): never {
  throw new MoodleSandboxWriteError(message, 503, "configuration");
}

function guardError(message: string): never {
  throw new MoodleSandboxWriteError(message, 403, "guard");
}

function invalidInput(message: string): never {
  throw new MoodleSandboxWriteError(message, 400, "guard");
}

function invalidResponse(label: string): never {
  throw new MoodleSandboxWriteError(
    `Moodle sandbox returned an invalid ${label} response.`,
    502,
    "invalid_response"
  );
}

function normalizeBaseUrl(value: string) {
  let url: URL;
  try {
    url = new URL(clean(value));
  } catch {
    configurationError("Moodle sandbox write base URL is invalid.");
  }

  if (url.protocol !== "https:") {
    configurationError("Moodle sandbox writes require HTTPS.");
  }
  if (url.username || url.password || url.search || url.hash) {
    configurationError(
      "Moodle sandbox write base URL must not contain credentials, a query, or a fragment."
    );
  }
  if (url.port && url.port !== "443") {
    configurationError("Moodle sandbox writes require the default HTTPS port.");
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (hostname !== MOODLE_SANDBOX_WRITE_HOST) {
    configurationError(
      "Moodle sandbox writes are restricted to the approved practice host."
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
  resolveHostname: NonNullable<
    MoodleSandboxWriteClientOptions["resolveHostname"]
  >,
  signal: AbortSignal
) {
  let addresses: Array<{ address: string; family: number }>;
  let onAbort: (() => void) | undefined;
  try {
    const aborted = new Promise<never>((_resolve, reject) => {
      onAbort = () => {
        const error = new Error("Moodle sandbox DNS resolution timed out.");
        error.name = "AbortError";
        reject(error);
      };
      if (signal.aborted) onAbort();
      else signal.addEventListener("abort", onAbort, { once: true });
    });
    addresses = await Promise.race([resolveHostname(hostname), aborted]);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    configurationError("Moodle sandbox host could not be resolved safely.");
  } finally {
    if (onAbort) signal.removeEventListener("abort", onAbort);
  }

  if (
    !addresses.length ||
    addresses.some(result => isPrivateOrLocalAddress(result.address))
  ) {
    configurationError(
      "Moodle sandbox host resolved to a private or local address."
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
        "Moodle sandbox host has no address for the requested family."
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
          "Accept-Encoding": "identity",
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

function assertNoReservedProtocolKeys(
  value: MoodleParameter,
  key = "parameters"
) {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertNoReservedProtocolKeys(item, `${key}[${index}]`)
    );
    return;
  }
  if (!value || typeof value !== "object") return;
  Object.entries(value).forEach(([childKey, childValue]) => {
    if (reservedProtocolKeys.has(childKey.toLowerCase())) {
      throw new MoodleSandboxWriteError(
        "Moodle protocol parameters cannot be overridden.",
        403,
        "function_not_allowed"
      );
    }
    assertNoReservedProtocolKeys(childValue, `${key}[${childKey}]`);
  });
}

function requireObject(
  value: unknown,
  label: string
): Record<string, MoodleParameter> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    invalidInput(`Moodle sandbox ${label} is invalid.`);
  }
  return value as Record<string, MoodleParameter>;
}

function requireOneItem(value: unknown, label: string) {
  if (!Array.isArray(value) || value.length !== 1) {
    invalidInput(`Moodle sandbox ${label} must contain exactly one item.`);
  }
  return value[0];
}

function assertExactKeys(
  value: Record<string, MoodleParameter>,
  expected: readonly string[],
  label: string
) {
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  if (
    actual.length !== required.length ||
    actual.some((key, index) => key !== required[index])
  ) {
    invalidInput(`Moodle sandbox ${label} shape is invalid.`);
  }
}

function requirePositiveId(value: unknown, label: string) {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) {
    invalidInput(`Moodle sandbox ${label} is invalid.`);
  }
  return Number(value);
}

function requireBoundedText(value: unknown, label: string, maximum: number) {
  const text = clean(value);
  if (!text || text.length > maximum || /[\u0000-\u001f\u007f]/.test(text)) {
    invalidInput(`Moodle sandbox ${label} is invalid.`);
  }
  return text;
}

export function isMoodleSandboxMarker(value: unknown): value is string {
  const marker = clean(value);
  const match = markerPattern.exec(marker);
  if (!match) return false;
  const [, year, month, day, hour, minute, second] = match;
  const timestamp = new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second)
    )
  );
  return (
    !Number.isNaN(timestamp.getTime()) &&
    timestamp.toISOString().slice(0, 19).replace(/[-:]/g, "") + "Z" ===
      `${year}${month}${day}T${hour}${minute}${second}Z`
  );
}

function requireMarker(value: unknown) {
  if (!isMoodleSandboxMarker(value)) {
    guardError("Moodle sandbox write marker is invalid.");
  }
  return clean(value);
}

function syntheticUsernameForMarker(marker: string) {
  return `nile-m2b-${marker.slice("NILE-M2B-".length).toLowerCase()}`;
}

function requireSyntheticEmail(value: unknown) {
  const email = requireBoundedText(
    value,
    "synthetic email",
    MOODLE_SANDBOX_WRITE_LIMITS.emailCharacters
  );
  const [local, domain, extra] = email.split("@");
  if (
    extra !== undefined ||
    !local ||
    domain?.toLowerCase() !== "example.invalid" ||
    local.startsWith(".") ||
    local.endsWith(".") ||
    local.includes("..") ||
    !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(local)
  ) {
    guardError("Moodle sandbox users require a fake example.invalid identity.");
  }
  return email;
}

function requireSyntheticPassword(value: unknown) {
  const password = requireBoundedText(
    value,
    "synthetic password",
    MOODLE_SANDBOX_WRITE_LIMITS.passwordCharacters
  );
  if (
    password.length < 24 ||
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/\d/.test(password) ||
    !/[^A-Za-z0-9]/.test(password)
  ) {
    guardError("Moodle sandbox users require a strong one-run password.");
  }
  return password;
}

function requireAllowedCourseId(value: unknown, allowedCourseId: number) {
  const courseId = requirePositiveId(value, "course ID");
  if (courseId !== allowedCourseId) {
    guardError("Moodle sandbox course is outside the configured write scope.");
  }
}

function requireAllowedRoleId(value: unknown, allowedRoleId: number) {
  const roleId = requirePositiveId(value, "role ID");
  if (roleId !== allowedRoleId) {
    guardError("Moodle sandbox role is outside the configured write scope.");
  }
}

function validateSyntheticUser(
  item: unknown,
  marker: string,
  mode: "create" | "update"
) {
  const user = requireObject(item, "user");
  assertExactKeys(
    user,
    mode === "create"
      ? ["username", "firstname", "lastname", "email", "idnumber", "password"]
      : ["id", "username", "firstname", "lastname", "email", "idnumber"],
    "user"
  );
  if (mode === "update") requirePositiveId(user.id, "user ID");
  const username = requireBoundedText(
    user.username,
    "username",
    MOODLE_SANDBOX_WRITE_LIMITS.usernameCharacters
  );
  if (username !== syntheticUsernameForMarker(marker)) {
    guardError("Moodle sandbox username does not match the write marker.");
  }
  requireBoundedText(
    user.firstname,
    "first name",
    MOODLE_SANDBOX_WRITE_LIMITS.nameCharacters
  );
  requireBoundedText(
    user.lastname,
    "last name",
    MOODLE_SANDBOX_WRITE_LIMITS.nameCharacters
  );
  const email = requireSyntheticEmail(user.email);
  if (email !== `${username}@example.invalid`) {
    guardError("Moodle sandbox email does not match the synthetic username.");
  }
  if (user.idnumber !== marker) {
    guardError("Moodle sandbox user marker does not match the write marker.");
  }
  if (mode === "create") requireSyntheticPassword(user.password);
}

function validateWriteParameters(
  functionName: MoodleSandboxWriteFunction,
  parameters: Record<string, MoodleParameter>,
  marker: string,
  allowedCourseId: number,
  allowedRoleId: number
) {
  switch (functionName) {
    case "core_user_get_users": {
      assertExactKeys(parameters, ["criteria"], "request");
      const criterion = requireObject(
        requireOneItem(parameters.criteria, "user search criteria"),
        "user search criterion"
      );
      assertExactKeys(criterion, ["key", "value"], "user search criterion");
      if (criterion.key !== "idnumber") {
        guardError(
          "Moodle sandbox user lookup is restricted to the run marker."
        );
      }
      if (criterion.value !== marker) {
        guardError(
          "Moodle sandbox user lookup marker does not match the run marker."
        );
      }
      return;
    }
    case "core_user_create_users": {
      assertExactKeys(parameters, ["users"], "request");
      validateSyntheticUser(
        requireOneItem(parameters.users, "users"),
        marker,
        "create"
      );
      return;
    }
    case "core_user_update_users": {
      assertExactKeys(parameters, ["users"], "request");
      validateSyntheticUser(
        requireOneItem(parameters.users, "users"),
        marker,
        "update"
      );
      return;
    }
    case "core_user_delete_users": {
      assertExactKeys(parameters, ["userids"], "request");
      requirePositiveId(
        requireOneItem(parameters.userids, "user IDs"),
        "user ID"
      );
      return;
    }
    case "enrol_manual_enrol_users":
    case "enrol_manual_unenrol_users": {
      assertExactKeys(parameters, ["enrolments"], "request");
      const enrolment = requireObject(
        requireOneItem(parameters.enrolments, "enrolments"),
        "enrolment"
      );
      assertExactKeys(
        enrolment,
        functionName === "enrol_manual_enrol_users"
          ? ["roleid", "userid", "courseid", "suspend"]
          : ["roleid", "userid", "courseid"],
        "enrolment"
      );
      requireAllowedRoleId(enrolment.roleid, allowedRoleId);
      requirePositiveId(enrolment.userid, "user ID");
      requireAllowedCourseId(enrolment.courseid, allowedCourseId);
      if (
        functionName === "enrol_manual_enrol_users" &&
        enrolment.suspend !== 0
      ) {
        guardError("Moodle sandbox enrolment must be active.");
      }
      return;
    }
    case "core_group_create_groups": {
      assertExactKeys(parameters, ["groups"], "request");
      const group = requireObject(
        requireOneItem(parameters.groups, "groups"),
        "group"
      );
      assertExactKeys(
        group,
        ["courseid", "name", "description", "idnumber"],
        "group"
      );
      requireAllowedCourseId(group.courseid, allowedCourseId);
      const name = requireBoundedText(
        group.name,
        "group name",
        MOODLE_SANDBOX_WRITE_LIMITS.groupNameCharacters
      );
      if (group.idnumber !== marker || !name.includes(marker)) {
        guardError(
          "Moodle sandbox group marker does not match the write marker."
        );
      }
      const description = requireBoundedText(
        group.description,
        "group description",
        MOODLE_SANDBOX_WRITE_LIMITS.groupDescriptionCharacters
      );
      if (!description.includes(marker)) {
        guardError(
          "Moodle sandbox group description must contain the write marker."
        );
      }
      return;
    }
    case "core_group_delete_groups": {
      assertExactKeys(parameters, ["groupids"], "request");
      requirePositiveId(
        requireOneItem(parameters.groupids, "group IDs"),
        "group ID"
      );
      return;
    }
    case "core_group_add_group_members":
    case "core_group_delete_group_members": {
      assertExactKeys(parameters, ["members"], "request");
      const member = requireObject(
        requireOneItem(parameters.members, "members"),
        "group member"
      );
      assertExactKeys(member, ["groupid", "userid"], "group member");
      requirePositiveId(member.groupid, "group ID");
      requirePositiveId(member.userid, "user ID");
      return;
    }
    case "core_webservice_get_site_info":
      invalidInput("Moodle sandbox probe parameters are invalid.");
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

function safeRemoteMessage(code: MoodleSandboxWriteErrorCode) {
  if (code === "authentication") {
    return "Moodle sandbox write credentials were rejected.";
  }
  if (code === "permission") {
    return "Moodle sandbox service lacks required write access.";
  }
  return "Moodle sandbox rejected the write request.";
}

async function readBoundedResponse(response: Response, maxBytes: number) {
  const contentEncoding = clean(response.headers.get("content-encoding"));
  if (contentEncoding && contentEncoding.toLowerCase() !== "identity") {
    await response.body?.cancel().catch(() => undefined);
    invalidResponse("write");
  }
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    await response.body?.cancel().catch(() => undefined);
    invalidResponse("write");
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
      invalidResponse("write");
    }
    chunks.push(value);
  }
  return Buffer.concat(
    chunks.map(chunk => Buffer.from(chunk)),
    totalBytes
  ).toString("utf8");
}

function requireResponseObject(
  value: unknown,
  label: string
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    invalidResponse(label);
  }
  return value as Record<string, unknown>;
}

function parseSiteInfo(payload: unknown) {
  const site = requireResponseObject(payload, "site information");
  const sitename = clean(site.sitename);
  const siteurl = clean(site.siteurl);
  if (!sitename || !siteurl || !Array.isArray(site.functions)) {
    invalidResponse("site information");
  }

  let parsedSiteUrl: URL;
  try {
    parsedSiteUrl = new URL(siteurl);
  } catch {
    invalidResponse("site information");
  }
  if (
    parsedSiteUrl.protocol !== "https:" ||
    parsedSiteUrl.hostname.toLowerCase().replace(/\.$/, "") !==
      MOODLE_SANDBOX_WRITE_HOST ||
    (parsedSiteUrl.port && parsedSiteUrl.port !== "443") ||
    parsedSiteUrl.username ||
    parsedSiteUrl.password ||
    parsedSiteUrl.search ||
    parsedSiteUrl.hash
  ) {
    invalidResponse("site information");
  }

  if (site.functions.length > 100) invalidResponse("site information");
  const functions = site.functions.map(item => {
    const entry = requireResponseObject(item, "site function");
    const name = clean(entry.name);
    if (!name || name.length > 128) invalidResponse("site function");
    return name;
  });

  return {
    sitename,
    siteurl,
    release: clean(site.release) || undefined,
    version: clean(site.version) || undefined,
    functions,
  };
}

function parseCreatedUser(
  payload: unknown,
  parameters: Record<string, MoodleParameter>
) {
  const item = requireResponseObject(
    requireOneResponseItem(payload, "created user"),
    "created user"
  );
  const id = requireResponseId(item.id, "created user");
  const username = clean(item.username);
  const requestedUser = requireObject(
    requireOneItem(parameters.users, "users"),
    "user"
  );
  if (
    !username ||
    username.length > MOODLE_SANDBOX_WRITE_LIMITS.usernameCharacters ||
    username !== requestedUser.username
  ) {
    invalidResponse("created user");
  }
  return [{ id, username }];
}

function parseFoundUsers(
  payload: unknown,
  parameters: Record<string, MoodleParameter>,
  marker: string
) {
  const result = requireResponseObject(payload, "marked user lookup");
  if (
    !Array.isArray(result.users) ||
    result.users.length > 10 ||
    !Array.isArray(result.warnings) ||
    result.warnings.length !== 0
  ) {
    invalidResponse("marked user lookup");
  }
  const criterion = requireObject(
    requireOneItem(parameters.criteria, "user search criteria"),
    "user search criterion"
  );
  const expectedUsername = syntheticUsernameForMarker(marker);
  return result.users.map(value => {
    const item = requireResponseObject(value, "marked user");
    const id = requireResponseId(item.id, "marked user");
    const username = clean(item.username);
    const firstName = clean(item.firstname);
    const lastName = clean(item.lastname);
    const email = clean(item.email);
    const idnumber = clean(item.idnumber);
    const deleted =
      item.deleted === true || item.deleted === 1 || item.deleted === "1";
    if (
      deleted ||
      criterion.key !== "idnumber" ||
      criterion.value !== marker ||
      idnumber !== marker ||
      username !== expectedUsername ||
      username.length > MOODLE_SANDBOX_WRITE_LIMITS.usernameCharacters ||
      !firstName ||
      firstName.length > MOODLE_SANDBOX_WRITE_LIMITS.nameCharacters ||
      !lastName ||
      lastName.length > MOODLE_SANDBOX_WRITE_LIMITS.nameCharacters ||
      (email !== "" && email !== `${expectedUsername}@example.invalid`) ||
      email.length > MOODLE_SANDBOX_WRITE_LIMITS.emailCharacters
    ) {
      invalidResponse("marked user");
    }
    if (idnumber && idnumber !== marker) invalidResponse("marked user");
    return {
      id,
      username,
      firstName,
      lastName,
      ...(email ? { email } : {}),
      marker,
    } satisfies MoodleSandboxFoundUser;
  });
}

function parseCreatedGroup(
  payload: unknown,
  parameters: Record<string, MoodleParameter>
) {
  const item = requireResponseObject(
    requireOneResponseItem(payload, "created group"),
    "created group"
  );
  const id = requireResponseId(item.id, "created group");
  const name = clean(item.name);
  const requestedGroup = requireObject(
    requireOneItem(parameters.groups, "groups"),
    "group"
  );
  if (
    !name ||
    name.length > MOODLE_SANDBOX_WRITE_LIMITS.groupNameCharacters ||
    name !== requestedGroup.name ||
    item.courseid !== requestedGroup.courseid ||
    item.idnumber !== requestedGroup.idnumber ||
    (item.enrolmentkey !== undefined && item.enrolmentkey !== "")
  ) {
    invalidResponse("created group");
  }
  return [{ id, name }];
}

function parseEmptyWarnings(payload: unknown) {
  const result = requireResponseObject(payload, "user update");
  if (!Array.isArray(result.warnings) || result.warnings.length !== 0) {
    throw new MoodleSandboxWriteError(
      "Moodle sandbox rejected the write request.",
      502,
      "remote"
    );
  }
  return null;
}

function requireOneResponseItem(payload: unknown, label: string) {
  if (!Array.isArray(payload) || payload.length !== 1) invalidResponse(label);
  return payload[0];
}

function requireResponseId(value: unknown, label: string) {
  if (!Number.isSafeInteger(value) || Number(value) <= 0)
    invalidResponse(label);
  return Number(value);
}

function parseWriteResponse(
  functionName: MoodleSandboxWriteFunction,
  payload: unknown,
  parameters: Record<string, MoodleParameter>,
  marker?: string
) {
  if (functionName === "core_webservice_get_site_info") {
    return parseSiteInfo(payload);
  }
  if (functionName === "core_user_create_users") {
    return parseCreatedUser(payload, parameters);
  }
  if (functionName === "core_user_get_users") {
    if (!marker) invalidResponse("marked user lookup");
    return parseFoundUsers(payload, parameters, marker);
  }
  if (functionName === "core_user_update_users") {
    return parseEmptyWarnings(payload);
  }
  if (functionName === "core_group_create_groups") {
    return parseCreatedGroup(payload, parameters);
  }
  if (payload !== null) invalidResponse("write acknowledgement");
  return null;
}

function parseConfiguredId(value: unknown) {
  const canonical = clean(value);
  if (!/^[1-9]\d*$/.test(canonical)) return undefined;
  const parsed = Number(canonical);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export function getMoodleSandboxWriteServerStatus(
  env: NodeJS.ProcessEnv = process.env
) {
  const enabled = env.MOODLE_SANDBOX_WRITE_ENABLED === "1";
  const baseUrlConfigured = Boolean(clean(env.MOODLE_SANDBOX_WRITE_BASE_URL));
  const writeService = clean(env.MOODLE_SANDBOX_WRITE_SERVICE);
  const writeToken = clean(env.MOODLE_SANDBOX_WRITE_TOKEN);
  const readService = clean(env.MOODLE_SERVICE);
  const readToken = clean(env.MOODLE_TOKEN);
  const serviceConfigured = Boolean(writeService);
  const tokenConfigured = Boolean(writeToken);
  const readServiceSeparated = !readService || writeService !== readService;
  const readTokenSeparated = !readToken || writeToken !== readToken;
  const syntheticAckConfigured =
    env.MOODLE_SANDBOX_WRITE_SYNTHETIC_ACK === MOODLE_SANDBOX_WRITE_ACK;
  const allowedCourseIdConfigured = Boolean(
    parseConfiguredId(env.MOODLE_SANDBOX_WRITE_COURSE_ID)
  );
  const allowedRoleIdConfigured = Boolean(
    parseConfiguredId(env.MOODLE_SANDBOX_WRITE_ROLE_ID)
  );
  return {
    enabled,
    baseUrlConfigured,
    serviceConfigured,
    tokenConfigured,
    readServiceSeparated,
    readTokenSeparated,
    syntheticAckConfigured,
    allowedCourseIdConfigured,
    allowedRoleIdConfigured,
    configured:
      enabled &&
      baseUrlConfigured &&
      serviceConfigured &&
      tokenConfigured &&
      readServiceSeparated &&
      readTokenSeparated &&
      syntheticAckConfigured &&
      allowedCourseIdConfigured &&
      allowedRoleIdConfigured,
    mode: "sandbox_write" as const,
  };
}

export function createMoodleSandboxWriteClient({
  enabled,
  baseUrl,
  service,
  token,
  syntheticAck,
  allowedCourseId,
  allowedRoleId,
  fetchImpl,
  timeoutMs = 10_000,
  maxResponseBytes = MOODLE_SANDBOX_WRITE_LIMITS.responseBytes,
  resolveHostname = async hostname =>
    lookupHostname(hostname, { all: true, verbatim: true }),
  now = () => new Date(),
}: MoodleSandboxWriteClientOptions) {
  if (!enabled) {
    configurationError("Moodle sandbox writes are disabled.");
  }
  if (syntheticAck !== MOODLE_SANDBOX_WRITE_ACK) {
    configurationError(
      "Moodle sandbox synthetic write acknowledgement is missing."
    );
  }
  const safeService = clean(service);
  if (
    !safeService ||
    safeService.length > MOODLE_SANDBOX_WRITE_LIMITS.serviceCharacters ||
    !/^[a-z0-9_]+$/.test(safeService)
  ) {
    configurationError("Moodle sandbox write service is invalid.");
  }
  const safeToken = clean(token);
  if (!safeToken || safeToken.length > 512) {
    configurationError("Moodle sandbox write credentials are not configured.");
  }
  if (!Number.isSafeInteger(allowedCourseId) || allowedCourseId <= 0) {
    configurationError("Moodle sandbox write course scope is invalid.");
  }
  if (!Number.isSafeInteger(allowedRoleId) || allowedRoleId <= 0) {
    configurationError("Moodle sandbox write role scope is invalid.");
  }
  const safeCourseId = allowedCourseId;
  const safeRoleId = allowedRoleId;
  const safeBaseUrl = normalizeBaseUrl(baseUrl);
  const endpoint = new URL("webservice/rest/server.php", safeBaseUrl);
  const boundedTimeout = Math.min(30_000, Math.max(1_000, timeoutMs));
  const boundedMaxResponse = Math.min(
    MOODLE_SANDBOX_WRITE_LIMITS.responseBytes,
    Math.max(1_024, maxResponseBytes)
  );
  let serviceVerified = false;

  const call = async <T>(
    functionName: MoodleSandboxWriteFunction,
    parameters: Record<string, MoodleParameter> = {},
    guard?: MoodleSandboxWriteGuard
  ): Promise<T> => {
    let marker: string | undefined;
    if (!writeFunctionSet.has(functionName)) {
      throw new MoodleSandboxWriteError(
        "Moodle function is not approved for sandbox writes.",
        403,
        "function_not_allowed"
      );
    }

    assertNoReservedProtocolKeys(parameters);
    if (functionName === "core_webservice_get_site_info") {
      if (Object.keys(parameters).length || guard !== undefined) {
        invalidInput("Moodle sandbox probe parameters are invalid.");
      }
    } else {
      if (!serviceVerified) {
        guardError(
          "Moodle sandbox write service has not passed the exact capability probe."
        );
      }
      marker = requireMarker(guard?.marker);
      validateWriteParameters(
        functionName,
        parameters,
        marker,
        safeCourseId,
        safeRoleId
      );
    }

    const body = new URLSearchParams();
    Object.entries(parameters).forEach(([key, value]) =>
      appendParameter(body, key, value)
    );
    body.set("wstoken", safeToken);
    body.set("wsfunction", functionName);
    body.set("moodlewsrestformat", "json");
    if (
      Buffer.byteLength(body.toString(), "utf8") >
      MOODLE_SANDBOX_WRITE_LIMITS.requestBytes
    ) {
      invalidInput(
        "Moodle sandbox write request exceeds the configured limit."
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), boundedTimeout);
    timeout.unref?.();
    try {
      const addresses = await resolvePublicDestination(
        safeBaseUrl.hostname,
        resolveHostname,
        controller.signal
      );
      const response = fetchImpl
        ? await fetchImpl(endpoint, {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Accept-Encoding": "identity",
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
        throw new MoodleSandboxWriteError(
          "Moodle sandbox returned a non-JSON response.",
          502,
          "invalid_response"
        );
      }
      if (isMoodleError(payload)) {
        const classification = classifyMoodleError(clean(payload.errorcode));
        throw new MoodleSandboxWriteError(
          safeRemoteMessage(classification.code),
          classification.statusCode,
          classification.code
        );
      }
      if (!response.ok) {
        throw new MoodleSandboxWriteError(
          `Moodle sandbox returned HTTP ${response.status}.`,
          502,
          "remote"
        );
      }
      return parseWriteResponse(functionName, payload, parameters, marker) as T;
    } catch (error) {
      if (error instanceof MoodleSandboxWriteError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new MoodleSandboxWriteError(
          "Moodle sandbox did not respond before the write timeout.",
          504,
          "timeout"
        );
      }
      throw new MoodleSandboxWriteError(
        "Moodle sandbox could not be reached.",
        502,
        "remote"
      );
    } finally {
      clearTimeout(timeout);
    }
  };

  return {
    mode: "sandbox_write" as const,
    call,
    async probe() {
      serviceVerified = false;
      const site = await call<ReturnType<typeof parseSiteInfo>>(
        "core_webservice_get_site_info"
      );
      const availableSet = new Set(site.functions);
      const missingApprovedFunctions = MOODLE_SANDBOX_WRITE_FUNCTIONS.filter(
        name => !availableSet.has(name)
      );
      const unexpectedFunctions = Array.from(availableSet).filter(
        name => !writeFunctionSet.has(name)
      );
      const hasDuplicateFunctions = availableSet.size !== site.functions.length;
      serviceVerified =
        !missingApprovedFunctions.length &&
        !unexpectedFunctions.length &&
        !hasDuplicateFunctions &&
        site.functions.length === MOODLE_SANDBOX_WRITE_FUNCTIONS.length;
      return {
        mode: "sandbox_write" as const,
        verifiedAt: now().toISOString(),
        service: safeService,
        site: {
          name: site.sitename,
          url: site.siteurl,
          release: site.release,
          version: site.version,
        },
        availableFunctionCount: site.functions.length,
        approvedFunctionCount: MOODLE_SANDBOX_WRITE_FUNCTIONS.length,
        missingApprovedFunctions,
        unexpectedFunctions,
        hasDuplicateFunctions,
        minimumPrivilegeVerified: serviceVerified,
      };
    },
    async createUser(input: MoodleSandboxSyntheticUserInput) {
      const result = await call<MoodleSandboxCreatedUser[]>(
        "core_user_create_users",
        {
          users: [
            {
              username: input.username,
              firstname: input.firstName,
              lastname: input.lastName,
              email: input.email,
              idnumber: input.marker,
              password: input.password,
            },
          ],
        },
        { marker: input.marker }
      );
      return result[0];
    },
    async findUsersByMarker(marker: string) {
      return call<MoodleSandboxFoundUser[]>(
        "core_user_get_users",
        {
          criteria: [{ key: "idnumber", value: marker }],
        },
        { marker }
      );
    },
    async updateUser(input: MoodleSandboxSyntheticUserUpdate) {
      await call<null>(
        "core_user_update_users",
        {
          users: [
            {
              id: input.userId,
              username: input.username,
              firstname: input.firstName,
              lastname: input.lastName,
              email: input.email,
              idnumber: input.marker,
            },
          ],
        },
        { marker: input.marker }
      );
    },
    async deleteUser(input: MoodleSandboxMarkedUser) {
      await call<null>(
        "core_user_delete_users",
        { userids: [input.userId] },
        { marker: input.marker }
      );
    },
    async enrolUser(input: MoodleSandboxMarkedUser) {
      await call<null>(
        "enrol_manual_enrol_users",
        {
          enrolments: [
            {
              roleid: safeRoleId,
              userid: input.userId,
              courseid: safeCourseId,
              suspend: 0,
            },
          ],
        },
        { marker: input.marker }
      );
    },
    async unenrolUser(input: MoodleSandboxMarkedUser) {
      await call<null>(
        "enrol_manual_unenrol_users",
        {
          enrolments: [
            {
              roleid: safeRoleId,
              userid: input.userId,
              courseid: safeCourseId,
            },
          ],
        },
        { marker: input.marker }
      );
    },
    async createGroup(input: {
      marker: string;
      name: string;
      description: string;
    }) {
      const result = await call<MoodleSandboxCreatedGroup[]>(
        "core_group_create_groups",
        {
          groups: [
            {
              courseid: safeCourseId,
              name: input.name,
              description: input.description,
              idnumber: input.marker,
            },
          ],
        },
        { marker: input.marker }
      );
      return result[0];
    },
    async deleteGroup(input: MoodleSandboxMarkedGroup) {
      await call<null>(
        "core_group_delete_groups",
        { groupids: [input.groupId] },
        { marker: input.marker }
      );
    },
    async addGroupMember(input: MoodleSandboxMarkedMembership) {
      await call<null>(
        "core_group_add_group_members",
        { members: [{ groupid: input.groupId, userid: input.userId }] },
        { marker: input.marker }
      );
    },
    async deleteGroupMember(input: MoodleSandboxMarkedMembership) {
      await call<null>(
        "core_group_delete_group_members",
        { members: [{ groupid: input.groupId, userid: input.userId }] },
        { marker: input.marker }
      );
    },
  };
}

export type MoodleSandboxWriteClient = ReturnType<
  typeof createMoodleSandboxWriteClient
>;

export function createMoodleSandboxWriteClientFromEnvironment(
  env: NodeJS.ProcessEnv = process.env
) {
  const writeService = clean(env.MOODLE_SANDBOX_WRITE_SERVICE);
  const writeToken = clean(env.MOODLE_SANDBOX_WRITE_TOKEN);
  const readService = clean(env.MOODLE_SERVICE);
  const readToken = clean(env.MOODLE_TOKEN);
  if (
    (readService && writeService === readService) ||
    (readToken && writeToken === readToken)
  ) {
    configurationError(
      "Moodle sandbox read and write credentials must remain separate."
    );
  }
  const timeoutMs = Number(env.MOODLE_SANDBOX_WRITE_TIMEOUT_MS);
  return createMoodleSandboxWriteClient({
    enabled: env.MOODLE_SANDBOX_WRITE_ENABLED === "1",
    baseUrl: env.MOODLE_SANDBOX_WRITE_BASE_URL ?? "",
    service: writeService,
    token: writeToken,
    syntheticAck: env.MOODLE_SANDBOX_WRITE_SYNTHETIC_ACK ?? "",
    allowedCourseId:
      parseConfiguredId(env.MOODLE_SANDBOX_WRITE_COURSE_ID) ?? Number.NaN,
    allowedRoleId:
      parseConfiguredId(env.MOODLE_SANDBOX_WRITE_ROLE_ID) ?? Number.NaN,
    timeoutMs:
      Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : undefined,
  });
}

export const MOODLE_SANDBOX_COURSE_ACK =
  "I_ACKNOWLEDGE_NILE_M2CC_SYNTHETIC_COURSE_WRITES_ONLY";

export const MOODLE_SANDBOX_COURSE_FUNCTIONS = [
  "core_webservice_get_site_info",
  "core_course_get_courses_by_field",
  "core_course_create_courses",
  "core_course_update_courses",
  "core_course_delete_courses",
] as const;

export type MoodleSandboxCourseFunction =
  (typeof MOODLE_SANDBOX_COURSE_FUNCTIONS)[number];

export type MoodleSandboxCourseInput = {
  marker: string;
  fullName: string;
  updatedFullName: string;
  shortName: string;
  summary: string;
};

export type MoodleSandboxCourse = {
  id: number;
  marker: string;
  fullName: string;
  shortName: string;
  summary: string;
  categoryId: number;
};

export type MoodleSandboxCourseClientOptions = {
  enabled: boolean;
  baseUrl: string;
  service: string;
  token: string;
  syntheticAck: string;
  allowedCategoryId: number;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxResponseBytes?: number;
  resolveHostname?: (
    hostname: string
  ) => Promise<Array<{ address: string; family: number }>>;
  now?: () => Date;
};

const courseFunctionSet = new Set<string>(MOODLE_SANDBOX_COURSE_FUNCTIONS);
const courseMarkerPattern =
  /^NILE-M2CC-(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z-[0-9a-fA-F]{8}$/;

export function isMoodleSandboxCourseMarker(value: unknown): value is string {
  const marker = clean(value);
  const match = courseMarkerPattern.exec(marker);
  if (!match) return false;
  const [, year, month, day, hour, minute, second] = match;
  const date = new Date(
    `${year}-${month}-${day}T${hour}:${minute}:${second}.000Z`
  );
  return (
    !Number.isNaN(date.getTime()) &&
    date
      .toISOString()
      .startsWith(`${year}-${month}-${day}T${hour}:${minute}:${second}`)
  );
}

function requireCourseMarker(value: unknown) {
  if (!isMoodleSandboxCourseMarker(value)) {
    invalidInput("Moodle sandbox course marker is invalid.");
  }
  return value;
}

function parseSandboxCourse(
  value: unknown,
  marker: string,
  allowedCategoryId: number
): MoodleSandboxCourse {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    invalidResponse("course lookup");
  }
  const item = value as Record<string, unknown>;
  const id = Number(item.id);
  const categoryId = Number(item.categoryid);
  const foundMarker = clean(item.idnumber);
  const fullName = clean(item.fullname);
  const shortName = clean(item.shortname);
  const summary = clean(item.summary);
  if (
    !Number.isSafeInteger(id) ||
    id <= 0 ||
    categoryId !== allowedCategoryId ||
    foundMarker !== marker ||
    !fullName ||
    !shortName ||
    !shortName.toLowerCase().includes(marker.toLowerCase())
  ) {
    invalidResponse("course lookup");
  }
  return { id, marker, fullName, shortName, summary, categoryId };
}

export function createMoodleSandboxCourseClient({
  enabled,
  baseUrl,
  service,
  token,
  syntheticAck,
  allowedCategoryId,
  fetchImpl,
  timeoutMs = 10_000,
  maxResponseBytes = MOODLE_SANDBOX_WRITE_LIMITS.responseBytes,
  resolveHostname = async hostname =>
    lookupHostname(hostname, { all: true, verbatim: true }),
  now = () => new Date(),
}: MoodleSandboxCourseClientOptions) {
  if (!enabled)
    configurationError("Moodle sandbox course writes are disabled.");
  if (syntheticAck !== MOODLE_SANDBOX_COURSE_ACK) {
    configurationError(
      "Moodle sandbox synthetic course acknowledgement is missing."
    );
  }
  const safeService = clean(service);
  const safeToken = clean(token);
  if (!safeService || !/^[a-z0-9_]+$/.test(safeService)) {
    configurationError("Moodle sandbox course service is invalid.");
  }
  if (!safeToken || safeToken.length > 512) {
    configurationError("Moodle sandbox course credentials are not configured.");
  }
  if (!Number.isSafeInteger(allowedCategoryId) || allowedCategoryId <= 0) {
    configurationError("Moodle sandbox course category scope is invalid.");
  }

  const safeBaseUrl = normalizeBaseUrl(baseUrl);
  const endpoint = new URL("webservice/rest/server.php", safeBaseUrl);
  const boundedTimeout = Math.min(30_000, Math.max(1_000, timeoutMs));
  const boundedMaxResponse = Math.min(
    MOODLE_SANDBOX_WRITE_LIMITS.responseBytes,
    Math.max(1_024, maxResponseBytes)
  );
  let serviceVerified = false;
  const verifiedCourseIds = new Map<number, string>();

  const call = async <T>(
    functionName: MoodleSandboxCourseFunction,
    parameters: Record<string, MoodleParameter> = {}
  ): Promise<T> => {
    if (!courseFunctionSet.has(functionName)) {
      throw new MoodleSandboxWriteError(
        "Moodle function is not approved for sandbox course writes.",
        403,
        "function_not_allowed"
      );
    }
    assertNoReservedProtocolKeys(parameters);
    if (functionName === "core_webservice_get_site_info") {
      if (Object.keys(parameters).length)
        invalidInput("Invalid probe parameters.");
    } else if (!serviceVerified) {
      guardError(
        "Moodle sandbox course service has not passed the exact capability probe."
      );
    }

    const body = new URLSearchParams();
    Object.entries(parameters).forEach(([key, value]) =>
      appendParameter(body, key, value)
    );
    body.set("wstoken", safeToken);
    body.set("wsfunction", functionName);
    body.set("moodlewsrestformat", "json");
    if (
      Buffer.byteLength(body.toString(), "utf8") >
      MOODLE_SANDBOX_WRITE_LIMITS.requestBytes
    ) {
      invalidInput(
        "Moodle sandbox course request exceeds the configured limit."
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), boundedTimeout);
    timeout.unref?.();
    try {
      const addresses = await resolvePublicDestination(
        safeBaseUrl.hostname,
        resolveHostname,
        controller.signal
      );
      const response = fetchImpl
        ? await fetchImpl(endpoint, {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Accept-Encoding": "identity",
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
        throw new MoodleSandboxWriteError(
          "Moodle sandbox returned a non-JSON response.",
          502,
          "invalid_response"
        );
      }
      if (isMoodleError(payload)) {
        const classification = classifyMoodleError(clean(payload.errorcode));
        throw new MoodleSandboxWriteError(
          safeRemoteMessage(classification.code),
          classification.statusCode,
          classification.code
        );
      }
      if (!response.ok) {
        throw new MoodleSandboxWriteError(
          `Moodle sandbox returned HTTP ${response.status}.`,
          502,
          "remote"
        );
      }
      return payload as T;
    } catch (error) {
      if (error instanceof MoodleSandboxWriteError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new MoodleSandboxWriteError(
          "Moodle sandbox did not respond before the course timeout.",
          504,
          "timeout"
        );
      }
      throw new MoodleSandboxWriteError(
        "Moodle sandbox could not be reached.",
        502,
        "remote"
      );
    } finally {
      clearTimeout(timeout);
    }
  };

  return {
    mode: "sandbox_course_write" as const,
    call,
    async probe() {
      serviceVerified = false;
      const site = parseSiteInfo(
        await call<unknown>("core_webservice_get_site_info")
      );
      const availableSet = new Set(site.functions);
      const missingApprovedFunctions = MOODLE_SANDBOX_COURSE_FUNCTIONS.filter(
        name => !availableSet.has(name)
      );
      const unexpectedFunctions = Array.from(availableSet).filter(
        name => !courseFunctionSet.has(name)
      );
      const hasDuplicateFunctions = availableSet.size !== site.functions.length;
      serviceVerified =
        !missingApprovedFunctions.length &&
        !unexpectedFunctions.length &&
        !hasDuplicateFunctions &&
        site.functions.length === MOODLE_SANDBOX_COURSE_FUNCTIONS.length;
      return {
        mode: "sandbox_course_write" as const,
        verifiedAt: now().toISOString(),
        service: safeService,
        site: { name: site.sitename, url: site.siteurl },
        availableFunctionCount: site.functions.length,
        approvedFunctionCount: MOODLE_SANDBOX_COURSE_FUNCTIONS.length,
        missingApprovedFunctions,
        unexpectedFunctions,
        hasDuplicateFunctions,
        minimumPrivilegeVerified: serviceVerified,
      };
    },
    async findCourseByMarker(markerValue: string) {
      const marker = requireCourseMarker(markerValue);
      const payload = await call<unknown>("core_course_get_courses_by_field", {
        field: "idnumber",
        value: marker,
      });
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        invalidResponse("course lookup");
      }
      const courses = (payload as { courses?: unknown }).courses;
      if (!Array.isArray(courses) || courses.length > 1) {
        invalidResponse("course lookup");
      }
      if (!courses.length) return undefined;
      const course = parseSandboxCourse(courses[0], marker, allowedCategoryId);
      verifiedCourseIds.set(course.id, marker);
      return course;
    },
    async createCourse(input: MoodleSandboxCourseInput) {
      const marker = requireCourseMarker(input.marker);
      if (
        clean(input.fullName).length < 3 ||
        clean(input.fullName).length > 254 ||
        clean(input.shortName).length < 3 ||
        clean(input.shortName).length > 100 ||
        !clean(input.shortName).toLowerCase().includes(marker.toLowerCase()) ||
        clean(input.summary).length > 2_000
      ) {
        invalidInput("Moodle sandbox synthetic course input is invalid.");
      }
      const payload = await call<unknown[]>("core_course_create_courses", {
        courses: [
          {
            fullname: clean(input.fullName),
            shortname: clean(input.shortName),
            categoryid: allowedCategoryId,
            idnumber: marker,
            summary: clean(input.summary),
            summaryformat: 1,
            visible: 0,
          },
        ],
      });
      if (!Array.isArray(payload) || payload.length !== 1) {
        invalidResponse("course creation");
      }
      const item = payload[0] as Record<string, unknown>;
      const id = Number(item?.id);
      if (
        !Number.isSafeInteger(id) ||
        id <= 0 ||
        clean(item?.shortname) !== clean(input.shortName)
      ) {
        invalidResponse("course creation");
      }
      verifiedCourseIds.set(id, marker);
      return { id, shortName: clean(item.shortname) };
    },
    async updateCourse(input: MoodleSandboxCourseInput & { courseId: number }) {
      const marker = requireCourseMarker(input.marker);
      if (verifiedCourseIds.get(input.courseId) !== marker) {
        guardError("Moodle sandbox course was not reconciled before update.");
      }
      if (
        clean(input.updatedFullName).length < 3 ||
        clean(input.updatedFullName).length > 254
      ) {
        invalidInput("Moodle sandbox synthetic course update is invalid.");
      }
      await call<unknown>("core_course_update_courses", {
        courses: [
          {
            id: input.courseId,
            fullname: clean(input.updatedFullName),
            idnumber: marker,
            summary: clean(input.summary),
            summaryformat: 1,
            visible: 0,
          },
        ],
      });
    },
    async deleteCourse(input: { marker: string; courseId: number }) {
      const marker = requireCourseMarker(input.marker);
      if (verifiedCourseIds.get(input.courseId) !== marker) {
        guardError("Moodle sandbox course was not reconciled before deletion.");
      }
      await call<unknown>("core_course_delete_courses", {
        courseids: [input.courseId],
      });
      verifiedCourseIds.delete(input.courseId);
    },
  };
}

export type MoodleSandboxCourseClient = ReturnType<
  typeof createMoodleSandboxCourseClient
>;

export function createMoodleSandboxCourseClientFromEnvironment(
  env: NodeJS.ProcessEnv = process.env
) {
  const timeoutMs = Number(env.MOODLE_SANDBOX_COURSE_TIMEOUT_MS);
  return createMoodleSandboxCourseClient({
    enabled: env.MOODLE_SANDBOX_COURSE_ENABLED === "1",
    baseUrl: env.MOODLE_SANDBOX_COURSE_BASE_URL ?? "",
    service: clean(env.MOODLE_SANDBOX_COURSE_SERVICE),
    token: clean(env.MOODLE_SANDBOX_COURSE_TOKEN),
    syntheticAck: env.MOODLE_SANDBOX_COURSE_SYNTHETIC_ACK ?? "",
    allowedCategoryId:
      parseConfiguredId(env.MOODLE_SANDBOX_COURSE_CATEGORY_ID) ?? Number.NaN,
    timeoutMs:
      Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : undefined,
  });
}
