import { useMemo, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Pause,
  Play,
  Repeat2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import PlatformShell from "@/components/platform/PlatformShell";
import {
  DetailLayout,
  WorkspaceLayout,
} from "@/components/platform/PlatformLayouts";
import {
  DataTableCard,
  StatusBadge,
} from "@/components/platform/PlatformPrimitives";
import { runPlatformWorkflowActionRequest } from "@/lib/backend/api";
import { platformStore } from "@/lib/domain/store";
import type { StudentStatus } from "@/lib/domain/types";
import { getDemoUser } from "@/lib/platformData";

function tone(status: StudentStatus): "green" | "amber" | "red" | "slate" {
  if (status === "active" || status === "completed") return "green";
  if (status === "paused" || status === "ready_to_enroll") return "amber";
  if (status === "cancelled") return "red";
  return "slate";
}

function label(value: string) {
  return value
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, character => character.toUpperCase());
}

export default function RegistrarEnrollmentRecordsPage({
  enrollmentId,
}: {
  enrollmentId?: string;
}) {
  const [version, setVersion] = useState(0);
  const [saving, setSaving] = useState(false);
  const [transferClassId, setTransferClassId] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [statusReason, setStatusReason] = useState("");
  const state = useMemo(() => platformStore.getState(), [version]);
  const actorId = getDemoUser("registrar").id;
  const refresh = () => setVersion(value => value + 1);
  const enrollment = enrollmentId
    ? state.enrollments.find(item => item.id === enrollmentId)
    : undefined;

  const applyResponse = (
    response: Awaited<ReturnType<typeof runPlatformWorkflowActionRequest>>,
    success: string
  ) => {
    if (!response.ok || !response.data) {
      toast.error("Enrollment update failed", {
        description: response.error ?? "The server rejected this transition.",
      });
      return false;
    }
    platformStore.setState(response.data.state);
    refresh();
    toast.success(success);
    return true;
  };

  if (!enrollmentId) {
    return (
      <PlatformShell role="registrar" title="Enrollment records">
        <WorkspaceLayout
          className="registrar-enrollment-records-page"
          title="Enrollment records"
          description="Manage active, paused, completed, and cancelled enrollments."
          context="Registrar"
          actions={
            <Link
              className="platform-secondary-button"
              href="/app/registrar/enrollments"
            >
              Intake handoffs <ArrowRight size={15} />
            </Link>
          }
          main={
            <DataTableCard
              title="Current enrollments"
              subtitle={`${state.enrollments.length} records`}
            >
              <div
                className="platform-row-list"
                data-testid="registrar-enrollment-records-list"
              >
                {state.enrollments.map(item => {
                  const student = state.students.find(
                    row => row.id === item.studentId
                  );
                  const user = state.users.find(
                    row => row.id === student?.userId
                  );
                  const run = state.courseRuns.find(
                    row => row.id === item.courseRunId
                  );
                  const course = state.courses.find(
                    row => row.id === run?.courseId
                  );
                  const group = state.classGroups.find(
                    row => row.id === item.classGroupId
                  );
                  return (
                    <Link
                      key={item.id}
                      className="registrar-enrollment-row-link"
                      href={`/app/registrar/enrollments/records/${item.id}`}
                    >
                      <div>
                        <strong>
                          {user?.name ?? student?.id ?? "Student"}
                        </strong>
                        <small>
                          {course?.title ?? "Course"} ·{" "}
                          {group?.name ?? "Class not assigned"}
                        </small>
                      </div>
                      <StatusBadge tone={tone(item.status)}>
                        {label(item.status)}
                      </StatusBadge>
                    </Link>
                  );
                })}
              </div>
            </DataTableCard>
          }
        />
      </PlatformShell>
    );
  }

  if (!enrollment) {
    return (
      <PlatformShell role="registrar" title="Enrollment record">
        <DetailLayout
          title="Enrollment not found"
          description="This record is outside your scope or no longer exists."
          context="Registrar"
          main={
            <Link href="/app/registrar/enrollments/records">
              Back to records
            </Link>
          }
        />
      </PlatformShell>
    );
  }

  const student = state.students.find(item => item.id === enrollment.studentId);
  const user = state.users.find(item => item.id === student?.userId);
  const run = state.courseRuns.find(item => item.id === enrollment.courseRunId);
  const course = state.courses.find(item => item.id === run?.courseId);
  const currentGroup = state.classGroups.find(
    item => item.id === enrollment.classGroupId
  );
  const teacher = state.users.find(
    item => item.id === (run?.teacherId ?? enrollment.teacherId)
  );
  const eligibleGroups = state.classGroups.filter(
    item =>
      item.courseRunId === enrollment.courseRunId &&
      item.id !== currentGroup?.id &&
      item.status === "active" &&
      item.studentIds.length < item.capacity
  );

  const transfer = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const response = await runPlatformWorkflowActionRequest({
      type: "enrollment.transfer",
      enrollmentId: enrollment.id,
      classGroupId: transferClassId,
      reason: transferReason.trim(),
      actorId,
    });
    setSaving(false);
    if (applyResponse(response, "Enrollment transferred")) {
      setTransferClassId("");
      setTransferReason("");
    }
  };

  const updateStatus = async (
    status: "active" | "paused" | "completed" | "cancelled"
  ) => {
    setSaving(true);
    const response = await runPlatformWorkflowActionRequest({
      type: "enrollment.status.update",
      enrollmentId: enrollment.id,
      status,
      reason: statusReason.trim() || undefined,
      actorId,
    });
    setSaving(false);
    if (applyResponse(response, `Enrollment ${status}`)) setStatusReason("");
  };

  const terminal =
    enrollment.status === "completed" || enrollment.status === "cancelled";
  return (
    <PlatformShell role="registrar" title="Enrollment record">
      <DetailLayout
        className="registrar-enrollment-record-detail"
        title={user?.name ?? "Enrollment record"}
        description={`${course?.title ?? "Course"} · ${currentGroup?.name ?? "Class not assigned"}`}
        context="Enrollment"
        actions={
          <Link
            className="platform-secondary-button"
            href="/app/registrar/enrollments/records"
          >
            <ArrowLeft size={15} />
            Back to records
          </Link>
        }
        main={
          <div
            className="registrar-enrollment-record-workspace"
            data-testid="registrar-enrollment-record-detail"
          >
            <section className="registrar-enrollment-facts">
              <div>
                <dt>Status</dt>
                <dd>
                  <StatusBadge tone={tone(enrollment.status)}>
                    {label(enrollment.status)}
                  </StatusBadge>
                </dd>
              </div>
              <div>
                <dt>Teacher</dt>
                <dd>{teacher?.name ?? "Not assigned"}</dd>
              </div>
              <div>
                <dt>Progress</dt>
                <dd>{enrollment.progress}%</dd>
              </div>
              <div>
                <dt>Attendance</dt>
                <dd>{enrollment.attendanceRate}%</dd>
              </div>
            </section>
            {!terminal ? (
              <section className="branch-inline-composer">
                <div className="branch-inline-composer-head">
                  <div>
                    <span>Class assignment</span>
                    <strong>Transfer within this course run</strong>
                  </div>
                </div>
                <form
                  className="registrar-enrollment-transfer-form"
                  onSubmit={transfer}
                >
                  <label>
                    Target class
                    <select
                      required
                      value={transferClassId}
                      disabled={saving || !eligibleGroups.length}
                      onChange={event => setTransferClassId(event.target.value)}
                    >
                      <option value="">Select class</option>
                      {eligibleGroups.map(group => (
                        <option key={group.id} value={group.id}>
                          {group.name} · {group.studentIds.length}/
                          {group.capacity}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Transfer reason
                    <input
                      required
                      value={transferReason}
                      disabled={saving}
                      onChange={event => setTransferReason(event.target.value)}
                      placeholder="Schedule or learning support reason"
                    />
                  </label>
                  <button
                    className="platform-primary-button"
                    type="submit"
                    disabled={
                      saving || !transferClassId || !transferReason.trim()
                    }
                  >
                    <Repeat2 size={15} />
                    Transfer enrollment
                  </button>
                </form>
                {!eligibleGroups.length ? (
                  <p className="platform-form-error">
                    No other eligible class has an open seat in this course run.
                  </p>
                ) : null}
              </section>
            ) : null}
            {!terminal ? (
              <section className="branch-inline-composer">
                <div className="branch-inline-composer-head">
                  <div>
                    <span>Enrollment status</span>
                    <strong>Record one controlled transition</strong>
                  </div>
                </div>
                <label className="registrar-enrollment-status-reason">
                  Reason for pause or cancellation
                  <input
                    value={statusReason}
                    disabled={saving}
                    onChange={event => setStatusReason(event.target.value)}
                    placeholder="Required for pause or cancellation"
                  />
                </label>
                <div className="platform-page-actions">
                  {enrollment.status === "active" ? (
                    <button
                      className="platform-secondary-button"
                      disabled={saving || !statusReason.trim()}
                      onClick={() => updateStatus("paused")}
                    >
                      <Pause size={15} />
                      Pause
                    </button>
                  ) : null}
                  {enrollment.status === "paused" ? (
                    <button
                      className="platform-primary-button"
                      disabled={saving}
                      onClick={() => updateStatus("active")}
                    >
                      <Play size={15} />
                      Resume
                    </button>
                  ) : null}
                  {enrollment.progress >= 100 ? (
                    <button
                      className="platform-secondary-button"
                      disabled={saving}
                      onClick={() => updateStatus("completed")}
                    >
                      Complete
                    </button>
                  ) : null}
                  <button
                    className="platform-secondary-button"
                    disabled={saving || !statusReason.trim()}
                    onClick={() => updateStatus("cancelled")}
                  >
                    <XCircle size={15} />
                    Cancel enrollment
                  </button>
                </div>
              </section>
            ) : (
              <section className="platform-empty-state">
                <strong>This enrollment is {enrollment.status}.</strong>
                <span>
                  Terminal enrollment records cannot be reopened from this
                  workflow.
                </span>
              </section>
            )}
          </div>
        }
      />
    </PlatformShell>
  );
}
