import "@/styles/nile-forms.css";
import { useMemo, useState } from "react";
import { CalendarClock, CircleSlash2, Users } from "lucide-react";

import {
  assignFormPublicationRequest,
  revokeFormAssignmentRequest,
} from "@/lib/forms/api";
import type {
  FormAssignment,
  FormAssignmentTarget,
  FormManagementOption,
  FormManagementOptions,
  FormPublication,
} from "@shared/nileForms";
import type { FormDefinitionBundle } from "../../../../server/nileFormsService";

const targetLabels: Record<FormAssignmentTarget["type"], string> = {
  role: "Role",
  user: "Person",
  branch: "Branch",
  department: "Department",
  course: "Course",
  class: "Class",
};

const optionKeyByTarget: Record<
  FormAssignmentTarget["type"],
  keyof FormManagementOptions
> = {
  role: "roles",
  user: "users",
  branch: "branches",
  department: "departments",
  course: "courses",
  class: "classes",
};

const targetOrder: FormAssignmentTarget["type"][] = [
  "role",
  "user",
  "branch",
  "department",
  "course",
  "class",
];

function targetValue(target: FormAssignmentTarget) {
  switch (target.type) {
    case "role":
      return target.role;
    case "user":
      return target.userId;
    case "branch":
      return target.branchId;
    case "department":
      return target.departmentId;
    case "course":
      return target.courseId;
    case "class":
      return target.classId;
  }
}

function buildTarget(
  type: FormAssignmentTarget["type"],
  value: string
): FormAssignmentTarget {
  switch (type) {
    case "role":
      return {
        type,
        role: value as Extract<FormAssignmentTarget, { type: "role" }>["role"],
      };
    case "user":
      return { type, userId: value };
    case "branch":
      return { type, branchId: value };
    case "department":
      return { type, departmentId: value };
    case "course":
      return { type, courseId: value };
    case "class":
      return { type, classId: value };
  }
}

