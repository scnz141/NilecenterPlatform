import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const freezePath = path.join(root, "docs", "integration-feature-freeze.json");
const matrixPath = path.join(root, "docs", "integration-ownership-matrix.json");
const surfaces = [
  "clientRoutes",
  "workflowActions",
  "serverApiRoutes",
  "moodleReadFunctions",
  "moodleSandboxWriteFunctions",
];
const allowedNileAuthorities = new Set([
  "canonical_writable",
  "compatibility_gateway",
  "none",
  "read_model_only",
  "read_only_projection",
  "session_projection",
]);
const allowedMoodleAuthorities = new Set([
  "canonical_writable",
  "none",
  "sandbox_test_only",
]);
const frozenRoles = new Set([
  "public",
  "student",
  "teacher",
  "registrar",
  "headofdepartment",
  "branchadmin",
  "superadmin",
  "integration_test_operator",
]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function clone(value) {
  return structuredClone(value);
}

function compileSelector(pattern, familyId, surface, errors) {
  try {
    return new RegExp(pattern);
  } catch (error) {
    errors.push(
      `${familyId}.${surface} has invalid regular expression ${JSON.stringify(pattern)}: ${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
}

export function validateOwnership(freeze, matrix) {
  const errors = [];
  const coverage = Object.fromEntries(
    surfaces.map(surface => [surface, new Map()])
  );
  const families = Array.isArray(matrix.featureFamilies)
    ? matrix.featureFamilies
    : [];
  if (families.length === 0) errors.push("featureFamilies must not be empty");

  const familyIds = new Set();
  const compiledFamilies = [];
  for (const family of families) {
    if (!family?.id || typeof family.id !== "string") {
      errors.push("every feature family requires a string id");
      continue;
    }
    if (familyIds.has(family.id))
      errors.push(`duplicate family id: ${family.id}`);
    familyIds.add(family.id);

    for (const field of [
      "name",
      "nileLearnAuthority",
      "moodleAuthority",
      "projectionDirection",
      "externalId",
      "conflictRule",
      "auditOwner",
      "failureBehavior",
      "futureWriteStatus",
    ]) {
      if (typeof family[field] !== "string" || family[field].trim() === "") {
        errors.push(`${family.id}.${field} must be a non-empty string`);
      }
    }
    if (!allowedNileAuthorities.has(family.nileLearnAuthority)) {
      errors.push(
        `${family.id}.nileLearnAuthority is unsupported: ${family.nileLearnAuthority}`
      );
    }
    if (!allowedMoodleAuthorities.has(family.moodleAuthority)) {
      errors.push(
        `${family.id}.moodleAuthority is unsupported: ${family.moodleAuthority}`
      );
    }
    if (
      !matrix.policy?.allowedProjectionDirections?.includes(
        family.projectionDirection
      ) ||
      /bidirectional|shared|dual/i.test(family.projectionDirection)
    ) {
      errors.push(
        `${family.id}.projectionDirection is not an approved one-way direction: ${family.projectionDirection}`
      );
    }
    if (
      family.nileLearnAuthority === "canonical_writable" &&
      family.moodleAuthority === "canonical_writable"
    ) {
      errors.push(`${family.id} declares two writable authorities`);
    }
    if (
      !Array.isArray(family.permittedRoles) ||
      family.permittedRoles.length === 0
    ) {
      errors.push(`${family.id}.permittedRoles must not be empty`);
    } else {
      for (const role of family.permittedRoles) {
        if (!frozenRoles.has(role)) {
          errors.push(
            `${family.id}.permittedRoles contains unknown role: ${role}`
          );
        }
      }
    }

    const selectors = {};
    for (const surface of surfaces) {
      const patterns = family.selectors?.[surface] ?? [];
      if (!Array.isArray(patterns)) {
        errors.push(`${family.id}.selectors.${surface} must be an array`);
        selectors[surface] = [];
        continue;
      }
      selectors[surface] = patterns
        .map(pattern => compileSelector(pattern, family.id, surface, errors))
        .filter(Boolean);
    }
    compiledFamilies.push({ id: family.id, selectors });
  }

  const protectedSurface = freeze.protectedSurface ?? {};
  for (const surface of surfaces) {
    const items = protectedSurface[surface];
    if (!Array.isArray(items)) {
      errors.push(`freeze protectedSurface.${surface} must be an array`);
      continue;
    }
    for (const item of items) {
      const matches = compiledFamilies
        .filter(family =>
          family.selectors[surface].some(selector => selector.test(item))
        )
        .map(family => family.id);
      coverage[surface].set(item, matches);
      if (matches.length === 0) errors.push(`unmapped ${surface}: ${item}`);
      if (matches.length > 1) {
        errors.push(
          `ambiguous ${surface}: ${item} matched ${matches.join(", ")}`
        );
      }
    }
  }

  for (const family of compiledFamilies) {
    for (const surface of surfaces) {
      const frozenItems = protectedSurface[surface] ?? [];
      for (const selector of family.selectors[surface]) {
        if (!frozenItems.some(item => selector.test(item))) {
          errors.push(
            `dead selector ${family.id}.${surface}: ${selector.source}`
          );
        }
      }
    }
  }

  return { errors, coverage, familyCount: families.length };
}

function assertNegativeControl(name, mutate, expectedPattern, freeze, matrix) {
  const nextFreeze = clone(freeze);
  const nextMatrix = clone(matrix);
  mutate(nextFreeze, nextMatrix);
  const result = validateOwnership(nextFreeze, nextMatrix);
  if (!result.errors.some(error => expectedPattern.test(error))) {
    throw new Error(
      `negative control ${name} did not produce ${expectedPattern}: ${result.errors.join(" | ")}`
    );
  }
}

function run() {
  const freeze = readJson(freezePath);
  const matrix = readJson(matrixPath);
  const result = validateOwnership(freeze, matrix);
  if (result.errors.length > 0) {
    console.error("Integration ownership validation failed:");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }

  assertNegativeControl(
    "unmapped route",
    nextFreeze =>
      nextFreeze.protectedSurface.clientRoutes.push("/app/qa/unmapped"),
    /unmapped clientRoutes/,
    freeze,
    matrix
  );
  assertNegativeControl(
    "unmapped action",
    nextFreeze =>
      nextFreeze.protectedSurface.workflowActions.push("qa.unmapped"),
    /unmapped workflowActions/,
    freeze,
    matrix
  );
  assertNegativeControl(
    "unmapped Moodle function",
    nextFreeze =>
      nextFreeze.protectedSurface.moodleReadFunctions.push("qa_unmapped_read"),
    /unmapped moodleReadFunctions/,
    freeze,
    matrix
  );
  assertNegativeControl(
    "ambiguous mapping",
    (_nextFreeze, nextMatrix) => {
      nextMatrix.featureFamilies[1].selectors.clientRoutes.push("^/$");
    },
    /ambiguous clientRoutes/,
    freeze,
    matrix
  );
  assertNegativeControl(
    "bidirectional projection",
    (_nextFreeze, nextMatrix) => {
      nextMatrix.featureFamilies[0].projectionDirection = "bidirectional";
    },
    /not an approved one-way direction/,
    freeze,
    matrix
  );

  const counts = Object.fromEntries(
    surfaces.map(surface => [
      surface,
      freeze.protectedSurface[surface]?.length ?? 0,
    ])
  );
  const digest = crypto
    .createHash("sha256")
    .update(fs.readFileSync(matrixPath))
    .digest("hex");
  console.log(
    JSON.stringify(
      {
        ok: true,
        familyCount: result.familyCount,
        counts,
        negativeControls: 5,
        matrixSha256: digest,
      },
      null,
      2
    )
  );
}

run();
