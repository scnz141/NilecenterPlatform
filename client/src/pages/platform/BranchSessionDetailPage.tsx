import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { ArrowLeft, CalendarClock, CircleX } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import NccReadStatus from "@/components/platform/NccReadStatus";
import PlatformShell from "@/components/platform/PlatformShell";
import { DetailLayout } from "@/components/platform/PlatformLayouts";
import { StatusBadge } from "@/components/platform/PlatformPrimitives";
import {
  cancelNccSessionRequest,
  fetchNccRoomsRequest,
  fetchNccSessionRequest,
  patchNccSessionRequest,
  runPlatformWorkflowActionRequest,
  type NccRoomDto,
  type NccSessionDto,
} from "@/lib/backend/api";
import {
  classifyNccFailure,
  type NccReadState,
} from "@/lib/backend/nccReadState";
import { getStoredAuthSession } from "@/lib/auth/session";
import { platformStore } from "@/lib/domain/store";
import type { EntityStatus } from "@/lib/domain/types";

function statusTone(status: EntityStatus): "green" | "amber" | "red" | "slate" {
  if (status === "active" || status === "completed") return "green";
  if (status === "pending" || status === "draft") return "amber";
  if (status === "cancelled" || status === "paused") return "red";
  return "slate";
}

export default function BranchSessionDetailPage(props: {
  sessionId: string;
}) {
  return getStoredAuthSession()?.provider === "ncc" ? (
    <NccBranchSessionDetailPage {...props} />
  ) : (
    <CompatibilityBranchSessionDetailPage {...props} />
  );
}

