import { getStoredAuthSession, requireActiveUser } from "@/lib/auth/session";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { ArrowLeft, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";
import PlatformShell from "@/components/platform/PlatformShell";
import NccReadStatus from "@/components/platform/NccReadStatus";
import {
  DetailLayout,
  FormFlowLayout,
  WorkspaceLayout,
} from "@/components/platform/PlatformLayouts";
import {
  DataTableCard,
  StatusBadge,
} from "@/components/platform/PlatformPrimitives";
import {
  createNccRoomRequest,
  disableNccRoomRequest,
  enableNccRoomRequest,
  fetchNccRoomRequest,
  fetchNccRoomsRequest,
  patchNccRoomRequest,
  runPlatformWorkflowActionRequest,
  type NccRoomDto,
} from "@/lib/backend/api";
import {
  classifyNccFailure,
  type NccReadState,
} from "@/lib/backend/nccReadState";
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
  view?: "list" | "create" | "detail";
  roomId?: string;
};

export default function BranchRoomsPage({
  view = "list",
  roomId,
}: BranchRoomsPageProps) {
  if (getStoredAuthSession()?.provider === "ncc") {
    return <NccBranchRoomsPage view={view} roomId={roomId} />;
  }
  return <CompatibilityBranchRoomsPage view={view} />;
}

