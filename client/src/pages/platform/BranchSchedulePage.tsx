import { getStoredAuthSession, requireActiveUser } from "@/lib/auth/session";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Plus,
  Search,
  XCircle,
} from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import NccReadStatus from "@/components/platform/NccReadStatus";
import PlatformShell from "@/components/platform/PlatformShell";
import {
  FormFlowLayout,
  WorkspaceLayout,
} from "@/components/platform/PlatformLayouts";
import {
  DataTableCard,
  StatusBadge,
} from "@/components/platform/PlatformPrimitives";
import {
  confirmNccClassSessionsRequest,
  fetchNccClassesRequest,
  fetchNccClassSessionsRequest,
  fetchNccRoomsRequest,
  proposeNccClassSessionsRequest,
  runPlatformWorkflowActionRequest,
  type NccClassDto,
  type NccRoomDto,
  type NccSessionDto,
  type NccSessionSlotDto,
} from "@/lib/backend/api";
import {
  classifyNccFailure,
  type NccReadState,
} from "@/lib/backend/nccReadState";
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
  view?: "list" | "create" | "conflicts";
};

export default function BranchSchedulePage(props: BranchSchedulePageProps) {
  return getStoredAuthSession()?.provider === "ncc" ? (
    <NccBranchSchedulePage {...props} />
  ) : (
    <CompatibilityBranchSchedulePage {...props} />
  );
}

type NccBranchScheduleData = {
  classes: NccClassDto[];
  rooms: NccRoomDto[];
  sessions: NccSessionDto[];
};

