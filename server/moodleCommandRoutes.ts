import crypto from "node:crypto";
import { getRequestSession } from "./auth.js";
import {
  MoodleCommandRepositoryConflictError,
  MoodleCommandRepositoryDeniedError,
  MoodleCommandRepositoryUnavailableError,
  SupabaseMoodleCommandRepository,
} from "./moodleCommandRepository.js";
import { MoodleCommandService } from "./moodleCommandService.js";
import {
  MoodleCommandValidationError,
  parseMoodleCommandCreateDto,
  parseMoodleLaunchCreateDto,
} from "./moodleCommandRuntime.js";
import { getMoodleRoleCapabilities } from "./moodleCommandContract.js";

type Request = {
  body?: Record<string, unknown>;
  params?: Record<string, string | undefined>;
  headers: { cookie?: string };
  get(name: string): string | undefined;
};
type Response = {
  status(code: number): Response;
  json(body: unknown): void;
};
type Handler = (request: Request, response: Response) => void | Promise<void>;
type App = {
  get(path: string, handler: Handler): void;
  post(path: string, handler: Handler): void;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function enabled(env: NodeJS.ProcessEnv) {
  return (
    clean(env.NILE_MOODLE_COMMAND_RUNTIME_ENABLED) === "1" &&
    clean(env.NILE_MOODLE_PLUGIN_ACCEPTED) === "1" &&
    Boolean(clean(env.MOODLE_COMMAND_BASE_URL || env.MOODLE_BASE_URL)) &&
    Boolean(clean(env.MOODLE_COMMAND_TOKEN || env.MOODLE_TOKEN))
  );
}

function constantTimeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function internalAuthorized(request: Request, env: NodeJS.ProcessEnv) {
  const value = clean(request.get("authorization"));
  if (!value.startsWith("Bearer ")) return false;
  const supplied = value.slice(7).trim();
  return [env.NILE_MOODLE_WORKER_SECRET, env.CRON_SECRET]
    .map(clean)
    .filter(Boolean)
    .some(secret => constantTimeEqual(supplied, secret));
}

function launchExchangeAuthorized(request: Request, env: NodeJS.ProcessEnv) {
  const value = clean(request.get("authorization"));
  const secret = clean(env.NILE_MOODLE_LAUNCH_EXCHANGE_SECRET);
  if (!value.startsWith("Bearer ") || !secret) return false;
  return constantTimeEqual(value.slice(7).trim(), secret);
}

function sendError(error: unknown, response: Response) {
  if (error instanceof MoodleCommandValidationError) {
    response.status(400).json({ error: error.message });
    return;
  }
  if (error instanceof MoodleCommandRepositoryDeniedError) {
    response.status(403).json({ error: error.message });
    return;
  }
  if (error instanceof MoodleCommandRepositoryConflictError) {
    response.status(409).json({ error: error.message });
    return;
  }
  if (error instanceof MoodleCommandRepositoryUnavailableError) {
    response.status(503).json({ error: error.message });
    return;
  }
  response.status(500).json({ error: "Moodle command failed safely." });
}

function requireUuid(value: unknown) {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  ) {
    throw new MoodleCommandValidationError("Command ID is invalid.");
  }
  return value;
}

