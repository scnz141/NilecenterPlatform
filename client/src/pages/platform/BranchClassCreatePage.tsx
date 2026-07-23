import { requireActiveUser } from "@/lib/auth/session";
import { useMemo, useState, type FormEvent } from "react";
import { ArrowRight, Plus } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import PlatformShell from "@/components/platform/PlatformShell";
import { FormFlowLayout } from "@/components/platform/PlatformLayouts";
import { runPlatformWorkflowActionRequest } from "@/lib/backend/api";
import { platformStore } from "@/lib/domain/store";

export default function BranchClassCreatePage() {
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
