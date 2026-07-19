import { useMemo, useState, type FormEvent } from "react";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import OperationalDirectoryTable from "@/components/platform/OperationalDirectoryTable";
import PlatformShell from "@/components/platform/PlatformShell";
import PendingMediaField from "@/components/platform/PendingMediaField";
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
import { platformStore } from "@/lib/domain/store";
import type {
  PendingMediaAttachment,
  StudentIntakeDocumentType,
  StudentStatus,
} from "@/lib/domain/types";
import { getDemoUser } from "@/lib/platformData";

type RegistrarStudentsPageProps = {
  view?: "list" | "detail" | "create";
  studentId?: string;
};

type StudentCreateStep = 1 | 2 | 3;

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

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join("")
    .toUpperCase();
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
  const [createStep, setCreateStep] = useState<StudentCreateStep>(1);
  const [createResult, setCreateResult] = useState<{
    studentId?: string;
    message: string;
  } | null>(null);
  const [pendingAction, setPendingAction] = useState("");
  const [studentDocumentType, setStudentDocumentType] =
    useState<StudentIntakeDocumentType>("profile_photo");
  const [studentDocumentFiles, setStudentDocumentFiles] = useState<
    PendingMediaAttachment[]
  >([]);
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

  const advanceCreateFlow = () => {
    if (
      createStep === 1 &&
      (!studentDraft.fullName.trim() ||
        !studentDraft.email.trim() ||
        !studentDraft.phone.trim())
    ) {
      toast.error(
        "Add the student's name, email, and phone before continuing."
      );
      return;
    }
    if (
      createStep === 2 &&
      (!selectedStudentCreateRun || !selectedStudentCreateClass)
    ) {
      toast.error("Choose a course run and class before continuing.");
      return;
    }
    setCreateStep(step => Math.min(3, step + 1) as StudentCreateStep);
  };

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
        item => item.id === (run?.teacherId ?? enrollment.teacherId)
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
  const selectedStudentDocuments = state.documents.filter(
    document => document.ownerId === selectedStudent?.id
  );

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
        throw new Error(
          response.error ?? "Registrar action returned no state."
        );
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
      setCreateResult({
        studentId: (result as { id?: string } | undefined)?.id,
        message:
          "The student is enrolled and ready for the next admissions step.",
      });
      setCreateStep(1);
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

  const addStudentDocument = async () => {
    const attachment = studentDocumentFiles[0];
    if (!selectedStudent || !attachment) {
      toast.error("Choose one student document first");
      return;
    }
    const result = await runRegistrarAction(
      `student.document.add:${selectedStudent.id}`,
      {
        type: "student.document.add",
        studentId: selectedStudent.id,
        documentType: studentDocumentType,
        attachment,
        actorId,
      },
      "Document metadata recorded",
      "The file is marked as pending storage. No file bytes were uploaded."
    );
    if (result) setStudentDocumentFiles([]);
  };

  const createForm = (
    <section className="registrar-panel registrar-student-create-panel">
      <div className="registrar-panel-head">
        <div>
          <span>Step {createStep} of 3</span>
          <strong>
            {createStep === 1
              ? "Student details"
              : createStep === 2
                ? "Learning placement"
                : "Family and review"}
          </strong>
        </div>
        <Link className="registrar-inline-close" href="/app/registrar/students">
          Cancel
        </Link>
      </div>
      <form className="registrar-student-create-form" onSubmit={createStudent}>
        <ol
          className="registrar-create-stepper"
          aria-label="Student creation steps"
        >
          {[
            { id: 1 as StudentCreateStep, label: "Details" },
            { id: 2 as StudentCreateStep, label: "Placement" },
            { id: 3 as StudentCreateStep, label: "Review" },
          ].map(({ id: step, label }) => (
            <li
              key={String(step)}
              className={
                step === createStep
                  ? "active"
                  : step < createStep
                    ? "complete"
                    : ""
              }
            >
              <span>{step}</span>
              {label}
            </li>
          ))}
        </ol>
        {createStep === 1 ? (
          <>
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
          </>
        ) : null}
        {createStep === 2 ? (
          <>
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
          </>
        ) : null}
        {createStep === 3 ? (
          <>
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
          </>
        ) : null}
        <div className="registrar-student-flow-actions">
          {createStep > 1 ? (
            <button
              type="button"
              className="platform-secondary-button"
              onClick={() =>
                setCreateStep(step => (step - 1) as StudentCreateStep)
              }
            >
              Back
            </button>
          ) : null}
          {createStep < 3 ? (
            <button type="button" onClick={advanceCreateFlow}>
              Continue
              <ArrowRight size={15} />
            </button>
          ) : (
            <button
              type="submit"
              disabled={
                isAnyActionPending ||
                !selectedStudentCreateRun ||
                !selectedStudentCreateClass
              }
            >
              <UserPlus size={15} />
              {pendingAction === "student.create"
                ? "Creating..."
                : "Create and enroll"}
            </button>
          )}
        </div>
      </form>
    </section>
  );

  const studentList = (
    <DataTableCard
      title="Student records"
      subtitle={`${studentRows.length} student(s)`}
      className="registrar-record-card registrar-students-record-card platform-directory-card registrar-directory-card-v2"
    >
      <div
        className="platform-directory-table-wrap"
        data-testid="registrar-students-list"
      >
        {studentRows.length ? (
          <OperationalDirectoryTable
            rows={studentRows}
            rowKey={row => row.student.id}
            className="registrar-directory-table-v2"
            getRowProps={row => ({
              "data-student-id": row.student.id,
            })}
            columns={[
              {
                key: "student",
                label: "Student",
                className: "platform-directory-col-person",
                render: ({ student, user }) => (
                  <div className="platform-directory-person">
                    <span aria-hidden="true">
                      {initials(user?.name ?? student.id)}
                    </span>
                    <span>
                      <strong>{user?.name ?? student.id}</strong>
                      <small>{user?.email ?? "No email"}</small>
                    </span>
                  </div>
                ),
              },
              {
                key: "learning",
                label: "Learning",
                className: "platform-directory-col-learning",
                render: ({ student, course }) =>
                  course?.title ?? student.courseInterest ?? "Course pending",
              },
              {
                key: "class",
                label: "Class",
                className: "platform-directory-col-class",
                render: ({ classGroup }) => classGroup?.name ?? "Class pending",
              },
              {
                key: "branch",
                label: "Branch",
                className: "platform-directory-col-branch",
                render: ({ branch }) => branch?.name ?? "No branch",
              },
              {
                key: "status",
                label: "Status",
                className: "platform-directory-col-status",
                render: ({ student }) => (
                  <StatusBadge tone={statusTone(student.status)}>
                    {humanize(student.status)}
                  </StatusBadge>
                ),
              },
            ]}
            action={{
              href: ({ student }) => `/app/registrar/students/${student.id}`,
              label: ({ student, user }) => user?.name ?? student.id,
            }}
          />
        ) : (
          <div className="platform-empty-state">
            <strong>No students found</strong>
            <span>Try a different search term.</span>
          </div>
        )}
      </div>
    </DataTableCard>
  );

  if (view === "create") {
    const studentHref = createResult?.studentId
      ? `/app/registrar/students/${createResult.studentId}`
      : "/app/registrar/students";

    return (
      <PlatformShell role="registrar" title="New student">
        <FormFlowLayout
          className="portal-ia-page registrar-workspace registrar-students-page registrar-create-page registrar-student-create-page"
          title="New student"
          description="Create and enroll one student through a short guided flow."
          context="Registrar"
          actions={
            createResult ? (
              <Link className="platform-primary-button" href={studentHref}>
                {createResult.studentId ? "Open student" : "View students"}
              </Link>
            ) : undefined
          }
          main={
            createResult ? (
              <section className="registrar-create-success" role="status">
                <CheckCircle2 size={20} />
                <div>
                  <strong>Student enrolled</strong>
                  <span>{createResult.message}</span>
                </div>
              </section>
            ) : (
              createForm
            )
          }
        />
      </PlatformShell>
    );
  }

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
              <strong>
                {selectedStudentPlacement?.status ?? "Not booked"}
              </strong>
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
                ({ enrollment, run, course, classGroup, teacher }) => (
                  <article key={enrollment.id}>
                    <div>
                      <strong>{course?.title ?? enrollment.courseRunId}</strong>
                      <small>
                        {classGroup?.name ??
                          enrollment.classGroupId ??
                          "Class pending"}{" "}
                        ·{" "}
                        {teacher?.name ??
                          run?.teacherId ??
                          enrollment.teacherId ??
                          "Teacher pending"}{" "}
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
        <section className="wide" data-testid="registrar-student-documents">
          <div className="registrar-panel-head compact">
            <div>
              <span>Private identity records</span>
              <strong>Student documents</strong>
            </div>
            <FileText size={16} />
          </div>
          <div className="registrar-student-status-control">
            <label>
              Document type
              <select
                value={studentDocumentType}
                disabled={isAnyActionPending}
                onChange={event => {
                  setStudentDocumentType(
                    event.target.value as StudentIntakeDocumentType
                  );
                  setStudentDocumentFiles([]);
                }}
              >
                <option value="profile_photo">Profile photo</option>
                <option value="passport">Passport</option>
                <option value="national_id">National ID</option>
                <option value="birth_certificate">Birth certificate</option>
                <option value="guardian_id">Guardian ID</option>
                <option value="consent">Consent record</option>
              </select>
            </label>
            <PendingMediaField
              value={studentDocumentFiles}
              onChange={setStudentDocumentFiles}
              kind={
                studentDocumentType === "profile_photo" ? "image" : "document"
              }
              accept=".pdf,application/pdf,image/jpeg,image/png,image/webp"
              label="Choose one file"
              description="PDF, JPEG, PNG, or WebP up to 10 MB. This alpha records metadata only; private storage is not connected."
            />
            <button
              type="button"
              disabled={isAnyActionPending || studentDocumentFiles.length !== 1}
              onClick={() => void addStudentDocument()}
            >
              {pendingAction === `student.document.add:${selectedStudent.id}`
                ? "Recording..."
                : "Record pending document"}
            </button>
          </div>
          <div className="registrar-student-enrollment-list">
            {selectedStudentDocuments.length ? (
              selectedStudentDocuments.map(document => (
                <article key={document.id}>
                  <div>
                    <strong>{humanize(document.type)}</strong>
                    <small>
                      {document.storageStatus === "pending_storage"
                        ? "Storage pending"
                        : humanize(document.status)}
                      {document.size
                        ? ` · ${Math.ceil(document.size / 1024)} KB`
                        : ""}
                    </small>
                  </div>
                  <span>{humanize(document.status)}</span>
                </article>
              ))
            ) : (
              <article className="registrar-empty-row">
                <div>
                  <strong>No private documents recorded</strong>
                  <small>
                    Add metadata now; file storage and verification stay
                    disabled until the private-storage phase is approved.
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
            selectedStudent ? (
              <section className="registrar-panel">
                <div className="registrar-panel-head compact">
                  <div>
                    <span>Identity</span>
                    <strong>
                      {selectedStudentUser?.email ?? "No account"}
                    </strong>
                  </div>
                  <Users size={16} />
                </div>
                <div className="registrar-student-fact-list">
                  <article>
                    <span>Status</span>
                    <strong>{humanize(selectedStudent.status)}</strong>
                    <small>
                      {selectedStudent.currentLevel ?? "Level pending"}
                    </small>
                  </article>
                  <article>
                    <span>Guardian</span>
                    <strong>
                      {selectedStudent.guardianName ?? "Not required"}
                    </strong>
                    <small>
                      {selectedStudent.guardianPhone ??
                        selectedStudentUser?.phone ??
                        "No guardian phone"}
                    </small>
                  </article>
                </div>
              </section>
            ) : undefined
          }
        />
      </PlatformShell>
    );
  }

  return (
    <PlatformShell role="registrar" title="Students">
      <WorkspaceLayout
        className="portal-ia-page registrar-workspace registrar-students-page registrar-students-list-page"
        title="Students"
        description="Find a student and open their record."
        actions={
          <Link
            className="platform-primary-button"
            href="/app/registrar/students/new"
          >
            <UserPlus size={15} />
            New student
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
        main={studentList}
      />
    </PlatformShell>
  );
}
