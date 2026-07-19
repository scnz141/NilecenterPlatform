import { describe, expect, it, vi } from "vitest";

import {
  EmailDeliveryService,
  getEmailIntegrationStatus,
} from "../../../../server/emailDeliveryService";
import { EmailProviderSendError } from "../../../../server/emailProvider";
import {
  EmailTemplateValidationError,
  renderTransactionalEmail,
} from "../../../../server/emailTemplates";
import { registerEmailRoutes } from "../../../../server/emailRoutes";
import { ResendEmailProvider } from "../../../../server/resendEmailProvider";
import type {
  ClaimedEmailDelivery,
  EmailDeliveryCompletion,
  EmailProvider,
  EmailWebhookRecord,
} from "../../../../server/emailTypes";
import { sealInvitationActivationPayload } from "../../../../server/invitationEnvelope";

function claimedDelivery(overrides: Partial<ClaimedEmailDelivery> = {}) {
  return {
    deliveryId: "b1000000-0000-4000-8000-000000000001",
    outboxEventId: "b2000000-0000-4000-8000-000000000001",
    recipientUserId: "b3000000-0000-4000-8000-000000000001",
    recipientEmail: "student@example.test",
    template: {
      templateKey: "enrollment_activated" as const,
      templateVersion: 1,
      locale: "en" as const,
      variables: {
        displayName: "Student Demo",
        courseName: "Standard Arabic Level 3",
        portalUrl: "https://learn.example.test/app/student/courses",
      },
    },
    idempotencyKey: "email.delivery:b2000000-0000-4000-8000-000000000001",
    attemptNumber: 1,
    ...overrides,
  } satisfies ClaimedEmailDelivery;
}

function fakeRepository(delivery: ClaimedEmailDelivery | null) {
  const completions: Array<{
    deliveryId: string;
    workerId: string;
    completion: EmailDeliveryCompletion;
  }> = [];
  const webhooks: EmailWebhookRecord[] = [];
  return {
    completions,
    webhooks,
    repository: {
      claim: vi.fn(async () => delivery),
      complete: vi.fn(
        async (
          deliveryId: string,
          workerId: string,
          completion: EmailDeliveryCompletion
        ) => {
          completions.push({ deliveryId, workerId, completion });
        }
      ),
      recordWebhook: vi.fn(async (record: EmailWebhookRecord) => {
        webhooks.push(record);
        return {
          duplicate: false,
          deliveryUpdated: true,
          suppressionCreated: record.eventType === "email.bounced",
        };
      }),
    },
  };
}

function successfulProvider(): EmailProvider {
  return {
    name: "resend",
    send: vi.fn(async () => ({ providerMessageId: "email_provider_123" })),
    verifyWebhook: vi.fn(() => ({
      type: "email.delivered",
      created_at: "2026-07-19T12:00:00.000Z",
      data: {
        email_id: "email_provider_123",
        created_at: "2026-07-19T12:00:00.000Z",
        from: "Nile Learn <onboarding@resend.dev>",
        to: ["student@example.test"],
        subject: "Enrollment activated",
      },
    })),
  };
}

function responseRecorder() {
  const result: { status: number; body?: unknown } = { status: 200 };
  const response = {
    status(code: number) {
      result.status = code;
      return response;
    },
    json(body: unknown) {
      result.body = body;
    },
  };
  return { response, result };
}

describe("transactional email templates", () => {
  it("renders an account invitation that asks the recipient to choose a password", () => {
    const rendered = renderTransactionalEmail({
      templateKey: "account_invitation",
      templateVersion: 1,
      locale: "en",
      variables: {
        displayName: "Teacher Example",
        roleLabel: "Teacher",
        activationUrl: "https://learn.example.test/auth/accept-invitation",
        verificationCode: "123456",
        expiresInHours: 24,
      },
    });
    expect(rendered.subject).toContain("Activate");
    expect(rendered.text).toContain("choose your own password");
    expect(rendered.text).toContain("verification code is 123456");
  });
  it("escapes user-controlled values and retains a plain-text alternative", () => {
    const rendered = renderTransactionalEmail({
      templateKey: "message_notification",
      templateVersion: 1,
      locale: "en",
      variables: {
        displayName: "<Student>",
        senderName: "Teacher & HOD",
        messageSubject: 'Class "update"',
        messageUrl: "https://learn.example.test/app/student/messages",
      },
    });

    expect(rendered.subject).toBe('New Nile Learn message: Class "update"');
    expect(rendered.html).toContain("&lt;Student&gt;");
    expect(rendered.html).toContain("Teacher &amp; HOD");
    expect(rendered.html).not.toContain("<Student>");
    expect(rendered.text).toContain(
      "https://learn.example.test/app/student/messages"
    );
  });

  it("rejects unsupported versions and non-HTTPS action links", () => {
    expect(() =>
      renderTransactionalEmail({
        ...claimedDelivery().template,
        templateVersion: 2,
      })
    ).toThrow(EmailTemplateValidationError);
    expect(() =>
      renderTransactionalEmail({
        ...claimedDelivery().template,
        variables: {
          ...claimedDelivery().template.variables,
          portalUrl: "http://insecure.example.test/courses",
        },
      })
    ).toThrow("must use HTTPS");
  });
});

