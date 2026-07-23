import type { PlatformWorkflowAction } from "../client/src/lib/domain/actions.js";

const moodleOwnedLearningActionTypes = new Set<PlatformWorkflowAction["type"]>([
  "lesson.start",
  "lesson.complete",
  "material.publish.update",
  "assignment.create",
  "assignment.update",
  "assignment.status.update",
  "assignment.submit",
  "assignment.grade",
  "quiz.create",
  "quiz.update",
  "quiz.status.update",
  "quiz.questions.set",
  "quiz.submit",
  "quiz.review",
  "question.create",
]);

export function isMoodleOwnedLearningAction(
  action: Pick<PlatformWorkflowAction, "type">
) {
  return moodleOwnedLearningActionTypes.has(action.type);
}

export const MOODLE_OWNED_LEARNING_ACTION_TYPES = Object.freeze(
  Array.from(moodleOwnedLearningActionTypes)
);
