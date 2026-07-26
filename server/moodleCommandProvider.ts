import crypto from "node:crypto";
import type { MoodleCommandOperation } from "./moodleCommandContract.js";

export type MoodleProviderCommandRequest = Readonly<{
  protocolVersion: "1.0";
  operation: MoodleCommandOperation;
  idempotencyKey: string;
  payloadHash: string;
  expectedProviderVersion: string;
  actorExternalId: string;
  targetExternalId?: string;
  targetContextExternalId: string;
  originatingCommandId: string;
  payloadJson: string;
}>;

export type MoodleProviderCommandResult = Readonly<{
  commandUuid: string;
  operation: MoodleCommandOperation;
  status: "applied";
  providerVersion: string;
  resultJson: string;
  replayed: boolean;
}>;

export class MoodleCommandProviderError extends Error {
  constructor(
    message: string,
    readonly outcome: "failed" | "unknown" | "denied",
    readonly code: string,
    readonly providerRequestId?: string
  ) {
    super(message);
    this.name = "MoodleCommandProviderError";
  }
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function validateConfig(env: NodeJS.ProcessEnv) {
  const enabled = clean(env.MOODLE_COMMANDS_ENABLED) === "1";
  const baseUrl = clean(env.MOODLE_COMMAND_BASE_URL || env.MOODLE_BASE_URL);
  const token = clean(env.MOODLE_COMMAND_TOKEN);
  const allowedHosts = new Set(
    clean(env.MOODLE_ALLOWED_HOSTS)
      .split(",")
      .map(item => item.trim().toLowerCase())
      .filter(Boolean)
  );
  const projectRef = clean(env.SUPABASE_URL).match(
    /^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/
  )?.[1];
  if (
    !enabled ||
    projectRef !== "xvgsypaatibntfocvvxn" ||
    !baseUrl ||
    !token
  ) {
    throw new MoodleCommandProviderError(
      "Moodle command provider is disabled.",
      "failed",
      "configuration"
    );
  }
  const url = new URL(baseUrl);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !allowedHosts.has(url.hostname.toLowerCase())
  ) {
    throw new MoodleCommandProviderError(
      "Moodle command provider configuration is unsafe.",
      "failed",
      "configuration"
    );
  }
  return { endpoint: new URL("webservice/rest/server.php", `${url.href.replace(/\/+$/, "")}/`), token };
}

export class MoodleCommandProvider {
  constructor(
    private readonly env: NodeJS.ProcessEnv = process.env,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  async execute(
    request: MoodleProviderCommandRequest
  ): Promise<MoodleProviderCommandResult> {
    const config = validateConfig(this.env);
    const body = new URLSearchParams({
      wstoken: config.token,
      wsfunction: "local_nilelearn_execute_command",
      moodlewsrestformat: "json",
      protocolversion: request.protocolVersion,
      operation: request.operation,
      idempotencykey: request.idempotencyKey,
      payloadhash: request.payloadHash,
      expectedproviderversion: request.expectedProviderVersion,
      actoruserid: request.actorExternalId,
      targetcontextid: request.targetContextExternalId,
      targetexternalid: request.targetExternalId ?? "",
      commanduuid: request.originatingCommandId,
      payloadjson: request.payloadJson,
    });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    timeout.unref?.();
    const providerRequestId = crypto.randomUUID();
    try {
      const response = await this.fetchImpl(config.endpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          "X-Nile-Learn-Request-Id": providerRequestId,
        },
        body,
        redirect: "error",
        signal: controller.signal,
      });
      const raw = await response.text();
      if (Buffer.byteLength(raw, "utf8") > 256_000) {
        throw new MoodleCommandProviderError(
          "Moodle response exceeded the command limit.",
          "unknown",
          "oversize_response",
          providerRequestId
        );
      }
      let payload: unknown;
      try {
        payload = JSON.parse(raw);
      } catch {
        throw new MoodleCommandProviderError(
          "Moodle returned an invalid command response.",
          "unknown",
          "invalid_response",
          providerRequestId
        );
      }
      if (
        payload &&
        typeof payload === "object" &&
        ("exception" in payload || "errorcode" in payload)
      ) {
        const code = clean((payload as Record<string, unknown>).errorcode) || "provider_error";
        const denied = /permission|capability|access/i.test(code);
        throw new MoodleCommandProviderError(
          "Moodle rejected the command.",
          denied ? "denied" : "failed",
          denied ? "provider_denied" : "provider_rejected",
          providerRequestId
        );
      }
      if (!response.ok) {
        throw new MoodleCommandProviderError(
          "Moodle command outcome is unknown.",
          "unknown",
          "http_error",
          providerRequestId
        );
      }
      const result = payload as Record<string, unknown>;
      if (
        typeof result.commandUuid !== "string" ||
        result.operation !== request.operation ||
        result.status !== "applied" ||
        typeof result.providerVersion !== "string" ||
        typeof result.resultJson !== "string" ||
        typeof result.replayed !== "boolean"
      ) {
        throw new MoodleCommandProviderError(
          "Moodle command response is incomplete.",
          "unknown",
          "invalid_response",
          providerRequestId
        );
      }
      return result as MoodleProviderCommandResult;
    } catch (error) {
      if (error instanceof MoodleCommandProviderError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new MoodleCommandProviderError(
          "Moodle command timed out.",
          "unknown",
          "timeout",
          providerRequestId
        );
      }
      throw new MoodleCommandProviderError(
        "Moodle command transport failed.",
        "unknown",
        "transport",
        providerRequestId
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
