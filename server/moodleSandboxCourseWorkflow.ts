import type {
  MoodleSandboxCourseClient,
  MoodleSandboxCourseInput,
} from "./moodleSandboxWriteClient";

export type MoodleSandboxCourseWorkflowClient = Pick<
  MoodleSandboxCourseClient,
  | "probe"
  | "findCourseByMarker"
  | "createCourse"
  | "updateCourse"
  | "deleteCourse"
>;

export type MoodleSandboxCourseEvidence = Readonly<{
  operation:
    | "probe"
    | "lookup"
    | "create"
    | "update"
    | "replay"
    | "delete"
    | "cleanup_verify";
  outcome:
    | "verified"
    | "absent"
    | "created"
    | "updated"
    | "adopted"
    | "reconciled"
    | "removed"
    | "failed";
  pass?: 1 | 2;
  courseId?: number;
}>;

export type MoodleSandboxCourseWorkflowResult = Readonly<{
  outcome: "completed";
  ensurePasses: 2;
  cleanup: "absent";
  evidence: readonly MoodleSandboxCourseEvidence[];
}>;

export class MoodleSandboxCourseWorkflowError extends Error {
  constructor(
    readonly code:
      | "configuration"
      | "probe_failed"
      | "ambiguous_state"
      | "write_failed"
      | "verification_failed"
      | "cleanup_failed",
    readonly evidence: readonly MoodleSandboxCourseEvidence[]
  ) {
    super(`Moodle sandbox course workflow failed (${code}).`);
    this.name = "MoodleSandboxCourseWorkflowError";
  }
}

function retryable(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return false;
  return ["timeout", "remote", "invalid_response"].includes(
    String((error as { code?: unknown }).code)
  );
}

export async function runMoodleSandboxCourseWorkflow({
  client,
  course,
}: {
  client: MoodleSandboxCourseWorkflowClient;
  course: MoodleSandboxCourseInput;
}): Promise<MoodleSandboxCourseWorkflowResult> {
  const evidence: MoodleSandboxCourseEvidence[] = [];
  let primaryError: MoodleSandboxCourseWorkflowError | undefined;
  let courseId: number | undefined;
  let probeVerified = false;

  if (
    !course.marker ||
    !course.fullName ||
    !course.updatedFullName ||
    !course.shortName
  ) {
    throw new MoodleSandboxCourseWorkflowError("configuration", evidence);
  }

  const find = async () => {
    const found = await client.findCourseByMarker(course.marker);
    if (found && courseId !== undefined && found.id !== courseId) {
      throw new MoodleSandboxCourseWorkflowError("ambiguous_state", evidence);
    }
    if (found) courseId = found.id;
    return found;
  };

  const create = async () => {
    try {
      const created = await client.createCourse(course);
      courseId = created.id;
      evidence.push({
        operation: "create",
        outcome: "created",
        pass: 1,
        courseId,
      });
    } catch (error) {
      if (!retryable(error)) throw error;
      const reconciled = await find();
      if (reconciled) {
        evidence.push({
          operation: "create",
          outcome: "reconciled",
          pass: 1,
          courseId: reconciled.id,
        });
        return;
      }
      const created = await client.createCourse(course);
      courseId = created.id;
      evidence.push({
        operation: "create",
        outcome: "created",
        pass: 1,
        courseId,
      });
    }
  };

  const update = async () => {
    if (!courseId) {
      throw new MoodleSandboxCourseWorkflowError(
        "verification_failed",
        evidence
      );
    }
    try {
      await client.updateCourse({ ...course, courseId });
    } catch (error) {
      if (!retryable(error)) throw error;
      const reconciled = await find();
      if (reconciled?.fullName === course.updatedFullName) {
        evidence.push({
          operation: "update",
          outcome: "reconciled",
          pass: 1,
          courseId,
        });
        return;
      }
      await client.updateCourse({ ...course, courseId });
    }
    const verified = await find();
    if (verified?.fullName !== course.updatedFullName) {
      throw new MoodleSandboxCourseWorkflowError(
        "verification_failed",
        evidence
      );
    }
    evidence.push({
      operation: "update",
      outcome: "updated",
      pass: 1,
      courseId,
    });
  };

  const cleanup = async () => {
    const found = await find();
    if (!found) {
      evidence.push({ operation: "cleanup_verify", outcome: "absent" });
      return;
    }
    try {
      await client.deleteCourse({ marker: course.marker, courseId: found.id });
    } catch (error) {
      if (!retryable(error)) throw error;
      const reconciled = await client.findCourseByMarker(course.marker);
      if (!reconciled) {
        evidence.push({
          operation: "delete",
          outcome: "reconciled",
          courseId: found.id,
        });
        evidence.push({ operation: "cleanup_verify", outcome: "absent" });
        return;
      }
      await client.deleteCourse({
        marker: course.marker,
        courseId: reconciled.id,
      });
    }
    if (await client.findCourseByMarker(course.marker)) {
      throw new MoodleSandboxCourseWorkflowError("cleanup_failed", evidence);
    }
    evidence.push({
      operation: "delete",
      outcome: "removed",
      courseId: found.id,
    });
    evidence.push({ operation: "cleanup_verify", outcome: "absent" });
  };

  try {
    let probe: Awaited<ReturnType<MoodleSandboxCourseWorkflowClient["probe"]>>;
    try {
      probe = await client.probe();
    } catch {
      throw new MoodleSandboxCourseWorkflowError("probe_failed", evidence);
    }
    if (!probe.minimumPrivilegeVerified) {
      throw new MoodleSandboxCourseWorkflowError("probe_failed", evidence);
    }
    probeVerified = true;
    evidence.push({ operation: "probe", outcome: "verified" });

    const existing = await find();
    evidence.push({
      operation: "lookup",
      outcome: existing ? "adopted" : "absent",
      pass: 1,
      ...(existing ? { courseId: existing.id } : {}),
    });
    if (!existing) await create();
    const created = await find();
    if (!created) {
      throw new MoodleSandboxCourseWorkflowError(
        "verification_failed",
        evidence
      );
    }
    if (created.fullName !== course.updatedFullName) await update();

    const replay = await find();
    if (!replay || replay.fullName !== course.updatedFullName) {
      throw new MoodleSandboxCourseWorkflowError(
        "verification_failed",
        evidence
      );
    }
    evidence.push({
      operation: "replay",
      outcome: "adopted",
      pass: 2,
      courseId: replay.id,
    });
  } catch (error) {
    primaryError =
      error instanceof MoodleSandboxCourseWorkflowError
        ? error
        : new MoodleSandboxCourseWorkflowError("write_failed", evidence);
    evidence.push({
      operation: probeVerified ? "lookup" : "probe",
      outcome: "failed",
    });
  }

  if (!probeVerified && primaryError) {
    throw new MoodleSandboxCourseWorkflowError(primaryError.code, evidence);
  }

  try {
    await cleanup();
    await cleanup();
  } catch {
    throw new MoodleSandboxCourseWorkflowError("cleanup_failed", evidence);
  }

  if (primaryError) {
    throw new MoodleSandboxCourseWorkflowError(primaryError.code, evidence);
  }

  return {
    outcome: "completed",
    ensurePasses: 2,
    cleanup: "absent",
    evidence,
  };
}
