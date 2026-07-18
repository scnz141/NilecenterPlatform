import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { Link, useLocation } from "wouter";

import NileFormsNavigation from "@/components/forms/NileFormsNavigation";
import PlatformShell from "@/components/platform/PlatformShell";
import {
  fetchOwnFormSubmission,
  withdrawFormSubmissionRequest,
} from "@/lib/forms/api";
import { formsRoute } from "@/lib/forms/routes";
import type { Role } from "@/lib/platformData";
import {
  getLocalizedText,
  type FormField,
  type FormLocale,
} from "@shared/nileForms";
import type { FormResponderSubmissionDetail } from "../../../../server/nileFormsService";

const responseCopy = {
  en: {
    notProvided: "Not provided",
    forms: "Forms",
    description: "View the recorded response and its review status.",
    submitted: "Response submitted",
    version: "Version",
    yourResponse: "Your response",
    recordedAnswers: "Recorded answers",
    reviewStatus: "Review status",
    waiting: "This response is waiting for review.",
    reviewing: "The team is reviewing this response now.",
    rejected: "Review the team note below.",
    completed: "This response has completed review.",
    teamNote: "Team note",
    correction: "Need to make a correction?",
    withdrawHelp: "You can withdraw this response before review begins.",
    withdrawing: "Withdrawing",
    withdraw: "Withdraw response",
    latest: "Latest update",
  },
  ar: {
    notProvided: "غير متاح",
    forms: "النماذج",
    description: "عرض الرد المسجل وحالة مراجعته.",
    submitted: "تم إرسال الرد",
    version: "الإصدار",
    yourResponse: "ردك",
    recordedAnswers: "الإجابات المسجلة",
    reviewStatus: "حالة المراجعة",
    waiting: "سيتم إخطارك عند بدء المراجعة.",
    reviewing: "يقوم الفريق بمراجعة ردك الآن.",
    rejected: "يرجى مراجعة ملاحظة الفريق أدناه.",
    completed: "اكتملت مراجعة هذا الرد.",
    teamNote: "ملاحظة الفريق",
    correction: "تحتاج إلى تعديل؟",
    withdrawHelp: "يمكنك سحب الرد قبل أن تبدأ المراجعة.",
    withdrawing: "جارٍ السحب",
    withdraw: "سحب الرد",
    latest: "آخر تحديث",
  },
  tr: {
    notProvided: "Belirtilmedi",
    forms: "Formlar",
    description: "Kaydedilen yanıtı ve inceleme durumunu görüntüleyin.",
    submitted: "Yanıt gönderildi",
    version: "Sürüm",
    yourResponse: "Yanıtınız",
    recordedAnswers: "Kaydedilen yanıtlar",
    reviewStatus: "İnceleme durumu",
    waiting: "Bu yanıt incelenmeyi bekliyor.",
    reviewing: "Ekip bu yanıtı inceliyor.",
    rejected: "Aşağıdaki ekip notunu inceleyin.",
    completed: "Bu yanıtın incelemesi tamamlandı.",
    teamNote: "Ekip notu",
    correction: "Düzeltme yapmanız mı gerekiyor?",
    withdrawHelp: "İnceleme başlamadan önce bu yanıtı geri çekebilirsiniz.",
    withdrawing: "Geri çekiliyor",
    withdraw: "Yanıtı geri çek",
    latest: "Son güncelleme",
  },
} as const;

function responseText(
  locale: FormLocale,
  key: keyof (typeof responseCopy)["en"]
) {
  return responseCopy[locale][key];
}

function displayValue(value: unknown, locale: FormLocale) {
  if (typeof value === "boolean") {
    const labels: Record<FormLocale, { yes: string; no: string }> = {
      en: { yes: "Yes", no: "No" },
      ar: { yes: "نعم", no: "لا" },
      tr: { yes: "Evet", no: "Hayır" },
    };
    return value ? labels[locale].yes : labels[locale].no;
  }
  if (Array.isArray(value)) return value.join(", ");
  if (value === undefined || value === null || value === "") {
    return responseText(locale, "notProvided");
  }
  return String(value);
}

