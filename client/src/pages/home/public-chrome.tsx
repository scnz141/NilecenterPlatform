import "@/styles/landing.css";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { ArrowRight, Check, ChevronDown, Globe2, Menu, X } from "lucide-react";
import { NileLogo } from "@/components/brand/NileLogo";
import { LANDING_COPY, LANDING_LOCALES, RTL_LOCALES, type LandingCopy, type LandingLocale } from "./landing-copy";

/** Shared pieces of every public page: language, header, footer, petals. */
export const PETAL_COLOURS = ["#406687", "#71adab", "#80b4d7", "#c35d44", "#41714c", "#79689d", "#75c1cc", "#c35d44"];
const PETAL = "50,29.1 58.9,20.2 58.9,4.1 50,0 41.1,4.1 41.1,20.2";
export const PHONE_ONSITE = "+20 109 566 1266";
export const PHONE_ONLINE = "+20 102 178 7789";
export const EMAIL = "info@nilecenter.edu.eg";
export const whatsapp = (phone: string) => `https://wa.me/${phone.replace(/\D/g, "")}`;

const STORAGE_KEY = "nilelearn.locale";

function readLocale(): LandingLocale {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return LANDING_LOCALES.includes(stored as LandingLocale) ? (stored as LandingLocale) : "en";
  } catch {
    return "en";
  }
}

/** Language for public pages; shares the site-wide preference and sets lang/dir. */
export function usePublicLocale() {
  const [locale, setLocale] = useState<LandingLocale>(readLocale);
  useEffect(() => {
    const root = document.documentElement;
    const previous = { lang: root.lang, dir: root.dir };
    root.lang = locale;
    root.dir = RTL_LOCALES.includes(locale) ? "rtl" : "ltr";
    return () => {
      root.lang = previous.lang;
      root.dir = previous.dir;
    };
  }, [locale]);
  const choose = (next: LandingLocale) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* preference only */
    }
    setLocale(next);
  };
  return [locale, choose] as const;
}

/** Khatam lattice: the eight-point star of Cairene mashrabiya screens. */
const KHATAM_STAR = "30.00,11.00 33.01,22.73 43.44,16.56 37.27,26.99 49.00,30.00 37.27,33.01 43.44,43.44 33.01,37.27 30.00,49.00 26.99,37.27 16.56,43.44 22.73,33.01 11.00,30.00 22.73,26.99 16.56,16.56 26.99,22.73";
const KHATAM_LINES = "M30 11.00V0M30 49.00V60M11.00 30H0M49.00 30H60M43.44 16.56L60 0M16.56 16.56L0 0M43.44 43.44L60 60M16.56 43.44L0 60";

