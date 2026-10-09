import type { NccCustomFieldDefinitionDto } from "@/lib/backend/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/staff/ui/kit";
import { useNcc } from "../api";
import { DatePicker } from "./date-picker";
import { StaffField } from "./form-sheet";

export type CustomFieldValues = Record<
  string,
  string | number | boolean | null
>;

/**
 * Renders inputs for the active custom field definitions of one entity.
 * Definitions come from the settings catalog; when the catalog is empty the
 * editor renders nothing.
 */
export function CustomFieldsEditor({
  entityType,
  value,
  onChange,
}: {
  entityType: string;
  value: CustomFieldValues;
  onChange: (next: CustomFieldValues) => void;
}) {
  const definitions = useNcc<{ items: NccCustomFieldDefinitionDto[] }>(
    "/api/ncc/settings/custom-fields",
    { entityType, isActive: "true" }
  );
  const items = definitions.data?.items ?? [];
  if (items.length === 0) return null;

  function set(key: string, next: string | number | boolean | null) {
    onChange({ ...value, [key]: next });
  }

  return (
    <>
      {items.map(definition => {
        const current = value[definition.fieldKey];
        return (
          <StaffField
            key={definition.id}
            label={
              definition.isRequired
                ? `${definition.label} *`
                : definition.label
            }
          >
            {definition.helpText ? (
              <span className="staff-muted text-xs">
                {definition.helpText}
              </span>
            ) : null}
            {definition.fieldType === "boolean" ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={current === true}
                  onChange={event =>
                    set(definition.fieldKey, event.target.checked)
                  }
                />
                {definition.label}
              </label>
            ) : definition.fieldType === "select" ? (
              <Select
                value={typeof current === "string" ? current : undefined}
                onValueChange={next => set(definition.fieldKey, next ?? null)}
              >
                <SelectTrigger aria-label={definition.label}>
                  <SelectValue placeholder={definition.label} />
                </SelectTrigger>
                <SelectContent>
                  {(definition.options ?? []).map(option => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : definition.fieldType === "number" ? (
              <input
                type="number"
                className="staff-input"
                value={typeof current === "number" ? String(current) : ""}
                onChange={event =>
                  set(
                    definition.fieldKey,
                    event.target.value === ""
                      ? null
                      : Number(event.target.value)
                  )
                }
              />
            ) : definition.fieldType === "date" ? (
              <DatePicker
                aria-label={definition.label}
                value={typeof current === "string" ? current : ""}
                clearable
                onChange={next => set(definition.fieldKey, next || null)}
              />
            ) : definition.fieldType === "textarea" ? (
              <textarea
                className="staff-input"
                rows={3}
                value={typeof current === "string" ? current : ""}
                onChange={event =>
                  set(definition.fieldKey, event.target.value)
                }
              />
            ) : (
              <input
                className="staff-input"
                value={typeof current === "string" ? current : ""}
                onChange={event =>
                  set(definition.fieldKey, event.target.value)
                }
              />
            )}
          </StaffField>
        );
      })}
    </>
  );
}
