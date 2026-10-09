import { useState } from "react";
import { Link, useParams } from "wouter";
import { UserPlus } from "lucide-react";
import type { FormLocale, FormReview } from "@shared/nileForms";
import { reviewFormSubmissionRequest, type FormSubmissionDetail } from "@/lib/forms/api";
import { useInvalidate, useNcc } from "../api";
import { copy } from "../copy";
import { answerText, branchFromAnswers, contactFromAnswers, DISPLAY_TYPES, formLocaleFor, text } from "../forms/model";
import { formsWrite } from "../forms/write";
import { formatDateTime, useStaffLocale } from "../i18n";
import { isAdmissionsRole } from "../roles";
import { runAction } from "../run-action";
import { useStaffSession } from "../session";
import { useStaffCrumb, useStaffParent } from "../shell/staff-shell";
import { canManageForms } from "../forms/model";
import { ErrorState, LoadingRows, StatusBadge } from "../ui/primitives";
import { RESPONSE_TONE } from "./forms-page";
import { LeadForm } from "./lead-form";

const F = copy.forms;
/** Review notes carry the EMS lead a response became, e.g. "EMS lead: <uuid>". */
const LEAD_MARK = /EMS lead: ([0-9a-f-]{36})/i;

export function linkedLeadId(reviews: Pick<FormReview, "comments">[]) {
  for (const review of reviews) {
    const match = review.comments?.match(LEAD_MARK);
    if (match) return match[1];
  }
  return null;
}

