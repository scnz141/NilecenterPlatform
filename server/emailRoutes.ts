import crypto from "node:crypto";
import {
  createEmailDeliveryService,
  getEmailIntegrationStatus,
} from "./emailDeliveryService.js";
import { EmailProviderDisabledError } from "./emailProvider.js";
import {
  EmailDeliveryRepositoryConflictError,
  EmailDeliveryRepositoryUnavailableError,
} from "./emailDeliveryRepository.js";

type EmailApiRequest = {
  rawBody?: Buffer;
  get(name: string): string | undefined;
};

type EmailApiResponse = {
  status(code: number): EmailApiResponse;
  json(body: unknown): void;
};

type RouteHandler = (
  req: EmailApiRequest,
  res: EmailApiResponse
) => void | Promise<void>;

type EmailRouteApp = {
  get(path: string, handler: RouteHandler): void;
  post(path: string, handler: RouteHandler): void;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function constantTimeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function workerAuthorized(req: EmailApiRequest, env: NodeJS.ProcessEnv) {
  const authorization = clean(req.get("authorization"));
  if (!authorization.startsWith("Bearer ")) return false;
  const supplied = authorization.slice(7).trim();
  return [env.NILE_EMAIL_WORKER_SECRET, env.CRON_SECRET]
    .map(clean)
    .filter(Boolean)
    .some(configured => constantTimeEqual(supplied, configured));
}

export function registerEmailRoutes(
  app: EmailRouteApp,
  env: NodeJS.ProcessEnv = process.env,
  serviceFactory = () => createEmailDeliveryService(env)
) {
  app.post("/api/integrations/resend/webhook", async (req, res) => {
    const payload = req.rawBody?.toString("utf8") ?? "";
    const id = clean(req.get("svix-id"));
    const timestamp = clean(req.get("svix-timestamp"));
    const signature = clean(req.get("svix-signature"));
    if (!payload || !id || !timestamp || !signature) {
      res.status(400).json({ error: "Invalid email webhook request." });
      return;
    }
    try {
      const result = await serviceFactory().handleWebhook({
        payload,
        id,
        timestamp,
        signature,
      });
      res.status(result.duplicate ? 200 : 202).json({
        accepted: true,
        duplicate: result.duplicate,
        ignored: result.ignored,
      });
    } catch (error) {
      if (
        error instanceof EmailDeliveryRepositoryUnavailableError ||
        error instanceof EmailProviderDisabledError
      ) {
        res
          .status(503)
          .json({ error: "Email webhook service is unavailable." });
        return;
      }
      if (error instanceof EmailDeliveryRepositoryConflictError) {
        res.status(409).json({ error: "Email webhook evidence conflicts." });
        return;
      }
      res.status(400).json({ error: "Email webhook signature is invalid." });
    }
  });

  const processDeliveries: RouteHandler = async (req, res) => {
    const status = getEmailIntegrationStatus(env);
    if (!workerAuthorized(req, env)) {
      res
        .status(401)
        .json({ error: "Email worker authorization is required." });
      return;
    }
    if (!status.ready) {
      res.status(503).json({ error: "Email delivery is not configured." });
      return;
    }
    try {
      const workerId = `email-worker-${crypto.randomUUID()}`;
      const results = await serviceFactory().processBatch(workerId, 10);
      res.status(200).json({
        processed: results.filter(item => item.outcome !== "empty").length,
        sent: results.filter(item => item.outcome === "sent").length,
        retried: results.filter(item => item.outcome === "retry").length,
        deadLettered: results.filter(item => item.outcome === "dead_letter")
          .length,
      });
    } catch (error) {
      if (
        error instanceof EmailDeliveryRepositoryUnavailableError ||
        error instanceof EmailProviderDisabledError
      ) {
        res.status(503).json({ error: "Email delivery is unavailable." });
        return;
      }
      if (error instanceof EmailDeliveryRepositoryConflictError) {
        res.status(409).json({ error: "Email delivery evidence conflicts." });
        return;
      }
      res.status(500).json({ error: "Email delivery failed safely." });
    }
  };
  app.get("/api/internal/email-deliveries/process", processDeliveries);
  app.post("/api/internal/email-deliveries/process", processDeliveries);
}
