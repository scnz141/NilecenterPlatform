import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const manifestPath = path.join(root, "docs/moodle-phase4-contract-loops.json");
const ownershipPath = path.join(root, "docs/integration-ownership-matrix.json");
const freezePath = path.join(root, "docs/integration-feature-freeze.json");
const readPassOnePath = path.join(
  root,
  "output/moodle-m2cr-20260716/read-pass-1.json"
);
const readPassTwoPath = path.join(
  root,
  "output/moodle-m2cr-20260716/read-pass-2.json"
);

const requiredStages = [
  "setup",
  "create_or_fixture_discovery",
  "read",
  "replay",
  "reconciliation",
  "denial_or_failure",
  "cleanup",
  "repeated_cleanup",
  "token_teardown",
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sha256(filePath) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(filePath))
    .digest("hex");
}

function stable(values) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function unique(values, label) {
  const duplicates = values.filter(
    (value, index) => values.indexOf(value) !== index
  );
  assert(
    duplicates.length === 0,
    `${label} contains duplicates: ${stable(new Set(duplicates)).join(", ")}`
  );
}

function exactSet(actual, expected, label) {
  const actualValues = stable(actual);
  const expectedValues = stable(expected);
  assert(
    JSON.stringify(actualValues) === JSON.stringify(expectedValues),
    `${label} mismatch. Expected ${expectedValues.join(", ")}; received ${actualValues.join(", ")}.`
  );
}

function selectorMatches(value, selectors = []) {
  return selectors.some(selector => new RegExp(selector).test(value));
}

