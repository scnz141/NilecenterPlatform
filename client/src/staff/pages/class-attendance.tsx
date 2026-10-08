import { useEffect, useState } from "react";
import {
  markNccClassAttendanceRequest,
  type NccAttendanceDetailDto,
  type NccAttendanceSessionSummaryDto,
  type NccClassDto,
} from "@/lib/backend/api";
import { staffWrite, useInvalidate, useNcc } from "../api";
import { copy } from "../copy";
import { intlLocale } from "../i18n";
import { FormValidationError, runAction } from "../run-action";
import { attendanceState, changedMarks, orderStatuses } from "../teaching";
import { FormSheet } from "../ui/form-sheet";
import { Avatar, EmptyState, ErrorState, LoadingRows, StatusBadge } from "../ui/primitives";

const A = copy.teaching.attendance;

function when(iso: string, timeZone?: string) {
  return new Date(iso).toLocaleString(intlLocale(), {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    ...(timeZone ? { timeZone } : {}),
  });
}

/** Status chip tone by Moodle acronym; the word stays the cue. */
function toneOf(acronym: string | null) {
  switch ((acronym ?? "").toUpperCase()) {
    case "P":
      return "positive";
    case "L":
      return "caution";
    case "E":
      return "neutral";
    case "A":
      return "critical";
    default:
      return "neutral";
  }
}

/** Roll call for one Moodle attendance session; usable from any page. */
export function AttendanceSheet({
  classId,
  session,
  onOpenChange,
  onSaved,
  timeZone,
}: {
  classId: string;
  session: NccAttendanceSessionSummaryDto | null;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
  timeZone?: string;
}) {
  const invalidate = useInvalidate();
  const path = session
    ? `/api/ncc/delivery/classes/${encodeURIComponent(classId)}/attendance/sessions/${session.moodleSessionId}`
    : null;
  const detail = useNcc<{ attendance: NccAttendanceDetailDto }>(path);
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => setEdits({}), [session?.moodleSessionId]);

  const data = detail.data?.attendance;
  const statuses = data ? orderStatuses(data.statuses) : [];
  const present = statuses.find(status => (status.acronym ?? "").toUpperCase() === "P");
  const state = data ? attendanceState(data, edits) : null;

  async function submit() {
    if (!data || !session) return;
    const marks = changedMarks(data, edits);
    if (marks.length === 0) throw new FormValidationError();
    setSaving(true);
    try {
      await staffWrite(markNccClassAttendanceRequest(classId, session.moodleSessionId, marks));
      await invalidate(`/api/ncc/delivery/classes/${classId}/attendance`);
      onSaved?.();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormSheet
      open={session !== null}
      onOpenChange={onOpenChange}
      title={A.sheetTitle}
      description={session ? when(session.sessionDate, timeZone) : undefined}
      dirty={Object.keys(edits).length > 0}
      saving={saving}
      saveLabel={A.save}
      saveDisabled={!data || changedMarks(data, edits).length === 0}
      onSubmit={() => runAction(submit, { success: A.savedToast })}
    >
      {detail.error ? (
        <ErrorState error={detail.error} onRetry={() => void detail.mutate()} />
      ) : !data || !state ? (
        <LoadingRows rows={4} />
      ) : data.students.length === 0 ? (
        <p className="staff-muted">{A.sheetEmpty}</p>
      ) : (
        <>
          <div className="staff-section-head">
            <span className="staff-muted staff-figures">
              {state.marked} {A.of} {state.total} {A.marked}
            </span>
            {present ? (
              <button
                type="button"
                className="staff-btn"
                data-size="sm"
                onClick={() =>
                  setEdits(
                    Object.fromEntries(data.students.map(student => [student.studentId, present.id]))
                  )
                }
              >
                {A.markAll}
              </button>
            ) : null}
          </div>
          <ul className="staff-roll">
            {data.students.map(student => {
              const name = `${student.firstName} ${student.lastName}`.trim() || student.email;
              const current = state.effective[student.studentId];
              return (
                <li key={student.studentId} className="staff-roll-row">
                  <span className="staff-person">
                    <Avatar name={name} seed={student.studentId} size="sm" />
                    <span className="staff-person-meta">
                      <span className="staff-person-name">{name}</span>
                      {student.remarks ? <span className="staff-muted">{student.remarks}</span> : null}
                    </span>
                  </span>
                  <span className="staff-roll-choices" role="radiogroup" aria-label={name}>
                    {statuses.map(status => (
                      <button
                        key={status.id}
                        type="button"
                        role="radio"
                        aria-checked={current === status.id}
                        className="staff-roll-chip"
                        data-tone={toneOf(status.acronym)}
                        data-on={current === status.id || undefined}
                        title={status.description ?? undefined}
                        onClick={() => setEdits(value => ({ ...value, [student.studentId]: status.id }))}
                      >
                        {status.description ?? status.acronym}
                      </button>
                    ))}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </FormSheet>
  );
}

export function ClassAttendance({ item, timeZone }: { item: NccClassDto; timeZone?: string }) {
  const sessions = useNcc<{ items: NccAttendanceSessionSummaryDto[] }>(
    `/api/ncc/delivery/classes/${encodeURIComponent(item.id)}/attendance/sessions`
  );
  const [open, setOpen] = useState<NccAttendanceSessionSummaryDto | null>(null);

  if (sessions.error) return <ErrorState error={sessions.error} onRetry={() => void sessions.mutate()} />;
  if (!sessions.data) return <LoadingRows rows={3} />;
  const items = [...sessions.data.items].sort((a, b) => b.sessionDate.localeCompare(a.sessionDate));
  if (items.length === 0) return <EmptyState title={A.empty} description={A.emptyHint} />;

  return (
    <section className="staff-section">
      <ul className="staff-agenda-list">
        {items.map(session => (
          <li key={session.moodleSessionId} className="staff-agenda-item staff-attendance-item">
            <span className="staff-agenda-time">
              {new Date(session.sessionDate).toLocaleDateString(intlLocale(), {
                day: "numeric",
                month: "short",
                ...(timeZone ? { timeZone } : {}),
              })}
            </span>
            <span className="staff-agenda-body">
              <span className="staff-agenda-name">{when(session.sessionDate, timeZone)}</span>
              <span className="staff-muted">
                {Math.round(session.durationSeconds / 60)} min
                {session.description ? ` · ${session.description}` : ""}
              </span>
            </span>
            <span className="staff-row-actions">
              <StatusBadge
                status={session.lastTaken ? "completed" : "plain"}
                label={session.lastTaken ? A.taken : A.notTaken}
              />
              <button type="button" className="staff-btn" data-size="sm" onClick={() => setOpen(session)}>
                {A.take}
              </button>
            </span>
          </li>
        ))}
      </ul>
      <AttendanceSheet classId={item.id} session={open} onOpenChange={value => !value && setOpen(null)} timeZone={timeZone} />
    </section>
  );
}
