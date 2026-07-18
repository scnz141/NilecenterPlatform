import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  ListChecks,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import PendingMediaField, {
  PendingMediaSummary,
} from "@/components/platform/PendingMediaField";
import PlatformShell from "@/components/platform/PlatformShell";
import { DetailLayout } from "@/components/platform/PlatformLayouts";
import { StatusBadge } from "@/components/platform/PlatformPrimitives";
import {
  fetchPlatformStateRequest,
  runPlatformWorkflowActionRequest,
} from "@/lib/backend/api";
import { platformStore } from "@/lib/domain/store";
import type {
  PendingMediaAttachment,
  PlatformState,
  QuizQuestionPreview,
} from "@/lib/domain/types";
import { getDemoUser } from "@/lib/platformData";

type StudentAssessmentView = "assignment-detail" | "quiz-detail";

const PLATFORM_STATE_UPDATED_EVENT = "nilelearn:platform-state-updated";

const pageCopy: Record<
  StudentAssessmentView,
  { title: string; description: string; context: string }
> = {
  "assignment-detail": {
    title: "Assignment",
    description: "Submit one assignment and review teacher feedback.",
    context: "Student",
  },
  "quiz-detail": {
    title: "Quiz",
    description: "Complete one quiz attempt and review the result.",
    context: "Student",
  },
};

