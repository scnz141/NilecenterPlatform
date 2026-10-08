import type { NccClassDto, NccCourseDto } from "@/lib/backend/api";
import { copy } from "../copy";
import { fillPercent } from "../dashboard";
import { StatusBadge } from "../ui/primitives";

const C = copy.teaching.courses;

export function SeatsMeter({ item }: { item: Pick<NccClassDto, "activeEnrolmentCount" | "capacity"> }) {
  const pct = fillPercent(item.activeEnrolmentCount, item.capacity);
  const left = item.capacity - item.activeEnrolmentCount;
  return (
    <span className="staff-inline-meter" title={`${item.activeEnrolmentCount}/${item.capacity}`}>
      <span className="staff-tile-meter" data-full={left <= 0 || undefined} aria-hidden>
        <span style={{ inlineSize: `${pct}%` }} />
      </span>
      <span className="staff-figures">
        {item.activeEnrolmentCount}/{item.capacity}
      </span>
    </span>
  );
}

export function courseTitle(course: Pick<NccCourseDto, "displayName" | "fullname">) {
  return course.displayName ?? course.fullname;
}

export function MoodleState({ course }: { course: NccCourseDto }) {
  if (course.moodleRefreshError) return <StatusBadge status="failed" label={C.refreshError} />;
  return (
    <StatusBadge
      status={course.moodleVisible === false ? "plain" : "ok"}
      label={course.moodleVisible === false ? C.moodleHidden : C.moodleVisible}
    />
  );
}

