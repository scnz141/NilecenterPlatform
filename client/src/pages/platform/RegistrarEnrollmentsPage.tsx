import { useMemo, useState } from "react";
import { CheckCircle2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import PlatformShell from "@/components/platform/PlatformShell";
import { WorkspaceLayout } from "@/components/platform/PlatformLayouts";
import { runPlatformWorkflowActionRequest } from "@/lib/backend/api";
import { platformStore } from "@/lib/domain/store";
import { getDemoUser } from "@/lib/platformData";

type AssignmentDraft = {
  courseRunId: string;
  classGroupId: string;
};

export default function RegistrarEnrollmentsPage() {
  const [version, setVersion] = useState(0);
  const [assignmentDrafts, setAssignmentDrafts] = useState<
    Record<string, AssignmentDraft>
  >({});
  const [pendingAction, setPendingAction] = useState("");

  const state = useMemo(() => platformStore.getState(), [version]);
  const actorId = getDemoUser("registrar").id;
  const refresh = () => setVersion(current => current + 1);
  const isAnyActionPending = Boolean(pendingAction);
  const isActionPending = (actionKey: string) => pendingAction === actionKey;
  const readyWorkflows = state.enrollmentWorkflows.filter(
    workflow => workflow.status === "ready_to_enroll"
  );
  const activeWorkflowCount = state.enrollmentWorkflows.filter(
    workflow => workflow.studentId
  ).length;

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
        description: "The student, enrollment, class, teacher, and invoice are connected.",
      });
    } catch (error) {
      toast.error("Enrollment could not be activated", {
        description:
          error instanceof Error
            ? error.message
            : "Check the selected class and try again.",
      });
    } finally {
      setPendingAction("");
    }
  };

  return (
    <PlatformShell role="registrar" title="Registrar enrollments">
      <WorkspaceLayout
        title="Enrollments"
        description="Activate prepared students into a course run and class."
        context="Registrar"
        main={
          <section className="registrar-panel">
            <div className="registrar-panel-head">
              <div>
                <span>Enrollment handoff</span>
                <strong>{readyWorkflows.length} ready</strong>
              </div>
              <UserPlus size={18} />
            </div>

            <div className="registrar-workflow-list">
              {state.enrollmentWorkflows.map(workflow => {
                const lead = state.leads.find(
                  item => item.id === workflow.leadId
                );
                const student = state.students.find(
                  item => item.id === workflow.studentId
                );
                const user = state.users.find(
                  item => item.id === student?.userId
                );
                const course = state.courses.find(
                  item => item.id === workflow.targetCourseId
                );
                const courseRuns = state.courseRuns.filter(
                  item => item.courseId === workflow.targetCourseId
                );
                const defaultCourseRun =
                  courseRuns.find(item => item.status === "active") ??
                  courseRuns[0];
                const draft = assignmentDrafts[workflow.id];
                const selectedCourseRun =
                  courseRuns.find(item => item.id === draft?.courseRunId) ??
                  defaultCourseRun;
                const classGroups = state.classGroups.filter(
                  item => item.courseRunId === selectedCourseRun?.id
                );
                const defaultClassGroup =
                  classGroups.find(
                    item => item.studentIds.length < item.capacity
                  ) ?? classGroups[0];
                const selectedClassGroup =
                  classGroups.find(item => item.id === draft?.classGroupId) ??
                  defaultClassGroup;
                const invoice = state.invoices.find(
                  item => item.studentId === student?.id
                );
                const isActivated = Boolean(workflow.studentId && student);
                const canActivate =
                  !isActivated &&
                  workflow.status === "ready_to_enroll" &&
                  Boolean(selectedCourseRun && selectedClassGroup);
                const assignment = {
                  courseRunId: selectedCourseRun?.id ?? "",
                  classGroupId: selectedClassGroup?.id ?? "",
                };

                return (
                  <article key={workflow.id}>
                    <div>
                      <strong>{lead?.fullName ?? user?.name ?? workflow.id}</strong>
                      <small>
                        {course?.title ?? "Course"} ·{" "}
                        {selectedClassGroup?.name ?? "Class pending"} ·{" "}
                        {workflow.nextStep}
                      </small>
                    </div>
                    <span>{isActivated ? "active" : workflow.status}</span>
                    {!isActivated ? (
                      <div className="registrar-workflow-assignment">
                        <label>
                          Run
                          <select
                            value={selectedCourseRun?.id ?? ""}
                            disabled={isAnyActionPending || !courseRuns.length}
                            onChange={event => {
                              const nextRunId = event.target.value;
                              const nextClassGroup =
                                state.classGroups.find(
                                  item =>
                                    item.courseRunId === nextRunId &&
                                    item.studentIds.length < item.capacity
                                ) ??
                                state.classGroups.find(
                                  item => item.courseRunId === nextRunId
                                );
                              setAssignmentDrafts(current => ({
                                ...current,
                                [workflow.id]: {
                                  courseRunId: nextRunId,
                                  classGroupId: nextClassGroup?.id ?? "",
                                },
                              }));
                            }}
                          >
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
                              <option value="">No course run</option>
                            )}
                          </select>
                        </label>
                        <label>
                          Class
                          <select
                            value={selectedClassGroup?.id ?? ""}
                            disabled={
                              isAnyActionPending || !classGroups.length
                            }
                            onChange={event =>
                              setAssignmentDrafts(current => ({
                                ...current,
                                [workflow.id]: {
                                  courseRunId: selectedCourseRun?.id ?? "",
                                  classGroupId: event.target.value,
                                },
                              }))
                            }
                          >
                            {classGroups.length ? (
                              classGroups.map(group => (
                                <option key={group.id} value={group.id}>
                                  {group.name} · {group.studentIds.length}/
                                  {group.capacity}
                                </option>
                              ))
                            ) : (
                              <option value="">No class</option>
                            )}
                          </select>
                        </label>
                        <small>
                          {selectedClassGroup
                            ? `${selectedClassGroup.schedule} · ${Math.max(0, selectedClassGroup.capacity - selectedClassGroup.studentIds.length)} seats left`
                            : "Create a class before activation."}
                        </small>
                      </div>
                    ) : null}
                    <button
                      type="button"
                      disabled={!canActivate || isAnyActionPending}
                      onClick={() => activateEnrollment(workflow.id, assignment)}
                    >
                      {isActionPending(`enrollment.activate:${workflow.id}`)
                        ? "Activating..."
                        : isActivated
                          ? `Invoice ${invoice?.status ?? "pending"}`
                          : "Activate"}
                    </button>
                  </article>
                );
              })}
              {state.enrollmentWorkflows.length === 0 ? (
                <article className="registrar-empty-row">
                  <div>
                    <strong>No enrollment handoffs</strong>
                    <small>
                      Convert a lead or record placement to prepare enrollment.
                    </small>
                  </div>
                </article>
              ) : null}
            </div>
          </section>
        }
        side={
          <section className="registrar-panel">
            <div className="registrar-panel-head">
              <div>
                <span>Status</span>
                <strong>Activation queue</strong>
              </div>
              <CheckCircle2 size={18} />
            </div>
            <div className="registrar-operations-list">
              <article>
                <strong>{state.enrollmentWorkflows.length} handoffs</strong>
                <small>Prepared from leads, applications, or placement tests.</small>
                <span>total</span>
              </article>
              <article>
                <strong>{readyWorkflows.length} ready</strong>
                <small>Waiting for course run and class confirmation.</small>
                <span>ready</span>
              </article>
              <article>
                <strong>{activeWorkflowCount} active</strong>
                <small>Already connected to student portals.</small>
                <span>active</span>
              </article>
            </div>
          </section>
        }
      />
    </PlatformShell>
  );
}
