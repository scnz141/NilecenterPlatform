import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  RefreshCw,
  Save,
  Send,
} from "lucide-react";

import {
  evaluateFormCalculations,
  evaluateFormLogic,
  getFormCalculationTargetIds,
  getLocalizedText,
  normalizeAndValidateFormAnswers,
  type FormField,
  type FormLocale,
} from "@shared/nileForms";
import type { FormResponderBundle } from "../../../../server/nileFormsService";
import {
  loadAssignedFormDraftRequest,
  loadPublicFormDraftRequest,
  saveAssignedFormDraftRequest,
  savePublicFormDraftRequest,
  submitAssignedFormRequest,
  submitPublicFormRequest,
} from "@/lib/forms/api";

type RendererMode = "public" | "assigned" | "preview" | "offline";

type OfflineSubmissionPayload = {
  answers: Record<string, unknown>;
  clientSubmissionId: string;
  clientSubmittedAt: string;
};

type NileFormRendererProps = {
  bundle: FormResponderBundle;
  mode: RendererMode;
  slug?: string;
  initialAnswers?: Record<string, unknown>;
  onLocaleChange?: (locale: FormLocale) => void;
  onSubmitted?: (submissionId: string) => void;
  onOfflineQueued?: (
    payload: OfflineSubmissionPayload
  ) => Promise<{ ok: boolean; error?: string }>;
};

function createClientSubmissionId() {
  const value = globalThis.crypto?.randomUUID?.();
  return value
    ? `form:${value}`
    : `form:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 12)}`;
}

function draftStorageKey(publicationId: string) {
  return `nile_forms_draft_token:${publicationId}`;
}

const rendererCopy = {
  en: {
    draftRestored: "Draft restored.",
    draftRestoreFailed: "The draft could not be restored.",
    correctCurrent: "Correct the required fields before continuing.",
    draftSaved: "Draft saved.",
    draftSaveFailed: "Draft could not be saved.",
    correctAll: "Correct the highlighted fields before submitting.",
    offlineUnavailable: "Offline storage is not ready for this form.",
    offlineSaveFailed: "The response could not be saved offline.",
    submitFailed: "The response could not be submitted.",
    responseSubmitted: "Response submitted",
    offlineStored:
      "The response is encrypted on this device. Sync it when connectivity returns.",
    draftUnavailable: "Draft unavailable",
    retry: "Retry",
    back: "Back",
    saving: "Saving",
    saveDraft: "Save draft",
    next: "Next",
    submitting: "Submitting",
    encrypting: "Encrypting",
    saveForSync: "Save for sync",
  },
  ar: {
    draftRestored: "تم استعادة المسودة.",
    draftRestoreFailed: "تعذر استعادة المسودة.",
    correctCurrent: "يرجى تصحيح الحقول المطلوبة.",
    draftSaved: "تم حفظ المسودة.",
    draftSaveFailed: "تعذر حفظ المسودة.",
    correctAll: "يرجى تصحيح الحقول المطلوبة.",
    offlineUnavailable: "التخزين دون اتصال غير متاح لهذا النموذج.",
    offlineSaveFailed: "تعذر حفظ الرد دون اتصال.",
    submitFailed: "تعذر إرسال الرد.",
    responseSubmitted: "تم إرسال الرد",
    offlineStored:
      "تم حفظ الرد بشكل مشفر على هذا الجهاز. قم بالمزامنة عند عودة الاتصال.",
    draftUnavailable: "تعذر استعادة المسودة",
    retry: "إعادة المحاولة",
    back: "السابق",
    saving: "جارٍ الحفظ",
    saveDraft: "حفظ المسودة",
    next: "التالي",
    submitting: "جارٍ الإرسال",
    encrypting: "جارٍ التشفير",
    saveForSync: "حفظ للمزامنة",
  },
  tr: {
    draftRestored: "Taslak geri yüklendi.",
    draftRestoreFailed: "Taslak geri yüklenemedi.",
    correctCurrent: "Devam etmeden önce gerekli alanları düzeltin.",
    draftSaved: "Taslak kaydedildi.",
    draftSaveFailed: "Taslak kaydedilemedi.",
    correctAll: "Göndermeden önce işaretli alanları düzeltin.",
    offlineUnavailable: "Bu form için çevrim dışı depolama hazır değil.",
    offlineSaveFailed: "Yanıt çevrim dışı kaydedilemedi.",
    submitFailed: "Yanıt gönderilemedi.",
    responseSubmitted: "Yanıt gönderildi",
    offlineStored:
      "Yanıt bu cihazda şifrelenmiştir. Bağlantı kurulduğunda eşitleyin.",
    draftUnavailable: "Taslak kullanılamıyor",
    retry: "Tekrar dene",
    back: "Geri",
    saving: "Kaydediliyor",
    saveDraft: "Taslağı kaydet",
    next: "İleri",
    submitting: "Gönderiliyor",
    encrypting: "Şifreleniyor",
    saveForSync: "Eşitlemek için kaydet",
  },
} as const;

