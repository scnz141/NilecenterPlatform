import { requireActiveUser } from "@/lib/auth/session";
import { useMemo, useState } from "react";
import { CheckCircle2, UserPlus } from "lucide-react";
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

type AssignmentDraft = {
  courseRunId: string;
  classGroupId: string;
};

type RegistrarEnrollmentsPageProps = {
  workflowId?: string;
};

function statusTone(status: string): "green" | "amber" | "red" | "slate" {
  if (["active", "enrolled", "completed"].includes(status)) return "green";
  if (["ready_to_enroll", "pending", "placement_booked"].includes(status)) {
    return "amber";
  }
  if (["cancelled", "rejected", "paused"].includes(status)) return "red";
  return "slate";
}

function humanize(value: string) {
  return value
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, character => character.toUpperCase());
}

export default function RegistrarEnrollmentsPage({
  workflowId,
}: RegistrarEnrollmentsPageProps) {
  const [version, setVersion] = useState(0);
  const [assignmentDrafts, setAssignmentDrafts] = useState<
    Record<string, AssignmentDraft>
  >({});
  const [pendingAction, setPendingAction] = useState("");
  const [activationSaved, setActivationSaved] = useState(false);

  const state = useMemo(() => platformStore.getState(), [version]);
  const actorId = requireActiveUser("registrar").id;
  const refresh = () => setVersion(current => current + 1);
  const isAnyActionPending = Boolean(pendingAction);
  const isActionPending = (actionKey: string) => pendingAction === actionKey;
  const readyWorkflows = state.enrollmentWorkflows.filter(
    workflow => workflow.status === "ready_to_enroll"
  );

  const activateEnrollment = async (
    workflowId: string,
    assignment: AssignmentDraft
  ) => {
    const actionKey = `enrollment.activate:${workflowId}`;
    setPendingAction(actionKey);
    try {
      const response = await runPlatformWorkflowActionRequest({
        type: "enrollment.activate",
        workflowId,
        courseRunId: assignment.courseRunId,
        classGroupId: assignment.classGroupId,
        actorId,
      });

      if (!response.data) {
        throw new Error(
          response.error ?? "Enrollment action returned no state."
        );
      }

      platformStore.setState(response.data.state);
      refresh();
      toast.success("Student portal activated", {
        description:
          "The student, enrollment, class, teacher, and invoice are connected.",
      });
      setActivationSaved(true);
      return true;
    } catch (error) {
      toast.error("Enrollment could not be activated", {
        description:
          error instanceof Error
            ? error.message
            : "Check the selected class and try again.",
      });
      return false;
    } finally {
      setPendingAction("");
    }
  };

  const workflow = workflowId
    ? state.enrollmentWorkflows.find(item => item.id === workflowId)
    : undefined;
  const lead = state.leads.find(item => item.id === workflow?.leadId);
  const student = state.students.find(item => item.id === workflow?.studentId);
  const user = state.users.find(item => item.id === student?.userId);
  const course = state.courses.find(item => item.id === workflow?.targetCourseId);
  const courseRuns = state.courseRuns.filter(
    item =>
      item.courseId === workflow?.targetCourseId && item.status === "active"
  );
  const draft = workflow ? assignmentDrafts[workflow.id] : undefined;
  const selectedCourseRun = courseRuns.find(
    item => item.id === draft?.courseRunId
  );
  const classGroups = state.classGroups.filter(
    item =>
      item.courseRunId === selectedCourseRun?.id &&
      item.status === "active" &&
      item.studentIds.length < item.capacity
  );
  const selectedClassGroup = classGroups.find(
    item => item.id === draft?.classGroupId
  );
  const invoice = state.invoices.find(item => item.studentId === student?.id);
  const isActivated = Boolean(workflow?.studentId && student);
  const canActivate =
    Boolean(workflow) &&
    !isActivated &&
    workflow?.status === "ready_to_enroll" &&
    Boolean(selectedCourseRun && selectedClassGroup);
  const assignment = draft ?? { courseRunId: "", classGroupId: "" };

  if (workflowId) {
    return (
      <PlatformShell role="registrar" title="Enroll learner">
        <DetailLayout
          className="registrar-enrollment-detail-page"
          title="Enroll learner"
          description="Choose the class, then activate the learner's school record."
          context="Registrar"
          actions={
            <Link className="platform-secondary-button" href="/app/registrar/enrollments">
              Back to enrollments
            </Link>
          }
          main={
            workflow ? (
              activationSaved ? (
                <section className="registrar-enrollment-success" data-testid="registrar-enrollment-success">
                  <CheckCircle2 aria-hidden="true" size={20} />
                  <div>
                    <strong>Learner enrolled</strong>
                    <span>The learner, class, teacher, and invoice are now connected.</span>
                  </div>
                  <Link className="platform-primary-button" href="/app/registrar/enrollments">
                    View enrollments
                  </Link>
                </section>
              ) : (
                <section
                  className="registrar-enrollment-detail"
                  data-testid="registrar-enrollment-detail"
                >
                  <header className="registrar-enrollment-detail-head">
                    <div>
                      <span>Enrollment handoff</span>
                      <h2>{lead?.fullName ?? user?.name ?? "Learner"}</h2>
                      <p>{course?.title ?? "Course not set"}</p>
                    </div>
                    <StatusBadge tone={statusTone(isActivated ? "active" : workflow.status)}>
                      {humanize(isActivated ? "active" : workflow.status)}
                    </StatusBadge>
                  </header>
                  <dl className="registrar-enrollment-facts">
                    <div>
                      <dt>Next step</dt>
                      <dd>{workflow.nextStep}</dd>
                    </div>
                    <div>
                      <dt>Placement</dt>
                      <dd>{workflow.recommendedLevel ?? "Not set"}</dd>
                    </div>
                    <div>
                      <dt>Invoice</dt>
                      <dd>{invoice ? humanize(invoice.status) : "Created on activation"}</dd>
                    </div>
                  </dl>
                  {isActivated ? (
                    <section className="registrar-enrollment-complete">
                      <div>
                        <span>Enrollment active</span>
                        <strong>{selectedClassGroup?.name ?? "Class assigned"}</strong>
                        <p>The learner is ready for their assigned class.</p>
                      </div>
                      <StatusBadge tone="green">Active</StatusBadge>
                    </section>
                  ) : (
                    <form
                      className="registrar-enrollment-form"
                      data-testid="registrar-enrollment-form"
                      onSubmit={event => {
                        event.preventDefault();
                        void activateEnrollment(workflow.id, assignment);
                      }}
                    >
                      <div className="registrar-enrollment-form-head">
                        <div>
                          <span>Class placement</span>
                          <strong>Choose the right run and class.</strong>
                        </div>
                      </div>
                      <label>
                        Course run
                        <select
                          value={selectedCourseRun?.id ?? ""}
                          disabled={isAnyActionPending || !courseRuns.length}
                          onChange={event => {
                            const nextRunId = event.target.value;
                            setActivationSaved(false);
                            setAssignmentDrafts(current => ({
                              ...current,
                              [workflow.id]: {
                                courseRunId: nextRunId,
                                classGroupId: "",
                              },
                            }));
                          }}
                        >
                          <option value="">Select a course run</option>
                          {courseRuns.length ? (
                            courseRuns.map(run => {
                              const branch = state.branches.find(
                                item => item.id === run.branchId
                              );
                              return (
                                <option key={run.id} value={run.id}>
                                  {run.term} · {branch?.name ?? run.branchId}
                                </option>
                              );
                            })
                          ) : (
                            <option value="" disabled>
                              No active course run
                            </option>
                          )}
                        </select>
                      </label>
                      <label>
                        Class
                        <select
                          value={selectedClassGroup?.id ?? ""}
                          disabled={
                            isAnyActionPending ||
                            !selectedCourseRun ||
                            !classGroups.length
                          }
                          onChange={event => {
                            setActivationSaved(false);
                            setAssignmentDrafts(current => ({
                              ...current,
                              [workflow.id]: {
                                courseRunId: selectedCourseRun?.id ?? "",
                                classGroupId: event.target.value,
                              },
                            }));
                          }}
                        >
                          <option value="">Select a class</option>
                          {classGroups.length ? (
                            classGroups.map(group => (
                              <option key={group.id} value={group.id}>
                                {group.name} · {group.studentIds.length}/
                                {group.capacity}
                              </option>
                            ))
                          ) : (
                            <option value="" disabled>
                              {selectedCourseRun
                                ? "No active class with an open seat"
                                : "Select a course run first"}
                            </option>
                          )}
                        </select>
                      </label>
                      <p className="registrar-enrollment-availability">
                        {selectedClassGroup
                          ? `${selectedClassGroup.schedule} · ${Math.max(0, selectedClassGroup.capacity - selectedClassGroup.studentIds.length)} seats available`
                          : selectedCourseRun
                            ? "Select an active class with an open seat."
                            : "Select the exact course run, then choose a class."}
                      </p>
                      <div className="registrar-enrollment-actions">
                        <button
                          type="submit"
                          className="platform-primary-button"
                          disabled={!canActivate || isAnyActionPending}
                        >
                          <UserPlus size={15} />
                          {isActionPending(`enrollment.activate:${workflow.id}`)
                            ? "Activating learner"
                            : "Activate enrollment"}
                        </button>
                      </div>
                    </form>
                  )}
                </section>
              )
            ) : (
              <section className="platform-empty-state">
                <strong>This enrollment handoff is not available.</strong>
                <span>Return to the enrollment list and choose another learner.</span>
              </section>
            )
          }
        />
      </PlatformShell>
    );
  }

  return (
    <PlatformShell role="registrar" title="Enrollments">
      <WorkspaceLayout
        className="registrar-enrollments-page"
        title="Enrollments"
        description="Open one prepared learner and complete their class placement."
        context="Registrar"
        actions={
          <Link className="platform-secondary-button" href="/app/registrar/enrollments/records">
            Manage active enrollments
          </Link>
        }
        main={
          <DataTableCard
            title="Enrollment handoffs"
            subtitle={`${readyWorkflows.length} ready to enroll`}
          >
            <div
              className="platform-row-list registrar-enrollment-list"
              data-testid="registrar-enrollment-list"
            >
              {state.enrollmentWorkflows.length ? (
                state.enrollmentWorkflows.map(item => {
                  const workflowLead = state.leads.find(
                    leadItem => leadItem.id === item.leadId
                  );
                  const workflowStudent = state.students.find(
                    studentItem => studentItem.id === item.studentId
                  );
                  const workflowUser = state.users.find(
                    userItem => userItem.id === workflowStudent?.userId
                  );
                  const workflowCourse = state.courses.find(
                    courseItem => courseItem.id === item.targetCourseId
                  );
                  const active = Boolean(item.studentId && workflowStudent);
                  return (
                    <Link
                      key={item.id}
                      className="registrar-enrollment-row-link"
                      href={`/app/registrar/enrollments/${item.id}`}
                    >
                      <div>
                        <strong>
                          {workflowLead?.fullName ?? workflowUser?.name ?? "Learner"}
                        </strong>
                        <small>
                          {workflowCourse?.title ?? "Course not set"} · {item.nextStep}
                        </small>
                      </div>
                      <StatusBadge tone={statusTone(active ? "active" : item.status)}>
                        {humanize(active ? "active" : item.status)}
                      </StatusBadge>
                    </Link>
                  );
                })
              ) : (
                <article>
                  <div>
                    <strong>No enrollment handoffs</strong>
                    <small>Convert a lead or record placement to prepare enrollment.</small>
                  </div>
                </article>
              )}
            </div>
          </DataTableCard>
        }
      />
    </PlatformShell>
  );
}
