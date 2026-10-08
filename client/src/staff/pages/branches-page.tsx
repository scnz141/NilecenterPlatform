import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  createNccBranchRequest,
  disableNccBranchRequest,
  enableNccBranchRequest,
  patchNccBranchRequest,
  type NccBranchDto,
  type NccBranchInput,
} from "@/lib/backend/api";
import { useInvalidate, useNcc, staffWrite } from "../api";
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
import { SearchableSelect } from "../ui/searchable-select";
import {
  CatalogStatus,
  formatDate,
  RowActionButtons,
  statusFilter,
  statusValue,
  timezoneOptions,
  useCanManage,
} from "./catalog-shared";

const C = copy.catalog.branches;
const S = copy.catalog.shared;

function BranchForm({
  open,
  onOpenChange,
  branch,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branch: NccBranchDto | null;
  onSaved: () => Promise<void> | void;
}) {
  const isEdit = Boolean(branch);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [isOnline, setIsOnline] = useState(false);
  const [sortOrder, setSortOrder] = useState("0");
  const [customFields, setCustomFields] = useState<
    Record<string, string | number | boolean | null>
  >({});
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>();

  useEffect(() => {
    if (!open) return;
    setName(branch?.name ?? "");
    setCode(branch?.code ?? "");
    setTimezone(branch?.timezone ?? "UTC");
    setIsOnline(branch?.isOnline ?? false);
    setSortOrder(String(branch?.sortOrder ?? 0));
    setCustomFields({ ...(branch?.customFields ?? {}) });
    setFieldErrors(undefined);
  }, [open, branch]);

  const dirty =
    name !== (branch?.name ?? "") ||
    code !== (branch?.code ?? "") ||
    timezone !== (branch?.timezone ?? "UTC") ||
    isOnline !== (branch?.isOnline ?? false) ||
    sortOrder !== String(branch?.sortOrder ?? 0) ||
    JSON.stringify(customFields) !==
      JSON.stringify(branch?.customFields ?? {});

  async function submit() {
    setSaving(true);
    setFieldErrors(undefined);
    try {
      const parsed = Number.parseInt(sortOrder, 10);
      const input: NccBranchInput = {
        name: name.trim(),
        code: code.trim() ? code.trim() : null,
        timezone,
        isOnline,
        sortOrder: Number.isSafeInteger(parsed) ? parsed : 0,
        customFields,
      };
      await staffWrite(
        isEdit
          ? patchNccBranchRequest(branch!.id, input)
          : createNccBranchRequest(input)
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
      description={isEdit ? C.editDescription : C.createDescription}
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
          <StaffField label={C.timezone} error={errorFor("timezone")}>
            <SearchableSelect
              options={timezoneOptions(timezone)}
              value={timezone}
              onChange={setTimezone}
              placeholder={C.timezone}
              ariaLabel={C.timezone}
            />
          </StaffField>
          <StaffField label={C.online} error={errorFor("is_online")}>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isOnline}
                onChange={event => setIsOnline(event.target.checked)}
              />
              {C.onlineYes}
            </label>
          </StaffField>
          <StaffField label={S.sortOrder} error={errorFor("sort_order")}>
            <input
              type="number"
              className="staff-input"
              value={sortOrder}
              min={-9999}
              max={9999}
              onChange={event => setSortOrder(event.target.value)}
            />
          </StaffField>
          <CustomFieldsEditor
            entityType="branch"
            value={customFields}
            onChange={setCustomFields}
          />
        </>
      )}
    </FormSheet>
  );
}

