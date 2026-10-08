import { useMemo } from "react";
import type {
  NccAreaOfStudyDto,
  NccAssigneeDto,
  NccBranchDto,
  NccClassDto,
  NccCourseDto,
  NccRegistrationDto,
  NccRoomDto,
  NccStaffUserDto,
} from "@/lib/backend/api";
import { formatAmount, paidShare } from "../admissions";
import { useNcc } from "../api";
import { copy } from "../copy";
import { isStaffManager } from "../roles";
import { useStaffSession } from "../session";

const M = copy.admissions.mode;
const $ = copy.admissions.money;

/* ---------------- Reference data ------------------------------------ */

export function useBranches() {
  const branches = useNcc<{ items: NccBranchDto[] }>(
    "/api/ncc/directory/branches"
  );
  return useMemo(() => {
    const items = branches.data?.items ?? [];
    const byId = new Map(items.map(branch => [branch.id, branch]));
    return {
      items,
      active: items.filter(branch => branch.status === "active"),
      get: (id: string | null | undefined) => (id ? byId.get(id) : undefined),
      loading: branches.isLoading,
    };
  }, [branches.data, branches.isLoading]);
}

export function useActiveCourses(enabled = true) {
  const courses = useNcc<{ items: NccCourseDto[] }>(
    enabled ? "/api/ncc/delivery/courses" : null
  );
  return useMemo(
    () =>
      (courses.data?.items ?? [])
        .filter(course => course.status === "active")
        .map(course => ({
          value: course.id,
          label: course.displayName ?? course.fullname ?? course.shortname,
        })),
    [courses.data]
  );
}

export function useActiveAreas(enabled = true) {
  const areas = useNcc<{ items: NccAreaOfStudyDto[] }>(
    enabled ? "/api/ncc/settings/areas-of-study" : null
  );
  return useMemo(
    () => (areas.data?.items ?? []).filter(area => area.status === "active"),
    [areas.data]
  );
}

export function useBranchRooms(
  branchId: string | null | undefined,
  enabled = true
) {
  const rooms = useNcc<{ items: NccRoomDto[] }>(
    enabled ? "/api/ncc/delivery/rooms" : null
  );
  return useMemo(
    () =>
      (rooms.data?.items ?? []).filter(
        room =>
          room.status === "active" && (!branchId || room.branchId === branchId)
      ),
    [rooms.data, branchId]
  );
}

export function useAssignees(
  branchId: string | null | undefined,
  enabled = true
) {
  const assignees = useNcc<{ items: NccAssigneeDto[] }>(
    enabled && branchId ? "/api/ncc/admissions/assignees" : null,
    branchId ? { branchId } : undefined
  );
  return assignees.data?.items ?? [];
}

/**
 * Teachers who can mentor a placement test in a branch. Managers read the
 * staff directory (and prefer teachers flagged for placement tests).
 * Registrar and SSA cannot read the directory, so they use the teachers of
 * the branch's classes.
 */
export function useMentorTeachers(
  branchId: string | null | undefined,
  enabled = true
) {
  const { session } = useStaffSession();
  const manager = isStaffManager(session?.ncc?.activeRole);
  const users = useNcc<{ items: NccStaffUserDto[] }>(
    enabled && manager ? "/api/ncc/directory/users" : null
  );
  const classes = useNcc<{ items: NccClassDto[] }>(
    enabled && !manager ? "/api/ncc/delivery/classes" : null
  );
  return useMemo(() => {
    if (manager) {
      const teachers = (users.data?.items ?? []).filter(
        user =>
          user.emsRole === "teacher" &&
          user.status === "active" &&
          (!branchId || user.branchIds.includes(branchId))
      );
      const flagged = teachers.filter(user => user.canTakePlacementTest);
      return (flagged.length ? flagged : teachers).map(user => ({
        value: user.id,
        label: user.name || user.email,
      }));
    }
    const seen = new Map<string, string>();
    for (const item of classes.data?.items ?? []) {
      if (branchId && item.branchId !== branchId) continue;
      for (const teacher of item.teachers) {
        if (!seen.has(teacher.id))
          seen.set(teacher.id, teacher.name || teacher.email);
      }
    }
    return Array.from(seen, ([value, label]) => ({ value, label }));
  }, [manager, users.data, classes.data, branchId]);
}

/* ---------------- Small views --------------------------------------- */

export function modeLabel(online: boolean, onsite: boolean): string {
  if (online && onsite) return M.both;
  if (online) return M.online;
  if (onsite) return M.onsite;
  return M.unknown;
}

export function ModeTags({
  online,
  onsite,
}: {
  online: boolean;
  onsite: boolean;
}) {
  if (!online && !onsite)
    return <span className="staff-muted">{M.unknown}</span>;
  return (
    <span className="staff-mode-tags">
      {online ? (
        <span className="staff-mode" data-mode="online">
          {M.online}
        </span>
      ) : null}
      {onsite ? (
        <span className="staff-mode" data-mode="onsite">
          {M.onsite}
        </span>
      ) : null}
    </span>
  );
}

/** Paid-versus-total bar with the three amounts underneath. */
export function MoneyBar({
  registration,
}: {
  registration: NccRegistrationDto;
}) {
  const share = paidShare(registration);
  const settled = (registration.remaining ?? 0) <= 0;
  return (
    <div className="staff-money" data-settled={settled}>
      <div
        className="staff-money-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(share * 100)}
        aria-label={$.paid}
      >
        <span style={{ inlineSize: `${share * 100}%` }} />
      </div>
      <dl className="staff-money-figures">
        <div>
          <dt>{$.toBePaid}</dt>
          <dd>{formatAmount(registration.toBePaid)}</dd>
        </div>
        <div>
          <dt>{$.paid}</dt>
          <dd>{formatAmount(registration.paid ?? 0)}</dd>
        </div>
        <div>
          <dt>{$.remaining}</dt>
          <dd>{settled ? $.settled : formatAmount(registration.remaining)}</dd>
        </div>
      </dl>
    </div>
  );
}
