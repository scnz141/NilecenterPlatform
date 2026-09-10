import crypto from "node:crypto";

const envelopePrefix = "v1.";
const associatedData = Buffer.from("nile-learn:ncc-ems-session:v1", "utf8");

export const EMS_SESSION_COOKIE_NAME = "nilelearn_ems_session";

export class EmsSessionConfigurationError extends Error {
  constructor() {
    super("NCC EMS session protection is not configured.");
    this.name = "EmsSessionConfigurationError";
  }
}

export class EmsSessionInvalidError extends Error {
  constructor() {
    super("NCC EMS session data is invalid.");
    this.name = "EmsSessionInvalidError";
  }
}

export type EmsSessionPayload = Readonly<{
  ownerSessionId: string;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
  sessionId: string;
}>;

function encryptionKey(env: NodeJS.ProcessEnv) {
  const source = env.EMS_SESSION_SEAL_KEY?.trim() ?? "";
  if (source.length < 32) throw new EmsSessionConfigurationError();
  return crypto.createHash("sha256").update(source, "utf8").digest();
}

function validTimestamp(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed);
}

function validatePayload(payload: EmsSessionPayload) {
  if (
    !payload ||
    typeof payload !== "object" ||
    typeof payload.ownerSessionId !== "string" ||
    !payload.ownerSessionId ||
    payload.ownerSessionId.length > 512 ||
    typeof payload.accessToken !== "string" ||
    !payload.accessToken ||
    payload.accessToken.length > 8_192 ||
    typeof payload.refreshToken !== "string" ||
    !payload.refreshToken ||
    payload.refreshToken.length > 8_192 ||
    typeof payload.accessTokenExpiresAt !== "string" ||
    !validTimestamp(payload.accessTokenExpiresAt) ||
    typeof payload.refreshTokenExpiresAt !== "string" ||
    !validTimestamp(payload.refreshTokenExpiresAt) ||
    typeof payload.sessionId !== "string" ||
    !payload.sessionId ||
    payload.sessionId.length > 512
  ) {
    throw new EmsSessionInvalidError();
  }
}

export function isEmsSessionProtectionConfigured(
  env: NodeJS.ProcessEnv = process.env
) {
  return (env.EMS_SESSION_SEAL_KEY?.trim().length ?? 0) >= 32;
}

export function sealEmsSession(
  payload: EmsSessionPayload,
  env: NodeJS.ProcessEnv = process.env
) {
  validatePayload(payload);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(env), iv);
  cipher.setAAD(associatedData);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  const envelope = `${envelopePrefix}${Buffer.concat([
    iv,
    cipher.getAuthTag(),
    ciphertext,
  ]).toString("base64url")}`;
  if (envelope.length > 3_800) throw new EmsSessionInvalidError();
  return envelope;
}

export function openEmsSession(
  envelope: string,
  env: NodeJS.ProcessEnv = process.env
): EmsSessionPayload {
  if (!envelope.startsWith(envelopePrefix)) throw new EmsSessionInvalidError();
  try {
    const packed = Buffer.from(
      envelope.slice(envelopePrefix.length),
      "base64url"
    );
    if (packed.length < 29) throw new EmsSessionInvalidError();
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      encryptionKey(env),
      packed.subarray(0, 12)
    );
    decipher.setAAD(associatedData);
    decipher.setAuthTag(packed.subarray(12, 28));
    const payload = JSON.parse(
      Buffer.concat([
        decipher.update(packed.subarray(28)),
        decipher.final(),
      ]).toString("utf8")
    ) as EmsSessionPayload;
    validatePayload(payload);
    return payload;
  } catch (error) {
    if (error instanceof EmsSessionConfigurationError) throw error;
    throw new EmsSessionInvalidError();
  }
}