export default function BranchesPage() {
  const canManage = useCanManage();
  const list = useNcc<{ items: NccBranchDto[] }>("/api/ncc/directory/branches");
  const invalidate = useInvalidate();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<NccBranchDto | null>(null);
  const [disableTarget, setDisableTarget] = useState<NccBranchDto | null>(null);
  const [enableTarget, setEnableTarget] = useState<NccBranchDto | null>(null);
  const [bulkAction, setBulkAction] = useState<
    | { mode: "disable"; rows: NccBranchDto[]; clear: () => void }
    | { mode: "enable"; rows: NccBranchDto[]; clear: () => void }
    | null
  >(null);

  const items = list.data?.items;

  const columns: ListColumn<NccBranchDto>[] = [
    {
      id: "name",
      label: S.name,
      always: true,
      sortValue: row => row.name,
      render: row => (
        <Link href={`/app/branches/${row.id}`} className="staff-link">
          {row.name}
        </Link>
      ),
    },
    {
      id: "code",
      label: S.code,
      sortValue: row => row.code ?? null,
      render: row => row.code ?? copy.state.notSet,
    },
    {
      id: "timezone",
      label: C.timezone,
      sortValue: row => row.timezone,
      render: row => row.timezone,
    },
    {
      id: "mode",
      label: C.online,
      render: row => (row.isOnline ? C.onlineYes : C.onlineNo),
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
    ...(canManage
      ? [
          {
            id: "actions",
            label: "",
            always: true,
            render: (row: NccBranchDto) => (
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
          } satisfies ListColumn<NccBranchDto>,
        ]
      : []),
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
          listId="branches"
          items={items}
          columns={columns}
          rowKey={row => row.id}
          searchText={row => `${row.name} ${row.code ?? ""} ${row.timezone}`}
          filters={[statusFilter()]}
          filterValue={(row, key) => (key === "status" ? statusValue(row) : null)}
          bulkActions={
            canManage
              ? (rows, clear) => (
                  <>
                    <button
                      type="button"
                      className="staff-btn"
                      data-size="sm"
                      onClick={() => setBulkAction({ mode: "enable", rows, clear })}
                    >
                      {C.bulkEnable}
                    </button>
                    <button
                      type="button"
                      className="staff-btn"
                      data-variant="destructive-outline"
                      data-size="sm"
                      onClick={() =>
                        setBulkAction({ mode: "disable", rows, clear })
                      }
                    >
                      {C.bulkDisable}
                    </button>
                  </>
                )
              : undefined
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

      <BranchForm
        open={formOpen}
        onOpenChange={setFormOpen}
        branch={editing}
        onSaved={() => invalidate("/api/ncc/directory/branches")}
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
        reasonKind="disable_branch"
        reasonRequired
        onConfirm={reasonId =>
          runAction(
            async () => {
              await staffWrite(
                disableNccBranchRequest(disableTarget!.id, reasonId!)
              );
              await invalidate("/api/ncc/directory/branches");
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
              await staffWrite(enableNccBranchRequest(enableTarget!.id));
              await invalidate("/api/ncc/directory/branches");
            },
            { success: S.enabledToast }
          )
        }
      />

      <ConfirmDialog
        open={bulkAction?.mode === "disable"}
        onOpenChange={open => {
          if (!open) setBulkAction(null);
        }}
        title={S.disableTitle}
        description={C.disableBody}
        confirmLabel={copy.actions.disable}
        destructive
        reasonKind="disable_branch"
        reasonRequired
        onConfirm={reasonId =>
          runAction(
            async () => {
              for (const row of bulkAction?.rows ?? []) {
                await staffWrite(disableNccBranchRequest(row.id, reasonId!));
              }
              await invalidate("/api/ncc/directory/branches");
              bulkAction?.clear();
              setBulkAction(null);
            },
            { success: C.bulkDone }
          )
        }
      />

      <ConfirmDialog
        open={bulkAction?.mode === "enable"}
        onOpenChange={open => {
          if (!open) setBulkAction(null);
        }}
        title={S.enableTitle}
        description={S.enableBody}
        confirmLabel={copy.actions.enable}
        onConfirm={() =>
          runAction(
            async () => {
              for (const row of bulkAction?.rows ?? []) {
                await staffWrite(enableNccBranchRequest(row.id));
              }
              await invalidate("/api/ncc/directory/branches");
              bulkAction?.clear();
              setBulkAction(null);
            },
            { success: C.bulkDone }
          )
        }
      />
    </div>
  );
}
