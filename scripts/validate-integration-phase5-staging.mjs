import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDirectory, "..");
const manifestPath = path.join(
  root,
  "docs/integration-phase5-staging-foundation.json"
);

const expected = Object.freeze({
  version: 1,
  contractId: "integration-phase5-staging-foundation",
  phase: 5,
  targetRefHashes: Object.freeze({
    algorithm: "sha256",
    staging: "aa412ac2a6b666be6ad96683495e92778e2c70aae68891799d1f5754a050140c",
    production:
      "7728e57c3295ac6c1d964e067911e56d922fb6ed5319d1a9b3f00a13572db70f",
  }),
  artifacts: Object.freeze([
    Object.freeze({
      id: "phase1",
      path: "supabase/migrations/20260710053837_phase1_identity_scope_session_audit_mapping.sql",
      sha256:
        "fc08d23a1b12534e572ebeb50e9d32874e84b8d8e89c06c24abe4aff376a49d9",
    }),
    Object.freeze({
      id: "phase2",
      path: "supabase/migrations/20260710132000_phase2b_atomic_session_lifecycle.sql",
      sha256:
        "4e1d37eee9c2898fad15491781812b65c3e4aad937263cd62ec740b4cd612325",
    }),
    Object.freeze({
      id: "seed",
      path: "supabase/seed.sql",
      sha256:
        "e9a483ee34a5074c7da4eeecc9371c8c3666ae5d29aa8e0ca8cd56b1850608f2",
    }),
    Object.freeze({
      id: "assertions",
      path: "docs/supabase-phase-1-identity-session-rls-assertions.sql",
      sha256:
        "6a57832c0568514b1f2c91ba07a208a9328728bb61e9ab1f36dc2e0033c8aa3b",
    }),
    Object.freeze({
      id: "rollback2",
      path: "supabase/manual/901_phase2b_rollback.sql",
      sha256:
        "ff703a00a7b91ef5c16a0a78ff8e6f40b95f234673fa19a8885e1c3c27fd72f7",
    }),
    Object.freeze({
      id: "rollback1",
      path: "supabase/manual/902_phase1_rollback.sql",
      sha256:
        "0bea9bd8e81f34fee8f3f253cb6520260dc0940a50fb2d5375432e7c676fa6e9",
    }),
  ]),
  constraints: Object.freeze({
    isolatedStagingOnly: true,
    productionTargetingAllowed: false,
    remoteNetworkAllowed: false,
    plaintextProjectRefsAllowed: false,
    plaintextSecretsAllowed: false,
    fakeIdentitiesOnly: true,
    runtimeDefaultsChanged: false,
  }),
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function exactKeys(value, keys, label) {
  assert(
    value && typeof value === "object" && !Array.isArray(value),
    `${label} must be an object.`
  );
  const actual = Object.keys(value).sort();
  const required = [...keys].sort();
  assert(
    JSON.stringify(actual) === JSON.stringify(required),
    `${label} keys differ from the immutable contract.`
  );
}

function sha256(filePath) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(filePath))
    .digest("hex");
}

function validateNoSensitiveMaterial(value, pathParts = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      validateNoSensitiveMaterial(item, [...pathParts, String(index)])
    );
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      assert(
        key === "plaintextSecretsAllowed" ||
          !/(password|secret|token|credential|api.?key|service.?role|database.?url)/i.test(
            key
          ),
        `Sensitive field is forbidden at ${[...pathParts, key].join(".")}.`
      );
      validateNoSensitiveMaterial(child, [...pathParts, key]);
    }
    return;
  }
  if (typeof value !== "string") return;

  const location = pathParts.join(".");
  assert(
    !/^(?:[a-z]{20}|[a-z0-9]{20})$/.test(value),
    `Possible plaintext project reference is forbidden at ${location}.`
  );
  assert(
    !/(?:sb_secret_|sb_publishable_|postgres(?:ql)?:\/\/|https?:\/\/[^\s]*supabase|eyJ[A-Za-z0-9_-]+\.)/i.test(
      value
    ),
    `Possible plaintext credential or target URL is forbidden at ${location}.`
  );
}

