import { useMemo, useState, type FormEvent } from "react";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UserPlus,
  Users,
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

type RegistrarStudentsPageProps = {
  view?: "list" | "detail";
  studentId?: string;
};

type StudentDraft = {
  fullName: string;
  email: string;
  phone: string;
  branchId: string;
  preferredLanguage: string;
  courseInterest: string;
  ageGroup: string;
  guardianName: string;
  guardianPhone: string;
  currentLevel: string;
  status: Extract<
    StudentStatus,
    "ready_to_enroll" | "enrolled" | "active" | "paused"
  >;
  notes: string;
  courseRunId: string;
  classGroupId: string;
};

function isMinorAgeGroup(ageGroup: string) {
  return /minor|child|teen/i.test(ageGroup);
}

function humanize(value?: string) {
  if (!value) return "Not set";
  return value.replaceAll("_", " ").replaceAll("-", " ");
}

function statusTone(status: string): "green" | "amber" | "red" | "slate" {
  if (["active", "completed", "enrolled"].includes(status)) return "green";
  if (["ready_to_enroll", "pending", "placement_booked"].includes(status)) {
    return "amber";
  }
  if (["paused", "cancelled"].includes(status)) return "red";
  return "slate";
}

export default function RegistrarStudentsPage({
  view = "list",
  studentId,
}: RegistrarStudentsPageProps) {
  const [version, setVersion] = useState(0);
  const [search, setSearch] = useState("");
  const [pendingAction, setPendingAction] = useState("");
  const [studentStatusDrafts, setStudentStatusDrafts] = useState<
    Record<string, StudentStatus>
  >({});
  const [studentDraft, setStudentDraft] = useState<StudentDraft>({
    fullName: "",
    email: "",
    phone: "",
    branchId: "br_online",
    preferredLanguage: "English",
    courseInterest: "Arabic Language",
    ageGroup: "Adult",
    guardianName: "",
    guardianPhone: "",
    currentLevel: "Arabic Level 3",
    status: "active",
    notes: "",
    courseRunId: "run_ar_l3_2026",
    classGroupId: "class_ar_l3_a",
  });
  const state = useMemo(() => platformStore.getState(), [version]);
  const actorId = getDemoUser("registrar").id;
  const refresh = () => setVersion(current => current + 1);
  const isAnyActionPending = Boolean(pendingAction);

  const studentCreateCourseRuns = state.courseRuns.filter(
    run => run.branchId === studentDraft.branchId
  );
  const selectedStudentCreateRun =
    studentCreateCourseRuns.find(run => run.id === studentDraft.courseRunId) ??
    studentCreateCourseRuns[0] ??
    state.courseRuns[0];
  const studentCreateClassGroups = state.classGroups.filter(
    group => group.courseRunId === selectedStudentCreateRun?.id
  );
  const studentCreateAvailableClassGroups = studentCreateClassGroups.filter(
    group => group.studentIds.length < group.capacity
  );
  const selectedStudentCreateClass =
    studentCreateAvailableClassGroups.find(
      group => group.id === studentDraft.classGroupId
    ) ?? studentCreateAvailableClassGroups[0];

  const studentRows = state.students
    .map(student => {
      const user = state.users.find(item => item.id === student.userId);
      const enrollment = state.enrollments.find(
        item => item.studentId === student.id
      );
      const run = state.courseRuns.find(
        item => item.id === enrollment?.courseRunId
      );
      const course = state.courses.find(item => item.id === run?.courseId);
      const classGroup = state.classGroups.find(
        item => item.id === enrollment?.classGroupId
      );
      const branch = state.branches.find(item => item.id === user?.branchId);
      return { student, user, enrollment, run, course, classGroup, branch };
    })
    .filter(row => {
      const query = search.trim().toLowerCase();
      if (!query) return true;
      return [
        row.user?.name,
        row.user?.email,
        row.user?.phone,
        row.student.status,
        row.student.currentLevel,
        row.course?.title,
        row.classGroup?.name,
        row.branch?.name,
      ]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(query));
    });

  const selectedStudent = studentId
    ? state.students.find(student => student.id === studentId)
    : undefined;
  const selectedStudentUser = state.users.find(
    user => user.id === selectedStudent?.userId
  );
  const selectedStudentEnrollments = state.enrollments.filter(
    enrollment => enrollment.studentId === selectedStudent?.id
  );
  const selectedStudentDetailRows = selectedStudentEnrollments.map(
    enrollment => {
      const run = state.courseRuns.find(
        item => item.id === enrollment.courseRunId
      );
      const course = state.courses.find(item => item.id === run?.courseId);
      const classGroup =
        state.classGroups.find(item => item.id === enrollment.classGroupId) ??
        state.classGroups.find(
          item =>
            item.courseRunId === run?.id &&
            item.studentIds.includes(enrollment.studentId)
        );
      const teacher = state.users.find(
        item => item.id === (enrollment.teacherId ?? run?.teacherId)
      );
      return { enrollment, run, course, classGroup, teacher };
    }
  );
  const selectedStudentPlacement = state.placementTests.find(booking =>
    selectedStudentUser
      ? booking.email.toLowerCase() === selectedStudentUser.email.toLowerCase()
      : false
  );
  const selectedStudentPlacementResult = state.placementResults.find(
    result => result.bookingId === selectedStudentPlacement?.id
  );
  const selectedStudentWorkflow = state.enrollmentWorkflows.find(
    workflow =>
      workflow.studentId === selectedStudent?.id ||
      selectedStudentDetailRows.some(
        row =>
          workflow.classGroupId === row.enrollment.classGroupId ||
          workflow.courseRunId === row.enrollment.courseRunId
      )
  );
  const selectedStudentPrimaryConnection = selectedStudentDetailRows[0];
  const selectedStudentLevelLabel =
    selectedStudentPlacementResult?.recommendedLevel ??
    selectedStudent?.currentLevel ??
    selectedStudentWorkflow?.recommendedLevel ??
    "Level pending";
  const selectedStudentNextAction = !selectedStudentUser
    ? "Create profile"
    : selectedStudentPlacement && !selectedStudentPlacementResult
      ? "Record placement result"
      : !selectedStudentEnrollments.length
        ? "Create enrollment"
        : !selectedStudentPrimaryConnection?.classGroup
          ? "Assign class"
          : !selectedStudentPrimaryConnection?.teacher
            ? "Assign teacher through class"
            : selectedStudent?.status !== "active"
              ? "Activate portal"
              : "Monitor progress";
  const selectedStudentAuditRows = state.auditLogs
    .filter(
      audit =>
        audit.entityId === selectedStudent?.id ||
        audit.entityId === selectedStudentUser?.id ||
        selectedStudentEnrollments.some(
          enrollment => audit.entityId === enrollment.id
        ) ||
        audit.summary.includes(selectedStudentUser?.name ?? "__no_student__")
    )
    .slice(0, 5);

  const runRegistrarAction = async (
    actionKey: string,
    action: Parameters<typeof runPlatformWorkflowActionRequest>[0],
    successMessage: string,
    successDescription?: string
  ) => {
    setPendingAction(actionKey);
    try {
      const response = await runPlatformWorkflowActionRequest(action);
      if (!response.data) {
        throw new Error(response.error ?? "Registrar action returned no state.");
      }
      platformStore.setState(response.data.state);
      refresh();
      toast.success(
        successMessage,
        successDescription ? { description: successDescription } : undefined
      );
      return response.data.result;
    } catch (error) {
      toast.error("Registrar action could not be saved", {
        description:
          error instanceof Error
            ? error.message
            : "Check your session and try again.",
      });
      return undefined;
    } finally {
      setPendingAction("");
    }
  };

  const createStudent = async (event: FormEvent) => {
    event.preventDefault();
    const courseRunId =
      selectedStudentCreateRun?.id ?? studentDraft.courseRunId;
    const classGroupId =
      selectedStudentCreateClass?.id ?? studentDraft.classGroupId;
    const fullName = studentDraft.fullName.trim();
    const email = studentDraft.email.trim().toLowerCase();
    const phone = studentDraft.phone.trim();
    const courseInterest = studentDraft.courseInterest.trim();
    const currentLevel = studentDraft.currentLevel.trim();

    if (!fullName || !email || !phone) {
      toast.error("Student name, email, and phone are required");
      return;
    }
    if (!email.includes("@")) {
      toast.error("Enter a valid student email address");
      return;
    }
    if (state.users.some(user => user.email.toLowerCase() === email)) {
      toast.error("This student email is already in the identity directory");
      return;
    }
    if (!courseInterest) {
      toast.error("Subject or course interest is required");
      return;
    }
    if (!currentLevel) {
      toast.error("Current level or placement result is required");
      return;
    }
    if (
      isMinorAgeGroup(studentDraft.ageGroup) &&
      (!studentDraft.guardianName.trim() || !studentDraft.guardianPhone.trim())
    ) {
      toast.error("Guardian name and phone are required for minor students");
      return;
    }
    if (!courseRunId || !classGroupId) {
      toast.error(
        "Choose a course run and class group before creating the student"
      );
      return;
    }
    if (selectedStudentCreateRun?.branchId !== studentDraft.branchId) {
      toast.error("Student branch must match the selected course run");
      return;
    }
    if (
      !selectedStudentCreateClass ||
      selectedStudentCreateClass.courseRunId !== courseRunId
    ) {
      toast.error(
        "Selected class group must belong to the selected course run"
      );
      return;
    }
    if (
      selectedStudentCreateClass.studentIds.length >=
      selectedStudentCreateClass.capacity
    ) {
      toast.error("Selected class is already at capacity");
      return;
    }

    const result = await runRegistrarAction(
      "student.create",
      {
        type: "student.create",
        fullName,
        email,
        phone,
        branchId: studentDraft.branchId,
        preferredLanguage: studentDraft.preferredLanguage,
        courseInterest,
        ageGroup: studentDraft.ageGroup,
        guardianName: studentDraft.guardianName.trim() || undefined,
        guardianPhone: studentDraft.guardianPhone.trim() || undefined,
        currentLevel,
        status: studentDraft.status,
        notes: studentDraft.notes.trim() || undefined,
        courseRunId,
        classGroupId,
        source: "direct",
        actorId,
      },
      "Student created and enrolled",
      "Identity, enrollment, class roster, teacher link, lesson path, and invoice were created."
    );
    if (result) {
      setStudentDraft(value => ({
        ...value,
        fullName: "",
        email: "",
        phone: "",
        guardianName: "",
        guardianPhone: "",
        notes: "",
      }));
    }
  };

  const updateStudentStatus = async (targetStudentId: string) => {
    const nextStatus =
      studentStatusDrafts[targetStudentId] ??
      state.students.find(student => student.id === targetStudentId)?.status;
    if (!nextStatus) return;
    await runRegistrarAction(
      `student.status.update:${targetStudentId}`,
      {
        type: "student.status.update",
        studentId: targetStudentId,
        status: nextStatus,
        notes: "Updated from registrar student detail.",
        actorId,
      },
      "Student status updated"
    );
  };

  const createForm = (
    <section className="registrar-panel registrar-student-create-panel">
      <div className="registrar-panel-head">
        <div>
          <span>Direct student creation</span>
          <strong>Profile, enrollment, class, teacher, and portal</strong>
        </div>
        <UserPlus size={18} />
      </div>
      <form className="registrar-student-create-form" onSubmit={createStudent}>
        <label>
          Full name
          <input
            value={studentDraft.fullName}
            onChange={event =>
              setStudentDraft(value => ({
                ...value,
                fullName: event.target.value,
              }))
            }
            placeholder="Student full name"
          />
        </label>
        <label>
          Email
          <input
            type="email"
            value={studentDraft.email}
            onChange={event =>
              setStudentDraft(value => ({
                ...value,
                email: event.target.value,
              }))
            }
            placeholder="student@nilelearn.local"
          />
        </label>
        <label>
          Phone / WhatsApp
          <input
            value={studentDraft.phone}
            onChange={event =>
              setStudentDraft(value => ({
                ...value,
                phone: event.target.value,
              }))
            }
            placeholder="+20..."
          />
        </label>
        <label>
          Branch
          <select
            value={studentDraft.branchId}
            onChange={event => {
              const branchId = event.target.value;
              const run =
                state.courseRuns.find(item => item.branchId === branchId) ??
                state.courseRuns[0];
              const group =
                state.classGroups.find(
                  item =>
                    item.courseRunId === run?.id &&
                    item.studentIds.length < item.capacity
                ) ?? undefined;
              setStudentDraft(value => ({
                ...value,
                branchId,
                courseRunId: run?.id ?? "",
                classGroupId: group?.id ?? "",
              }));
            }}
          >
            {state.branches.map(branch => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Preferred language
          <select
            value={studentDraft.preferredLanguage}
            onChange={event =>
              setStudentDraft(value => ({
                ...value,
                preferredLanguage: event.target.value,
              }))
            }
          >
            <option value="English">English</option>
            <option value="Arabic">Arabic</option>
            <option value="Turkish">Turkish</option>
            <option value="Russian">Russian</option>
          </select>
        </label>
        <label>
          Subject / course interest
          <input
            value={studentDraft.courseInterest}
            onChange={event =>
              setStudentDraft(value => ({
                ...value,
                courseInterest: event.target.value,
              }))
            }
          />
        </label>
        <label>
          Age group
          <select
            value={studentDraft.ageGroup}
            onChange={event =>
              setStudentDraft(value => ({
                ...value,
                ageGroup: event.target.value,
              }))
            }
          >
            <option value="Adult">Adult</option>
            <option value="Teen minor">Teen minor</option>
            <option value="Child minor">Child minor</option>
          </select>
        </label>
        <label>
          Current level / placement
          <input
            value={studentDraft.currentLevel}
            onChange={event =>
              setStudentDraft(value => ({
                ...value,
                currentLevel: event.target.value,
              }))
            }
            placeholder="Arabic Level 3"
          />
        </label>
        <label>
          Course run
          <select
            value={selectedStudentCreateRun?.id ?? ""}
            onChange={event => {
              const runId = event.target.value;
              const group =
                state.classGroups.find(
                  item =>
                    item.courseRunId === runId &&
                    item.studentIds.length < item.capacity
                ) ?? undefined;
              setStudentDraft(value => ({
                ...value,
                courseRunId: runId,
                classGroupId: group?.id ?? "",
              }));
            }}
          >
            {studentCreateCourseRuns.length ? (
              studentCreateCourseRuns.map(run => {
                const course = state.courses.find(
                  item => item.id === run.courseId
                );
                return (
                  <option key={run.id} value={run.id}>
                    {course?.title ?? run.courseId} · {run.term}
                  </option>
                );
              })
            ) : (
              <option value="">No course runs in branch</option>
            )}
          </select>
        </label>
        <label>
          Class / group
          <select
            value={selectedStudentCreateClass?.id ?? ""}
            onChange={event =>
              setStudentDraft(value => ({
                ...value,
                classGroupId: event.target.value,
              }))
            }
          >
            {studentCreateClassGroups.length ? (
              studentCreateClassGroups.map(group => (
                <option key={group.id} value={group.id}>
                  {group.name} · {group.studentIds.length}/{group.capacity}
                </option>
              ))
            ) : (
              <option value="">No class groups</option>
            )}
          </select>
        </label>
        <label>
          Student status
          <select
            value={studentDraft.status}
            onChange={event =>
              setStudentDraft(value => ({
                ...value,
                status: event.target.value as StudentDraft["status"],
              }))
            }
          >
            <option value="active">Active portal</option>
            <option value="enrolled">Enrolled</option>
            <option value="ready_to_enroll">Ready to enroll</option>
            <option value="paused">Paused</option>
          </select>
        </label>
        <label>
          Guardian name
          <input
            value={studentDraft.guardianName}
            onChange={event =>
              setStudentDraft(value => ({
                ...value,
                guardianName: event.target.value,
              }))
            }
            placeholder="Required for minors"
          />
        </label>
        <label>
          Guardian phone
          <input
            value={studentDraft.guardianPhone}
            onChange={event =>
              setStudentDraft(value => ({
                ...value,
                guardianPhone: event.target.value,
              }))
            }
            placeholder="Required for minors"
          />
        </label>
        <label className="wide">
          Notes
          <input
            value={studentDraft.notes}
            onChange={event =>
              setStudentDraft(value => ({
                ...value,
                notes: event.target.value,
              }))
            }
            placeholder="Placement, schedule, guardian, or class notes"
          />
        </label>
        <div className="registrar-student-create-summary">
          <span>
            {selectedStudentCreateClass
              ? `${Math.max(0, selectedStudentCreateClass.capacity - selectedStudentCreateClass.studentIds.length)} seats left`
              : "No available class selected"}
          </span>
          <small>
            {selectedStudentCreateClass?.schedule ??
              "Choose a class group with an open seat"}{" "}
            · teacher{" "}
            {state.users.find(
              user => user.id === selectedStudentCreateRun?.teacherId
            )?.name ?? "pending"}
          </small>
        </div>
        <button
          type="submit"
          disabled={
            isAnyActionPending ||
            !selectedStudentCreateRun ||
            !selectedStudentCreateClass
          }
        >
          <UserPlus size={15} />
          {pendingAction === "student.create" ? "Creating..." : "Create and enroll"}
        </button>
      </form>
    </section>
  );

  const studentList = (
    <DataTableCard
      title="Student records"
      subtitle={`${studentRows.length} student(s)`}
      className="portal-ia-table-card registrar-students-table"
    >
      <div className="portal-ia-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Branch</th>
              <th>Course</th>
              <th>Class</th>
              <th>Status</th>
              <th>Open</th>
            </tr>
          </thead>
          <tbody>
            {studentRows.map(({ student, user, branch, course, classGroup }) => (
              <tr key={student.id}>
                <td>
                  <strong>{user?.name ?? student.id}</strong>
                  <small>{user?.email ?? "No email"}</small>
                </td>
                <td>{branch?.name ?? "No branch"}</td>
                <td>{course?.title ?? student.courseInterest ?? "No course"}</td>
                <td>{classGroup?.name ?? "Class pending"}</td>
                <td>
                  <StatusBadge tone={statusTone(student.status)}>
                    {humanize(student.status)}
                  </StatusBadge>
                </td>
                <td>
                  <Link
                    className="platform-row-link"
                    href={`/app/registrar/students/${student.id}`}
                  >
                    Details
                    <ArrowRight size={13} />
                  </Link>
                </td>
              </tr>
            ))}
            {!studentRows.length ? (
              <tr>
                <td colSpan={6}>
                  <div className="platform-empty-state">
                    <strong>No students found</strong>
                    <span>Try a different search term.</span>
                  </div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </DataTableCard>
  );

  if (view === "detail") {
    const detailMain = selectedStudent ? (
      <div className="registrar-student-detail-workspace">
        <section>
          <div className="registrar-panel-head compact">
            <div>
              <span>Lifecycle</span>
              <strong>Admissions to active portal</strong>
            </div>
            <CheckCircle2 size={16} />
          </div>
          <div className="registrar-lifecycle-rail">
            {[
              ["Profile", selectedStudentUser ? "done" : "pending"],
              ["Level", selectedStudent.currentLevel ? "done" : "pending"],
              [
                "Enrollment",
                selectedStudentEnrollments.length ? "done" : "pending",
              ],
              [
                "Class",
                selectedStudentDetailRows.some(row => row.classGroup)
                  ? "done"
                  : "pending",
              ],
              [
                "Teacher",
                selectedStudentDetailRows.some(row => row.teacher)
                  ? "done"
                  : "pending",
              ],
              [
                "Portal",
                selectedStudent.status === "active" ? "done" : "pending",
              ],
            ].map(([label, status]) => (
              <article key={label}>
                <span className={status}>{status}</span>
                <strong>{label}</strong>
              </article>
            ))}
          </div>
        </section>
        <section>
          <div className="registrar-panel-head compact">
            <div>
              <span>Manage status</span>
              <strong>{selectedStudentUser?.name ?? selectedStudent.id}</strong>
            </div>
            <SlidersHorizontal size={16} />
          </div>
          <div className="registrar-student-status-control">
            <label>
              Student status
              <select
                value={
                  studentStatusDrafts[selectedStudent.id] ??
                  selectedStudent.status
                }
                disabled={isAnyActionPending}
                onChange={event =>
                  setStudentStatusDrafts(current => ({
                    ...current,
                    [selectedStudent.id]: event.target.value as StudentStatus,
                  }))
                }
              >
                {[
                  "ready_to_enroll",
                  "enrolled",
                  "active",
                  "paused",
                  "completed",
                  "cancelled",
                ].map(status => (
                  <option key={status} value={status}>
                    {humanize(status)}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={isAnyActionPending}
              onClick={() => updateStudentStatus(selectedStudent.id)}
            >
              {pendingAction === `student.status.update:${selectedStudent.id}`
                ? "Saving..."
                : "Save status"}
            </button>
          </div>
          <div className="registrar-student-next-action">
            <span>Next action</span>
            <strong>{selectedStudentNextAction}</strong>
          </div>
        </section>
        <section>
          <div className="registrar-panel-head compact">
            <div>
              <span>Placement and level</span>
              <strong>{selectedStudentLevelLabel}</strong>
            </div>
            <ClipboardCheck size={16} />
          </div>
          <div className="registrar-student-fact-list">
            <article>
              <span>Placement</span>
              <strong>{selectedStudentPlacement?.status ?? "Not booked"}</strong>
              <small>
                {selectedStudentPlacement?.preferredDate ??
                  "No placement booking linked"}
              </small>
            </article>
            <article>
              <span>Result</span>
              <strong>
                {selectedStudentPlacementResult
                  ? `${selectedStudentPlacementResult.score}%`
                  : "Pending"}
              </strong>
              <small>
                {selectedStudentPlacementResult?.notes ??
                  selectedStudentWorkflow?.nextStep ??
                  "Level can be set directly or from placement."}
              </small>
            </article>
          </div>
        </section>
        <section>
          <div className="registrar-panel-head compact">
            <div>
              <span>Course, class, teacher</span>
              <strong>
                {selectedStudentPrimaryConnection?.course?.title ??
                  "Assignment pending"}
              </strong>
            </div>
            <BookOpen size={16} />
          </div>
          <div className="registrar-student-fact-list">
            <article>
              <span>Class/group</span>
              <strong>
                {selectedStudentPrimaryConnection?.classGroup?.name ??
                  "Pending"}
              </strong>
              <small>
                {selectedStudentPrimaryConnection?.classGroup?.schedule ??
                  "Assign a class group to unlock schedule, attendance, and portal data."}
              </small>
            </article>
            <article>
              <span>Teacher</span>
              <strong>
                {selectedStudentPrimaryConnection?.teacher?.name ?? "Pending"}
              </strong>
              <small>
                {selectedStudentPrimaryConnection?.run
                  ? "Assigned through the class course run."
                  : "Teacher assignment happens through the class/group."}
              </small>
            </article>
          </div>
        </section>
        <section className="wide">
          <div className="registrar-panel-head compact">
            <div>
              <span>Enrollment panel</span>
              <strong>
                {selectedStudentDetailRows.length} active connection(s)
              </strong>
            </div>
            <UserPlus size={16} />
          </div>
          <div className="registrar-student-enrollment-list">
            {selectedStudentDetailRows.length ? (
              selectedStudentDetailRows.map(
                ({ enrollment, course, classGroup, teacher }) => (
                  <article key={enrollment.id}>
                    <div>
                      <strong>{course?.title ?? enrollment.courseRunId}</strong>
                      <small>
                        {classGroup?.name ??
                          enrollment.classGroupId ??
                          "Class pending"}{" "}
                        ·{" "}
                        {teacher?.name ?? enrollment.teacherId ?? "Teacher pending"}{" "}
                        · {classGroup?.schedule ?? "Schedule pending"}
                      </small>
                    </div>
                    <span>{humanize(enrollment.status)}</span>
                  </article>
                )
              )
            ) : (
              <article className="registrar-empty-row">
                <div>
                  <strong>No enrollment</strong>
                  <small>
                    Create or activate an enrollment before the student portal
                    is useful.
                  </small>
                </div>
              </article>
            )}
          </div>
        </section>
        <section className="wide">
          <div className="registrar-panel-head compact">
            <div>
              <span>Audit</span>
              <strong>Recent student transitions</strong>
            </div>
            <ShieldCheck size={16} />
          </div>
          <div className="admin-audit-list">
            {selectedStudentAuditRows.length ? (
              selectedStudentAuditRows.map(auditRow => (
                <article key={auditRow.id}>
                  <strong>{auditRow.action}</strong>
                  <small>{auditRow.summary}</small>
                  <span>{new Date(auditRow.createdAt).toLocaleString()}</span>
                </article>
              ))
            ) : (
              <article>
                <strong>student.ready</strong>
                <small>
                  Student lifecycle changes will appear here after status or
                  enrollment updates.
                </small>
                <span>Now</span>
              </article>
            )}
          </div>
        </section>
      </div>
    ) : (
      <DataTableCard
        title="Student not found"
        subtitle="No matching student record"
        className="portal-ia-table-card"
      >
        <div className="platform-empty-state">
          <strong>This student record does not exist.</strong>
          <span>Use the student records page to open a valid student.</span>
          <Link className="platform-row-link" href="/app/registrar/students">
            Back to students
          </Link>
        </div>
      </DataTableCard>
    );

    return (
      <PlatformShell role="registrar" title="Student detail">
        <DetailLayout
          className="portal-ia-page registrar-workspace registrar-students-page"
          title={selectedStudentUser?.name ?? "Student detail"}
          description="Review one student lifecycle record."
          actions={
            <Link
              className="platform-secondary-button"
              href="/app/registrar/students"
            >
              <ArrowRight size={15} />
              Back to students
            </Link>
          }
          main={detailMain}
          side={
            <section className="registrar-panel">
              <div className="registrar-panel-head compact">
                <div>
                  <span>Identity</span>
                  <strong>{selectedStudentUser?.email ?? "No account"}</strong>
                </div>
                <Users size={16} />
              </div>
              <div className="registrar-student-fact-list">
                <article>
                  <span>Status</span>
                  <strong>{humanize(selectedStudent?.status)}</strong>
                  <small>
                    {selectedStudent?.currentLevel ?? "Level pending"}
                  </small>
                </article>
                <article>
                  <span>Guardian</span>
                  <strong>{selectedStudent?.guardianName ?? "Not required"}</strong>
                  <small>
                    {selectedStudent?.guardianPhone ??
                      selectedStudentUser?.phone ??
                      "No guardian phone"}
                  </small>
                </article>
              </div>
            </section>
          }
        />
      </PlatformShell>
    );
  }

  return (
    <PlatformShell role="registrar" title="Students">
      <WorkspaceLayout
        className="portal-ia-page registrar-workspace registrar-students-page"
        title="Students"
        description="Create direct students and open focused student records."
        actions={
          <Link
            className="platform-secondary-button"
            href="/app/registrar/enrollments"
          >
            <ArrowRight size={15} />
            Enrollment handoff
          </Link>
        }
        toolbar={
          <div className="portal-ia-toolbar">
            <label className="portal-ia-search">
              <Search size={16} />
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Search students"
                aria-label="Search students"
              />
            </label>
          </div>
        }
        main={
          <div className="registrar-students-split">
            {createForm}
            {studentList}
          </div>
        }
        side={
          <section className="registrar-panel">
            <div className="registrar-panel-head compact">
              <div>
                <span>One job on this page</span>
                <strong>Direct student creation</strong>
              </div>
              <UserPlus size={16} />
            </div>
            <div className="registrar-student-fact-list">
              <article>
                <span>Students</span>
                <strong>{state.students.length}</strong>
                <small>Student profiles in the local platform state.</small>
              </article>
              <article>
                <span>Open classes</span>
                <strong>{studentCreateAvailableClassGroups.length}</strong>
                <small>Available for the selected branch and run.</small>
              </article>
            </div>
          </section>
        }
      />
    </PlatformShell>
  );
}
