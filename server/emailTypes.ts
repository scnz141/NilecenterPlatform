import type { WebhookEventPayload } from "resend";

export const transactionalEmailTemplateKeys = [
  "account_invitation",
  "account_recovery",
  "enrollment_activated",
  "placement_updated",
  "schedule_changed",
  "attendance_alert",
  "grading_feedback",
  "certificate_issued",
  "message_notification",
] as const;

export type TransactionalEmailTemplateKey =
  (typeof transactionalEmailTemplateKeys)[number];

export type TransactionalEmailLocale = "en" | "ar" | "zh" | "ru" | "ur" | "tr";

export type EmailTemplateRequest = Readonly<{
  templateKey: TransactionalEmailTemplateKey;
  templateVersion: number;
  locale: TransactionalEmailLocale;
  variables: Readonly<Record<string, unknown>>;
}>;

export type RenderedEmail = Readonly<{
  subject: string;
  text: string;
  html: string;
}>;

export type EmailSendRequest = Readonly<{
  to: string;
  from: string;
  replyTo?: string;
  idempotencyKey: string;
  template: RenderedEmail;
  tags: Readonly<Record<string, string>>;
}>;

export type EmailSendResult = Readonly<{
  providerMessageId: string;
}>;

export interface EmailProvider {
  readonly name: "disabled" | "resend";
  send(request: EmailSendRequest): Promise<EmailSendResult>;
  verifyWebhook(input: {
    payload: string;
    id: string;
    timestamp: string;
    signature: string;
  }): WebhookEventPayload;
}

export type ClaimedEmailDelivery = Readonly<{
  deliveryId: string;
  outboxEventId: string;
  recipientUserId: string;
  recipientEmail: string;
  template: EmailTemplateRequest;
  idempotencyKey: string;
  attemptNumber: number;
}>;

export type EmailDeliveryCompletion =
  | Readonly<{
      outcome: "sent";
      providerMessageId: string;
      recipientHash: string;
    }>
  | Readonly<{
      outcome: "retry";
      errorCode: string;
      retryAfterSeconds: number;
    }>
  | Readonly<{
      outcome: "dead_letter";
      errorCode: string;
    }>
  | Readonly<{
      outcome: "suppressed";
      errorCode: string;
    }>;

export type EmailWebhookRecord = Readonly<{
  webhookId: string;
  providerMessageId: string;
  eventType: string;
  eventCreatedAt: string;
  payloadHash: string;
}>;

export type EmailWebhookRecordResult = Readonly<{
  duplicate: boolean;
  deliveryUpdated: boolean;
  suppressionCreated: boolean;
}>;
