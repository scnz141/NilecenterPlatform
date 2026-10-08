/**
 * NILE CENTER — HOME
 * Built on Cairo itself: the hero is a Cairene arch and mashrabiya, with the
 * headline written on the plaster wall beside it. The rosette stays the
 * brand mark (header, footer, closing band), and its petal colours tag
 * programmes and steps. English, Arabic and Turkish; Arabic is RTL.
 *
 * Motion (all in landing.css, all off under reduced motion): the hero image
 * settles once and drifts slower than the page; "العلم نور" writes itself
 * right to left as it scrolls into view; sections rise into place; figures
 * count up once; the learner quote cross-fades when you pick a name.
 */
import { useState, type CSSProperties } from "react";
import { Link } from "wouter";
import { ArrowRight, ArrowUpRight, Globe2, MapPin, MessageCircle, Phone } from "lucide-react";
import { LANDING_COPY } from "./home/landing-copy";
import {
  CountUp,
  Lattice,
  PETAL_COLOURS,
  PHONE_ONLINE,
  PHONE_ONSITE,
  Petal,
  PublicChrome,
  usePublicLocale,
  whatsapp,
} from "./home/public-chrome";

const vars = (values: Record<string, string | number>) => values as CSSProperties;
const ARCH = "/home/cairo-arch-1600.webp";
const ARCH_SMALL = "/home/cairo-arch-960.webp";

