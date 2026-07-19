import type {
  EmailProvider,
  EmailSendRequest,
  EmailSendResult,
} from "./emailTypes.js";

export class EmailProviderDisabledError extends Error {
  constructor(message = "Transactional email delivery is disabled.") {
    super(message);
    this.name = "EmailProviderDisabledError";
  }
}

export class EmailProviderSendError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(code: string, retryable: boolean) {
    super("Transactional email provider rejected the delivery request.");
    this.name = "EmailProviderSendError";
    this.code = code;
    this.retryable = retryable;
  }
}

export class DisabledEmailProvider implements EmailProvider {
  readonly name = "disabled" as const;

  async send(_request: EmailSendRequest): Promise<EmailSendResult> {
    throw new EmailProviderDisabledError();
  }

  verifyWebhook(): never {
    throw new EmailProviderDisabledError(
      "Transactional email webhook verification is disabled."
    );
  }
}
