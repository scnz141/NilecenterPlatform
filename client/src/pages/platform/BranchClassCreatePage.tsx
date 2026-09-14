import { getStoredAuthSession, requireActiveUser } from "@/lib/auth/session";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { ArrowRight, Plus } from "lucide-react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";
import PlatformShell from "@/components/platform/PlatformShell";
import NccReadStatus from "@/components/platform/NccReadStatus";
import { FormFlowLayout } from "@/components/platform/PlatformLayouts";
import {
  createNccClassRequest,
  fetchNccCoursesRequest,
  fetchNccDirectoryUsersRequest,
  fetchNccRoomsRequest,
  runPlatformWorkflowActionRequest,
  type NccCourseDto,
  type NccStaffUserDto,
  type NccRoomDto,
} from "@/lib/backend/api";
import {
  classifyNccFailure,
  type NccReadState,
} from "@/lib/backend/nccReadState";
import { platformStore } from "@/lib/domain/store";

export default function BranchClassCreatePage() {
  if (getStoredAuthSession()?.provider === "ncc") {
    return <NccBranchClassCreatePage />;
  }
  return <CompatibilityBranchClassCreatePage />;
}

function CompatibilityBranchClassCreatePage() {
  const [saving, setSaving] = useState(false);
  const [createdClassId, setCreatedClassId] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    courseRunId: "",
    name: "",
    capacity: "12",
    schedule: "",
    roomId: "",
  });
  const state = useMemo(() => platformStore.getState(), []);
  const actorId = requireActiveUser("branchadmin").id;
  const actor = state.users.find(user => user.id === actorId);
  const staffProfile = state.staffProfiles.find(
    profile => profile.userId === actorId && profile.role === "branchadmin"
  );
  const branchId = actor?.branchId ?? staffProfile?.branchIds[0] ?? "";
  const branch = state.branches.find(item => item.id === branchId);
  const courseRuns = state.courseRuns.filter(
    item => item.branchId === branchId && item.status === "active"
  );
  const rooms = state.rooms.filter(
    item => item.branchId === branchId && item.status === "active"
  );

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const response = await runPlatformWorkflowActionRequest({
      type: "class.create",
      courseRunId: draft.courseRunId,
      name: draft.name.trim(),
      capacity: Number(draft.capacity),
      schedule: draft.schedule.trim(),
      roomId: draft.roomId,
      actorId,
    });
    setSaving(false);

    if (!response.ok || !response.data) {
      toast.error("Class creation failed", {
        description: response.error ?? "The server could not create this class.",
      });
      return;
    }

    platformStore.setState(response.data.state);
    const created = response.data.state.classGroups.find(
      item => item.name === draft.name.trim() && item.courseRunId === draft.courseRunId
    );
    setCreatedClassId(created?.id ?? "created");
    toast.success("Class created");
  };

  return (
    <PlatformShell role="branchadmin" title="Create class">
      <FormFlowLayout
        className="branch-class-create-page"
        title="Create class"
        description="Add one class group to an active branch course run."
        context={branch?.name ?? "Branch"}
        actions={
          createdClassId ? (
            <Link className="platform-primary-button" href="/app/branch/classes">
              View classes
              <ArrowRight size={15} />
            </Link>
          ) : undefined
        }
        main={
          createdClassId ? (
            <section className="branch-create-success" role="status">
              <Plus size={20} />
              <div>
                <strong>Class created</strong>
                <span>The empty class is ready for enrollment assignments.</span>
              </div>
            </section>
          ) : (
            <section className="branch-inline-composer" data-testid="branch-class-composer">
              <div className="branch-inline-composer-head">
                <div>
                  <span>New class</span>
                  <strong>{branch?.name ?? "Branch"}</strong>
                </div>
                <Link className="branch-inline-close" href="/app/branch/classes">
                  Cancel
                </Link>
              </div>
              <form className="branch-room-form" onSubmit={submit}>
                <label>
                  Course run
                  <select
                    required
                    value={draft.courseRunId}
                    disabled={saving}
                    onChange={event =>
                      setDraft(value => ({ ...value, courseRunId: event.target.value }))
                    }
                  >
                    <option value="">Select course run</option>
                    {courseRuns.map(run => {
                      const course = state.courses.find(item => item.id === run.courseId);
                      return (
                        <option key={run.id} value={run.id}>
                          {course?.title ?? run.courseId} · {run.term}
                        </option>
                      );
                    })}
                  </select>
                </label>
                <label>
                  Class name
                  <input
                    required
                    value={draft.name}
                    disabled={saving}
                    onChange={event => setDraft(value => ({ ...value, name: event.target.value }))}
                    placeholder="Arabic L3 Evening"
                  />
                </label>
                <label>
                  Capacity
                  <input
                    required
                    type="number"
                    min={1}
                    max={200}
                    value={draft.capacity}
                    disabled={saving}
                    onChange={event =>
                      setDraft(value => ({ ...value, capacity: event.target.value }))
                    }
                  />
                </label>
                <label>
                  Schedule
                  <input
                    required
                    value={draft.schedule}
                    disabled={saving}
                    onChange={event =>
                      setDraft(value => ({ ...value, schedule: event.target.value }))
                    }
                    placeholder="Wed 17:00"
                  />
                </label>
                <label>
                  Room
                  <select
                    required
                    value={draft.roomId}
                    disabled={saving}
                    onChange={event => setDraft(value => ({ ...value, roomId: event.target.value }))}
                  >
                    <option value="">Select room</option>
                    {rooms.map(room => (
                      <option key={room.id} value={room.id}>
                        {room.name} · {room.capacity} seats
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" disabled={saving || !courseRuns.length || !rooms.length}>
                  <Plus size={15} />
                  {saving ? "Creating class" : "Create class"}
                </button>
              </form>
              {!courseRuns.length || !rooms.length ? (
                <p className="platform-form-error">
                  An active course run and active room are required before a class can be created.
                </p>
              ) : null}
            </section>
          )
        }
      />
    </PlatformShell>
  );
}

const nccDayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function NccBranchClassCreatePage() {
  const [, navigate] = useLocation();
  const [courses, setCourses] = useState<NccReadState<NccCourseDto[]>>({
    status: "loading",
  });
  const [rooms, setRooms] = useState<NccReadState<NccRoomDto[]>>({
    status: "loading",
  });
  const [teachers, setTeachers] = useState<NccReadState<NccStaffUserDto[]>>({
    status: "loading",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState({
    courseId: "",
    name: "",
    capacity: "12",
    startAt: "",
    endAt: "",
    roomId: "",
  });
  const [teacherIds, setTeacherIds] = useState<string[]>([]);
  const [scheduleDays, setScheduleDays] = useState<number[]>([]);
  const [scheduleTimes, setScheduleTimes] = useState({
    startTime: "",
    endTime: "",
  });

  const load = useCallback(async () => {
    setCourses({ status: "loading" });
    setRooms({ status: "loading" });
    setTeachers({ status: "loading" });
    const [coursesResult, roomsResult, usersResult] = await Promise.all([
      fetchNccCoursesRequest(),
      fetchNccRoomsRequest(),
      fetchNccDirectoryUsersRequest(),
    ]);
    setCourses(
      coursesResult.ok && coursesResult.data
        ? {
            status: "ready",
            data: coursesResult.data.items.filter(
              course => course.status === "active"
            ),
          }
        : classifyNccFailure(coursesResult)
    );
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
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadingOptions =
    courses.status !== "ready" ||
    rooms.status !== "ready" ||
    teachers.status !== "ready";
  const scheduleStarted =
    scheduleDays.length > 0 || !!scheduleTimes.startTime || !!scheduleTimes.endTime;
  const scheduleComplete =
    scheduleDays.length > 0 &&
    !!scheduleTimes.startTime &&
    !!scheduleTimes.endTime;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
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
    setSaving(true);
    setError("");
    const response = await createNccClassRequest({
      courseId: draft.courseId,
      name: draft.name.trim(),
      capacity: Number(draft.capacity),
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      teacherIds,
      schedule: scheduleComplete
        ? {
            daysOfWeek: scheduleDays,
            startTime: scheduleTimes.startTime,
            endTime: scheduleTimes.endTime,
          }
        : null,
      defaultRoomId: draft.roomId || null,
    });
    setSaving(false);
    if (!response.ok || !response.data) {
      setError(response.error ?? "The server could not create this class.");
      return;
    }
    navigate(`/app/branch/classes/${response.data.class.id}`);
  };

  return (
    <PlatformShell role="branchadmin" title="Create class">
      <FormFlowLayout
        className="branch-class-create-page"
        title="Create class"
        description="Add one EMS class in the current workspace branch."
        main={
          <section
            className="branch-inline-composer"
            data-testid="branch-class-composer"
          >
            <div className="branch-inline-composer-head">
              <div>
                <span>New class</span>
                <strong>EMS class</strong>
              </div>
              <Link className="branch-inline-close" href="/app/branch/classes">
                Cancel
              </Link>
            </div>
            {loadingOptions ? (
              <NccReadStatus
                state={
                  courses.status !== "ready"
                    ? courses
                    : rooms.status !== "ready"
                      ? rooms
                      : teachers
                }
                onRetry={() => void load()}
              />
            ) : (
              <form className="branch-room-form" onSubmit={submit}>
                <label>
                  Course
                  <select
                    required
                    value={draft.courseId}
                    disabled={saving}
                    onChange={event =>
                      setDraft(value => ({
                        ...value,
                        courseId: event.target.value,
                      }))
                    }
                  >
                    <option value="">Select course</option>
                    {courses.data.map(course => (
                      <option key={course.id} value={course.id}>
                        {course.displayName ?? course.fullname}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Class name
                  <input
                    required
                    value={draft.name}
                    disabled={saving}
                    onChange={event =>
                      setDraft(value => ({ ...value, name: event.target.value }))
                    }
                    placeholder="Arabic L3 Evening"
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
                      setDraft(value => ({ ...value, endAt: event.target.value }))
                    }
                  />
                </label>
                <label>
                  Default room
                  <select
                    value={draft.roomId}
                    disabled={saving}
                    onChange={event =>
                      setDraft(value => ({ ...value, roomId: event.target.value }))
                    }
                  >
                    <option value="">No room</option>
                    {rooms.data.map(room => (
                      <option key={room.id} value={room.id}>
                        {room.name}
                        {room.capacity === null ? "" : ` · ${room.capacity} seats`}
                      </option>
                    ))}
                  </select>
                </label>
                {teachers.data.length ? (
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
                  <legend>Schedule (optional)</legend>
                  {nccDayLabels.map((label, day) => (
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
                {error ? (
                  <p className="platform-form-error" role="alert">
                    {error}
                  </p>
                ) : null}
                <button
                  type="submit"
                  disabled={saving || !courses.data.length}
                >
                  <Plus size={15} />
                  {saving ? "Creating class" : "Create class"}
                </button>
              </form>
            )}
          </section>
        }
      />
    </PlatformShell>
  );
}
