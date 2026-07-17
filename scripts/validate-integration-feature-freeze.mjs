import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import process from "node:process";
import ts from "typescript";

const root = process.cwd();
const manifestPath = path.join(root, "docs", "integration-feature-freeze.json");
const writeMode = process.argv.includes("--write");

function fail(message) {
  console.error(`Integration feature freeze failed: ${message}`);
  process.exitCode = 1;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function parseSource(relativePath) {
  const filePath = path.join(root, relativePath);
  return {
    filePath,
    source: ts.createSourceFile(
      filePath,
      fs.readFileSync(filePath, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      relativePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    ),
  };
}

function sortedUnique(values) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function propertyName(node) {
  if (!node) return "";
  if (ts.isIdentifier(node) || ts.isStringLiteral(node)) return node.text;
  return node.getText();
}

function collectStringLiteralUnion(relativePath, aliasNames) {
  const { source } = parseSource(relativePath);
  const values = [];

  function collectTypeDiscriminants(node) {
    if (
      ts.isPropertySignature(node) &&
      propertyName(node.name) === "type" &&
      node.type &&
      ts.isLiteralTypeNode(node.type) &&
      ts.isStringLiteral(node.type.literal)
    ) {
      values.push(node.type.literal.text);
    }
    ts.forEachChild(node, collectTypeDiscriminants);
  }

  function visit(node) {
    if (
      ts.isTypeAliasDeclaration(node) &&
      aliasNames.includes(node.name.text)
    ) {
      if (aliasNames.length === 1 && aliasNames[0] === "Role") {
        const collectRole = child => {
          if (
            ts.isLiteralTypeNode(child) &&
            ts.isStringLiteral(child.literal)
          ) {
            values.push(child.literal.text);
          }
          ts.forEachChild(child, collectRole);
        };
        collectRole(node.type);
      } else {
        collectTypeDiscriminants(node.type);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
  return sortedUnique(values);
}

function unwrapExpression(node) {
  let current = node;
  while (
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isParenthesizedExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function collectConstStringArray(relativePath, constName) {
  const { source } = parseSource(relativePath);
  const values = [];

  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === constName
    ) {
      const initializer = node.initializer
        ? unwrapExpression(node.initializer)
        : undefined;
      if (!initializer || !ts.isArrayLiteralExpression(initializer)) {
        throw new Error(`${constName} must remain a literal string array.`);
      }
      for (const element of initializer.elements) {
        const value = unwrapExpression(element);
        if (!ts.isStringLiteralLike(value)) {
          throw new Error(`${constName} contains a non-literal entry.`);
        }
        values.push(value.text);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
  if (values.length === 0) throw new Error(`Could not find ${constName}.`);
  return sortedUnique(values);
}

function normalizedRouteExpression(expression, source) {
  const value = unwrapExpression(expression);
  if (ts.isStringLiteralLike(value)) return value.text;
  if (ts.isTemplateExpression(value)) {
    return `expression:${value.getText(source).replace(/\s+/g, " ")}`;
  }
  return undefined;
}

function collectClientRoutes() {
  const { source } = parseSource("client/src/App.tsx");
  const routes = [];
  const formsRoleRoutes = [];

  function objectProperty(object, name) {
    const property = object.properties.find(
      candidate =>
        ts.isPropertyAssignment(candidate) &&
        propertyName(candidate.name) === name
    );
    return property && ts.isPropertyAssignment(property)
      ? unwrapExpression(property.initializer)
      : undefined;
  }

  function collectFormsRoleRoutes(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "formsRoleRoutes" &&
      node.initializer
    ) {
      const initializer = unwrapExpression(node.initializer);
      if (!ts.isArrayLiteralExpression(initializer)) {
        throw new Error("formsRoleRoutes must remain a literal array.");
      }
      for (const element of initializer.elements) {
        const value = unwrapExpression(element);
        if (!ts.isObjectLiteralExpression(value)) {
          throw new Error("formsRoleRoutes contains a non-literal entry.");
        }
        const prefix = objectProperty(value, "prefix");
        const role = objectProperty(value, "role");
        const manage = objectProperty(value, "manage");
        if (
          !prefix ||
          !ts.isStringLiteralLike(prefix) ||
          !role ||
          !ts.isStringLiteralLike(role) ||
          !manage ||
          (manage.kind !== ts.SyntaxKind.TrueKeyword &&
            manage.kind !== ts.SyntaxKind.FalseKeyword)
        ) {
          throw new Error(
            "formsRoleRoutes must declare literal prefix, role, and manage values."
          );
        }
        formsRoleRoutes.push({
          prefix: prefix.text,
          role: role.text,
          manage: manage.kind === ts.SyntaxKind.TrueKeyword,
        });
      }
    }
    ts.forEachChild(node, collectFormsRoleRoutes);
  }

  collectFormsRoleRoutes(source);

  function expandFormsRoute(attribute, expression) {
    const value = unwrapExpression(expression);
    if (!ts.isTemplateExpression(value)) return false;
    const text = value.getText(source);
    if (!text.includes("${route.prefix}/forms")) return false;
    const suffix = text.slice(1, -1).replace("${route.prefix}", "");
    let manageOnly = false;
    let superadminOnly = false;
    for (let parent = attribute.parent; parent; parent = parent.parent) {
      if (
        ts.isCallExpression(parent) &&
        parent.getText(source).includes("formsRoleRoutes.map")
      ) {
        break;
      }
      if (ts.isBinaryExpression(parent)) {
        const condition = parent.left.getText(source).replace(/\s+/g, " ");
        if (condition === "route.manage") manageOnly = true;
        if (condition.includes('route.role === "superadmin"')) {
          superadminOnly = true;
        }
      }
      if (ts.isConditionalExpression(parent)) {
        const condition = parent.condition.getText(source).replace(/\s+/g, " ");
        if (condition === "route.manage") manageOnly = true;
        if (condition.includes('route.role === "superadmin"')) {
          superadminOnly = true;
        }
      }
    }
    for (const route of formsRoleRoutes) {
      if (manageOnly && !route.manage) continue;
      if (superadminOnly && route.role !== "superadmin") continue;
      routes.push(`${route.prefix}${suffix}`);
    }
    return true;
  }

  function visit(node) {
    if (
      ts.isJsxAttribute(node) &&
      propertyName(node.name) === "path" &&
      node.initializer
    ) {
      if (ts.isStringLiteral(node.initializer))
        routes.push(node.initializer.text);
      if (ts.isJsxExpression(node.initializer) && node.initializer.expression) {
        if (expandFormsRoute(node, node.initializer.expression)) {
          ts.forEachChild(node, visit);
          return;
        }
        const value = normalizedRouteExpression(
          node.initializer.expression,
          source
        );
        if (value) routes.push(value);
      }
    }

    if (
      ts.isPropertyAssignment(node) &&
      propertyName(node.name) === "path" &&
      ts.isStringLiteralLike(unwrapExpression(node.initializer))
    ) {
      routes.push(unwrapExpression(node.initializer).text);
    }

    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "map"
    ) {
      const sourceArray = unwrapExpression(node.expression.expression);
      if (ts.isArrayLiteralExpression(sourceArray)) {
        const callbackText = node.arguments
          .map(argument => argument.getText(source))
          .join(" ");
        if (callbackText.includes("<Route")) {
          for (const element of sourceArray.elements) {
            const value = unwrapExpression(element);
            if (ts.isStringLiteralLike(value)) routes.push(value.text);
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(source);
  return sortedUnique(routes);
}

function sourceFilesUnder(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  return entries.flatMap(entry => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFilesUnder(target);
    return /\.(ts|tsx)$/.test(entry.name) ? [target] : [];
  });
}

function collectServerApiRoutes() {
  const routes = [];
  const methods = new Set(["get", "post", "put", "patch", "delete"]);

  for (const filePath of sourceFilesUnder(path.join(root, "server"))) {
    const source = ts.createSourceFile(
      filePath,
      fs.readFileSync(filePath, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    );
    function visit(node) {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) &&
        node.expression.expression.text === "app" &&
        methods.has(node.expression.name.text) &&
        node.arguments[0] &&
        ts.isStringLiteralLike(unwrapExpression(node.arguments[0])) &&
        unwrapExpression(node.arguments[0]).text.startsWith("/api/")
      ) {
        routes.push(
          `${node.expression.name.text.toUpperCase()} ${unwrapExpression(node.arguments[0]).text}`
        );
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }

  return sortedUnique(routes);
}

function collectProtectedSurface() {
  const learningActions = collectStringLiteralUnion(
    "client/src/lib/domain/actions.ts",
    ["PlatformLearningAction"]
  );
  const workflowActions = collectStringLiteralUnion(
    "client/src/lib/domain/actions.ts",
    ["PlatformWorkflowAction"]
  );
  return {
    roles: collectStringLiteralUnion("client/src/lib/platformData.ts", [
      "Role",
    ]),
    clientRoutes: collectClientRoutes(),
    workflowActions: sortedUnique([...learningActions, ...workflowActions]),
    serverApiRoutes: collectServerApiRoutes(),
    moodleReadFunctions: collectConstStringArray(
      "server/moodleClient.ts",
      "MOODLE_READ_FUNCTIONS"
    ),
    moodleSandboxWriteFunctions: collectConstStringArray(
      "server/moodleSandboxWriteClient.ts",
      "MOODLE_SANDBOX_WRITE_FUNCTIONS"
    ),
  };
}

function compareSurface(expected, actual) {
  const differences = [];
  for (const key of Object.keys(actual)) {
    const expectedValues = expected[key] ?? [];
    const actualValues = actual[key] ?? [];
    const added = actualValues.filter(value => !expectedValues.includes(value));
    const removed = expectedValues.filter(
      value => !actualValues.includes(value)
    );
    if (added.length || removed.length)
      differences.push({ key, added, removed });
  }
  return differences;
}

function assertQaBaseline(manifest) {
  const qa = manifest.approvedBaseline?.portalQa;
  if (!qa?.attestation)
    throw new Error("The tracked portal QA attestation is not declared.");
  const attestationPath = path.join(root, qa.attestation);
  if (!fs.existsSync(attestationPath)) {
    throw new Error(`Portal QA attestation is missing: ${qa.attestation}`);
  }
  const attestation = readJson(attestationPath);
  if (
    attestation.totalChecks !== qa.totalChecks ||
    attestation.failedChecks !== qa.failedChecks ||
    attestation.artifactSha256 !== qa.artifactSha256 ||
    attestation.inProgress !== false ||
    attestation.interrupted !== false
  ) {
    throw new Error(
      "The tracked portal QA attestation does not match the approved baseline."
    );
  }
  if (!qa.artifact) return;
  const artifactPath = path.join(root, qa.artifact);
  if (!fs.existsSync(artifactPath)) {
    console.warn(
      `Portal QA artifact is not present locally; verified tracked attestation ${qa.attestation}.`
    );
    return;
  }
  const artifact = fs.readFileSync(artifactPath);
  const artifactHash = crypto
    .createHash("sha256")
    .update(artifact)
    .digest("hex");
  if (artifactHash !== qa.artifactSha256) {
    throw new Error(`Portal QA artifact hash mismatch for ${qa.artifact}.`);
  }
  const summary = JSON.parse(artifact.toString("utf8"));
  const totalChecks = summary.totalChecks ?? summary.checks?.length ?? 0;
  const failedChecks = summary.failedChecks ?? summary.failures?.length ?? 0;
  if (totalChecks !== qa.totalChecks || failedChecks !== qa.failedChecks) {
    throw new Error(
      `Portal QA evidence mismatch: expected ${qa.totalChecks}/${qa.failedChecks}, found ${totalChecks}/${failedChecks}.`
    );
  }
}

try {
  const manifest = readJson(manifestPath);
  const actual = collectProtectedSurface();

  if (writeMode) {
    manifest.protectedSurface = actual;
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(
      `Updated ${path.relative(root, manifestPath)} from current source declarations.`
    );
    process.exit(0);
  }

  assertQaBaseline(manifest);
  const differences = compareSurface(manifest.protectedSurface ?? {}, actual);
  if (differences.length) {
    for (const difference of differences) {
      if (difference.added.length) {
        console.error(
          `${difference.key} added: ${difference.added.join(", ")}`
        );
      }
      if (difference.removed.length) {
        console.error(
          `${difference.key} removed: ${difference.removed.join(", ")}`
        );
      }
    }
    fail(
      "the protected integration surface changed without an approved manifest update."
    );
  }

  const selfTestAddition = structuredClone(actual);
  selfTestAddition.roles.push("__freeze_self_test__");
  const selfTestRemoval = structuredClone(actual);
  selfTestRemoval.roles = selfTestRemoval.roles.slice(1);
  if (
    compareSurface(manifest.protectedSurface, selfTestAddition).length === 0 ||
    compareSurface(manifest.protectedSurface, selfTestRemoval).length === 0
  ) {
    throw new Error(
      "Feature-freeze negative self-test did not detect a protected-surface change."
    );
  }

  console.log(
    `Integration feature freeze passed: ${actual.roles.length} roles, ${actual.clientRoutes.length} route signatures, ${actual.workflowActions.length} workflow actions, ${actual.serverApiRoutes.length} API routes, ${actual.moodleReadFunctions.length} Moodle reads, ${actual.moodleSandboxWriteFunctions.length} sandbox writes, portal QA 1,598/0.`
  );
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
