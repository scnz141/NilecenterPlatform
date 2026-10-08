import { useEffect, useMemo, useState } from "react";
import {
  createNccCustomFieldRequest,
  disableNccCustomFieldRequest,
  enableNccCustomFieldRequest,
  patchNccCustomFieldRequest,
  type NccCustomFieldDefinitionDto,
} from "@/lib/backend/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/staff/ui/kit";
import { staffWrite, useInvalidate, useNcc } from "../api";
import { copy } from "../copy";
import { runAction } from "../run-action";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { FormSheet, StaffField } from "../ui/form-sheet";
import { ListPage, type ListColumn } from "../ui/list-page";
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  PageHeader,
  StatusBadge,
} from "../ui/primitives";
import {
  RowActionButtons,
  useCanManage,
} from "./catalog-shared";

const C = copy.catalog.customFields;
const S = copy.catalog.shared;

const ENTITY_TYPES = [
  "user_profile",
  "student",
  "lead",
  "branch",
  "department",
  "class",
  "course",
  "room",
] as const;

const FIELD_TYPES = [
  "text",
  "textarea",
  "number",
  "date",
  "boolean",
  "select",
] as const;

function entityLabel(entityType: string): string {
  const labels: Record<string, string> = {
    user_profile: C.entityUser_profile,
    student: C.entityStudent,
    lead: C.entityLead,
    branch: C.entityBranch,
    department: C.entityDepartment,
    class: C.entityClass,
    course: C.entityCourse,
    room: C.entityRoom,
  };
  return labels[entityType] ?? entityType;
}

