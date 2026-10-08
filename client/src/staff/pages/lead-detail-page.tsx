import { useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { MoreHorizontal, Pencil } from "lucide-react";
import {
  patchNccLeadRequest,
  type NccLeadDto,
  type NccLeadGroupDto,
  type NccLostReasonDto,
  type NccPageDto,
  type NccPlacementTestDto,
  type NccTrialLessonDto,
} from "@/lib/backend/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/staff/ui/kit";
import {
  JOURNEY_STEPS,
  leadJourney,
  type JourneyStep,
  type NextLeadAction,
} from "../admissions";
import { staffWrite, useInvalidate, useNcc } from "../api";
import { copy } from "../copy";
import { isAdmissionsRole } from "../roles";
import { runAction } from "../run-action";
import { useStaffSession } from "../session";
import { useStaffCrumb } from "../shell/staff-shell";
import { ConfirmDialog } from "../ui/confirm-dialog";
import {
  Avatar,
  EmptyState,
  ErrorState,
  LoadingRows,
  NotSet,
  StatusBadge,
} from "../ui/primitives";
import { SecretDialog, type StaffSecret } from "../ui/secret-dialog";
import { formatDate } from "./catalog-shared";
import { ModeTags, MoneyBar, useBranches } from "./admissions-ui";
import { BookingList, type Booking } from "./booking-list";
import {
  BookingSheet,
  ConvertSheet,
  FeeSheet,
  ResultSheet,
} from "./booking-sheets";
import { LeadForm, leadTypeLabel } from "./lead-form";

const L = copy.admissions.leads;
const B = copy.admissions.booking;

const STEP_LABEL: Record<JourneyStep, string> = {
  get contact() {
    return L.stepContact;
  },
  get placement() {
    return L.stepPlacement;
  },
  get trial() {
    return L.stepTrial;
  },
  get fee() {
    return L.stepFee;
  },
  get student() {
    return L.stepStudent;
  },
};

function nextText(next: NextLeadAction): string {
  switch (next) {
    case "book_placement":
      return L.nextBookPlacement;
    case "record_placement":
      return L.nextRecordPlacement;
    case "book_trial":
      return L.nextBookTrial;
    case "record_trial":
      return L.nextRecordTrial;
    case "fee":
      return L.nextFee;
    case "convert":
      return L.nextConvert;
    case "open_student":
      return L.nextStudent;
    case "lost":
      return L.nextLost;
  }
}

function stateLabel(state: string) {
  if (state === "done") return L.stepDone;
  if (state === "now") return L.stepNow;
  if (state === "skipped") return L.stepSkipped;
  return L.stepLater;
}

function Journey({ steps }: { steps: Record<JourneyStep, string> }) {
  return (
    <ol className="staff-journey" aria-label={L.journey}>
      {JOURNEY_STEPS.map((step, index) => (
        <li key={step} className="staff-journey-step" data-state={steps[step]}>
          <span className="staff-journey-mark" aria-hidden>
            {index + 1}
          </span>
          <span className="staff-journey-text">
            <span className="staff-journey-label">{STEP_LABEL[step]}</span>
            <span className="staff-journey-state">
              {stateLabel(steps[step])}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

type Sheet =
  | { type: "edit" }
  | { type: "book"; kind: "placement" | "trial"; booking?: Booking }
  | { type: "result"; booking: Booking }
  | { type: "fee" }
  | { type: "convert" };

type Confirm = { type: "lost" } | { type: "reopen" };

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { session } = useStaffSession();
  const allowed = isAdmissionsRole(session?.ncc?.activeRole);
  const invalidate = useInvalidate();
  const [, navigate] = useLocation();
  const branches = useBranches();
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [secrets, setSecrets] = useState<StaffSecret[] | null>(null);

  const leadKey =
    allowed && id
      ? `/api/ncc/admissions/leads/${encodeURIComponent(id)}`
      : null;
  const leadQuery = useNcc<{ lead: NccLeadDto }>(leadKey);
  const placements = useNcc<NccPageDto<NccPlacementTestDto>>(
    allowed && id ? "/api/ncc/admissions/placement-tests" : null,
    { leadId: id, pageSize: 100 }
  );
  const trials = useNcc<NccPageDto<NccTrialLessonDto>>(
    allowed && id ? "/api/ncc/admissions/trial-lessons" : null,
    { leadId: id, pageSize: 100 }
  );
  const lead = leadQuery.data?.lead;
  const group = useNcc<{ group: NccLeadGroupDto }>(
    lead?.groupId
      ? `/api/ncc/admissions/lead-groups/${encodeURIComponent(lead.groupId)}`
      : null
  );
  const lostReasons = useNcc<{ items: NccLostReasonDto[] }>(
    confirm?.type === "lost" ? "/api/ncc/settings/lost-reasons" : null
  );
  useStaffCrumb(lead?.name ?? null);

  if (!allowed)
    return <EmptyState title={copy.shell.noAccess} description={L.noAccess} />;
  if (leadQuery.error) {
    return (
      <ErrorState
        error={leadQuery.error}
        onRetry={() => void leadQuery.mutate()}
      />
    );
  }
  if (!lead) return <LoadingRows />;

  const branch = branches.get(lead.branchId);
  const placementItems = placements.data?.items ?? [];
  const trialItems = trials.data?.items ?? [];
  const bookingsReady = Boolean(placements.data && trials.data);
  const { steps, next } = leadJourney(lead, placementItems, trialItems);
  const scheduledPlacement = placementItems.find(
    item => item.status === "scheduled"
  );
  const scheduledTrial = trialItems.find(item => item.status === "scheduled");
  const subject = { type: "lead" as const, id: lead.id, branch };
  const closed = lead.status === "lost" || Boolean(lead.studentId);

  async function refresh() {
    await Promise.all([
      invalidate("/api/ncc/admissions/leads"),
      invalidate("/api/ncc/admissions/placement-tests"),
      invalidate("/api/ncc/admissions/trial-lessons"),
    ]);
  }

  function primaryAction() {
    switch (next) {
      case "book_placement":
        return {
          label: L.bookPlacement,
          run: () => setSheet({ type: "book", kind: "placement" }),
        };
      case "record_placement":
        return scheduledPlacement
          ? {
              label: B.resultTitle,
              run: () =>
                setSheet({
                  type: "result",
                  booking: { kind: "placement", item: scheduledPlacement },
                }),
            }
          : null;
      case "book_trial":
        return {
          label: L.bookTrial,
          run: () => setSheet({ type: "book", kind: "trial" }),
        };
      case "record_trial":
        return scheduledTrial
          ? {
              label: B.resultTitle,
              run: () =>
                setSheet({
                  type: "result",
                  booking: { kind: "trial", item: scheduledTrial },
                }),
            }
          : null;
      case "fee":
        return { label: L.recordFee, run: () => setSheet({ type: "fee" }) };
      case "convert":
        return { label: L.convert, run: () => setSheet({ type: "convert" }) };
      case "open_student":
        return lead?.studentId
          ? {
              label: L.openStudent,
              run: () => navigate(`/app/students/${lead.studentId}`),
            }
          : null;
      case "lost":
        return { label: L.reopen, run: () => setConfirm({ type: "reopen" }) };
    }
  }
  const primary = bookingsReady ? primaryAction() : null;
  const secondary = closed
    ? []
    : ([
        next !== "book_placement" && !scheduledPlacement
          ? {
              label: L.bookPlacement,
              run: () => setSheet({ type: "book", kind: "placement" }),
            }
          : null,
        next !== "book_trial" && !scheduledTrial
          ? {
              label: L.bookTrial,
              run: () => setSheet({ type: "book", kind: "trial" }),
            }
          : null,
        next !== "fee" && !lead.registration
          ? { label: L.recordFee, run: () => setSheet({ type: "fee" }) }
          : null,
      ].filter(Boolean) as { label: string; run: () => void }[]);

  return (
    <div className="staff-detail flex min-w-0 flex-col gap-6">
      <header className="staff-detail-head">
        <div className="staff-detail-id">
          <Avatar name={lead.name} seed={lead.id} size="lg" />
          <div className="min-w-0">
            <h1 className="staff-detail-name">{lead.name}</h1>
            <div className="staff-detail-contact staff-ltr">
              <span title={lead.email}>{lead.email}</span>
              {lead.phone ? <span>{lead.phone}</span> : null}
            </div>
            <div className="staff-detail-meta">
              <StatusBadge status={lead.status} />
              <ModeTags online={lead.wantsOnline} onsite={lead.wantsOnsite} />
              <span className="staff-muted">{lead.branchName}</span>
            </div>
          </div>
        </div>
        <div className="staff-detail-actions">
          <button
            type="button"
            className="staff-btn"
            data-size="sm"
            onClick={() => setSheet({ type: "edit" })}
          >
            <Pencil strokeWidth={1.75} aria-hidden />
            {copy.actions.edit}
          </button>
          {!lead.studentId ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="staff-icon-btn"
                  aria-label={copy.staffUsers.moreActions}
                >
                  <MoreHorizontal strokeWidth={1.75} aria-hidden />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {lead.status === "lost" ? (
                  <DropdownMenuItem
                    onSelect={() => setConfirm({ type: "reopen" })}
                  >
                    {L.reopen}
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    className="text-[var(--staff-red)]"
                    onSelect={() => setConfirm({ type: "lost" })}
                  >
                    {L.markLost}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </header>

      <Journey steps={steps} />

      <section
        className="staff-next"
        aria-labelledby="lead-next"
        data-next={next}
      >
        <div className="staff-next-text">
          <h2 id="lead-next" className="staff-section-title">
            {L.nextStep}
          </h2>
          <p>{nextText(next)}</p>
          {lead.status === "lost" && lead.lostReasonName ? (
            <p className="staff-muted">
              {L.lostBecause}: {lead.lostReasonName}
            </p>
          ) : null}
        </div>
        <div className="staff-next-actions">
          {secondary.map(action => (
            <button
              key={action.label}
              type="button"
              className="staff-btn"
              onClick={action.run}
            >
              {action.label}
            </button>
          ))}
          {primary ? (
            <button
              type="button"
              className="staff-btn"
              data-variant="primary"
              onClick={primary.run}
            >
              {primary.label}
            </button>
          ) : null}
        </div>
      </section>

      <div className="staff-detail-grid">
        <div className="staff-detail-main">
          <section className="staff-section">
            <h2 className="staff-section-title">{L.placements}</h2>
            {!placements.data ? (
              <LoadingRows rows={2} />
            ) : (
              <BookingList
                bookings={placementItems.map(item => ({
                  kind: "placement",
                  item,
                }))}
                branchFor={branches.get}
                empty={L.noPlacements}
              />
            )}
          </section>
          <section className="staff-section">
            <h2 className="staff-section-title">{L.trials}</h2>
            {!trials.data ? (
              <LoadingRows rows={2} />
            ) : (
              <BookingList
                bookings={trialItems.map(item => ({ kind: "trial", item }))}
                branchFor={branches.get}
                empty={L.noTrials}
              />
            )}
          </section>
        </div>

        <aside className="staff-detail-side">
          <section className="staff-section">
            <div className="staff-section-head">
              <h2 className="staff-section-title">{L.fee}</h2>
              {lead.registration && !lead.studentId ? (
                <button
                  type="button"
                  className="staff-icon-btn"
                  aria-label={L.editFee}
                  title={L.editFee}
                  onClick={() => setSheet({ type: "fee" })}
                >
                  <Pencil strokeWidth={1.75} aria-hidden />
                </button>
              ) : null}
            </div>
            {lead.registration ? (
              <MoneyBar registration={lead.registration} />
            ) : (
              <p className="staff-muted">{L.noFee}</p>
            )}
          </section>
          <section className="staff-section">
            <h2 className="staff-section-title">{L.details}</h2>
            <dl className="staff-dl staff-dl-single">
              <div>
                <dt>{L.preferredCourses}</dt>
                <dd>
                  {lead.preferredCourses.length ? (
                    lead.preferredCourses.map(course => course.name).join(", ")
                  ) : (
                    <NotSet />
                  )}
                </dd>
              </div>
              <div>
                <dt>{L.areaOfStudy}</dt>
                <dd>{lead.areaOfStudyName ?? <NotSet />}</dd>
              </div>
              <div>
                <dt>{L.owner}</dt>
                <dd>
                  {lead.assignedSsaName ?? (
                    <span className="staff-muted">{L.unassigned}</span>
                  )}
                </dd>
              </div>
              <div>
                <dt>{L.leadType}</dt>
                <dd>{leadTypeLabel(lead.leadType)}</dd>
              </div>
              <div>
                <dt>{L.source}</dt>
                <dd>{lead.source ?? <NotSet />}</dd>
              </div>
              <div>
                <dt>{L.added}</dt>
                <dd>{formatDate(lead.createdAt)}</dd>
              </div>
              {lead.notes ? (
                <div>
                  <dt>{L.notes}</dt>
                  <dd className="whitespace-pre-line">{lead.notes}</dd>
                </div>
              ) : null}
            </dl>
          </section>
          {group.data ? (
            <section className="staff-section">
              <h2 className="staff-section-title">
                {L.groupMembers}
                {group.data.group.label ? ` · ${group.data.group.label}` : ""}
              </h2>
              <ul className="staff-plain-list">
                {group.data.group.members
                  .filter(member => member.leadId !== lead.id)
                  .map(member => (
                    <li key={member.leadId}>
                      <Link
                        href={`/app/leads/${member.leadId}`}
                        className="staff-link"
                      >
                        {member.name}
                      </Link>
                      {member.isPrimary ? (
                        <span className="staff-tag">{L.primaryContact}</span>
                      ) : null}
                      <StatusBadge status={member.status} />
                    </li>
                  ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>

      <LeadForm
        open={sheet?.type === "edit"}
        onOpenChange={open => !open && setSheet(null)}
        lead={lead}
      />
      <BookingSheet
        open={sheet?.type === "book"}
        onOpenChange={open => !open && setSheet(null)}
        kind={sheet?.type === "book" ? sheet.kind : "placement"}
        subject={subject}
        booking={sheet?.type === "book" ? (sheet.booking ?? null) : null}
        defaultAreaId={lead.areaOfStudyId}
        defaultCourseId={lead.preferredCourses[0]?.id ?? null}
        onSecrets={setSecrets}
      />
      <ResultSheet
        open={sheet?.type === "result"}
        onOpenChange={open => !open && setSheet(null)}
        booking={sheet?.type === "result" ? sheet.booking : null}
      />
      <FeeSheet
        open={sheet?.type === "fee"}
        onOpenChange={open => !open && setSheet(null)}
        target={{ type: "lead", id: lead.id }}
        registration={lead.registration}
      />
      <ConvertSheet
        open={sheet?.type === "convert"}
        onOpenChange={open => !open && setSheet(null)}
        leadId={lead.id}
        onConverted={student => navigate(`/app/students/${student.id}`)}
      />

      <ConfirmDialog
        open={confirm?.type === "lost"}
        onOpenChange={open => !open && setConfirm(null)}
        title={L.lostTitle}
        description={L.lostBody}
        confirmLabel={L.markLost}
        destructive
        reasonLabel={L.lostReason}
        reasons={(lostReasons.data?.items ?? [])
          .filter(reason => reason.status === "active")
          .map(reason => ({ id: reason.id, label: reason.name }))}
        reasonRequired
        onConfirm={reasonId =>
          runAction(
            async () => {
              await staffWrite(
                patchNccLeadRequest(lead.id, {
                  status: "lost",
                  lostReasonId: reasonId,
                })
              );
              await refresh();
            },
            { success: L.lostToast }
          )
        }
      />
      <ConfirmDialog
        open={confirm?.type === "reopen"}
        onOpenChange={open => !open && setConfirm(null)}
        title={L.reopen}
        confirmLabel={L.reopen}
        onConfirm={() =>
          runAction(
            async () => {
              await staffWrite(
                patchNccLeadRequest(lead.id, {
                  status: "in_process",
                  lostReasonId: null,
                })
              );
              await refresh();
            },
            { success: L.reopenToast }
          )
        }
      />
      <SecretDialog secrets={secrets} onClose={() => setSecrets(null)} />
    </div>
  );
}
