import { useMemo, useState } from "react";
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
  FormFlowLayout,
  WorkspaceLayout,
} from "@/components/platform/PlatformLayouts";
import {
  DataTableCard,
  StatusBadge,
} from "@/components/platform/PlatformPrimitives";
import { runPlatformWorkflowActionRequest } from "@/lib/backend/api";
import { getActiveUser } from "@/lib/auth/session";
import { platformStore } from "@/lib/domain/store";
import type {
  EntityStatus,
  QuestionBankItem,
  QuizAttempt,
} from "@/lib/domain/types";
import { demoUsers } from "@/lib/platformData";

type TeacherAssessmentView =
  | "quizzes"
  | "new-quiz"
  | "review"
  | "question-bank"
  | "new-question";

type TeacherAssessmentPageProps = {
  view: TeacherAssessmentView;
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
  if (status === "active") return "green";
  if (status === "pending" || status === "paused") return "amber";
  if (status === "cancelled" || status === "rejected" || status === "overdue")
    return "red";
  return "slate";
}

function isReviewNeeded(status: QuizAttempt["status"]) {
  return status === "pending";
}

export default function TeacherAssessmentPage({
  view,
}: TeacherAssessmentPageProps) {
  const [version, setVersion] = useState(0);
  const [search, setSearch] = useState("");
  const [selectedRunId, setSelectedRunId] = useState("");
  const [selectedQuizId, setSelectedQuizId] = useState("");
  const [selectedAttemptId, setSelectedAttemptId] = useState("");
  const [savingAction, setSavingAction] = useState("");
  const [actionError, setActionError] = useState("");
  const [quizDraft, setQuizDraft] = useState({
    title: "Checkpoint quiz",
    dueAt: getFutureDateInput(4),
    durationMinutes: 20,
    attemptsAllowed: 2,
    questionTypes: "multiple_choice, short_answer",
  });
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
  const activeUser =
    getActiveUser() ?? demoUsers.find(user => user.activeRole === "teacher");
  const actorId = activeUser?.id ?? "usr_teacher_demo";
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
  const targetQuiz =
    runQuizzes.find(quiz => quiz.id === selectedQuizId) ?? runQuizzes[0];
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
  const selectedAttempt =
    reviewAttempts.find(attempt => attempt.id === selectedAttemptId) ??
    reviewAttempts[0];

  const tabs = [
    {
      href: "/app/teacher/quizzes",
      label: "Quizzes",
      active: view === "quizzes" || view === "new-quiz",
    },
    {
      href: "/app/teacher/quizzes/review",
      label: "Review",
      active: view === "review",
    },
    {
      href: "/app/teacher/question-bank",
      label: "Question bank",
      active: view === "question-bank" || view === "new-question",
    },
  ];

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
    if (!activeRun || !quizDraft.title.trim()) return;
    await runAction("Quiz created", {
      type: "quiz.create",
      courseRunId: activeRun.id,
      title: quizDraft.title.trim(),
      dueAt: new Date(quizDraft.dueAt).toISOString(),
      durationMinutes: Math.max(5, Number(quizDraft.durationMinutes) || 20),
      attemptsAllowed: Math.max(1, Number(quizDraft.attemptsAllowed) || 1),
      questionTypes: splitList(quizDraft.questionTypes),
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
    if (!targetQuiz) return;
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

  const sharedToolbar = (
    <nav className="portal-ia-subnav" aria-label="Assessment sections">
      {tabs.map(tab => (
        <Link
          key={tab.href}
          href={tab.href}
          className={tab.active ? "active" : ""}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );

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
          className="portal-ia-page teacher-assessment-page"
          title="Create quiz"
          description="Create one quiz for an assigned class."
          context={<span>Teacher</span>}
          actions={
            <Link
              className="platform-secondary-button"
              href="/app/teacher/quizzes"
            >
              Back to quizzes
            </Link>
          }
          toolbar={sharedToolbar}
          main={
            <section className="portal-ia-form-card">
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
                    savingAction === "Quiz created"
                  }
                  onClick={createQuiz}
                >
                  <Plus size={15} />
                  {savingAction === "Quiz created" ? "Creating" : "Create quiz"}
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
          className="portal-ia-page teacher-assessment-page"
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
          toolbar={sharedToolbar}
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
            {runQuizzes.map(quiz => (
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
      className="portal-ia-table-card"
    >
      <div className="portal-ia-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Quiz</th>
              <th>Course</th>
              <th>Due</th>
              <th>Questions</th>
              <th>Attempts</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredQuizzes.map(quiz => {
              const course = getRunCourse(quiz.courseRunId);
              return (
                <tr key={quiz.id}>
                  <td>
                    <strong>{quiz.title}</strong>
                    <small>{quiz.questionTypes.join(", ")}</small>
                  </td>
                  <td>{course?.title ?? "Course"}</td>
                  <td>{formatDate(quiz.dueAt)}</td>
                  <td>{quiz.questionIds.length}</td>
                  <td>{quiz.attemptsAllowed}</td>
                  <td>
                    <StatusBadge tone={statusTone(quiz.status)}>
                      {quiz.status}
                    </StatusBadge>
                  </td>
                </tr>
              );
            })}
            {!filteredQuizzes.length ? (
              <tr>
                <td colSpan={6}>
                  <div className="platform-empty-state">
                    <strong>No quizzes found</strong>
                    <span>Create a quiz or adjust your search.</span>
                  </div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </DataTableCard>
  );

  const questionTable = (
    <DataTableCard
      title="Question bank"
      subtitle={`${filteredQuestions.length} question(s)`}
      className="portal-ia-table-card"
    >
      <div className="portal-ia-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Question</th>
              <th>Type</th>
              <th>Level</th>
              <th>Quiz</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredQuestions.map(question => {
              const attached = attachedQuestionIds.has(question.id);
              return (
                <tr key={question.id}>
                  <td>
                    <strong title={question.prompt}>
                      {truncateText(question.prompt, 52)}
                    </strong>
                    <small>
                      {[formatDate(question.updatedAt), question.tags[0]]
                        .filter(Boolean)
                        .join(" · ")}
                    </small>
                  </td>
                  <td>{question.type.replace(/_/g, " ")}</td>
                  <td>{question.difficulty}</td>
                  <td>{targetQuiz?.title ?? "No quiz selected"}</td>
                  <td>
                    {attached ? (
                      <StatusBadge tone="green">Attached</StatusBadge>
                    ) : (
                      <button
                        type="button"
                        className="platform-row-link"
                        disabled={
                          !targetQuiz ||
                          savingAction === "Quiz questions updated"
                        }
                        onClick={() => attachQuestion(question.id)}
                      >
                        Attach
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {!filteredQuestions.length ? (
              <tr>
                <td colSpan={5}>
                  <div className="platform-empty-state">
                    <strong>No questions yet</strong>
                    <span>Try another class or create a question.</span>
                  </div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </DataTableCard>
  );

  const reviewTable = (
    <DataTableCard
      title="Review queue"
      subtitle={`${reviewAttempts.length} pending attempt(s)`}
      className="portal-ia-table-card"
    >
      <div className="portal-ia-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Quiz</th>
              <th>Submitted</th>
              <th>Score</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {reviewAttempts.map(attempt => {
              const context = getAttemptContext(attempt);
              return (
                <tr key={attempt.id}>
                  <td>
                    <strong>{context.user?.name ?? "Student"}</strong>
                    <small>{context.course?.title ?? "Course"}</small>
                  </td>
                  <td>{context.quiz?.title ?? attempt.quizId}</td>
                  <td>
                    {formatDate(attempt.submittedAt ?? attempt.startedAt)}
                  </td>
                  <td>
                    {attempt.score}/{attempt.maxScore}
                  </td>
                  <td>
                    <StatusBadge tone="amber">{attempt.status}</StatusBadge>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="platform-row-link"
                      onClick={() => setSelectedAttemptId(attempt.id)}
                    >
                      Review
                    </button>
                  </td>
                </tr>
              );
            })}
            {!reviewAttempts.length ? (
              <tr>
                <td colSpan={6}>
                  <div className="platform-empty-state">
                    <strong>No attempts need review</strong>
                    <span>Submitted quiz attempts will appear here.</span>
                  </div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </DataTableCard>
  );

  const selectedContext = getAttemptContext(selectedAttempt);
  const reviewPanel = selectedAttempt ? (
    <section className="portal-ia-side-panel">
      <span>Selected attempt</span>
      <strong>{selectedContext.quiz?.title ?? selectedAttempt.quizId}</strong>
      <p>
        {selectedContext.user?.name ?? "Student"} ·{" "}
        {selectedContext.course?.title ?? "Course"}
      </p>
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
      <label>
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
      <button
        type="button"
        className="platform-primary-button"
        disabled={savingAction === "Quiz reviewed"}
        onClick={reviewAttempt}
      >
        <CheckCircle2 size={15} />
        {savingAction === "Quiz reviewed" ? "Saving" : "Save review"}
      </button>
    </section>
  ) : null;

  return (
    <PlatformShell role="teacher" title="Quizzes">
      <WorkspaceLayout
        className="portal-ia-page teacher-assessment-page"
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
            <Link
              className="platform-primary-button"
              href="/app/teacher/quizzes/new"
            >
              <ClipboardCheck size={15} />
              Create quiz
            </Link>
          )
        }
        toolbar={
          <div className="portal-ia-toolbar teacher-assessment-toolbar">
            {sharedToolbar}
            {viewFilters}
          </div>
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
        side={view === "review" ? reviewPanel : undefined}
      />
    </PlatformShell>
  );
}