describe("Resend provider boundary", () => {
  it("passes the durable outbox idempotency key to Resend", async () => {
    const send = vi.fn(async () => ({
      data: { id: "email_provider_123" },
      error: null,
      headers: null,
    }));
    const verify = vi.fn();
    const provider = new ResendEmailProvider(
      {
        apiKey: "test-only-key",
        from: "Nile Learn <onboarding@resend.dev>",
        webhookSecret: "test-only-webhook-secret",
      },
      { emails: { send }, webhooks: { verify } } as never
    );

    const template = renderTransactionalEmail(claimedDelivery().template);
    await expect(
      provider.send({
        to: "student@example.test",
        from: "Nile Learn <onboarding@resend.dev>",
        idempotencyKey: claimedDelivery().idempotencyKey,
        template,
        tags: { template: "enrollment_activated", version: "1" },
      })
    ).resolves.toEqual({ providerMessageId: "email_provider_123" });

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "student@example.test",
        subject: "Your Nile Learn enrollment is active",
      }),
      { idempotencyKey: claimedDelivery().idempotencyKey }
    );
  });

  it("classifies provider throttling as retryable without leaking provider details", async () => {
    const provider = new ResendEmailProvider(
      {
        apiKey: "test-only-key",
        from: "Nile Learn <onboarding@resend.dev>",
        webhookSecret: "test-only-webhook-secret",
      },
      {
        emails: {
          send: vi.fn(async () => ({
            data: null,
            error: {
              name: "rate_limit_exceeded",
              message: "sensitive provider response",
              statusCode: 429,
            },
            headers: null,
          })),
        },
        webhooks: { verify: vi.fn() },
      } as never
    );

    const error = await provider
      .send({
        to: "student@example.test",
        from: "Nile Learn <onboarding@resend.dev>",
        idempotencyKey: claimedDelivery().idempotencyKey,
        template: renderTransactionalEmail(claimedDelivery().template),
        tags: {},
      })
      .catch(candidate => candidate);
    expect(error).toBeInstanceOf(EmailProviderSendError);
    expect(error).toMatchObject({
      code: "rate_limit_exceeded",
      retryable: true,
    });
    expect(error.message).not.toContain("sensitive provider response");
  });
});

