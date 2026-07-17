import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const attestationPath = path.join(
  root,
  "docs",
  "qa-attestations",
  "moodle-m2cr-phase2-20260716.json"
);

function fail(message) {
  console.error(`Moodle M2C-R evidence validation failed: ${message}`);
  process.exitCode = 1;
}

function sha256(filePath) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(filePath))
    .digest("hex");
}

function assert(value, message) {
  if (!value) fail(message);
}

const attestation = JSON.parse(fs.readFileSync(attestationPath, "utf8"));
const serialized = JSON.stringify(attestation);

assert(attestation.version === 1, "unsupported attestation version");
assert(attestation.phase === "M2C-R", "unexpected phase");
assert(attestation.mode === "sandbox_read_contract", "unexpected mode");
assert(
  /^[a-f0-9]{40}$/.test(attestation.sourceCommit),
  "sourceCommit must be a full Git SHA"
);
assert(
  attestation.readPasses?.length === 2,
  "exactly two read passes are required"
);

const combinedFingerprints = new Set();
for (const [index, pass] of (attestation.readPasses ?? []).entries()) {
  assert(
    pass.functionCount === 31,
    `pass ${index + 1} must cover 31 functions`
  );
  assert(pass.passed === 31, `pass ${index + 1} must pass all functions`);
  assert(pass.failed === 0, `pass ${index + 1} must have zero failures`);
  assert(
    /^[a-f0-9]{64}$/.test(pass.combinedFingerprint),
    `pass ${index + 1} has an invalid combined fingerprint`
  );
  assert(
    /^[a-f0-9]{64}$/.test(pass.artifactSha256),
    `pass ${index + 1} has an invalid artifact hash`
  );
  combinedFingerprints.add(pass.combinedFingerprint);

  const artifactPath = path.join(root, pass.artifact);
  if (fs.existsSync(artifactPath)) {
    assert(
      sha256(artifactPath) === pass.artifactSha256,
      `pass ${index + 1} artifact hash does not match`
    );
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    assert(
      artifact.ok === true,
      `pass ${index + 1} artifact is not successful`
    );
    assert(
      artifact.functionCount === 31,
      `pass ${index + 1} artifact count changed`
    );
    assert(
      artifact.passed === 31 && artifact.failed === 0,
      `pass ${index + 1} artifact result changed`
    );
    assert(
      artifact.fingerprints?.combined === pass.combinedFingerprint,
      `pass ${index + 1} artifact fingerprint changed`
    );
  }
}

assert(
  attestation.deterministicReplay === true,
  "deterministic replay was not proven"
);
assert(combinedFingerprints.size === 1, "read-pass fingerprints do not match");

const cleanup = attestation.remoteCleanup ?? {};
for (const field of [
  "courseModulesAbsent",
  "syntheticUsersDeleted",
  "serviceAbsent",
  "repositoryInstanceAbsent",
  "privateUploadsAbsent",
  "h5pContentTypesAndLibrariesAbsent",
  "temporaryCapabilitiesRevoked",
  "userWebdavInstancesDisabled",
]) {
  assert(cleanup[field] === true, `cleanup proof ${field} is missing`);
}
assert(
  cleanup.repeatedCleanupResult === "no_op_absence_confirmed",
  "repeated cleanup did not end as an absent no-op"
);

const teardown = attestation.credentialTeardown ?? {};
assert(teardown.serviceDeleted === true, "service teardown is missing");
assert(
  teardown.retiredTokenRejected === true,
  "retired-token rejection is missing"
);
assert(
  teardown.retiredTokenErrorCode === "invalidtoken",
  "unexpected retired-token result"
);
assert(
  teardown.localCredentialFilesRemoved === true,
  "local credential files remain"
);

for (const [field, value] of Object.entries(
  attestation.localBridgeTeardown ?? {}
)) {
  assert(value === true, `local bridge teardown ${field} is incomplete`);
}

const qualityGate = attestation.qualityGate ?? {};
assert(qualityGate.verifyPassed === true, "full verification did not pass");
assert(qualityGate.typescriptPassed === true, "TypeScript gate did not pass");
assert(qualityGate.buildPassed === true, "production build did not pass");
assert(qualityGate.unitTests === 572, "unexpected unit-test count");
assert(qualityGate.testFiles === 50, "unexpected unit-test file count");
assert(qualityGate.totalChecks === 1598, "unexpected portal QA count");
assert(qualityGate.failedChecks === 0, "portal QA contains failures");
assert(qualityGate.inProgress === false, "portal QA artifact is incomplete");
assert(
  /^[a-f0-9]{64}$/.test(qualityGate.artifactSha256),
  "portal QA artifact hash is invalid"
);

const qaArtifactPath = path.join(root, qualityGate.artifact ?? "");
if (fs.existsSync(qaArtifactPath)) {
  assert(
    sha256(qaArtifactPath) === qualityGate.artifactSha256,
    "portal QA artifact hash does not match"
  );
  const qaArtifact = JSON.parse(fs.readFileSync(qaArtifactPath, "utf8"));
  assert(
    qaArtifact.totalChecks === 1598 && qaArtifact.failedChecks === 0,
    "portal QA artifact result changed"
  );
  assert(
    qaArtifact.inProgress === false,
    "portal QA artifact remains in progress"
  );
}

assert(
  attestation.realIdentityOrDocumentUsed === false,
  "real identity or document use is forbidden"
);
assert(
  attestation.rawProviderPayloadStored === false,
  "raw provider payload storage is forbidden"
);
assert(
  attestation.credentialMaterialStored === false,
  "credential material storage is forbidden"
);

for (const forbidden of [
  /wstoken/i,
  /(?:password|secret|token)\s*[=:]\s*["']?[^"'\s,}]{8,}/i,
  /@[a-z0-9.-]+\.[a-z]{2,}/i,
]) {
  assert(
    !forbidden.test(serialized),
    "attestation contains credential-shaped or identity-shaped text"
  );
}

if (!process.exitCode) {
  console.log(
    "Moodle M2C-R evidence validation passed: 31/31 reads twice with cleanup and teardown proof."
  );
}
