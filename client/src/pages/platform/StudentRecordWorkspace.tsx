import { requireActiveUser } from "@/lib/auth/session";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Award,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Download,
  Headphones,
  Send,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import PendingMediaField, {
  PendingMediaSummary,
} from "@/components/platform/PendingMediaField";
import {
  PortalInsight,
  type InsightPoint,
} from "@/components/platform/PortalInsights";
import {
  fetchPlatformStateRequest,
  runPlatformWorkflowActionRequest,
} from "@/lib/backend/api";
import { platformStore } from "@/lib/domain/store";
import { nileFormsCutoverEnabled } from "@/lib/forms/cutover";
import type {
  AttendanceStatus,
  PendingMediaAttachment,
  PlatformState,
} from "@/lib/domain/types";

export type StudentRecordView =
  | "grades"
  | "attendance"
  | "certificates"
  | "reports"
  | "quran-progress";

type StudentRecordWorkspaceProps = {
  view: StudentRecordView;
};

const PLATFORM_STATE_UPDATED_EVENT = "nilelearn:platform-state-updated";

const attendanceLabels: Record<AttendanceStatus, string> = {
  present: "Present",
  late: "Late",
  absent: "Absent",
  excused: "Excused",
};

function formatDate(value?: string, includeTime = false) {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(includeTime ? { hour: "numeric", minute: "2-digit" } : {}),
  }).format(date);
}

function humanize(value?: string) {
  return (value ?? "not started")
    .replace(/_/g, " ")
    .replace(/\b\w/g, character => character.toUpperCase());
}

function statusTone(value?: string) {
  if (
    ["issued", "active", "completed", "present", "approved"].includes(
      value ?? ""
    )
  ) {
    return "success";
  }
  if (
    ["pending", "pending_approval", "late", "in_progress"].includes(value ?? "")
  ) {
    return "warning";
  }
  if (["absent", "rejected", "revoked", "paused"].includes(value ?? "")) {
    return "danger";
  }
  return "neutral";
}

