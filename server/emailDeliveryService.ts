import crypto from "node:crypto";
import type { WebhookEventPayload } from "resend";
import {
  DisabledEmailProvider,
  EmailProviderDisabledError,
  EmailProviderSendError,
} from "./emailProvider.js";
import {
  EmailDeliveryRepositoryUnavailableError,
  SupabaseEmailDeliveryRepository,
  type EmailDeliveryRepository,
} from "./emailDeliveryRepository.js";
import { renderTransactionalEmail } from "./emailTemplates.js";
import { getSupabaseServerStatus } from "./supabase.js";
import {
  getResendEmailConfiguration,
  ResendEmailProvider,
} from "./resendEmailProvider.js";
import type { EmailProvider } from "./emailTypes.js";
import { openInvitationActivationPayload } from "./invitationEnvelope.js";

const handledWebhookTypes = new Set([
  "email.sent",
  "email.scheduled",
  "email.delivered",
  "email.delivery_delayed",
  "email.complained",
  "email.bounced",
  "email.failed",
  "email.suppressed",
]);

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function enabled(value: unknown) {
  return ["1", "true", "yes"].includes(clean(value).toLowerCase());
}

function sha256(value: string) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function retryDelaySeconds(attemptNumber: number) {
  return Math.min(3_600, 60 * 2 ** Math.max(0, attemptNumber - 1));
}

function webhookEmailData(event: WebhookEventPayload) {
  if (!event.type.startsWith("email.") || !("email_id" in event.data)) {
    return null;
  }
  return {
    providerMessageId: event.data.email_id,
  };
}

export type EmailIntegrationStatus = Readonly<{
  provider: "disabled" | "resend";
  deliveryEnabled: boolean;
  repository: "disabled" | "supabase";
  senderConfigured: boolean;
  replyToConfigured: boolean;
  apiKeyConfigured: boolean;
  webhookConfigured: boolean;
  workerSecretConfigured: boolean;
  invitationPayloadKeyConfigured: boolean;
  supabaseAdminConfigured: boolean;
  ready: boolean;
}>;

export function getEmailIntegrationStatus(
  env: NodeJS.ProcessEnv = process.env
): EmailIntegrationStatus {
  const provider =
    clean(env.EMAIL_PROVIDER).toLowerCase() === "resend"
      ? "resend"
      : "disabled";
  const repository =
    clean(env.NILE_EMAIL_REPOSITORY).toLowerCase() === "supabase"
      ? "supabase"
      : "disabled";
  const deliveryEnabled = enabled(env.NILE_EMAIL_DELIVERY_ENABLED);
  const senderConfigured = Boolean(clean(env.RESEND_FROM_EMAIL));
  const apiKeyConfigured = Boolean(clean(env.RESEND_API_KEY));
  const webhookConfigured = Boolean(clean(env.RESEND_WEBHOOK_SECRET));
  const workerSecretConfigured = Boolean(clean(env.NILE_EMAIL_WORKER_SECRET));
  const supabaseAdminConfigured = getSupabaseServerStatus(env).adminAvailable;
  return {
    provider,
    deliveryEnabled,
    repository,
    senderConfigured,
    replyToConfigured: Boolean(clean(env.RESEND_REPLY_TO)),
    apiKeyConfigured,
    webhookConfigured,
    workerSecretConfigured,
    invitationPayloadKeyConfigured:
      clean(env.NILE_INVITATION_PAYLOAD_KEY).length >= 32,
    supabaseAdminConfigured,
    ready:
      provider === "resend" &&
      deliveryEnabled &&
      repository === "supabase" &&
      senderConfigured &&
      apiKeyConfigured &&
      webhookConfigured &&
      workerSecretConfigured &&
      supabaseAdminConfigured,
  };
}

export class EmailDeliveryService {
  constructor(
    private readonly repository: EmailDeliveryRepository,
    private readonly provider: EmailProvider,
    private readonly from: string,
    private readonly replyTo?: string
  ) {}

