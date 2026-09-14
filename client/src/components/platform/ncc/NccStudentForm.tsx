import { useState, type FormEvent } from "react";
import type { NccStudentIdentityInput } from "@/lib/backend/api";

export type NccGuardianFormValues = {
  name: string;
  phone: string;
  email: string;
  relationship: string;
};

export type NccIdentityFormValues = {
  nationality: string;
  address: string;
  gender: "" | "male" | "female";
  dateOfBirth: string;
  phone: string;
  passportNumber: string;
  nationalId: string;
  guardians: [NccGuardianFormValues, NccGuardianFormValues];
};

export function emptyNccIdentityValues(): NccIdentityFormValues {
  return {
    nationality: "",
    address: "",
    gender: "",
    dateOfBirth: "",
    phone: "",
    passportNumber: "",
    nationalId: "",
    guardians: [
      { name: "", phone: "", email: "", relationship: "" },
      { name: "", phone: "", email: "", relationship: "" },
    ],
  };
}

export function nccIdentityInputFromValues(values: NccIdentityFormValues): {
  input?: NccStudentIdentityInput;
  error?: string;
} {
  const nationality = values.nationality.trim();
  const address = values.address.trim();
  const dateOfBirth = values.dateOfBirth;
  if (!/^\w{3}$/.test(nationality)) {
    return { error: "Nationality must be a 3-letter code." };
  }
  if (!address) {
    return { error: "Address is required." };
  }
  if (values.gender !== "male" && values.gender !== "female") {
    return { error: "Gender is required." };
  }
  if (!dateOfBirth) {
    return { error: "Date of birth is required." };
  }
  const passportNumber = values.passportNumber.trim();
  const nationalId = values.nationalId.trim();
  if (passportNumber && passportNumber.length > 32) {
    return { error: "Passport number must be 1-32 characters." };
  }
  if (nationalId && !/^\d{14}$/.test(nationalId)) {
    return { error: "National ID must be exactly 14 digits." };
  }
  const guardians: NccStudentIdentityInput["guardians"] = [];
  for (const index of [0, 1] as const) {
    const row = values.guardians[index];
    const name = row.name.trim();
    const phone = row.phone.trim();
    const email = row.email.trim();
    const relationship = row.relationship.trim();
    if (!name && !phone && !email && !relationship) continue;
    if (!name || !phone || !email || !relationship) {
      return {
        error: `Guardian ${index + 1} must be complete or left blank.`,
      };
    }
    guardians.push({
      sortOrder: (index + 1) as 1 | 2,
      name,
      phone,
      email,
      relationship,
    });
  }
  return {
    input: {
      nationality,
      address,
      gender: values.gender,
      dateOfBirth,
      phone: values.phone.trim() || null,
      passportNumber: passportNumber || null,
      nationalId: nationalId || null,
      guardians,
    },
  };
}

export function NccIdentityFields({
  values,
  onChange,
}: {
  values: NccIdentityFormValues;
  onChange: (patch: Partial<NccIdentityFormValues>) => void;
}) {
  const guardianField = (
    index: 0 | 1,
    key: keyof NccGuardianFormValues,
    label: string,
    type = "text"
  ) => (
    <label>
      {label}
      <input
        type={type}
        value={values.guardians[index][key]}
        onChange={event => {
          const guardians = values.guardians.map((row, rowIndex) =>
            rowIndex === index
              ? { ...row, [key]: event.target.value }
              : row
          ) as NccIdentityFormValues["guardians"];
          onChange({ guardians });
        }}
      />
    </label>
  );
  return (
    <>
      <label>
        Nationality
        <input
          value={values.nationality}
          maxLength={3}
          placeholder="EGY"
          onChange={event => onChange({ nationality: event.target.value })}
        />
      </label>
      <label>
        Address
        <textarea
          value={values.address}
          onChange={event => onChange({ address: event.target.value })}
        />
      </label>
      <label>
        Gender
        <select
          value={values.gender}
          onChange={event =>
            onChange({
              gender: event.target.value as NccIdentityFormValues["gender"],
            })
          }
        >
          <option value="">Select gender</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>
      </label>
      <label>
        Date of birth
        <input
          type="date"
          value={values.dateOfBirth}
          onChange={event => onChange({ dateOfBirth: event.target.value })}
        />
      </label>
      <label>
        Phone
        <input
          value={values.phone}
          onChange={event => onChange({ phone: event.target.value })}
        />
      </label>
      <label>
        Passport number
        <input
          value={values.passportNumber}
          onChange={event =>
            onChange({ passportNumber: event.target.value })
          }
        />
      </label>
      <label>
        National ID
        <input
          value={values.nationalId}
          maxLength={14}
          onChange={event => onChange({ nationalId: event.target.value })}
        />
      </label>
      {([0, 1] as const).map(index => (
        <fieldset key={index}>
          <legend>Guardian {index + 1}</legend>
          {guardianField(index, "name", "Name")}
          {guardianField(index, "phone", "Phone")}
          {guardianField(index, "email", "Email", "email")}
          {guardianField(index, "relationship", "Relationship")}
        </fieldset>
      ))}
    </>
  );
}

export type NccStudentFormValues = NccIdentityFormValues & {
  firstName: string;
  lastName: string;
  email: string;
};

export default function NccStudentForm({
  initial,
  onSubmit,
  pending,
  submitLabel,
  error,
}: {
  initial: NccStudentFormValues;
  onSubmit: (values: NccStudentFormValues) => void | Promise<void>;
  pending: boolean;
  submitLabel: string;
  error?: string;
}) {
  const [values, setValues] = useState(initial);
  const field = (
    key: "firstName" | "lastName" | "email",
    label: string,
    type = "text"
  ) => (
    <label>
      {label}
      <input
        type={type}
        value={values[key]}
        onChange={event =>
          setValues(current => ({ ...current, [key]: event.target.value }))
        }
      />
    </label>
  );
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void onSubmit(values);
  };

  return (
    <form className="registrar-student-create-form" onSubmit={submit}>
      {field("firstName", "First name")}
      {field("lastName", "Last name")}
      {field("email", "Email", "email")}
      <NccIdentityFields
        values={values}
        onChange={patch => setValues(current => ({ ...current, ...patch }))}
      />
      {error ? (
        <p className="platform-form-error" role="alert">
          {error}
        </p>
      ) : null}
      <button
        className="platform-primary-button"
        type="submit"
        disabled={pending}
      >
        {pending ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