function useStudentPlatformState() {
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const state = useMemo(() => platformStore.getState(), [version]);
  const refresh = useCallback(() => setVersion(current => current + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchPlatformStateRequest().then(result => {
      if (cancelled) return;
      if (!result.ok || !result.data) {
        setError(result.error ?? "Your learning record could not be loaded.");
        setLoading(false);
        return;
      }
      platformStore.setState(result.data.state);
      refresh();
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  useEffect(() => {
    const handleUpdate = () => refresh();
    window.addEventListener(PLATFORM_STATE_UPDATED_EVENT, handleUpdate);
    return () =>
      window.removeEventListener(PLATFORM_STATE_UPDATED_EVENT, handleUpdate);
  }, [refresh]);

  return { error, loading, refresh, state };
}

function getStudentScope(state: PlatformState) {
  const actor = requireActiveUser("student");
  const user = state.users.find(item => item.id === actor.id) ?? actor;
  const student = state.students.find(item => item.userId === actor.id);
  const studentId = student?.id ?? "";
  const enrollments = state.enrollments.filter(
    enrollment => enrollment.studentId === studentId
  );
  const runIds = new Set(enrollments.map(item => item.courseRunId));
  const classIds = new Set(
    enrollments
      .map(item => item.classGroupId)
      .filter((classGroupId): classGroupId is string => Boolean(classGroupId))
  );
  const courses = enrollments
    .map(enrollment => {
      const run = state.courseRuns.find(
        item => item.id === enrollment.courseRunId
      );
      const course = state.courses.find(item => item.id === run?.courseId);
      const classGroup = state.classGroups.find(
        item => item.id === enrollment.classGroupId
      );
      return run && course ? { classGroup, course, enrollment, run } : null;
    })
    .filter(
      (
        item
      ): item is {
        classGroup: PlatformState["classGroups"][number] | undefined;
        course: PlatformState["courses"][number];
        enrollment: PlatformState["enrollments"][number];
        run: PlatformState["courseRuns"][number];
      } => Boolean(item)
    );

  return { classIds, courses, enrollments, runIds, student, studentId, user };
}

function EmptyRecordState({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <section
      className="student-record-empty"
      data-testid="student-record-empty"
    >
      <strong>{title}</strong>
      <p>{detail}</p>
    </section>
  );
}

function StudentGradesWorkspace({ state }: { state: PlatformState }) {
  const scope = getStudentScope(state);
  const grades = state.grades
    .filter(grade => grade.studentId === scope.studentId)
    .map(grade => {
      const run = state.courseRuns.find(item => item.id === grade.courseRunId);
      const course = state.courses.find(item => item.id === run?.courseId);
      const percentage = grade.maxScore
        ? Math.round((grade.score / grade.maxScore) * 100)
        : grade.score;
      return { course, grade, percentage };
    })
    .sort((a, b) => b.percentage - a.percentage);
  const latest = grades[0];

  const downloadGrades = () => {
    const rows = grades.map(({ course, grade, percentage }) => ({
      course: course?.title ?? "Course",
      item: grade.itemTitle,
      score: `${grade.score}/${grade.maxScore}`,
      result: `${percentage}%`,
      feedback: grade.feedback,
    }));
    const csv = platformStore.buildCsv(rows);
    if (!csv) {
      toast.info("There are no grades to download yet.");
      return;
    }
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "nile-learn-grades.csv";
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Grades downloaded");
  };

  return (
    <div className="student-record-workspace student-grades-workspace">
      <section className="student-record-command">
        <div>
          <span>Latest feedback</span>
          <strong>{latest?.grade.itemTitle ?? "No feedback yet"}</strong>
          <p>
            {latest?.grade.feedback ??
              "Your teacher feedback will appear here after work is reviewed."}
          </p>
        </div>
        {latest ? (
          <dl>
            <div>
              <dt>Score</dt>
              <dd>
                {latest.grade.score}/{latest.grade.maxScore}
              </dd>
            </div>
            <div>
              <dt>Result</dt>
              <dd>{latest.percentage}%</dd>
            </div>
            <div>
              <dt>Course</dt>
              <dd>{latest.course?.title ?? "Course"}</dd>
            </div>
          </dl>
        ) : null}
        <button
          type="button"
          className="platform-secondary-button"
          onClick={downloadGrades}
          disabled={!grades.length}
          data-testid="student-grades-download"
        >
          <Download size={15} />
          Download record
        </button>
      </section>

      {grades.length ? (
        <section
          className="student-record-list"
          data-testid="student-grades-list"
        >
          <div className="student-record-list-heading">
            <div>
              <span>Results</span>
              <h2>Reviewed work</h2>
            </div>
            <small>{grades.length} item(s)</small>
          </div>
          {grades.map(({ course, grade, percentage }) => (
            <article key={grade.id}>
              <div>
                <span>{course?.title ?? "Course"}</span>
                <strong>{grade.itemTitle}</strong>
                <p>{grade.feedback || "Teacher review recorded."}</p>
              </div>
              <div className="student-result-score">
                <strong>{percentage}%</strong>
                <small>
                  {grade.score}/{grade.maxScore}
                </small>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <EmptyRecordState
          title="No reviewed work yet"
          detail="Completed assignments and quizzes will appear here after your teacher reviews them."
        />
      )}
    </div>
  );
}

function StudentAttendanceWorkspace({
  state,
  refresh,
}: {
  state: PlatformState;
  refresh: () => void;
}) {
  const [, navigate] = useLocation();
  const scope = getStudentScope(state);
  const [requestingId, setRequestingId] = useState("");
  const [draftRecordId, setDraftRecordId] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const records = state.attendance
    .filter(
      record =>
        record.studentId === scope.studentId &&
        scope.classIds.has(record.classGroupId)
    )
    .map(record => {
      const session = state.classSessions.find(
        item =>
          item.id === record.sessionId || item.eventId === record.sessionId
      );
      const classGroup = state.classGroups.find(
        item => item.id === record.classGroupId
      );
      const run = state.courseRuns.find(
        item => item.id === classGroup?.courseRunId
      );
      return { classGroup, record, run, session };
    })
    .sort(
      (a, b) =>
        new Date(b.session?.startsAt ?? 0).getTime() -
        new Date(a.session?.startsAt ?? 0).getTime()
    );
  const attendanceRate = records.length
    ? Math.round(
        (records.filter(item => item.record.status !== "absent").length /
          records.length) *
          100
      )
    : Math.round(
        scope.enrollments.reduce((sum, item) => sum + item.attendanceRate, 0) /
          Math.max(scope.enrollments.length, 1)
      );
  const exceptions = records.filter(
    item => item.record.status !== "present"
  ).length;

  const requestReview = async (item: (typeof records)[number]) => {
    const targetId = item.record.id;
    if (reason.trim().length < 10) {
      setError("Explain the exception in at least 10 characters.");
      return;
    }
    setRequestingId(targetId);
    setMessage("");
    setError("");
    const result = await runPlatformWorkflowActionRequest({
      type: "attendance.exception.submit",
      attendanceRecordId: item.record.id,
      reason: reason.trim(),
    });
    setRequestingId("");
    if (!result.ok || !result.data) {
      const nextError = result.error ?? "Your request could not be sent.";
      setError(nextError);
      toast.error("Attendance review not sent", { description: nextError });
      return;
    }
    platformStore.setState(result.data.state);
    refresh();
    setDraftRecordId("");
    setReason("");
    setMessage("Your attendance exception was sent for branch review.");
    toast.success("Attendance exception submitted");
  };

  return (
    <div className="student-record-workspace student-attendance-workspace">
      <section className="student-record-command">
        <div>
          <span>Your attendance</span>
          <strong>{attendanceRate}% this term</strong>
          <p>
            Use this record to spot an absence or late mark that needs a teacher
            review.
          </p>
        </div>
        <dl>
          <div>
            <dt>Recorded</dt>
            <dd>{records.length}</dd>
          </div>
          <div>
            <dt>Needs review</dt>
            <dd>{exceptions}</dd>
          </div>
          <div>
            <dt>Classes</dt>
            <dd>{scope.courses.length}</dd>
          </div>
        </dl>
        <small>Exceptions are linked to one saved attendance record.</small>
      </section>

      {message ? (
        <p className="student-record-feedback success">{message}</p>
      ) : null}
      {error ? <p className="student-record-feedback error">{error}</p> : null}

      {records.length ? (
        <section
          className="student-record-list"
          data-testid="student-attendance-list"
        >
          <div className="student-record-list-heading">
            <div>
              <span>Attendance history</span>
              <h2>Class records</h2>
            </div>
            <small>{records.length} session(s)</small>
          </div>
          {records.map(item => {
            const requests = state.attendanceExceptions
              .filter(request => request.attendanceRecordId === item.record.id)
              .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
            const latestRequest = requests[0];
            const eligible =
              item.record.status === "absent" || item.record.status === "late";
            const pending = latestRequest?.status === "pending";
            return (
              <article key={item.record.id}>
                <div>
                  <span>{item.classGroup?.name ?? "Class"}</span>
                  <strong>{item.session?.title ?? "Class session"}</strong>
                  <p>{formatDate(item.session?.startsAt, true)}</p>
                </div>
                <div className="student-record-row-actions">
                  <span
                    className={`student-record-status ${statusTone(item.record.status)}`}
                  >
                    {attendanceLabels[item.record.status]}
                  </span>
                  {pending ? (
                    <span className="student-record-status amber">
                      Pending review
                    </span>
                  ) : eligible ? (
                    <button
                      type="button"
                      disabled={requestingId === item.record.id}
                      onClick={() => {
                        if (nileFormsCutoverEnabled) {
                          navigate(
                            `/app/student/forms/publication_form_attendance_exception_1?attendanceRecord=${encodeURIComponent(item.record.id)}`
                          );
                          return;
                        }
                        setDraftRecordId(item.record.id);
                        setReason("");
                        setError("");
                      }}
                      data-testid={`student-attendance-request-${item.record.id}`}
                    >
                      Request exception
                      <ChevronRight size={15} />
                    </button>
                  ) : latestRequest ? (
                    <span
                      className={`student-record-status ${latestRequest.status === "approved" ? "green" : "red"}`}
                    >
                      {latestRequest.status}
                    </span>
                  ) : null}
                </div>
                {draftRecordId === item.record.id && !pending ? (
                  <div className="student-attendance-exception-form">
                    <label>
                      Exception reason
                      <textarea
                        value={reason}
                        onChange={event => setReason(event.target.value)}
                        placeholder="Explain why this absence or late arrival should be excused"
                      />
                    </label>
                    <div>
                      <button
                        type="button"
                        onClick={() => void requestReview(item)}
                        disabled={requestingId === item.record.id}
                        data-testid="student-attendance-exception-submit"
                      >
                        {requestingId === item.record.id
                          ? "Submitting"
                          : "Submit request"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDraftRecordId("");
                          setReason("");
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </section>
      ) : (
        <EmptyRecordState
          title="No attendance recorded yet"
          detail="Your teacher will save attendance after the first class session."
        />
      )}
    </div>
  );
}

function StudentCertificatesWorkspace({ state }: { state: PlatformState }) {
  const scope = getStudentScope(state);
  const certificates = state.certificates.filter(
    certificate => certificate.studentId === scope.studentId
  );
  const [selectedId, setSelectedId] = useState(certificates[0]?.id ?? "");
  const selected =
    certificates.find(certificate => certificate.id === selectedId) ??
    certificates[0];
  const selectedCourse = state.courses.find(
    course => course.id === selected?.courseId
  );
  const issued = selected?.status === "issued";

  return (
    <div className="student-record-workspace student-certificates-workspace">
      {certificates.length ? (
        <section
          className="student-certificate-picker"
          data-testid="student-certificates-list"
          aria-label="Certificates"
        >
          {certificates.map(certificate => {
            const course = state.courses.find(
              item => item.id === certificate.courseId
            );
            const isSelected = certificate.id === selected?.id;
            return (
              <button
                key={certificate.id}
                type="button"
                className={isSelected ? "active" : ""}
                onClick={() => setSelectedId(certificate.id)}
              >
                <Award size={16} />
                <span>
                  <strong>{course?.title ?? "Course certificate"}</strong>
                  <small>{humanize(certificate.status)}</small>
                </span>
              </button>
            );
          })}
        </section>
      ) : null}

      {selected ? (
        <section
          className={`student-certificate-document ${issued ? "issued" : "pending"}`}
          data-testid="student-certificate-document"
        >
          <div className="student-certificate-document-mark">NL</div>
          <span>Certificate of learning</span>
          <h2>{scope.user?.name ?? "Student"}</h2>
          <p>
            has completed the learning requirements for
            <strong>{selectedCourse?.title ?? "Course"}</strong>
          </p>
          <dl>
            <div>
              <dt>Grade</dt>
              <dd>{selected.grade}%</dd>
            </div>
            <div>
              <dt>Attendance</dt>
              <dd>{selected.attendanceRate}%</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{humanize(selected.status)}</dd>
            </div>
          </dl>
          {issued ? (
            <div className="student-certificate-code">
              <span>Verification code</span>
              <strong>{selected.verificationCode}</strong>
            </div>
          ) : (
            <p className="student-certificate-pending">
              This certificate is not issued yet. Printing becomes available
              after it is issued.
            </p>
          )}
          <button
            type="button"
            className="platform-primary-button"
            disabled={!issued}
            onClick={() => window.print()}
            data-testid="student-certificate-print"
          >
            <Download size={15} />
            {issued ? "Print or save PDF" : "Issued certificates only"}
          </button>
        </section>
      ) : (
        <EmptyRecordState
          title="No certificates yet"
          detail="A certificate appears here after its learning requirements and approval are complete."
        />
      )}
    </div>
  );
}

function StudentReportsWorkspace({ state }: { state: PlatformState }) {
  const scope = getStudentScope(state);
  const grades = state.grades.filter(
    grade => grade.studentId === scope.studentId
  );
  const attendance = scope.enrollments.length
    ? Math.round(
        scope.enrollments.reduce((sum, item) => sum + item.attendanceRate, 0) /
          scope.enrollments.length
      )
    : 0;
  const averageGrade = grades.length
    ? Math.round(
        grades.reduce(
          (sum, grade) =>
            sum +
            (grade.maxScore
              ? (grade.score / grade.maxScore) * 100
              : grade.score),
          0
        ) / grades.length
      )
    : 0;
  const reportInsightPoints: InsightPoint[] = scope.courses
    .slice(0, 6)
    .map(({ course, enrollment }) => ({
      label: course.title,
      value: enrollment.progress,
    }));

  const downloadReport = () => {
    const rows = scope.courses.map(({ classGroup, course, enrollment }) => ({
      course: course.title,
      class: classGroup?.name ?? "Class",
      progress: `${enrollment.progress}%`,
      grade: `${enrollment.currentGrade}%`,
      attendance: `${enrollment.attendanceRate}%`,
    }));
    const csv = platformStore.buildCsv(rows);
    if (!csv) {
      toast.info("There is no report data to download yet.");
      return;
    }
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "nile-learn-progress-report.csv";
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Progress report downloaded");
  };

  return (
    <div className="student-record-workspace student-reports-workspace">
      <section className="student-record-command">
        <div>
          <span>Learning summary</span>
          <strong>See how your term is progressing</strong>
          <p>
            Progress, grade, and attendance are grouped by your enrolled
            courses.
          </p>
        </div>
        <dl>
          <div>
            <dt>Courses</dt>
            <dd>{scope.courses.length}</dd>
          </div>
          <div>
            <dt>Average grade</dt>
            <dd>{averageGrade}%</dd>
          </div>
          <div>
            <dt>Attendance</dt>
            <dd>{attendance}%</dd>
          </div>
        </dl>
        <button
          type="button"
          className="platform-secondary-button"
          onClick={downloadReport}
          disabled={!scope.courses.length}
          data-testid="student-reports-download"
        >
          <Download size={15} />
          Download report
        </button>
      </section>

      <PortalInsight
        eyebrow="Course progress"
        title="Progress across your courses"
        value={`${averageGrade}%`}
        valueLabel="average grade"
        description="Compare the learning pace in each course before opening its detail."
        points={reportInsightPoints}
        variant="bars"
        tone="navy"
        testId="student-reports-insight"
      />

      {scope.courses.length ? (
        <section
          className="student-record-list"
          data-testid="student-reports-list"
        >
          <div className="student-record-list-heading">
            <div>
              <span>Course progress</span>
              <h2>My learning this term</h2>
            </div>
          </div>
          {scope.courses.map(({ classGroup, course, enrollment }) => (
            <article key={enrollment.id}>
              <div>
                <span>{classGroup?.name ?? "Class"}</span>
                <strong>{course.title}</strong>
                <div
                  className="student-progress-track"
                  aria-label={`${course.title} progress`}
                >
                  <span
                    style={{
                      width: `${Math.min(100, Math.max(0, enrollment.progress))}%`,
                    }}
                  />
                </div>
              </div>
              <dl className="student-course-measures">
                <div>
                  <dt>Progress</dt>
                  <dd>{enrollment.progress}%</dd>
                </div>
                <div>
                  <dt>Grade</dt>
                  <dd>{enrollment.currentGrade}%</dd>
                </div>
                <div>
                  <dt>Attendance</dt>
                  <dd>{enrollment.attendanceRate}%</dd>
                </div>
              </dl>
              <Link
                href={`/app/student/courses/${course.id}`}
                aria-label={`Open ${course.title}`}
              >
                <ChevronRight size={17} />
              </Link>
            </article>
          ))}
        </section>
      ) : (
        <EmptyRecordState
          title="No course progress yet"
          detail="Your progress report will appear after you are enrolled in a course."
        />
      )}
    </div>
  );
}

function StudentQuranWorkspace({
  state,
  refresh,
}: {
  state: PlatformState;
  refresh: () => void;
}) {
  const scope = getStudentScope(state);
  const plan = state.quranPlans.find(
    item => item.studentId === scope.studentId
  );
  const progress = state.quranProgress.find(
    item => item.studentId === scope.studentId
  );
  const submissions = state.recitationSubmissions
    .filter(item => item.studentId === scope.studentId)
    .sort(
      (a, b) =>
        new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    );
  const [composerOpen, setComposerOpen] = useState(false);
  const [title, setTitle] = useState(
    progress
      ? `${progress.surah} ${progress.juz} recitation`
      : "Daily recitation"
  );
  const [pendingMedia, setPendingMedia] = useState<PendingMediaAttachment[]>(
    []
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submitRecitation = async () => {
    if (!plan || !title.trim() || saving) return;
    setSaving(true);
    setMessage("");
    setError("");
    const result = await runPlatformWorkflowActionRequest({
      type: "recitation.submit",
      studentId: scope.studentId,
      teacherId: plan.teacherId,
      title: title.trim(),
      pendingMedia,
    });
    setSaving(false);
    if (!result.ok || !result.data) {
      const nextError =
        result.error ?? "Your recitation could not be submitted.";
      setError(nextError);
      toast.error("Recitation not submitted", { description: nextError });
      return;
    }
    platformStore.setState(result.data.state);
    refresh();
    setPendingMedia([]);
    setComposerOpen(false);
    setMessage("Your recitation was sent to your Quran teacher.");
    toast.success("Recitation submitted");
  };

  return (
    <div className="student-record-workspace student-quran-workspace">
      <section className="student-quran-summary">
        <div>
          <span>Memorization plan</span>
          <strong>
            {plan?.target ?? progress?.surah ?? "No plan assigned"}
          </strong>
          <p>
            {plan
              ? `${plan.currentJuz} · ${plan.revisionCycle} revision`
              : "Your teacher will add a Quran plan before recitation submission opens."}
          </p>
        </div>
        <dl>
          <div>
            <dt>Memorized</dt>
            <dd>{progress?.memorizedPercent ?? 0}%</dd>
          </div>
          <div>
            <dt>Tajweed</dt>
            <dd>{progress?.tajweedScore ?? 0}%</dd>
          </div>
          <div>
            <dt>Current Juz</dt>
            <dd>{plan?.currentJuz ?? progress?.juz ?? "-"}</dd>
          </div>
        </dl>
        <button
          type="button"
          className="platform-primary-button"
          disabled={!plan}
          onClick={() => setComposerOpen(open => !open)}
          data-testid="student-quran-open-submission"
        >
          <Headphones size={15} />
          {composerOpen ? "Close submission" : "Submit recitation"}
        </button>
      </section>

      {composerOpen ? (
        <section
          className="student-quran-composer"
          data-testid="student-quran-submission"
        >
          <div className="student-record-list-heading">
            <div>
              <span>New recitation</span>
              <h2>Send it to your teacher</h2>
            </div>
          </div>
          <label>
            Title
            <input
              value={title}
              onChange={event => setTitle(event.target.value)}
            />
          </label>
          <PendingMediaField
            kind="audio"
            label="Recitation audio"
            description="Choose an audio recording to include with this submission."
            value={pendingMedia}
            onChange={setPendingMedia}
          />
          <div className="student-quran-composer-actions">
            <button
              type="button"
              className="platform-secondary-button"
              onClick={() => setComposerOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="platform-primary-button"
              disabled={!title.trim() || saving}
              onClick={submitRecitation}
            >
              <Send size={15} />
              {saving ? "Sending" : "Send recitation"}
            </button>
          </div>
        </section>
      ) : null}
      {message ? (
        <p className="student-record-feedback success">{message}</p>
      ) : null}
      {error ? <p className="student-record-feedback error">{error}</p> : null}

      <section
        className="student-record-list"
        data-testid="student-quran-history"
      >
        <div className="student-record-list-heading">
          <div>
            <span>Recitation history</span>
            <h2>Teacher review</h2>
          </div>
          <small>{submissions.length} submission(s)</small>
        </div>
        {submissions.length ? (
          submissions.map(submission => (
            <article key={submission.id}>
              <div>
                <span>{formatDate(submission.submittedAt, true)}</span>
                <strong>{submission.title}</strong>
                <p>
                  {submission.feedback ?? "Waiting for your teacher’s review."}
                </p>
                <PendingMediaSummary items={submission.pendingMedia} />
              </div>
              <span
                className={`student-record-status ${statusTone(submission.status)}`}
              >
                {humanize(submission.status)}
              </span>
            </article>
          ))
        ) : (
          <EmptyRecordState
            title="No recitations submitted"
            detail="When your plan is ready, submit your next recitation here."
          />
        )}
      </section>
    </div>
  );
}

export default function StudentRecordWorkspace({
  view,
}: StudentRecordWorkspaceProps) {
  const { error, loading, refresh, state } = useStudentPlatformState();

  if (loading) {
    return (
      <section className="student-record-loading" aria-live="polite">
        <span aria-hidden="true" />
        <strong>Loading your learning record</strong>
      </section>
    );
  }

  if (error) {
    return (
      <section className="student-record-loading error" role="alert">
        <strong>We could not load this record</strong>
        <p>{error}</p>
        <button
          type="button"
          className="platform-secondary-button"
          onClick={() => window.location.reload()}
        >
          Try again
        </button>
      </section>
    );
  }

  if (view === "grades") return <StudentGradesWorkspace state={state} />;
  if (view === "attendance") {
    return <StudentAttendanceWorkspace state={state} refresh={refresh} />;
  }
  if (view === "certificates")
    return <StudentCertificatesWorkspace state={state} />;
  if (view === "reports") return <StudentReportsWorkspace state={state} />;
  return <StudentQuranWorkspace state={state} refresh={refresh} />;
}
