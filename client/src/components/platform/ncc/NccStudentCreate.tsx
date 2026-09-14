import { useState } from "react";
import { Link, useLocation } from "wouter";
import PlatformShell from "@/components/platform/PlatformShell";
import { FormFlowLayout } from "@/components/platform/PlatformLayouts";
import NccStudentForm, {
  emptyNccIdentityValues,
  nccIdentityInputFromValues,
  type NccStudentFormValues,
} from "@/components/platform/ncc/NccStudentForm";
import { createNccStudentRequest } from "@/lib/backend/api";
import { useNccWorkspaceBranchName } from "@/lib/backend/nccWorkspaceBranch";

const emptyValues: NccStudentFormValues = {
  firstName: "",
  lastName: "",
  email: "",
  ...emptyNccIdentityValues(),
};

export default function NccStudentCreate({
  role,
  backHref,
}: {
  role: "registrar" | "branchadmin";
  backHref: string;
}) {
  const [, navigate] = useLocation();
  const branchName = useNccWorkspaceBranchName();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const submit = async (values: NccStudentFormValues) => {
    setError("");
    if (!values.firstName.trim()) {
      setError("firstName is required.");
      return;
    }
    if (!values.lastName.trim()) {
      setError("lastName is required.");
      return;
    }
    if (!values.email.trim()) {
      setError("email is required.");
      return;
    }
    const identity = nccIdentityInputFromValues(values);
    if (!identity.input) {
      setError(identity.error ?? "Student identity details are incomplete.");
      return;
    }
    setPending(true);
    const response = await createNccStudentRequest({
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      email: values.email.trim(),
      ...identity.input,
    });
    setPending(false);
    if (!response.ok || !response.data) {
      setError(
        response.status === 409
          ? "A student with this email already exists in EMS."
          : (response.error ?? "The student could not be created.")
      );
      return;
    }
    navigate(`${backHref}/${response.data.student.id}`);
  };

  return (
    <PlatformShell role={role} title="New student">
      <FormFlowLayout
        title="New student"
        description="Create one student in EMS."
        context={branchName}
        actions={
          <Link className="platform-secondary-button" href={backHref}>
            Back to students
          </Link>
        }
        main={
          <section className="registrar-panel registrar-student-create-panel">
            <p>Branch: {branchName}</p>
            <NccStudentForm
              initial={emptyValues}
              onSubmit={submit}
              pending={pending}
              submitLabel="Create student"
              error={error}
            />
          </section>
        }
      />
    </PlatformShell>
  );
}