function dateInputOffset(days: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const nccWeekdayLabels = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

function NccBranchSchedulePage({ view = "list" }: BranchSchedulePageProps) {
  const [readState, setReadState] = useState<
    NccReadState<NccBranchScheduleData>
  >({ status: "loading" });
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(() => ({
    classId: "",
    weekdays: [] as number[],
    hoursPerDay: 1,
    fromDate: dateInputOffset(1),
    toDate: dateInputOffset(14),
    startHour: 9,
  }));
  const [formInitialized, setFormInitialized] = useState(false);
  const [slots, setSlots] = useState<NccSessionSlotDto[] | null>(null);
  const [saving, setSaving] = useState<"propose" | "confirm" | null>(null);
  const [message, setMessage] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);
  const [composerOpen, setComposerOpen] = useState(
    () =>
      typeof window !== "undefined" &&
      window.location.hash === "#branch-schedule-composer"
  );

  const load = useCallback(async () => {
    setReadState({ status: "loading" });
    const [classesResult, roomsResult] = await Promise.all([
      fetchNccClassesRequest(),
      fetchNccRoomsRequest(),
    ]);
    for (const result of [classesResult, roomsResult]) {
      if (!result.ok || !result.data) {
        setReadState(classifyNccFailure(result));
        return;
      }
    }
    const classes = classesResult.data!.items;
    const sessionResults = await Promise.all(
      classes.map(item => fetchNccClassSessionsRequest(item.id))
    );
    for (const result of sessionResults) {
      if (!result.ok || !result.data) {
        setReadState(classifyNccFailure(result));
        return;
      }
    }
    setReadState({
      status: "ready",
      data: {
        classes,
        rooms: roomsResult.data!.items,
        sessions: sessionResults.flatMap(result => result.data!.items),
      },
    });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const data = readState.status === "ready" ? readState.data : null;
  const activeClasses = data
    ? data.classes.filter(item => item.status === "active")
    : [];
  const selectedClass =
    activeClasses.find(item => item.id === form.classId) ?? activeClasses[0];

  useEffect(() => {
    if (view !== "create" || formInitialized || !selectedClass) return;
    setForm(value => ({
      ...value,
      classId: selectedClass.id,
      weekdays: selectedClass.schedule.daysOfWeek?.length
        ? [...selectedClass.schedule.daysOfWeek]
        : value.weekdays,
    }));
    setFormInitialized(true);
  }, [view, formInitialized, selectedClass]);

  // The list view keeps the composer closed until asked for, then brings
  // the panel into view so the scheduling fields are not missed.
  useEffect(() => {
    if (view !== "list" || !composerOpen) return;
    document
      .getElementById("branch-schedule-composer")
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [view, composerOpen]);

  const context = data?.classes[0]?.branchName ?? "Branch";

  const propose = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedClass || !form.weekdays.length || saving) return;
    setSaving("propose");
    setMessage(null);
    setSlots(null);
    const result = await proposeNccClassSessionsRequest(selectedClass.id, {
      weekdays: form.weekdays,
      hoursPerDay: form.hoursPerDay,
      fromDate: form.fromDate,
      toDate: form.toDate,
      startHour: form.startHour,
    });
    setSaving(null);
    if (result.ok && result.data) {
      setSlots(result.data.slots);
      setMessage({
        kind: "success",
        text: `${result.data.slots.length} session slots proposed.`,
      });
    } else {
      const text = result.error ?? "Session proposal failed.";
      setMessage({ kind: "error", text });
      toast.error(text);
    }
  };

  const confirm = async () => {
    if (!selectedClass || !slots?.length || saving) return;
    setSaving("confirm");
    setMessage(null);
    const result = await confirmNccClassSessionsRequest(selectedClass.id, {
      slots,
    });
    setSaving(null);
    if (result.ok && result.data) {
      setMessage({
        kind: "success",
        text: `${result.data.createdCount} sessions created.`,
      });
      toast.success("Sessions created");
      setSlots(null);
      void load();
    } else {
      const text = result.error ?? "Sessions could not be created.";
      setMessage({ kind: "error", text });
      toast.error(text);
    }
  };

  // Shared by the standalone composer route and the inline composer
  // above the schedule list. Presentation only; all workflow logic lives
  // in the handlers above.
  const composerBody = (
    <>
    <form className="branch-room-form" onSubmit={propose}>
      <label>
        Class
        <select
          value={selectedClass?.id ?? ""}
          disabled={Boolean(saving) || !activeClasses.length}
          onChange={event =>
            setForm(value => ({
              ...value,
              classId: event.target.value,
            }))
          }
          data-testid="branch-schedule-class"
        >
          {activeClasses.length ? (
            activeClasses.map(item => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))
          ) : (
            <option value="">No active classes</option>
          )}
        </select>
      </label>
      <fieldset>
        <legend>Weekdays</legend>
        {nccWeekdayLabels.map((label, weekday) => (
          <label key={weekday}>
            <input
              type="checkbox"
              checked={form.weekdays.includes(weekday)}
              disabled={Boolean(saving)}
              onChange={event =>
                setForm(value => ({
                  ...value,
                  weekdays: event.target.checked
                    ? [...value.weekdays, weekday].sort(
                        (a, b) => a - b
                      )
                    : value.weekdays.filter(
                        item => item !== weekday
                      ),
                }))
              }
            />
            {label}
          </label>
        ))}
      </fieldset>
      <label>
        Hours per day
        <input
          type="number"
          min={1}
          step={1}
          value={form.hoursPerDay}
          disabled={Boolean(saving)}
          onChange={event =>
            setForm(value => ({
              ...value,
              hoursPerDay: Number(event.target.value),
            }))
          }
        />
      </label>
      <label>
        From
        <input
          type="date"
          value={form.fromDate}
          disabled={Boolean(saving)}
          onChange={event =>
            setForm(value => ({
              ...value,
              fromDate: event.target.value,
            }))
          }
        />
      </label>
      <label>
        To
        <input
          type="date"
          value={form.toDate}
          disabled={Boolean(saving)}
          onChange={event =>
            setForm(value => ({
              ...value,
              toDate: event.target.value,
            }))
          }
        />
      </label>
      <label>
        Start hour
        <input
          type="number"
          min={0}
          max={23}
          step={1}
          value={form.startHour}
          disabled={Boolean(saving)}
          onChange={event =>
            setForm(value => ({
              ...value,
              startHour: Number(event.target.value),
            }))
          }
        />
      </label>
      <button
        type="submit"
        className="platform-primary-button"
        disabled={
          Boolean(saving) ||
          !selectedClass ||
          !form.weekdays.length
        }
        data-testid="branch-schedule-propose"
      >
        <CalendarDays size={15} />
        {saving === "propose" ? "Proposing" : "Propose sessions"}
      </button>
    </form>
    {slots?.length ? (
      <div className="portal-simple-stack">
        <ul data-testid="branch-schedule-proposed-slots">
          {slots.map((slot, index) => (
            <li key={`${slot.startsAt}-${index}`}>
              {formatDateTime(slot.startsAt)} ·{" "}
              {slot.durationHours}h
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="platform-primary-button"
          disabled={Boolean(saving)}
          onClick={() => void confirm()}
          data-testid="branch-schedule-confirm"
        >
          <CheckCircle2 size={15} />
          {saving === "confirm"
            ? "Creating sessions"
            : "Create proposed sessions"}
        </button>
      </div>
    ) : null}
    {message ? (
      <p
        role={message.kind === "error" ? "alert" : "status"}
        className={
          message.kind === "error"
            ? "branch-schedule-message error"
            : "branch-schedule-message success"
        }
      >
        {message.text}
      </p>
    ) : null}
    </>
  );

  if (view === "create") {
    return (
      <PlatformShell role="branchadmin" title="Schedule sessions">
        <FormFlowLayout
          className="branch-schedule-page branch-schedule-create-page"
          title="Schedule sessions"
          description="Find available class times before creating sessions."
          context={context}
          actions={
            <Link
              className="platform-secondary-button"
              href="/app/branch/schedule"
            >
              View schedule
            </Link>
          }
          main={
            !data ? (
              <NccReadStatus state={readState} onRetry={() => void load()} />
            ) : (
              <section
                className="branch-inline-composer branch-schedule-composer"
                data-testid="branch-schedule-composer"
                id="branch-schedule-composer"
              >
                {composerBody}
              </section>
            )
          }
        />
      </PlatformShell>
    );
  }

  if (view === "conflicts") {
    return (
      <PlatformShell role="branchadmin" title="Schedule conflicts">
        <WorkspaceLayout
          className="branch-schedule-page branch-schedule-conflicts-page"
          title="Schedule conflicts"
          description="Review how EMS checks proposed session times."
          context={context}
          actions={
            <Link
              className="platform-secondary-button"
              href="/app/branch/schedule"
            >
              <CalendarDays size={15} />
              View schedule
            </Link>
          }
          main={
            <div className="platform-empty-state" role="status">
              <strong>
                Schedule conflicts are checked by EMS when sessions are
                proposed.
              </strong>
              <Link
                className="platform-secondary-button"
                href="/app/branch/schedule/new"
              >
                Schedule sessions
              </Link>
            </div>
          }
        />
      </PlatformShell>
    );
  }

  const filteredSessions = (data?.sessions ?? [])
    .slice()
    .sort(
      (a, b) =>
        new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
    )
    .filter(session => {
      const text = [
        session.className,
        session.teacherName,
        session.roomName,
        session.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return !query.trim() || text.includes(query.trim().toLowerCase());
    });

  return (
    <PlatformShell role="branchadmin" title="Schedule">
      <WorkspaceLayout
        className="branch-schedule-page"
        title="Schedule"
        description="Review scheduled class sessions."
        context={context}
        actions={
          <button
            type="button"
            className="platform-primary-button"
            onClick={() => setComposerOpen(value => !value)}
            aria-expanded={composerOpen}
            aria-controls="branch-schedule-composer"
          >
            <Plus size={15} />
            Schedule sessions
          </button>
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
                  placeholder="Class, teacher, or room"
                />
              </span>
            </label>
          </div>
        }
        main={
          !data ? (
            <NccReadStatus state={readState} onRetry={() => void load()} />
          ) : (
            <>
              {composerOpen ? (
                <section
                  className="branch-inline-composer branch-schedule-composer"
                  data-testid="branch-schedule-composer"
                  id="branch-schedule-composer"
                >
                  <div className="branch-inline-composer-head">
                    <div>
                      <span>Plan ahead</span>
                      <strong>Schedule sessions</strong>
                    </div>
                    <button
                      type="button"
                      className="branch-inline-close"
                      onClick={() => setComposerOpen(false)}
                    >
                      Close
                    </button>
                  </div>
                  {composerBody}
                </section>
              ) : null}
            <DataTableCard
              title="Class sessions"
              subtitle={`${filteredSessions.length} sessions`}
            >
              {filteredSessions.length ? (
                <div
                  className="teacher-class-record-list"
                  data-testid="branch-schedule-list"
                >
                  {filteredSessions.map(session => (
                    <article key={session.id}>
                      <div className="teacher-class-record-copy">
                        <span>{formatDateTime(session.startsAt)}</span>
                        <strong>{session.className}</strong>
                        <p>
                          Ends {formatDateTime(session.endsAt)} ·{" "}
                          {session.roomName ?? "No room"} ·{" "}
                          {session.teacherName ?? "Teacher not set"}
                        </p>
                      </div>
                      <div className="teacher-class-record-actions">
                        <StatusBadge
                          tone={
                            session.status === "scheduled" ? "green" : "slate"
                          }
                        >
                          {session.status}
                        </StatusBadge>
                        <Link
                          className="platform-secondary-button"
                          href={`/app/branch/schedule/sessions/${session.id}`}
                        >
                          Open session
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="platform-empty-state">
                  <strong>No class sessions scheduled.</strong>
                </div>
              )}
            </DataTableCard>
            </>
          )
        }
      />
    </PlatformShell>
  );
}

function CompatibilityBranchSchedulePage({
  view = "list",
}: BranchSchedulePageProps) {
  const [version, setVersion] = useState(0);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | CalendarEventType>(
    "all"
  );
  const [eventSaving, setEventSaving] = useState(false);
  const [eventResult, setEventResult] = useState<string | null>(null);
  const [conflictSavingId, setConflictSavingId] = useState<string | null>(null);
  const [conflictReasons, setConflictReasons] = useState<
    Record<string, string>
  >({});
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
  const branchConflicts = (state.scheduleConflicts ?? [])
    .filter(item => item.branchId === branch?.id)
    .slice()
    .sort(
      (first, second) =>
        Date.parse(second.detectedAt) - Date.parse(first.detectedAt)
    );
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

  const resolveConflict = async (
    conflictId: string,
    decision: "activate" | "cancel",
    expectedVersion: number
  ) => {
    const reason = conflictReasons[conflictId]?.trim() ?? "";
    if (reason.length < 10) {
      toast.error("Add at least 10 characters explaining the decision");
      return;
    }
    setConflictSavingId(conflictId);
    const response = await runPlatformWorkflowActionRequest({
      type: "calendar.conflict.resolve",
      conflictId,
      decision,
      reason,
      expectedVersion,
    });
    setConflictSavingId(null);
    if (!response.ok || !response.data) {
      toast.error("Conflict was not resolved", {
        description:
          response.error ??
          "The event still conflicts with another schedule record.",
      });
      return;
    }
    platformStore.setState(response.data.state);
    refresh();
    setConflictReasons(value => ({ ...value, [conflictId]: "" }));
    toast.success(
      decision === "activate" ? "Event activated" : "Event cancelled"
    );
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

  const conflictList = (
    <DataTableCard
      title="Conflict reviews"
      subtitle={`${branchConflicts.filter(item => item.status === "open").length} open`}
      className="branch-schedule-conflict-card"
    >
      <div
        className="branch-schedule-conflict-list"
        data-testid="branch-schedule-conflicts"
      >
        {branchConflicts.length ? (
          branchConflicts.map(conflict => {
            const event = state.events.find(
              item => item.id === conflict.eventId
            );
            const closed = conflict.status !== "open";
            return (
              <article key={conflict.id} data-conflict-id={conflict.id}>
                <div className="branch-schedule-conflict-copy">
                  <span>
                    {conflict.kinds.map(humanize).join(", ")} ·{" "}
                    {formatDateTime(event?.startsAt ?? conflict.detectedAt)}
                  </span>
                  <strong>{event?.title ?? "Unavailable event"}</strong>
                  <p>
                    {closed
                      ? conflict.resolutionReason
                      : "Resolve the underlying timing or availability issue before activation."}
                  </p>
                  <StatusBadge
                    tone={
                      conflict.status === "resolved"
                        ? "green"
                        : conflict.status === "cancelled"
                          ? "red"
                          : "amber"
                    }
                  >
                    {humanize(conflict.status)}
                  </StatusBadge>
                </div>
                {!closed ? (
                  <div className="branch-schedule-conflict-actions">
                    <label>
                      Resolution reason
                      <textarea
                        rows={2}
                        value={conflictReasons[conflict.id] ?? ""}
                        disabled={conflictSavingId === conflict.id}
                        onChange={event =>
                          setConflictReasons(value => ({
                            ...value,
                            [conflict.id]: event.target.value,
                          }))
                        }
                        placeholder="Describe what changed or why this event is cancelled."
                      />
                    </label>
                    <button
                      type="button"
                      className="platform-secondary-button"
                      disabled={conflictSavingId === conflict.id}
                      onClick={() =>
                        resolveConflict(conflict.id, "cancel", conflict.version)
                      }
                    >
                      <XCircle size={15} />
                      Cancel event
                    </button>
                    <button
                      type="button"
                      className="platform-primary-button"
                      disabled={conflictSavingId === conflict.id}
                      onClick={() =>
                        resolveConflict(
                          conflict.id,
                          "activate",
                          conflict.version
                        )
                      }
                    >
                      <CheckCircle2 size={15} />
                      Recheck and activate
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })
        ) : (
          <div className="platform-empty-state">
            <CheckCircle2 size={20} aria-hidden="true" />
            <strong>No schedule conflicts</strong>
            <span>Pending timing and availability reviews appear here.</span>
          </div>
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

  if (view === "conflicts") {
    return (
      <PlatformShell role="branchadmin" title="Schedule conflicts">
        <WorkspaceLayout
          className="branch-schedule-page branch-schedule-conflicts-page"
          title="Schedule conflicts"
          description="Resolve pending timing and teacher availability reviews."
          context={branch?.name ?? "Branch access"}
          actions={
            <Link
              className="platform-secondary-button"
              href="/app/branch/schedule"
            >
              <CalendarDays size={15} />
              View schedule
            </Link>
          }
          main={<div className="branch-workspace-main">{conflictList}</div>}
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
          <>
            <Link
              className="platform-secondary-button"
              href="/app/branch/schedule/conflicts"
            >
              <AlertTriangle size={15} />
              Conflicts
            </Link>
            <Link
              className="platform-primary-button"
              href="/app/branch/schedule/new"
            >
              <Plus size={15} />
              Create event
            </Link>
          </>
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
