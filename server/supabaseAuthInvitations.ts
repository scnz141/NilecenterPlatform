import { getSupabaseServerConfig } from "./supabase.js";

export class SupabaseInvitationProviderUnavailableError extends Error {
  constructor() {
    super("Account invitation provider is temporarily unavailable.");
    this.name = "SupabaseInvitationProviderUnavailableError";
  }
}

export class SupabaseInvitationVerificationError extends Error {
  constructor(
    message = "The invitation link or verification code is invalid."
  ) {
    super(message);
    this.name = "SupabaseInvitationVerificationError";
  }
}

type AuthFetch = typeof fetch;

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function readJson(response: Response) {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    throw new SupabaseInvitationProviderUnavailableError();
  }
}

function authConfig(env: NodeJS.ProcessEnv) {
  const config = getSupabaseServerConfig(env);
  if (!config.url || !config.publishableKey || !config.secretKey) {
    throw new SupabaseInvitationProviderUnavailableError();
  }
  return config;
}

async function authFetch(
  path: string,
  init: RequestInit,
  credential: string,
  env: NodeJS.ProcessEnv,
  fetcher: AuthFetch
) {
  const config = authConfig(env);
  const headers = new Headers(init.headers);
  headers.set(
    "apikey",
    credential === config.secretKey ? config.secretKey : config.publishableKey
  );
  headers.set("Authorization", `Bearer ${credential}`);
  headers.set("Content-Type", "application/json");
  try {
    return await fetcher(`${config.url}/auth/v1/${path.replace(/^\/+/, "")}`, {
      ...init,
      headers,
    });
  } catch {
    throw new SupabaseInvitationProviderUnavailableError();
  }
}

export type GeneratedSupabaseInvitation = Readonly<{
  authUserId: string;
  actionUrl: string;
  emailOtp?: string;
}>;

export class SupabaseAuthInvitationService {
  constructor(
    private readonly env: NodeJS.ProcessEnv = process.env,
    private readonly fetcher: AuthFetch = fetch
  ) {}

  async generate(email: string, redirectTo: string) {
    const config = authConfig(this.env);
    const response = await authFetch(
      "admin/generate_link",
      {
        method: "POST",
        body: JSON.stringify({
          type: "invite",
          email,
          redirect_to: redirectTo,
        }),
      },
      config.secretKey,
      this.env,
      this.fetcher
    );
    if (!response.ok) {
      if (response.status === 422 || response.status === 400) {
        throw new SupabaseInvitationVerificationError(
          "This email cannot be invited or is already registered."
        );
      }
      throw new SupabaseInvitationProviderUnavailableError();
    }
    const payload = await readJson(response);
    const properties =
      payload.properties && typeof payload.properties === "object"
        ? (payload.properties as Record<string, unknown>)
        : {};
    const user =
      payload.user && typeof payload.user === "object"
        ? (payload.user as Record<string, unknown>)
        : {};
    const authUserId = clean(user.id || payload.id);
    const actionUrl = clean(properties.action_link || payload.action_link);
    const emailOtp = clean(properties.email_otp || payload.email_otp);
    if (!authUserId || !actionUrl) {
      throw new SupabaseInvitationProviderUnavailableError();
    }
    return {
      authUserId,
      actionUrl,
      emailOtp: emailOtp || undefined,
    } satisfies GeneratedSupabaseInvitation;
  }

  async removeGeneratedUser(authUserId: string) {
    const config = authConfig(this.env);
    const response = await authFetch(
      `admin/users/${encodeURIComponent(authUserId)}`,
      { method: "DELETE" },
      config.secretKey,
      this.env,
      this.fetcher
    );
    if (!response.ok && response.status !== 404) {
      throw new SupabaseInvitationProviderUnavailableError();
    }
  }

  async verifyEmailOtp(email: string, otp: string) {
    const config = authConfig(this.env);
    const response = await authFetch(
      "verify",
      {
        method: "POST",
        body: JSON.stringify({ email, token: otp, type: "invite" }),
      },
      config.publishableKey,
      this.env,
      this.fetcher
    );
    if (!response.ok) throw new SupabaseInvitationVerificationError();
    const payload = await readJson(response);
    const accessToken = clean(payload.access_token);
    if (!accessToken) throw new SupabaseInvitationVerificationError();
    return accessToken;
  }

  async getVerifiedUser(accessToken: string) {
    const response = await authFetch(
      "user",
      { method: "GET" },
      accessToken,
      this.env,
      this.fetcher
    );
    if (!response.ok) throw new SupabaseInvitationVerificationError();
    const payload = await readJson(response);
    const id = clean(payload.id);
    const email = clean(payload.email).toLowerCase();
    if (!id || !email) throw new SupabaseInvitationVerificationError();
    return { id, email };
  }

  async setPassword(accessToken: string, password: string) {
    const response = await authFetch(
      "user",
      { method: "PUT", body: JSON.stringify({ password }) },
      accessToken,
      this.env,
      this.fetcher
    );
    if (!response.ok) {
      if (response.status === 400 || response.status === 422) {
        throw new SupabaseInvitationVerificationError(
          "The new password does not meet the account security policy."
        );
      }
      throw new SupabaseInvitationProviderUnavailableError();
    }
  }

  async completePasswordRecovery(input: {
    accessToken: string;
    password: string;
    email?: string;
  }) {
    const accessToken = clean(input.accessToken);
    const email = clean(input.email).toLowerCase();
    if (!accessToken) throw new SupabaseInvitationVerificationError();
    if (input.password.length < 12) {
      throw new SupabaseInvitationVerificationError(
        "Use at least 12 characters."
      );
    }
    const user = await this.getVerifiedUser(accessToken);
    if (email && user.email !== email) {
      throw new SupabaseInvitationVerificationError(
        "The verified email does not match this recovery link."
      );
    }
    await this.setPassword(accessToken, input.password);
    return { email: user.email };
  }
}