function isoToLocalInput(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function localInputToIso(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function NccBranchSessionDetailPage({ sessionId }: { sessionId: string }) {
  const [readState, setReadState] = useState<
    NccReadState<{ session: NccSessionDto; rooms: NccRoomDto[] }>
  >({ status: "loading" });
  const [draft, setDraft] = useState({
    startsAt: "",
    endsAt: "",
    roomId: "",
  });
  const [draftReady, setDraftReady] = useState(false);
  const [saving, setSaving] = useState<"save" | "cancel" | null>(null);
  const [message, setMessage] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  const load = useCallback(async () => {
    setReadState({ status: "loading" });
    setDraftReady(false);
    const [sessionResult, roomsResult] = await Promise.all([
      fetchNccSessionRequest(sessionId),
      fetchNccRoomsRequest(),
    ]);
    for (const result of [sessionResult, roomsResult]) {
      if (!result.ok || !result.data) {
        setReadState(classifyNccFailure(result));
        return;
      }
    }
    setReadState({
      status: "ready",
      data: {
        session: sessionResult.data!.session,
        rooms: roomsResult.data!.items,
      },
    });
  }, [sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const session =
    readState.status === "ready" ? readState.data.session : null;
  const rooms = readState.status === "ready" ? readState.data.rooms : [];

  useEffect(() => {
    if (!session || draftReady) return;
    setDraft({
      startsAt: isoToLocalInput(session.startsAt),
      endsAt: isoToLocalInput(session.endsAt),
      roomId: session.roomId ?? "",
    });
    setDraftReady(true);
  }, [session, draftReady]);

  const cancelled = session?.status === "cancelled";
  const disabled = Boolean(saving) || cancelled || !session;

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!session || saving) return;
    const startsAt = localInputToIso(draft.startsAt);
    const endsAt = localInputToIso(draft.endsAt);
    if (!startsAt || !endsAt || endsAt <= startsAt) {
      const text = "Choose a valid start and end time.";
      setMessage({ kind: "error", text });
      toast.error(text);
      return;
    }
    setSaving("save");
    setMessage(null);
    const result = await patchNccSessionRequest(session.id, {
      startsAt,
      endsAt,
      roomId: draft.roomId || null,
    });
    setSaving(null);
    if (result.ok && result.data) {
      const updatedSession = result.data.session;
      setReadState(current =>
        current.status === "ready"
          ? {
              status: "ready",
              data: { ...current.data, session: updatedSession },
            }
          : current
      );
      setDraft({
        startsAt: isoToLocalInput(updatedSession.startsAt),
        endsAt: isoToLocalInput(updatedSession.endsAt),
        roomId: updatedSession.roomId ?? "",
      });
      setDraftReady(true);
      setMessage({ kind: "success", text: "Session updated." });
      toast.success("Session updated");
    } else {
      const text = result.error ?? "Session could not be updated.";
      setMessage({ kind: "error", text });
      toast.error(text);
    }
  };

  const cancel = async () => {
    if (!session || saving || cancelled) return;
    if (!window.confirm("Cancel this session?")) return;
    setSaving("cancel");
    setMessage(null);
    const result = await cancelNccSessionRequest(session.id);
    setSaving(null);
    if (result.ok && result.data) {
      setReadState(current =>
        current.status === "ready"
          ? {
              status: "ready",
              data: { ...current.data, session: result.data!.session },
            }
          : current
      );
      setMessage({ kind: "success", text: "Session cancelled." });
      toast.success("Session cancelled");
    } else {
      const text = result.error ?? "Session could not be cancelled.";
      setMessage({ kind: "error", text });
      toast.error(text);
    }
  };

  return (
    <PlatformShell role="branchadmin" title="Session">
      <DetailLayout
        className="branch-session-detail-page"
        title={session?.className ?? "Session"}
        description={
          session
            ? `${formatSessionTime(session.startsAt)} – ${formatSessionTime(session.endsAt)}`
            : "Class session"
        }
        context="Class session"
        actions={
          <Link
            className="platform-secondary-button"
            href="/app/branch/schedule"
          >
            <ArrowLeft size={15} />
            Schedule
          </Link>
        }
        main={
          !session ? (
            <NccReadStatus state={readState} onRetry={() => void load()} />
          ) : (
            <section
              className="branch-session-workflow"
              data-testid="branch-session-workflow"
            >
              <div className="branch-session-summary">
                <div>
                  <span>Status</span>
                  <StatusBadge
                    tone={session.status === "scheduled" ? "green" : "slate"}
                  >
                    {session.status}
                  </StatusBadge>
                </div>
                <div>
                  <span>Current time</span>
                  <strong>{new Date(session.startsAt).toLocaleString()}</strong>
                </div>
                <div>
                  <span>Teacher</span>
                  <strong>{session.teacherName ?? "Teacher not set"}</strong>
                </div>
                <div>
                  <span>Room</span>
                  <strong>{session.roomName ?? "No room"}</strong>
                </div>
              </div>

              <form onSubmit={save} className="branch-room-form">
                <label>
                  Starts (your local time)
                  <input
                    type="datetime-local"
                    value={draft.startsAt}
                    disabled={disabled}
                    onChange={change =>
                      setDraft(value => ({
                        ...value,
                        startsAt: change.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Ends (your local time)
                  <input
                    type="datetime-local"
                    value={draft.endsAt}
                    disabled={disabled}
                    onChange={change =>
                      setDraft(value => ({
                        ...value,
                        endsAt: change.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Room
                  <select
                    value={draft.roomId}
                    disabled={disabled}
                    onChange={change =>
                      setDraft(value => ({
                        ...value,
                        roomId: change.target.value,
                      }))
                    }
                  >
                    <option value="">No room</option>
                    {rooms.map(room => (
                      <option key={room.id} value={room.id}>
                        {room.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="branch-session-actions">
                  <button
                    type="submit"
                    data-testid="branch-session-reschedule"
                    disabled={disabled}
                  >
                    <CalendarClock size={15} />
                    {saving === "save" ? "Saving" : "Save session"}
                  </button>
                  {session.status === "scheduled" ? (
                    <button
                      type="button"
                      className="platform-danger-button"
                      data-testid="branch-session-cancel"
                      disabled={disabled}
                      onClick={() => void cancel()}
                    >
                      <CircleX size={15} />
                      {saving === "cancel" ? "Cancelling" : "Cancel session"}
                    </button>
                  ) : null}
                </div>
                {message ? (
                  <p role={message.kind === "error" ? "alert" : "status"}>
                    {message.text}
                  </p>
                ) : null}
              </form>
            </section>
          )
        }
      />
    </PlatformShell>
  );
}

function formatSessionTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function CompatibilityBranchSessionDetailPage({
  sessionId,
}: {
  sessionId: string;
}) {
  const [version, setVersion] = useState(0);
  const [saving, setSaving] = useState<"reschedule" | "cancel" | null>(null);
  const state = useMemo(() => platformStore.getState(), [version]);
  const session = state.classSessions.find(
    item => item.id === sessionId || item.eventId === sessionId
  );
  const event = state.events.find(item => item.id === session?.eventId);
  const classGroup = state.classGroups.find(
    item => item.id === session?.classGroupId
  );
  const courseRun = state.courseRuns.find(
    item => item.id === classGroup?.courseRunId
  );
  const branch = state.branches.find(item => item.id === courseRun?.branchId);
  const rooms = state.rooms.filter(
    item => item.branchId === branch?.id && item.status === "active"
  );
  const attendanceExists = Boolean(
    session &&
      (session.attendanceSaved ||
        state.attendance.some(
          item =>
            item.sessionId === session.id || item.sessionId === session.eventId
        ))
  );
  const [draft, setDraft] = useState(() => ({
    date: session?.startsAt.slice(0, 10) ?? "",
    starts: session?.startsAt.slice(11, 16) ?? "",
    ends: session?.endsAt.slice(11, 16) ?? "",
    roomId: event?.roomId ?? "",
    reason: "",
  }));

  if (!session || !event || !classGroup || !courseRun || !branch) {
    return (
      <PlatformShell role="branchadmin" title="Session">
        <DetailLayout
          title="Session not found"
          description="This session is unavailable in your branch scope."
          actions={<Link href="/app/branch/schedule">Back to schedule</Link>}
          main={<p>No class-session record is available.</p>}
        />
      </PlatformShell>
    );
  }

  const refresh = () => setVersion(value => value + 1);

  const reschedule = async (formEvent: FormEvent) => {
    formEvent.preventDefault();
    if (
      !draft.date ||
      !draft.starts ||
      !draft.ends ||
      draft.starts >= draft.ends
    ) {
      toast.error("Choose a valid session time");
      return;
    }
    if (draft.reason.trim().length < 5) {
      toast.error("Add a short reason for the timetable change");
      return;
    }
    setSaving("reschedule");
    const result = await runPlatformWorkflowActionRequest({
      type: "class.session.reschedule",
      sessionId: session.id,
      startsAt: `${draft.date}T${draft.starts}:00+03:00`,
      endsAt: `${draft.date}T${draft.ends}:00+03:00`,
      roomId: draft.roomId || undefined,
      reason: draft.reason.trim(),
    });
    setSaving(null);
    if (!result.ok || !result.data) {
      toast.error("Session was not rescheduled", { description: result.error });
      return;
    }
    platformStore.setState(result.data.state);
    refresh();
    setDraft(value => ({ ...value, reason: "" }));
    toast.success("Session rescheduled", {
      description: "The teacher and enrolled learners can see the new time.",
    });
  };

  const cancel = async () => {
    if (draft.reason.trim().length < 5) {
      toast.error("Add a short cancellation reason");
      return;
    }
    setSaving("cancel");
    const result = await runPlatformWorkflowActionRequest({
      type: "class.session.cancel",
      sessionId: session.id,
      reason: draft.reason.trim(),
    });
    setSaving(null);
    if (!result.ok || !result.data) {
      toast.error("Session was not cancelled", { description: result.error });
      return;
    }
    platformStore.setState(result.data.state);
    refresh();
    toast.success("Session cancelled", {
      description:
        "The schedule history was retained and learners were notified.",
    });
  };

  const mutable = new Set<EntityStatus>(["active", "pending"]).has(
    session.status
  );
  const disabled = Boolean(saving) || attendanceExists || !mutable;

  return (
    <PlatformShell role="branchadmin" title="Session">
      <DetailLayout
        className="branch-session-detail-page"
        title={session.title}
        description={`${classGroup.name} · ${branch.name}`}
        context="Class session"
        actions={
          <Link
            className="platform-secondary-button"
            href="/app/branch/schedule"
          >
            <ArrowLeft size={15} />
            Schedule
          </Link>
        }
        main={
          <section
            className="branch-session-workflow"
            data-testid="branch-session-workflow"
          >
            <div className="branch-session-summary">
              <div>
                <span>Status</span>
                <StatusBadge tone={statusTone(session.status)}>
                  {session.status}
                </StatusBadge>
              </div>
              <div>
                <span>Current time</span>
                <strong>{new Date(session.startsAt).toLocaleString()}</strong>
              </div>
              <div>
                <span>Room</span>
                <strong>
                  {state.rooms.find(item => item.id === event.roomId)?.name ??
                    "Online"}
                </strong>
              </div>
            </div>

            {attendanceExists ? (
              <p className="branch-session-lock" role="status">
                Attendance exists for this session. Its time and status are
                locked to preserve academic history; create a replacement
                session instead.
              </p>
            ) : null}

            <form onSubmit={reschedule} className="branch-room-form">
              <label>
                Date
                <input
                  type="date"
                  value={draft.date}
                  disabled={disabled}
                  onChange={change =>
                    setDraft(value => ({ ...value, date: change.target.value }))
                  }
                />
              </label>
              <label>
                Starts
                <input
                  type="time"
                  value={draft.starts}
                  disabled={disabled}
                  onChange={change =>
                    setDraft(value => ({
                      ...value,
                      starts: change.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Ends
                <input
                  type="time"
                  value={draft.ends}
                  disabled={disabled}
                  onChange={change =>
                    setDraft(value => ({ ...value, ends: change.target.value }))
                  }
                />
              </label>
              <label>
                Room
                <select
                  value={draft.roomId}
                  disabled={disabled}
                  onChange={change =>
                    setDraft(value => ({
                      ...value,
                      roomId: change.target.value,
                    }))
                  }
                >
                  <option value="">Online / no room</option>
                  {rooms.map(room => (
                    <option key={room.id} value={room.id}>
                      {room.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="branch-session-reason">
                Reason
                <textarea
                  value={draft.reason}
                  disabled={disabled}
                  onChange={change =>
                    setDraft(value => ({
                      ...value,
                      reason: change.target.value,
                    }))
                  }
                  placeholder="Why is this session changing?"
                />
              </label>
              <div className="branch-session-actions">
                <button
                  type="submit"
                  data-testid="branch-session-reschedule"
                  disabled={disabled}
                >
                  <CalendarClock size={15} />
                  {saving === "reschedule" ? "Rescheduling" : "Reschedule"}
                </button>
                <button
                  type="button"
                  className="platform-danger-button"
                  data-testid="branch-session-cancel"
                  disabled={disabled}
                  onClick={cancel}
                >
                  <CircleX size={15} />
                  {saving === "cancel" ? "Cancelling" : "Cancel session"}
                </button>
              </div>
            </form>
          </section>
        }
      />
    </PlatformShell>
  );
}
