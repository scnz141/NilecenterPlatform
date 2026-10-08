import { useMemo, useState } from "react";
import { useParams } from "wouter";
import { MoreHorizontal, Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  disableNccRoomRequest,
  enableNccRoomRequest,
  patchNccRoomHourCellsRequest,
  type NccHourCellOpDto,
  type NccHourCellRangeDto,
  type NccRoomDto,
} from "@/lib/backend/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/staff/ui/kit";
import { staffWrite, useInvalidate, useNcc } from "../api";
import { copy } from "../copy";
import { toIsoDate, weekDates } from "../hour-cells";
import { isClassCatalogWriter } from "../roles";
import { runAction } from "../run-action";
import { useStaffSession } from "../session";
import { useStaffCrumb } from "../shell/staff-shell";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { HourCellsGrid } from "../ui/hour-cells-grid";
import { ErrorState, LoadingRows, StatusBadge } from "../ui/primitives";
import { RoomForm } from "./room-form";

const R = copy.teaching.rooms;

export default function RoomDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { session } = useStaffSession();
  const canWrite = isClassCatalogWriter(session?.ncc?.activeRole);
  const invalidate = useInvalidate();
  const [pending, setPending] = useState<"edit" | "disable" | "enable" | null>(null);
  const [anchor, setAnchor] = useState(() => toIsoDate(new Date()));
  const week = useMemo(() => weekDates(anchor), [anchor]);
  const query = useNcc<{ room: NccRoomDto }>(id ? `/api/ncc/delivery/rooms/${encodeURIComponent(id)}` : null);
  const range = useNcc<{ range: NccHourCellRangeDto }>(
    id ? `/api/ncc/delivery/rooms/${encodeURIComponent(id)}/hour-cells` : null,
    { from: week[0], to: week[6] }
  );
  const room = query.data?.room;
  useStaffCrumb(room?.name ?? null);

  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.mutate()} />;
  if (!room) return <LoadingRows />;
  const refresh = () => invalidate("/api/ncc/delivery/rooms");

  async function save(ops: NccHourCellOpDto[]) {
    const result = await runAction(
      async () => {
        const out = await staffWrite(patchNccRoomHourCellsRequest(room!.id, ops));
        if (out.skippedBooked > 0) toast.message(copy.staffUsers.cellsSkippedBooked);
        await range.mutate();
        return out;
      },
      { success: R.availabilityToast }
    );
    return result !== undefined;
  }

  return (
    <div className="staff-detail flex min-w-0 flex-col gap-6">
      <header className="staff-detail-head">
        <div className="min-w-0">
          <div className="staff-eyebrow">{room.branchName}</div>
          <h1 className="staff-detail-name">{room.name}</h1>
          <div className="staff-detail-meta">
            <StatusBadge status={room.status} />
            <span className="staff-muted">
              {room.capacity ? `${room.capacity} ${copy.teaching.seats}` : R.unlimited}
            </span>
          </div>
        </div>
        {canWrite ? (
          <div className="staff-detail-actions">
            <button type="button" className="staff-btn" data-size="sm" onClick={() => setPending("edit")}>
              <Pencil strokeWidth={1.75} aria-hidden />
              {copy.actions.edit}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="staff-icon-btn" aria-label={copy.staffUsers.moreActions}>
                  <MoreHorizontal strokeWidth={1.75} aria-hidden />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {room.status === "active" ? (
                  <DropdownMenuItem className="text-[var(--staff-red)]" onSelect={() => setPending("disable")}>
                    {R.disable}
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onSelect={() => setPending("enable")}>{R.enable}</DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : null}
      </header>

      <section className="staff-section">
        <h2 className="staff-section-title">{R.availability}</h2>
        <p className="staff-hint">{R.availabilityHint}</p>
        {range.error ? (
          <ErrorState error={range.error} onRetry={() => void range.mutate()} />
        ) : (
          <HourCellsGrid
            range={range.data?.range ?? null}
            loading={range.isLoading}
            canPaint={canWrite && room.status === "active"}
            anchor={anchor}
            onAnchorChange={setAnchor}
            onSave={save}
          />
        )}
      </section>

      <RoomForm open={pending === "edit"} onOpenChange={open => !open && setPending(null)} room={room} />
      <ConfirmDialog
        open={pending === "disable"}
        onOpenChange={open => !open && setPending(null)}
        title={R.disableTitle}
        description={R.disableBody}
        confirmLabel={R.disable}
        destructive
        reasonKind="disable_room"
        reasonRequired
        onConfirm={reasonId =>
          runAction(
            async () => {
              await staffWrite(disableNccRoomRequest(room.id, reasonId));
              await refresh();
            },
            { success: R.disabledToast }
          )
        }
      />
      <ConfirmDialog
        open={pending === "enable"}
        onOpenChange={open => !open && setPending(null)}
        title={R.enableTitle}
        description={R.enableBody}
        confirmLabel={R.enable}
        onConfirm={() =>
          runAction(
            async () => {
              await staffWrite(enableNccRoomRequest(room.id));
              await refresh();
            },
            { success: R.enabledToast }
          )
        }
      />
    </div>
  );
}