function formattedAnswer(
  field: FormField,
  value: unknown,
  detail: FormResponderSubmissionDetail,
  locale: FormLocale
) {
  const options = field.options ?? detail.entityOptions[field.id] ?? [];
  const selected = options
    .filter(option =>
      Array.isArray(value) ? value.includes(option.id) : option.id === value
    )
    .map(option => getLocalizedText(option.label, locale));
  return selected.length ? selected.join(", ") : displayValue(value, locale);
}

function statusLabel(status: string, locale: FormLocale) {
  const labels: Record<string, Record<FormLocale, string>> = {
    submitted: { en: "Submitted", ar: "تم الإرسال", tr: "Gönderildi" },
    under_review: {
      en: "Under review",
      ar: "قيد المراجعة",
      tr: "İnceleniyor",
    },
    accepted: { en: "Accepted", ar: "مقبول", tr: "Kabul edildi" },
    rejected: {
      en: "Needs changes",
      ar: "يحتاج تعديلاً",
      tr: "Değişiklik gerekli",
    },
    promoted: { en: "Completed", ar: "مكتمل", tr: "Tamamlandı" },
    withdrawn: { en: "Withdrawn", ar: "تم السحب", tr: "Geri çekildi" },
    quarantined: {
      en: "Needs attention",
      ar: "يحتاج متابعة",
      tr: "İnceleme gerekli",
    },
  };
  return labels[status]?.[locale] ?? status.replaceAll("_", " ");
}

