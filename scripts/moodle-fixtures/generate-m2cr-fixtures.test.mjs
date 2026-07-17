import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import test, { after, before, describe } from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

import {
  FIXTURE_MARKERS,
  H5P_TITLE,
  OUTPUT_ROOT,
  SCORM_TITLE,
  validateSystemZip,
} from "./generate-m2cr-fixtures.mjs";

const TEST_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(TEST_DIRECTORY, "../..");
const GENERATOR = path.join(TEST_DIRECTORY, "generate-m2cr-fixtures.mjs");
const BUILD_A = `test-${process.pid}-a`;
const BUILD_B = `test-${process.pid}-b`;
const BUILD_ENV = `test-${process.pid}-env`;
const GENERATED_DIRECTORIES = [BUILD_A, BUILD_B, BUILD_ENV].map(name =>
  path.join(OUTPUT_ROOT, name)
);

function cleanGeneratorEnvironment(overrides = {}) {
  return {
    ...process.env,
    MOODLE_FIXTURE_H5P_TRUEFALSE_MAJOR_VERSION: "",
    MOODLE_FIXTURE_H5P_TRUEFALSE_MINOR_VERSION: "",
    ...overrides,
  };
}

function runGenerator(argumentsList, environment = {}) {
  return spawnSync(process.execPath, [GENERATOR, ...argumentsList], {
    cwd: REPOSITORY_ROOT,
    encoding: "utf8",
    env: cleanGeneratorEnvironment(environment),
  });
}

