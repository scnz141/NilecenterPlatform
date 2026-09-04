#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contractPath = path.join(
  root,
  "docs/normalized-platform-staging-control.json"
);
const modes = ["--static-preflight", "--target-guard"];
const selectedModes = modes.filter(mode => process.argv.includes(mode));
const unknownArgs = process.argv
  .slice(2)
  .filter(argument => !modes.includes(argument));

if (unknownArgs.length > 0) {
  throw new Error(`Unknown argument(s): ${unknownArgs.join(", ")}`);
}
if (selectedModes.length !== 1) {
  throw new Error(`Choose exactly one mode: ${modes.join(", ")}.`);
}

const targetRefHashes = Object.freeze({
  staging: "aa412ac2a6b666be6ad96683495e92778e2c70aae68891799d1f5754a050140c",
  production:
    "7728e57c3295ac6c1d964e067911e56d922fb6ed5319d1a9b3f00a13572db70f",
});
const expectedPackageIds = Object.freeze([
  "identity-scope-session-audit-mapping",
  "atomic-session-lifecycle",
  "transactional-email-delivery",
  "account-invitation-lifecycle",
  "normalized-profile-support",
  "normalized-admissions-intake",
  "normalized-application-conversion",
  "normalized-placement",
  "normalized-admissions-delivery-read-model",
  "normalized-student-enrollment-invitation",
  "normalized-teacher-session-attendance",
]);
const forbiddenPaths = new Set([
  "supabase/manual/018_transactional_email_account_invitation_bundle.sql",
  "supabase/manual/026_normalized_native_assignment_authority.sql",
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function verifyArtifact(artifact, label) {
  assert(
    artifact && typeof artifact === "object" && !Array.isArray(artifact),
    `${label} must be an artifact object.`
  );
  assert(
    typeof artifact.path === "string" && artifact.path.length > 0,
    `${label} path is required.`
  );
  assert(
    /^[a-f0-9]{64}$/.test(artifact.sha256),
    `${label} SHA-256 is invalid.`
  );
  assert(
    !forbiddenPaths.has(artifact.path),
    `${label} is explicitly excluded.`
  );

  const artifactPath = path.resolve(root, artifact.path);
  assert(
    artifactPath.startsWith(`${root}${path.sep}`),
    `${label} escapes the repository.`
  );
  assert(fs.existsSync(artifactPath), `${label} is missing.`);
  assert(
    sha256(fs.readFileSync(artifactPath)) === artifact.sha256,
    `${label} hash differs from the reviewed ledger.`
  );
}

function verifyStaticContract() {
  const contract = JSON.parse(fs.readFileSync(contractPath, "utf8"));
  assert(contract.version === 1, "Unsupported staging-control version.");
  assert(
    contract.contractId === "normalized-platform-staging-control",
    "Unexpected staging-control contract ID."
  );
  assert(contract.phase === 0, "The migration-control phase must remain 0.");
  assert(
    JSON.stringify(contract.targetRefHashes) ===
      JSON.stringify({
        algorithm: "sha256",
        ...targetRefHashes,
      }),
    "Staging or production target hashes changed."
  );
  assert(
    targetRefHashes.staging !== targetRefHashes.production,
    "Staging and production target hashes must differ."
  );

  assert(Array.isArray(contract.packages), "Packages must be an array.");
  assert(
    contract.packages.length === expectedPackageIds.length,
    "Package count differs from the reviewed Phase 0 ledger."
  );

  contract.packages.forEach((entry, index) => {
    const label = `Package ${index + 1}`;
    assert(entry.id === expectedPackageIds[index], `${label} is out of order.`);
    assert(entry.order === index + 1, `${label} order is invalid.`);
    assert(
      ["ordered_migration", "manual_unreconciled"].includes(
        entry.repositoryState
      ),
      `${label} repository state is invalid.`
    );
    assert(
      entry.stagingState === "unverified",
      `${label} cannot claim staging acceptance without live evidence.`
    );
    verifyArtifact(entry.forward, `${label} forward`);
    verifyArtifact(entry.rollback, `${label} rollback`);

    if (entry.repositoryState === "ordered_migration") {
      verifyArtifact(entry.migration, `${label} migration`);
      assert(
        entry.migration.sha256 === entry.forward.sha256,
        `${label} migration differs from its reviewed forward package.`
      );
    } else {
      assert(
        entry.migration === null,
        `${label} must remain blocked until an ordered migration is reviewed.`
      );
    }
  });

  assert(
    Array.isArray(contract.excludedPackages) &&
      contract.excludedPackages.length === forbiddenPaths.size,
    "Excluded package inventory is incomplete."
  );
  for (const excluded of contract.excludedPackages) {
    assert(
      forbiddenPaths.has(excluded.path),
      `Unexpected excluded package: ${excluded.path}`
    );
    assert(
      typeof excluded.reason === "string" && excluded.reason.length > 0,
      `Excluded package ${excluded.path} requires a reason.`
    );
  }

  assert(
    contract.constraints.isolatedStagingOnly === true &&
      contract.constraints.productionTargetingAllowed === false &&
      contract.constraints.remoteApplyEnabled === false &&
      contract.constraints.manualReplayAllowed === false &&
      contract.constraints.fakeIdentitiesOnly === true &&
      contract.constraints.runtimeDefaultsChanged === false,
    "Phase 0 safety constraints were weakened."
  );

  const migrationCount = contract.packages.filter(
    entry => entry.repositoryState === "ordered_migration"
  ).length;
  console.log(
    `Normalized staging control verified: ${contract.packages.length} reviewed packages, ${migrationCount} ordered migrations, remote apply disabled.`
  );
}

function verifyTargetGuard() {
  const target = String(
    process.env.NILE_NORMALIZED_STAGING_PROJECT_REF ?? ""
  ).trim();
  assert(target.length > 0, "NILE_NORMALIZED_STAGING_PROJECT_REF is required.");

  const targetHash = sha256(target);
  assert(
    targetHash !== targetRefHashes.production,
    "Refusing to target the production Supabase project."
  );
  assert(
    targetHash === targetRefHashes.staging,
    "Target is not the approved isolated staging project."
  );

  const linkedRefPath = path.join(root, "supabase/.temp/project-ref");
  if (fs.existsSync(linkedRefPath)) {
    const linkedHash = sha256(fs.readFileSync(linkedRefPath, "utf8").trim());
    assert(
      linkedHash !== targetRefHashes.production,
      "The Supabase CLI is linked to production. Relink to isolated staging before any staging command."
    );
    assert(
      linkedHash === targetRefHashes.staging,
      "The Supabase CLI link does not match isolated staging."
    );
  }

  console.log("Normalized staging target guard passed.");
}

if (selectedModes[0] === "--static-preflight") {
  verifyStaticContract();
} else {
  verifyTargetGuard();
}