function rendererText(
  locale: FormLocale,
  key: keyof (typeof rendererCopy)["en"]
) {
  return rendererCopy[locale][key];
}

function inputValue(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? value : "";
}

function FieldControl({
  field,
  locale,
  value,
  options,
  required,
  disabled,
  derived,
  error,
  onChange,
}: {
  field: FormField;
  locale: FormLocale;
  value: unknown;
  options: FormField["options"];
  required: boolean;
  disabled: boolean;
  derived: boolean;
  error?: string;
  onChange(value: unknown): void;
}) {
  const label = getLocalizedText(field.label, locale);
  const description = field.description
    ? getLocalizedText(field.description, locale)
    : "";
  const labelId = `${field.id}-label`;
  const describedBy = [
    description ? `${field.id}-description` : "",
    error ? `${field.id}-error` : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (field.type === "heading") {
    return (
      <div className="nile-form-display-field nile-form-heading-field">
        <h3>{label}</h3>
        {description ? <p>{description}</p> : null}
      </div>
    );
  }
  if (field.type === "instructions") {
    return (
      <div className="nile-form-display-field nile-form-instructions-field">
        <strong>{label}</strong>
        {description ? <p>{description}</p> : null}
      </div>
    );
  }

  const labelContent = (
    <span id={labelId} className="nile-form-field-label">
      {label}
      {required ? <span aria-hidden="true">*</span> : null}
      {derived ? (
        <small>
          {locale === "ar"
            ? "محسوب"
            : locale === "tr"
              ? "Hesaplanan"
              : "Calculated"}
        </small>
      ) : null}
    </span>
  );
  const common = {
    id: field.id,
    name: field.id,
    disabled,
    required,
    "aria-invalid": Boolean(error) as boolean,
    "aria-describedby": describedBy || undefined,
  };
  const groupAccessibility = {
    role: "group" as const,
    "aria-labelledby": labelId,
    "aria-required": required,
    "aria-invalid": Boolean(error) as boolean,
    "aria-describedby": describedBy || undefined,
  };

  let control;
  if (field.type === "long_text") {
    control = (
      <textarea
        {...common}
        rows={5}
        value={inputValue(value)}
        onChange={event => onChange(event.target.value)}
      />
    );
  } else if (
    field.type === "single_choice" ||
    field.type === "entity_reference"
  ) {
    control = (
      <select
        {...common}
        value={inputValue(value)}
        onChange={event => onChange(event.target.value)}
      >
        <option value="">
          {locale === "ar" ? "اختر" : locale === "tr" ? "Seçin" : "Select"}
        </option>
        {(options ?? []).map(option => (
          <option key={option.id} value={option.id}>
            {getLocalizedText(option.label, locale)}
          </option>
        ))}
      </select>
    );
  } else if (field.type === "multiple_choice") {
    const selected = new Set(
      Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string")
        : []
    );
    control = (
      <div className="nile-form-choice-list" {...groupAccessibility}>
        {(options ?? []).map(option => (
          <label key={option.id} className="nile-form-choice-row">
            <input
              type="checkbox"
              name={field.id}
              checked={selected.has(option.id)}
              disabled={disabled}
              onChange={event => {
                const next = new Set(selected);
                if (event.target.checked) next.add(option.id);
                else next.delete(option.id);
                onChange(Array.from(next));
              }}
            />
            <span>{getLocalizedText(option.label, locale)}</span>
          </label>
        ))}
      </div>
    );
  } else if (field.type === "yes_no") {
    control = (
      <div className="nile-form-segmented" {...groupAccessibility}>
        {[
          { value: true, en: "Yes", ar: "نعم", tr: "Evet" },
          { value: false, en: "No", ar: "لا", tr: "Hayır" },
        ].map(option => (
          <button
            key={String(option.value)}
            type="button"
            className={value === option.value ? "is-active" : ""}
            aria-pressed={value === option.value}
            disabled={disabled}
            onClick={() => onChange(option.value)}
          >
            {option[locale]}
          </button>
        ))}
      </div>
    );
  } else if (field.type === "rating") {
    const min = field.validation?.min ?? 1;
    const max = field.validation?.max ?? 5;
    control = (
      <div className="nile-form-rating" {...groupAccessibility}>
        {Array.from({ length: max - min + 1 }, (_, index) => min + index).map(
          rating => (
            <button
              key={rating}
              type="button"
              className={value === rating ? "is-active" : ""}
              aria-pressed={value === rating}
              disabled={disabled}
              onClick={() => onChange(rating)}
            >
              {rating}
            </button>
          )
        )}
      </div>
    );
  } else if (field.type === "consent") {
    control = (
      <label className="nile-form-consent-row">
        <input
          type="checkbox"
          checked={value === true}
          disabled={disabled}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy || undefined}
          onChange={event => onChange(event.target.checked)}
        />
        <span>{description || label}</span>
      </label>
    );
  } else {
    const typeByField: Record<string, string> = {
      email: "email",
      phone: "tel",
      number: "number",
      date: "date",
      time: "time",
    };
    control = (
      <input
        {...common}
        type={typeByField[field.type] ?? "text"}
        value={inputValue(value)}
        min={field.validation?.min}
        max={field.validation?.max}
        minLength={field.validation?.minLength}
        maxLength={field.validation?.maxLength}
        onChange={event =>
          onChange(
            field.type === "number" && event.target.value !== ""
              ? Number(event.target.value)
              : event.target.value
          )
        }
      />
    );
  }

  return (
    <div
      className={`nile-form-field ${error ? "has-error" : ""}`}
      data-field-id={field.id}
    >
      {field.type === "consent" ? null : (
        <label htmlFor={field.id}>{labelContent}</label>
      )}
      {description && field.type !== "consent" ? (
        <p
          id={`${field.id}-description`}
          className="nile-form-field-description"
        >
          {description}
        </p>
      ) : null}
      {control}
      {error ? (
        <p
          id={`${field.id}-error`}
          className="nile-form-field-error"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

export default function NileFormRenderer({
  bundle,
  mode,
  slug,
  initialAnswers = {},
  onLocaleChange,
  onSubmitted,
  onOfflineQueued,
}: NileFormRendererProps) {
  const content = bundle.version.content;
  const [locale, setLocale] = useState<FormLocale>(content.defaultLanguage);
  const [pageIndex, setPageIndex] = useState(0);
  const [answers, setAnswers] =
    useState<Record<string, unknown>>(initialAnswers);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [draftRevision, setDraftRevision] = useState<number | undefined>();
  const [draftToken, setDraftToken] = useState<string | undefined>();
  const [draftLoadAttempt, setDraftLoadAttempt] = useState(0);
  const [restoreError, setRestoreError] = useState("");
  const [busy, setBusy] = useState<"loading" | "saving" | "submitting" | null>(
    mode === "preview" || mode === "offline" ? null : "loading"
  );
  const [notice, setNotice] = useState("");
  const [submittedId, setSubmittedId] = useState("");
  const rendererRef = useRef<HTMLElement>(null);
  const noticeRef = useRef<HTMLParagraphElement>(null);
  const calculatedTargetIds = useMemo(
    () => getFormCalculationTargetIds(content),
    [content]
  );
  const calculationState = useMemo(
    () => evaluateFormCalculations(content, answers),
    [answers, content]
  );
  const displayedAnswers = calculationState.answers;
  const logic = useMemo(
    () => evaluateFormLogic(content, displayedAnswers),
    [content, displayedAnswers]
  );
  const page = content.pages[Math.min(pageIndex, content.pages.length - 1)];
  const isLastPage = pageIndex === content.pages.length - 1;
  const direction = locale === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    onLocaleChange?.(locale);
  }, [locale, onLocaleChange]);

  useEffect(() => {
    if (mode === "preview" || mode === "offline") return;
    let cancelled = false;
    const load = async () => {
      setBusy("loading");
      setRestoreError("");
      const storedToken =
        mode === "public"
          ? (sessionStorage.getItem(draftStorageKey(bundle.publication.id)) ??
            undefined)
          : undefined;
      const response =
        mode === "public" && slug && storedToken
          ? await loadPublicFormDraftRequest(slug, storedToken)
          : mode === "assigned"
            ? await loadAssignedFormDraftRequest(bundle.publication.id)
            : null;
      if (cancelled) return;
      if (response?.ok && response.data) {
        setAnswers(response.data.answers);
        setDraftRevision(response.data.revision);
        setDraftToken(storedToken);
        setNotice(rendererText(content.defaultLanguage, "draftRestored"));
      } else if (response && response.code === "draft_not_found") {
        if (mode === "public") {
          sessionStorage.removeItem(draftStorageKey(bundle.publication.id));
          setDraftToken(undefined);
        }
      } else if (response) {
        setRestoreError(
          response.error ??
            rendererText(content.defaultLanguage, "draftRestoreFailed")
        );
      }
      setBusy(null);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [
    bundle.publication.id,
    content.defaultLanguage,
    draftLoadAttempt,
    mode,
    slug,
  ]);

  const focusFirstError = (
    validationErrors: Record<string, string[]>,
    targetPageIndex: number
  ) => {
    const targetPage = content.pages[targetPageIndex];
    const firstFieldId = targetPage?.fields.find(
      field => validationErrors[field.id]
    )?.id;
    window.setTimeout(() => {
      const fieldWrapper = Array.from(
        rendererRef.current?.querySelectorAll<HTMLElement>("[data-field-id]") ??
          []
      ).find(element => element.dataset.fieldId === firstFieldId);
      const control = fieldWrapper?.querySelector<HTMLElement>(
        "input, select, textarea, button"
      );
      (control ?? noticeRef.current)?.focus();
    });
  };

  const updateAnswer = (fieldId: string, value: unknown) => {
    if (calculatedTargetIds.has(fieldId)) return;
    setAnswers(current => ({ ...current, [fieldId]: value }));
    setErrors(current => {
      if (!current[fieldId]) return current;
      const next = { ...current };
      delete next[fieldId];
      return next;
    });
    setNotice("");
  };

  const validate = () => {
    const result = normalizeAndValidateFormAnswers(content, answers, locale);
    setAnswers(result.answers);
    setErrors(result.errors);
    return result;
  };

  const nextPage = () => {
    const result = validate();
    const currentFieldIds = new Set(page.fields.map(field => field.id));
    if (
      Object.keys(result.errors).some(fieldId => currentFieldIds.has(fieldId))
    ) {
      setNotice(rendererText(locale, "correctCurrent"));
      focusFirstError(result.errors, pageIndex);
      return;
    }
    const skipIndex = logic.skipToPageId
      ? content.pages.findIndex(item => item.id === logic.skipToPageId)
      : -1;
    setPageIndex(
      skipIndex > pageIndex
        ? skipIndex
        : Math.min(content.pages.length - 1, pageIndex + 1)
    );
    setNotice("");
  };

  const saveDraft = async () => {
    if (mode === "preview" || mode === "offline") return;
    setBusy("saving");
    setNotice("");
    const result = normalizeAndValidateFormAnswers(content, answers, locale);
    const response =
      mode === "public" && slug
        ? await savePublicFormDraftRequest(
            slug,
            {
              answers: result.answers,
              expectedRevision: draftRevision,
              locale,
            },
            draftToken
          )
        : await saveAssignedFormDraftRequest(bundle.publication.id, {
            answers: result.answers,
            expectedRevision: draftRevision,
            locale,
          });
    if (response.ok && response.data) {
      setAnswers(response.data.answers);
      setDraftRevision(response.data.revision);
      const token = response.data.draftToken ?? draftToken;
      setDraftToken(token);
      if (mode === "public" && token) {
        sessionStorage.setItem(draftStorageKey(bundle.publication.id), token);
      }
      setNotice(rendererText(locale, "draftSaved"));
    } else {
      setNotice(response.error ?? rendererText(locale, "draftSaveFailed"));
    }
    setBusy(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (mode === "preview") return;
    const result = validate();
    if (!result.ok) {
      const firstErrorPage = content.pages.findIndex(pageItem =>
        pageItem.fields.some(field => result.errors[field.id])
      );
      if (firstErrorPage >= 0) setPageIndex(firstErrorPage);
      setNotice(rendererText(locale, "correctAll"));
      focusFirstError(
        result.errors,
        firstErrorPage >= 0 ? firstErrorPage : pageIndex
      );
      return;
    }
    setBusy("submitting");
    setNotice("");
    const payload = {
      answers: result.answers,
      clientSubmissionId: createClientSubmissionId(),
      clientSubmittedAt: new Date().toISOString(),
      locale,
    };
    if (mode === "offline") {
      if (!onOfflineQueued) {
        setNotice(rendererText(locale, "offlineUnavailable"));
        setBusy(null);
        return;
      }
      const queued = await onOfflineQueued(payload);
      if (queued.ok) {
        setSubmittedId(payload.clientSubmissionId);
        onSubmitted?.(payload.clientSubmissionId);
      } else {
        setNotice(queued.error ?? rendererText(locale, "offlineSaveFailed"));
      }
      setBusy(null);
      return;
    }
    const response =
      mode === "public" && slug
        ? await submitPublicFormRequest(slug, payload, draftToken)
        : await submitAssignedFormRequest(bundle.publication.id, payload);
    if (response.ok && response.data) {
      setSubmittedId(response.data.submission.id);
      if (mode === "public") {
        sessionStorage.removeItem(draftStorageKey(bundle.publication.id));
      }
      onSubmitted?.(response.data.submission.id);
    } else {
      const details = response.details;
      if (details && typeof details === "object" && !Array.isArray(details)) {
        setErrors(details as Record<string, string[]>);
      }
      setNotice(response.error ?? rendererText(locale, "submitFailed"));
    }
    setBusy(null);
  };

  if (submittedId) {
    return (
      <section className="nile-form-success" role="status" dir={direction}>
        <span>
          <CheckCircle2 size={24} />
        </span>
        <div>
          <h2>{rendererText(locale, "responseSubmitted")}</h2>
          <p>
            {mode === "offline"
              ? rendererText(locale, "offlineStored")
              : getLocalizedText(content.confirmationMessage, locale)}
          </p>
          <small>{submittedId}</small>
        </div>
      </section>
    );
  }

  if (restoreError) {
    return (
      <section
        className="nile-form-renderer nile-forms-state"
        dir={direction}
        lang={locale}
        role="alert"
      >
        <AlertCircle size={24} />
        <strong>{rendererText(locale, "draftUnavailable")}</strong>
        <p>{restoreError}</p>
        <button
          type="button"
          className="platform-secondary-button"
          onClick={() => setDraftLoadAttempt(value => value + 1)}
        >
          <RefreshCw size={15} />
          {rendererText(locale, "retry")}
        </button>
      </section>
    );
  }

  return (
    <section
      ref={rendererRef}
      className="nile-form-renderer"
      dir={direction}
      lang={locale}
    >
      <header className="nile-form-renderer-header">
        <div>
          <span className="nile-form-step">
            {locale === "ar"
              ? `الصفحة ${pageIndex + 1} من ${content.pages.length}`
              : locale === "tr"
                ? `${content.pages.length} sayfadan ${pageIndex + 1}. sayfa`
                : `Page ${pageIndex + 1} of ${content.pages.length}`}
          </span>
          <h1>{getLocalizedText(content.title, locale)}</h1>
          <p>{getLocalizedText(content.description, locale)}</p>
        </div>
        <div className="nile-form-language" role="group" aria-label="Language">
          {content.languages.map(language => (
            <button
              key={language}
              type="button"
              className={locale === language ? "is-active" : ""}
              aria-pressed={locale === language}
              onClick={() => setLocale(language)}
            >
              {language === "en" ? "EN" : language === "ar" ? "ع" : "TR"}
            </button>
          ))}
        </div>
      </header>

      <nav className="nile-form-progress" aria-label="Form pages">
        {content.pages.map((pageItem, index) => (
          <button
            key={pageItem.id}
            type="button"
            className={
              index === pageIndex
                ? "is-active"
                : index < pageIndex
                  ? "is-done"
                  : ""
            }
            aria-current={index === pageIndex ? "step" : undefined}
            disabled={index > pageIndex && mode !== "preview"}
            onClick={() =>
              (index <= pageIndex || mode === "preview") && setPageIndex(index)
            }
          >
            <span>{index < pageIndex ? <Check size={13} /> : index + 1}</span>
            <strong>{getLocalizedText(pageItem.title, locale)}</strong>
          </button>
        ))}
      </nav>

      <form
        key={`${page.id}-${locale}`}
        className="nile-form-page"
        onSubmit={submit}
        noValidate
      >
        <div className="nile-form-page-heading">
          <h2>{getLocalizedText(page.title, locale)}</h2>
          {page.description ? (
            <p>{getLocalizedText(page.description, locale)}</p>
          ) : null}
        </div>
        <div className="nile-form-fields">
          {page.fields
            .filter(field => !logic.hiddenFieldIds.has(field.id))
            .map(field => (
              <FieldControl
                key={field.id}
                field={field}
                locale={locale}
                value={displayedAnswers[field.id]}
                options={field.options ?? bundle.entityOptions[field.id]}
                required={logic.requiredFieldIds.has(field.id)}
                disabled={
                  busy !== null ||
                  mode === "preview" ||
                  calculatedTargetIds.has(field.id)
                }
                derived={calculatedTargetIds.has(field.id)}
                error={errors[field.id]?.[0]}
                onChange={value => updateAnswer(field.id, value)}
              />
            ))}
        </div>

        {notice ? (
          <p
            ref={noticeRef}
            className="nile-form-notice"
            role="status"
            tabIndex={-1}
          >
            {notice}
          </p>
        ) : null}

        <footer className="nile-form-actions">
          <button
            type="button"
            className="platform-secondary-button"
            disabled={pageIndex === 0 || busy !== null}
            onClick={() => setPageIndex(index => Math.max(0, index - 1))}
          >
            {direction === "rtl" ? (
              <ArrowRight size={16} />
            ) : (
              <ArrowLeft size={16} />
            )}
            {rendererText(locale, "back")}
          </button>
          <div>
            {mode !== "preview" &&
            mode !== "offline" &&
            bundle.publication.allowDrafts ? (
              <button
                type="button"
                className="platform-secondary-button"
                disabled={busy !== null}
                onClick={saveDraft}
              >
                <Save size={16} />
                {busy === "saving"
                  ? rendererText(locale, "saving")
                  : rendererText(locale, "saveDraft")}
              </button>
            ) : null}
            {!isLastPage ? (
              <button
                type="button"
                className="platform-primary-button"
                disabled={busy !== null}
                onClick={nextPage}
              >
                {rendererText(locale, "next")}
                {direction === "rtl" ? (
                  <ArrowLeft size={16} />
                ) : (
                  <ArrowRight size={16} />
                )}
              </button>
            ) : mode !== "preview" ? (
              <button
                type="submit"
                className="platform-primary-button"
                disabled={busy !== null}
              >
                <Send size={16} />
                {busy === "submitting"
                  ? rendererText(
                      locale,
                      mode === "offline" ? "encrypting" : "submitting"
                    )
                  : mode === "offline"
                    ? rendererText(locale, "saveForSync")
                    : getLocalizedText(content.submitLabel, locale)}
              </button>
            ) : null}
          </div>
        </footer>
      </form>
    </section>
  );
}
