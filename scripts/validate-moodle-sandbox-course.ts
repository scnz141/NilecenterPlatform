import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  createMoodleSandboxCourseClientFromEnvironment,
  isMoodleSandboxCourseMarker,
  MOODLE_SANDBOX_COURSE_ACK,
  MOODLE_SANDBOX_WRITE_HOST,
} from "../server/moodleSandboxWriteClient";
import {
  MoodleSandboxCourseWorkflowError,
  runMoodleSandboxCourseWorkflow,
} from "../server/moodleSandboxCourseWorkflow";

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function createMarker(now = new Date()) {
  const configured = clean(process.env.MOODLE_SANDBOX_COURSE_RUN_MARKER);
  if (configured) {
    if (!isMoodleSandboxCourseMarker(configured)) {
      throw new Error("configuration");
    }
    return configured;
  }
  const timestamp = now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
  return `NILE-M2CC-${timestamp}-${randomBytes(4).toString("hex")}`;
}

function validateEnvironment() {
  const url = new URL(clean(process.env.MOODLE_SANDBOX_COURSE_BASE_URL));
  const service = clean(process.env.MOODLE_SANDBOX_COURSE_SERVICE);
  const token = clean(process.env.MOODLE_SANDBOX_COURSE_TOKEN);
  const categoryId = Number(process.env.MOODLE_SANDBOX_COURSE_CATEGORY_ID);
  if (
    process.env.MOODLE_SANDBOX_COURSE_ENABLED !== "1" ||
    process.env.MOODLE_SANDBOX_COURSE_SYNTHETIC_ACK !==
      MOODLE_SANDBOX_COURSE_ACK ||
    url.protocol !== "https:" ||
    url.hostname !== MOODLE_SANDBOX_WRITE_HOST ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !service ||
    !token ||
    service === clean(process.env.MOODLE_SERVICE) ||
    service === clean(process.env.MOODLE_SANDBOX_WRITE_SERVICE) ||
    token === clean(process.env.MOODLE_TOKEN) ||
    token === clean(process.env.MOODLE_SANDBOX_WRITE_TOKEN) ||
    !Number.isSafeInteger(categoryId) ||
    categoryId <= 0
  ) {
    throw new Error("configuration");
  }
}

export async function runMoodleSandboxCourseValidation() {
  validateEnvironment();
  const marker = createMarker();
  const client = createMoodleSandboxCourseClientFromEnvironment();
  const course = {
    marker,
    fullName: `Nile Learn Synthetic Course ${marker}`,
    updatedFullName: `Nile Learn Verified Course ${marker}`,
    shortName: `NILE-${marker}`,
    summary: `Synthetic provider-contract fixture ${marker}.`,
  };
  const startedAt = new Date().toISOString();
  const workflow = await runMoodleSandboxCourseWorkflow({ client, course });
  return {
    ok: true as const,
    mode: "synthetic_sandbox_course_proof" as const,
    sandboxHost: MOODLE_SANDBOX_WRITE_HOST,
    marker,
    startedAt,
    completedAt: new Date().toISOString(),
    workflow,
  };
}

async function main() {
  try {
    process.stdout.write(
      `${JSON.stringify(await runMoodleSandboxCourseValidation(), null, 2)}\n`
    );
  } catch (error) {
    const code =
      error instanceof MoodleSandboxCourseWorkflowError
        ? `workflow:${error.code}`
        : error instanceof Error && error.message === "configuration"
          ? "configuration"
          : "provider_or_unexpected";
    process.stdout.write(
      `${JSON.stringify(
        {
          ok: false,
          mode: "synthetic_sandbox_course_proof",
          sandboxHost: MOODLE_SANDBOX_WRITE_HOST,
          errorCode: code,
          ...(error instanceof MoodleSandboxCourseWorkflowError
            ? { evidence: error.evidence }
            : {}),
        },
        null,
        2
      )}\n`
    );
    process.exitCode = 1;
  }
}

const entry = process.argv[1];
if (entry && pathToFileURL(resolve(entry)).href === import.meta.url) {
  void main();
}