function validate(candidate, { runNegativeControls = true } = {}) {
  const ownership = readJson(ownershipPath);
  const freeze = readJson(freezePath);
  const readPassOne = readJson(readPassOnePath);
  const readPassTwo = readJson(readPassTwoPath);

  assert(candidate.version === 1, "Phase 4 loop manifest version must be 1.");
  assert(
    candidate.productionWritesEnabled === false,
    "Production Moodle writes must remain disabled."
  );
  assert(
    candidate.portalWritesEnabled === false,
    "Portal-to-Moodle writes must remain disabled."
  );
  exactSet(
    candidate.requiredStages,
    requiredStages,
    "Required lifecycle stages"
  );

  assert(
    Array.isArray(candidate.lanes) && candidate.lanes.length === 2,
    "Exactly two frozen-contract evidence lanes are required."
  );
  unique(
    candidate.lanes.map(lane => lane.id),
    "Lane IDs"
  );
  unique(
    candidate.lanes.flatMap(lane => lane.familyIds),
    "Lane family IDs"
  );

  const frozenReads = freeze.protectedSurface.moodleReadFunctions;
  const frozenWrites = freeze.protectedSurface.moodleSandboxWriteFunctions;
  const providerFamilies = ownership.featureFamilies.filter(family => {
    const selectors = family.selectors ?? {};
    return (
      (selectors.moodleReadFunctions?.length ?? 0) > 0 ||
      (selectors.moodleSandboxWriteFunctions?.length ?? 0) > 0
    );
  });

  exactSet(
    candidate.lanes.flatMap(lane => lane.familyIds),
    providerFamilies.map(family => family.id),
    "Provider feature families"
  );

  for (const lane of candidate.lanes) {
    exactSet(
      Object.keys(lane.stages ?? {}),
      requiredStages,
      `${lane.id} stages`
    );
    for (const stage of requiredStages) {
      assert(
        lane.stages[stage] === "proven",
        `${lane.id} stage ${stage} is not proven.`
      );
    }
    unique(lane.functions, `${lane.id} functions`);
    for (const familyId of lane.familyIds) {
      const family = providerFamilies.find(item => item.id === familyId);
      assert(
        family,
        `${lane.id} references unknown provider family ${familyId}.`
      );
      const readSelectors = family.selectors?.moodleReadFunctions ?? [];
      const writeSelectors =
        family.selectors?.moodleSandboxWriteFunctions ?? [];
      const expectedFunctions = [
        ...frozenReads.filter(item => selectorMatches(item, readSelectors)),
        ...frozenWrites.filter(item => selectorMatches(item, writeSelectors)),
      ];
      assert(
        expectedFunctions.length > 0,
        `${familyId} has no frozen Moodle functions.`
      );
      assert(
        expectedFunctions.every(item => lane.functions.includes(item)),
        `${lane.id} is missing functions owned by ${familyId}.`
      );
    }
  }

  const readLane = candidate.lanes.find(
    lane => lane.mode === "fixture_discovery_and_read_only"
  );
  const writeLane = candidate.lanes.find(
    lane => lane.mode === "synthetic_sandbox_write_only"
  );
  assert(readLane, "Read projection evidence lane is missing.");
  assert(writeLane, "Bounded write evidence lane is missing.");
  exactSet(readLane.functions, frozenReads, "Read lane functions");
  exactSet(writeLane.functions, frozenWrites, "Write lane functions");

  assert(
    readPassOne.ok === true && readPassTwo.ok === true,
    "Both Moodle read evidence passes must succeed."
  );
  assert(
    readPassOne.functionCount === 31 && readPassTwo.functionCount === 31,
    "Both Moodle read evidence passes must contain 31 functions."
  );
  assert(
    readPassOne.failed === 0 && readPassTwo.failed === 0,
    "Moodle read evidence cannot contain failures."
  );
  exactSet(
    Object.keys(readPassOne.fingerprints.functions),
    frozenReads,
    "Read pass one fingerprints"
  );
  exactSet(
    Object.keys(readPassTwo.fingerprints.functions),
    frozenReads,
    "Read pass two fingerprints"
  );
  assert(
    JSON.stringify(readPassOne.fingerprints.functions) ===
      JSON.stringify(readPassTwo.fingerprints.functions),
    "Moodle read function fingerprints are not deterministic."
  );
  assert(
    readPassOne.fingerprints.combined === readPassTwo.fingerprints.combined &&
      readPassOne.fingerprints.combined ===
        readLane.liveProof.combinedFingerprint,
    "Moodle read combined fingerprint does not match the manifest."
  );

  for (const artifact of candidate.evidenceArtifacts ?? []) {
    const artifactPath = path.join(root, artifact.path);
    assert(
      fs.existsSync(artifactPath),
      `Evidence artifact is missing: ${artifact.path}`
    );
    assert(
      sha256(artifactPath) === artifact.sha256,
      `Evidence artifact hash mismatch: ${artifact.path}`
    );
  }

  const readEvidence = fs
    .readFileSync(
      path.join(root, "docs/moodle-m2c-read-closure-evidence-20260716.md"),
      "utf8"
    )
    .replace(/\s+/g, " ");
  const writeEvidence = fs
    .readFileSync(
      path.join(root, "docs/moodle-m2b-write-proof-evidence-20260713.md"),
      "utf8"
    )
    .replace(/\s+/g, " ");
  for (const phrase of [
    "Two complete passes produced 31 successes, zero failures",
    "checked again as an absent no-op",
    "invalidtoken",
    "temporary local credential files",
  ]) {
    assert(
      readEvidence.includes(phrase),
      `Read closure evidence is missing: ${phrase}`
    );
  }
  for (const phrase of [
    "Ensure passes: `2`",
    "Final reconciliation reported all four targets absent",
    "invalidtoken",
    "without duplicates",
  ]) {
    assert(
      writeEvidence.includes(phrase),
      `Write proof evidence is missing: ${phrase}`
    );
  }

  const writeWorkflowTests = fs.readFileSync(
    path.join(
      root,
      "client/src/lib/moodle/server-moodle-sandbox-write-workflow.test.ts"
    ),
    "utf8"
  );
  for (const phrase of [
    "reconciles a mutation applied before timeout without duplicating it",
    "fails closed when an unknown outcome cannot be reconciled",
    "cleans up in dependency order",
  ]) {
    assert(
      writeWorkflowTests.includes(phrase),
      `Write workflow failure coverage is missing: ${phrase}`
    );
  }

  const denials = candidate.authorityDenials ?? {};
  for (const [name, status] of Object.entries(denials)) {
    assert(
      status === "blocked",
      `Authority denial ${name} must remain blocked.`
    );
  }
  assert(
    Object.keys(denials).length === 7,
    "All seven authority denials are required."
  );

  if (runNegativeControls) {
    const missingStage = structuredClone(candidate);
    delete missingStage.lanes[0].stages.cleanup;
    assertRejects(missingStage, "missing stage");

    const unexpectedFunction = structuredClone(candidate);
    unexpectedFunction.lanes[0].functions.push(
      "core_calendar_create_calendar_events"
    );
    assertRejects(unexpectedFunction, "unexpected function");

    const duplicateFamily = structuredClone(candidate);
    duplicateFamily.lanes[1].familyIds.push(
      duplicateFamily.lanes[0].familyIds[0]
    );
    assertRejects(duplicateFamily, "duplicate family");

    const productionWrite = structuredClone(candidate);
    productionWrite.productionWritesEnabled = true;
    assertRejects(productionWrite, "production write enabled");

    const missingDenial = structuredClone(candidate);
    delete missingDenial.authorityDenials.attendanceWriteback;
    assertRejects(missingDenial, "missing authority denial");
  }

  return {
    ok: true,
    lanes: candidate.lanes.length,
    featureFamilies: candidate.lanes.flatMap(lane => lane.familyIds).length,
    readFunctions: readLane.functions.length,
    sandboxWriteFunctions: writeLane.functions.length,
    lifecycleStages: requiredStages.length,
    authorityDenials: Object.keys(denials).length,
    negativeControls: 5,
    combinedReadFingerprint: readPassOne.fingerprints.combined,
  };
}

function assertRejects(candidate, label) {
  let rejected = false;
  try {
    validate(candidate, { runNegativeControls: false });
  } catch {
    rejected = true;
  }
  assert(rejected, `Negative control did not reject ${label}.`);
}

try {
  console.log(JSON.stringify(validate(readJson(manifestPath)), null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
