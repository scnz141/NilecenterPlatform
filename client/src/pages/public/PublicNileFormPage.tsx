import { useEffect, useState } from "react";
import { ArrowLeft, FileText, RefreshCw, ShieldCheck } from "lucide-react";
import { Link } from "wouter";

import { NileLogo, NileRosette } from "@/components/brand/NileLogo";
import NileFormRenderer from "@/components/forms/NileFormRenderer";
import { fetchPublicForm } from "@/lib/forms/api";
import {
  getLocalizedText,
  type FormLocale,
} from "@shared/nileForms";
import type { FormResponderBundle } from "../../../../server/nileFormsService";

/** Page chrome around the form, in the language the visitor picks inside it. */
const CHROME: Record<FormLocale, Record<"back" | "loading" | "unavailable" | "retry" | "home" | "eyebrow" | "private", string>> = {
  en: {
    back: "Nile Center",
    loading: "Loading form",
    unavailable: "Form unavailable",
    retry: "Retry",
    home: "Return to Nile Center",
    eyebrow: "Nile Center",
    private: "Your answers go only to the Nile Center team.",
  },
  ar: {
    back: "مركز النيل",
    loading: "جارٍ تحميل الاستمارة",
    unavailable: "الاستمارة غير متاحة",
    retry: "إعادة المحاولة",
    home: "العودة إلى مركز النيل",
    eyebrow: "مركز النيل",
    private: "تصل إجاباتك إلى فريق مركز النيل فقط.",
  },
  tr: {
    back: "Nil Merkezi",
    loading: "Form yükleniyor",
    unavailable: "Form kullanılamıyor",
    retry: "Yeniden dene",
    home: "Nil Merkezi'ne dön",
    eyebrow: "Nil Merkezi",
    private: "Yanıtlarınız yalnızca Nil Merkezi ekibine ulaşır.",
  },
};

export default function PublicNileFormPage({ slug }: { slug: string }) {
  const [bundle, setBundle] = useState<FormResponderBundle | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [locale, setLocale] = useState<FormLocale>("en");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setStatus("loading");
      setError("");
      const response = await fetchPublicForm(slug);
      if (cancelled) return;
      if (!response.ok || !response.data) {
        setStatus("error");
        setError(response.error ?? "This form is not available.");
        return;
      }
      setBundle(response.data);
      setLocale(response.data.version.content.defaultLanguage);
      setStatus("ready");
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [reload, slug]);

  const t = CHROME[locale] ?? CHROME.en;
  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    <main className="nile-public-form-page" lang={locale} dir={dir}>
      <header className="nile-public-form-header">
        <Link href="/" className="nile-public-form-brand" aria-label="Nile Center">
          <NileLogo height={34} />
        </Link>
        <Link href="/" className="nile-public-form-back">
          <ArrowLeft size={15} className="nile-public-form-flip" aria-hidden="true" /> {t.back}
        </Link>
      </header>

      {status === "loading" ? (
        <section className="nile-public-form-state" aria-live="polite">
          <span className="nile-forms-spinner" />
          <strong>{t.loading}</strong>
        </section>
      ) : status === "error" || !bundle ? (
        <section className="nile-public-form-state" role="alert">
          <FileText size={28} aria-hidden="true" />
          <h1>{t.unavailable}</h1>
          <p>{error}</p>
          <div>
            <button type="button" className="platform-secondary-button" onClick={() => setReload(value => value + 1)}>
              <RefreshCw size={15} aria-hidden="true" /> {t.retry}
            </button>
            <Link href="/" className="platform-primary-button">
              {t.home}
            </Link>
          </div>
        </section>
      ) : (
        <div className="nile-public-form-layout">
          <aside className="nile-public-form-context">
            <NileRosette size={44} className="nile-public-form-rosette" />
            <span className="nile-forms-eyebrow">{t.eyebrow}</span>
            <h2>{getLocalizedText(bundle.version.content.title, locale)}</h2>
            <p>{getLocalizedText(bundle.version.content.description, locale)}</p>
            <ul className="nile-public-form-promises">
              <li>
                <ShieldCheck size={16} aria-hidden="true" />
                {t.private}
              </li>
            </ul>
          </aside>
          <NileFormRenderer bundle={bundle} mode="public" slug={slug} onLocaleChange={setLocale} />
        </div>
      )}
    </main>
  );
}
