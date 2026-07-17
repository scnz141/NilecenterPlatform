#!/usr/bin/env node

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { accessSync, constants as fsConstants, existsSync } from "node:fs";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  unlink,
  utimes,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const FIXTURE_MARKERS = Object.freeze({
  h5p: "NILE-M2CR-H5P-TRUEFALSE-V1",
  scorm: "NILE-M2CR-SCORM12-V1",
});

export const H5P_TITLE = "Nile Learn M2C-R TrueFalse Fixture";
export const SCORM_TITLE = "Nile Learn M2C-R SCORM 1.2 Fixture";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
export const OUTPUT_ROOT = path.join(
  REPOSITORY_ROOT,
  "output",
  "moodle-fixtures",
  "m2c-r"
);

const FIXED_ARCHIVE_DATE = new Date("2000-01-01T00:00:00.000Z");
const SYSTEM_ZIP_CANDIDATES = ["/usr/bin/zip", "/bin/zip"];
const H5P_MAJOR_ENV = "MOODLE_FIXTURE_H5P_TRUEFALSE_MAJOR_VERSION";
const H5P_MINOR_ENV = "MOODLE_FIXTURE_H5P_TRUEFALSE_MINOR_VERSION";
const BUILD_NAME_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const VERSION_PATTERN = /^[1-9][0-9]{0,2}$/;

const SCORM_MANIFEST = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${FIXTURE_MARKERS.scorm}" version="1.0"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="NILE_M2CR_ORG">
    <organization identifier="NILE_M2CR_ORG">
      <title>${SCORM_TITLE}</title>
      <item identifier="NILE_M2CR_ITEM" identifierref="NILE_M2CR_SCO">
        <title>${SCORM_TITLE}</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="NILE_M2CR_SCO" type="webcontent" adlcp:scormtype="sco" href="index.html">
      <file href="index.html" />
      <file href="scorm.js" />
    </resource>
  </resources>
</manifest>
`;

const SCORM_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${SCORM_TITLE}</title>
    <style>
      body { font-family: sans-serif; margin: 2rem; color: #1b1f23; }
      main { max-width: 38rem; }
      button { min-height: 2.75rem; padding: 0.6rem 1rem; }
      #status { margin-top: 1rem; white-space: pre-wrap; }
      .success { color: #176b36; }
      .error { color: #a11b1b; }
    </style>
    <script src="scorm.js" defer></script>
  </head>
  <body>
    <main>
      <h1>${SCORM_TITLE}</h1>
      <p>${FIXTURE_MARKERS.scorm}</p>
      <button type="button" onclick="completeFixture()">Complete fixture</button>
      <p id="status" role="status" aria-live="polite">READY: ${FIXTURE_MARKERS.scorm}</p>
    </main>
  </body>
</html>
`;

const SCORM_SCRIPT = `(function () {
  "use strict";

  var marker = "${FIXTURE_MARKERS.scorm}";

  function setStatus(kind, message) {
    var status = document.getElementById("status");
    status.className = kind;
    status.textContent = message;
  }

  function findApi(startWindow) {
    var current = startWindow;
    var attempts = 0;

    while (current && attempts < 20) {
      try {
        if (current.API) return current.API;
        if (current.parent === current) break;
        current = current.parent;
      } catch (_error) {
        break;
      }
      attempts += 1;
    }

    return null;
  }

  function requireSuccess(value, operation) {
    if (String(value).toLowerCase() !== "true") {
      throw new Error(operation + " failed");
    }
  }

  function completeFixture() {
    var api = findApi(window);
    var currentOperation = "SCORM operation";
    var initialized = false;

    if (!api && window.opener) api = findApi(window.opener);
    if (!api) {
      setStatus("error", "ERROR: " + marker + " SCORM 1.2 API unavailable.");
      return false;
    }

    try {
      currentOperation = "LMSInitialize";
      requireSuccess(api.LMSInitialize(""), "LMSInitialize");
      initialized = true;
      currentOperation = "score min";
      requireSuccess(api.LMSSetValue("cmi.core.score.min", "0"), "score min");
      currentOperation = "score max";
      requireSuccess(api.LMSSetValue("cmi.core.score.max", "100"), "score max");
      currentOperation = "score raw";
      requireSuccess(api.LMSSetValue("cmi.core.score.raw", "100"), "score raw");
      currentOperation = "lesson status";
      requireSuccess(api.LMSSetValue("cmi.core.lesson_status", "completed"), "lesson status");
      currentOperation = "session time";
      requireSuccess(api.LMSSetValue("cmi.core.session_time", "0000:01:00"), "session time");
      currentOperation = "LMSCommit";
      requireSuccess(api.LMSCommit(""), "LMSCommit");
      initialized = false;
      currentOperation = "LMSFinish";
      requireSuccess(api.LMSFinish(""), "LMSFinish");
      setStatus("success", "SUCCESS: " + marker + " completed.");
      return true;
    } catch (_error) {
      if (initialized) {
        try {
          api.LMSFinish("");
        } catch (_finishError) {
          // The controlled error below remains deterministic.
        }
      }
      setStatus("error", "ERROR: " + marker + " " + currentOperation + " failed.");
      return false;
    }
  }

  window.completeFixture = completeFixture;
})();
`;

