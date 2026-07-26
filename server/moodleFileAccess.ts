import crypto from "node:crypto";

const tokenVersion = 1;
const courseIdPattern = /^[a-z0-9][a-z0-9_-]{0,127}$/i;
const resourceIdPattern = /^[1-9]\d*:[1-9]\d*$/;

export type MoodleFileAccess = Readonly<{
  courseId: string;
  resourceId: string;
  expiresAt: number;
}>;

export class MoodleFileAccessError extends Error {
  constructor(message = "Moodle file access is invalid or expired.") {
    super(message);
    this.name = "MoodleFileAccessError";
  }
}

function key(secret: string) {
  const value = secret.trim();
  if (value.length < 32) throw new MoodleFileAccessError();
  return crypto.createHash("sha256").update(value, "utf8").digest();
}

function assertAccess(value: MoodleFileAccess, now: number) {
  if (
    !courseIdPattern.test(value.courseId) ||
    !resourceIdPattern.test(value.resourceId) ||
    !Number.isSafeInteger(value.expiresAt) ||
    value.expiresAt <= now ||
    value.expiresAt > now + 10 * 60
  ) {
    throw new MoodleFileAccessError();
  }
}

export function createMoodleFileAccessToken(
  input: Readonly<{ courseId: string; resourceId: string }>,
  secret: string,
  now = Date.now()
) {
  const payload: MoodleFileAccess = {
    courseId: input.courseId,
    resourceId: input.resourceId,
    expiresAt: Math.floor(now / 1000) + 5 * 60,
  };
  assertAccess(payload, Math.floor(now / 1000));
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(secret), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify({ v: tokenVersion, ...payload }), "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString(
    "base64url"
  );
}

export function parseMoodleFileAccessToken(
  token: string,
  secret: string,
  now = Date.now()
): MoodleFileAccess {
  try {
    if (!/^[A-Za-z0-9_-]{40,1200}$/.test(token)) {
      throw new MoodleFileAccessError();
    }
    const raw = Buffer.from(token, "base64url");
    if (raw.toString("base64url") !== token) {
      throw new MoodleFileAccessError();
    }
    if (raw.byteLength < 29) throw new MoodleFileAccessError();
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key(secret),
      raw.subarray(0, 12)
    );
    decipher.setAuthTag(raw.subarray(12, 28));
    const payload = JSON.parse(
      Buffer.concat([
        decipher.update(raw.subarray(28)),
        decipher.final(),
      ]).toString("utf8")
    ) as Record<string, unknown>;
    if (
      Object.keys(payload).sort().join(",") !==
        "courseId,expiresAt,resourceId,v" ||
      payload.v !== tokenVersion ||
      typeof payload.courseId !== "string" ||
      typeof payload.resourceId !== "string" ||
      typeof payload.expiresAt !== "number"
    ) {
      throw new MoodleFileAccessError();
    }
    const access = {
      courseId: payload.courseId,
      resourceId: payload.resourceId,
      expiresAt: payload.expiresAt,
    };
    assertAccess(access, Math.floor(now / 1000));
    return access;
  } catch (error) {
    if (error instanceof MoodleFileAccessError) throw error;
    throw new MoodleFileAccessError();
  }
}

export function decorateMoodleFileResources<
  T extends {
    internalCourseId: string;
    sections: ReadonlyArray<{
      activities: ReadonlyArray<{
        resources?: ReadonlyArray<{ resourceId: string; external?: boolean }>;
      }>;
    }>;
  },
>(projection: T, secret: string, now = Date.now()): T {
  if (!secret.trim()) return projection;
  return {
    ...projection,
    sections: projection.sections.map(section => ({
      ...section,
      activities: section.activities.map(activity => ({
        ...activity,
        ...(activity.resources
          ? {
              resources: activity.resources.map(resource => ({
                ...resource,
                ...(!resource.external
                  ? {
                      downloadPath: `/api/integrations/moodle/files/${createMoodleFileAccessToken(
                        {
                          courseId: projection.internalCourseId,
                          resourceId: resource.resourceId,
                        },
                        secret,
                        now
                      )}`,
                    }
                  : {}),
              })),
            }
          : {}),
      })),
    })),
  } as T;
}
