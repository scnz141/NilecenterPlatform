import crypto from "node:crypto";

export const NORMALIZED_STAGING_RUNTIME_PROFILE = "normalized-staging";
export const NORMALIZED_STAGING_ACKNOWLEDGEMENT =
  "I_ACKNOWLEDGE_NILE_NORMALIZED_STAGING_ISOLATION";

const compatibilityRuntimeProfile = "compatibility";
const phase5TargetRefHashes = {
  staging: "aa412ac2a6b666be6ad96683495e92778e2c70aae68891799d1f5754a050140c",
  production:
    "7728e57c3295ac6c1d964e067911e56d922fb6ed5319d1a9b3f00a13572db70f",
};
const localOnlyFlags = [
  "NILE_PLATFORM_STATE_LOCAL_ONLY",
  "QA_PLATFORM_STATE_LOCAL_ONLY",
  "QA_RESET_LOCAL_STATE",
  "NILE_PHASE2_SESSION_LOCAL_ONLY",
  "NILE_FORMS_PHASE13F1_LOCAL_ONLY",
] as const;

export type NileRuntimeProfile =
  | { name: typeof compatibilityRuntimeProfile }
  | {
      name: typeof NORMALIZED_STAGING_RUNTIME_PROFILE;
      stagingProjectRef: string;
      productionProjectRef: string;
      supabaseUrl: string;
    };

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function requireValue(env: NodeJS.ProcessEnv, key: string) {
  const value = clean(env[key]);
  if (!value) {
    throw new Error(
      `Normalized staging requires the server-only ${key} environment variable.`
    );
  }
  return value;
}

function assertDisabledFlag(env: NodeJS.ProcessEnv, key: string) {
  const value = clean(env[key]).toLowerCase();
  if (value && value !== "false" && value !== "0") {
    throw new Error(`Normalized staging requires ${key} to be disabled.`);
  }
}

function browserExposedSecrets(env: NodeJS.ProcessEnv) {
  return Object.entries(env)
    .filter(
      ([key, value]) =>
        key.startsWith("VITE_") &&
        /(SECRET|SERVICE_ROLE)/.test(key) &&
        Boolean(clean(value))
    )
    .map(([key]) => key)
    .sort();
}

export function validateRuntimeProfile(
  env: NodeJS.ProcessEnv = process.env,
  targetRefHashes = phase5TargetRefHashes
): NileRuntimeProfile {
  const profile = clean(env.NILE_RUNTIME_PROFILE).toLowerCase();
  if (!profile || profile === compatibilityRuntimeProfile) {
    return { name: compatibilityRuntimeProfile };
  }
  if (profile !== NORMALIZED_STAGING_RUNTIME_PROFILE) {
    throw new Error(
      `Unsupported NILE_RUNTIME_PROFILE value. Use ${compatibilityRuntimeProfile} or ${NORMALIZED_STAGING_RUNTIME_PROFILE}.`
    );
  }

  if (
    clean(env.NILE_STAGING_ACTIVATION_ACK) !==
    NORMALIZED_STAGING_ACKNOWLEDGEMENT
  ) {
    throw new Error(
      `Normalized staging requires NILE_STAGING_ACTIVATION_ACK=${NORMALIZED_STAGING_ACKNOWLEDGEMENT}.`
    );
  }

  const stagingProjectRef = requireValue(env, "NILE_STAGING_PROJECT_REF");
  const productionProjectRef = requireValue(env, "NILE_PRODUCTION_PROJECT_REF");
  if (stagingProjectRef === productionProjectRef) {
    throw new Error(
      "Normalized staging requires distinct staging and production project refs."
    );
  }
  const hashRef = (value: string) =>
    crypto.createHash("sha256").update(value, "utf8").digest("hex");
  if (hashRef(stagingProjectRef) !== targetRefHashes.staging) {
    throw new Error(
      "Normalized staging project does not match the reviewed Phase 5 target."
    );
  }
  if (hashRef(productionProjectRef) !== targetRefHashes.production) {
    throw new Error(
      "Production project does not match the protected Phase 5 reference."
    );
  }

  const supabaseUrl = requireValue(env, "SUPABASE_URL");
  let parsedSupabaseUrl: URL;
  try {
    parsedSupabaseUrl = new URL(supabaseUrl);
  } catch {
    throw new Error("Normalized staging requires a valid HTTPS SUPABASE_URL.");
  }
  const expectedHost = `${stagingProjectRef.toLowerCase()}.supabase.co`;
  if (
    parsedSupabaseUrl.protocol !== "https:" ||
    parsedSupabaseUrl.hostname.toLowerCase() !== expectedHost
  ) {
    throw new Error(
      "Normalized staging SUPABASE_URL must use HTTPS and match NILE_STAGING_PROJECT_REF."
    );
  }

  if (clean(env.NILE_SESSION_REPOSITORY).toLowerCase() !== "supabase") {
    throw new Error(
      "Normalized staging requires NILE_SESSION_REPOSITORY=supabase."
    );
  }
  if (
    clean(env.DEMO_AUTH_ENABLED).toLowerCase() !== "false" ||
    clean(env.VITE_DEMO_AUTH_ENABLED).toLowerCase() !== "false"
  ) {
    throw new Error(
      "Normalized staging requires DEMO_AUTH_ENABLED=false and VITE_DEMO_AUTH_ENABLED=false."
    );
  }

  localOnlyFlags.forEach(key => assertDisabledFlag(env, key));

  const exposedSecrets = browserExposedSecrets(env);
  if (exposedSecrets.length > 0) {
    throw new Error(
      `Normalized staging forbids browser-exposed secret or service-role keys: ${exposedSecrets.join(", ")}.`
    );
  }

  return {
    name: NORMALIZED_STAGING_RUNTIME_PROFILE,
    stagingProjectRef,
    productionProjectRef,
    supabaseUrl: parsedSupabaseUrl.toString().replace(/\/$/, ""),
  };
}
