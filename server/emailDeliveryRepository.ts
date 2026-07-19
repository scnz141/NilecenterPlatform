import { supabaseAdminRestFetch } from "./supabase.js";
import type {
  ClaimedEmailDelivery,
  EmailDeliveryCompletion,
  EmailWebhookRecord,
  EmailWebhookRecordResult,
  TransactionalEmailLocale,
  TransactionalEmailTemplateKey,
} from "./emailTypes.js";

type SupabaseAdminFetch = typeof supabaseAdminRestFetch;

export class EmailDeliveryRepositoryUnavailableError extends Error {
  constructor() {
    super("Transactional email persistence is unavailable.");
    this.name = "EmailDeliveryRepositoryUnavailableError";
  }
}

export class EmailDeliveryRepositoryConflictError extends Error {
  constructor() {
    super("Transactional email persistence rejected the requested transition.");
    this.name = "EmailDeliveryRepositoryConflictError";
  }
}

export interface EmailDeliveryRepository {
  claim(
    workerId: string,
    leaseSeconds: number
  ): Promise<ClaimedEmailDelivery | null>;
  complete(
    deliveryId: string,
    workerId: string,
    completion: EmailDeliveryCompletion
  ): Promise<void>;
  recordWebhook(record: EmailWebhookRecord): Promise<EmailWebhookRecordResult>;
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function integer(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) ? value : NaN;
}

async function readJson(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new EmailDeliveryRepositoryUnavailableError();
  }
}

function assertResponse(response: Response) {
  if (response.ok) return;
  if (response.status === 409 || response.status === 422) {
    throw new EmailDeliveryRepositoryConflictError();
  }
  throw new EmailDeliveryRepositoryUnavailableError();
}

function parseClaim(value: unknown): ClaimedEmailDelivery | null {
  const row = Array.isArray(value) ? value[0] : value;
  if (row == null) return null;
  if (!row || typeof row !== "object") {
    throw new EmailDeliveryRepositoryUnavailableError();
  }
  const record = row as Record<string, unknown>;
  const deliveryId = clean(record.delivery_id);
  const outboxEventId = clean(record.outbox_event_id);
  const recipientUserId = clean(record.recipient_user_id);
  const recipientEmail = clean(record.recipient_email).toLowerCase();
  const templateKey = clean(
    record.template_key
  ) as TransactionalEmailTemplateKey;
  const templateVersion = integer(record.template_version);
  const locale = clean(record.locale) as TransactionalEmailLocale;
  const idempotencyKey = clean(record.idempotency_key);
  const attemptNumber = integer(record.attempt_number);
  const variables = record.variables;
  if (
    !deliveryId ||
    !outboxEventId ||
    !recipientUserId ||
    !recipientEmail ||
    !templateKey ||
    !Number.isFinite(templateVersion) ||
    !locale ||
    !idempotencyKey ||
    !Number.isFinite(attemptNumber) ||
    !variables ||
    typeof variables !== "object" ||
    Array.isArray(variables)
  ) {
    throw new EmailDeliveryRepositoryUnavailableError();
  }
  return {
    deliveryId,
    outboxEventId,
    recipientUserId,
    recipientEmail,
    template: {
      templateKey,
      templateVersion,
      locale,
      variables: variables as Record<string, unknown>,
    },
    idempotencyKey,
    attemptNumber,
  };
}

export class SupabaseEmailDeliveryRepository
  implements EmailDeliveryRepository
{
  constructor(
    private readonly adminFetch: SupabaseAdminFetch = supabaseAdminRestFetch
  ) {}

  async claim(workerId: string, leaseSeconds: number) {
    let response: Response;
    try {
      response = await this.adminFetch("rpc/nile_claim_email_delivery_v2", {
        method: "POST",
        body: JSON.stringify({
          p_worker_id: workerId,
          p_lease_seconds: leaseSeconds,
        }),
      });
    } catch {
      throw new EmailDeliveryRepositoryUnavailableError();
    }
    assertResponse(response);
    return parseClaim(await readJson(response));
  }

  async complete(
    deliveryId: string,
    workerId: string,
    completion: EmailDeliveryCompletion
  ) {
    let response: Response;
    try {
      response = await this.adminFetch("rpc/nile_complete_email_delivery", {
        method: "POST",
        body: JSON.stringify({
          p_delivery_id: deliveryId,
          p_worker_id: workerId,
          p_outcome: completion.outcome,
          p_provider_message_id:
            completion.outcome === "sent" ? completion.providerMessageId : null,
          p_recipient_hash:
            completion.outcome === "sent" ? completion.recipientHash : null,
          p_error_code:
            completion.outcome === "sent" ? null : completion.errorCode,
          p_retry_after_seconds:
            completion.outcome === "retry"
              ? completion.retryAfterSeconds
              : null,
        }),
      });
    } catch {
      throw new EmailDeliveryRepositoryUnavailableError();
    }
    assertResponse(response);
  }

  async recordWebhook(record: EmailWebhookRecord) {
    let response: Response;
    try {
      response = await this.adminFetch("rpc/nile_record_email_webhook", {
        method: "POST",
        body: JSON.stringify({
          p_webhook_id: record.webhookId,
          p_provider_message_id: record.providerMessageId,
          p_event_type: record.eventType,
          p_event_created_at: record.eventCreatedAt,
          p_payload_hash: record.payloadHash,
        }),
      });
    } catch {
      throw new EmailDeliveryRepositoryUnavailableError();
    }
    assertResponse(response);
    const payload = await readJson(response);
    const row = Array.isArray(payload) ? payload[0] : payload;
    if (!row || typeof row !== "object") {
      throw new EmailDeliveryRepositoryUnavailableError();
    }
    const result = row as Record<string, unknown>;
    if (
      typeof result.duplicate !== "boolean" ||
      typeof result.delivery_updated !== "boolean" ||
      typeof result.suppression_created !== "boolean"
    ) {
      throw new EmailDeliveryRepositoryUnavailableError();
    }
    return {
      duplicate: result.duplicate,
      deliveryUpdated: result.delivery_updated,
      suppressionCreated: result.suppression_created,
    };
  }
}
