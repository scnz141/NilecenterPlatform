import PlatformShell from "@/components/platform/PlatformShell";
import StatefulWorkflowExperience from "@/components/platform/WorkflowExperiences";
import { getPageConfig } from "@/lib/platformData";

export default function BranchAttendancePage() {
  const config = getPageConfig("branchadmin", "attendance");

  return (
    <PlatformShell role="branchadmin" title="Attendance">
      <StatefulWorkflowExperience
        config={config}
        role="branchadmin"
        pageId="attendance"
      />
    </PlatformShell>
  );
}
