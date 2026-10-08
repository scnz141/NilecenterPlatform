import { useEffect, useMemo, useState } from "react";
import {
  createNccRoomRequest,
  patchNccRoomRequest,
  type NccRoomDto,
} from "@/lib/backend/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/staff/ui/kit";
import { staffWrite, useInvalidate } from "../api";
import { copy } from "../copy";
import { FormValidationError, runAction } from "../run-action";
import { useStaffSession } from "../session";
import { FormSheet, StaffField } from "../ui/form-sheet";
import { useBranches } from "./admissions-ui";

const R = copy.teaching.rooms;
const T = copy.teaching;

export function RoomForm({
  open,
  onOpenChange,
  room,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room: NccRoomDto | null;
  onSaved?: (room: NccRoomDto) => void;
}) {
  const { session } = useStaffSession();
  const superAdmin = session?.ncc?.activeRole === "super_admin";
  const branches = useBranches();
  const invalidate = useInvalidate();
  const initial = useMemo(
    () => ({
      name: room?.name ?? "",
      capacity: room?.capacity ? String(room.capacity) : "",
      branchId: room?.branchId ?? session?.ncc?.workspaceBranchId ?? "",
    }),
    [room, session?.ncc?.workspaceBranchId]
  );
  const [draft, setDraft] = useState(initial);
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>();
  useEffect(() => {
    if (!open) return;
    setDraft(initial);
    setAttempted(false);
    setFieldErrors(undefined);
  }, [open, initial]);

  const capacity = draft.capacity ? Number(draft.capacity) : null;
  const errors = {
    name: draft.name.trim() ? null : T.required,
    capacity: capacity === null || (Number.isInteger(capacity) && capacity > 0) ? null : T.wholeNumber,
    branchId: !room && superAdmin && !draft.branchId ? T.required : null,
  };
  const show = (message: string | null) => (attempted ? message : null);

  async function submit() {
    setAttempted(true);
    if (Object.values(errors).some(Boolean)) throw new FormValidationError();
    setSaving(true);
    setFieldErrors(undefined);
    try {
      const saved = room
        ? (
            await staffWrite(
              patchNccRoomRequest(room.id, {
                ...(draft.name.trim() !== initial.name ? { name: draft.name.trim() } : {}),
                ...(draft.capacity !== initial.capacity ? { capacity } : {}),
              })
            )
          ).room
        : (
            await staffWrite(
              createNccRoomRequest({
                name: draft.name.trim(),
                capacity,
                ...(superAdmin ? { branchId: draft.branchId } : {}),
              })
            )
          ).room;
      await invalidate("/api/ncc/delivery/rooms");
      onOpenChange(false);
      onSaved?.(saved);
    } catch (error) {
      const details = (error as { details?: Record<string, string[]> }).details;
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
      title={room ? R.editTitle : R.createTitle}
      description={R.createDescription}
      dirty={JSON.stringify(draft) !== JSON.stringify(initial)}
      saving={saving}
      fieldErrors={fieldErrors}
      saveLabel={room ? copy.catalog.shared.saveChanges : R.createSubmit}
      onSubmit={() => runAction(submit, { success: room ? R.updatedToast : R.createdToast })}
    >
      {errorFor => (
        <>
          <StaffField label={R.name} htmlFor="room-name" error={show(errors.name) ?? errorFor("name")}>
            <input
              id="room-name"
              className="staff-input"
              maxLength={120}
              value={draft.name}
              onChange={event => setDraft(d => ({ ...d, name: event.target.value }))}
            />
          </StaffField>
          <StaffField label={R.capacity} htmlFor="room-capacity" error={show(errors.capacity) ?? errorFor("capacity")}>
            <input
              id="room-capacity"
              inputMode="numeric"
              className="staff-input staff-figures"
              value={draft.capacity}
              onChange={event => setDraft(d => ({ ...d, capacity: event.target.value.replace(/\D/g, "") }))}
            />
          </StaffField>
          {!room && superAdmin ? (
            <StaffField label={T.branch} error={show(errors.branchId) ?? errorFor("branch_id")}>
              <Select value={draft.branchId || undefined} onValueChange={value => setDraft(d => ({ ...d, branchId: value }))}>
                <SelectTrigger aria-label={T.branch}>
                  <SelectValue placeholder={copy.admissions.leads.chooseBranch} />
                </SelectTrigger>
                <SelectContent>
                  {branches.active.map(branch => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </StaffField>
          ) : null}
        </>
      )}
    </FormSheet>
  );
}
