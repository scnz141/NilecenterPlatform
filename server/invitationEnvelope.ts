import crypto from "node:crypto";

const envelopePrefix = "v1.";
const associatedData = Buffer.from("nile-learn:user-invitation:v1", "utf8");

export class InvitationEnvelopeConfigurationError extends Error {
  constructor() {
    super("Account invitation encryption is not configured.");
    this.name = "InvitationEnvelopeConfigurationError";
  }
}

export class InvitationEnvelopeInvalidError extends Error {
  constructor() {
    super("Account invitation delivery data is invalid.");
    this.name = "InvitationEnvelopeInvalidError";
  }
}

export type InvitationActivationPayload = Readonly<{
  actionUrl: string;
  emailOtp?: string;
}>;

function encryptionKey(env: NodeJS.ProcessEnv) {
  const source = env.NILE_INVITATION_PAYLOAD_KEY?.trim() ?? "";
  if (source.length < 32) throw new InvitationEnvelopeConfigurationError();
  return crypto.createHash("sha256").update(source, "utf8").digest();
}

function validatePayload(payload: InvitationActivationPayload) {
  let actionUrl: URL;
  try {
    actionUrl = new URL(payload.actionUrl);
  } catch {
    throw new InvitationEnvelopeInvalidError();
  }
  if (actionUrl.protocol !== "https:" || payload.actionUrl.length > 4_096) {
    throw new InvitationEnvelopeInvalidError();
  }
  if (payload.emailOtp && !/^[A-Za-z0-9_-]{4,128}$/.test(payload.emailOtp)) {
    throw new InvitationEnvelopeInvalidError();
  }
}

export function sealInvitationActivationPayload(
  payload: InvitationActivationPayload,
  env: NodeJS.ProcessEnv = process.env
) {
  validatePayload(payload);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(env), iv);
  cipher.setAAD(associatedData);
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${envelopePrefix}${Buffer.concat([iv, tag, ciphertext]).toString("base64url")}`;
}

export function openInvitationActivationPayload(
  envelope: string,
  env: NodeJS.ProcessEnv = process.env
): InvitationActivationPayload {
  if (!envelope.startsWith(envelopePrefix)) {
    throw new InvitationEnvelopeInvalidError();
  }
  try {
    const packed = Buffer.from(
      envelope.slice(envelopePrefix.length),
      "base64url"
    );
    if (packed.length < 29) throw new InvitationEnvelopeInvalidError();
    const iv = packed.subarray(0, 12);
    const tag = packed.subarray(12, 28);
    const ciphertext = packed.subarray(28);
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      encryptionKey(env),
      iv
    );
    decipher.setAAD(associatedData);
    decipher.setAuthTag(tag);
    const value = JSON.parse(
      Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
        "utf8"
      )
    ) as InvitationActivationPayload;
    validatePayload(value);
    return value;
  } catch (error) {
    if (error instanceof InvitationEnvelopeConfigurationError) throw error;
    throw new InvitationEnvelopeInvalidError();
  }
}