export default function FormResponsePage() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const { session } = useStaffSession();
  const staffLocale = useStaffLocale();
  const invalidate = useInvalidate();
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [leadOpen, setLeadOpen] = useState(false);
  const detail = useNcc<FormSubmissionDetail>(
    submissionId ? `/api/forms/submissions/${encodeURIComponent(submissionId)}` : null
  );
  const data = detail.data;
  useStaffCrumb(data ? data.definition.title : null);
  // Up goes to this form's responses, not the forms list the URL sits under.
  useStaffParent(
    data && canManageForms(session?.activeRole)
      ? { href: `/app/forms/${encodeURIComponent(data.definition.id)}?tab=responses`, label: data.definition.title }
      : null
  );

  if (detail.error) return <ErrorState error={detail.error} onRetry={() => void detail.mutate()} />;
  if (!data) return <LoadingRows />;

  const { submission, version, definition } = data;
  const locale: FormLocale = formLocaleFor(staffLocale);
  const fields = version.content.pages.flatMap(page => page.fields).filter(field => !DISPLAY_TYPES.has(field.type));
  const words = { yes: F.yes, no: F.no, agreed: F.agreed };
  const leadId = linkedLeadId(data.reviews);
  // Only new and in-review responses take a decision.
  const open = submission.status === "submitted" || submission.status === "under_review";
  const canLead =
    definition.category === "admissions" && isAdmissionsRole(session?.ncc?.activeRole) && !leadId && submission.status !== "rejected";
  const contact = contactFromAnswers(fields, submission.answers);

  async function decide(decision: FormReview["decision"], comments?: string) {
    setSaving(true);
    await runAction(
      async () => {
        // Decisions follow New -> In review -> Accepted or Rejected; a final
        // decision on a new response passes through review first.
        let revision = submission.revision;
        if (decision !== "under_review" && submission.status === "submitted") {
          const step = await formsWrite(
            reviewFormSubmissionRequest(submission.id, { decision: "under_review", expectedRevision: revision })
          );
          revision = step.submission.revision;
        }
        await formsWrite(
          reviewFormSubmissionRequest(submission.id, {
            decision,
            expectedRevision: revision,
            ...(comments?.trim() ? { comments: comments.trim() } : {}),
          })
        );
        setNote("");
        await Promise.all([detail.mutate(), invalidate("/api/forms/submissions")]);
      },
      { success: F.reviewedToast }
    );
    setSaving(false);
  }

  return (
    <div className="staff-detail flex min-w-0 flex-col gap-6">
      <header className="staff-detail-head">
        <div className="min-w-0">
          <div className="staff-eyebrow">
            <Link href={`/app/forms/${definition.id}?tab=responses`} className="staff-link-quiet">
              {definition.title}
            </Link>
          </div>
          <h1 className="staff-detail-name">{formatDateTime(submission.submittedAt)}</h1>
          <div className="staff-detail-meta">
            <StatusBadge status={RESPONSE_TONE[submission.status]} label={F.responseStatus[submission.status]} />
            <span className="staff-muted">
              {submission.respondentRole ? F.roles[submission.respondentRole] : F.anonymous}
              {submission.legacySource ? " · Jotform" : ""}
            </span>
          </div>
        </div>
        {canLead ? (
          <div className="staff-detail-actions">
            <button type="button" className="staff-btn" data-variant="primary" data-size="sm" onClick={() => setLeadOpen(true)}>
              <UserPlus strokeWidth={1.75} aria-hidden />
              {F.createLead}
            </button>
          </div>
        ) : null}
      </header>

      {leadId ? (
        <p className="staff-banner" data-tone="positive" role="status">
          <span>{F.leadCreated}</span>
          <Link href={`/app/leads/${leadId}`} className="staff-btn" data-size="sm">
            {F.openLead}
          </Link>
        </p>
      ) : canLead ? (
        <p className="staff-hint">{F.createLeadHint}</p>
      ) : null}

      <div className="staff-detail-grid">
        <section className="staff-section">
          <h2 className="staff-section-title">{F.answers}</h2>
          <dl className="staff-answers">
            {fields.map(field => {
              const value = answerText(field, submission.answers[field.id], locale, words);
              return (
                <div key={field.id} className="staff-answer">
                  <dt>{text(field.label, locale)}</dt>
                  <dd>{value || <span className="staff-muted">{F.noAnswer}</span>}</dd>
                </div>
              );
            })}
          </dl>
        </section>

        <aside className="flex flex-col gap-4">
          {open ? (
            <section className="staff-section">
              <h2 className="staff-section-title">{F.review}</h2>
              <label className="staff-field">
                <span className="staff-field-label">{F.comment}</span>
                <textarea className="staff-input" rows={3} maxLength={1000} value={note} onChange={event => setNote(event.target.value)} />
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="staff-btn" data-variant="primary" data-size="sm" disabled={saving} onClick={() => void decide("accepted", note)}>
                  {F.accept}
                </button>
                {submission.status === "submitted" ? (
                  <button type="button" className="staff-btn" data-size="sm" disabled={saving} onClick={() => void decide("under_review", note)}>
                    {F.startReview}
                  </button>
                ) : null}
                <button type="button" className="staff-btn" data-size="sm" data-variant="quiet-danger" disabled={saving} onClick={() => void decide("rejected", note)}>
                  {F.reject}
                </button>
              </div>
            </section>
          ) : null}
          <section className="staff-section">
            <h2 className="staff-section-title">{F.history}</h2>
            <ul className="staff-attention">
              <li className="staff-sync-step">
                <span>{F.submitted}</span>
                <span className="staff-muted">{formatDateTime(submission.submittedAt)}</span>
              </li>
              {[...data.reviews]
                .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
                .map(review => (
                <li key={review.id} className="staff-sync-step">
                  <span className="staff-cell-stack">
                    <span>{F.responseStatus[review.decision]}</span>
                    {review.comments ? (
                      <span className="staff-muted">{LEAD_MARK.test(review.comments) ? F.leadCreated : review.comments}</span>
                    ) : null}
                  </span>
                  <span className="staff-muted">{formatDateTime(review.createdAt)}</span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>

      {canLead ? (
        <LeadForm
          open={leadOpen}
          onOpenChange={setLeadOpen}
          lead={null}
          prefill={{
            firstName: contact.firstName,
            lastName: contact.lastName,
            email: contact.email,
            phone: contact.phone,
            source: `Form: ${definition.title}`.slice(0, 64),
            ...(branchFromAnswers(fields, submission.answers) ? { branchId: branchFromAnswers(fields, submission.answers) as string } : {}),
            notes: fields
              .map(field => {
                const value = answerText(field, submission.answers[field.id], "en", words);
                return value ? `${field.label.en}: ${value}` : "";
              })
              .filter(Boolean)
              .join("\n")
              .slice(0, 2000),
          }}
          onSaved={lead => void decide("accepted", `EMS lead: ${lead.id}`)}
        />
      ) : null}
    </div>
  );
}
