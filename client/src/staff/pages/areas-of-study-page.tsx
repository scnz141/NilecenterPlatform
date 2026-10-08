import { useEffect, useMemo, useState } from "react";
import { GlyphClose } from "../ui/glyphs";
import {
  createNccAreaOfStudyRequest,
  disableNccAreaOfStudyRequest,
  enableNccAreaOfStudyRequest,
  fetchNccMoodleCoursesRequest,
  patchNccAreaOfStudyRequest,
  type NccAreaOfStudyDto,
  type NccMoodleCourseDto,
} from "@/lib/backend/api";
import { staffWrite, useInvalidate, useNcc } from "../api";
import { copy } from "../copy";
import { runAction } from "../run-action";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { FormSheet, StaffField } from "../ui/form-sheet";
import { ListPage, type ListColumn } from "../ui/list-page";
import { SearchableSelect } from "../ui/searchable-select";
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

const C = copy.catalog.areasOfStudy;
const S = copy.catalog.shared;

function courseLabel(course: { shortname: string; fullname: string }): string {
  return course.fullname && course.fullname !== course.shortname
    ? `${course.shortname} · ${course.fullname}`
    : course.shortname;
}

function PlacementCoursePicker({
  selectedIds,
  onChange,
}: {
  selectedIds: number[];
  onChange: (ids: number[]) => void;
}) {
  const [options, setOptions] = useState<
    { value: string; label: string; id: number }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    staffWrite(fetchNccMoodleCoursesRequest())
      .then(picker => {
        if (cancelled) return;
        setOptions(
          picker.courses.map((course: NccMoodleCourseDto) => ({
            value: String(course.id),
            label: courseLabel(course),
            id: course.id,
          }))
        );
      })
      .catch(() => {
        if (!cancelled) setError(C.coursesError);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = useMemo(
    () => options.filter(option => selectedIds.includes(option.id)),
    [options, selectedIds]
  );

  return (
    <div className="flex flex-col gap-2">
      <SearchableSelect
        options={options.filter(
          option => !selectedIds.includes(option.id)
        )}
        value=""
        onChange={value => {
          const id = Number(value);
          if (Number.isSafeInteger(id) && !selectedIds.includes(id)) {
            onChange([...selectedIds, id]);
          }
        }}
        placeholder={C.addCourse}
        searchPlaceholder={C.searchCourses}
        emptyLabel={loading ? C.coursesLoading : C.coursesEmpty}
      />
      {error ? (
        <p className="staff-field-error" role="alert">
          {error}
        </p>
      ) : null}
      {selected.length > 0 ? (
        <ul className="flex flex-wrap gap-1">
          {selected.map(option => (
            <li
              key={option.id}
              className="flex items-center gap-1 rounded-md border border-[var(--staff-border)] px-2 py-1 text-xs"
            >
              <span>{option.label}</span>
              <button
                type="button"
                className="staff-icon-btn"
                aria-label={copy.actions.clearSelection}
                onClick={() =>
                  onChange(selectedIds.filter(id => id !== option.id))
                }
              >
                <GlyphClose />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function AreaForm({
  open,
  onOpenChange,
  area,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  area: NccAreaOfStudyDto | null;
  onSaved: () => Promise<void> | void;
}) {
  const isEdit = Boolean(area);
  const [name, setName] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [courseIds, setCourseIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>();

  useEffect(() => {
    if (!open) return;
    setName(area?.name ?? "");
    setSortOrder(String(area?.sortOrder ?? 0));
    setCourseIds(
      (area?.placementCourses ?? []).map(course => course.moodleCourseId)
    );
    setFieldErrors(undefined);
  }, [open, area]);

  const dirty =
    name !== (area?.name ?? "") ||
    sortOrder !== String(area?.sortOrder ?? 0) ||
    JSON.stringify([...courseIds].sort()) !==
      JSON.stringify(
        [...(area?.placementCourses ?? []).map(c => c.moodleCourseId)].sort()
      );

  async function submit() {
    setSaving(true);
    setFieldErrors(undefined);
    try {
      const parsed = Number.parseInt(sortOrder, 10);
      const input = {
        name: name.trim(),
        sortOrder: Number.isSafeInteger(parsed) ? parsed : 0,
        placementCourseIds: courseIds,
      };
      await staffWrite(
        isEdit
          ? patchNccAreaOfStudyRequest(area!.id, input)
          : createNccAreaOfStudyRequest(input)
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
          <StaffField
            label={C.placementCourses}
            error={errorFor("placement_course_ids")}
          >
            <PlacementCoursePicker
              selectedIds={courseIds}
              onChange={setCourseIds}
            />
            <span className="staff-muted text-xs">
              {C.placementCoursesHint}
            </span>
          </StaffField>
        </>
      )}
    </FormSheet>
  );
}

export default function AreasOfStudyPage() {
  const canManage = useCanManage();
  const list = useNcc<{ items: NccAreaOfStudyDto[] }>(
    "/api/ncc/settings/areas-of-study"
  );
  const invalidate = useInvalidate();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<NccAreaOfStudyDto | null>(null);
  const [disableTarget, setDisableTarget] =
    useState<NccAreaOfStudyDto | null>(null);
  const [enableTarget, setEnableTarget] = useState<NccAreaOfStudyDto | null>(
    null
  );

  const items = list.data?.items;

  const columns: ListColumn<NccAreaOfStudyDto>[] = [
    {
      id: "name",
      label: S.name,
      always: true,
      sortValue: row => row.name,
      render: row => row.name,
    },
    {
      id: "courses",
      label: C.placementCourses,
      render: row =>
        row.placementCourses.length > 0
          ? row.placementCourses.map(course => course.shortname).join(", ")
          : copy.state.notSet,
    },
    {
      id: "sort",
      label: S.sortOrder,
      sortValue: row => row.sortOrder,
      render: row => String(row.sortOrder),
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
          listId="areas-of-study"
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

      <AreaForm
        open={formOpen}
        onOpenChange={setFormOpen}
        area={editing}
        onSaved={() => invalidate("/api/ncc/settings/areas-of-study")}
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
        reasonKind="disable_area_of_study"
        reasonRequired
        onConfirm={reasonId =>
          runAction(
            async () => {
              await staffWrite(
                disableNccAreaOfStudyRequest(disableTarget!.id, reasonId!)
              );
              await invalidate("/api/ncc/settings/areas-of-study");
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
              await staffWrite(enableNccAreaOfStudyRequest(enableTarget!.id));
              await invalidate("/api/ncc/settings/areas-of-study");
            },
            { success: S.enabledToast }
          )
        }
      />
    </div>
  );
}