function sha256(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

function readZipEntries(archive) {
  let endOffset = -1;
  const minimumOffset = Math.max(0, archive.length - 65_557);
  for (let offset = archive.length - 22; offset >= minimumOffset; offset -= 1) {
    if (archive.readUInt32LE(offset) === 0x06054b50) {
      endOffset = offset;
      break;
    }
  }
  assert.notEqual(endOffset, -1, "ZIP end-of-central-directory record missing");

  const entryCount = archive.readUInt16LE(endOffset + 10);
  let centralOffset = archive.readUInt32LE(endOffset + 16);
  const entries = new Map();

  for (let index = 0; index < entryCount; index += 1) {
    assert.equal(archive.readUInt32LE(centralOffset), 0x02014b50);
    const method = archive.readUInt16LE(centralOffset + 10);
    const compressedSize = archive.readUInt32LE(centralOffset + 20);
    const uncompressedSize = archive.readUInt32LE(centralOffset + 24);
    const nameLength = archive.readUInt16LE(centralOffset + 28);
    const extraLength = archive.readUInt16LE(centralOffset + 30);
    const commentLength = archive.readUInt16LE(centralOffset + 32);
    const localOffset = archive.readUInt32LE(centralOffset + 42);
    const name = archive
      .subarray(centralOffset + 46, centralOffset + 46 + nameLength)
      .toString("utf8");

    assert.equal(archive.readUInt32LE(localOffset), 0x04034b50);
    const localNameLength = archive.readUInt16LE(localOffset + 26);
    const localExtraLength = archive.readUInt16LE(localOffset + 28);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = archive.subarray(
      dataOffset,
      dataOffset + compressedSize
    );
    assert.equal(method, 0, `${name} must use deterministic stored entries`);
    assert.equal(
      extraLength,
      0,
      `${name} must not contain central extra fields`
    );
    assert.equal(
      localExtraLength,
      0,
      `${name} must not contain local extra fields`
    );
    const contents = Buffer.from(compressed);

    assert.equal(contents.length, uncompressedSize);
    assert.equal(entries.has(name), false, `Duplicate ZIP entry ${name}`);
    entries.set(name, contents);
    centralOffset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

function packagePath(result, packageName) {
  return path.join(REPOSITORY_ROOT, result.packages[packageName].path);
}

function runScormScript(source, api) {
  const status = { className: "", textContent: "" };
  const window = { API: api, opener: null };
  window.parent = window;
  const context = vm.createContext({
    document: {
      getElementById(id) {
        assert.equal(id, "status");
        return status;
      },
    },
    Error,
    String,
    window,
  });
  vm.runInContext(source, context, { filename: "scorm.js" });
  return { complete: window.completeFixture, status };
}

let resultA;
let resultB;
let scormEntries;
let h5pEntries;

before(async () => {
  await Promise.all(
    GENERATED_DIRECTORIES.map(directory =>
      rm(directory, { recursive: true, force: true })
    )
  );

  const first = runGenerator([
    "--h5p-major",
    "1",
    "--h5p-minor",
    "8",
    "--build-name",
    BUILD_A,
  ]);
  assert.equal(first.status, 0, first.stderr);
  resultA = JSON.parse(first.stdout);

  const second = runGenerator([
    "--h5p-major",
    "1",
    "--h5p-minor",
    "8",
    "--build-name",
    BUILD_B,
  ]);
  assert.equal(second.status, 0, second.stderr);
  resultB = JSON.parse(second.stdout);

  scormEntries = readZipEntries(await readFile(packagePath(resultA, "scorm")));
  h5pEntries = readZipEntries(await readFile(packagePath(resultA, "h5p")));
});

after(async () => {
  await Promise.all(
    GENERATED_DIRECTORIES.map(directory =>
      rm(directory, { recursive: true, force: true })
    )
  );
});

describe("M2C-R deterministic Moodle fixture generator", () => {
  test("creates exact root archive entries without wrappers or metadata files", () => {
    assert.deepEqual(
      [...scormEntries.keys()],
      ["imsmanifest.xml", "index.html", "scorm.js"]
    );
    assert.deepEqual(
      [...h5pEntries.keys()],
      ["h5p.json", "content/content.json"]
    );

    for (const name of [...scormEntries.keys(), ...h5pEntries.keys()]) {
      assert.equal(name.startsWith("/"), false);
      assert.equal(name.split("/").includes(".."), false);
      assert.equal(name.includes(".DS_Store"), false);
    }
  });

  test("produces byte-identical packages and matching SHA-256 evidence", async () => {
    for (const packageName of ["scorm", "h5p"]) {
      const first = await readFile(packagePath(resultA, packageName));
      const second = await readFile(packagePath(resultB, packageName));
      assert.deepEqual(first, second);
      assert.equal(sha256(first), resultA.packages[packageName].sha256);
      assert.equal(
        resultA.packages[packageName].sha256,
        resultB.packages[packageName].sha256
      );
    }
  });

  test("requires explicit bounded H5P versions from CLI or environment", () => {
    for (const invalid of ["0", "-1", "1.5", "001", "1000", "text"]) {
      const result = runGenerator(["--h5p-major", invalid, "--h5p-minor", "8"]);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /integer from 1 through 999/);
    }

    const missing = runGenerator([]);
    assert.notEqual(missing.status, 0);
    assert.match(missing.stderr, /major version/);

    const escapedOutput = runGenerator([
      "--h5p-major",
      "1",
      "--h5p-minor",
      "8",
      "--build-name",
      "../outside",
    ]);
    assert.notEqual(escapedOutput.status, 0);
    assert.match(escapedOutput.stderr, /--build-name/);

    const fromEnvironment = runGenerator(["--build-name", BUILD_ENV], {
      MOODLE_FIXTURE_H5P_TRUEFALSE_MAJOR_VERSION: "1",
      MOODLE_FIXTURE_H5P_TRUEFALSE_MINOR_VERSION: "8",
    });
    assert.equal(fromEnvironment.status, 0, fromEnvironment.stderr);
    const environmentResult = JSON.parse(fromEnvironment.stdout);
    assert.deepEqual(environmentResult.h5pLibrary, {
      machineName: "H5P.TrueFalse",
      majorVersion: 1,
      minorVersion: 8,
    });
  });

  test("builds a content-only H5P TrueFalse package with deterministic identity", () => {
    const manifest = JSON.parse(h5pEntries.get("h5p.json").toString("utf8"));
    const content = JSON.parse(
      h5pEntries.get("content/content.json").toString("utf8")
    );

    assert.equal(manifest.title, H5P_TITLE);
    assert.equal(manifest.mainLibrary, "H5P.TrueFalse");
    assert.deepEqual(manifest.embedTypes, ["iframe"]);
    assert.deepEqual(manifest.preloadedDependencies, [
      { machineName: "H5P.TrueFalse", majorVersion: 1, minorVersion: 8 },
    ]);
    assert.match(content.question, new RegExp(FIXTURE_MARKERS.h5p));
    assert.equal(content.correct, "true");
  });

  test("executes the required SCORM 1.2 completion calls in order", () => {
    const calls = [];
    const api = {
      LMSInitialize(value) {
        calls.push(["LMSInitialize", value]);
        return "true";
      },
      LMSSetValue(name, value) {
        calls.push(["LMSSetValue", name, value]);
        return "true";
      },
      LMSCommit(value) {
        calls.push(["LMSCommit", value]);
        return "true";
      },
      LMSFinish(value) {
        calls.push(["LMSFinish", value]);
        return "true";
      },
    };
    const { complete, status } = runScormScript(
      scormEntries.get("scorm.js").toString("utf8"),
      api
    );

    assert.equal(complete(), true);
    assert.deepEqual(calls, [
      ["LMSInitialize", ""],
      ["LMSSetValue", "cmi.core.score.min", "0"],
      ["LMSSetValue", "cmi.core.score.max", "100"],
      ["LMSSetValue", "cmi.core.score.raw", "100"],
      ["LMSSetValue", "cmi.core.lesson_status", "completed"],
      ["LMSSetValue", "cmi.core.session_time", "0000:01:00"],
      ["LMSCommit", ""],
      ["LMSFinish", ""],
    ]);
    assert.deepEqual(status, {
      className: "success",
      textContent: `SUCCESS: ${FIXTURE_MARKERS.scorm} completed.`,
    });

    const errorRun = runScormScript(
      scormEntries.get("scorm.js").toString("utf8"),
      null
    );
    assert.equal(errorRun.complete(), false);
    assert.deepEqual(errorRun.status, {
      className: "error",
      textContent: `ERROR: ${FIXTURE_MARKERS.scorm} SCORM 1.2 API unavailable.`,
    });

    const providerErrorRun = runScormScript(
      scormEntries.get("scorm.js").toString("utf8"),
      {
        LMSInitialize() {
          throw new Error("provider-private-error");
        },
      }
    );
    assert.equal(providerErrorRun.complete(), false);
    assert.deepEqual(providerErrorRun.status, {
      className: "error",
      textContent: `ERROR: ${FIXTURE_MARKERS.scorm} LMSInitialize failed.`,
    });
  });

  test("contains one completion button and valid SCORM 1.2 manifest markers", () => {
    const html = scormEntries.get("index.html").toString("utf8");
    const manifest = scormEntries.get("imsmanifest.xml").toString("utf8");
    assert.equal((html.match(/<button\b/g) ?? []).length, 1);
    assert.match(html, /onclick="completeFixture\(\)"/);
    assert.match(manifest, /<schemaversion>1\.2<\/schemaversion>/);
    assert.match(manifest, new RegExp(FIXTURE_MARKERS.scorm));
    assert.match(manifest, new RegExp(SCORM_TITLE.replace(".", "\\.")));
  });

  test("contains no personal identifiers or credential material", () => {
    const packageText = [...scormEntries.values(), ...h5pEntries.values()]
      .map(contents => contents.toString("utf8"))
      .join("\n");
    const forbidden = [
      /-----BEGIN [A-Z ]*PRIVATE KEY-----/i,
      /\b(?:password|passwd|secret|token|api[_ -]?key|authorization|bearer)\b/i,
      /\b(?:passport|national id|guardian|phone number|street address)\b/i,
      /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
      /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/,
    ];
    for (const pattern of forbidden) assert.doesNotMatch(packageText, pattern);
  });

  test("validates the required system Info-ZIP executable and ignored output path", () => {
    const systemZip = existsSync("/usr/bin/zip") ? "/usr/bin/zip" : "/bin/zip";
    assert.equal(validateSystemZip(systemZip), systemZip);
    assert.throws(
      () => validateSystemZip(path.join(OUTPUT_ROOT, "missing-zip")),
      /not executable/
    );

    const ignored = spawnSync(
      "git",
      ["check-ignore", "-q", "output/moodle-fixtures/m2c-r/probe.zip"],
      { cwd: REPOSITORY_ROOT }
    );
    assert.equal(ignored.status, 0);
    assert.match(resultA.outputDirectory, /^output\/moodle-fixtures\/m2c-r\//);
  });
});