function CustomFieldForm({
  open,
  onOpenChange,
  field,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  field: NccCustomFieldDefinitionDto | null;
  onSaved: () => Promise<void> | void;
}) {
  const isEdit = Boolean(field);
  const [entityType, setEntityType] =
    useState<(typeof ENTITY_TYPES)[number]>("student");
  const [fieldKey, setFieldKey] = useState("");
  const [label, setLabel] = useState("");
  const [fieldType, setFieldType] =
    useState<(typeof FIELD_TYPES)[number]>("text");
  const [isRequired, setIsRequired] = useState(false);
  const [optionsText, setOptionsText] = useState("");
  const [helpText, setHelpText] = useState("");
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>();

  useEffect(() => {
    if (!open) return;
    setEntityType(
      (ENTITY_TYPES as readonly string[]).includes(field?.entityType ?? "")
        ? (field!.entityType as (typeof ENTITY_TYPES)[number])
        : "student"
    );
    setFieldKey(field?.fieldKey ?? "");
    setLabel(field?.label ?? "");
    setFieldType(
      (FIELD_TYPES as readonly string[]).includes(field?.fieldType ?? "")
        ? (field!.fieldType as (typeof FIELD_TYPES)[number])
        : "text"
    );
    setIsRequired(field?.isRequired ?? false);
    setOptionsText((field?.options ?? []).join("\n"));
    setHelpText(field?.helpText ?? "");
    setFieldErrors(undefined);
  }, [open, field]);

  const dirty =
    label !== (field?.label ?? "") ||
    fieldKey !== (field?.fieldKey ?? "") ||
    isRequired !== (field?.isRequired ?? false) ||
    optionsText !== (field?.options ?? []).join("\n") ||
    helpText !== (field?.helpText ?? "") ||
    (!isEdit && (fieldType !== "text" || entityType !== "student"));

  const options = useMemo(
    () =>
      optionsText
        .split("\n")
        .map(line => line.trim())
        .filter(Boolean),
    [optionsText]
  );

  async function submit() {
    setSaving(true);
    setFieldErrors(undefined);
    try {
      if (isEdit) {
        await staffWrite(
          patchNccCustomFieldRequest(field!.id, {
            label: label.trim(),
            isRequired,
            options: fieldType === "select" ? options : null,
            helpText: helpText.trim() ? helpText.trim() : null,
          })
        );
      } else {
        await staffWrite(
          createNccCustomFieldRequest({
            entityType,
            fieldKey: fieldKey.trim(),
            label: label.trim(),
            fieldType,
            isRequired,
            options: fieldType === "select" ? options : undefined,
            helpText: helpText.trim() ? helpText.trim() : null,
          })
        );
      }
      await onSaved();
      onOpenChange(false);
    } catch (error) {
      const details = (error as { details?: Record<string, string[]> })
        .details;
      if (details) setFieldErrors(details);
      throw error;
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? C.editTitle : C.createTitle}
      dirty={dirty}
      saving={saving}
      fieldErrors={fieldErrors}
      saveLabel={isEdit ? S.saveChanges : C.createSubmit}
      onSubmit={() =>
        runAction(submit, {
          success: isEdit ? S.updatedToast : S.createdToast,
        })
      }
    >
      {errorFor => (
        <>
          {!isEdit ? (
            <>
              <StaffField label={C.entity} error={errorFor("entity_type")}>
                <Select
                  value={entityType}
                  onValueChange={value =>
                    setEntityType(value as (typeof ENTITY_TYPES)[number])
                  }
                >
                  <SelectTrigger aria-label={C.entity}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ENTITY_TYPES.map(value => (
                      <SelectItem key={value} value={value}>
                        {entityLabel(value)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </StaffField>
              <StaffField label={C.fieldKey} error={errorFor("field_key")}>
                <input
                  className="staff-input"
                  value={fieldKey}
                  onChange={event =>
                    setFieldKey(
                      event.target.value.replace(/\s+/g, "_").toLowerCase()
                    )
                  }
                  required
                />
                <span className="staff-muted text-xs">{C.fieldKeyHint}</span>
              </StaffField>
              <StaffField label={C.fieldType} error={errorFor("field_type")}>
                <Select
                  value={fieldType}
                  onValueChange={value =>
                    setFieldType(value as (typeof FIELD_TYPES)[number])
                  }
                >
                  <SelectTrigger aria-label={C.fieldType}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map(value => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </StaffField>
            </>
          ) : null}
          <StaffField label={S.name} error={errorFor("label")}>
            <input
              className="staff-input"
              value={label}
              onChange={event => setLabel(event.target.value)}
              required
            />
          </StaffField>
          <StaffField label={C.required} error={errorFor("is_required")}>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isRequired}
                onChange={event => setIsRequired(event.target.checked)}
              />
              {C.required}
            </label>
          </StaffField>
          {fieldType === "select" ? (
            <StaffField label={C.options} error={errorFor("options_json")}>
              <textarea
                className="staff-input"
                rows={4}
                value={optionsText}
                onChange={event => setOptionsText(event.target.value)}
              />
              <span className="staff-muted text-xs">{C.optionsHint}</span>
            </StaffField>
          ) : null}
          <StaffField label={C.helpText} error={errorFor("help_text")}>
            <input
              className="staff-input"
              value={helpText}
              onChange={event => setHelpText(event.target.value)}
            />
          </StaffField>
        </>
      )}
    </FormSheet>
  );
}

export default function CustomFieldsPage() {
  const canManage = useCanManage();
  const list = useNcc<{ items: NccCustomFieldDefinitionDto[] }>(
    "/api/ncc/settings/custom-fields"
  );
  const invalidate = useInvalidate();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] =
    useState<NccCustomFieldDefinitionDto | null>(null);
  const [disableTarget, setDisableTarget] =
    useState<NccCustomFieldDefinitionDto | null>(null);
  const [enableTarget, setEnableTarget] =
    useState<NccCustomFieldDefinitionDto | null>(null);

  const items = list.data?.items;

  const columns: ListColumn<NccCustomFieldDefinitionDto>[] = [
    {
      id: "label",
      label: S.name,
      always: true,
      sortValue: row => row.label,
      render: row => row.label,
    },
    {
      id: "entity",
      label: C.entity,
      sortValue: row => row.entityType,
      render: row => entityLabel(row.entityType),
    },
    {
      id: "key",
      label: C.fieldKey,
      sortValue: row => row.fieldKey,
      render: row => row.fieldKey,
    },
    {
      id: "type",
      label: C.fieldType,
      sortValue: row => row.fieldType,
      render: row => row.fieldType,
    },
    {
      id: "required",
      label: C.required,
      render: row => (row.isRequired ? C.requiredYes : C.optional),
    },
    {
      id: "status",
      label: S.status,
      render: row => (
        <StatusBadge status={row.isActive ? "active" : "disabled"} />
      ),
    },
    {
      id: "actions",
      label: "",
      always: true,
      render: row => (
        <RowActionButtons
          onEdit={() => {
            setEditing(row);
            setFormOpen(true);
          }}
          status={row.isActive ? "active" : "disabled"}
          onToggle={() =>
            row.isActive ? setDisableTarget(row) : setEnableTarget(row)
          }
        />
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4 min-w-0">
      <PageHeader
        title={C.title}
        description={C.description}
        actions={
          canManage ? (
            <button
              type="button"
              className="staff-btn"
              data-variant="primary"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              {C.add}
            </button>
          ) : undefined
        }
      />
      {list.error ? (
        <ErrorState error={list.error} onRetry={() => void list.mutate()} />
      ) : list.isLoading || !items ? (
        <LoadingRows />
      ) : (
        <ListPage
          title={C.title}
          listId="custom-fields"
          items={items}
          columns={columns}
          rowKey={row => row.id}
          searchText={row => `${row.label} ${row.fieldKey}`}
          filters={[
            {
              key: "entity",
              label: C.entity,
              allLabel: C.allEntities,
              options: ENTITY_TYPES.map(value => ({
                value,
                label: entityLabel(value),
              })),
            },
            {
              key: "status",
              label: S.status,
              allLabel: S.allStatuses,
              options: [
                { value: "active", label: S.active },
                { value: "disabled", label: S.disabled },
              ],
            },
          ]}
          filterValue={(row, key) =>
            key === "entity"
              ? row.entityType
              : key === "status"
                ? row.isActive
                  ? "active"
                  : "disabled"
                : null
          }
          empty={
            <EmptyState
              title={C.empty}
              description={C.emptyHint}
              action={
                canManage ? (
                  <button
                    type="button"
                    className="staff-btn"
                    data-variant="primary"
                    onClick={() => {
                      setEditing(null);
                      setFormOpen(true);
                    }}
                  >
                    {C.add}
                  </button>
                ) : undefined
              }
            />
          }
        />
      )}

      <CustomFieldForm
        open={formOpen}
        onOpenChange={setFormOpen}
        field={editing}
        onSaved={() => invalidate("/api/ncc/settings/custom-fields")}
      />

      <ConfirmDialog
        open={disableTarget !== null}
        onOpenChange={open => {
          if (!open) setDisableTarget(null);
        }}
        title={S.disableTitle}
        description={C.disableBody}
        confirmLabel={copy.actions.disable}
        destructive
        reasonKind="disable_custom_field"
        reasonRequired
        onConfirm={reasonId =>
          runAction(
            async () => {
              await staffWrite(
                disableNccCustomFieldRequest(disableTarget!.id, reasonId!)
              );
              await invalidate("/api/ncc/settings/custom-fields");
            },
            { success: S.disabledToast }
          )
        }
      />

      <ConfirmDialog
        open={enableTarget !== null}
        onOpenChange={open => {
          if (!open) setEnableTarget(null);
        }}
        title={S.enableTitle}
        description={S.enableBody}
        confirmLabel={copy.actions.enable}
        onConfirm={() =>
          runAction(
            async () => {
              await staffWrite(
                enableNccCustomFieldRequest(enableTarget!.id)
              );
              await invalidate("/api/ncc/settings/custom-fields");
            },
            { success: S.enabledToast }
          )
        }
      />
    </div>
  );
}
