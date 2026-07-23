import { useEffect, useMemo, useState } from "react";
import {
  BookMarked,
  CheckCircle2,
  ClipboardCheck,
  ListChecks,
  Plus,
  Search,
} from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import PlatformShell from "@/components/platform/PlatformShell";
import {
  DetailLayout,
  FormFlowLayout,
  WorkspaceLayout,
} from "@/components/platform/PlatformLayouts";
import {
  DataTableCard,
  StatusBadge,
} from "@/components/platform/PlatformPrimitives";
import { runPlatformWorkflowActionRequest } from "@/lib/backend/api";
import { requireActiveUser } from "@/lib/auth/session";
import { platformStore } from "@/lib/domain/store";
import type {
  EntityStatus,
  QuestionBankItem,
  QuizAttempt,
} from "@/lib/domain/types";

type TeacherAssessmentView =
  | "quizzes"
  | "new-quiz"
  | "quiz-detail"
  | "review"
  | "review-detail"
  | "question-bank"
  | "new-question";

type TeacherAssessmentPageProps = {
  view: TeacherAssessmentView;
  quizId?: string;
  reviewAttemptId?: string;
};

function formatDate(value?: string) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function getFutureDateInput(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function splitList(value: string) {
  return value
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
}

function truncateText(value: string, maxLength = 72) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3).trimEnd()}...`;
}

function statusTone(status: EntityStatus): "green" | "amber" | "red" | "slate" {
  if (status === "active" || status === "completed") return "green";
  if (status === "draft" || status === "pending" || status === "paused")
    return "amber";
  if (status === "cancelled" || status === "rejected" || status === "overdue")
    return "red";
  return "slate";
}

function isReviewNeeded(status: QuizAttempt["status"]) {
  return status === "pending";
}

export default function TeacherAssessmentPage({
  view,
  quizId,
  reviewAttemptId,
}: TeacherAssessmentPageProps) {
  const [version, setVersion] = useState(0);
  const [search, setSearch] = useState("");
  const [selectedRunId, setSelectedRunId] = useState("");
  const [selectedQuizId, setSelectedQuizId] = useState("");
  const [savingAction, setSavingAction] = useState("");
  const [actionError, setActionError] = useState("");
  const [quizDraft, setQuizDraft] = useState({
    title: "Checkpoint quiz",
    dueAt: getFutureDateInput(4),
    durationMinutes: 20,
    attemptsAllowed: 2,
    questionTypes: "multiple_choice, short_answer",
  });
  const [quizEditDraft, setQuizEditDraft] = useState({
    title: "",
    dueAt: "",
    durationMinutes: 20,
    attemptsAllowed: 1,
  });
  const [quizQuestionDraftIds, setQuizQuestionDraftIds] = useState<string[]>([]);
  const [showQuizCancel, setShowQuizCancel] = useState(false);
  const [quizCancelReason, setQuizCancelReason] = useState("");
  const [questionDraft, setQuestionDraft] = useState({
    prompt: "Choose the correct answer and explain the grammar rule.",
    questionType: "short_answer" as QuestionBankItem["type"],
    difficulty: "core" as QuestionBankItem["difficulty"],
    tags: "grammar, review",
    choices: "",
    answerKey: "Teacher-reviewed answer",
    rubric: "Accuracy, Reasoning",
  });
  const [reviewDraft, setReviewDraft] = useState({
    score: 88,
    feedback: "Reviewed. Keep strengthening evidence and accuracy.",
  });

  const state = useMemo(() => platformStore.getState(), [version]);
  const actorId = requireActiveUser("teacher").id;
  const teacherRuns = state.courseRuns.filter(run => run.teacherId === actorId);
  const runIds = new Set(teacherRuns.map(run => run.id));
  const activeRun =
    teacherRuns.find(run => run.id === selectedRunId) ?? teacherRuns[0];
  const activeRunId = activeRun?.id ?? "";
  const teacherQuizzes = state.quizzes
    .filter(quiz => runIds.has(quiz.courseRunId))
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
  const filteredQuizzes = teacherQuizzes.filter(quiz => {
    const run = state.courseRuns.find(item => item.id === quiz.courseRunId);
    const course = state.courses.find(item => item.id === run?.courseId);
    const text = [quiz.title, course?.title, quiz.status]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return text.includes(search.toLowerCase());
  });
  const questionBank = state.questionBankItems
    .filter(question => runIds.has(question.courseRunId))
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  const selectedRunQuestions = activeRunId
    ? questionBank.filter(question => question.courseRunId === activeRunId)
    : questionBank;
  const filteredQuestions = selectedRunQuestions.filter(question => {
    const text = [
      question.prompt,
      question.type,
      question.difficulty,
      question.tags.join(" "),
    ]
      .join(" ")
      .toLowerCase();
    return text.includes(search.toLowerCase());
  });
  const runQuizzes = activeRunId
    ? teacherQuizzes.filter(quiz => quiz.courseRunId === activeRunId)
    : teacherQuizzes;
  const draftRunQuizzes = runQuizzes.filter(quiz => quiz.status === "draft");
  const targetQuiz =
    draftRunQuizzes.find(quiz => quiz.id === selectedQuizId) ??
    draftRunQuizzes[0];
  const selectedQuiz = quizId
    ? teacherQuizzes.find(quiz => quiz.id === quizId)
    : undefined;
  const attachedQuestionIds = new Set(targetQuiz?.questionIds ?? []);
  const attempts = state.quizAttempts
    .filter(attempt => {
      const quiz = state.quizzes.find(item => item.id === attempt.quizId);
      return Boolean(quiz && runIds.has(quiz.courseRunId));
    })
    .sort((a, b) => {
      const priority = (status: QuizAttempt["status"]) =>
        isReviewNeeded(status) ? 0 : 1;
      const priorityDelta = priority(a.status) - priority(b.status);
      if (priorityDelta !== 0) return priorityDelta;
      return (
        new Date(b.submittedAt ?? b.startedAt).getTime() -
        new Date(a.submittedAt ?? a.startedAt).getTime()
      );
    });
  const reviewAttempts = attempts.filter(attempt =>
    isReviewNeeded(attempt.status)
  );
  const selectedAttempt = reviewAttemptId
    ? attempts.find(attempt => attempt.id === reviewAttemptId)
    : undefined;

  useEffect(() => {
    if (!selectedQuiz) return;
    setQuizEditDraft({
      title: selectedQuiz.title,
      dueAt: selectedQuiz.dueAt.slice(0, 10),
      durationMinutes: selectedQuiz.durationMinutes,
      attemptsAllowed: selectedQuiz.attemptsAllowed,
    });
    setQuizQuestionDraftIds(selectedQuiz.questionIds);
    setShowQuizCancel(false);
    setQuizCancelReason("");
    setActionError("");
  }, [selectedQuiz?.id]);

  const getRunCourse = (runId?: string) => {
    const run = state.courseRuns.find(item => item.id === runId);
    return state.courses.find(course => course.id === run?.courseId);
  };

  const getAttemptContext = (attempt?: QuizAttempt) => {
    const quiz = state.quizzes.find(item => item.id === attempt?.quizId);
    const student = state.students.find(item => item.id === attempt?.studentId);
    const user = state.users.find(item => item.id === student?.userId);
    const course = getRunCourse(quiz?.courseRunId);
    return { quiz, student, user, course };
  };

  const runAction = async (
    label: string,
    payload: Parameters<typeof runPlatformWorkflowActionRequest>[0]
  ) => {
    setSavingAction(label);
    setActionError("");
    const response = await runPlatformWorkflowActionRequest(payload);
    setSavingAction("");
    if (!response.ok || !response.data) {
      const message = response.error ?? `${label} failed.`;
      setActionError(message);
      toast.error(`${label} failed`, { description: message });
      return false;
    }
    platformStore.setState(response.data.state);
    setVersion(current => current + 1);
    toast.success(label);
    return true;
  };

  const createQuiz = async () => {
    if (!activeRun || !quizDraft.title.trim() || !quizDraft.dueAt) return;
    await runAction("Quiz draft created", {
      type: "quiz.create",
      courseRunId: activeRun.id,
      title: quizDraft.title.trim(),
      dueAt: new Date(quizDraft.dueAt).toISOString(),
      durationMinutes: Math.max(5, Number(quizDraft.durationMinutes) || 20),
      attemptsAllowed: Math.max(1, Number(quizDraft.attemptsAllowed) || 1),
      questionTypes: splitList(quizDraft.questionTypes),
    });
  };

  const updateQuiz = async () => {
    if (
      !selectedQuiz ||
      !quizEditDraft.title.trim() ||
      !quizEditDraft.dueAt
    ) {
      return;
    }
    await runAction("Quiz draft saved", {
      type: "quiz.update",
      quizId: selectedQuiz.id,
      title: quizEditDraft.title.trim(),
      dueAt: new Date(quizEditDraft.dueAt).toISOString(),
      durationMinutes: Math.max(5, Number(quizEditDraft.durationMinutes) || 5),
      attemptsAllowed: Math.max(1, Number(quizEditDraft.attemptsAllowed) || 1),
    });
  };

  const publishQuiz = async () => {
    if (!selectedQuiz) return;
    await runAction("Quiz published", {
      type: "quiz.status.update",
      quizId: selectedQuiz.id,
      status: "active",
    });
  };

  const saveQuizQuestions = async () => {
    if (!selectedQuiz || selectedQuiz.status !== "draft") return;
    await runAction("Quiz questions saved", {
      type: "quiz.questions.set",
      quizId: selectedQuiz.id,
      questionIds: quizQuestionDraftIds,
    });
  };

  const cancelQuiz = async () => {
    if (!selectedQuiz || quizCancelReason.trim().length < 5) return;
    const saved = await runAction("Quiz cancelled", {
      type: "quiz.status.update",
      quizId: selectedQuiz.id,
      status: "cancelled",
      reason: quizCancelReason.trim(),
    });
    if (saved) {
      setShowQuizCancel(false);
      setQuizCancelReason("");
    }
  };

  const closeQuiz = async () => {
    if (!selectedQuiz) return;
    await runAction("Quiz closed", {
      type: "quiz.status.update",
      quizId: selectedQuiz.id,
      status: "completed",
    });
  };

  const createQuestion = async () => {
    if (!activeRun || !questionDraft.prompt.trim()) return;
    await runAction("Question saved", {
      type: "question.create",
      courseRunId: activeRun.id,
      prompt: questionDraft.prompt.trim(),
      questionType: questionDraft.questionType,
      difficulty: questionDraft.difficulty,
      tags: splitList(questionDraft.tags),
      choices: splitList(questionDraft.choices),
      answerKey: questionDraft.answerKey.trim(),
      rubric: splitList(questionDraft.rubric),
    });
  };

  const attachQuestion = async (questionId: string) => {
    if (!targetQuiz || targetQuiz.status !== "draft") return;
    await runAction("Quiz questions updated", {
      type: "quiz.questions.set",
      quizId: targetQuiz.id,
      questionIds: [...Array.from(attachedQuestionIds), questionId],
    });
  };

  const reviewAttempt = async () => {
    if (!selectedAttempt) return;
    await runAction("Quiz reviewed", {
      type: "quiz.review",
      attemptId: selectedAttempt.id,
      score: Math.min(100, Math.max(0, Number(reviewDraft.score) || 0)),
      feedback: reviewDraft.feedback.trim() || "Reviewed by teacher.",
    });
  };

  const runPicker = (
    <label>
      Class
      <select
        value={activeRunId}
        onChange={event => setSelectedRunId(event.target.value)}
      >
        {teacherRuns.map(run => {
          const course = getRunCourse(run.id);
          return (
            <option key={run.id} value={run.id}>
              {course?.title ?? run.courseId} · {run.term}
            </option>
          );
        })}
      </select>
    </label>
  );

  if (view === "new-quiz") {
    return (
      <PlatformShell role="teacher" title="Create quiz">
        <FormFlowLayout
          className="portal-ia-page teacher-assessment-page teacher-quiz-create-page"
          title="Create quiz"
          description="Save one quiz draft for an assigned class."
          context={<span>Teacher</span>}
          actions={
            <Link
              className="platform-secondary-button"
              href="/app/teacher/quizzes"
            >
              Back to quizzes
            </Link>
          }
          main={
            <section
              className="portal-ia-form-card"
              data-testid="teacher-quiz-create-form"
            >
              {actionError ? (
                <p className="platform-form-error">{actionError}</p>
              ) : null}
              <div className="portal-ia-form-grid">
                {runPicker}
                <label>
                  Quiz title
                  <input
                    value={quizDraft.title}
                    onChange={event =>
                      setQuizDraft(current => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Due date
                  <input
                    type="date"
                    min={activeRun?.startsOn}
                    max={activeRun?.endsOn}
                    value={quizDraft.dueAt}
                    onChange={event =>
                      setQuizDraft(current => ({
                        ...current,
                        dueAt: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Minutes
                  <input
                    type="number"
                    min="5"
                    max="180"
                    value={quizDraft.durationMinutes}
                    onChange={event =>
                      setQuizDraft(current => ({
                        ...current,
                        durationMinutes: Number(event.target.value),
                      }))
                    }
                  />
                </label>
                <label>
                  Attempts
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={quizDraft.attemptsAllowed}
                    onChange={event =>
                      setQuizDraft(current => ({
                        ...current,
                        attemptsAllowed: Number(event.target.value),
                      }))
                    }
                  />
                </label>
                <label>
                  Question types
                  <input
                    value={quizDraft.questionTypes}
                    onChange={event =>
                      setQuizDraft(current => ({
                        ...current,
                        questionTypes: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
              <div className="portal-ia-actions">
                <button
                  type="button"
                  className="platform-primary-button"
                  disabled={
                    !activeRun ||
                    !quizDraft.title.trim() ||
                    savingAction === "Quiz draft created"
                  }
                  onClick={createQuiz}
                >
                  <Plus size={15} />
                  {savingAction === "Quiz draft created"
                    ? "Saving draft"
                    : "Save quiz draft"}
                </button>
              </div>
            </section>
          }
        />
      </PlatformShell>
    );
  }

  if (view === "new-question") {
    return (
      <PlatformShell role="teacher" title="New question">
        <FormFlowLayout
          className="portal-ia-page teacher-assessment-page teacher-question-create-page"
          title="New question"
          description="Create one reusable question for your classes."
          context={<span>Teacher</span>}
          actions={
            <Link
              className="platform-secondary-button"
              href="/app/teacher/question-bank"
            >
              Back to question bank
            </Link>
          }
          main={
            <section className="portal-ia-form-card">
              {actionError ? (
                <p className="platform-form-error">{actionError}</p>
              ) : null}
              <div className="portal-ia-form-grid">
                {runPicker}
                <label className="wide">
                  Prompt
                  <textarea
                    value={questionDraft.prompt}
                    onChange={event =>
                      setQuestionDraft(current => ({
                        ...current,
                        prompt: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Type
                  <select
                    value={questionDraft.questionType}
                    onChange={event =>
                      setQuestionDraft(current => ({
                        ...current,
                        questionType: event.target
                          .value as QuestionBankItem["type"],
                      }))
                    }
                  >
                    <option value="multiple_choice">Multiple choice</option>
                    <option value="true_false">True / false</option>
                    <option value="short_answer">Short answer</option>
                    <option value="essay">Essay</option>
                    <option value="oral_record">Oral record</option>
                    <option value="file_upload">File upload</option>
                  </select>
                </label>
                <label>
                  Difficulty
                  <select
                    value={questionDraft.difficulty}
                    onChange={event =>
                      setQuestionDraft(current => ({
                        ...current,
                        difficulty: event.target
                          .value as QuestionBankItem["difficulty"],
                      }))
                    }
                  >
                    <option value="foundation">Foundation</option>
                    <option value="core">Core</option>
                    <option value="challenge">Challenge</option>
                  </select>
                </label>
                <label>
                  Tags
                  <input
                    value={questionDraft.tags}
                    onChange={event =>
                      setQuestionDraft(current => ({
                        ...current,
                        tags: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Choices
                  <input
                    value={questionDraft.choices}
                    placeholder="Comma separated for MCQ"
                    onChange={event =>
                      setQuestionDraft(current => ({
                        ...current,
                        choices: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Answer key
                  <input
                    value={questionDraft.answerKey}
                    onChange={event =>
                      setQuestionDraft(current => ({
                        ...current,
                        answerKey: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Rubric
                  <input
                    value={questionDraft.rubric}
                    onChange={event =>
                      setQuestionDraft(current => ({
                        ...current,
                        rubric: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
              <div className="portal-ia-actions">
                <button
                  type="button"
                  className="platform-primary-button"
                  disabled={
                    !activeRun ||
                    !questionDraft.prompt.trim() ||
                    savingAction === "Question saved"
                  }
                  onClick={createQuestion}
                >
                  <Plus size={15} />
                  {savingAction === "Question saved"
                    ? "Saving"
                    : "Save question"}
                </button>
              </div>
            </section>
          }
        />
      </PlatformShell>
    );
  }

  const viewFilters =
    view === "quizzes" ? (
      <label className="portal-ia-search">
        <Search size={16} />
        <input
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Search quizzes"
          aria-label="Search quizzes"
        />
      </label>
    ) : view === "question-bank" ? (
      <>
        <label className="portal-ia-search">
          <Search size={16} />
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search questions"
            aria-label="Search questions"
          />
        </label>
        {runPicker}
        <label>
          Quiz
          <select
            value={targetQuiz?.id ?? ""}
            onChange={event => setSelectedQuizId(event.target.value)}
          >
            {!draftRunQuizzes.length ? (
              <option value="">No draft quiz available</option>
            ) : null}
            {draftRunQuizzes.map(quiz => (
              <option key={quiz.id} value={quiz.id}>
                {quiz.title}
              </option>
            ))}
          </select>
        </label>
      </>
    ) : null;

  const quizzesTable = (
    <DataTableCard
      title="Quiz list"
      subtitle={`${filteredQuizzes.length} quiz item(s)`}
      className="teacher-assessment-record-card"
    >
      {filteredQuizzes.length ? (
        <div className="teacher-assessment-record-list">
          {filteredQuizzes.map(quiz => {
            const course = getRunCourse(quiz.courseRunId);
            return (
              <article key={quiz.id}>
                <div className="teacher-assessment-record-copy">
                  <span>{course?.title ?? "Course"}</span>
                  <strong>{quiz.title}</strong>
                  <p>
                    {quiz.questionTypes
                      .map(type => type.replaceAll("_", " "))
                      .join(" · ")}
                  </p>
                </div>
                <dl className="teacher-assessment-record-facts">
                  <div>
                    <dt>Due</dt>
                    <dd>{formatDate(quiz.dueAt)}</dd>
                  </div>
                  <div>
                    <dt>Questions</dt>
                    <dd>{quiz.questionIds.length}</dd>
                  </div>
                  <div>
                    <dt>Attempts</dt>
                    <dd>{quiz.attemptsAllowed}</dd>
                  </div>
                </dl>
                <div className="teacher-assessment-record-actions">
                  <StatusBadge tone={statusTone(quiz.status)}>
                    {quiz.status === "active" ? "Published" : quiz.status}
                  </StatusBadge>
                  <Link
                    className="platform-row-link"
                    href={`/app/teacher/quizzes/${quiz.id}`}
                  >
                    Open
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="platform-empty-state">
          <strong>No quizzes found</strong>
          <span>Create a quiz or adjust your search.</span>
        </div>
      )}
    </DataTableCard>
  );

  const questionTable = (
    <DataTableCard
      title="Question bank"
      subtitle={`${filteredQuestions.length} question(s)`}
      className="teacher-assessment-record-card"
    >
      {filteredQuestions.length ? (
        <div className="teacher-assessment-record-list">
          {filteredQuestions.map(question => {
            const attached = attachedQuestionIds.has(question.id);
            return (
              <article key={question.id}>
                <div className="teacher-assessment-record-copy">
                  <span>
                    {question.type.replaceAll("_", " ")} · {question.difficulty}
                  </span>
                  <strong title={question.prompt}>
                    {truncateText(question.prompt, 58)}
                  </strong>
                  <p>{question.tags.slice(0, 2).join(" · ") || "No tags"}</p>
                </div>
                <dl className="teacher-assessment-record-facts">
                  <div>
                    <dt>Updated</dt>
                    <dd>{formatDate(question.updatedAt)}</dd>
                  </div>
                  <div>
                    <dt>Quiz</dt>
                    <dd>{targetQuiz?.title ?? "Choose a quiz"}</dd>
                  </div>
                </dl>
                <div className="teacher-assessment-record-actions">
                  {attached ? (
                    <StatusBadge tone="green">Attached</StatusBadge>
                  ) : targetQuiz?.status !== "draft" ? (
                    <StatusBadge tone="slate">Draft only</StatusBadge>
                  ) : (
                    <button
                      type="button"
                      className="platform-row-link"
                      disabled={
                        !targetQuiz ||
                        targetQuiz.status !== "draft" ||
                        savingAction === "Quiz questions updated"
                      }
                      onClick={() => attachQuestion(question.id)}
                    >
                      Attach
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="platform-empty-state">
          <strong>No questions yet</strong>
          <span>Try another class or create a question.</span>
        </div>
      )}
    </DataTableCard>
  );

  const reviewTable = (
    <DataTableCard
      title="Review queue"
      subtitle={`${reviewAttempts.length} pending attempt(s)`}
      className="teacher-assessment-record-card"
    >
      {reviewAttempts.length ? (
        <div className="teacher-assessment-record-list">
          {reviewAttempts.map(attempt => {
            const context = getAttemptContext(attempt);
            return (
              <article key={attempt.id}>
                <div className="teacher-assessment-record-copy">
                  <span>{context.course?.title ?? "Course"}</span>
                  <strong>{context.user?.name ?? "Student"}</strong>
                  <p>{context.quiz?.title ?? "Quiz"}</p>
                </div>
                <dl className="teacher-assessment-record-facts">
                  <div>
                    <dt>Submitted</dt>
                    <dd>
                      {formatDate(attempt.submittedAt ?? attempt.startedAt)}
                    </dd>
                  </div>
                  <div>
                    <dt>Score</dt>
                    <dd>
                      {attempt.score}/{attempt.maxScore}
                    </dd>
                  </div>
                </dl>
                <div className="teacher-assessment-record-actions">
                  <StatusBadge tone="amber">{attempt.status}</StatusBadge>
                  <Link
                    className="platform-row-link"
                    href={`/app/teacher/quizzes/review/${attempt.id}`}
                  >
                    Review
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="platform-empty-state">
          <strong>No attempts need review</strong>
          <span>Submitted quiz attempts will appear here.</span>
        </div>
      )}
    </DataTableCard>
  );

  const selectedContext = getAttemptContext(selectedAttempt);

  if (view === "quiz-detail") {
    const selectedQuizAttempts = selectedQuiz
      ? attempts.filter(attempt => attempt.quizId === selectedQuiz.id)
      : [];
    const duePassed = selectedQuiz
      ? new Date(selectedQuiz.dueAt).getTime() <= Date.now()
      : false;
    const activeLearnerIds = new Set(
      selectedQuiz
        ? state.enrollments
            .filter(
              enrollment =>
                enrollment.courseRunId === selectedQuiz.courseRunId &&
                enrollment.status === "active"
            )
            .map(enrollment => enrollment.studentId)
            .filter(studentId => {
              const student = state.students.find(item => item.id === studentId);
              const user = state.users.find(item => item.id === student?.userId);
              return student?.status === "active" && user?.status === "active";
            })
        : []
    );
    const reviewedLearnerIds = new Set(
      selectedQuizAttempts
        .filter(attempt => attempt.status === "completed")
        .map(attempt => attempt.studentId)
    );
    const reviewComplete =
      activeLearnerIds.size > 0 &&
      selectedQuizAttempts.every(attempt => attempt.status === "completed") &&
      Array.from(activeLearnerIds).every(studentId =>
        reviewedLearnerIds.has(studentId)
      );
    const canCloseQuiz = duePassed || reviewComplete;
    const canCancelQuiz = selectedQuizAttempts.length === 0;
    const selectedQuizRun = selectedQuiz
      ? state.courseRuns.find(run => run.id === selectedQuiz.courseRunId)
      : undefined;
    const quizQuestionOptions = selectedQuiz
      ? questionBank.filter(
          question =>
            question.courseRunId === selectedQuiz.courseRunId &&
            question.status === "active"
        )
      : [];
    const quizDetailsDirty = Boolean(
      selectedQuiz &&
        (quizEditDraft.title.trim() !== selectedQuiz.title ||
          quizEditDraft.dueAt !== selectedQuiz.dueAt.slice(0, 10) ||
          Number(quizEditDraft.durationMinutes) !==
            selectedQuiz.durationMinutes ||
          Number(quizEditDraft.attemptsAllowed) !==
            selectedQuiz.attemptsAllowed)
    );
    const quizQuestionsDirty = Boolean(
      selectedQuiz &&
        [...quizQuestionDraftIds].sort().join("|") !==
          [...selectedQuiz.questionIds].sort().join("|")
    );
    const hasActiveClass = Boolean(
      selectedQuiz &&
        state.classGroups.some(
          group =>
            group.courseRunId === selectedQuiz.courseRunId &&
            group.status === "active"
        )
    );
    const isDraft = selectedQuiz?.status === "draft";
    const isPublished = selectedQuiz?.status === "active";
    const isTerminal = Boolean(
      selectedQuiz &&
        (selectedQuiz.status === "completed" ||
          selectedQuiz.status === "cancelled")
    );

    return (
      <PlatformShell role="teacher" title="Quiz details">
        <DetailLayout
          className="portal-ia-page teacher-assessment-page teacher-quiz-detail-page"
          title={selectedQuiz?.title ?? "Quiz"}
          description={
            selectedQuiz
              ? "Manage this quiz without changing learner attempt history."
              : "This quiz is no longer available in your assigned classes."
          }
          context={<span>Teacher</span>}
          actions={
            <Link className="platform-secondary-button" href="/app/teacher/quizzes">
              <ListChecks size={15} />
              Back to quizzes
            </Link>
          }
          main={
            selectedQuiz ? (
              <div className="teacher-quiz-detail-stack" data-testid="teacher-quiz-detail">
                <section className="teacher-quiz-lifecycle-summary">
                  <div>
                    <span>Delivery</span>
                    <strong>{getRunCourse(selectedQuiz.courseRunId)?.title ?? "Course"}</strong>
                    <p>
                      {isDraft
                        ? "Add questions and publish when the class is ready."
                        : isPublished
                          ? "Learners can take this quiz while it is open."
                          : selectedQuiz.status === "completed"
                            ? "This quiz is closed. Attempts and results remain available."
                            : "This quiz was cancelled before learner attempts could begin."}
                    </p>
                  </div>
                  <StatusBadge tone={statusTone(selectedQuiz.status)}>
                    {selectedQuiz.status === "active"
                      ? "Published"
                      : selectedQuiz.status === "completed"
                        ? "Closed"
                        : selectedQuiz.status}
                  </StatusBadge>
                </section>

                <dl className="teacher-quiz-lifecycle-facts">
                  <div>
                    <dt>Due</dt>
                    <dd>{formatDate(selectedQuiz.dueAt)}</dd>
                  </div>
                  <div>
                    <dt>Questions</dt>
                    <dd>{selectedQuiz.questionIds.length}</dd>
                  </div>
                  <div>
                    <dt>Attempts</dt>
                    <dd>{selectedQuizAttempts.length}</dd>
                  </div>
                  <div>
                    <dt>Limit</dt>
                    <dd>{selectedQuiz.attemptsAllowed} per learner</dd>
                  </div>
                </dl>

                {actionError ? (
                  <p className="platform-form-error">{actionError}</p>
                ) : null}

                {isDraft ? (
                  <section
                    className="portal-ia-form-card teacher-quiz-lifecycle-form"
                    data-testid="teacher-quiz-draft-controls"
                  >
                    <div>
                      <h2>Draft settings</h2>
                      <p>
                        {hasActiveClass
                          ? "Set the delivery details, add questions, then publish."
                          : "Create or reactivate a class for this course before publishing."}
                      </p>
                    </div>
                    <div className="portal-ia-form-grid">
                      <label className="wide">
                        Quiz title
                        <input
                          value={quizEditDraft.title}
                          onChange={event =>
                            setQuizEditDraft(current => ({
                              ...current,
                              title: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label>
                        Due date
                        <input
                          type="date"
                          min={selectedQuizRun?.startsOn}
                          max={selectedQuizRun?.endsOn}
                          value={quizEditDraft.dueAt}
                          onChange={event =>
                            setQuizEditDraft(current => ({
                              ...current,
                              dueAt: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label>
                        Minutes
                        <input
                          type="number"
                          min="5"
                          max="180"
                          value={quizEditDraft.durationMinutes}
                          onChange={event =>
                            setQuizEditDraft(current => ({
                              ...current,
                              durationMinutes: Number(event.target.value),
                            }))
                          }
                        />
                      </label>
                      <label>
                        Attempts per learner
                        <input
                          type="number"
                          min="1"
                          max="5"
                          value={quizEditDraft.attemptsAllowed}
                          onChange={event =>
                            setQuizEditDraft(current => ({
                              ...current,
                              attemptsAllowed: Number(event.target.value),
                            }))
                          }
                        />
                      </label>
                    </div>
                    <div
                      className="teacher-quiz-question-editor"
                      data-testid="teacher-quiz-question-editor"
                    >
                      <div className="teacher-quiz-question-editor-heading">
                        <div>
                          <h3>Questions</h3>
                          <p>
                            Choose active questions from this class. Save the
                            selection before publishing.
                          </p>
                        </div>
                        <strong>
                          {quizQuestionDraftIds.length} selected
                        </strong>
                      </div>
                      {quizQuestionOptions.length ? (
                        <div className="teacher-quiz-question-options">
                          {quizQuestionOptions.map(question => (
                            <label key={question.id}>
                              <input
                                type="checkbox"
                                data-question-id={question.id}
                                checked={quizQuestionDraftIds.includes(
                                  question.id
                                )}
                                onChange={event =>
                                  setQuizQuestionDraftIds(current =>
                                    event.target.checked
                                      ? Array.from(
                                          new Set([...current, question.id])
                                        )
                                      : current.filter(
                                          item => item !== question.id
                                        )
                                  )
                                }
                              />
                              <span>
                                <strong>{truncateText(question.prompt, 84)}</strong>
                                <small>
                                  {question.type.replaceAll("_", " ")} ·{" "}
                                  {question.difficulty}
                                </small>
                              </span>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <div className="platform-empty-state compact">
                          <strong>No active questions for this class</strong>
                          <span>Create a reusable question before publishing.</span>
                        </div>
                      )}
                      <div className="teacher-quiz-question-editor-actions">
                        <Link
                          className="platform-row-link"
                          href="/app/teacher/question-bank/new"
                        >
                          Create question
                        </Link>
                        <button
                          type="button"
                          className="platform-secondary-button"
                          data-testid="teacher-quiz-save-questions"
                          disabled={
                            !quizQuestionsDirty ||
                            savingAction === "Quiz questions saved"
                          }
                          onClick={saveQuizQuestions}
                        >
                          {savingAction === "Quiz questions saved"
                            ? "Saving questions"
                            : "Save questions"}
                        </button>
                      </div>
                    </div>
                    {quizDetailsDirty || quizQuestionsDirty ? (
                      <p
                        className="teacher-quiz-unsaved-note"
                        role="status"
                        data-testid="teacher-quiz-unsaved-note"
                      >
                        Save all draft changes before publishing.
                      </p>
                    ) : null}
                    <div className="portal-ia-actions">
                      <button
                        type="button"
                        className="platform-secondary-button"
                        disabled={
                          !quizDetailsDirty ||
                          !quizEditDraft.title.trim() ||
                          !quizEditDraft.dueAt ||
                          savingAction === "Quiz draft saved"
                        }
                        onClick={updateQuiz}
                      >
                        {savingAction === "Quiz draft saved"
                          ? "Saving draft"
                          : "Save draft"}
                      </button>
                      <button
                        type="button"
                        className="platform-primary-button"
                        data-testid="teacher-quiz-publish"
                        disabled={
                          selectedQuiz.questionIds.length === 0 ||
                          !hasActiveClass ||
                          quizDetailsDirty ||
                          quizQuestionsDirty ||
                          savingAction === "Quiz published"
                        }
                        onClick={publishQuiz}
                      >
                        {savingAction === "Quiz published"
                          ? "Publishing"
                          : "Publish quiz"}
                      </button>
                      <button
                        type="button"
                        className="platform-row-link"
                        disabled={!canCancelQuiz}
                        onClick={() => setShowQuizCancel(current => !current)}
                      >
                        Cancel draft
                      </button>
                    </div>
                    {!canCancelQuiz ? (
                      <p className="teacher-quiz-guard-note">
                        This quiz has learner attempts and can no longer be
                        cancelled.
                      </p>
                    ) : null}
                  </section>
                ) : null}

                {isPublished ? (
                  <section
                    className="teacher-quiz-lifecycle-panel"
                    data-testid="teacher-quiz-published-controls"
                  >
                    <div>
                      <h2>Published quiz</h2>
                      <p>
                        Close it after the due date or once every active learner
                        has a reviewed attempt.
                      </p>
                    </div>
                    <div className="portal-ia-actions">
                      <button
                        type="button"
                        className="platform-primary-button"
                        data-testid="teacher-quiz-close"
                        disabled={!canCloseQuiz || savingAction === "Quiz closed"}
                        onClick={closeQuiz}
                      >
                        {savingAction === "Quiz closed" ? "Closing" : "Close quiz"}
                      </button>
                      <button
                        type="button"
                        className="platform-row-link"
                        disabled={!canCancelQuiz}
                        onClick={() => setShowQuizCancel(current => !current)}
                      >
                        Cancel quiz
                      </button>
                    </div>
                    {!canCloseQuiz ? (
                      <p className="teacher-quiz-guard-note">
                        Closing becomes available after the due date or once
                        every active learner has a reviewed attempt.
                      </p>
                    ) : null}
                    {!canCancelQuiz ? (
                      <p className="teacher-quiz-guard-note">
                        Cancellation is unavailable because learner attempts
                        already exist.
                      </p>
                    ) : null}
                  </section>
                ) : null}

                {showQuizCancel && !isTerminal ? (
                  <section
                    className="portal-ia-form-card teacher-quiz-cancel-form"
                    data-testid="teacher-quiz-cancel-form"
                  >
                    <label>
                      Why is this quiz being cancelled?
                      <textarea
                        value={quizCancelReason}
                        onChange={event => setQuizCancelReason(event.target.value)}
                        placeholder="Add a short reason for the teaching record"
                      />
                    </label>
                    <div className="portal-ia-actions">
                      <button
                        type="button"
                        className="platform-secondary-button"
                        onClick={() => setShowQuizCancel(false)}
                      >
                        Keep quiz
                      </button>
                      <button
                        type="button"
                        className="platform-danger-button"
                        data-testid="teacher-quiz-cancel"
                        disabled={
                          quizCancelReason.trim().length < 5 ||
                          savingAction === "Quiz cancelled"
                        }
                        onClick={cancelQuiz}
                      >
                        {savingAction === "Quiz cancelled"
                          ? "Cancelling"
                          : "Cancel quiz"}
                      </button>
                    </div>
                  </section>
                ) : null}

                {isTerminal ? (
                  <section
                    className="teacher-quiz-lifecycle-complete"
                    data-testid="teacher-quiz-terminal-state"
                  >
                    <CheckCircle2 size={18} />
                    <div>
                      <strong>
                        {selectedQuiz.status === "completed"
                          ? "Quiz closed"
                          : "Quiz cancelled"}
                      </strong>
                      <p>
                        {selectedQuiz.status === "completed"
                          ? "Learner attempts and results remain read-only records."
                          : "This quiz is no longer available to learners."}
                      </p>
                    </div>
                  </section>
                ) : null}
              </div>
            ) : (
              <div className="platform-empty-state">
                <strong>Quiz not found</strong>
                <span>Return to the quiz list and choose another item.</span>
              </div>
            )
          }
        />
      </PlatformShell>
    );
  }

  if (view === "review-detail") {
    const reviewNeeded = Boolean(
      selectedAttempt && isReviewNeeded(selectedAttempt.status)
    );

    return (
      <PlatformShell role="teacher" title="Review quiz">
        <DetailLayout
          className="portal-ia-page teacher-assessment-page teacher-quiz-review-detail-page"
          title={selectedContext.quiz?.title ?? "Quiz attempt"}
          description={
            selectedAttempt
              ? `${selectedContext.user?.name ?? "Student"} submitted this attempt for review.`
              : "This quiz attempt is no longer available."
          }
          context={<span>Teacher</span>}
          actions={
            <Link
              className="platform-secondary-button"
              href="/app/teacher/quizzes/review"
            >
              <ListChecks size={15} />
              Back to review queue
            </Link>
          }
          main={
            selectedAttempt ? (
              <div className="teacher-quiz-review-detail-stack">
                <section className="teacher-quiz-review-summary">
                  <div>
                    <span>Student</span>
                    <strong>{selectedContext.user?.name ?? "Student"}</strong>
                    <p>{selectedContext.course?.title ?? "Course"}</p>
                  </div>
                  <StatusBadge
                    tone={
                      reviewNeeded
                        ? "amber"
                        : statusTone(selectedAttempt.status)
                    }
                  >
                    {reviewNeeded ? "Needs review" : selectedAttempt.status}
                  </StatusBadge>
                </section>

                <dl className="teacher-quiz-review-facts">
                  <div>
                    <dt>Submitted</dt>
                    <dd>
                      {formatDate(
                        selectedAttempt.submittedAt ?? selectedAttempt.startedAt
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Current score</dt>
                    <dd>
                      {selectedAttempt.score}/{selectedAttempt.maxScore}
                    </dd>
                  </div>
                  <div>
                    <dt>Responses</dt>
                    <dd>{Object.keys(selectedAttempt.answers).length}</dd>
                  </div>
                </dl>

                {reviewNeeded ? (
                  <section className="portal-ia-form-card teacher-quiz-review-form">
                    <div>
                      <h2>Review attempt</h2>
                      <p>Record a score and concise learner feedback.</p>
                    </div>
                    {actionError ? (
                      <p className="platform-form-error">{actionError}</p>
                    ) : null}
                    <div className="portal-ia-form-grid">
                      <label>
                        Score
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={reviewDraft.score}
                          onChange={event =>
                            setReviewDraft(current => ({
                              ...current,
                              score: Number(event.target.value),
                            }))
                          }
                        />
                      </label>
                      <label className="wide">
                        Feedback
                        <textarea
                          value={reviewDraft.feedback}
                          onChange={event =>
                            setReviewDraft(current => ({
                              ...current,
                              feedback: event.target.value,
                            }))
                          }
                        />
                      </label>
                    </div>
                    <div className="portal-ia-actions">
                      <button
                        type="button"
                        className="platform-primary-button"
                        disabled={savingAction === "Quiz reviewed"}
                        onClick={reviewAttempt}
                      >
                        <CheckCircle2 size={15} />
                        {savingAction === "Quiz reviewed"
                          ? "Saving review"
                          : "Save review"}
                      </button>
                    </div>
                  </section>
                ) : (
                  <section className="teacher-quiz-review-complete">
                    <CheckCircle2 size={18} />
                    <div>
                      <strong>Review recorded</strong>
                      <p>
                        This attempt has already been reviewed and is kept here
                        as a read-only record.
                      </p>
                    </div>
                  </section>
                )}
              </div>
            ) : (
              <div className="platform-empty-state">
                <strong>Quiz attempt not found</strong>
                <span>
                  Return to the review queue and choose another attempt.
                </span>
              </div>
            )
          }
        />
      </PlatformShell>
    );
  }

  return (
    <PlatformShell role="teacher" title="Quizzes">
      <WorkspaceLayout
        className={`portal-ia-page teacher-assessment-page teacher-assessment-${view}`}
        title={
          view === "review"
            ? "Quiz review"
            : view === "question-bank"
              ? "Question bank"
              : "Quizzes"
        }
        description={
          view === "review"
            ? "Review submitted quiz attempts."
            : view === "question-bank"
              ? "Manage reusable questions for assigned classes."
              : "Find and manage quiz items for your classes."
        }
        context={<span>Teacher</span>}
        actions={
          view === "question-bank" ? (
            <Link
              className="platform-primary-button"
              href="/app/teacher/question-bank/new"
            >
              <BookMarked size={15} />
              New question
            </Link>
          ) : view === "review" ? (
            <Link
              className="platform-secondary-button"
              href="/app/teacher/quizzes"
            >
              <ListChecks size={15} />
              Back to quizzes
            </Link>
          ) : (
            <>
              <Link
                className="platform-secondary-button"
                href="/app/teacher/quizzes/review"
              >
                Review attempts
              </Link>
              <Link
                className="platform-primary-button"
                href="/app/teacher/quizzes/new"
              >
                <ClipboardCheck size={15} />
                Create quiz
              </Link>
            </>
          )
        }
        toolbar={
          viewFilters ? (
            <div className="portal-ia-toolbar teacher-assessment-toolbar">
              {viewFilters}
            </div>
          ) : undefined
        }
        main={
          <>
            {actionError ? (
              <p className="platform-form-error">{actionError}</p>
            ) : null}
            {view === "review"
              ? reviewTable
              : view === "question-bank"
                ? questionTable
                : quizzesTable}
          </>
        }
      />
    </PlatformShell>
  );
}
