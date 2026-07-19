import { Resend, type WebhookEventPayload } from "resend";
import {
  EmailProviderDisabledError,
  EmailProviderSendError,
} from "./emailProvider.js";
import type {
  EmailProvider,
  EmailSendRequest,
  EmailSendResult,
} from "./emailTypes.js";

type ResendClient = Pick<Resend, "emails" | "webhooks">;

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isRetryableStatus(statusCode: number | null) {
  return (
    statusCode === 408 ||
    statusCode === 409 ||
    statusCode === 429 ||
    (statusCode !== null && statusCode >= 500)
  );
}

export type ResendEmailConfiguration = Readonly<{
  apiKey: string;
  from: string;
  replyTo?: string;
  webhookSecret: string;
}>;

export function getResendEmailConfiguration(
  env: NodeJS.ProcessEnv = process.env
): ResendEmailConfiguration {
  const apiKey = clean(env.RESEND_API_KEY);
  const from = clean(env.RESEND_FROM_EMAIL);
  const replyTo = clean(env.RESEND_REPLY_TO) || undefined;
  const webhookSecret = clean(env.RESEND_WEBHOOK_SECRET);
  if (!apiKey || !from || !webhookSecret) {
    throw new EmailProviderDisabledError(
      "Resend requires server-only API key, sender, and webhook secret configuration."
    );
  }
  return { apiKey, from, replyTo, webhookSecret };
}

export class ResendEmailProvider implements EmailProvider {
  readonly name = "resend" as const;
  private readonly client: ResendClient;

  constructor(
    private readonly configuration: ResendEmailConfiguration,
    client?: ResendClient
  ) {
    this.client = client ?? new Resend(configuration.apiKey);
  }

  async send(request: EmailSendRequest): Promise<EmailSendResult> {
    const response = await this.client.emails.send(
      {
        from: request.from,
        to: request.to,
        replyTo: request.replyTo,
        subject: request.template.subject,
        text: request.template.text,
        html: request.template.html,
        tags: Object.entries(request.tags).map(([name, value]) => ({
          name,
          value,
        })),
      },
      { idempotencyKey: request.idempotencyKey }
    );

    if (response.error) {
      throw new EmailProviderSendError(
        response.error.name,
        isRetryableStatus(response.error.statusCode)
      );
    }
    return { providerMessageId: response.data.id };
  }

  verifyWebhook(input: {
    payload: string;
    id: string;
    timestamp: string;
    signature: string;
  }): WebhookEventPayload {
    return this.client.webhooks.verify({
      payload: input.payload,
      headers: {
        id: input.id,
        timestamp: input.timestamp,
        signature: input.signature,
      },
      webhookSecret: this.configuration.webhookSecret,
    });
  }
}
