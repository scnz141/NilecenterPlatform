import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { NileRosette } from "@/components/brand/NileLogo";
import { PUBLIC_COPY } from "./home/public-copy";
import { PublicChrome, usePublicLocale } from "./home/public-chrome";

/** Any unknown address: a calm way back, in the visitor's language. */
export default function NotFound() {
  const [locale, setLocale] = usePublicLocale();
  const t = PUBLIC_COPY[locale].notFound;
  return (
    <PublicChrome locale={locale} onLocaleChange={setLocale}>
      <section className="pp-missing">
        <div className="lp-wrap pp-missing-inner">
          <NileRosette size={140} bloom className="pp-missing-rosette" />
          <p className="pp-missing-code" aria-hidden="true">404</p>
          <h1 className="pp-title">{t.title}</h1>
          <p className="lp-lead">{t.text}</p>
          <div className="lp-actions lp-actions-center">
            <Link href="/" className="lp-btn" data-variant="primary" data-size="lg">
              {t.home}
              <ArrowRight className="lp-flip" aria-hidden="true" />
            </Link>
            <Link href="/courses" className="lp-btn" data-size="lg">
              {t.programmes}
            </Link>
          </div>
        </div>
      </section>
    </PublicChrome>
  );
}