export default function Home() {
  const [locale, setLocale] = usePublicLocale();
  const t = LANDING_COPY[locale];
  const digits = (n: number, pad = 1) =>
    new Intl.NumberFormat(locale === "ar" ? "ar-EG" : locale, { minimumIntegerDigits: pad }).format(n);
  const [quote, setQuote] = useState(0);
  const active = t.quotes.items[quote] ?? t.quotes.items[0];

  return (
    <PublicChrome locale={locale} onLocaleChange={setLocale}>
      {/* Hero: the arch, with the headline on the wall beside it */}
      <section className="lh-hero">
        <picture className="lh-hero-media">
          <source media="(max-width: 899px)" srcSet={ARCH_SMALL} />
          <img src={ARCH} alt="" width={1600} height={1000} fetchPriority="high" decoding="async" />
        </picture>
        <div className="lp-wrap lh-hero-inner">
          <div className="lh-hero-copy">
            <p className="lp-eyebrow lp-stagger" style={vars({ "--d": 0 })}>
              {t.hero.eyebrow}
            </p>
            <h1 className="lp-display lp-stagger" style={vars({ "--d": 1 })}>
              <span>{t.hero.line1}</span> <span>{t.hero.line2}</span> <em>{t.hero.accent}</em>
            </h1>
            <p className="lp-lead lp-stagger" style={vars({ "--d": 2 })}>
              {t.hero.lead}
            </p>
            <div className="lp-actions lp-stagger" style={vars({ "--d": 3 })}>
              <Link href="/book-free-trial" className="lp-btn" data-variant="primary" data-size="lg">
                {t.hero.trial}
                <ArrowRight className="lp-flip" aria-hidden="true" />
              </Link>
              <Link href="/book-placement-test" className="lp-btn" data-size="lg">
                {t.hero.placement}
              </Link>
            </div>
            <p className="lp-note lp-stagger" style={vars({ "--d": 4 })}>
              {t.hero.note}
            </p>
          </div>
        </div>
      </section>

      <div className="lp-wrap">
        <dl className="lp-stats lh-stats">
          {t.stats.map(stat => (
            <div key={stat.label}>
              <dt>{stat.label}</dt>
              <dd>
                <CountUp value={stat.value} locale={locale} />
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Knowledge is light */}
      <section className="lh-wisdom" aria-labelledby="lh-wisdom-title">
        <div className="lp-wrap lh-wisdom-inner">
          <p className="lh-wisdom-ar" lang="ar" dir="rtl" aria-hidden={locale === "ar" || undefined}>
            العلم نور
          </p>
          <div className="lh-wisdom-copy lp-reveal">
            <h2 id="lh-wisdom-title" className="lh-wisdom-meaning">
              {t.wisdom.meaning}
            </h2>
            <p>{t.wisdom.text}</p>
          </div>
        </div>
      </section>

      {/* Programmes: an index, not a wall of cards */}
      <section id="programmes" className="lp-section lh-programmes">
        <div className="lp-wrap">
          <div className="lp-section-head lp-reveal">
            <div>
              <h2 className="lp-h2">{t.programmes.title}</h2>
              <p className="lp-section-lead">{t.programmes.lead}</p>
            </div>
            <Link href="/courses" className="lp-link-arrow">
              {t.programmes.all}
              <ArrowUpRight className="lp-flip" aria-hidden="true" />
            </Link>
          </div>
          <ol className="lh-index">
            {t.programmes.items.map((item, index) => (
              <li key={item.slug} className="lp-reveal" style={vars({ "--r": index % 2 })}>
                <Link href={`/courses/${item.slug}`} className="lh-index-row" style={vars({ "--tone": PETAL_COLOURS[index] })}>
                  <span className="lh-index-num">{digits(index + 1, 2)}</span>
                  <span className="lh-index-name">
                    <Petal colour={PETAL_COLOURS[index]} className="lh-index-petal" />
                    {item.name}
                  </span>
                  <span className="lh-index-desc">{item.desc}</span>
                  <span className="lh-index-meta">{item.meta}</span>
                  <ArrowRight className="lh-index-arrow lp-flip" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* How we teach, beside the mashrabiya */}
      <section className="lp-section lp-section-tint">
        <div className="lp-wrap lh-teach">
          <div className="lh-lattice" aria-hidden="true">
            <Lattice />
          </div>
          <div>
            <div className="lp-reveal">
              <h2 className="lp-h2">{t.teach.title}</h2>
              <p className="lp-section-lead">{t.teach.lead}</p>
            </div>
            <ol className="lp-teach-list lh-teach-list">
              {t.teach.items.map((item, index) => (
                <li key={item.title} className="lp-teach-item lp-reveal" style={vars({ "--r": index })}>
                  <Petal colour={PETAL_COLOURS[[0, 4, 3][index]]} className="lh-teach-petal" />
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* How to start */}
      <section id="start" className="lp-section">
        <div className="lp-wrap">
          <div className="lp-section-head lp-reveal">
            <div>
              <h2 className="lp-h2">{t.start.title}</h2>
              <p className="lp-section-lead">{t.start.lead}</p>
            </div>
          </div>
          <ol className="lp-steps">
            {t.start.steps.map((step, index) => (
              <li key={step.title} className="lp-step lp-reveal" style={vars({ "--r": index })}>
                <span className="lp-step-mark" style={vars({ "--tone": PETAL_COLOURS[[0, 2, 4, 3][index]] })}>
                  {digits(index + 1)}
                </span>
                <h3 className="lp-step-title">{step.title}</h3>
                <p className="lp-step-text">{step.text}</p>
              </li>
            ))}
          </ol>
          <div className="lp-actions lp-actions-center">
            <Link href="/book-free-trial" className="lp-btn" data-variant="primary" data-size="lg">
              {t.hero.trial}
              <ArrowRight className="lp-flip" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* Online and campus */}
      <section id="modes" className="lp-section lp-section-tint">
        <div className="lp-wrap">
          <div className="lp-section-head lp-reveal">
            <div>
              <h2 className="lp-h2">{t.modes.title}</h2>
              <p className="lp-section-lead">{t.modes.lead}</p>
            </div>
          </div>
          <div className="lp-modes">
            {(["online", "campus"] as const).map((kind, index) => {
              const mode = t.modes[kind];
              const phone = kind === "online" ? PHONE_ONLINE : PHONE_ONSITE;
              return (
                <article key={kind} className="lp-mode lp-reveal" data-kind={kind} style={vars({ "--r": index })}>
                  <p className="lh-mode-kind">
                    {kind === "online" ? <Globe2 aria-hidden="true" /> : <MapPin aria-hidden="true" />}
                    {mode.phoneLabel}
                  </p>
                  <h3 className="lp-mode-title">{mode.title}</h3>
                  <p className="lp-mode-text">{mode.text}</p>
                  <ul className="lp-mode-points">
                    {mode.points.map(point => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                  <a className="lp-mode-phone" href={whatsapp(phone)} target="_blank" rel="noreferrer">
                    <Phone aria-hidden="true" />
                    <bdi>{phone}</bdi>
                  </a>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* One learner at a time */}
      <section className="lp-section lh-voice" aria-labelledby="lh-voice-title">
        <div className="lp-wrap lh-voice-inner">
          <h2 id="lh-voice-title" className="lh-voice-title lp-reveal">
            {t.quotes.title}
          </h2>
          <figure
            className="lh-voice-quote"
            key={`${locale}-${quote}`}
            aria-live="polite"
            style={vars({ "--tone": PETAL_COLOURS[[3, 1, 5][quote] ?? 3] })}
          >
            <blockquote>{active.text}</blockquote>
            <figcaption>
              <strong>{active.name}</strong> · {active.context}
            </figcaption>
          </figure>
          <div className="lh-voice-pick" role="group" aria-label={t.quotes.title}>
            {t.quotes.items.map((item, index) => (
              <button
                key={item.name}
                type="button"
                aria-pressed={quote === index}
                data-on={quote === index || undefined}
                onClick={() => setQuote(index)}
              >
                <span className="lh-voice-initial" aria-hidden="true" style={vars({ "--tone": PETAL_COLOURS[[3, 1, 5][index]] })}>
                  {item.name.slice(0, 1)}
                </span>
                <span>
                  <strong>{item.name}</strong>
                  <small>{item.context}</small>
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Call to action */}
      <section className="lp-cta">
        <Lattice className="lp-cta-lattice" scale={2.4} />
        <div className="lp-wrap lp-cta-inner lp-reveal">
          <h2 className="lp-h2 lp-cta-title">{t.cta.title}</h2>
          <p className="lp-cta-text">{t.cta.text}</p>
          <div className="lp-actions">
            <Link href="/book-free-trial" className="lp-btn" data-variant="accent" data-size="lg">
              {t.cta.trial}
              <ArrowRight className="lp-flip" aria-hidden="true" />
            </Link>
            <a href={whatsapp(PHONE_ONSITE)} target="_blank" rel="noreferrer" className="lp-btn" data-variant="ghost" data-size="lg">
              <MessageCircle aria-hidden="true" />
              {t.cta.whatsapp}
            </a>
          </div>
        </div>
      </section>
    </PublicChrome>
  );
}
