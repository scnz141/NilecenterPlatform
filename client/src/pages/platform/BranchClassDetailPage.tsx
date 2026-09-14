import { getStoredAuthSession, requireActiveUser } from "@/lib/auth/session";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";
import { Link, useParams } from "wouter";
import PlatformShell from "@/components/platform/PlatformShell";
import NccReadStatus from "@/components/platform/NccReadStatus";
import { DetailLayout } from "@/components/platform/PlatformLayouts";
import { StatusBadge } from "@/components/platform/PlatformPrimitives";
import {
  bindNccClassMoodleRequest,
  disableNccClassRequest,
  enableNccClassRequest,
  fetchNccClassRequest,
  fetchNccDirectoryUsersRequest,
  fetchNccMoodleGroupsRequest,
  fetchNccRoomsRequest,
  patchNccClassRequest,
  runPlatformWorkflowActionRequest,
  syncNccClassMoodleRequest,
  type NccClassDto,
  type NccMoodleGroupDto,
  type NccRoomDto,
  type NccStaffUserDto,
} from "@/lib/backend/api";
import {
  classifyNccFailure,
  type NccReadState,
} from "@/lib/backend/nccReadState";
import { platformStore } from "@/lib/domain/store";
import type { ClassGroup } from "@/lib/domain/types";

export default function BranchClassDetailPage() {
  if (getStoredAuthSession()?.provider === "ncc") {
    return <NccBranchClassDetailPage />;
  }
  return <CompatibilityBranchClassDetailPage />;
}

function CompatibilityBranchClassDetailPage() {
  const params = useParams<{ classGroupId: string }>();
  const [version, setVersion] = useState(0);
  const state = useMemo(() => platformStore.getState(), [version]);
  const actorId = requireActiveUser("branchadmin").id;
  const group = state.classGroups.find(item => item.id === params.classGroupId);
  const run = state.courseRuns.find(item => item.id === group?.courseRunId);
  const course = state.courses.find(item => item.id === run?.courseId);
  const branch = state.branches.find(item => item.id === run?.branchId);
  const rooms = state.rooms.filter(item => item.branchId === run?.branchId && item.status === "active");
  const [draft, setDraft] = useState(() => ({
    name: group?.name ?? "",
    capacity: String(group?.capacity ?? 1),
    schedule: group?.schedule ?? "",
    roomId: group?.roomId ?? "",
  }));
  const [saving, setSaving] = useState(false);

  if (!group || !run) {
    return <PlatformShell role="branchadmin" title="Class"><DetailLayout title="Class not found" description="This class is outside your branch scope or no longer exists." context="Branch" main={<Link href="/app/branch/classes">Back to classes</Link>} /></PlatformShell>;
  }

  const applyResponse = (response: Awaited<ReturnType<typeof runPlatformWorkflowActionRequest>>) => {
    if (!response.ok || !response.data) {
      toast.error("Class update failed", { description: response.error ?? "The server rejected this change." });
      return false;
    }
    platformStore.setState(response.data.state);
    setVersion(value => value + 1);
    toast.success("Class updated");
    return true;
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const response = await runPlatformWorkflowActionRequest({ type: "class.update", classGroupId: group.id, name: draft.name.trim(), capacity: Number(draft.capacity), schedule: draft.schedule.trim(), roomId: draft.roomId, actorId });
    setSaving(false);
    applyResponse(response);
  };

  const changeStatus = async (status: ClassGroup["status"]) => {
    setSaving(true);
    const response = await runPlatformWorkflowActionRequest({ type: "class.status.update", classGroupId: group.id, status, actorId });
    setSaving(false);
    applyResponse(response);
  };

  return (
    <PlatformShell role="branchadmin" title={group.name}>
      <DetailLayout
        className="branch-class-detail-page"
        title={group.name}
        description={`${course?.title ?? "Course"} · ${branch?.name ?? "Branch"}`}
        context="Class delivery"
        actions={<Link className="platform-secondary-button" href="/app/branch/classes"><ArrowLeft size={15} />Back to classes</Link>}
        main={<section className="branch-inline-composer" data-testid="branch-class-detail">
          <form className="branch-room-form" onSubmit={save}>
            <label>Class name<input required value={draft.name} disabled={saving} onChange={event => setDraft(value => ({ ...value, name: event.target.value }))} /></label>
            <label>Capacity<input required type="number" min={group.studentIds.length} max={200} value={draft.capacity} disabled={saving} onChange={event => setDraft(value => ({ ...value, capacity: event.target.value }))} /></label>
            <label>Schedule<input required value={draft.schedule} disabled={saving} onChange={event => setDraft(value => ({ ...value, schedule: event.target.value }))} /></label>
            <label>Room<select required value={draft.roomId} disabled={saving} onChange={event => setDraft(value => ({ ...value, roomId: event.target.value }))}>{rooms.map(room => <option key={room.id} value={room.id}>{room.name} · {room.capacity} seats</option>)}</select></label>
            <button type="submit" disabled={saving}><Save size={15} />{saving ? "Saving" : "Save class"}</button>
          </form>
          <div className="platform-page-actions" aria-label="Class status actions">
            {group.status === "active" ? <button className="platform-secondary-button" disabled={saving} onClick={() => changeStatus("paused")}>Pause class</button> : null}
            {group.status === "paused" ? <button className="platform-primary-button" disabled={saving} onClick={() => changeStatus("active")}>Resume class</button> : null}
            <span role="status">Status: {group.status}</span>
          </div>
        </section>}
      />
    </PlatformShell>
  );
}

const nccClassDayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toLocalDateTimeInput(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function NccBranchClassDetailPage() {
  const params = useParams<{ classGroupId: string }>();
  const classId = params.classGroupId ?? "";
  const [record, setRecord] = useState<NccReadState<NccClassDto>>({
    status: "loading",
  });
  const [rooms, setRooms] = useState<NccReadState<NccRoomDto[]>>({
    status: "loading",
  });
  const [teachers, setTeachers] = useState<NccReadState<NccStaffUserDto[]>>({
    status: "loading",
  });
  const [draft, setDraft] = useState({
    name: "",
    capacity: "1",
    startAt: "",
    endAt: "",
    roomId: "",
    sortOrder: "0",
  });
  const [teacherIds, setTeacherIds] = useState<string[]>([]);
  const [scheduleDays, setScheduleDays] = useState<number[]>([]);
  const [scheduleTimes, setScheduleTimes] = useState({
    startTime: "",
    endTime: "",
  });
  const [linkOpen, setLinkOpen] = useState(false);
  const [groupQuery, setGroupQuery] = useState("");
  const [groups, setGroups] = useState<
    NccReadState<NccMoodleGroupDto[]> | null
  >(null);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const applyRecord = useCallback((item: NccClassDto) => {
    setRecord({ status: "ready", data: item });
    setDraft({
      name: item.name,
      capacity: String(item.capacity),
      startAt: toLocalDateTimeInput(item.startAt),
      endAt: toLocalDateTimeInput(item.endAt),
      roomId: item.defaultRoomId ?? "",
      sortOrder: String(item.sortOrder),
    });
    setTeacherIds(item.teacherIds);
    setScheduleDays(item.schedule.daysOfWeek ?? []);
    setScheduleTimes({
      startTime: item.schedule.startTime ?? "",
      endTime: item.schedule.endTime ?? "",
    });
  }, []);

  const load = useCallback(async () => {
    setRecord({ status: "loading" });
    setRooms({ status: "loading" });
    setTeachers({ status: "loading" });
    const [classResult, roomsResult, usersResult] = await Promise.all([
      fetchNccClassRequest(classId),
      fetchNccRoomsRequest(),
      fetchNccDirectoryUsersRequest(),
    ]);
    setRooms(
      roomsResult.ok && roomsResult.data
        ? {
            status: "ready",
            data: roomsResult.data.items.filter(
              room => room.status === "active"
            ),
          }
        : classifyNccFailure(roomsResult)
    );
    setTeachers(
      usersResult.ok && usersResult.data
        ? {
            status: "ready",
            data: usersResult.data.items.filter(
              user => user.role === "teacher" && user.isActive
            ),
          }
        : classifyNccFailure(usersResult)
    );
    if (!classResult.ok || !classResult.data) {
      setRecord(classifyNccFailure(classResult));
      return;
    }
    applyRecord(classResult.data.class);
  }, [classId, applyRecord]);

  useEffect(() => {
    void load();
  }, [load]);

  const scheduleStarted =
    scheduleDays.length > 0 || !!scheduleTimes.startTime || !!scheduleTimes.endTime;
  const scheduleComplete =
    scheduleDays.length > 0 &&
    !!scheduleTimes.startTime &&
    !!scheduleTimes.endTime;

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (saving || record.status !== "ready") return;
    const current = record.data;
    if (scheduleStarted && !scheduleComplete) {
      setError(
        "Complete the schedule with at least one day and start/end times, or clear it."
      );
      return;
    }
    const startAt = new Date(draft.startAt);
    const endAt = new Date(draft.endAt);
    if (
      !draft.startAt ||
      !draft.endAt ||
      Number.isNaN(startAt.getTime()) ||
      Number.isNaN(endAt.getTime()) ||
      endAt <= startAt
    ) {
      setError("Enter a valid start and end date; the end must be after the start.");
      return;
    }
    const input: Parameters<typeof patchNccClassRequest>[1] = {};
    if (draft.name.trim() !== current.name) input.name = draft.name.trim();
    const capacity = Number(draft.capacity);
    if (capacity !== current.capacity) input.capacity = capacity;
    if (startAt.toISOString() !== current.startAt)
      input.startAt = startAt.toISOString();
    if (endAt.toISOString() !== current.endAt)
      input.endAt = endAt.toISOString();
    const sortOrder = Number(draft.sortOrder);
    if (Number.isSafeInteger(sortOrder) && sortOrder !== current.sortOrder)
      input.sortOrder = sortOrder;
    const nextRoom = draft.roomId || null;
    if (nextRoom !== current.defaultRoomId) input.defaultRoomId = nextRoom;
    if (
      teacherIds.length !== current.teacherIds.length ||
      teacherIds.some(id => !current.teacherIds.includes(id))
    ) {
      input.teacherIds = teacherIds;
    }
    const nextSchedule = scheduleComplete
      ? {
          daysOfWeek: scheduleDays,
          startTime: scheduleTimes.startTime,
          endTime: scheduleTimes.endTime,
        }
      : null;
    const currentSchedule =
      current.schedule.daysOfWeek &&
      current.schedule.startTime &&
      current.schedule.endTime
        ? {
            daysOfWeek: current.schedule.daysOfWeek,
            startTime: current.schedule.startTime,
            endTime: current.schedule.endTime,
          }
        : null;
    if (
      JSON.stringify(nextSchedule) !== JSON.stringify(currentSchedule)
    ) {
      input.schedule = nextSchedule;
    }
    setSaving(true);
    setError("");
    const response = await patchNccClassRequest(current.id, input);
    setSaving(false);
    if (!response.ok || !response.data) {
      setError(response.error ?? "The server rejected this change.");
      return;
    }
    applyRecord(response.data.class);
  };

  const toggleStatus = async () => {
    if (saving || record.status !== "ready") return;
    setSaving(true);
    setError("");
    const response =
      record.data.status === "active"
        ? await disableNccClassRequest(record.data.id)
        : await enableNccClassRequest(record.data.id);
    setSaving(false);
    if (!response.ok || !response.data) {
      setError(response.error ?? "The server rejected this change.");
      return;
    }
    applyRecord(response.data.class);
  };

  const searchGroups = async () => {
    if (record.status !== "ready" || groupQuery.trim().length < 2) return;
    setGroups({ status: "loading" });
    const response = await fetchNccMoodleGroupsRequest(
      record.data.courseId,
      groupQuery.trim()
    );
    setGroups(
      response.ok && response.data
        ? { status: "ready", data: response.data.items }
        : classifyNccFailure(response)
    );
  };

  const moodleAction = async (
    input:
      | { mode: "create" }
      | { mode: "link"; moodleGroupId: number }
      | { mode: "sync" }
  ) => {
    if (saving || record.status !== "ready") return;
    setSaving(true);
    setError("");
    const response =
      input.mode === "sync"
        ? await syncNccClassMoodleRequest(record.data.id)
        : await bindNccClassMoodleRequest(record.data.id, input);
    setSaving(false);
    if (!response.ok || !response.data) {
      setError(response.error ?? "The Moodle operation failed.");
      return;
    }
    setLinkOpen(false);
    setSelectedGroupId(null);
    setGroups(null);
    applyRecord(response.data.class);
  };

  const bound = record.status === "ready" && record.data.moodleGroupId !== null;

  return (
    <PlatformShell
      role="branchadmin"
      title={record.status === "ready" ? record.data.name : "Class"}
    >
      <DetailLayout
        className="branch-class-detail-page"
        title={record.status === "ready" ? record.data.name : "Class"}
        description={
          record.status === "ready"
            ? `${record.data.courseName} · ${record.data.branchName}`
            : "EMS class record"
        }
        context="Class delivery"
        actions={
          <Link className="platform-secondary-button" href="/app/branch/classes">
            <ArrowLeft size={15} />
            Back to classes
          </Link>
        }
        main={
          <section
            className="branch-inline-composer"
            data-testid="branch-class-detail"
          >
            {record.status !== "ready" ? (
              <NccReadStatus state={record} onRetry={() => void load()} />
            ) : (
              <>
                <form className="branch-room-form" onSubmit={save}>
                  <label>
                    Class name
                    <input
                      required
                      value={draft.name}
                      disabled={saving}
                      onChange={event =>
                        setDraft(value => ({
                          ...value,
                          name: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Capacity
                    <input
                      required
                      type="number"
                      min={1}
                      max={500}
                      value={draft.capacity}
                      disabled={saving}
                      onChange={event =>
                        setDraft(value => ({
                          ...value,
                          capacity: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Starts
                    <input
                      required
                      type="datetime-local"
                      value={draft.startAt}
                      disabled={saving}
                      onChange={event =>
                        setDraft(value => ({
                          ...value,
                          startAt: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Ends
                    <input
                      required
                      type="datetime-local"
                      value={draft.endAt}
                      disabled={saving}
                      onChange={event =>
                        setDraft(value => ({
                          ...value,
                          endAt: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Sort order
                    <input
                      type="number"
                      value={draft.sortOrder}
                      disabled={saving}
                      onChange={event =>
                        setDraft(value => ({
                          ...value,
                          sortOrder: event.target.value,
                        }))
                      }
                    />
                  </label>
                  {rooms.status === "ready" ? (
                    <label>
                      Default room
                      <select
                        value={draft.roomId}
                        disabled={saving}
                        onChange={event =>
                          setDraft(value => ({
                            ...value,
                            roomId: event.target.value,
                          }))
                        }
                      >
                        <option value="">No room</option>
                        {rooms.data.map(room => (
                          <option key={room.id} value={room.id}>
                            {room.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  {teachers.status === "ready" && teachers.data.length ? (
                    <fieldset>
                      <legend>Teachers</legend>
                      {teachers.data.map(teacher => (
                        <label key={teacher.id}>
                          <input
                            type="checkbox"
                            checked={teacherIds.includes(teacher.id)}
                            disabled={saving}
                            onChange={event =>
                              setTeacherIds(value =>
                                event.target.checked
                                  ? [...value, teacher.id]
                                  : value.filter(id => id !== teacher.id)
                              )
                            }
                          />
                          {teacher.name}
                        </label>
                      ))}
                    </fieldset>
                  ) : null}
                  <fieldset>
                    <legend>Schedule</legend>
                    {nccClassDayLabels.map((label, day) => (
                      <label key={label}>
                        <input
                          type="checkbox"
                          checked={scheduleDays.includes(day)}
                          disabled={saving}
                          onChange={event =>
                            setScheduleDays(value =>
                              event.target.checked
                                ? [...value, day].sort((a, b) => a - b)
                                : value.filter(item => item !== day)
                            )
                          }
                        />
                        {label}
                      </label>
                    ))}
                    <label>
                      Start time
                      <input
                        type="time"
                        value={scheduleTimes.startTime}
                        disabled={saving}
                        onChange={event =>
                          setScheduleTimes(value => ({
                            ...value,
                            startTime: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label>
                      End time
                      <input
                        type="time"
                        value={scheduleTimes.endTime}
                        disabled={saving}
                        onChange={event =>
                          setScheduleTimes(value => ({
                            ...value,
                            endTime: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </fieldset>
                  <button type="submit" disabled={saving}>
                    <Save size={15} />
                    {saving ? "Saving" : "Save class"}
                  </button>
                </form>
                <div className="platform-page-actions" aria-label="Class actions">
                  <StatusBadge
                    tone={record.data.status === "active" ? "green" : "slate"}
                  >
                    {record.data.status}
                  </StatusBadge>
                  <button
                    className="platform-secondary-button"
                    disabled={saving}
                    onClick={() => void toggleStatus()}
                  >
                    {record.data.status === "active" ? "Disable" : "Enable"}
                  </button>
                  <span role="status">
                    Moodle group:{" "}
                    {bound ? `#${record.data.moodleGroupId}` : "not linked"}
                  </span>
                  {!bound ? (
                    <>
                      <button
                        className="platform-secondary-button"
                        disabled={saving}
                        onClick={() => void moodleAction({ mode: "create" })}
                      >
                        Create Moodle group
                      </button>
                      <button
                        className="platform-secondary-button"
                        disabled={saving}
                        onClick={() => setLinkOpen(value => !value)}
                      >
                        Link existing group
                      </button>
                    </>
                  ) : (
                    <button
                      className="platform-secondary-button"
                      disabled={saving}
                      onClick={() => void moodleAction({ mode: "sync" })}
                    >
                      Sync Moodle group
                    </button>
                  )}
                </div>
                {linkOpen && !bound ? (
                  <div className="admin-user-detail-form">
                    <label>
                      Search Moodle groups
                      <input
                        value={groupQuery}
                        disabled={saving}
                        placeholder="At least 2 characters"
                        onChange={event => setGroupQuery(event.target.value)}
                      />
                    </label>
                    <button
                      type="button"
                      className="platform-secondary-button"
                      disabled={saving || groupQuery.trim().length < 2}
                      onClick={() => void searchGroups()}
                    >
                      Search
                    </button>
                    {groups === null ? null : groups.status === "loading" ? (
                      <p role="status">Searching groups...</p>
                    ) : groups.status === "ready" ? (
                      groups.data.length ? (
                        <fieldset>
                          <legend>Moodle group</legend>
                          {groups.data.map(group => (
                            <label key={group.id}>
                              <input
                                type="radio"
                                name="moodle-group"
                                checked={selectedGroupId === group.id}
                                onChange={() => setSelectedGroupId(group.id)}
                              />
                              {group.name}
                              {group.idNumber ? ` · ${group.idNumber}` : ""}
                            </label>
                          ))}
                        </fieldset>
                      ) : (
                        <p role="status">No Moodle groups matched.</p>
                      )
                    ) : (
                      <NccReadStatus
                        state={groups}
                        onRetry={() => void searchGroups()}
                      />
                    )}
                    <button
                      type="button"
                      className="platform-primary-button"
                      disabled={saving || selectedGroupId === null}
                      onClick={() =>
                        void moodleAction({
                          mode: "link",
                          moodleGroupId: selectedGroupId ?? 0,
                        })
                      }
                    >
                      Link selected group
                    </button>
                  </div>
                ) : null}
                {error ? (
                  <p className="platform-form-error" role="alert">
                    {error}
                  </p>
                ) : null}
              </>
            )}
          </section>
        }
      />
    </PlatformShell>
  );
}
