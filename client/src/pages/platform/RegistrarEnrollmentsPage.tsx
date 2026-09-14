import { getStoredAuthSession, requireActiveUser } from "@/lib/auth/session";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import NccReadStatus from "@/components/platform/NccReadStatus";
import PlatformShell from "@/components/platform/PlatformShell";
import {
  DetailLayout,
  WorkspaceLayout,
} from "@/components/platform/PlatformLayouts";
import {
  DataTableCard,
  StatusBadge,
} from "@/components/platform/PlatformPrimitives";
import {
  completeNccClassEnrolmentRequest,
  createNccClassEnrolmentRequest,
  fetchNccClassEnrolmentsRequest,
  fetchNccClassesRequest,
  fetchNccStudentsRequest,
  runPlatformWorkflowActionRequest,
  withdrawNccClassEnrolmentRequest,
  type NccClassDto,
  type NccClassEnrolmentDto,
  type NccStudentDto,
} from "@/lib/backend/api";
import {
  classifyNccFailure,
  type NccReadState,
} from "@/lib/backend/nccReadState";
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

export default function RegistrarEnrollmentsPage(
  props: RegistrarEnrollmentsPageProps
) {
  return getStoredAuthSession()?.provider === "ncc" ? (
    <NccRegistrarEnrollmentsPage {...props} />
  ) : (
    <CompatibilityRegistrarEnrollmentsPage {...props} />
  );
}

type NccEnrollmentDesk = {
  students: NccStudentDto[];
  classes: NccClassDto[];
  enrolments: NccClassEnrolmentDto[];
};