function CompatibilityBranchRoomsPage({
  view,
}: {
  view: "list" | "create" | "detail" | undefined;
}) {
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

function NccBranchRoomsPage({ view = "list", roomId }: BranchRoomsPageProps) {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "disabled">("all");
  const [rooms, setRooms] = useState<NccReadState<NccRoomDto[]>>({
    status: "loading",
  });
  const [room, setRoom] = useState<NccReadState<NccRoomDto>>({
    status: "loading",
  });
  const [draft, setDraft] = useState({
    name: "",
    capacity: "",
    sortOrder: "0",
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const loadRooms = useCallback(async () => {
    setRooms({ status: "loading" });
    const result = await fetchNccRoomsRequest();
    setRooms(
      result.ok && result.data
        ? { status: "ready", data: result.data.items }
        : classifyNccFailure(result)
    );
  }, []);

  const loadRoom = useCallback(async () => {
    if (!roomId) return;
    setRoom({ status: "loading" });
    const result = await fetchNccRoomRequest(roomId);
    if (!result.ok || !result.data) {
      setRoom(classifyNccFailure(result));
      return;
    }
    const record = result.data.room;
    setRoom({ status: "ready", data: record });
    setDraft({
      name: record.name,
      capacity: record.capacity === null ? "" : String(record.capacity),
      sortOrder: String(record.sortOrder),
    });
  }, [roomId]);

  useEffect(() => {
    if (view === "list") void loadRooms();
    if (view === "detail") void loadRoom();
  }, [view, loadRooms, loadRoom]);

  const filteredRooms =
    rooms.status === "ready"
      ? rooms.data.filter(
          item =>
            item.name.toLowerCase().includes(search.trim().toLowerCase()) &&
            (status === "all" || item.status === status)
        )
      : [];

  const capacityValue = draft.capacity.trim();
  const parsedCapacity = capacityValue ? Number(capacityValue) : null;
  const capacityInvalid =
    parsedCapacity !== null &&
    (!Number.isSafeInteger(parsedCapacity) || parsedCapacity < 1);

  const createRoom = async () => {
    if (pending || !draft.name.trim() || capacityInvalid) return;
    setPending(true);
    setError("");
    const response = await createNccRoomRequest({
      name: draft.name.trim(),
      capacity: parsedCapacity,
    });
    setPending(false);
    if (!response.ok || !response.data) {
      setError(response.error ?? "The room could not be created.");
      return;
    }
    navigate(`/app/branch/rooms/${response.data.room.id}`);
  };

  const saveRoom = async () => {
    if (pending || room.status !== "ready") return;
    const record = room.data;
    if (!draft.name.trim() || capacityInvalid) {
      setError(
        !draft.name.trim()
          ? "Room name is required."
          : "Capacity must be a positive integer."
      );
      return;
    }
    const input: {
      name?: string;
      capacity?: number | null;
      sortOrder?: number;
    } = {};
    if (draft.name.trim() !== record.name) input.name = draft.name.trim();
    if (parsedCapacity !== record.capacity) input.capacity = parsedCapacity;
    const sortOrder = Number(draft.sortOrder);
    if (Number.isSafeInteger(sortOrder) && sortOrder !== record.sortOrder) {
      input.sortOrder = sortOrder;
    }
    setPending(true);
    setError("");
    const response = await patchNccRoomRequest(record.id, input);
    setPending(false);
    if (!response.ok) {
      setError(response.error ?? "The room could not be updated.");
      return;
    }
    await loadRoom();
  };

  const toggleRoom = async () => {
    if (pending || room.status !== "ready") return;
    setPending(true);
    setError("");
    const response =
      room.data.status === "active"
        ? await disableNccRoomRequest(room.data.id)
        : await enableNccRoomRequest(room.data.id);
    setPending(false);
    if (!response.ok) {
      setError(response.error ?? "The room could not be updated.");
      return;
    }
    await loadRoom();
  };

  const roomForm = (submitLabel: string, submit: () => void) => (
    <div className="admin-user-detail-form">
      <label>
        Name
        <input
          value={draft.name}
          disabled={pending}
          onChange={event =>
            setDraft(current => ({ ...current, name: event.target.value }))
          }
        />
      </label>
      <label>
        Capacity
        <input
          type="number"
          min={1}
          value={draft.capacity}
          disabled={pending}
          placeholder="Optional"
          onChange={event =>
            setDraft(current => ({ ...current, capacity: event.target.value }))
          }
        />
      </label>
      {view === "detail" ? (
        <label>
          Sort order
          <input
            type="number"
            value={draft.sortOrder}
            disabled={pending}
            onChange={event =>
              setDraft(current => ({
                ...current,
                sortOrder: event.target.value,
              }))
            }
          />
        </label>
      ) : null}
      {error ? (
        <p className="platform-form-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="admin-user-detail-form-actions">
        <Link className="platform-secondary-button" href="/app/branch/rooms">
          Back to rooms
        </Link>
        <button
          type="button"
          className="platform-primary-button"
          disabled={pending || !draft.name.trim() || capacityInvalid}
          onClick={submit}
        >
          {pending ? "Saving" : submitLabel}
        </button>
        {view === "detail" && room.status === "ready" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => void toggleRoom()}
          >
            {room.data.status === "active" ? "Disable" : "Enable"}
          </button>
        ) : null}
      </div>
    </div>
  );

  const titles: Record<string, { title: string; description: string }> = {
    list: { title: "Rooms", description: "Manage EMS delivery rooms." },
    create: { title: "Add room", description: "Create one EMS room." },
    detail: {
      title: room.status === "ready" ? room.data.name : "Room",
      description: "Review one EMS room.",
    },
  };

  const main = {
    list: (
      <DataTableCard
        title="EMS rooms"
        subtitle={
          rooms.status === "ready" ? `${filteredRooms.length} room(s)` : ""
        }
        className="admin-ia-table-card"
      >
        {rooms.status !== "ready" ? (
          <NccReadStatus state={rooms} onRetry={() => void loadRooms()} />
        ) : (
          <div className="admin-record-list">
            {filteredRooms.map(item => (
              <article key={item.id}>
                <div className="admin-record-list-copy">
                  <span>{item.branchName}</span>
                  <strong>{item.name}</strong>
                  <p>
                    Capacity{" "}
                    {item.capacity === null ? "not set" : item.capacity} · Sort
                    order {item.sortOrder}
                  </p>
                </div>
                <div className="admin-record-list-actions">
                  <StatusBadge
                    tone={item.status === "active" ? "green" : "slate"}
                  >
                    {item.status}
                  </StatusBadge>
                  <Link
                    className="simple-portal-row-action"
                    href={`/app/branch/rooms/${item.id}`}
                  >
                    Details
                  </Link>
                </div>
              </article>
            ))}
            {!filteredRooms.length ? (
              <div className="platform-empty-state">
                <strong>No rooms found</strong>
                <span>Try a different search or status filter.</span>
              </div>
            ) : null}
          </div>
        )}
      </DataTableCard>
    ),
    create: (
      <DataTableCard
        title="New EMS room"
        subtitle="The workspace branch is assigned automatically."
        className="admin-ia-table-card"
      >
        {roomForm("Create room", () => void createRoom())}
      </DataTableCard>
    ),
    detail: (
      <DataTableCard
        title="Room detail"
        subtitle={
          room.status === "ready" ? room.data.branchName : "EMS room record"
        }
        className="admin-ia-table-card"
      >
        {room.status !== "ready" ? (
          <NccReadStatus state={room} onRetry={() => void loadRoom()} />
        ) : (
          roomForm("Save room", () => void saveRoom())
        )}
      </DataTableCard>
    ),
  }[view];

  return (
    <PlatformShell role="branchadmin" title="Rooms">
      <WorkspaceLayout
        className="admin-ia-page"
        title={titles[view].title}
        description={titles[view].description}
        actions={
          view === "list" ? (
            <Link
              className="platform-primary-button"
              href="/app/branch/rooms/new"
            >
              <Plus size={15} />
              Add room
            </Link>
          ) : (
            <Link className="platform-secondary-button" href="/app/branch/rooms">
              <ArrowLeft size={15} />
              Back to rooms
            </Link>
          )
        }
        toolbar={
          view === "list" ? (
            <div className="admin-ia-control-row">
              <div className="admin-ia-toolbar">
                <label className="admin-ia-search">
                  <Search size={16} />
                  <input
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                    placeholder="Search rooms"
                    aria-label="Search rooms"
                  />
                </label>
                <label>
                  Status
                  <select
                    value={status}
                    onChange={event =>
                      setStatus(
                        event.target.value as "all" | "active" | "disabled"
                      )
                    }
                  >
                    <option value="all">All statuses</option>
                    <option value="active">Active</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </label>
              </div>
            </div>
          ) : null
        }
        main={main}
      />
    </PlatformShell>
  );
}
