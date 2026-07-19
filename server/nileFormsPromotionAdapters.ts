import crypto from "node:crypto";

import {
  applyCreateSupportTicket,
  applySubmitAttendanceException,
  type PlatformWorkflowAction,
} from "../client/src/lib/domain/actions.js";
import type { PlatformState } from "../client/src/lib/domain/types.js";
import type { ServerSession } from "./auth.js";
import { getPlatformStateRepository } from "./platformRepository.js";
import { applyPlatformLearningAction } from "./platformState.js";
import type { FormPromotion, FormSubmission } from "../shared/nileForms.js";

function answerText(submission: FormSubmission, fieldId: string) {
  const value = submission.answers[fieldId];
  return typeof value === "string" ? value.trim() : "";
}

function answerBoolean(submission: FormSubmission, fieldId: string) {
  return submission.answers[fieldId] === true;
}

function promotionSourceKey(
  adapter: FormPromotion["adapter"],
  submissionId: string
) {
  return `nile_form:${adapter}:${submissionId}`;
}

function commandId(adapter: FormPromotion["adapter"], submissionId: string) {
  return `form_command_${adapter.replaceAll(".", "_")}_${submissionId}`;
}

async function applyInternalCompatibilityCommand<T>(
  mutate: (state: PlatformState) => {
    entityType: string;
    entityId: string;
    result: T;
  }
) {
  const repository = getPlatformStateRepository();
  const snapshot = await repository.readSnapshot();
  const state = snapshot.state;
  const result = mutate(state);
  await repository.writeSnapshot(state);
  return result;
}

export async function executeNileFormPromotion(
  adapter: FormPromotion["adapter"],
  submission: FormSubmission,
  session: ServerSession
) {
  const sourceKey = promotionSourceKey(adapter, submission.id);
  if (adapter === "lead.create") {
    const action: PlatformWorkflowAction = {
      type: "lead.create",
      fullName: answerText(submission, "full_name"),
      email: answerText(submission, "email"),
      phone: answerText(submission, "phone"),
      subject: answerText(submission, "course_interest"),
      notes: answerText(submission, "notes"),
      source: "trial_form",
      sourceKey,
    };
    const applied = await applyPlatformLearningAction(action, session);
    return {
      commandId: commandId(adapter, submission.id),
      entityType: applied.result.entityType,
      entityId: applied.result.entityId,
    };
  }

  if (adapter === "application.create") {
    const action: PlatformWorkflowAction = {
      type: "application.create",
      fullName: answerText(submission, "full_name"),
      email: answerText(submission, "email"),
      phone: answerText(submission, "phone"),
      branchId:
        answerText(submission, "preferred_branch") || submission.branchId || "",
      courseInterest: answerText(submission, "course_interest"),
      schedulePreference: answerText(submission, "schedule_preference"),
      notes: answerText(submission, "goals"),
      source: "website",
      sourceKey,
    };
    const applied = await applyPlatformLearningAction(action, session);
    return {
      commandId: commandId(adapter, submission.id),
      entityType: applied.result.entityType,
      entityId: applied.result.entityId,
    };
  }

  if (adapter === "placement.create") {
    const action: PlatformWorkflowAction = {
      type: "placement.create",
      fullName: answerText(submission, "full_name"),
      email: answerText(submission, "email"),
      phone: answerText(submission, "phone"),
      subject: answerText(submission, "course_interest"),
      preferredDate: answerText(submission, "preferred_date"),
      currentLevel: answerText(submission, "current_level"),
      branchId: submission.branchId,
      sourceKey,
    };
    const applied = await applyPlatformLearningAction(action, session);
    return {
      commandId: commandId(adapter, submission.id),
      entityType: applied.result.entityType,
      entityId: applied.result.entityId,
    };
  }

  if (adapter === "support_ticket.create") {
    if (!submission.respondentUserId) {
      throw new Error(
        "Support promotion requires an authenticated respondent."
      );
    }
    const applied = await applyInternalCompatibilityCommand(state => {
      const ticket = applyCreateSupportTicket(
        state,
        {
          requesterId: submission.respondentUserId!,
          subject: answerText(submission, "subject"),
          details: answerText(submission, "details"),
          category: answerText(submission, "category"),
          priority: answerBoolean(submission, "urgent") ? "high" : "normal",
          actorId: session.userId,
          sourceKey,
        },
        {
          createId: prefix =>
            `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`,
          now: () => new Date().toISOString(),
        }
      );
      return {
        entityType: "SupportTicket",
        entityId: ticket.id,
        result: ticket,
      };
    });
    return {
      commandId: commandId(adapter, submission.id),
      entityType: applied.entityType,
      entityId: applied.entityId,
    };
  }

  if (!submission.respondentUserId) {
    throw new Error(
      "Attendance promotion requires an authenticated respondent."
    );
  }
  const applied = await applyInternalCompatibilityCommand(state => {
    const student = state.students.find(
      item => item.userId === submission.respondentUserId
    );
    if (!student)
      throw new Error("Attendance respondent has no student profile.");
    const request = applySubmitAttendanceException(
      state,
      {
        attendanceRecordId: answerText(submission, "attendance_record"),
        reason: answerText(submission, "reason"),
        studentId: student.id,
        actorId: submission.respondentUserId,
        sourceKey,
      },
      {
        createId: prefix =>
          `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`,
        now: () => new Date().toISOString(),
      }
    );
    return {
      entityType: "AttendanceExceptionRequest",
      entityId: request.id,
      result: request,
    };
  });
  return {
    commandId: commandId(adapter, submission.id),
    entityType: applied.entityType,
    entityId: applied.entityId,
  };
}
