import { requireActiveUser } from "@/lib/auth/session";
import { useMemo, useState, type FormEvent } from "react";
import { ArrowRight, Plus } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import PlatformShell from "@/components/platform/PlatformShell";
import { FormFlowLayout } from "@/components/platform/PlatformLayouts";
import { runPlatformWorkflowActionRequest } from "@/lib/backend/api";
import { platformStore } from "@/lib/domain/store";

export default function HodCourseRunCreatePage() {
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(false);
  const [draft, setDraft] = useState({
    courseId: "",
    branchId: "",
    teacherId: "",
    term: "",
    startsOn: "",
    endsOn: "",
  });
  const state = useMemo(() => platformStore.getState(), []);
  const actorId = requireActiveUser("headofdepartment").id;
  const actor = state.users.find(item => item.id === actorId);
  const departmentIds = new Set(
    state.departments
      .filter(item => item.ownerUserId === actorId || item.id === actor?.departmentId)
      .map(item => item.id)
  );
  const programIds = new Set(
    state.programs.filter(item => departmentIds.has(item.departmentId)).map(item => item.id)
  );
  const courses = state.courses.filter(
    item => programIds.has(item.programId) && item.status === "active"
  );
  const teachers = state.teachers.filter(
    item => departmentIds.has(item.departmentId) && item.status === "active"
  );
  const branches = state.branches.filter(item => item.status === "active");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const response = await runPlatformWorkflowActionRequest({
      type: "course-run.create",
      ...draft,
      actorId,
    });
    setSaving(false);
    if (!response.ok || !response.data) {
      toast.error("Course run creation failed", {
        description: response.error ?? "The server could not create this course run.",
      });
      return;
    }
    platformStore.setState(response.data.state);
    setCreated(true);
    toast.success("Course run created");
  };

  return (
    <PlatformShell role="headofdepartment" title="Create course run">
      <FormFlowLayout
        className="hod-course-run-create-page"
        title="Create course run"
        description="Open one dated delivery run for an approved course."
        context="Academic delivery"
        actions={created ? (
          <Link className="platform-primary-button" href="/app/hod/classes">
            View classes <ArrowRight size={15} />
          </Link>
        ) : undefined}
        main={created ? (
          <section className="branch-create-success" role="status">
            <Plus size={20} />
            <div><strong>Course run created</strong><span>The run is pending until its delivery setup is ready.</span></div>
          </section>
        ) : (
          <section className="branch-inline-composer" data-testid="hod-course-run-composer">
            <form className="branch-room-form" onSubmit={submit}>
              <label>Course<select required value={draft.courseId} onChange={event => setDraft(value => ({ ...value, courseId: event.target.value }))}><option value="">Select course</option>{courses.map(course => <option key={course.id} value={course.id}>{course.title}</option>)}</select></label>
              <label>Branch<select required value={draft.branchId} onChange={event => setDraft(value => ({ ...value, branchId: event.target.value }))}><option value="">Select branch</option>{branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
              <label>Teacher<select required value={draft.teacherId} onChange={event => setDraft(value => ({ ...value, teacherId: event.target.value }))}><option value="">Select teacher</option>{teachers.map(profile => { const user = state.users.find(item => item.id === profile.userId); return <option key={profile.userId} value={profile.userId}>{user?.name ?? profile.userId}</option>; })}</select></label>
              <label>Term<input required value={draft.term} onChange={event => setDraft(value => ({ ...value, term: event.target.value }))} placeholder="Autumn 2026 Cairo" /></label>
              <label>Starts on<input required type="date" value={draft.startsOn} onChange={event => setDraft(value => ({ ...value, startsOn: event.target.value }))} /></label>
              <label>Ends on<input required type="date" value={draft.endsOn} onChange={event => setDraft(value => ({ ...value, endsOn: event.target.value }))} /></label>
              <button type="submit" disabled={saving}><Plus size={15} />{saving ? "Creating run" : "Create course run"}</button>
            </form>
          </section>
        )}
      />
    </PlatformShell>
  );
}
