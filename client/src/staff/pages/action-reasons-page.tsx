import { useEffect, useMemo, useState } from "react";
import {
  createNccActionReasonRequest,
  disableNccActionReasonRequest,
  enableNccActionReasonRequest,
  importNccActionReasonsRequest,
  patchNccActionReasonRequest,
  type NccActionReasonDto,
  type NccActionReasonKind,
} from "@/lib/backend/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/staff/ui/kit";
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
} from "../ui/primitives";
import {
  ACTION_REASON_KINDS,
  actionReasonKindLabel,
  CatalogStatus,
  formatDate,
  RowActionButtons,
  statusFilter,
  statusValue,
  useCanManage,
} from "./catalog-shared";

const C = copy.catalog.actionReasons;
const S = copy.catalog.shared;

/** Tolerant CSV cell splitter for the import preview (quotes + commas). */
function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quoted) {
      if (char === '"') {
        if (line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells.map(cell => cell.trim());
}

const CSV_HEADER = "id,action,name,status,sort_order,created_at";

interface PreviewRow {
  kind: string;
  name: string;
  status: string;
  sortOrder: string;
  error: string | null;
}

function previewRows(csv: string): PreviewRow[] {
  const lines = csv
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];
  let rows = lines.map(parseCsvLine);
  // Drop the header row when present (id,action,name,status,sort_order,...).
  if (rows.length > 0 && rows[0][0]?.toLowerCase() === "id") {
    rows = rows.slice(1);
  }
  return rows.map(row => {
    const [kind = "", name = "", status = "", sortOrder = ""] = row.slice(1, 5);
    const kindKnown = ACTION_REASON_KINDS.some(
      value =>
        value === kind ||
        actionReasonKindLabel(value).toLowerCase() === kind.toLowerCase()
    );
    let error: string | null = null;
    if (row.length < 5) error = C.rowErrorColumns;
    else if (!kindKnown) error = C.rowErrorKind;
    else if (!name.trim()) error = C.rowErrorName;
    return { kind, name, status, sortOrder, error };
  });
}

function downloadTemplate() {
  const blob = new Blob([`${CSV_HEADER}\n`], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "action-reasons-template.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function ImportDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => Promise<void> | void;
}) {
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [overwrite, setOverwrite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    created: number | null;
    updated: number | null;
  } | null>(null);

  const rows = useMemo(() => previewRows(csv), [csv]);

  useEffect(() => {
    if (!open) return;
    setCsv("");
    setFileName("");
    setOverwrite(false);
    setError(null);
    setResult(null);
  }, [open]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const { result: summary } = await staffWrite(
        importNccActionReasonsRequest({ csv, overwrite })
      );
      setResult(summary);
      await onDone();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : copy.state.errorGeneric
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{C.importTitle}</DialogTitle>
          <DialogDescription>{C.importDescription}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="staff-field">
            <div className="flex items-center gap-2">
              <input
                id="action-reason-import-file"
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={event => {
                  const file = event.target.files?.[0];
                  setError(null);
                  if (!file) return;
                  void file.text().then(text => {
                    setCsv(text);
                    setFileName(file.name);
                  });
                }}
              />
              <label
                htmlFor="action-reason-import-file"
                className="staff-dropzone"
              >
                <span>{fileName || C.chooseFile}</span>
              </label>
              <button
                type="button"
                className="staff-btn"
                data-size="sm"
                onClick={downloadTemplate}
              >
                {C.downloadTemplate}
              </button>
            </div>
            <label htmlFor="action-reason-import-csv" className="staff-muted">
              {C.orPaste}
            </label>
            <textarea
              id="action-reason-import-csv"
              className="staff-input font-mono text-xs"
              rows={4}
              value={csv}
              placeholder={C.csvPlaceholder}
              onChange={event => setCsv(event.target.value)}
              aria-label={C.importPreview}
            />
          </div>
          {rows.length > 0 ? (
            <div className="flex flex-col gap-1">
              <span className="staff-muted text-xs">
                {rows.length} {C.importRowCount}
              </span>
              <div className="staff-table-wrap max-h-48 overflow-auto">
                <table className="staff-table">
                  <thead>
                    <tr>
                      <th scope="col">{C.kind}</th>
                      <th scope="col">{S.name}</th>
                      <th scope="col">{S.status}</th>
                      <th scope="col">{S.sortOrder}</th>
                      <th scope="col">{C.rowError}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 25).map((row, index) => (
                      <tr key={index} data-invalid={row.error !== null}>
                        <td>{row.kind || copy.state.notSet}</td>
                        <td>{row.name || copy.state.notSet}</td>
                        <td>{row.status || copy.state.notSet}</td>
                        <td>{row.sortOrder || copy.state.notSet}</td>
                        <td>
                          {row.error ? (
                            <span className="staff-field-error">
                              {row.error}
                            </span>
                          ) : (
                            copy.state.notSet
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 25 ? (
                  <p className="staff-muted px-2 py-1 text-xs">
                    {rows.length - 25} more
                  </p>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="staff-muted text-sm">{C.importEmpty}</p>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={overwrite}
              onChange={event => setOverwrite(event.target.checked)}
            />
            Overwrite existing rows
          </label>
          {error ? (
            <p className="staff-field-error" role="alert">
              {error}
            </p>
          ) : null}
          {result ? (
            <p role="status">
              {C.importDone}
              {result.created !== null || result.updated !== null
                ? ` ${result.created ?? 0} ${C.importCreated}, ${result.updated ?? 0} ${C.importUpdated}.`
                : ""}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="staff-btn"
              onClick={() => onOpenChange(false)}
            >
              {copy.actions.close}
            </button>
            <button
              type="button"
              className="staff-btn"
              data-variant="primary"
              disabled={busy || rows.length === 0 || result !== null}
              onClick={() => void submit()}
            >
              {busy ? copy.actions.saving : C.importSubmit}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ActionReasonForm({
  open,
  onOpenChange,
  reason,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason: NccActionReasonDto | null;
  onSaved: () => Promise<void> | void;
}) {
  const isEdit = Boolean(reason);
  const [kind, setKind] = useState<NccActionReasonKind>("lost");
  const [name, setName] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>();

  useEffect(() => {
    if (!open) return;
    setKind(reason?.kind ?? "lost");
    setName(reason?.name ?? "");
    setSortOrder(String(reason?.sortOrder ?? 0));
    setFieldErrors(undefined);
  }, [open, reason]);

  const dirty =
    name !== (reason?.name ?? "") ||
    sortOrder !== String(reason?.sortOrder ?? 0) ||
    (!isEdit && kind !== "lost");

  async function submit() {
    setSaving(true);
    setFieldErrors(undefined);
    try {
      const parsed = Number.parseInt(sortOrder, 10);
      if (isEdit) {
        await staffWrite(
          patchNccActionReasonRequest(reason!.id, {
            name: name.trim(),
            sortOrder: Number.isSafeInteger(parsed) ? parsed : 0,
          })
        );
      } else {
        await staffWrite(
          createNccActionReasonRequest({
            kind,
            name: name.trim(),
            sortOrder: Number.isSafeInteger(parsed) ? parsed : 0,
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
            <StaffField label={C.kind} error={errorFor("kind")}>
              <Select
                value={kind}
                onValueChange={value =>
                  setKind(value as NccActionReasonKind)
                }
              >
                <SelectTrigger aria-label={C.kind}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_REASON_KINDS.map(value => (
                    <SelectItem key={value} value={value}>
                      {actionReasonKindLabel(value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </StaffField>
          ) : null}
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

export default function ActionReasonsPage() {
  const canManage = useCanManage();
  const list = useNcc<{ items: NccActionReasonDto[] }>(
    "/api/ncc/settings/action-reasons"
  );
  const invalidate = useInvalidate();
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<NccActionReasonDto | null>(null);
  const [disableTarget, setDisableTarget] =
    useState<NccActionReasonDto | null>(null);
  const [enableTarget, setEnableTarget] = useState<NccActionReasonDto | null>(
    null
  );

  const items = list.data?.items;

  const columns: ListColumn<NccActionReasonDto>[] = [
    {
      id: "name",
      label: S.name,
      always: true,
      sortValue: row => row.name,
      render: row => row.name,
    },
    {
      id: "kind",
      label: C.kind,
      sortValue: row => row.kind,
      render: row => actionReasonKindLabel(row.kind),
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
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="staff-btn"
                onClick={() => setImportOpen(true)}
              >
                {C.import}
              </button>
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
            </div>
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
          listId="action-reasons"
          items={items}
          columns={columns}
          rowKey={row => row.id}
          searchText={row => row.name}
          filters={[
            statusFilter(),
            {
              key: "kind",
              label: C.kind,
              allLabel: C.allKinds,
              options: ACTION_REASON_KINDS.map(kind => ({
                value: kind,
                label: actionReasonKindLabel(kind),
              })),
            },
          ]}
          filterValue={(row, key) =>
            key === "status" ? statusValue(row) : key === "kind" ? row.kind : null
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

      <ActionReasonForm
        open={formOpen}
        onOpenChange={setFormOpen}
        reason={editing}
        onSaved={() => invalidate("/api/ncc/settings/action-reasons")}
      />

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onDone={() => invalidate("/api/ncc/settings/action-reasons")}
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
              await staffWrite(
                disableNccActionReasonRequest(disableTarget!.id)
              );
              await invalidate("/api/ncc/settings/action-reasons");
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
                enableNccActionReasonRequest(enableTarget!.id)
              );
              await invalidate("/api/ncc/settings/action-reasons");
            },
            { success: S.enabledToast }
          )
        }
      />
    </div>
  );
}
