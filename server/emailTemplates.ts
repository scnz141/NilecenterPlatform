import type {
  EmailTemplateRequest,
  RenderedEmail,
  TransactionalEmailTemplateKey,
} from "./emailTypes.js";

export class EmailTemplateValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailTemplateValidationError";
  }
}

const requiredVariables: Record<
  TransactionalEmailTemplateKey,
  readonly string[]
> = {
  account_invitation: [
    "displayName",
    "roleLabel",
    "activationUrl",
    "expiresInHours",
  ],
  account_recovery: ["displayName", "recoveryUrl", "expiresInMinutes"],
  enrollment_activated: ["displayName", "courseName", "portalUrl"],
  placement_updated: ["displayName", "levelName", "portalUrl"],
  schedule_changed: [
    "displayName",
    "className",
    "startsAt",
    "timezone",
    "portalUrl",
  ],
  attendance_alert: [
    "displayName",
    "className",
    "sessionDate",
    "attendanceStatus",
    "portalUrl",
  ],
  grading_feedback: [
    "displayName",
    "assessmentName",
    "courseName",
    "portalUrl",
  ],
  certificate_issued: ["displayName", "certificateName", "verificationUrl"],
  message_notification: [
    "displayName",
    "senderName",
    "messageSubject",
    "messageUrl",
  ],
};

function value(
  variables: Readonly<Record<string, unknown>>,
  key: string,
  maxLength = 500
) {
  const candidate = variables[key];
  const normalized =
    typeof candidate === "number" && Number.isFinite(candidate)
      ? String(candidate)
      : typeof candidate === "string"
        ? candidate.trim()
        : "";
  if (!normalized || normalized.length > maxLength) {
    throw new EmailTemplateValidationError(
      `Email template variable ${key} is missing or invalid.`
    );
  }
  return normalized;
}

function optionalValue(
  variables: Readonly<Record<string, unknown>>,
  key: string,
  maxLength = 500
) {
  const candidate = variables[key];
  const normalized = typeof candidate === "string" ? candidate.trim() : "";
  if (normalized.length > maxLength) {
    throw new EmailTemplateValidationError(
      `Email template variable ${key} is invalid.`
    );
  }
  return normalized;
}

function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeLink(input: string) {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    throw new EmailTemplateValidationError(
      "Email template link must be a valid HTTPS URL."
    );
  }
  if (parsed.protocol !== "https:") {
    throw new EmailTemplateValidationError(
      "Email template link must use HTTPS."
    );
  }
  return parsed.toString();
}

