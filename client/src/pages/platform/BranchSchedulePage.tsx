import { requireActiveUser } from "@/lib/auth/session";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CalendarDays, Plus, Search } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
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
import type { CalendarEventType, EntityStatus } from "@/lib/domain/types";

const branchEventTypes: CalendarEventType[] = [
  "live_session",
  "class_session",
  "placement_test",
  "room_booking",
  "exam",
];

function humanize(value: string) {
  return value
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, character => character.toUpperCase());
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function statusTone(status: EntityStatus): "green" | "amber" | "red" | "slate" {
  if (status === "active" || status === "completed") return "green";
  if (status === "pending" || status === "draft") return "amber";
  if (status === "paused" || status === "cancelled" || status === "overdue")
    return "red";
  return "slate";
}

type BranchSchedulePageProps = {
  view?: "list" | "create";
};

export default function BranchSchedulePage({
  view = "list",
}: BranchSchedulePageProps) {
  const [version, setVersion] = useState(0);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | CalendarEventType>(
    "all"
  );
  const [eventSaving, setEventSaving] = useState(false);
  const [eventResult, setEventResult] = useState<string | null>(null);
  const [eventDraft, setEventDraft] = useState({
    title: "Focused live class",
    type: "live_session" as CalendarEventType,
    date: "2026-07-03",
    starts: "14:00",
    ends: "14:45",
    roomId: "",
    classGroupId: "",
  });

  const state = useMemo(() => platformStore.getState(), [version]);
  const actorId = requireActiveUser("branchadmin").id;
  const actor = state.users.find(user => user.id === actorId);
  const staffProfile = state.staffProfiles.find(
    profile => profile.userId === actorId && profile.role === "branchadmin"
  );
  const branchId = actor?.branchId ?? staffProfile?.branchIds[0] ?? "br_cairo";
  const branch = state.branches.find(item => item.id === branchId);
  const branchRuns = state.courseRuns.filter(
    run => run.branchId === branch?.id
  );
  const branchRunIds = new Set(branchRuns.map(run => run.id));
  const branchClasses = state.classGroups.filter(classGroup =>
    branchRunIds.has(classGroup.courseRunId)
  );
  const branchClassIds = new Set(
    branchClasses.map(classGroup => classGroup.id)
  );
  const branchRooms = state.rooms.filter(room => room.branchId === branch?.id);
  const branchEvents = state.events
    .filter(
      event =>
        event.branchId === branch?.id ||
        (event.classGroupId && branchClassIds.has(event.classGroupId))
    )
    .slice()
    .sort((first, second) => first.startsAt.localeCompare(second.startsAt));
  const branchClassKey = branchClasses
    .map(classGroup => classGroup.id)
    .join("|");
  const branchRoomKey = branchRooms.map(room => room.id).join("|");

  useEffect(() => {
    setEventDraft(value => ({
      ...value,
      roomId: branchRooms.some(room => room.id === value.roomId)
        ? value.roomId
        : (branchRooms[0]?.id ?? ""),
      classGroupId: branchClasses.some(
        classGroup => classGroup.id === value.classGroupId
      )
        ? value.classGroupId
        : (branchClasses[0]?.id ?? ""),
    }));
  }, [branchClassKey, branchRoomKey]);

  const filteredEvents = branchEvents.filter(event => {
    const room = state.rooms.find(item => item.id === event.roomId);
    const classGroup = state.classGroups.find(
      item => item.id === event.classGroupId
    );
    const text = [
      event.title,
      event.type,
      event.status,
      room?.name,
      classGroup?.name,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const matchesQuery =
      !query.trim() || text.includes(query.trim().toLowerCase());
    const matchesType = typeFilter === "all" || event.type === typeFilter;
    return matchesQuery && matchesType;
  });

  const refresh = () => setVersion(value => value + 1);

  const createBranchEvent = async (event: FormEvent) => {
    event.preventDefault();
    if (
      !branch ||
      !eventDraft.title.trim() ||
      !eventDraft.date ||
      !eventDraft.starts ||
      !eventDraft.ends ||
      eventDraft.starts >= eventDraft.ends
    ) {
      toast.error("Valid title, date, and time range are required");
      return false;
    }

    const needsClass =
      eventDraft.type === "live_session" || eventDraft.type === "class_session";
    const selectedClassId = branchClasses.some(
      classGroup => classGroup.id === eventDraft.classGroupId
    )
      ? eventDraft.classGroupId
      : needsClass
        ? branchClasses[0]?.id
        : undefined;
    if (needsClass && !selectedClassId) {
      toast.error("Assign a branch class before scheduling this event");
      return false;
    }

    const selectedRoomId = branchRooms.some(
      room => room.id === eventDraft.roomId
    )
      ? eventDraft.roomId
      : branchRooms[0]?.id;
    if (eventDraft.type === "room_booking" && !selectedRoomId) {
      toast.error("Choose a branch room before creating a room booking");
      return false;
    }

    setEventSaving(true);
    const result = await runPlatformWorkflowActionRequest({
      type: "calendar.create",
      eventType: eventDraft.type,
      title: eventDraft.title.trim(),
      startsAt: `${eventDraft.date}T${eventDraft.starts}:00+03:00`,
      endsAt: `${eventDraft.date}T${eventDraft.ends}:00+03:00`,
      branchId: branch.id,
      roomId: selectedRoomId,
      classGroupId: selectedClassId,
      actorId,
    });
    setEventSaving(false);

    if (!result.ok || !result.data) {
      toast.error("Event save failed", {
        description:
          result.error ?? "The server could not save this branch event.",
      });
      return false;
    }

    const payload = result.data.result.result as
      | { conflicts?: unknown[]; availabilityGaps?: unknown[] }
      | undefined;
    platformStore.setState(result.data.state);
    refresh();
    setEventResult(
      payload?.conflicts?.length || payload?.availabilityGaps?.length
        ? "The event was saved for the branch team to review."
        : "The event is now visible on the branch schedule."
    );
    toast.success(
      payload?.conflicts?.length || payload?.availabilityGaps?.length
        ? "Event saved for review"
        : "Event scheduled"
    );
    return true;
  };

  const eventForm = (
    <section
      className="branch-inline-composer"
      data-testid="branch-schedule-composer"
    >
      <div className="branch-inline-composer-head">
        <div>
          <span>New event</span>
          <strong>{branch?.name ?? "Branch"}</strong>
        </div>
        <Link className="branch-inline-close" href="/app/branch/schedule">
          Cancel
        </Link>
      </div>
      <form className="branch-room-form" onSubmit={createBranchEvent}>
        <label>
          Title
          <input
            value={eventDraft.title}
            disabled={eventSaving}
            onChange={event =>
              setEventDraft(value => ({ ...value, title: event.target.value }))
            }
            placeholder="Branch session title"
          />
        </label>
        <label>
          Type
          <select
            value={eventDraft.type}
            disabled={eventSaving}
            onChange={event =>
              setEventDraft(value => ({
                ...value,
                type: event.target.value as CalendarEventType,
              }))
            }
          >
            {branchEventTypes.map(type => (
              <option key={type} value={type}>
                {humanize(type)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Date
          <input
            type="date"
            value={eventDraft.date}
            disabled={eventSaving}
            onChange={event =>
              setEventDraft(value => ({ ...value, date: event.target.value }))
            }
          />
        </label>
        <label>
          Starts
          <input
            type="time"
            value={eventDraft.starts}
            disabled={eventSaving}
            onChange={event =>
              setEventDraft(value => ({ ...value, starts: event.target.value }))
            }
          />
        </label>
        <label>
          Ends
          <input
            type="time"
            value={eventDraft.ends}
            disabled={eventSaving}
            onChange={event =>
              setEventDraft(value => ({ ...value, ends: event.target.value }))
            }
          />
        </label>
        <label>
          Room
          <select
            value={eventDraft.roomId}
            disabled={eventSaving || !branchRooms.length}
            onChange={event =>
              setEventDraft(value => ({ ...value, roomId: event.target.value }))
            }
          >
            {branchRooms.length ? (
              branchRooms.map(room => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))
            ) : (
              <option value="">No room</option>
            )}
          </select>
        </label>
        <label>
          Class
          <select
            value={eventDraft.classGroupId}
            disabled={eventSaving || !branchClasses.length}
            onChange={event =>
              setEventDraft(value => ({
                ...value,
                classGroupId: event.target.value,
              }))
            }
          >
            {branchClasses.length ? (
              branchClasses.map(classGroup => (
                <option key={classGroup.id} value={classGroup.id}>
                  {classGroup.name}
                </option>
              ))
            ) : (
              <option value="">No branch classes</option>
            )}
          </select>
        </label>
        <button type="submit" disabled={eventSaving}>
          <Plus size={15} />
          {eventSaving ? "Saving event" : "Create event"}
        </button>
      </form>
    </section>
  );

  const scheduleList = (
    <DataTableCard
      title="Branch calendar"
      subtitle={`${filteredEvents.length} scheduled event(s)`}
    >
      <div
        className="branch-class-list compact"
        data-testid="branch-schedule-list"
      >
        {filteredEvents.length ? (
          filteredEvents.map(event => {
            const room = state.rooms.find(item => item.id === event.roomId);
            const classGroup = state.classGroups.find(
              item => item.id === event.classGroupId
            );
            return (
              <article key={event.id}>
                <div>
                  <strong>{event.title}</strong>
                  <small>
                    {humanize(event.type)} · {formatDateTime(event.startsAt)}
                    {classGroup ? ` · ${classGroup.name}` : ""}
                    {room ? ` · ${room.name}` : ""}
                  </small>
                </div>
                <StatusBadge tone={statusTone(event.status)}>
                  {humanize(event.status)}
                </StatusBadge>
                {state.classSessions.some(item => item.eventId === event.id) ? (
                  <Link
                    className="platform-row-link"
                    href={`/app/branch/schedule/sessions/${
                      state.classSessions.find(
                        item => item.eventId === event.id
                      )?.id
                    }`}
                  >
                    Manage
                  </Link>
                ) : null}
              </article>
            );
          })
        ) : (
          <article>
            <div>
              <strong>No events found</strong>
              <small>Create the first event for this branch.</small>
            </div>
            <StatusBadge tone="slate">Empty</StatusBadge>
          </article>
        )}
      </div>
    </DataTableCard>
  );

  if (view === "create") {
    return (
      <PlatformShell role="branchadmin" title="Create event">
        <FormFlowLayout
          className="branch-schedule-page branch-schedule-create-page"
          title="Create event"
          description="Schedule one class, placement, exam, or room event."
          context={branch?.name ?? "Branch"}
          actions={
            eventResult ? (
              <Link
                className="platform-primary-button"
                href="/app/branch/schedule"
              >
                View schedule
              </Link>
            ) : undefined
          }
          main={
            eventResult ? (
              <section className="branch-create-success" role="status">
                <CalendarDays size={20} />
                <div>
                  <strong>Event saved</strong>
                  <span>{eventResult}</span>
                </div>
              </section>
            ) : (
              eventForm
            )
          }
        />
      </PlatformShell>
    );
  }

  return (
    <PlatformShell role="branchadmin" title="Schedule">
      <WorkspaceLayout
        className="branch-schedule-page"
        title="Schedule"
        description="Review branch events and room or class timing."
        context={branch?.name ?? "Branch access"}
        actions={
          <Link
            className="platform-primary-button"
            href="/app/branch/schedule/new"
          >
            <Plus size={15} />
            Create event
          </Link>
        }
        toolbar={
          <div
            className="branch-compact-toolbar"
            data-testid="branch-schedule-toolbar"
          >
            <label>
              Search
              <span>
                <Search size={15} />
                <input
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="Event, class, or room"
                />
              </span>
            </label>
            <label>
              Type
              <select
                value={typeFilter}
                onChange={event =>
                  setTypeFilter(event.target.value as "all" | CalendarEventType)
                }
              >
                <option value="all">All event types</option>
                {branchEventTypes.map(type => (
                  <option key={type} value={type}>
                    {humanize(type)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        }
        main={<div className="branch-workspace-main">{scheduleList}</div>}
      />
    </PlatformShell>
  );
}