function formatDateTime(value?: string) {
  if (!value) return "Not submitted";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function readableStatus(value?: string) {
  if (!value) return "not started";
  return value.replace(/_/g, " ");
}

function statusTone(
  status?: string
): "green" | "amber" | "red" | "purple" | "slate" {
  if (!status) return "slate";
  if (["active", "completed", "approved", "issued"].includes(status)) {
    return "green";
  }
  if (["pending", "pending_approval", "draft"].includes(status)) {
    return "amber";
  }
  if (["paused", "rejected", "revoked", "overdue"].includes(status)) {
    return "red";
  }
  return "slate";
}

function mediaKindForSubmissionType(
  submissionType: PlatformState["assignments"][number]["submissionType"]
): PendingMediaAttachment["kind"] {
  if (submissionType === "audio") return "audio";
  if (submissionType === "video") return "video";
  return "document";
}

function getStudentScope(state: PlatformState) {
  const demoUser = getDemoUser("student");
  const student =
    state.students.find(item => item.userId === demoUser.id) ??
    state.students[0];
  return {
    student,
    studentId: student?.id ?? "stu_demo",
    user: demoUser,
  };
}

function sortBySubmittedAt<
  T extends { submittedAt?: string; startedAt?: string },
>(rows: T[]) {
  return [...rows].sort(
    (a, b) =>
      new Date(b.submittedAt ?? b.startedAt ?? 0).getTime() -
      new Date(a.submittedAt ?? a.startedAt ?? 0).getTime()
  );
}

function renderFact(label: string, value: string) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function renderQuestionMeta(question: QuizQuestionPreview) {
  return (
    <div>
      <small>{question.type.replace(/_/g, " ")}</small>
      <small>{question.difficulty}</small>
    </div>
  );
}

export default function StudentAssessmentPage({
  view,
  assignmentId,
  quizId,
}: {
  view: StudentAssessmentView;
  assignmentId?: string;
  quizId?: string;
}) {
  const copy = pageCopy[view];
  const [version, setVersion] = useState(0);
  const [savingAction, setSavingAction] = useState("");
  const [actionError, setActionError] = useState("");
  const [submissionText, setSubmissionText] = useState("");
  const [assignmentPendingMedia, setAssignmentPendingMedia] = useState<
    PendingMediaAttachment[]
  >([]);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizPendingMedia, setQuizPendingMedia] = useState<
    Record<string, PendingMediaAttachment[]>
  >({});

  const state = useMemo(() => platformStore.getState(), [version]);

  useEffect(() => {
    let cancelled = false;
    fetchPlatformStateRequest().then(result => {
      if (cancelled) return;
      if (result.ok && result.data) {
        platformStore.setState(result.data.state);
        setVersion(value => value + 1);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const syncLocalPlatformState = () => setVersion(value => value + 1);
    window.addEventListener(
      PLATFORM_STATE_UPDATED_EVENT,
      syncLocalPlatformState
    );
    return () => {
      window.removeEventListener(
        PLATFORM_STATE_UPDATED_EVENT,
        syncLocalPlatformState
      );
    };
  }, []);

  useEffect(() => {
    setSubmissionText("");
    setAssignmentPendingMedia([]);
    setActionError("");
  }, [assignmentId]);

  useEffect(() => {
    setQuizAnswers({});
    setQuizPendingMedia({});
    setActionError("");
  }, [quizId]);

  const { studentId } = getStudentScope(state);
  const assignment = assignmentId
    ? state.assignments.find(
        item =>
          item.id === assignmentId &&
          (item.status === "active" || item.status === "completed")
      )
    : undefined;
  const quiz = quizId
    ? state.quizzes.find(
        item =>
          item.id === quizId &&
          (item.status === "active" || item.status === "completed")
      )
    : undefined;
  const activeRun = state.courseRuns.find(
    run => run.id === (assignment?.courseRunId ?? quiz?.courseRunId)
  );
  const activeCourse = state.courses.find(
    item => item.id === activeRun?.courseId
  );
  const latestSubmission = assignment
    ? sortBySubmittedAt(
        state.assignmentSubmissions.filter(
          item =>
            item.assignmentId === assignment.id && item.studentId === studentId
        )
      )[0]
    : undefined;
  const assignmentGrade = assignment
    ? state.grades.find(
        item => item.itemId === assignment.id && item.studentId === studentId
      )
    : undefined;

  const quizAttempts = quiz
    ? sortBySubmittedAt(
        state.quizAttempts.filter(
          item => item.quizId === quiz.id && item.studentId === studentId
        )
      )
    : [];
  const latestAttempt = quizAttempts[0];
  const quizGrade = quiz
    ? state.grades.find(
        item => item.itemId === quiz.id && item.studentId === studentId
      )
    : undefined;
  const attemptsRemaining = Math.max(
    0,
    (quiz?.attemptsAllowed ?? 0) - quizAttempts.length
  );

  const quizQuestionPreviews =
    quiz?.questionIds.length && view === "quiz-detail"
      ? state.quizQuestionPreviews.filter(
          question =>
            question.quizId === quiz.id && question.status === "active"
        )
      : [];
  const quizHasSafeQuestionPreview = quizQuestionPreviews.length > 0;
  const quizHasAttachedQuestions = Boolean(quiz?.questionIds.length);
  const quizFallbackAnswer = quizAnswers.__fallback ?? "";
  const quizHasAnswer = quizHasSafeQuestionPreview
    ? quizQuestionPreviews.some(
        question =>
          (quizAnswers[question.id] ?? "").trim().length > 0 ||
          (quizPendingMedia[question.id]?.length ?? 0) > 0
      )
    : quizFallbackAnswer.trim().length > 0;

  const runWorkflowAction = async (
    actionLabel: string,
    payload: Parameters<typeof runPlatformWorkflowActionRequest>[0]
  ) => {
    setSavingAction(actionLabel);
    setActionError("");
    const result = await runPlatformWorkflowActionRequest(payload);
    setSavingAction("");
    if (!result.ok || !result.data) {
      const message = result.error ?? `${actionLabel} failed.`;
      setActionError(message);
      toast.error(`${actionLabel} failed`, { description: message });
      return null;
    }
    platformStore.setState(result.data.state);
    setVersion(value => value + 1);
    return result.data.result;
  };

  const submitAssignment = async () => {
    if (
      !assignment ||
      (!submissionText.trim() && assignmentPendingMedia.length === 0)
    ) {
      return;
    }
    const result = await runWorkflowAction("Assignment submission", {
      type: "assignment.submit",
      assignmentId: assignment.id,
      response: submissionText.trim(),
      pendingMedia: assignmentPendingMedia,
    });
    if (!result) return;
    setSubmissionText("");
    setAssignmentPendingMedia([]);
    toast.success("Assignment submitted");
  };

  const submitQuiz = async () => {
    if (!quiz || !quizHasAnswer || attemptsRemaining <= 0) return;
    const answers = quizHasSafeQuestionPreview
      ? Object.fromEntries(
          quizQuestionPreviews
            .map(question => [
              question.id,
              (quizAnswers[question.id] ?? "").trim() ||
                (quizPendingMedia[question.id]?.length
                  ? "Pending media attached"
                  : ""),
            ])
            .filter(([, answer]) => answer.length > 0)
        )
      : { q1: quizFallbackAnswer.trim() };
    const pendingMedia = Object.values(quizPendingMedia).flat();
    const result = await runWorkflowAction("Quiz attempt", {
      type: "quiz.submit",
      quizId: quiz.id,
      answers,
      pendingMedia,
    });
    if (!result) return;
    setQuizAnswers({});
    setQuizPendingMedia({});
    toast.success("Quiz attempt saved");
  };

  const setQuizQuestionAnswer = (questionId: string, value: string) => {
    setQuizAnswers(current => ({ ...current, [questionId]: value }));
  };

  const renderQuizQuestionInput = (question: QuizQuestionPreview) => {
    const value = quizAnswers[question.id] ?? "";
    if (question.type === "multiple_choice" || question.type === "true_false") {
      const choices =
        question.type === "true_false" && question.choices.length === 0
          ? ["True", "False"]
          : question.choices;
      return (
        <div
          className="platform-quiz-choice-grid"
          role="radiogroup"
          aria-label={question.prompt}
        >
          {choices.map(choice => (
            <button
              key={choice}
              type="button"
              className={value === choice ? "selected" : ""}
              onClick={() => setQuizQuestionAnswer(question.id, choice)}
            >
              <CheckCircle2 size={14} />
              {choice}
            </button>
          ))}
        </div>
      );
    }
    if (question.type === "oral_record" || question.type === "file_upload") {
      const mediaKind = question.type === "oral_record" ? "audio" : "document";
      const mediaItems = quizPendingMedia[question.id] ?? [];
      return (
        <div className="platform-quiz-media-answer">
          <PendingMediaField
            kind={mediaKind}
            label={
              question.type === "oral_record"
                ? "Audio response"
                : "File response"
            }
            description="Choose your file for this answer. Your school can enable online storage when it is ready."
            value={mediaItems}
            onChange={items => {
              setQuizPendingMedia(current => ({
                ...current,
                [question.id]: items,
              }));
              if (items.length && !value.trim()) {
                setQuizQuestionAnswer(question.id, "Pending media attached");
              }
              if (!items.length && value === "Pending media attached") {
                setQuizQuestionAnswer(question.id, "");
              }
            }}
          />
          <textarea
            aria-label={`${question.prompt} response note`}
            value={value === "Pending media attached" ? "" : value}
            onChange={event =>
              setQuizQuestionAnswer(question.id, event.target.value)
            }
            placeholder="Add a short note"
          />
        </div>
      );
    }
    return (
      <textarea
        aria-label={question.prompt}
        value={value}
        onChange={event =>
          setQuizQuestionAnswer(question.id, event.target.value)
        }
        placeholder="Write your response"
      />
    );
  };

  const assignmentMain = assignment ? (
    <div className="student-assessment-workspace student-assignment-workspace">
      <section className="student-assessment-status">
        <div className="student-assessment-status-copy">
          <span>
            <ClipboardCheck size={16} /> Assignment status
          </span>
          <h2>
            {assignment.status === "completed"
              ? "Assignment closed"
              : assignmentGrade
                ? "Teacher feedback"
                : latestSubmission
                  ? "Submission received"
                  : "Ready to submit"}
          </h2>
          <p>
            {assignment.status === "completed"
              ? latestSubmission
                ? "This assignment is closed. Review your submitted work and feedback below."
                : "This assignment is closed and no longer accepts submissions."
              : (assignmentGrade?.feedback ??
                latestSubmission?.feedback ??
                "Write your response and submit it when you are ready.")}
          </p>
        </div>
        <div className="student-assessment-status-meta">
          <StatusBadge
            tone={statusTone(
              assignment.status === "completed"
                ? "completed"
                : assignmentGrade
                  ? "completed"
                  : latestSubmission?.status
            )}
          >
            {assignment.status === "completed"
              ? "Closed"
              : assignmentGrade
                ? `${assignmentGrade.score}/${assignmentGrade.maxScore}`
                : readableStatus(latestSubmission?.status)}
          </StatusBadge>
          <dl>
            {renderFact("Due", formatDateTime(assignment.dueAt))}
            {renderFact("Format", assignment.submissionType)}
            {renderFact(
              "Last submitted",
              latestSubmission
                ? formatDateTime(latestSubmission.submittedAt)
                : "Not yet"
            )}
          </dl>
        </div>
      </section>
      {latestSubmission ? (
        <section
          className="student-assessment-response student-assessment-review"
          data-testid="student-assignment-review"
        >
          <header className="student-assessment-response-head">
            <div>
              <span>Latest submission</span>
              <h2>Submitted work</h2>
            </div>
            <StatusBadge tone={assignmentGrade ? "green" : "amber"}>
              {assignmentGrade
                ? `${assignmentGrade.score}/${assignmentGrade.maxScore}`
                : readableStatus(latestSubmission.status)}
            </StatusBadge>
          </header>
          <div className="student-assessment-review-grid">
            <div>
              <span>Your response</span>
              <p>{latestSubmission.response || "No written response."}</p>
              <PendingMediaSummary items={latestSubmission.pendingMedia} />
            </div>
            <div>
              <span>Teacher feedback</span>
              <p>
                {assignmentGrade?.feedback ??
                  latestSubmission.feedback ??
                  "Feedback has not been added yet."}
              </p>
            </div>
          </div>
        </section>
      ) : null}
      {assignment.status === "active" ? (
        <section className="student-assessment-response">
          <header className="student-assessment-response-head">
            <div>
              <span>Your response</span>
              <h2>Submit your work</h2>
            </div>
            <small>{assignment.title}</small>
          </header>
          {assignment.submissionType !== "text" ? (
            <PendingMediaField
              kind={mediaKindForSubmissionType(assignment.submissionType)}
              label={
                assignment.submissionType === "audio"
                  ? "Audio file"
                  : assignment.submissionType === "video"
                    ? "Video file"
                    : "Assignment file"
              }
              description="Choose the file for this submission. Online storage is enabled when your school connects a provider."
              value={assignmentPendingMedia}
              onChange={setAssignmentPendingMedia}
            />
          ) : null}
          <textarea
            aria-label="Assignment response"
            value={submissionText}
            onChange={event => setSubmissionText(event.target.value)}
            placeholder="Write your answer"
          />
          <button
            type="button"
            className="platform-primary-button"
            disabled={
              (!submissionText.trim() && assignmentPendingMedia.length === 0) ||
              savingAction === "Assignment submission"
            }
            onClick={submitAssignment}
          >
            <Send size={15} />
            {savingAction === "Assignment submission"
              ? "Submitting"
              : "Submit assignment"}
          </button>
        </section>
      ) : !latestSubmission ? (
        <section
          className="student-assessment-response student-assessment-response-closed"
          data-testid="student-assignment-closed"
        >
          <header className="student-assessment-response-head">
            <div>
              <span>Submission</span>
              <h2>Submission closed</h2>
            </div>
          </header>
          <p>This assignment closed before a response was submitted.</p>
        </section>
      ) : null}
    </div>
  ) : (
    <div className="platform-empty-state">
      <strong>Assignment not found</strong>
      <span>Open an assignment from your assignment list.</span>
      <Link className="platform-row-link" href="/app/student/assignments">
        Back to assignments
      </Link>
    </div>
  );

  const quizMain = quiz ? (
    <div className="student-assessment-workspace student-quiz-workspace">
      <section className="student-assessment-status">
        <div className="student-assessment-status-copy">
          <span>
            <Clock3 size={16} /> Quiz status
          </span>
          <h2>
            {quiz.status === "completed"
              ? "Quiz closed"
              : quizGrade
                ? "Result available"
                : latestAttempt
                  ? "Attempt received"
                  : "Ready to start"}
          </h2>
          <p>
            {quiz.status === "completed"
              ? latestAttempt
                ? "This quiz is closed. Review your saved attempt and result below."
                : "This quiz is closed and no longer accepts attempts."
              : (quizGrade?.feedback ??
                (latestAttempt
                  ? "Your attempt is saved for teacher review."
                  : "Answer the questions, then submit one attempt."))}
          </p>
        </div>
        <div className="student-assessment-status-meta">
          <StatusBadge
            tone={statusTone(
              quiz.status === "completed"
                ? "completed"
                : quizGrade
                  ? "completed"
                  : latestAttempt?.status
            )}
          >
            {quiz.status === "completed"
              ? "Closed"
              : quizGrade
                ? `${quizGrade.score}/${quizGrade.maxScore}`
                : latestAttempt
                  ? `${latestAttempt.score}/${latestAttempt.maxScore}`
                  : `${attemptsRemaining} left`}
          </StatusBadge>
          <dl>
            {renderFact("Due", formatDateTime(quiz.dueAt))}
            {renderFact("Time", `${quiz.durationMinutes} min`)}
            {renderFact(
              "Last submitted",
              latestAttempt
                ? formatDateTime(latestAttempt.submittedAt)
                : "Not yet"
            )}
          </dl>
        </div>
      </section>

      {latestAttempt ? (
        <section
          className="student-assessment-response student-assessment-review"
          data-testid="student-quiz-review"
        >
          <header className="student-assessment-response-head">
            <div>
              <span>Latest attempt</span>
              <h2>Saved result</h2>
            </div>
            <StatusBadge tone={quizGrade ? "green" : "amber"}>
              {quizGrade
                ? `${quizGrade.score}/${quizGrade.maxScore}`
                : `${latestAttempt.score}/${latestAttempt.maxScore}`}
            </StatusBadge>
          </header>
          <div className="student-assessment-review-grid">
            <div>
              <span>Your answers</span>
              <div className="student-assessment-answer-list">
                {Object.entries(latestAttempt.answers).map(
                  ([questionId, answer], index) => {
                    const question = quizQuestionPreviews.find(
                      item => item.id === questionId
                    );
                    return (
                      <div key={questionId}>
                        <strong>
                          {question?.prompt ?? `Answer ${index + 1}`}
                        </strong>
                        <p>{answer || "No answer recorded."}</p>
                      </div>
                    );
                  }
                )}
              </div>
              <PendingMediaSummary items={latestAttempt.pendingMedia} />
            </div>
            <div>
              <span>Teacher feedback</span>
              <p>{quizGrade?.feedback ?? "Feedback has not been added yet."}</p>
            </div>
          </div>
        </section>
      ) : null}

      {quiz.status === "active" ? (
        <section className="student-assessment-response">
          <header className="student-assessment-response-head">
            <div>
              <span>
                <ListChecks size={16} /> Questions
              </span>
              <h2>{quiz.title}</h2>
            </div>
            <small>{quizQuestionPreviews.length || 1} question(s)</small>
          </header>
          {quizHasSafeQuestionPreview ? (
            <div className="student-quiz-question-list">
              {quizQuestionPreviews.map((question, index) => (
                <article key={question.id} className="student-quiz-question">
                  <div className="student-quiz-question-head">
                    <span>Question {index + 1}</span>
                    {renderQuestionMeta(question)}
                  </div>
                  <strong>{question.prompt}</strong>
                  {question.tags.length ? (
                    <div className="student-quiz-tags">
                      {question.tags.slice(0, 3).map(tag => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </div>
                  ) : null}
                  {renderQuizQuestionInput(question)}
                </article>
              ))}
            </div>
          ) : quizHasAttachedQuestions ? (
            <div className="platform-empty-state">
              <strong>No questions available</strong>
              <span>This quiz is not ready for your course yet.</span>
            </div>
          ) : (
            <div className="platform-inline-form">
              <label>
                Short answer
                <input
                  value={quizFallbackAnswer}
                  onChange={event =>
                    setQuizAnswers({ __fallback: event.target.value })
                  }
                />
              </label>
            </div>
          )}
          <button
            type="button"
            className="platform-primary-button"
            disabled={
              !quizHasAnswer ||
              attemptsRemaining <= 0 ||
              savingAction === "Quiz attempt"
            }
            onClick={submitQuiz}
          >
            {attemptsRemaining <= 0
              ? "Attempts used"
              : savingAction === "Quiz attempt"
                ? "Submitting"
                : "Submit attempt"}
          </button>
        </section>
      ) : !latestAttempt ? (
        <section
          className="student-assessment-response student-assessment-closed"
          data-testid="student-quiz-closed"
        >
          <header className="student-assessment-response-head">
            <div>
              <span>
                <ListChecks size={16} /> Submission closed
              </span>
              <h2>Review your result</h2>
            </div>
          </header>
          <p>This quiz closed before an attempt was submitted.</p>
        </section>
      ) : null}
    </div>
  ) : (
    <div className="platform-empty-state">
      <strong>Quiz not found</strong>
      <span>Open a quiz from your quiz list.</span>
      <Link className="platform-row-link" href="/app/student/quizzes">
        Back to quizzes
      </Link>
    </div>
  );

  return (
    <PlatformShell role="student" title={copy.title}>
      <DetailLayout
        className={`student-assessment-page student-assessment-${view}`}
        title={
          view === "assignment-detail"
            ? (assignment?.title ?? copy.title)
            : (quiz?.title ?? copy.title)
        }
        description={copy.description}
        context={activeCourse?.title ?? "Course"}
        actions={
          <Link
            className="platform-secondary-button"
            href={
              view === "assignment-detail"
                ? "/app/student/assignments"
                : "/app/student/quizzes"
            }
          >
            Back to {view === "assignment-detail" ? "assignments" : "quizzes"}
          </Link>
        }
        main={
          <>
            {actionError ? (
              <div className="platform-empty-state error">
                <strong>Could not save</strong>
                <span>{actionError}</span>
              </div>
            ) : null}
            {view === "assignment-detail" ? assignmentMain : quizMain}
          </>
        }
      />
    </PlatformShell>
  );
}