function templateContent(request: EmailTemplateRequest) {
  const variables = request.variables;
  const displayName = value(variables, "displayName", 160);

  switch (request.templateKey) {
    case "account_invitation": {
      const verificationCode = optionalValue(variables, "verificationCode", 32);
      return {
        subject: "Activate your Nile Learn account",
        heading: "Your Nile Learn account is ready",
        body: `Hello ${displayName}. You were invited to the ${value(variables, "roleLabel", 80)} workspace. Verify your email and choose your own password within ${value(variables, "expiresInHours", 8)} hours.${verificationCode ? ` Your verification code is ${verificationCode}.` : ""}`,
        action: "Activate account",
        actionUrl: safeLink(value(variables, "activationUrl", 4_096)),
      };
    }
    case "account_recovery":
      return {
        subject: "Reset your Nile Learn password",
        heading: "Account recovery",
        body: `Hello ${displayName}. Use the secure link below within ${value(variables, "expiresInMinutes", 8)} minutes to reset your password.`,
        action: "Reset password",
        actionUrl: safeLink(value(variables, "recoveryUrl", 2_048)),
      };
    case "enrollment_activated":
      return {
        subject: "Your Nile Learn enrollment is active",
        heading: "Enrollment activated",
        body: `Hello ${displayName}. Your enrollment in ${value(variables, "courseName", 200)} is now active.`,
        action: "Open your courses",
        actionUrl: safeLink(value(variables, "portalUrl", 2_048)),
      };
    case "placement_updated":
      return {
        subject: "Your placement result is ready",
        heading: "Placement updated",
        body: `Hello ${displayName}. Your current learning level is ${value(variables, "levelName", 160)}.`,
        action: "View placement details",
        actionUrl: safeLink(value(variables, "portalUrl", 2_048)),
      };
    case "schedule_changed":
      return {
        subject: "Your Nile Learn schedule changed",
        heading: "Schedule updated",
        body: `Hello ${displayName}. ${value(variables, "className", 200)} is now scheduled for ${value(variables, "startsAt", 120)} (${value(variables, "timezone", 80)}).`,
        action: "View schedule",
        actionUrl: safeLink(value(variables, "portalUrl", 2_048)),
      };
    case "attendance_alert":
      return {
        subject: "Attendance update from Nile Learn",
        heading: "Attendance recorded",
        body: `Hello ${displayName}. Attendance for ${value(variables, "className", 200)} on ${value(variables, "sessionDate", 120)} was recorded as ${value(variables, "attendanceStatus", 40)}.`,
        action: "Review attendance",
        actionUrl: safeLink(value(variables, "portalUrl", 2_048)),
      };
    case "grading_feedback":
      return {
        subject: "New assessment feedback is available",
        heading: "Feedback available",
        body: `Hello ${displayName}. Feedback for ${value(variables, "assessmentName", 200)} in ${value(variables, "courseName", 200)} is ready in Nile Learn.`,
        action: "View feedback",
        actionUrl: safeLink(value(variables, "portalUrl", 2_048)),
      };
    case "certificate_issued":
      return {
        subject: "Your Nile Learn certificate is ready",
        heading: "Certificate issued",
        body: `Hello ${displayName}. Your ${value(variables, "certificateName", 200)} certificate has been issued.`,
        action: "Verify certificate",
        actionUrl: safeLink(value(variables, "verificationUrl", 2_048)),
      };
    case "message_notification":
      return {
        subject: `New Nile Learn message: ${value(variables, "messageSubject", 200)}`,
        heading: "New message",
        body: `Hello ${displayName}. ${value(variables, "senderName", 160)} sent you a message in Nile Learn. Sign in to read and reply securely.`,
        action: "Open message",
        actionUrl: safeLink(value(variables, "messageUrl", 2_048)),
      };
  }
}

export function renderTransactionalEmail(
  request: EmailTemplateRequest
): RenderedEmail {
  if (request.templateVersion !== 1) {
    throw new EmailTemplateValidationError(
      "Unsupported transactional email template version."
    );
  }
  requiredVariables[request.templateKey].forEach(key =>
    value(request.variables, key)
  );

  const content = templateContent(request);
  const heading = escapeHtml(content.heading);
  const body = escapeHtml(content.body);
  const action = escapeHtml(content.action);
  const actionUrl = escapeHtml(content.actionUrl);

  return {
    subject: content.subject,
    text: `${content.heading}\n\n${content.body}\n\n${content.action}: ${content.actionUrl}\n\nNile Learn`,
    html: `<!doctype html><html lang="en"><body style="margin:0;background:#f4f1ea;color:#1d211f;font-family:Arial,sans-serif"><main style="max-width:600px;margin:0 auto;padding:32px 20px"><div style="background:#fffdf8;border:1px solid #ded8cc;border-radius:8px;padding:28px"><p style="margin:0 0 24px;color:#246348;font-weight:700">Nile Learn</p><h1 style="margin:0 0 16px;font-size:24px">${heading}</h1><p style="margin:0 0 24px;line-height:1.6">${body}</p><a href="${actionUrl}" style="display:inline-block;background:#1d211f;color:#ffffff;text-decoration:none;border-radius:6px;padding:12px 18px;font-weight:700">${action}</a><p style="margin:24px 0 0;color:#6d706c;font-size:13px;line-height:1.5">This is a transactional message about your Nile Learn account or learning activity.</p></div></main></body></html>`,
  };
}