export default function NileFormsResponsePage({
  role,
  publicationId,
  submissionId,
}: {
  role: Role;
  publicationId: string;
  submissionId: string;
}) {
  const [, navigate] = useLocation();
  const [detail, setDetail] = useState<FormResponderSubmissionDetail | null>(
    null
  );
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [message, setMessage] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setStatus("loading");
      const response = await fetchOwnFormSubmission(
        publicationId,
        submissionId
      );
      if (cancelled) return;
      if (!response.ok || !response.data) {
        setStatus("error");
        setMessage(response.error ?? "This response could not be loaded.");
        return;
      }
      setDetail(response.data);
      setStatus("ready");
      setMessage("");
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [publicationId, reload, submissionId]);

  const fields = useMemo(
    () => detail?.version.content.pages.flatMap(page => page.fields) ?? [],
    [detail]
  );

  const withdraw = async () => {
    if (!detail) return;
    setWithdrawing(true);
    setMessage("");
    const response = await withdrawFormSubmissionRequest(
      detail.submission.id,
      detail.submission.revision
    );
    setWithdrawing(false);
    if (!response.ok) {
      setMessage(response.error ?? "The response could not be withdrawn.");
      return;
    }
    navigate(formsRoute(role, `/${publicationId}`));
  };

  if (status !== "ready" || !detail) {
    return (
      <PlatformShell role={role} title="Form response">
        <div className="nile-forms-page">
          <NileFormsNavigation role={role} />
          <section
            className="nile-forms-state"
            role={status === "error" ? "alert" : undefined}
          >
            {status === "loading" ? (
              <span className="nile-forms-spinner" />
            ) : (
              <CheckCircle2 size={24} />
            )}
            <strong>
              {status === "loading"
                ? "Loading response"
                : "Response unavailable"}
            </strong>
            {message ? <p>{message}</p> : null}
            {status === "error" ? (
              <button
                type="button"
                className="platform-secondary-button"
                onClick={() => setReload(value => value + 1)}
              >
                <RefreshCw size={15} />
                Retry
              </button>
            ) : null}
          </section>
        </div>
      </PlatformShell>
    );
  }

  const locale = detail.version.content.defaultLanguage;
  const direction = locale === "ar" ? "rtl" : "ltr";
  const latestReview = detail.reviews.reduce<
    (typeof detail.reviews)[number] | undefined
  >(
    (latest, review) =>
      !latest ||
      new Date(review.createdAt).getTime() >
        new Date(latest.createdAt).getTime()
        ? review
        : latest,
    undefined
  );
  const dateLocale =
    locale === "ar" ? "ar-EG" : locale === "tr" ? "tr-TR" : "en";

  return (
    <PlatformShell role={role} title="Form response">
      <div
        className="nile-forms-page nile-form-response-detail"
        dir={direction}
      >
        <NileFormsNavigation role={role} />
        <header className="nile-forms-page-header compact">
          <div>
            <Link href={formsRoute(role)} className="nile-forms-back-link">
              <ArrowLeft size={15} />
              {responseText(locale, "forms")}
            </Link>
            <h1>{getLocalizedText(detail.version.content.title, locale)}</h1>
            <p>{responseText(locale, "description")}</p>
          </div>
          <span
            className={`nile-form-status is-${detail.submission.status}`}
            data-testid="nile-form-response-status"
          >
            {statusLabel(detail.submission.status, locale)}
          </span>
        </header>

        {message ? (
          <p className="nile-form-notice is-error" role="alert">
            {message}
          </p>
        ) : null}

        <section
          className="nile-form-response-summary"
          data-testid="nile-form-response-detail"
        >
          <CheckCircle2 size={20} />
          <div>
            <span>{responseText(locale, "submitted")}</span>
            <strong>
              {new Intl.DateTimeFormat(dateLocale, {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(detail.submission.submittedAt))}
            </strong>
          </div>
          <div>
            <span>{responseText(locale, "version")}</span>
            <strong>{detail.version.versionNumber}</strong>
          </div>
        </section>

        <section className="nile-form-review-grid">
          <article className="nile-form-review-answers">
            <header>
              <div>
                <span>{responseText(locale, "yourResponse")}</span>
                <h2>{responseText(locale, "recordedAnswers")}</h2>
              </div>
            </header>
            <dl>
              {fields
                .filter(field =>
                  Object.hasOwn(detail.submission.answers, field.id)
                )
                .map(field => (
                  <div key={field.id}>
                    <dt>{getLocalizedText(field.label, locale)}</dt>
                    <dd>
                      {formattedAnswer(
                        field,
                        detail.submission.answers[field.id],
                        detail,
                        locale
                      )}
                    </dd>
                  </div>
                ))}
            </dl>
          </article>

          <aside className="nile-form-review-context">
            <section>
              <header>
                <h2>{responseText(locale, "reviewStatus")}</h2>
              </header>
              {detail.submission.status === "submitted" ? (
                <p>{responseText(locale, "waiting")}</p>
              ) : detail.submission.status === "under_review" ? (
                <p>{responseText(locale, "reviewing")}</p>
              ) : detail.submission.status === "rejected" ? (
                <p>{responseText(locale, "rejected")}</p>
              ) : (
                <p>{responseText(locale, "completed")}</p>
              )}
            </section>

            {latestReview?.comments ? (
              <section className="nile-form-response-review">
                <header>
                  <h2>{responseText(locale, "teamNote")}</h2>
                </header>
                <p>{latestReview.comments}</p>
              </section>
            ) : null}

            {detail.submission.status === "submitted" ? (
              <section className="nile-form-review-actions">
                <header>
                  <h2>{responseText(locale, "correction")}</h2>
                </header>
                <p>{responseText(locale, "withdrawHelp")}</p>
                <button
                  type="button"
                  className="platform-secondary-button is-danger"
                  disabled={withdrawing}
                  onClick={withdraw}
                  data-testid="nile-form-withdraw-response"
                >
                  <RotateCcw size={16} />
                  {responseText(
                    locale,
                    withdrawing ? "withdrawing" : "withdraw"
                  )}
                </button>
              </section>
            ) : null}

            <section className="nile-form-response-activity">
              <header>
                <h2>{responseText(locale, "latest")}</h2>
              </header>
              <p>
                <Clock3 size={14} />
                {new Intl.DateTimeFormat(dateLocale, {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(detail.submission.updatedAt))}
              </p>
            </section>
          </aside>
        </section>
      </div>
    </PlatformShell>
  );
}