  async processOne(workerId: string) {
    const delivery = await this.repository.claim(workerId, 90);
    if (!delivery) return { outcome: "empty" as const };

    try {
      const templateRequest =
        delivery.template.templateKey === "account_invitation"
          ? {
              ...delivery.template,
              variables: (() => {
                const variables = { ...delivery.template.variables };
                const envelope = clean(variables.activationEnvelope);
                delete variables.activationEnvelope;
                const activation = openInvitationActivationPayload(envelope);
                return {
                  ...variables,
                  activationUrl: activation.actionUrl,
                  verificationCode: activation.emailOtp,
                };
              })(),
            }
          : delivery.template;
      const template = renderTransactionalEmail(templateRequest);
      const result = await this.provider.send({
        to: delivery.recipientEmail,
        from: this.from,
        replyTo: this.replyTo,
        idempotencyKey: delivery.idempotencyKey,
        template,
        tags: {
          template: delivery.template.templateKey,
          version: String(delivery.template.templateVersion),
        },
      });
      await this.repository.complete(delivery.deliveryId, workerId, {
        outcome: "sent",
        providerMessageId: result.providerMessageId,
        recipientHash: sha256(delivery.recipientEmail.toLowerCase()),
      });
      return { outcome: "sent" as const, deliveryId: delivery.deliveryId };
    } catch (error) {
      const retryable =
        error instanceof EmailProviderSendError && error.retryable;
      const errorCode =
        error instanceof EmailProviderSendError
          ? error.code
          : error instanceof EmailProviderDisabledError
            ? "provider_disabled"
            : "template_or_delivery_invalid";
      if (retryable && delivery.attemptNumber < 5) {
        await this.repository.complete(delivery.deliveryId, workerId, {
          outcome: "retry",
          errorCode,
          retryAfterSeconds: retryDelaySeconds(delivery.attemptNumber),
        });
        return { outcome: "retry" as const, deliveryId: delivery.deliveryId };
      }
      await this.repository.complete(delivery.deliveryId, workerId, {
        outcome: "dead_letter",
        errorCode,
      });
      return {
        outcome: "dead_letter" as const,
        deliveryId: delivery.deliveryId,
      };
    }
  }

  async processBatch(workerId: string, limit: number) {
    const results = [];
    for (let index = 0; index < limit; index += 1) {
      const result = await this.processOne(workerId);
      results.push(result);
      if (result.outcome === "empty") break;
    }
    return results;
  }

  async handleWebhook(input: {
    payload: string;
    id: string;
    timestamp: string;
    signature: string;
  }) {
    const event = this.provider.verifyWebhook(input);
    if (!handledWebhookTypes.has(event.type)) {
      return { ignored: true, duplicate: false };
    }
    const emailData = webhookEmailData(event);
    if (!emailData) return { ignored: true, duplicate: false };
    const result = await this.repository.recordWebhook({
      webhookId: input.id,
      providerMessageId: emailData.providerMessageId,
      eventType: event.type,
      eventCreatedAt: event.created_at,
      payloadHash: sha256(input.payload),
    });
    return { ignored: false, ...result };
  }
}

export function createEmailDeliveryService(
  env: NodeJS.ProcessEnv = process.env
) {
  const status = getEmailIntegrationStatus(env);
  if (status.provider !== "resend" || status.repository !== "supabase") {
    throw new EmailDeliveryRepositoryUnavailableError();
  }
  const configuration = getResendEmailConfiguration(env);
  return new EmailDeliveryService(
    new SupabaseEmailDeliveryRepository(),
    new ResendEmailProvider(configuration),
    configuration.from,
    configuration.replyTo
  );
}

export function createDisabledEmailDeliveryService() {
  return new EmailDeliveryService(
    {
      async claim() {
        throw new EmailDeliveryRepositoryUnavailableError();
      },
      async complete() {
        throw new EmailDeliveryRepositoryUnavailableError();
      },
      async recordWebhook() {
        throw new EmailDeliveryRepositoryUnavailableError();
      },
    },
    new DisabledEmailProvider(),
    ""
  );
}
