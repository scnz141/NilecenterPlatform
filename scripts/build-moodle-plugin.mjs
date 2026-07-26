import crypto from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "integrations/moodle/local_nilelearn");
const output = path.join(root, "output/moodle-plugin");
const stage = path.join(output, "stage");
const archive = path.join(output, "local_nilelearn-0.2.0.zip");
const digestFile = `${archive}.sha256`;
const packageDirectory = "nilelearn";
const fixedTime = new Date("2026-07-23T00:00:00.000Z");

if (!existsSync(source)) throw new Error("Moodle plugin source is missing.");
rmSync(stage, { recursive: true, force: true });
mkdirSync(path.join(stage, packageDirectory), { recursive: true });
cpSync(source, path.join(stage, packageDirectory), {
  recursive: true,
  filter: sourcePath =>
    ![".DS_Store", "__MACOSX"].includes(path.basename(sourcePath)),
});

function normalizeTree(directory) {
  const entries = readdirSync(directory).sort();
  for (const entry of entries) {
    const target = path.join(directory, entry);
    const stats = statSync(target);
    if (stats.isDirectory()) {
      normalizeTree(target);
      chmodSync(target, 0o755);
    } else {
      chmodSync(target, 0o644);
    }
    utimesSync(target, fixedTime, fixedTime);
  }
  utimesSync(directory, fixedTime, fixedTime);
}

normalizeTree(stage);
rmSync(archive, { force: true });
const zip = spawnSync(
  "zip",
  ["-X", "-q", "-r", archive, packageDirectory],
  { cwd: stage, encoding: "utf8" }
);
if (zip.status !== 0) {
  throw new Error(zip.stderr || "Unable to build Moodle plugin ZIP.");
}
const digest = crypto
  .createHash("sha256")
  .update(readFileSync(archive))
  .digest("hex");
writeFileSync(digestFile, `${digest}  ${path.basename(archive)}\n`, "utf8");
rmSync(stage, { recursive: true, force: true });
console.log(JSON.stringify({ archive, sha256: digest }, null, 2));