export function Lattice({ className, scale = 1.9 }: { className?: string; scale?: number }) {
  const id = useId();
  return (
    <svg className={className} width="100%" height="100%" aria-hidden="true" focusable="false">
      <defs>
        <pattern id={id} width="60" height="60" patternUnits="userSpaceOnUse" patternTransform={`translate(-14 -30) scale(${scale})`}>
          <polygon points={KHATAM_STAR} />
          <path d={KHATAM_LINES} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

export function Petal({ colour, className }: { colour: string; className?: string }) {
  return (
    <svg viewBox="40 -1 20 31" className={className} aria-hidden="true" focusable="false">
      <polygon points={PETAL} fill={colour} />
    </svg>
  );
}

/**
 * Language menu: the current language as quiet text; opens a short list with
 * each language written in its own script. Lives in the top utility bar and
 * the footer, never in the main header.
 */
function LanguageMenu({
  locale,
  onChange,
  label,
  tone = "dark",
  align = "end",
}: {
  locale: LandingLocale;
  onChange: (value: LandingLocale) => void;
  label: string;
  tone?: "dark" | "light";
  align?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const items = () => Array.from(root.current?.querySelectorAll<HTMLButtonElement>("[role=menuitemradio]") ?? []);
    (items().find(item => item.getAttribute("aria-checked") === "true") ?? items()[0])?.focus();
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
        return;
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      event.preventDefault();
      const list = items();
      const index = list.indexOf(document.activeElement as HTMLButtonElement);
      list[(index + (event.key === "ArrowDown" ? 1 : list.length - 1)) % list.length]?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="lp-langmenu" data-tone={tone} data-align={align} ref={root}>
      <button
        ref={trigger}
        type="button"
        className="lp-langmenu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`${label}: ${LANDING_COPY[locale].langName}`}
        onClick={() => setOpen(value => !value)}
      >
        <Globe2 aria-hidden="true" />
        <span lang={locale}>{LANDING_COPY[locale].langName}</span>
        <ChevronDown className="lp-langmenu-caret" aria-hidden="true" />
      </button>
      {open ? (
        <div id={menuId} className="lp-langmenu-list" role="menu" aria-label={label}>
          {LANDING_LOCALES.map(value => (
            <button
              key={value}
              type="button"
              role="menuitemradio"
              aria-checked={locale === value}
              lang={value}
              onClick={() => {
                onChange(value);
                setOpen(false);
                trigger.current?.focus();
              }}
            >
              <span>{LANDING_COPY[value].langName}</span>
              {locale === value ? <Check aria-hidden="true" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Counts a figure up once when it scrolls into view; years and reduced motion stay still. */
export function CountUp({ value, locale }: { value: string; locale: LandingLocale }) {
  const ref = useRef<HTMLSpanElement>(null);
  const match = value.match(/^(\+?)([\d.,]+)(\+?)$/);
  const target = match ? Number(match[2].replace(/[.,]/g, "")) : NaN;
  const animate = Number.isFinite(target) && !/^(19|20)\d\d$/.test(value);
  const [shown, setShown] = useState(value);
  useEffect(() => {
    const node = ref.current;
    if (!node || !animate || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const format = (n: number) =>
      `${match?.[1] ?? ""}${new Intl.NumberFormat(RTL_LOCALES.includes(locale) ? "en" : locale).format(n)}${match?.[3] ?? ""}`;
    setShown(format(0));
    let frame = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / 1200);
          const eased = 1 - Math.pow(1 - t, 3);
          setShown(t === 1 ? value : format(Math.round(target * eased)));
          if (t < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.6 }
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, locale]);
  return (
    <span ref={ref} aria-label={value}>
      <span aria-hidden="true">{shown}</span>
    </span>
  );
}

/** Header, notice, mobile menu, and footer around any public page. */
export function PublicChrome({
  locale,
  onLocaleChange,
  children,
}: {
  locale: LandingLocale;
  onLocaleChange: (value: LandingLocale) => void;
  children: ReactNode;
}) {
  const t: LandingCopy = LANDING_COPY[locale];
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const nav = [
    { href: "/courses", label: t.nav.programmes },
    { href: "/#start", label: t.nav.start },
    { href: "/about", label: t.footer.about },
    { href: "/contact", label: t.nav.contact },
  ];
  const navLink = (item: { href: string; label: string }, onClick?: () => void) =>
    item.href.includes("#") ? (
      <a key={item.href} href={item.href} onClick={onClick}>
        {item.label}
      </a>
    ) : (
      <Link key={item.href} href={item.href} onClick={onClick}>
        {item.label}
      </Link>
    );

  return (
    <div className="lp" data-locale={locale}>
      <a className="lp-skip" href="#lp-main">
        {t.nav.skip}
      </a>
      <div className="lp-notice">
        <div className="lp-wrap lp-notice-row">
          <Link href="/book-placement-test" className="lp-notice-link">
            <span className="lp-dot" aria-hidden="true" />
            <span>{t.notice}</span>
            <ArrowRight className="lp-flip" aria-hidden="true" />
          </Link>
          <LanguageMenu locale={locale} onChange={onLocaleChange} label={t.nav.language} />
        </div>
      </div>

      <header className="lp-header" data-scrolled={scrolled || undefined}>
        <div className="lp-wrap lp-header-row">
          <Link href="/" className="lp-brand" aria-label="Nile Center">
            <NileLogo height={38} />
          </Link>
          <nav className="lp-nav" aria-label={t.nav.menu}>
            {nav.map(item => navLink(item))}
          </nav>
          <div className="lp-header-tools">
            <Link href="/auth/login" className="lp-link-quiet">
              {t.nav.signIn}
            </Link>
            <Link href="/book-free-trial" className="lp-btn" data-variant="primary">
              {t.hero.trial}
            </Link>
          </div>
          <button
            type="button"
            className="lp-menu-btn"
            aria-expanded={menuOpen}
            aria-controls="lp-mobile-menu"
            aria-label={menuOpen ? t.nav.close : t.nav.menu}
            onClick={() => setMenuOpen(open => !open)}
          >
            {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
        <div id="lp-mobile-menu" className="lp-mobile" hidden={!menuOpen}>
          <nav className="lp-wrap lp-mobile-nav" aria-label={t.nav.menu}>
            {nav.map(item => navLink(item, () => setMenuOpen(false)))}
            <Link href="/auth/login" onClick={() => setMenuOpen(false)}>
              {t.nav.signIn}
            </Link>
            <Link href="/book-free-trial" className="lp-btn" data-variant="primary" onClick={() => setMenuOpen(false)}>
              {t.hero.trial}
            </Link>
          </nav>
        </div>
      </header>

      <main id="lp-main">{children}</main>

      <footer className="lp-footer">
        <div className="lp-wrap lp-footer-grid">
          <div className="lp-footer-brand">
            <NileLogo height={44} />
            <p>{t.footer.tagline}</p>
            <LanguageMenu locale={locale} onChange={onLocaleChange} label={t.nav.language} tone="light" align="start" />
          </div>
          <nav aria-label={t.footer.programmes}>
            <h2>{t.footer.programmes}</h2>
            <ul>
              {t.programmes.items.slice(0, 6).map(item => (
                <li key={item.slug}>
                  <Link href={`/courses/${item.slug}`}>{item.name}</Link>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label={t.footer.school}>
            <h2>{t.footer.school}</h2>
            <ul>
              <li><Link href="/about">{t.footer.about}</Link></li>
              <li><Link href="/faq">{t.footer.faq}</Link></li>
              <li><Link href="/verify-certificate">{t.footer.verify}</Link></li>
              <li><Link href="/privacy">{t.footer.privacy}</Link></li>
              <li><Link href="/terms">{t.footer.terms}</Link></li>
              <li><Link href="/auth/administration-login">{t.footer.staff}</Link></li>
            </ul>
          </nav>
          <div>
            <h2>{t.footer.contact}</h2>
            <ul>
              <li>
                <span className="lp-footer-label">{t.modes.campus.phoneLabel}</span>
                <a href={whatsapp(PHONE_ONSITE)} target="_blank" rel="noreferrer"><bdi>{PHONE_ONSITE}</bdi></a>
              </li>
              <li>
                <span className="lp-footer-label">{t.modes.online.phoneLabel}</span>
                <a href={whatsapp(PHONE_ONLINE)} target="_blank" rel="noreferrer"><bdi>{PHONE_ONLINE}</bdi></a>
              </li>
              <li>
                <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
              </li>
            </ul>
          </div>
        </div>
        <div className="lp-wrap lp-footer-base">
          <span>© {new Date().getFullYear()} {t.footer.rights}</span>
          <span className="lp-footer-where">{t.where}</span>
        </div>
      </footer>
    </div>
  );
}
