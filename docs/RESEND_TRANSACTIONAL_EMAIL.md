# Resend Transactional Email Boundary

## Status

The Resend boundary and the first workflow-owned producer are implemented but
disabled. A normalized Super Admin account invitation can atomically create a
pending identity, pending role grant, audit row, and transactional email event.
No live email is sent until every database and server cutover gate is enabled.

- The SQL package is manual. The email foundation may already be installed while
  the account-invitation tables are still pending; the generated bundle is safe
  to rerun and will continue from that state.
- The runtime requires explicit server-only activation.
- No Resend or Supabase endpoint is contacted by the local validation gates.
- Any previously shared API key remains invalid. Use only a rotated replacement
  supplied through server secret storage; local validation never reads or
  prints it.

## Account Invitation Contract

- A Super Admin enters identity and role-specific scope; no administrator sets
  or receives the user's password.
- Supabase Auth generates the verification artifact server-side.
- Nile Learn encrypts that artifact before storing it in the outbox payload.
- The email worker decrypts it only while rendering the approved invitation
  template.
- The recipient verifies ownership through the link or email OTP and chooses a
  password of at least 12 characters.
- Only then does Nile Learn activate the normalized user and role grant.
- Email remains read-only delivery evidence; it cannot activate the account.

Student admissions remain owned by the Registrar lifecycle. Super Admin user
management invites staff accounts; it does not bypass placement, enrollment,
or guardian validation by creating a student directly.

## Ownership

Nile Learn owns workflow state and in-app messages. Email is an asynchronous
delivery copy and cannot alter enrollment, attendance, grading, certificate,
message, or account state.

The originating workflow must atomically create its domain change, audit row,
and an `email.delivery.requested` outbox event. The email worker may only claim
that event, render a versioned template, deliver it, and record delivery
evidence.

## Outbox Contract

An email event payload is a closed object with:

- `recipientUserId`: active internal user UUID;
- `templateKey`: approved transactional template key;
- `templateVersion`: currently `1`;
- `locale`: approved UI locale;
- `variables`: template-specific values only.

The payload must not contain an email address, token, password, secret, raw
provider response, or attachment. The worker resolves the current recipient
address server-side when it claims the event. Delivery records retain a one-way
address hash after sending.

The invitation producer is the one exception for provider activation material:
it stores only an authenticated encrypted envelope under
`activationEnvelope`. Plaintext links and OTPs remain outside PostgreSQL.

## Server Configuration

Configure these only in local server or deployment secret storage:

```text
EMAIL_PROVIDER=resend
NILE_EMAIL_DELIVERY_ENABLED=1
NILE_EMAIL_REPOSITORY=supabase
NILE_EMAIL_WORKER_SECRET=<new-random-secret>
CRON_SECRET=<new-random-vercel-cron-secret>
RESEND_API_KEY=<rotated-key>
RESEND_FROM_EMAIL=onboarding@resend.dev
RESEND_REPLY_TO=<approved-reply-address>
RESEND_WEBHOOK_SECRET=<signed-webhook-secret>
NILE_INVITATION_PAYLOAD_KEY=<random-secret-at-least-32-characters>
NILE_PUBLIC_APP_URL=https://<approved-nile-learn-host>
NILE_NORMALIZED_INVITATIONS_ENABLED=1
VITE_NILE_NORMALIZED_INVITATIONS_ENABLED=1
```

Only the explicit browser feature flag uses `VITE_`; all credentials remain
server-only. Development proof may use Resend's test
sender only within its recipient restrictions. School delivery requires a
verified Nile Center sending domain and an approved sender such as
`notifications@nilecenter.org`.

## HTTP Boundaries

- `GET /api/internal/email-deliveries/process` is called every five minutes by
  Vercel Cron and requires the `CRON_SECRET` bearer token.
- `POST /api/internal/email-deliveries/process` requires the worker bearer
  secret and refuses to run unless every activation condition is present.
- `POST /api/integrations/resend/webhook` verifies the signature against the
  exact raw request body before recording evidence.
- `GET /api/integrations/resend/status` is Super Admin only and returns
  configuration booleans, never secret values.

Delivery is idempotent by originating outbox event. Retry delays are bounded,
terminal failures become dead letters, and bounced or complained recipients are
suppressed from later sends.

## Activation Checklist

1. Rotate the exposed development API key.
2. Promote the reviewed SQL to an approved isolated staging target using the
   terminal Supabase CLI only.
3. Re-run assertions, rollback/reapply, and browser-role denial checks.
4. Add replacement secrets directly to local and deployment secret storage.
5. Configure the signed webhook URL and confirm replay behavior.
6. Verify the account-invitation producer and recipient acceptance flow.
7. Perform one permitted test-recipient proof and confirm webhook delivery.
8. Run the full protected validation and portal QA gate.
9. Approve production domain DNS and sender identity separately.

No marketing campaign, bulk announcement, private document attachment, or
provider-driven workflow mutation belongs in this boundary.
