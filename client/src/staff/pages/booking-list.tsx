import { useState } from "react";
import { Link } from "wouter";
import { MoreHorizontal } from "lucide-react";
import {
  cancelNccPlacementTestRequest,
  cancelNccTrialLessonRequest,
  patchNccPlacementTestRequest,
  patchNccTrialLessonRequest,
  syncNccPlacementMoodleResultRequest,
  type NccBranchDto,
  type NccPlacementTestDto,
  type NccTrialLessonDto,
} from "@/lib/backend/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/staff/ui/kit";
import { formatInZone } from "../admissions";
import { staffWrite, useInvalidate } from "../api";
import { copy } from "../copy";
import { intlLocale } from "../i18n";
import { runAction } from "../run-action";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { StatusBadge } from "../ui/primitives";
import { SecretDialog, type StaffSecret } from "../ui/secret-dialog";
import { BookingSheet, ResultSheet } from "./booking-sheets";

const B = copy.admissions.booking;

export type Booking =
  | { kind: "placement"; item: NccPlacementTestDto }
  | { kind: "trial"; item: NccTrialLessonDto };

/** A scheduled booking whose time has passed still needs an outcome. */
export function needsOutcome(
  item: { status: string; scheduledAt: string | null },
  now = Date.now()
) {
  return (
    item.status === "scheduled" &&
    Boolean(item.scheduledAt) &&
    Date.parse(item.scheduledAt as string) < now
  );
}

/** Calendar day of an instant in a time zone, as YYYY-MM-DD. */
export function dayKey(iso: string | null, timeZone?: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(
      "en-CA",
      timeZone ? { timeZone } : {}
    );
  } catch {
    return iso.slice(0, 10);
  }
}

function dayHeading(key: string, today: string, tomorrow: string): string {
  if (key === today) return copy.admissions.agenda.today;
  if (key === tomorrow) return copy.admissions.agenda.tomorrow;
  return new Date(`${key}T12:00:00Z`)
    .toLocaleDateString(intlLocale(), {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    })
    .replace(/ /g, "\u00a0");
}

function subjectHref(subject: Booking["item"]["subject"]) {
  return subject.type === "lead"
    ? `/app/leads/${subject.id}`
    : `/app/students/${subject.id}`;
}

