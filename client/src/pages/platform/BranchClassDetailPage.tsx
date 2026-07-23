import { requireActiveUser } from "@/lib/auth/session";
import { useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";
import { Link, useParams } from "wouter";
import PlatformShell from "@/components/platform/PlatformShell";
import { DetailLayout } from "@/components/platform/PlatformLayouts";
import { runPlatformWorkflowActionRequest } from "@/lib/backend/api";
import { platformStore } from "@/lib/domain/store";
import type { ClassGroup } from "@/lib/domain/types";

export default function BranchClassDetailPage() {
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
