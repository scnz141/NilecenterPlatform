import { useEffect, useState } from "react";
import {
  createNccDepartmentRequest,
  disableNccDepartmentRequest,
  enableNccDepartmentRequest,
  patchNccDepartmentRequest,
  type NccDepartmentDto,
  type NccDepartmentInput,
} from "@/lib/backend/api";
import { staffWrite, useInvalidate, useNcc } from "../api";
import { copy } from "../copy";
import { runAction } from "../run-action";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { CustomFieldsEditor } from "../ui/custom-fields-editor";
import { FormSheet, StaffField } from "../ui/form-sheet";
import { ListPage, type ListColumn } from "../ui/list-page";
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  PageHeader,
} from "../ui/primitives";
import {
  CatalogStatus,
  formatDate,
  RowActionButtons,
  statusFilter,
  statusValue,
  useCanManage,
} from "./catalog-shared";

const C = copy.catalog.departments;
const S = copy.catalog.shared;

function DepartmentForm({
  open,
  onOpenChange,
  department,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  department: NccDepartmentDto | null;
  onSaved: () => Promise<void> | void;
}) {
  const isEdit = Boolean(department);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [customFields, setCustomFields] = useState<
    Record<string, string | number | boolean | null>
  >({});
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>();

  useEffect(() => {
    if (!open) return;
    setName(department?.name ?? "");
    setCode(department?.code ?? "");
    setCustomFields({ ...(department?.customFields ?? {}) });
    setFieldErrors(undefined);
  }, [open, department]);

  const dirty =
    name !== (department?.name ?? "") ||
    code !== (department?.code ?? "") ||
    JSON.stringify(customFields) !==
      JSON.stringify(department?.customFields ?? {});

  async function submit() {
    setSaving(true);
    setFieldErrors(undefined);
    try {
      const input: NccDepartmentInput = {
        name: name.trim(),
        code: code.trim() ? code.trim() : null,
        customFields,
      };
      await staffWrite(
        isEdit
          ? patchNccDepartmentRequest(department!.id, input)
          : createNccDepartmentRequest(input)
      );
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
          <StaffField label={S.name} error={errorFor("name")}>
            <input
              className="staff-input"
              value={name}
              onChange={event => setName(event.target.value)}
              required
            />
          </StaffField>
          <StaffField label={S.code} error={errorFor("code")}>
            <input
              className="staff-input"
              value={code}
              onChange={event =>
                setCode(event.target.value.replace(/\s+/g, "_").toLowerCase())
              }
            />
            <span className="staff-muted text-xs">{S.codeHint}</span>
          </StaffField>
          <CustomFieldsEditor
            entityType="department"
            value={customFields}
            onChange={setCustomFields}
          />
        </>
      )}
    </FormSheet>
  );
}

export default function DepartmentsPage() {
  const canManage = useCanManage();
  const list = useNcc<{ items: NccDepartmentDto[] }>(
    "/api/ncc/directory/departments"
  );
  const invalidate = useInvalidate();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<NccDepartmentDto | null>(null);
  const [disableTarget, setDisableTarget] = useState<NccDepartmentDto | null>(
    null
  );
  const [enableTarget, setEnableTarget] = useState<NccDepartmentDto | null>(
    null
  );

  const items = list.data?.items;

  const columns: ListColumn<NccDepartmentDto>[] = [
    {
      id: "name",
      label: S.name,
      always: true,
      sortValue: row => row.name,
      render: row => row.name,
    },
    {
      id: "code",
      label: S.code,
      sortValue: row => row.code ?? null,
      render: row => row.code ?? copy.state.notSet,
    },
    {
      id: "added",
      label: S.created,
      sortValue: row => row.createdAt,
      render: row => formatDate(row.createdAt),
    },
    {
      id: "status",
      label: S.status,
      render: row => <CatalogStatus status={row.status} />,
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
          status={row.status}
          onToggle={() =>
            row.status === "active"
              ? setDisableTarget(row)
              : setEnableTarget(row)
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
          listId="departments"
          items={items}
          columns={columns}
          rowKey={row => row.id}
          searchText={row => `${row.name} ${row.code ?? ""}`}
          filters={[statusFilter()]}
          filterValue={(row, key) => (key === "status" ? statusValue(row) : null)}
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

      <DepartmentForm
        open={formOpen}
        onOpenChange={setFormOpen}
        department={editing}
        onSaved={() => invalidate("/api/ncc/directory/departments")}
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
        reasonKind="disable_department"
        reasonRequired
        onConfirm={reasonId =>
          runAction(
            async () => {
              await staffWrite(
                disableNccDepartmentRequest(disableTarget!.id, reasonId!)
              );
              await invalidate("/api/ncc/directory/departments");
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
              await staffWrite(enableNccDepartmentRequest(enableTarget!.id));
              await invalidate("/api/ncc/directory/departments");
            },
            { success: S.enabledToast }
          )
        }
      />
    </div>
  );
}