function assignmentOption(
  options: FormManagementOptions,
  assignment: FormAssignment
) {
  const values = options[optionKeyByTarget[assignment.target.type]] as
    | FormManagementOption[]
    | undefined;
  return values?.find(option => option.id === targetValue(assignment.target));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function assignmentIsActive(assignment: FormAssignment, now = Date.now()) {
  return (
    !assignment.revokedAt &&
    (!assignment.expiresAt || new Date(assignment.expiresAt).getTime() > now)
  );
}

export default function NileFormsAssignmentManager({
  bundle,
  publication,
  onBundleChange,
  onMessage,
}: {
  bundle: FormDefinitionBundle;
  publication: FormPublication;
  onBundleChange: (bundle: FormDefinitionBundle) => void;
  onMessage: (message: string) => void;
}) {
  const [targetType, setTargetType] =
    useState<FormAssignmentTarget["type"]>("role");
  const [targetId, setTargetId] = useState<string>(
    bundle.assignmentOptions.roles[0]?.id ?? ""
  );
  const [expiresAt, setExpiresAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [revokingId, setRevokingId] = useState("");
  const options = bundle.assignmentOptions[
    optionKeyByTarget[targetType]
  ] as FormManagementOption[];
  const assignments = useMemo(
    () =>
      bundle.assignments
        .filter(item => item.publicationId === publication.id)
        .toSorted((left, right) =>
          right.assignedAt.localeCompare(left.assignedAt)
        ),
    [bundle.assignments, publication.id]
  );

  const changeType = (type: FormAssignmentTarget["type"]) => {
    setTargetType(type);
    const next = bundle.assignmentOptions[
      optionKeyByTarget[type]
    ] as FormManagementOption[];
    setTargetId(next[0]?.id ?? "");
  };

  const assign = async () => {
    if (!targetId) return;
    setSaving(true);
    onMessage("");
    const response = await assignFormPublicationRequest(
      publication.id,
      buildTarget(targetType, targetId),
      expiresAt ? new Date(expiresAt).toISOString() : undefined
    );
    setSaving(false);
    if (!response.ok || !response.data) {
      onMessage(response.error ?? "Assignment failed.");
      return;
    }
    onBundleChange({
      ...bundle,
      assignments: [
        response.data,
        ...bundle.assignments.filter(item => item.id !== response.data!.id),
      ],
    });
    setExpiresAt("");
    onMessage("Assignment added.");
  };

  const revoke = async (assignmentId: string) => {
    setRevokingId(assignmentId);
    onMessage("");
    const response = await revokeFormAssignmentRequest(assignmentId);
    setRevokingId("");
    if (!response.ok || !response.data) {
      onMessage(response.error ?? "Assignment could not be revoked.");
      return;
    }
    onBundleChange({
      ...bundle,
      assignments: bundle.assignments.map(item =>
        item.id === response.data!.id ? response.data! : item
      ),
    });
    onMessage("Assignment revoked.");
  };

  return (
    <section className="nile-form-assignment-panel">
      <header>
        <Users size={17} />
        <div>
          <h2>Assign publication</h2>
          <p>Choose one authorized audience and an optional expiry.</p>
        </div>
      </header>

      <div className="nile-form-assignment-controls">
        <label>
          <span>Target</span>
          <select
            value={targetType}
            onChange={event =>
              changeType(event.target.value as FormAssignmentTarget["type"])
            }
          >
            {targetOrder.map(type => (
              <option key={type} value={type}>
                {targetLabels[type]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{targetLabels[targetType]}</span>
          <select
            value={targetId}
            onChange={event => setTargetId(event.target.value)}
          >
            {!options.length ? (
              <option value="">No available targets</option>
            ) : null}
            {options.map(option => (
              <option key={option.id} value={option.id}>
                {option.label}
                {option.context ? ` - ${option.context}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>
            <CalendarClock size={14} /> Expires
          </span>
          <input
            type="datetime-local"
            value={expiresAt}
            onInput={event => setExpiresAt(event.currentTarget.value)}
          />
        </label>
        <button
          type="button"
          className="platform-primary-button"
          disabled={saving || !targetId}
          onClick={assign}
        >
          <Users size={15} /> {saving ? "Assigning" : "Assign"}
        </button>
      </div>

      <div className="nile-form-assignment-list">
        <header>
          <strong>Current assignments</strong>
          <span>
            {assignments.filter(item => assignmentIsActive(item)).length} active
          </span>
        </header>
        {assignments.length ? (
          assignments.map(assignment => {
            const option = assignmentOption(
              bundle.assignmentOptions,
              assignment
            );
            const expired = Boolean(
              assignment.expiresAt &&
                new Date(assignment.expiresAt).getTime() <= Date.now()
            );
            const inactive = Boolean(assignment.revokedAt) || expired;
            return (
              <div key={assignment.id} className={inactive ? "is-revoked" : ""}>
                <span className="nile-form-assignment-type">
                  {targetLabels[assignment.target.type]}
                </span>
                <div>
                  <strong>
                    {option?.label ?? targetValue(assignment.target)}
                  </strong>
                  <small>
                    {inactive
                      ? assignment.revokedAt
                        ? `Revoked ${formatDate(assignment.revokedAt)}`
                        : `Expired ${formatDate(assignment.expiresAt!)}`
                      : assignment.expiresAt
                        ? `Expires ${formatDate(assignment.expiresAt)}`
                        : "No expiry"}
                  </small>
                </div>
                {!inactive ? (
                  <button
                    type="button"
                    className="nile-form-text-button"
                    disabled={revokingId === assignment.id}
                    onClick={() => revoke(assignment.id)}
                  >
                    <CircleSlash2 size={14} />
                    {revokingId === assignment.id ? "Revoking" : "Revoke"}
                  </button>
                ) : (
                  <span className="nile-form-status is-retired">
                    {assignment.revokedAt ? "revoked" : "expired"}
                  </span>
                )}
              </div>
            );
          })
        ) : (
          <p>No audience has been assigned to this publication.</p>
        )}
      </div>
    </section>
  );
}
