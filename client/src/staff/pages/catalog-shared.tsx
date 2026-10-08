import type { NccActionReasonKind } from "@/lib/backend/api";
import { copy } from "../copy";
import { useStaffSession } from "../session";
import { StatusBadge } from "../ui/primitives";

/** Catalog writes are Super Admin only, per the EMS contract. */
export function useCanManage(): boolean {
  const { session } = useStaffSession();
  return session?.ncc?.activeRole === "super_admin";
}

export { formatDate } from "../i18n";

export const ACTION_REASON_KINDS: NccActionReasonKind[] = [
  "lost",
  "left_enrolment",
  "cancel_enrolment",
  "cancel_placement_test",
  "cancel_trial_lesson",
  "disable_student",
  "disable_course",
  "disable_class",
  "disable_branch",
  "disable_department",
  "disable_room",
  "disable_staff",
  "disable_area_of_study",
  "disable_custom_field",
];

type KindKey = `kind${Capitalize<NccActionReasonKind>}`;

export function actionReasonKindLabel(kind: NccActionReasonKind): string {
  const key = `kind${kind.charAt(0).toUpperCase()}${kind.slice(1)}` as KindKey;
  return copy.catalog.actionReasons[key];
}

/** Built on each call so labels follow the active language. */
export function statusFilter() {
  return {
    key: "status",
    label: copy.catalog.shared.status,
    allLabel: copy.catalog.shared.allStatuses,
    options: [
      { value: "active", label: copy.catalog.shared.active },
      { value: "disabled", label: copy.catalog.shared.disabled },
    ],
  };
}

export function statusValue(row: { status: string }): string {
  return row.status;
}

export function CatalogStatus({ status }: { status: "active" | "disabled" }) {
  return <StatusBadge status={status} />;
}

export function RowActionButtons({
  onEdit,
  status,
  onToggle,
}: {
  onEdit?: () => void;
  status?: "active" | "disabled";
  onToggle?: () => void;
}) {
  return (
    <div className="staff-row-actions">
      {onEdit ? (
        <button
          type="button"
          className="staff-btn"
          data-variant="quiet"
          data-size="sm"
          onClick={onEdit}
        >
          {copy.actions.edit}
        </button>
      ) : null}
      {onToggle && status ? (
        <button
          type="button"
          className="staff-btn"
          data-variant={status === "active" ? "quiet-danger" : "quiet"}
          data-size="sm"
          onClick={onToggle}
        >
          {status === "active" ? copy.actions.disable : copy.actions.enable}
        </button>
      ) : null}
    </div>
  );
}

/** IANA timezone ids for the branch form, plus the current value if unknown. */
export function timezoneOptions(current?: string | null) {
  let zones: string[] = ["UTC"];
  try {
    if (
      typeof Intl !== "undefined" &&
      typeof Intl.supportedValuesOf === "function"
    ) {
      zones = [...Intl.supportedValuesOf("timeZone")].sort((a, b) =>
        a.localeCompare(b)
      );
    }
  } catch {
    // keep the UTC fallback
  }
  const options = zones.map(zone => ({ value: zone, label: zone }));
  const trimmed = current?.trim();
  if (trimmed && !zones.includes(trimmed)) {
    return [{ value: trimmed, label: trimmed }, ...options];
  }
  return options;
}