function NccRegistrarEnrollmentsPage({
  workflowId,
}: RegistrarEnrollmentsPageProps) {
  const [readState, setReadState] = useState<NccReadState<NccEnrollmentDesk>>({
    status: "loading",
  });
  const [selectedClassId, setSelectedClassId] = useState("");
  const [pendingAction, setPendingAction] = useState(false);
  const [message, setMessage] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  const load = useCallback(async () => {
    setReadState({ status: "loading" });
    const [studentsResult, classesResult] = await Promise.all([
      fetchNccStudentsRequest(),
      fetchNccClassesRequest(),
    ]);
    for (const result of [studentsResult, classesResult]) {
      if (!result.ok || !result.data) {
        setReadState(classifyNccFailure(result));
        return;
      }
    }
    const classes = classesResult.data!.items;
    const enrolmentResults = await Promise.all(
      classes.map(item => fetchNccClassEnrolmentsRequest(item.id))
    );
    for (const result of enrolmentResults) {
      if (!result.ok || !result.data) {
        setReadState(classifyNccFailure(result));
        return;
      }
    }
    setReadState({
      status: "ready",
      data: {
        students: studentsResult.data!.items,
        classes,
        enrolments: enrolmentResults.flatMap(result => result.data!.items),
      },
    });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const data = readState.status === "ready" ? readState.data : null;
  const isAnyActionPending = pendingAction;

  const runAction = async (
    action: () => Promise<
      | { ok: true; data?: unknown }
      | { ok: false; status?: number; error?: string }
    >,
    successText: string,
    toastText: string
  ) => {
    setPendingAction(true);
    setMessage(null);
    const result = await action();
    setPendingAction(false);
    if (result.ok) {
      setMessage({ kind: "success", text: successText });
      toast.success(toastText);
      void load();
    } else {
      const text =
        "error" in result && result.error
          ? result.error
          : "Enrollment action failed.";
      setMessage({ kind: "error", text });
      toast.error(text);
    }
  };

  if (workflowId) {
    const student = data?.students.find(item => item.id === workflowId);
    const studentEnrolments = data
      ? data.enrolments.filter(item => item.studentId === workflowId)
      : [];
    const activeClasses = data
      ? data.classes.filter(item => item.status === "active")
      : [];
    const enrollableClasses = activeClasses.filter(
      classRecord =>
        !studentEnrolments.some(
          enrolment =>
            enrolment.classId === classRecord.id &&
            (enrolment.status === "pending" ||
              enrolment.status === "enrolled")
        )
    );
    const chosenClass =
      enrollableClasses.find(item => item.id === selectedClassId) ??
      enrollableClasses[0];
    const blockedReason = !student
      ? ""
      : student.status !== "active"
        ? "This student is disabled."
        : !student.moodleLinked
          ? "A Moodle account is required before enrollment."
          : !activeClasses.length
            ? "No active classes are available."
            : !enrollableClasses.length
              ? "This learner is already enrolled in every active class."
              : "";

    return (
      <PlatformShell role="registrar" title="Enrollment record">
        <DetailLayout
          className="registrar-enrollment-detail-page"
          title={student?.name ?? "Enrollment record"}
          description={student?.email ?? "Student enrollment"}
          context="Enrollment"
          actions={
            <Link
              className="platform-secondary-button"
              href="/app/registrar/enrollments"
            >
              Back to enrollments
            </Link>
          }
          main={
            !data ? (
              <NccReadStatus state={readState} onRetry={() => void load()} />
            ) : !student ? (
              <section className="platform-empty-state">
                <strong>Enrollment record not found</strong>
                <Link
                  className="platform-secondary-button"
                  href="/app/registrar/enrollments"
                >
                  Back to enrollments
                </Link>
              </section>
            ) : (
              <div className="portal-simple-stack">
                <DataTableCard
                  title="Current enrollments"
                  subtitle={`${studentEnrolments.length} records`}
                  className="teacher-class-record-card"
                >
                  {studentEnrolments.length ? (
                    <div className="teacher-class-record-list">
                      {studentEnrolments.map(enrolment => {
                        const active =
                          enrolment.status === "pending" ||
                          enrolment.status === "enrolled";
                        return (
                          <article key={`${enrolment.classId}`}>
                            <div className="teacher-class-record-copy">
                              <span>{enrolment.courseName}</span>
                              <strong>{enrolment.className}</strong>
                              <p>
                                Moodle{" "}
                                {enrolment.student.moodleLinked
                                  ? "Linked"
                                  : "Not linked"}
                              </p>
                            </div>
                            <div className="teacher-class-record-actions">
                              <StatusBadge tone={statusTone(enrolment.status)}>
                                {enrolment.status}
                              </StatusBadge>
                              {active ? (
                                <>
                                  <button
                                    type="button"
                                    className="platform-secondary-button"
                                    disabled={isAnyActionPending}
                                    onClick={() =>
                                      void runAction(
                                        () =>
                                          withdrawNccClassEnrolmentRequest(
                                            enrolment.classId,
                                            enrolment.studentId
                                          ),
                                        "Enrollment withdrawn.",
                                        "Enrollment withdrawn"
                                      )
                                    }
                                  >
                                    Withdraw
                                  </button>
                                  <button
                                    type="button"
                                    className="platform-secondary-button"
                                    disabled={isAnyActionPending}
                                    onClick={() =>
                                      void runAction(
                                        () =>
                                          completeNccClassEnrolmentRequest(
                                            enrolment.classId,
                                            enrolment.studentId
                                          ),
                                        "Enrollment completed.",
                                        "Enrollment completed"
                                      )
                                    }
                                  >
                                    Complete
                                  </button>
                                </>
                              ) : null}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="platform-empty-state">
                      <strong>No enrolments yet</strong>
                    </div>
                  )}
                </DataTableCard>

                <DataTableCard
                  title="Enroll in class"
                  subtitle="Assign this learner to an active class"
                  className="teacher-class-record-card"
                >
                  <form
                    className="registrar-enrollment-form"
                    data-testid="registrar-enrollment-form"
                    onSubmit={event => {
                      event.preventDefault();
                      if (!chosenClass) return;
                      void runAction(
                        () =>
                          createNccClassEnrolmentRequest(chosenClass.id, {
                            studentId: student.id,
                            status: "enrolled",
                          }),
                        "Learner enrolled.",
                        "Learner enrolled"
                      );
                    }}
                  >
                    <label>
                      Class
                      <select
                        value={chosenClass?.id ?? ""}
                        disabled={
                          isAnyActionPending || !enrollableClasses.length
                        }
                        onChange={event =>
                          setSelectedClassId(event.target.value)
                        }
                        data-testid="registrar-enroll-class"
                      >
                        {enrollableClasses.length ? (
                          enrollableClasses.map(item => (
                            <option key={item.id} value={item.id}>
                              {item.name} · {item.activeEnrolmentCount}/
                              {item.capacity}
                            </option>
                          ))
                        ) : (
                          <option value="" disabled>
                            {activeClasses.length
                              ? "No other active classes"
                              : "No active classes"}
                          </option>
                        )}
                      </select>
                    </label>
                    {blockedReason ? (
                      <p role="status">{blockedReason}</p>
                    ) : null}
                    <div className="registrar-enrollment-actions">
                      <button
                        type="submit"
                        className="platform-primary-button"
                        disabled={
                          isAnyActionPending || !chosenClass || !!blockedReason
                        }
                      >
                        <UserPlus size={15} />
                        {pendingAction ? "Saving" : "Enroll learner"}
                      </button>
                    </div>
                  </form>
                </DataTableCard>

                {message ? (
                  <p role={message.kind === "error" ? "alert" : "status"}>
                    {message.text}
                  </p>
                ) : null}
              </div>
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
        description="Review each learner's class status."
        context="Registrar"
        main={
          readState.status !== "ready" ? (
            <NccReadStatus state={readState} onRetry={() => void load()} />
          ) : (
            <DataTableCard
              title="Student enrollments"
              subtitle={`${data!.students.length} learners`}
            >
              {data!.students.length ? (
                <div className="teacher-class-record-list">
                  {data!.students.map(student => {
                    const activeEnrolments = data!.enrolments.filter(
                      item =>
                        item.studentId === student.id &&
                        (item.status === "pending" ||
                          item.status === "enrolled")
                    );
                    return (
                      <article key={student.id}>
                        <div className="teacher-class-record-copy">
                          <span>{student.email}</span>
                          <strong>{student.name}</strong>
                          <p>
                            {activeEnrolments.length
                              ? activeEnrolments
                                  .map(
                                    item => `${item.className} · ${item.status}`
                                  )
                                  .join(", ")
                              : "No active class"}
                          </p>
                        </div>
                        <div className="teacher-class-record-actions">
                          <StatusBadge tone={statusTone(student.status)}>
                            {student.status}
                          </StatusBadge>
                          <Link
                            className="platform-secondary-button"
                            href={`/app/registrar/enrollments/${student.id}`}
                          >
                            Manage enrollment
                          </Link>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="platform-empty-state">
                  <strong>No students available for enrollment.</strong>
                </div>
              )}
            </DataTableCard>
          )
        }
      />
    </PlatformShell>
  );
}

function CompatibilityRegistrarEnrollmentsPage({
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