function validate(candidate, { verifyFiles = true } = {}) {
  exactKeys(
    candidate,
    [
      "version",
      "contractId",
      "phase",
      "immutable",
      "targetRefHashes",
      "artifacts",
      "constraints",
    ],
    "Manifest"
  );
  assert(candidate.version === expected.version, "Version mismatch.");
  assert(candidate.contractId === expected.contractId, "Contract ID mismatch.");
  assert(candidate.phase === expected.phase, "Phase mismatch.");
  assert(candidate.immutable === true, "Contract must remain immutable.");

  exactKeys(
    candidate.targetRefHashes,
    ["algorithm", "staging", "production"],
    "Target reference hashes"
  );
  assert(
    JSON.stringify(candidate.targetRefHashes) ===
      JSON.stringify(expected.targetRefHashes),
    "Target reference hashes differ from the immutable contract."
  );
  assert(
    candidate.targetRefHashes.staging !== candidate.targetRefHashes.production,
    "Staging and production target reference hashes must be distinct."
  );

  assert(Array.isArray(candidate.artifacts), "Artifacts must be an array.");
  assert(
    candidate.artifacts.length === expected.artifacts.length,
    "Artifact count differs from the immutable contract."
  );
  candidate.artifacts.forEach((artifact, index) => {
    exactKeys(artifact, ["id", "path", "sha256"], `Artifact ${index}`);
    assert(
      JSON.stringify(artifact) === JSON.stringify(expected.artifacts[index]),
      `Artifact ${index} differs from the immutable contract.`
    );
    if (!verifyFiles) return;

    const filePath = path.resolve(root, artifact.path);
    assert(
      filePath.startsWith(`${root}${path.sep}`),
      `Artifact path escapes the repository: ${artifact.path}`
    );
    assert(fs.existsSync(filePath), `Artifact is missing: ${artifact.path}`);
    assert(
      fs.statSync(filePath).isFile(),
      `Artifact is not a file: ${artifact.path}`
    );
    assert(
      sha256(filePath) === artifact.sha256,
      `Artifact hash mismatch: ${artifact.path}`
    );
  });

  exactKeys(
    candidate.constraints,
    Object.keys(expected.constraints),
    "Constraints"
  );
  assert(
    JSON.stringify(candidate.constraints) ===
      JSON.stringify(expected.constraints),
    "Constraints differ from the immutable contract."
  );
  validateNoSensitiveMaterial(candidate);
}

function assertRejected(candidate, label) {
  let rejected = false;
  try {
    validate(candidate, { verifyFiles: false });
  } catch {
    rejected = true;
  }
  assert(rejected, `Negative control was accepted: ${label}`);
}

function runNegativeControls(candidate) {
  const controls = [
    [
      "same target",
      draft => {
        draft.targetRefHashes.staging = draft.targetRefHashes.production;
      },
    ],
    [
      "changed artifact hash",
      draft => {
        draft.artifacts[0].sha256 = "0".repeat(64);
      },
    ],
    [
      "plaintext project reference",
      draft => {
        draft.targetRef = "abcdefghijklmnopqrst";
      },
    ],
    [
      "secret field",
      draft => {
        draft.serviceRoleSecret = "forbidden";
      },
    ],
    [
      "remote network enabled",
      draft => {
        draft.constraints.remoteNetworkAllowed = true;
      },
    ],
  ];

  for (const [label, mutate] of controls) {
    const draft = structuredClone(candidate);
    mutate(draft);
    assertRejected(draft, label);
  }
  return controls.length;
}

try {
  const candidate = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  validate(candidate);
  const negativeControls = runNegativeControls(candidate);
  console.log(
    JSON.stringify({
      ok: true,
      contractId: candidate.contractId,
      version: candidate.version,
      targetsDistinct: true,
      artifactsVerified: candidate.artifacts.length,
      negativeControls,
      networkAccessed: false,
    })
  );
} catch (error) {
  console.error(
    JSON.stringify({
      ok: false,
      contractId: expected.contractId,
      error: error instanceof Error ? error.message : String(error),
    })
  );
  process.exitCode = 1;
}
