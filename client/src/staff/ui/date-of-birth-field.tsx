import { useId } from "react";
import { copy } from "../copy";
import {
  ageOn,
  composeDob,
  isValidDob,
  monthNames,
  splitDob,
  type DobParts,
} from "../date-of-birth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./kit";

/**
 * Date of birth as three parts: day, month by name, and a four-digit year.
 * A native date picker opens on the current month, accepts years such as
 * 0001, and follows the browser locale instead of the app language, so it is
 * not used for birth dates.
 */
export function DateOfBirthField({
  label,
  value,
  onChange,
  error,
  optional = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  /** Shows a clear action, for profiles where the date is not required. */
  optional?: boolean;
}) {
  const D = copy.dateOfBirth;
  const id = useId();
  const parts = splitDob(value);
  const errorId = `${id}-error`;
  const age = isValidDob(value) ? ageOn(value) : null;

  function update(next: Partial<DobParts>) {
    onChange(composeDob({ ...parts, ...next }));
  }

  const invalid = error ? true : undefined;
  const describedBy = error ? errorId : undefined;

  return (
    <fieldset className="staff-field staff-dob" aria-describedby={describedBy}>
      <legend className="staff-field-label">{label}</legend>
      <div className="staff-dob-parts">
        <label className="staff-dob-part" data-part="day">
          <span className="staff-dob-sublabel">{D.day}</span>
          <input
            className="staff-input staff-figures"
            inputMode="numeric"
            autoComplete="bday-day"
            maxLength={2}
            value={parts.day}
            aria-invalid={invalid}
            onChange={event => update({ day: event.target.value.replace(/\D/g, "") })}
          />
        </label>
        <div className="staff-dob-part" data-part="month">
          <span className="staff-dob-sublabel" id={`${id}-month`}>
            {D.month}
          </span>
          <Select
            value={parts.month || undefined}
            onValueChange={month => update({ month })}
          >
            <SelectTrigger aria-labelledby={`${id}-month`} aria-invalid={invalid}>
              <SelectValue placeholder={D.monthPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {monthNames().map((name, index) => (
                <SelectItem key={name} value={String(index + 1)}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <label className="staff-dob-part" data-part="year">
          <span className="staff-dob-sublabel">{D.year}</span>
          <input
            className="staff-input staff-figures"
            inputMode="numeric"
            autoComplete="bday-year"
            maxLength={4}
            value={parts.year}
            aria-invalid={invalid}
            onChange={event => update({ year: event.target.value.replace(/\D/g, "") })}
          />
        </label>
      </div>
      <div className="staff-dob-foot">
        {error ? (
          <span id={errorId} className="staff-field-error" role="alert">
            {error}
          </span>
        ) : age !== null ? (
          <span className="staff-muted text-xs">
            {D.age.replace("{n}", String(age))}
          </span>
        ) : null}
        {optional && value ? (
          <button
            type="button"
            className="staff-btn"
            data-variant="quiet"
            data-size="sm"
            onClick={() => onChange("")}
          >
            {D.clear}
          </button>
        ) : null}
      </div>
    </fieldset>
  );
}
