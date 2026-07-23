import { requireActiveUser } from "@/lib/auth/session";
import { useMemo, useState, type FormEvent } from "react";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import PlatformShell from "@/components/platform/PlatformShell";
import {
  FormFlowLayout,
  WorkspaceLayout,
} from "@/components/platform/PlatformLayouts";
import {
  DataTableCard,
  StatusBadge,
} from "@/components/platform/PlatformPrimitives";
import { runPlatformWorkflowActionRequest } from "@/lib/backend/api";
import { platformStore } from "@/lib/domain/store";
import type { EntityStatus } from "@/lib/domain/types";

type RoomStatus = Extract<EntityStatus, "active" | "pending" | "paused">;

function statusTone(status: EntityStatus): "green" | "amber" | "red" | "slate" {
  if (status === "active") return "green";
  if (status === "pending") return "amber";
  if (status === "paused") return "red";
  return "slate";
}

function humanize(value: string) {
  return value
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, character => character.toUpperCase());
}

type BranchRoomsPageProps = {
  view?: "list" | "create";
};

export default function BranchRoomsPage({
  view = "list",
}: BranchRoomsPageProps) {
  const [version, setVersion] = useState(0);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | RoomStatus>("all");
  const [roomStatusSaving, setRoomStatusSaving] = useState<string | null>(null);
  const [roomCreateSaving, setRoomCreateSaving] = useState(false);
  const [createResult, setCreateResult] = useState<string | null>(null);
  const [roomDraft, setRoomDraft] = useState({
    name: "",
    capacity: "18",
    equipment: "",
  });

  const state = useMemo(() => platformStore.getState(), [version]);
  const actorId = requireActiveUser("branchadmin").id;
  const actor = state.users.find(user => user.id === actorId);
  const staffProfile = state.staffProfiles.find(
    profile => profile.userId === actorId && profile.role === "branchadmin"
  );
  const branchId = actor?.branchId ?? staffProfile?.branchIds[0] ?? "br_cairo";
  const branch = state.branches.find(item => item.id === branchId);
  const branchRooms = state.rooms.filter(room => room.branchId === branch?.id);
  const activeRooms = branchRooms.filter(
    room => room.status === "active"
  ).length;
  const totalCapacity = branchRooms.reduce(
    (sum, room) => sum + room.capacity,
    0
  );

  const filteredRooms = branchRooms.filter(room => {
    const text = [room.name, room.status, room.equipment.join(" ")]
      .join(" ")
      .toLowerCase();
    const matchesQuery =
      !query.trim() || text.includes(query.trim().toLowerCase());
    const matchesStatus = status === "all" || room.status === status;
    return matchesQuery && matchesStatus;
  });

  const refresh = () => setVersion(value => value + 1);

  const updateRoomStatus = async (roomId: string, nextStatus: RoomStatus) => {
    setRoomStatusSaving(roomId);
    const result = await runPlatformWorkflowActionRequest({
      type: "room.status.update",
      roomId,
      status: nextStatus,
      actorId,
    });
    setRoomStatusSaving(null);

    if (!result.ok || !result.data) {
      toast.error("Room status update failed", {
        description: result.error ?? "The server could not update this room.",
      });
      return;
    }

    platformStore.setState(result.data.state);
    refresh();
    toast.success("Room status updated");
  };

  const addRoom = async (event: FormEvent) => {
    event.preventDefault();
    if (!branch || !roomDraft.name.trim()) {
      toast.error("Room name is required");
      return false;
    }

    setRoomCreateSaving(true);
    const result = await runPlatformWorkflowActionRequest({
      type: "room.create",
      branchId: branch.id,
      name: roomDraft.name.trim(),
      capacity: Number(roomDraft.capacity) || 18,
      equipment: roomDraft.equipment
        .split(",")
        .map(item => item.trim())
        .filter(Boolean),
      actorId,
    });
    setRoomCreateSaving(false);

    if (!result.ok || !result.data) {
      toast.error("Room create failed", {
        description: result.error ?? "The server could not create this room.",
      });
      return false;
    }

    platformStore.setState(result.data.state);
    setRoomDraft({ name: "", capacity: "18", equipment: "" });
    refresh();
    setCreateResult("The room is ready to use in the branch schedule.");
    toast.success("Room added");
    return true;
  };

  const createForm = (
    <section
      className="branch-inline-composer"
      data-testid="branch-room-composer"
    >
      <div className="branch-inline-composer-head">
        <div>
          <span>New room</span>
          <strong>{branch?.name ?? "Branch"}</strong>
        </div>
        <Link className="branch-inline-close" href="/app/branch/rooms">
          Cancel
        </Link>
      </div>
      <form className="branch-room-form" onSubmit={addRoom}>
        <label>
          Room name
          <input
            value={roomDraft.name}
            disabled={roomCreateSaving}
            onChange={event =>
              setRoomDraft(value => ({ ...value, name: event.target.value }))
            }
            placeholder="Room name"
          />
        </label>
        <label>
          Capacity
          <input
            type="number"
            min={1}
            max={200}
            value={roomDraft.capacity}
            disabled={roomCreateSaving}
            onChange={event =>
              setRoomDraft(value => ({
                ...value,
                capacity: event.target.value,
              }))
            }
            placeholder="18"
          />
        </label>
        <label>
          Equipment
          <input
            value={roomDraft.equipment}
            disabled={roomCreateSaving}
            onChange={event =>
              setRoomDraft(value => ({
                ...value,
                equipment: event.target.value,
              }))
            }
            placeholder="Projector, whiteboard"
          />
        </label>
        <button type="submit" disabled={roomCreateSaving}>
          <Plus size={15} />
          {roomCreateSaving ? "Adding room" : "Add room"}
        </button>
      </form>
    </section>
  );

  if (view === "create") {
    return (
      <PlatformShell role="branchadmin" title="Add room">
        <FormFlowLayout
          className="branch-rooms-page branch-rooms-create-page"
          title="Add room"
          description="Add one room for classes, placement, or branch events."
          context={branch?.name ?? "Branch"}
          actions={
            createResult ? (
              <Link className="platform-primary-button" href="/app/branch/rooms">
                View rooms
              </Link>
            ) : undefined
          }
          main={
            createResult ? (
              <section className="branch-create-success" role="status">
                <Plus size={20} />
                <div>
                  <strong>Room added</strong>
                  <span>{createResult}</span>
                </div>
              </section>
            ) : (
              createForm
            )
          }
        />
      </PlatformShell>
    );
  }

  return (
    <PlatformShell role="branchadmin" title="Rooms">
      <WorkspaceLayout
        className="branch-rooms-page"
        title="Rooms"
        description="Set room readiness before classes and placement events are scheduled."
        context={branch?.name ?? "Branch access"}
        actions={
          <Link
            className="platform-primary-button"
            href="/app/branch/rooms/new"
          >
            <Plus size={15} />
            Add room
          </Link>
        }
        toolbar={
          <div
            className="branch-compact-toolbar"
            data-testid="branch-rooms-toolbar"
          >
            <label>
              Search
              <span>
                <Search size={15} />
                <input
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="Room or equipment"
                />
              </span>
            </label>
            <label>
              Status
              <select
                value={status}
                onChange={event =>
                  setStatus(event.target.value as "all" | RoomStatus)
                }
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="pending">Pending</option>
              </select>
            </label>
          </div>
        }
        main={
          <div className="branch-workspace-main">
            <DataTableCard
              title="Room readiness"
              subtitle={`${filteredRooms.length} rooms · ${activeRooms} ready · ${totalCapacity} seats`}
            >
              <div className="branch-room-list" data-testid="branch-rooms-list">
                {filteredRooms.length ? (
                  filteredRooms.map(room => (
                    <article key={room.id}>
                      <div>
                        <strong>{room.name}</strong>
                        <small>
                          {room.capacity} seats ·{" "}
                          {room.equipment.join(", ") || "No equipment listed"}
                        </small>
                      </div>
                      <select
                        value={room.status}
                        disabled={roomStatusSaving === room.id}
                        onChange={event =>
                          void updateRoomStatus(
                            room.id,
                            event.target.value as RoomStatus
                          )
                        }
                        aria-label={`${room.name} status`}
                      >
                        <option value="active">Active</option>
                        <option value="paused">Paused</option>
                        <option value="pending">Pending</option>
                      </select>
                    </article>
                  ))
                ) : (
                  <article>
                    <div>
                      <strong>No rooms found</strong>
                      <small>
                        Try another search, or add the first room for this
                        branch.
                      </small>
                    </div>
                    <StatusBadge tone="slate">Empty</StatusBadge>
                  </article>
                )}
              </div>
            </DataTableCard>
          </div>
        }
      />
    </PlatformShell>
  );
}
