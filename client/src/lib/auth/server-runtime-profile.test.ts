import crypto from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  NORMALIZED_STAGING_ACKNOWLEDGEMENT,
  validateRuntimeProfile,
} from "../../../../server/runtimeProfile";

const testTargetRefHashes = {
  staging: crypto
    .createHash("sha256")
    .update("stagingprojectref123")
    .digest("hex"),
  production: crypto
    .createHash("sha256")
    .update("productionproject12")
    .digest("hex"),
};

function validateTestRuntimeProfile(env: NodeJS.ProcessEnv) {
  return validateRuntimeProfile(env, testTargetRefHashes);
}

function validNormalizedStagingEnv(
  overrides: Record<string, string | undefined> = {}
) {
  const env = {
    NILE_RUNTIME_PROFILE: "normalized-staging",
    NILE_STAGING_ACTIVATION_ACK: NORMALIZED_STAGING_ACKNOWLEDGEMENT,
    NILE_STAGING_PROJECT_REF: "stagingprojectref123",
    NILE_PRODUCTION_PROJECT_REF: "productionproject12",
    SUPABASE_URL: "https://stagingprojectref123.supabase.co",
    NILE_SESSION_REPOSITORY: "supabase",
    DEMO_AUTH_ENABLED: "false",
    VITE_DEMO_AUTH_ENABLED: "false",
    ...overrides,
  } as NodeJS.ProcessEnv;

  Object.entries(env).forEach(([key, value]) => {
    if (value === undefined) delete env[key];
  });
  return env;
}

describe("Nile runtime profile activation", () => {
  it.each([{}, { NILE_RUNTIME_PROFILE: "compatibility" }])(
    "preserves compatibility behavior without staging validation",
    env => {
      expect(validateTestRuntimeProfile(env as NodeJS.ProcessEnv)).toEqual({
        name: "compatibility",
      });
    }
  );

  it("accepts an isolated normalized-staging configuration", () => {
    expect(validateTestRuntimeProfile(validNormalizedStagingEnv())).toEqual({
      name: "normalized-staging",
      stagingProjectRef: "stagingprojectref123",
      productionProjectRef: "productionproject12",
      supabaseUrl: "https://stagingprojectref123.supabase.co",
    });
  });

  it("rejects unsupported runtime profiles", () => {
    expect(() =>
      validateTestRuntimeProfile({ NILE_RUNTIME_PROFILE: "production" })
    ).toThrow("Unsupported NILE_RUNTIME_PROFILE");
  });

  it.each([undefined, "incorrect-acknowledgement"])(
    "rejects a missing or incorrect staging acknowledgement",
    acknowledgement => {
      expect(() =>
        validateTestRuntimeProfile(
          validNormalizedStagingEnv({
            NILE_STAGING_ACTIVATION_ACK: acknowledgement,
          })
        )
      ).toThrow("NILE_STAGING_ACTIVATION_ACK");
    }
  );

  it.each(["NILE_STAGING_PROJECT_REF", "NILE_PRODUCTION_PROJECT_REF"])(
    "requires %s",
    key => {
      expect(() =>
        validateTestRuntimeProfile(
          validNormalizedStagingEnv({ [key]: undefined })
        )
      ).toThrow(key);
    }
  );

  it("rejects a staging project that is also the production project", () => {
    expect(() =>
      validateTestRuntimeProfile(
        validNormalizedStagingEnv({
          NILE_PRODUCTION_PROJECT_REF: "stagingprojectref123",
        })
      )
    ).toThrow("distinct staging and production project refs");
  });

  it("rejects staging and production refs with swapped labels", () => {
    expect(() =>
      validateTestRuntimeProfile(
        validNormalizedStagingEnv({
          NILE_STAGING_PROJECT_REF: "productionproject12",
          NILE_PRODUCTION_PROJECT_REF: "stagingprojectref123",
          SUPABASE_URL: "https://productionproject12.supabase.co",
        })
      )
    ).toThrow("reviewed Phase 5 target");
  });

  it.each([
    "http://stagingprojectref123.supabase.co",
    "https://differentprojectref.supabase.co",
    "not-a-url",
  ])("rejects a non-HTTPS or mismatched Supabase URL", supabaseUrl => {
    expect(() =>
      validateTestRuntimeProfile(
        validNormalizedStagingEnv({ SUPABASE_URL: supabaseUrl })
      )
    ).toThrow(/SUPABASE_URL/);
  });

  it("requires the durable Supabase session repository", () => {
    expect(() =>
      validateTestRuntimeProfile(
        validNormalizedStagingEnv({ NILE_SESSION_REPOSITORY: "memory" })
      )
    ).toThrow("NILE_SESSION_REPOSITORY=supabase");
  });

  it.each(["DEMO_AUTH_ENABLED", "VITE_DEMO_AUTH_ENABLED"])(
    "requires %s to be explicitly disabled",
    key => {
      expect(() =>
        validateTestRuntimeProfile(validNormalizedStagingEnv({ [key]: "true" }))
      ).toThrow("DEMO_AUTH_ENABLED=false");
    }
  );

  it.each([
    "NILE_PLATFORM_STATE_LOCAL_ONLY",
    "QA_PLATFORM_STATE_LOCAL_ONLY",
    "QA_RESET_LOCAL_STATE",
    "NILE_PHASE2_SESSION_LOCAL_ONLY",
    "NILE_FORMS_PHASE13F1_LOCAL_ONLY",
  ])("rejects enabled local-only/reset flag %s", key => {
    expect(() =>
      validateTestRuntimeProfile(validNormalizedStagingEnv({ [key]: "1" }))
    ).toThrow(`${key} to be disabled`);
  });

  it.each([
    "VITE_SUPABASE_SECRET_KEY",
    "VITE_SUPABASE_SERVICE_ROLE_KEY",
    "VITE_OTHER_SERVICE_ROLE_TOKEN",
  ])("rejects populated browser-exposed secret %s", key => {
    expect(() =>
      validateTestRuntimeProfile(
        validNormalizedStagingEnv({ [key]: "must-not-reach-browser" })
      )
    ).toThrow(key);
  });

  it("allows publishable browser configuration", () => {
    expect(
      validateTestRuntimeProfile(
        validNormalizedStagingEnv({
          VITE_SUPABASE_PUBLISHABLE_KEY: "publishable-test-key",
        })
      ).name
    ).toBe("normalized-staging");
  });
});
