import { useRef, type ReactNode } from "react";
import { ChevronDown, Globe2 } from "lucide-react";
import { Link } from "wouter";
import {
  getDirection,
  localeOptions,
  translateUiLabel,
  type Locale,
} from "@/lib/i18n";

export type AuthExperienceVariant = "gateway" | "student" | "administration";

const visualCopy: Record<
  AuthExperienceVariant,
  { arabic: string; meaning: string; description: string }
> = {
  gateway: {
    arabic: "العلم نور",
    meaning: "Knowledge is light.",
    description: "Arabic and Quran learning, thoughtfully connected.",
  },
  student: {
    arabic: "تعلّم بصدق، وارتقِ بعلمك",
    meaning: "Learn sincerely and rise through knowledge.",
    description: "A calm place for lessons, progress, and support.",
  },
  administration: {
    arabic: "بالأمانة نبني التعليم",
    meaning: "With trust, we build education.",
    description: "One dependable workspace for teaching and school operations.",
  },
};

export function AuthLanguageMenu({
  locale,
  onChange,
}: {
  locale: Locale;
  onChange: (locale: Locale) => void;
}) {
  const menuRef = useRef<HTMLDetailsElement>(null);
  const current = localeOptions.find(option => option.value === locale);
  const ui = (label: string) => translateUiLabel(locale, label);

  return (
    <details className="auth-v2-language" ref={menuRef}>
      <summary aria-label={ui("Language")}>
        <Globe2 size={16} aria-hidden="true" />
        <span>{current?.label ?? "English"}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </summary>
      <div className="auth-v2-language-menu" role="menu">
        {localeOptions.map(option => (
          <button
            type="button"
            role="menuitemradio"
            aria-checked={option.value === locale}
            className={option.value === locale ? "active" : ""}
            key={option.value}
            onClick={() => {
              onChange(option.value);
              menuRef.current?.removeAttribute("open");
            }}
          >
            <span>{option.label}</span>
            <small>{option.value.toUpperCase()}</small>
          </button>
        ))}
      </div>
    </details>
  );
}

export function AuthExperience({
  variant,
  locale,
  onLocaleChange,
  children,
}: {
  variant: AuthExperienceVariant;
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  children: ReactNode;
}) {
  const copy = visualCopy[variant];
  const ui = (label: string) => translateUiLabel(locale, label);

  return (
    <main
      className={`auth-v2-page auth-v2-${variant}`}
      dir={getDirection(locale)}
      lang={locale}
    >
      <section className="auth-v2-visual" aria-label={ui(copy.description)}>
        <div className="auth-v2-visual-shade" aria-hidden="true" />
        <Link href="/" className="auth-v2-brand auth-v2-brand-light">
          <span aria-hidden="true">ن</span>
          <span>
            <strong>Nile Learn</strong>
            <small>Nile Center</small>
          </span>
        </Link>

        <div className="auth-v2-calligraphy">
          <p lang="ar" dir="rtl">
            {copy.arabic}
          </p>
          <strong>{ui(copy.meaning)}</strong>
          <span>{ui(copy.description)}</span>
        </div>

        <p className="auth-v2-visual-note">Nile Center · Nile Learn</p>
      </section>

      <section className="auth-v2-surface">
        <header className="auth-v2-surface-header">
          <Link href="/" className="auth-v2-brand auth-v2-brand-dark">
            <span aria-hidden="true">ن</span>
            <span>
              <strong>Nile Learn</strong>
              <small>Nile Center</small>
            </span>
          </Link>
          <AuthLanguageMenu locale={locale} onChange={onLocaleChange} />
        </header>
        <div className="auth-v2-content">
          <span className="auth-v2-landing-mark" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          {children}
        </div>
      </section>
    </main>
  );
}
