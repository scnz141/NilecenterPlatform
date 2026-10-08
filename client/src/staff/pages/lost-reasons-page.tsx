import { useEffect, useState } from "react";
import {
  createNccLostReasonRequest,
  disableNccLostReasonRequest,
  enableNccLostReasonRequest,
  patchNccLostReasonRequest,
  type NccLostReasonDto,
} from "@/lib/backend/api";
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
} from "../ui/primitives";
import {
  CatalogStatus,
  formatDate,
  RowActionButtons,
  statusFilter,
  statusValue,
  useCanManage,
} from "./catalog-shared";

const C = copy.catalog.lostReasons;
const S = copy.catalog.shared;

function LostReasonForm({
  open,
  onOpenChange,
  reason,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason: NccLostReasonDto | null;
  onSaved: () => Promise<void> | void;
}) {
  const isEdit = Boolean(reason);
  const [name, setName] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>();

  useEffect(() => {
    if (!open) return;
    setName(reason?.name ?? "");
    setSortOrder(String(reason?.sortOrder ?? 0));
    setFieldErrors(undefined);
  }, [open, reason]);

  const dirty =
    name !== (reason?.name ?? "") ||
    sortOrder !== String(reason?.sortOrder ?? 0);

  async function submit() {
    setSaving(true);
    setFieldErrors(undefined);
    try {
      const parsed = Number.parseInt(sortOrder, 10);
      const input = {
        name: name.trim(),
        sortOrder: Number.isSafeInteger(parsed) ? parsed : 0,
      };
      await staffWrite(
        isEdit
          ? patchNccLostReasonRequest(reason!.id, input)
          : createNccLostReasonRequest(input)
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
          <StaffField label={S.sortOrder} error={errorFor("sort_order")}>
            <input
              type="number"
              className="staff-input"
              value={sortOrder}
              onChange={event => setSortOrder(event.target.value)}
            />
          </StaffField>
        </>
      )}
    </FormSheet>
  );
}

export default function LostReasonsPage() {
  const canManage = useCanManage();
  const list = useNcc<{ items: NccLostReasonDto[] }>(
    "/api/ncc/settings/lost-reasons"
  );
  const invalidate = useInvalidate();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<NccLostReasonDto | null>(null);
  const [disableTarget, setDisableTarget] =
    useState<NccLostReasonDto | null>(null);
  const [enableTarget, setEnableTarget] = useState<NccLostReasonDto | null>(
    null
  );

  const items = list.data?.items;

  const columns: ListColumn<NccLostReasonDto>[] = [
    {
      id: "name",
      label: S.name,
      always: true,
      sortValue: row => row.name,
      render: row => row.name,
    },
    {
      id: "sort",
      label: S.sortOrder,
      sortValue: row => row.sortOrder,
      render: row => String(row.sortOrder),
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
          listId="lost-reasons"
          items={items}
          columns={columns}
          rowKey={row => row.id}
          searchText={row => row.name}
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

      <LostReasonForm
        open={formOpen}
        onOpenChange={setFormOpen}
        reason={editing}
        onSaved={() => invalidate("/api/ncc/settings/lost-reasons")}
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
        onConfirm={() =>
          runAction(
            async () => {
              await staffWrite(disableNccLostReasonRequest(disableTarget!.id));
              await invalidate("/api/ncc/settings/lost-reasons");
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
              await staffWrite(enableNccLostReasonRequest(enableTarget!.id));
              await invalidate("/api/ncc/settings/lost-reasons");
            },
            { success: S.enabledToast }
          )
        }
      />
    </div>
  );
}