export function registerMoodleCommandRoutes(
  app: App,
  env: NodeJS.ProcessEnv = process.env,
  repository = new SupabaseMoodleCommandRepository(),
  service = new MoodleCommandService(repository),
  getSession: typeof getRequestSession = getRequestSession
) {
  app.get(
    "/api/integrations/moodle/capabilities",
    async (request, response) => {
      const session = await getSession(request);
      if (!session) {
        response.status(401).json({ error: "Sign in required." });
        return;
      }
      const normalized = session.authorizationModel === "normalized";
      const runtimeEnabled = enabled(env);
      const capabilities = getMoodleRoleCapabilities(session.activeRole);
      response.json({
        state: !normalized
          ? "normalized_session_required"
          : runtimeEnabled
            ? "available"
            : "disabled",
        operations: normalized && runtimeEnabled ? capabilities.operations : [],
        nativeLaunchKinds:
          normalized && runtimeEnabled ? capabilities.nativeLaunchKinds : [],
        scopeValidatedOnCommand: true,
      });
    }
  );

  app.get("/api/integrations/moodle/commands", async (request, response) => {
    const session = await getSession(request);
    if (!session || session.activeRole !== "superadmin") {
      response.status(403).json({ error: "Super Admin access is required." });
      return;
    }
    if (session.authorizationModel !== "normalized") {
      response.json({
        commands: [],
        runtimeState: "normalized_session_required",
      });
      return;
    }
    try {
      const commands = await repository.listForAdmin(50);
      response.json({
        commands,
        runtimeState: enabled(env) ? "available" : "disabled",
      });
    } catch (error) {
      sendError(error, response);
    }
  });

  app.post("/api/integrations/moodle/commands", async (request, response) => {
    if (!enabled(env)) {
      response.status(503).json({ error: "Moodle commands are not active." });
      return;
    }
    const session = await getSession(request);
    if (
      !session ||
      session.authorizationModel !== "normalized" ||
      !["teacher", "headofdepartment", "superadmin"].includes(
        session.activeRole
      )
    ) {
      response
        .status(403)
        .json({ error: "Normalized Moodle command access is required." });
      return;
    }
    try {
      const input = parseMoodleCommandCreateDto(request.body);
      const created = await repository.create(session.id, input);
      const processed = await service.processOne(
        `moodle-immediate-${crypto.randomUUID()}`
      );
      response.status(202).json({ command: created, processing: processed });
    } catch (error) {
      sendError(error, response);
    }
  });

  app.get(
    "/api/integrations/moodle/commands/:commandId",
    async (request, response) => {
      if (!enabled(env)) {
        response.status(503).json({ error: "Moodle commands are not active." });
        return;
      }
      const session = await getSession(request);
      if (!session || session.authorizationModel !== "normalized") {
        response.status(401).json({ error: "Sign in required." });
        return;
      }
      try {
        const status = await repository.status(
          session.id,
          requireUuid(request.params?.commandId)
        );
        response.json({ command: status });
      } catch (error) {
        sendError(error, response);
      }
    }
  );

  app.post(
    "/api/integrations/moodle/commands/:commandId/reconcile",
    async (request, response) => {
      if (!enabled(env)) {
        response.status(503).json({ error: "Moodle commands are not active." });
        return;
      }
      const session = await getSession(request);
      if (
        !session ||
        session.authorizationModel !== "normalized" ||
        session.activeRole !== "superadmin"
      ) {
        response
          .status(403)
          .json({ error: "Normalized Super Admin access is required." });
        return;
      }
      const resolution = request.body?.resolution;
      if (
        !["confirmed_applied", "confirmed_not_applied", "cancelled"].includes(
          String(resolution)
        )
      ) {
        response.status(400).json({ error: "Resolution is invalid." });
        return;
      }
      try {
        const result = await repository.reconcile(
          session.id,
          requireUuid(request.params?.commandId),
          resolution as
            | "confirmed_applied"
            | "confirmed_not_applied"
            | "cancelled",
          clean(request.body?.providerResultHash) || undefined,
          clean(request.body?.providerVersion) || undefined
        );
        response.json({ reconciliation: result });
      } catch (error) {
        sendError(error, response);
      }
    }
  );

  app.post(
    "/api/internal/moodle-commands/process",
    async (request, response) => {
      if (!internalAuthorized(request, env)) {
        response
          .status(401)
          .json({ error: "Worker authorization is required." });
        return;
      }
      if (!enabled(env)) {
        response.status(503).json({ error: "Moodle commands are not active." });
        return;
      }
      try {
        const results = [];
        for (let index = 0; index < 10; index += 1) {
          const result = await service.processOne(
            `moodle-worker-${crypto.randomUUID()}`
          );
          results.push(result);
          if (result.outcome === "empty") break;
        }
        response.json({
          processed: results.filter(item => item.outcome !== "empty").length,
          results,
        });
      } catch (error) {
        sendError(error, response);
      }
    }
  );

  app.post("/api/integrations/moodle/launches", async (request, response) => {
    if (!enabled(env)) {
      response.status(503).json({ error: "Moodle launches are not active." });
      return;
    }
    const session = await getSession(request);
    if (!session || session.authorizationModel !== "normalized") {
      response.status(401).json({ error: "Sign in required." });
      return;
    }
    try {
      const input = parseMoodleLaunchCreateDto(request.body);
      const launch = await repository.createLaunch(
        session.id,
        session.userId,
        input
      );
      const baseUrl = clean(env.MOODLE_COMMAND_BASE_URL || env.MOODLE_BASE_URL);
      const url = new URL(
        "local/nilelearn/launch.php",
        `${baseUrl.replace(/\/+$/, "")}/`
      );
      url.searchParams.set("ticket", launch.ticket);
      response.status(201).json({
        launchId: launch.launchId,
        launchUrl: url.toString(),
        expiresAt: launch.expiresAt,
      });
    } catch (error) {
      sendError(error, response);
    }
  });

  app.post(
    "/api/internal/moodle-launches/exchange",
    async (request, response) => {
      if (!launchExchangeAuthorized(request, env)) {
        response
          .status(401)
          .json({ error: "Launch exchange authorization is required." });
        return;
      }
      try {
        const ticket = clean(request.body?.ticket);
        if (ticket.length < 32 || ticket.length > 128) {
          throw new MoodleCommandValidationError(
            "Moodle launch ticket is invalid."
          );
        }
        const launch = await repository.consumeLaunch(ticket);
        response.json({ launch });
      } catch (error) {
        sendError(error, response);
      }
    }
  );
}