function usage() {
  return `Usage:
  node scripts/moodle-fixtures/generate-m2cr-fixtures.mjs \\
    --h5p-major <positive integer> \\
    --h5p-minor <positive integer> \\
    [--build-name <name>]

Environment alternative:
  ${H5P_MAJOR_ENV}=<positive integer>
  ${H5P_MINOR_ENV}=<positive integer>

The H5P library version has no default. CLI values override environment values.
All generated files stay under output/moodle-fixtures/m2c-r/<build-name>/.`;
}

function optionValue(argv, index, option) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requires a value.`);
  }
  return value;
}

function parsePositiveVersion(rawValue, label) {
  const value = typeof rawValue === "string" ? rawValue.trim() : "";
  if (!VERSION_PATTERN.test(value)) {
    throw new Error(`${label} must be a base-10 integer from 1 through 999.`);
  }
  return Number(value);
}

function parseBuildName(rawValue) {
  const value = typeof rawValue === "string" ? rawValue.trim() : "";
  if (!BUILD_NAME_PATTERN.test(value) || value === "." || value === "..") {
    throw new Error(
      "--build-name must be 1-64 lowercase letters, digits, dots, underscores, or hyphens and must start with a letter or digit."
    );
  }
  return value;
}

export function parseArguments(argv, environment = process.env) {
  const values = new Map();

  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    if (option === "--help" || option === "-h") return { help: true };
    if (!["--h5p-major", "--h5p-minor", "--build-name"].includes(option)) {
      throw new Error(`Unknown argument: ${option}`);
    }
    if (values.has(option))
      throw new Error(`${option} may be supplied only once.`);
    values.set(option, optionValue(argv, index, option));
    index += 1;
  }

  return {
    help: false,
    h5pMajorVersion: parsePositiveVersion(
      values.get("--h5p-major") ?? environment[H5P_MAJOR_ENV],
      "H5P TrueFalse major version"
    ),
    h5pMinorVersion: parsePositiveVersion(
      values.get("--h5p-minor") ?? environment[H5P_MINOR_ENV],
      "H5P TrueFalse minor version"
    ),
    buildName: parseBuildName(values.get("--build-name") ?? "current"),
  };
}

export function validateSystemZip(zipPath) {
  try {
    accessSync(zipPath, fsConstants.X_OK);
  } catch {
    throw new Error(`System zip is not executable at ${zipPath}.`);
  }

  const environment = { ...process.env, TZ: "UTC" };
  const versionResult = spawnSync(zipPath, ["-v"], {
    encoding: "utf8",
    env: environment,
  });
  const versionOutput = `${versionResult.stdout ?? ""}\n${versionResult.stderr ?? ""}`;
  if (
    versionResult.error ||
    versionResult.status !== 0 ||
    !/Info-ZIP/i.test(versionOutput)
  ) {
    throw new Error(
      "System zip must be the Info-ZIP command-line implementation."
    );
  }

  const helpResult = spawnSync(zipPath, ["-h"], {
    encoding: "utf8",
    env: environment,
  });
  const helpOutput = `${helpResult.stdout ?? ""}\n${helpResult.stderr ?? ""}`;
  if (helpResult.error || helpResult.status !== 0) {
    throw new Error("System zip help probe failed.");
  }
  for (const flag of ["-X", "-0", "-D"]) {
    if (!helpOutput.includes(flag)) {
      throw new Error(
        `System zip does not support required deterministic flag ${flag}.`
      );
    }
  }

  return zipPath;
}

function resolveSystemZip() {
  const zipPath = SYSTEM_ZIP_CANDIDATES.find(candidate =>
    existsSync(candidate)
  );
  if (!zipPath) {
    throw new Error(
      "System Info-ZIP was not found at /usr/bin/zip or /bin/zip."
    );
  }
  return validateSystemZip(zipPath);
}

function assertInsideOutputRoot(targetPath) {
  const relativePath = path.relative(OUTPUT_ROOT, targetPath);
  if (
    relativePath === "" ||
    relativePath === ".." ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error("Fixture output escaped the gitignored output root.");
  }
}

async function writeNormalizedFile(filePath, contents) {
  assertInsideOutputRoot(filePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, contents, { encoding: "utf8", mode: 0o644 });
  await chmod(filePath, 0o644);
  await utimes(filePath, FIXED_ARCHIVE_DATE, FIXED_ARCHIVE_DATE);
}

async function removeIfPresent(filePath) {
  try {
    await unlink(filePath);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

function runZip(zipPath, workingDirectory, archivePath, entries) {
  const result = spawnSync(
    zipPath,
    ["-X", "-0", "-D", "-q", archivePath, ...entries],
    {
      cwd: workingDirectory,
      encoding: "utf8",
      env: { ...process.env, COPYFILE_DISABLE: "1", TZ: "UTC" },
    }
  );

  if (result.error || result.status !== 0) {
    throw new Error("System zip failed while creating a fixture archive.");
  }
}

async function sha256(filePath) {
  return createHash("sha256")
    .update(await readFile(filePath))
    .digest("hex");
}

function relativeOutputPath(filePath) {
  return path.relative(REPOSITORY_ROOT, filePath).split(path.sep).join("/");
}

function h5pFiles(h5pMajorVersion, h5pMinorVersion) {
  const manifest = {
    title: H5P_TITLE,
    language: "en",
    mainLibrary: "H5P.TrueFalse",
    embedTypes: ["iframe"],
    license: "U",
    preloadedDependencies: [
      {
        machineName: "H5P.TrueFalse",
        majorVersion: h5pMajorVersion,
        minorVersion: h5pMinorVersion,
      },
    ],
  };
  const content = {
    question: `<p>${FIXTURE_MARKERS.h5p}: This synthetic fixture statement is true.</p>`,
    correct: "true",
    behaviour: {
      enableRetry: true,
      enableSolutionsButton: true,
      enableCheckButton: true,
      confirmCheckDialog: false,
      confirmRetryDialog: false,
      autoCheck: false,
    },
  };

  return {
    "h5p.json": `${JSON.stringify(manifest, null, 2)}\n`,
    "content/content.json": `${JSON.stringify(content, null, 2)}\n`,
  };
}

async function createArchive({
  zipPath,
  stagingRoot,
  targetDirectory,
  outputName,
  files,
}) {
  const packageRoot = await mkdtemp(path.join(stagingRoot, "package-"));
  const entries = Object.keys(files);

  for (const entry of entries) {
    await writeNormalizedFile(path.join(packageRoot, entry), files[entry]);
  }

  const temporaryArchive = path.join(
    targetDirectory,
    `.${outputName}.partial.zip`
  );
  const finalArchive = path.join(targetDirectory, outputName);
  assertInsideOutputRoot(temporaryArchive);
  assertInsideOutputRoot(finalArchive);
  await removeIfPresent(temporaryArchive);
  await removeIfPresent(finalArchive);
  runZip(zipPath, packageRoot, temporaryArchive, entries);
  await chmod(temporaryArchive, 0o644);
  await rename(temporaryArchive, finalArchive);
  await utimes(finalArchive, FIXED_ARCHIVE_DATE, FIXED_ARCHIVE_DATE);

  return {
    path: relativeOutputPath(finalArchive),
    sha256: await sha256(finalArchive),
  };
}

export async function generateFixtures({
  h5pMajorVersion,
  h5pMinorVersion,
  buildName = "current",
}) {
  const majorVersion = parsePositiveVersion(
    String(h5pMajorVersion),
    "H5P TrueFalse major version"
  );
  const minorVersion = parsePositiveVersion(
    String(h5pMinorVersion),
    "H5P TrueFalse minor version"
  );
  const safeBuildName = parseBuildName(buildName);
  const zipPath = resolveSystemZip();
  const targetDirectory = path.join(OUTPUT_ROOT, safeBuildName);
  assertInsideOutputRoot(targetDirectory);
  await mkdir(targetDirectory, { recursive: true });
  const stagingRoot = await mkdtemp(path.join(OUTPUT_ROOT, ".staging-"));

  try {
    const scorm = await createArchive({
      zipPath,
      stagingRoot,
      targetDirectory,
      outputName: "nile-m2cr-scorm-12.zip",
      files: {
        "imsmanifest.xml": SCORM_MANIFEST,
        "index.html": SCORM_HTML,
        "scorm.js": SCORM_SCRIPT,
      },
    });
    const h5p = await createArchive({
      zipPath,
      stagingRoot,
      targetDirectory,
      outputName: "nile-m2cr-truefalse.h5p",
      files: h5pFiles(majorVersion, minorVersion),
    });

    return {
      marker: "NILE-M2CR-FIXTURES-V1",
      outputDirectory: relativeOutputPath(targetDirectory),
      h5pLibrary: {
        machineName: "H5P.TrueFalse",
        majorVersion,
        minorVersion,
      },
      packages: { scorm, h5p },
    };
  } finally {
    await rm(stagingRoot, { recursive: true, force: true });
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  const result = await generateFixtures(options);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

const isMain =
  typeof process.argv[1] === "string" &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  main().catch(error => {
    const message =
      error instanceof Error ? error.message : "Unknown fixture error.";
    process.stderr.write(`M2C-R fixture generation failed: ${message}\n`);
    process.exitCode = 1;
  });
}
