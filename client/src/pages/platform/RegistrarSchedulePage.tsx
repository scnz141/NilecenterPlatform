import { useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import PlatformShell from "@/components/platform/PlatformShell";
import { WorkspaceLayout } from "@/components/platform/PlatformLayouts";
import { StatusBadge } from "@/components/platform/PlatformPrimitives";
import { runPlatformWorkflowActionRequest } from "@/lib/backend/api";
import { platformStore } from "@/lib/domain/store";
import type { CalendarEventType, EntityStatus } from "@/lib/domain/types";
import { getDemoUser } from "@/lib/platformData";

const registrarEventTypes: CalendarEventType[] = [
  "placement_test",
  "trial_lesson",
  "room_booking",
  "reminder",
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

export default function RegistrarSchedulePage() {
  const [version, setVersion] = useState(0);
  const [eventDraft, setEventDraft] = useState({
    title: "Placement test",
    type: "placement_test" as CalendarEventType,
    date: "2026-07-08",
    starts: "13:00",
    ends: "13:30",
    roomId: "",
  });
  const [eventSaving, setEventSaving] = useState(false);

  const state = useMemo(() => platformStore.getState(), [version]);
  const actorId = getDemoUser("registrar").id;
  const actor = state.users.find(user => user.id === actorId);
  const staffProfile = state.staffProfiles.find(
    profile => profile.userId === actorId && profile.role === "registrar"
  );
  const branchIds = new Set([
    ...(staffProfile?.branchIds ?? []),
    ...(actor?.branchId ? [actor.branchId] : []),
  ]);
  const branch =
    state.branches.find(item => item.id === actor?.branchId) ??
    state.branches.find(item => branchIds.has(item.id)) ??
    state.branches[0];
  const branchRooms = state.rooms.filter(room => room.branchId === branch?.id);
  const admissionsEvents = state.events
    .filter(
      event =>
        event.branchId === branch?.id &&
        ["placement_test", "trial_lesson", "room_booking", "reminder"].includes(
          event.type
        )
    )
    .slice()
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  const pendingEvents = admissionsEvents.filter(
    event => event.status === "pending"
  );
  const activityRows = state.auditLogs
    .filter(
      audit =>
        (audit.action === "calendar.created" ||
          audit.action === "calendar.created_with_conflict") &&
        admissionsEvents.some(event => event.id === audit.entityId)
    )
    .slice(0, 4);

  const createEvent = async (event: React.FormEvent) => {
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
      return;
    }

    const needsRoom = eventDraft.type === "room_booking";
    const selectedRoom = branchRooms.find(room => room.id === eventDraft.roomId);
    if (needsRoom && !selectedRoom) {
      toast.error("Choose a branch room before creating a room booking");
      return;
    }

    setEventSaving(true);
    try {
      const response = await runPlatformWorkflowActionRequest({
        type: "calendar.create",
        eventType: eventDraft.type,
        title: eventDraft.title.trim(),
        startsAt: `${eventDraft.date}T${eventDraft.starts}:00+03:00`,
        endsAt: `${eventDraft.date}T${eventDraft.ends}:00+03:00`,
        branchId: branch.id,
        roomId: selectedRoom?.id,
        actorId,
      });

      if (!response.data) {
        throw new Error(response.error ?? "Schedule action returned no state.");
      }

      platformStore.setState(response.data.state);
      setVersion(value => value + 1);
      toast.success("Event scheduled", {
        description: response.data.persistence,
      });
    } catch (error) {
      toast.error("Event could not be scheduled", {
        description:
          error instanceof Error
            ? error.message
            : "Check the event details and try again.",
      });
    } finally {
      setEventSaving(false);
    }
  };

  return (
    <PlatformShell role="registrar" title="Registrar schedule">
      <WorkspaceLayout
        title="Schedule"
        description="Book placement, trial, and admissions events."
        context="Registrar"
        main={
          <section className="registrar-panel">
            <div className="registrar-panel-head">
              <div>
                <span>Admissions calendar</span>
                <strong>{admissionsEvents.length} events</strong>
              </div>
              <CalendarDays size={18} />
            </div>

            <form className="branch-room-form stacked" onSubmit={createEvent}>
              <label>
                Title
                <input
                  value={eventDraft.title}
                  disabled={eventSaving}
                  onChange={event =>
                    setEventDraft(value => ({
                      ...value,
                      title: event.target.value,
                    }))
                  }
                  placeholder="Placement test"
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
                  {registrarEventTypes.map(type => (
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
                    setEventDraft(value => ({
                      ...value,
                      date: event.target.value,
                    }))
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
                    setEventDraft(value => ({
                      ...value,
                      starts: event.target.value,
                    }))
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
                    setEventDraft(value => ({
                      ...value,
                      ends: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Room
                <select
                  value={eventDraft.roomId}
                  disabled={eventSaving || !branchRooms.length}
                  onChange={event =>
                    setEventDraft(value => ({
                      ...value,
                      roomId: event.target.value,
                    }))
                  }
                >
                  <option value="">No room needed</option>
                  {branchRooms.map(room => (
                    <option key={room.id} value={room.id}>
                      {room.name}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" disabled={eventSaving}>
                <Plus size={15} />
                {eventSaving ? "Saving event" : "Create event"}
              </button>
            </form>

            <div className="registrar-operations-list">
              {admissionsEvents.length ? (
                admissionsEvents.map(event => {
                  const room = state.rooms.find(item => item.id === event.roomId);
                  return (
                    <article key={event.id}>
                      <div>
                        <strong>{event.title}</strong>
                        <small>
                          {humanize(event.type)} · {formatDateTime(event.startsAt)}
                          {room ? ` · ${room.name}` : ""}
                        </small>
                      </div>
                      <StatusBadge tone={statusTone(event.status)}>
                        {humanize(event.status)}
                      </StatusBadge>
                    </article>
                  );
                })
              ) : (
                <article className="registrar-empty-row">
                  <div>
                    <strong>No admissions events</strong>
                    <small>
                      Create a placement test or trial lesson to start the
                      calendar.
                    </small>
                  </div>
                </article>
              )}
            </div>
          </section>
        }
        side={
          <section className="registrar-panel">
            <div className="registrar-panel-head">
              <div>
                <span>Branch</span>
                <strong>{branch?.name ?? "No branch"}</strong>
              </div>
              <ShieldCheck size={18} />
            </div>
            <div className="registrar-operations-list">
              <article>
                <div>
                  <strong>Placement test</strong>
                  <small>Book student level checks for admissions.</small>
                </div>
                <span>{eventDraft.type === "placement_test" ? "selected" : "ready"}</span>
              </article>
              <article>
                <div>
                  <strong>Trial lesson</strong>
                  <small>Schedule a short introductory class.</small>
                </div>
                <span>ready</span>
              </article>
              <article>
                <div>
                  <strong>Pending review</strong>
                  <small>Events waiting after conflict detection.</small>
                </div>
                <span>{pendingEvents.length}</span>
              </article>
            </div>
            {activityRows.length ? (
              <div className="registrar-operations-list">
                {activityRows.map(audit => (
                  <article key={audit.id}>
                    <CheckCircle2 size={15} />
                    <div>
                      <strong>{humanize(audit.action)}</strong>
                      <small>{audit.summary}</small>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
          </section>
        }
      />
    </PlatformShell>
  );
}