describe("email delivery state machine", () => {
  it("decrypts invitation activation data only at delivery time", async () => {
    const invitationEnv = {
      NILE_INVITATION_PAYLOAD_KEY:
        "test-only-account-invitation-envelope-key-with-adequate-entropy",
    } as NodeJS.ProcessEnv;
    const delivery = claimedDelivery({
      template: {
        templateKey: "account_invitation",
        templateVersion: 1,
        locale: "en",
        variables: {
          displayName: "Teacher Example",
          roleLabel: "Teacher",
          expiresInHours: 24,
          activationEnvelope: sealInvitationActivationPayload(
            {
              actionUrl:
                "https://auth.example.test/verify?code=provider-private-code",
            },
            invitationEnv
          ),
        },
      },
    });
    const state = fakeRepository(delivery);
    const provider = successfulProvider();
    const service = new EmailDeliveryService(
      state.repository,
      provider,
      "Nile Learn <onboarding@resend.dev>"
    );
    const previous = process.env.NILE_INVITATION_PAYLOAD_KEY;
    process.env.NILE_INVITATION_PAYLOAD_KEY =
      invitationEnv.NILE_INVITATION_PAYLOAD_KEY;
    try {
      await expect(service.processOne("worker-invite")).resolves.toMatchObject({
        outcome: "sent",
      });
    } finally {
      if (previous === undefined)
        delete process.env.NILE_INVITATION_PAYLOAD_KEY;
      else process.env.NILE_INVITATION_PAYLOAD_KEY = previous;
    }
    expect(provider.send).toHaveBeenCalledWith(
      expect.objectContaining({
        template: expect.objectContaining({
          text: expect.stringContaining("provider-private-code"),
        }),
      })
    );
    expect(JSON.stringify(delivery.template.variables)).not.toContain(
      "provider-private-code"
    );
  });
  it("records a sent transition with a one-way recipient hash", async () => {
    const state = fakeRepository(claimedDelivery());
    const service = new EmailDeliveryService(
      state.repository,
      successfulProvider(),
      "Nile Learn <onboarding@resend.dev>"
    );

    await expect(service.processOne("worker-1")).resolves.toMatchObject({
      outcome: "sent",
    });
    expect(state.completions).toHaveLength(1);
    expect(state.completions[0]?.completion).toMatchObject({
      outcome: "sent",
      providerMessageId: "email_provider_123",
      recipientHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(JSON.stringify(state.completions)).not.toContain(
      "student@example.test"
    );
  });

  it("retries bounded transient failures and dead-letters the fifth attempt", async () => {
    const provider: EmailProvider = {
      ...successfulProvider(),
      send: vi.fn(async () => {
        throw new EmailProviderSendError("rate_limit_exceeded", true);
      }),
    };
    const first = fakeRepository(claimedDelivery({ attemptNumber: 1 }));
    const firstService = new EmailDeliveryService(
      first.repository,
      provider,
      "Nile Learn <onboarding@resend.dev>"
    );
    await expect(firstService.processOne("worker-1")).resolves.toMatchObject({
      outcome: "retry",
    });
    expect(first.completions[0]?.completion).toEqual({
      outcome: "retry",
      errorCode: "rate_limit_exceeded",
      retryAfterSeconds: 60,
    });

    const fifth = fakeRepository(claimedDelivery({ attemptNumber: 5 }));
    const fifthService = new EmailDeliveryService(
      fifth.repository,
      provider,
      "Nile Learn <onboarding@resend.dev>"
    );
    await fifthService.processOne("worker-5");
    expect(fifth.completions[0]?.completion).toEqual({
      outcome: "dead_letter",
      errorCode: "rate_limit_exceeded",
    });
  });

  it("verifies and records delivery webhook evidence without raw payload storage", async () => {
    const state = fakeRepository(null);
    const provider = successfulProvider();
    const service = new EmailDeliveryService(
      state.repository,
      provider,
      "Nile Learn <onboarding@resend.dev>"
    );
    const payload = JSON.stringify({ private: "not persisted" });

    await expect(
      service.handleWebhook({
        payload,
        id: "msg_webhook_1",
        timestamp: "1784462400",
        signature: "v1,test-signature",
      })
    ).resolves.toMatchObject({ ignored: false, deliveryUpdated: true });
    expect(state.webhooks[0]).toMatchObject({
      webhookId: "msg_webhook_1",
      providerMessageId: "email_provider_123",
      eventType: "email.delivered",
      payloadHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(JSON.stringify(state.webhooks)).not.toContain("not persisted");
  });
});

describe("email route gates", () => {
  function captureRoutes(
    env: NodeJS.ProcessEnv,
    service: {
      handleWebhook?: (input: unknown) => Promise<Record<string, unknown>>;
      processBatch?: (
        workerId: string,
        limit: number
      ) => Promise<Array<{ outcome: string }>>;
    }
  ) {
    const routes = new Map<string, (req: never, res: never) => Promise<void>>();
    registerEmailRoutes(
      {
        get(path, handler) {
          routes.set(path, handler as never);
        },
        post(path, handler) {
          routes.set(path, handler as never);
        },
      },
      env,
      () => service as never
    );
    return routes;
  }

  it("rejects unsigned webhooks and unauthorized worker calls", async () => {
    const env = {};
    const routes = captureRoutes(env, {});
    const webhookResult = responseRecorder();
    await routes.get("/api/integrations/resend/webhook")?.(
      {
        get: () => undefined,
      } as never,
      webhookResult.response as never
    );
    expect(webhookResult.result.status).toBe(400);

    const workerResult = responseRecorder();
    await routes.get("/api/internal/email-deliveries/process")?.(
      { get: () => undefined } as never,
      workerResult.response as never
    );
    expect(workerResult.result).toEqual({
      status: 401,
      body: { error: "Email worker authorization is required." },
    });
  });

  it("accepts a verified webhook and runs only a fully configured worker", async () => {
    const env = {
      EMAIL_PROVIDER: "resend",
      NILE_EMAIL_DELIVERY_ENABLED: "1",
      NILE_EMAIL_REPOSITORY: "supabase",
      NILE_EMAIL_WORKER_SECRET: "worker-test-secret",
      RESEND_API_KEY: "test-only-key",
      RESEND_FROM_EMAIL: "Nile Learn <onboarding@resend.dev>",
      RESEND_WEBHOOK_SECRET: "test-only-webhook-secret",
      SUPABASE_URL: "https://staging.example.test",
      SUPABASE_SECRET_KEY: "test-only-supabase-key",
    };
    const handleWebhook = vi.fn(async () => ({
      ignored: false,
      duplicate: false,
    }));
    const processBatch = vi.fn(async () => [
      { outcome: "sent" },
      { outcome: "empty" },
    ]);
    const routes = captureRoutes(env, { handleWebhook, processBatch });
    const webhookResult = responseRecorder();
    await routes.get("/api/integrations/resend/webhook")?.(
      {
        rawBody: Buffer.from("{}"),
        get(name: string) {
          return {
            "svix-id": "msg_webhook_1",
            "svix-timestamp": "1784462400",
            "svix-signature": "v1,test-signature",
          }[name];
        },
      } as never,
      webhookResult.response as never
    );
    expect(webhookResult.result.status).toBe(202);

    const workerResult = responseRecorder();
    await routes.get("/api/internal/email-deliveries/process")?.(
      {
        get(name: string) {
          return name === "authorization"
            ? "Bearer worker-test-secret"
            : undefined;
        },
      } as never,
      workerResult.response as never
    );
    expect(workerResult.result).toEqual({
      status: 200,
      body: { processed: 1, sent: 1, retried: 0, deadLettered: 0 },
    });
    expect(processBatch).toHaveBeenCalledWith(expect.any(String), 10);
  });

  it("accepts the Vercel cron secret for scheduled delivery", async () => {
    const processBatch = vi.fn(async () => [{ outcome: "empty" }]);
    const routes = captureRoutes(
      {
        EMAIL_PROVIDER: "resend",
        NILE_EMAIL_DELIVERY_ENABLED: "1",
        NILE_EMAIL_REPOSITORY: "supabase",
        NILE_EMAIL_WORKER_SECRET: "manual-worker-test-secret",
        CRON_SECRET: "cron-test-secret",
        RESEND_API_KEY: "test-only-key",
        RESEND_FROM_EMAIL: "Nile Learn <onboarding@resend.dev>",
        RESEND_WEBHOOK_SECRET: "test-only-webhook-secret",
        SUPABASE_URL: "https://staging.example.test",
        SUPABASE_SECRET_KEY: "test-only-supabase-key",
      },
      { processBatch }
    );
    const workerResult = responseRecorder();
    await routes.get("/api/internal/email-deliveries/process")?.(
      {
        get(name: string) {
          return name === "authorization"
            ? "Bearer cron-test-secret"
            : undefined;
        },
      } as never,
      workerResult.response as never
    );
    expect(workerResult.result.status).toBe(200);
    expect(processBatch).toHaveBeenCalledOnce();
  });
});

describe("email integration status", () => {
  it("stays disabled by default and requires every server authority", () => {
    expect(getEmailIntegrationStatus({})).toMatchObject({
      provider: "disabled",
      deliveryEnabled: false,
      ready: false,
    });
    expect(
      getEmailIntegrationStatus({
        EMAIL_PROVIDER: "resend",
        NILE_EMAIL_DELIVERY_ENABLED: "1",
        NILE_EMAIL_REPOSITORY: "supabase",
        NILE_EMAIL_WORKER_SECRET: "worker-test-secret",
        RESEND_API_KEY: "test-only-key",
        RESEND_FROM_EMAIL: "Nile Learn <onboarding@resend.dev>",
        RESEND_WEBHOOK_SECRET: "test-only-webhook-secret",
        SUPABASE_URL: "https://staging.example.test",
        SUPABASE_SECRET_KEY: "test-only-supabase-key",
      })
    ).toMatchObject({ provider: "resend", ready: true });
  });
});