function BookingRow({
  booking,
  timeZone,
  showSubject,
  onResult,
  onChange,
  onNoShow,
  onCancel,
  onSync,
}: {
  booking: Booking;
  timeZone?: string;
  showSubject?: boolean;
  onResult: () => void;
  onChange: () => void;
  onNoShow: () => void;
  onCancel: () => void;
  onSync?: () => void;
}) {
  const { item } = booking;
  const topic =
    booking.kind === "trial"
      ? (booking.item.courseName ?? booking.item.areaOfStudyName)
      : item.areaOfStudyName;
  const scheduled = item.status === "scheduled";
  const overdue = needsOutcome(item);
  const placement = booking.kind === "placement" ? booking.item : null;
  return (
    <li
      className="staff-booking"
      data-status={item.status}
      data-overdue={overdue || undefined}
    >
      <div className="staff-booking-when">
        <span className="staff-booking-time">
          {formatInZone(item.scheduledAt, timeZone)}
        </span>
        {overdue ? (
          <span className="staff-badge" data-tone="amber">
            {copy.admissions.agenda.needsResult}
          </span>
        ) : (
          <StatusBadge status={item.status} />
        )}
      </div>
      <div className="staff-booking-body">
        {showSubject ? (
          <span className="staff-booking-subject">
            <Link href={subjectHref(item.subject)} className="staff-link">
              {item.subject.name}
            </Link>
            <span className="staff-tag">
              {item.subject.type === "lead"
                ? copy.admissions.agenda.subjectLead
                : copy.admissions.agenda.subjectStudent}
            </span>
          </span>
        ) : null}
        <span className="staff-booking-where">
          {item.meetingUrl ? (
            <a
              className="staff-link staff-ltr"
              href={item.meetingUrl}
              target="_blank"
              rel="noreferrer"
            >
              {B.joinLink}
            </a>
          ) : (
            (item.roomName ?? B.noRoom)
          )}
          {topic ? <span className="staff-muted"> · {topic}</span> : null}
        </span>
        {item.status === "completed" ? (
          <span className="staff-booking-result">
            {B.result}: <strong>{item.resultScore ?? copy.state.notSet}</strong>
            {item.recommendedCourseName
              ? ` · ${item.recommendedCourseName}`
              : ""}
            {placement?.resultRecordedAuto ? (
              <span className="staff-tag">{B.fromMoodle}</span>
            ) : placement?.mentoringTeacherName ? (
              <span className="staff-muted">
                {" "}
                · {placement.mentoringTeacherName}
              </span>
            ) : null}
          </span>
        ) : null}
        {item.resultNotes ? (
          <span className="staff-muted">{item.resultNotes}</span>
        ) : null}
      </div>
      {scheduled ? (
        <div className="staff-booking-actions">
          <button
            type="button"
            className="staff-btn"
            data-size="sm"
            data-variant={overdue ? "primary" : undefined}
            onClick={onResult}
          >
            {B.resultTitle}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="staff-icon-btn"
                aria-label={copy.actions.rowActions}
              >
                <MoreHorizontal strokeWidth={1.75} aria-hidden />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {onSync ? (
                <DropdownMenuItem onSelect={onSync}>
                  {B.syncMoodle}
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem onSelect={onChange}>
                {B.change}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onNoShow}>
                {B.noShow}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-[var(--staff-red)]"
                onSelect={onCancel}
              >
                {B.cancel}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : null}
    </li>
  );
}

type Confirm = { type: "no_show" | "cancel"; booking: Booking };

/**
 * Placement tests or trial lessons with every follow-up action: record the
 * result, pull it from Moodle, change the time or place, mark no-show, or
 * cancel with a reason. Shared by lead, student, and agenda pages.
 */
export function BookingList({
  bookings,
  branchFor,
  showSubject,
  groupByDay,
  empty,
}: {
  bookings: Booking[];
  branchFor: (branchId: string) => NccBranchDto | undefined;
  showSubject?: boolean;
  groupByDay?: boolean;
  empty?: string;
}) {
  const invalidate = useInvalidate();
  const [result, setResult] = useState<Booking | null>(null);
  const [editing, setEditing] = useState<Booking | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [secrets, setSecrets] = useState<StaffSecret[] | null>(null);

  async function refresh() {
    await Promise.all([
      invalidate("/api/ncc/admissions/leads"),
      invalidate("/api/ncc/admissions/students"),
      invalidate("/api/ncc/admissions/placement-tests"),
      invalidate("/api/ncc/admissions/trial-lessons"),
    ]);
  }

  const row = (booking: Booking) => (
    <BookingRow
      key={booking.item.id}
      booking={booking}
      timeZone={branchFor(booking.item.branchId)?.timezone}
      showSubject={showSubject}
      onResult={() => setResult(booking)}
      onChange={() => setEditing(booking)}
      onNoShow={() => setConfirm({ type: "no_show", booking })}
      onCancel={() => setConfirm({ type: "cancel", booking })}
      onSync={
        booking.kind === "placement"
          ? () =>
              void runAction(
                async () => {
                  await staffWrite(
                    syncNccPlacementMoodleResultRequest(booking.item.id)
                  );
                  await refresh();
                },
                { success: B.syncToast }
              )
          : undefined
      }
    />
  );

  let body;
  if (bookings.length === 0) {
    body = empty ? <p className="staff-muted">{empty}</p> : null;
  } else if (!groupByDay) {
    body = <ul className="staff-bookings">{bookings.map(row)}</ul>;
  } else {
    const zoneOf = (booking: Booking) =>
      branchFor(booking.item.branchId)?.timezone;
    const today = dayKey(new Date().toISOString(), zoneOf(bookings[0]));
    const tomorrow = dayKey(
      new Date(Date.now() + 864e5).toISOString(),
      zoneOf(bookings[0])
    );
    const days = new Map<string, Booking[]>();
    for (const booking of bookings) {
      const key = dayKey(booking.item.scheduledAt, zoneOf(booking));
      days.set(key, [...(days.get(key) ?? []), booking]);
    }
    body = (
      <div className="staff-agenda">
        {Array.from(days, ([key, items]) => (
          <section
            key={key}
            className="staff-agenda-day"
            aria-label={dayHeading(key, today, tomorrow)}
          >
            <h2
              className="staff-agenda-heading"
              data-today={key === today || undefined}
            >
              {dayHeading(key, today, tomorrow)}
              <span className="staff-segment-count">{items.length}</span>
            </h2>
            <ul className="staff-bookings">{items.map(row)}</ul>
          </section>
        ))}
      </div>
    );
  }

  const editingSubject = editing
    ? {
        type: editing.item.subject.type,
        id: editing.item.subject.id,
        branch: branchFor(editing.item.branchId),
      }
    : null;

  return (
    <>
      {body}
      <ResultSheet
        open={result !== null}
        onOpenChange={open => !open && setResult(null)}
        booking={result}
      />
      {editingSubject ? (
        <BookingSheet
          open={editing !== null}
          onOpenChange={open => !open && setEditing(null)}
          kind={editing!.kind}
          subject={editingSubject}
          booking={editing}
          onSecrets={setSecrets}
        />
      ) : null}
      <ConfirmDialog
        open={confirm?.type === "no_show"}
        onOpenChange={open => !open && setConfirm(null)}
        title={B.noShowTitle}
        description={B.noShowBody}
        confirmLabel={B.noShow}
        onConfirm={() =>
          runAction(
            async () => {
              if (confirm?.type !== "no_show") return;
              const { booking } = confirm;
              if (booking.kind === "placement") {
                await staffWrite(
                  patchNccPlacementTestRequest(booking.item.id, {
                    status: "no_show",
                  })
                );
              } else {
                await staffWrite(
                  patchNccTrialLessonRequest(booking.item.id, {
                    status: "no_show",
                  })
                );
              }
              await refresh();
            },
            { success: B.noShowToast }
          )
        }
      />
      <ConfirmDialog
        open={confirm?.type === "cancel"}
        onOpenChange={open => !open && setConfirm(null)}
        title={B.cancelTitle}
        description={B.cancelBody}
        confirmLabel={B.cancel}
        destructive
        reasonKind={
          confirm?.booking.kind === "trial"
            ? "cancel_trial_lesson"
            : "cancel_placement_test"
        }
        reasonRequired
        onConfirm={reasonId =>
          runAction(
            async () => {
              if (confirm?.type !== "cancel" || !reasonId) return;
              const { booking } = confirm;
              if (booking.kind === "placement") {
                await staffWrite(
                  cancelNccPlacementTestRequest(booking.item.id, reasonId)
                );
              } else {
                await staffWrite(
                  cancelNccTrialLessonRequest(booking.item.id, reasonId)
                );
              }
              await refresh();
            },
            { success: B.cancelToast }
          )
        }
      />
      <SecretDialog secrets={secrets} onClose={() => setSecrets(null)} />
    </>
  );
}
