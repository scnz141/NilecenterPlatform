/**
 * NILE CENTER — HOME PAGE
 * Design: broadsheet prospectus. Editorial rules, numbered sections, a real
 * course index, and Arabic as content — not decoration.
 * - Warm paper canvas (#F7F5F0), charcoal ink, hairline rules
 * - Instrument Serif display, Noto Naskh Arabic labels, Aref Ruqaa calligraphy
 * - No stock imagery: the calligraphy frame and course index carry the page
 * - Every link resolves to a real route
 */

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, ArrowUpRight, Menu, X } from "lucide-react";

const SERIF = "'Instrument Serif', 'Georgia', serif";
const NASKH = "'Noto Naskh Arabic', 'Amiri', serif";
const RUQAA = "'Aref Ruqaa', 'Noto Naskh Arabic', serif";

// ─── Data ─────────────────────────────────────────────────────────────────────

const PROGRAMMES = [
  {
    n: "01",
    slug: "quran",
    name: "Quran Courses",
    ar: "دورات القرآن",
    desc: "Quran for Beginners, Tajweed, Hifz, Juz' Amma, Ijāzah, 7th & 10 Qira'at, Tuhfatul Atfaal, Matn al-Jazariyya, Maqamat Sawteya.",
    level: "Beginner — Ijāzah path",
    rhythm: "Live online & onsite",
  },
  {
    n: "02",
    slug: "arabic",
    name: "Arabic Courses",
    ar: "دورات العربية",
    desc: "Modern Standard (Fusha), Egyptian Ammiyya, Conversation, Al-Nahv Al-Wadih, Practical Grammar, At-Takallum.",
    level: "A1 — advanced",
    rhythm: "Morning, afternoon & evening",
  },
  {
    n: "03",
    slug: "islamic-studies",
    name: "Islamic Studies",
    ar: "الدراسات الإسلامية",
    desc: "Quranic Arabic and guided foundations of Islamic studies.",
    level: "Foundations — intermediate",
    rhythm: "Weekly live cohorts",
  },
  {
    n: "04",
    slug: "calligraphy",
    name: "Arabic Calligraphy",
    ar: "الخط العربي",
    desc: "Naskh, Thuluth, and Ruq'ah hands — pen, ink, and discipline.",
    level: "All levels",
    rhythm: "Onsite studios",
  },
  {
    n: "05",
    slug: "kids",
    name: "Kids Programme",
    ar: "برامج الأطفال",
    desc: "Quran, Arabic, and Islamic studies pathways built for young learners.",
    level: "Ages 5 — 14",
    rhythm: "After school & weekends",
  },
  {
    n: "06",
    slug: "turkish",
    name: "Turkish",
    ar: "اللغة التركية",
    desc: "Modern Turkish for study, travel, and daily communication.",
    level: "A1 — B2",
    rhythm: "Small group classes",
  },
  {
    n: "07",
    slug: "enterprise",
    name: "Enterprises & Communities",
    ar: "المؤسسات والمجتمعات",
    desc: "Language and cultural programmes for schools, companies, mosques, and community groups.",
    level: "Custom cohorts",
    rhythm: "Designed with you",
  },
  {
    n: "08",
    slug: "home-schooling",
    name: "Home Schooling & Summer Camps",
    ar: "التعليم المنزلي والمخيمات",
    desc: "Structured home-school support and seasonal camps for young learners.",
    level: "Children & teens",
    rhythm: "Term-time & summer",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Placement test",
    text: "A free placement test sets your level before you pay anything.",
    href: "/book-placement-test",
    action: "Book a placement test",
  },
  {
    n: "02",
    title: "Free trial lesson",
    text: "Sit a real lesson with a certified teacher — online or on campus — before you decide.",
    href: "/book-free-trial",
    action: "Book a free trial",
  },
  {
    n: "03",
    title: "Your schedule",
    text: "Morning, afternoon, and evening groups — the registrar matches class, teacher, and branch.",
    href: "/courses",
    action: "See programmes",
  },
  {
    n: "04",
    title: "Certification",
    text: "An official certificate on completion — recognised by partner institutions and verifiable online.",
    href: "/verify-certificate",
    action: "Verify a certificate",
  },
];

const PRINCIPLES = [
  {
    n: "1",
    title: "A plan built to your level",
    text: "Enrolment is open to every age and level — absolute beginner to Ijāzah candidate. Each student gets a personalised learning plan.",
  },
  {
    n: "2",
    title: "Live, interactive, flexible",
    text: "Live interactive sessions with instructors plus recorded lectures on the platform — morning, afternoon, and evening groups.",
  },
  {
    n: "3",
    title: "Progress on record",
    text: "Structured lesson management and progress tracking. Your LMS account and digital materials are included at no extra cost.",
  },
];

const QUOTES = [
  {
    text: "The expert instructors guided me through the full Qur'anic memorisation programme in eight months — I proudly received my Ijāzah and teach beginner classes back home.",
    name: "Ahmed",
    context: "Hifz & Ijāzah graduate, UAE",
  },
  {
    text: "I went from zero Arabic to fluent conversation in just six months — and even delivered a live presentation in Cairo.",
    name: "Sarah",
    context: "Arabic, United Kingdom",
  },
  {
    text: "With personalised coaching and interactive lessons I mastered Egyptian Colloquial in three months — daily life in Cairo without hesitation.",
    name: "Yasmine",
    context: "Egyptian Ammiyya, Turkey",
  },
];

const PORTALS = [
  { role: "Student", desc: "Courses, grades, attendance, certificates", href: "/app/student/dashboard" },
  { role: "Teacher", desc: "Classes, attendance, grading, feedback", href: "/app/teacher/dashboard" },
  { role: "Registrar", desc: "Admissions, enrolment, payments", href: "/app/registrar/dashboard" },
  { role: "Head of Department", desc: "Curriculum, staff, approvals", href: "/app/hod/dashboard" },
  { role: "Branch Admin", desc: "Rooms, schedules, branch operations", href: "/app/branch/dashboard" },
  { role: "Super Admin", desc: "Roles, integrations, audit", href: "/app/admin/dashboard" },
];

// ─── Primitives ───────────────────────────────────────────────────────────────

function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, delay, ease: [0.23, 1, 0.32, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function SectionHeader({ index, title, aside }: { index: string; title: string; aside?: React.ReactNode }) {
  return (
    <div className="relative flex items-end justify-between gap-6 pb-4 md:pb-5">
      <div className="flex items-baseline gap-3 md:gap-4 min-w-0">
        <span
          className="text-[13px] italic leading-none text-[#9A8878] tabular-nums shrink-0"
          style={{ fontFamily: SERIF }}
        >
          {index}
        </span>
        <h2
          className="text-[clamp(1.9rem,4vw,3rem)] leading-[1.02] tracking-tight text-[#1A1A1A]"
          style={{ fontFamily: SERIF }}
        >
          {title}
        </h2>
      </div>
      {aside ? <div className="shrink-0 pb-1">{aside}</div> : null}
      {/* rule draws in; a gold star rides its origin */}
      <motion.div
        aria-hidden="true"
        className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#1A1A1A] origin-left"
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.9, ease: [0.23, 1, 0.32, 1] }}
      />
      <Khatam className="absolute -bottom-[5px] left-0 w-[10px] h-[10px] text-[#C4A35A]" />
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[#9A8878]">
      {children}
    </p>
  );
}

/** Eight-pointed khatam star — the page's single ornament. */
function Khatam({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className={className}>
      <rect x="3.5" y="3.5" width="9" height="9" />
      <rect x="3.5" y="3.5" width="9" height="9" transform="rotate(45 8 8)" />
    </svg>
  );
}

/** Faint paper grain over the whole canvas — kills the flat digital look. */
function PaperGrain() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[60] opacity-[0.05]"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E")`,
      }}
    />
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 24);
    handler();
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <div className="min-h-screen bg-[#F7F5F0] text-[#1A1A1A] font-sans overflow-x-clip">
      <PaperGrain />

      {/* ── Notice strip ─────────────────────────────────────────────── */}
      <div className="bg-[#1A1A1A] text-[#F7F5F0]">
        <div className="max-w-[1280px] mx-auto px-5 md:px-6 h-9 flex items-center justify-between gap-4 text-[12px]">
          <Link
            href="/book-placement-test"
            className="group flex items-center gap-2 min-w-0 hover:text-white transition-colors"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#C4A35A] shrink-0" />
            <span className="truncate">
              Admissions open — placement tests and trial lessons are free
            </span>
            <ArrowRight size={12} className="shrink-0 opacity-60 group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <span className="hidden sm:block text-[#F7F5F0]/50 tracking-wide shrink-0">
            Nasr City, Cairo · Live online
          </span>
        </div>
      </div>

      {/* ── Nav ──────────────────────────────────────────────────────── */}
      <header
        className={`sticky top-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-[#F7F5F0]/95 backdrop-blur-md border-b border-[#E8E2D8]"
            : "bg-[#F7F5F0] border-b border-transparent"
        }`}
      >
        <div className="max-w-[1280px] mx-auto px-5 md:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-md bg-[#1A1A1A] flex items-center justify-center">
              <span className="text-[#F7F5F0] text-[16px] leading-none pb-0.5" style={{ fontFamily: NASKH }}>ن</span>
            </span>
            <span className="font-semibold text-[15px] tracking-tight">Nile Center</span>
          </Link>

          <nav className="hidden md:flex items-center gap-7">
            {[
              { label: "Catalogue", href: "/courses" },
              { label: "About", href: "/about" },
              { label: "Free trial", href: "/book-free-trial" },
              { label: "Contact", href: "/contact" },
            ].map(item => (
              <Link
                key={item.label}
                href={item.href}
                className="text-[14px] text-[#5A5A5A] hover:text-[#1A1A1A] transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-5">
            <Link href="/auth/login" className="text-[14px] text-[#5A5A5A] hover:text-[#1A1A1A] transition-colors">
              Sign in
            </Link>
            <Link
              href="/book-free-trial"
              className="bg-[#1A1A1A] text-[#F7F5F0] text-[13px] font-medium px-4 py-2 rounded-md hover:bg-[#2A2A2A] transition-colors"
            >
              Book a free trial
            </Link>
          </div>

          <button
            className="md:hidden p-2 -mr-2"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <AnimatePresence>
          {menuOpen && (
            <motion.nav
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="md:hidden overflow-hidden bg-[#F7F5F0] border-b border-[#E8E2D8]"
            >
              <div className="px-5 py-4 flex flex-col">
                {[
                  { label: "Catalogue", href: "/courses" },
                  { label: "About", href: "/about" },
                  { label: "Free trial", href: "/book-free-trial" },
                  { label: "Placement test", href: "/book-placement-test" },
                  { label: "Contact", href: "/contact" },
                  { label: "Sign in", href: "/auth/login" },
                ].map(item => (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className="py-3 text-[15px] text-[#1A1A1A] border-b border-[#E8E2D8] last:border-0"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="px-5 md:px-6 pt-14 md:pt-20 lg:pt-24">
        <div className="max-w-[1280px] mx-auto grid lg:grid-cols-12 gap-12 lg:gap-10 items-center">
          <motion.div
            className="lg:col-span-7"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
          >
            <Eyebrow>
              <span className="inline-flex items-center gap-2">
                <Khatam className="w-2 h-2 text-[#C4A35A]" />
                Nile Center — Arabic &amp; Qur’an since 1998
              </span>
            </Eyebrow>
            <h1
              className="mt-5 text-[clamp(2.9rem,7vw,5.4rem)] leading-[1.0] tracking-[-0.01em] text-[#1A1A1A]"
              style={{ fontFamily: SERIF }}
            >
              Learn with passion.<br />
              Succeed with <span className="italic">distinction.</span>
            </h1>
            <p className="mt-7 text-[16px] md:text-[17px] leading-[1.7] text-[#5A5A5A] max-w-[520px]">
              High-quality, flexible Arabic and Qur’anic education for learners
              worldwide — taught live online and on campus in Nasr City, Cairo,
              by certified teachers since 1998.
            </p>
            <div className="mt-9 flex flex-col sm:flex-row sm:items-center gap-3">
              <Link
                href="/book-free-trial"
                className="group inline-flex items-center justify-center gap-2 bg-[#1A1A1A] text-[#F7F5F0] text-[15px] font-medium px-6 py-3 rounded-md hover:bg-[#2A2A2A] transition-colors"
              >
                Book a free trial lesson
                <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link
                href="/courses"
                className="inline-flex items-center justify-center gap-2 border border-[#D4CEC6] text-[#1A1A1A] text-[15px] font-medium px-6 py-3 rounded-md hover:bg-[#F0EDE8] transition-colors"
              >
                Browse the catalogue
              </Link>
            </div>
            <p className="mt-6 text-[13px] text-[#9A8878]">
              Every enrolment begins with a free thirty-minute placement test —
              online or on campus.
            </p>
          </motion.div>

          {/* Framed calligraphy — the page's only "image" is type */}
          <motion.div
            className="lg:col-span-5"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.23, 1, 0.32, 1] }}
          >
            <figure className="relative border border-[#D4CEC6] bg-[#FFFDF9] p-2 shadow-[0_20px_50px_-24px_rgba(26,26,26,0.25)]">
              <span className="absolute top-5 left-5 text-[10px] font-semibold tracking-[0.2em] uppercase text-[#9A8878]">
                Plate I
              </span>
              <span
                lang="ar"
                dir="rtl"
                className="absolute top-4 right-5 text-[13px] text-[#9A8878]"
                style={{ fontFamily: NASKH }}
              >
                مركز النيل
              </span>
              <div className="border border-[#E8E2D8] px-6 pt-10 pb-8 md:pt-14 md:pb-10 flex flex-col items-center text-center">
                <span
                  lang="ar"
                  dir="rtl"
                  aria-hidden="true"
                  className="text-[#1A1A1A] leading-[1.1] text-[clamp(5rem,10vw,8.5rem)] select-none"
                  style={{ fontFamily: RUQAA }}
                >
                  اقرأ
                </span>
                <span className="mt-6 w-1.5 h-1.5 rotate-45 bg-[#C4A35A]" aria-hidden="true" />
                <figcaption className="mt-5 text-[13px] text-[#6A6A6A] leading-relaxed">
                  <em className="not-italic font-semibold text-[#1A1A1A]">Iqrāʾ — “Read.”</em><br />
                  The first word of the revelation. Qur’an 96:1
                </figcaption>
              </div>
            </figure>
            <p className="mt-4 text-center text-[12px] tracking-[0.14em] uppercase text-[#9A8878]">
              Calligraphy taught at the center — Naskh · Thuluth · Ruq'ah
            </p>
          </motion.div>
        </div>

        {/* Facts strip */}
        <div className="max-w-[1280px] mx-auto mt-14 md:mt-20 border-t-2 border-[#1A1A1A]">
          <dl className="grid grid-cols-2 lg:grid-cols-4">
            {[
              ["Founded", "1998 — Cairo"],
              ["Alumni", "120,000+ learners"],
              ["Nationalities", "120+ countries"],
              ["Teachers", "150 tutors"],
            ].map(([dt, dd], i) => (
              <div
                key={dt}
                className={`py-6 pr-6 ${i > 0 ? "border-l border-[#E8E2D8] pl-6" : ""} ${i === 2 ? "max-lg:border-l-0 max-lg:pl-0 max-lg:border-t max-lg:border-[#E8E2D8]" : ""} ${i === 3 ? "max-lg:border-t max-lg:border-[#E8E2D8]" : ""}`}
              >
                <dt className="text-[11px] font-semibold tracking-[0.16em] uppercase text-[#9A8878]">{dt}</dt>
                <dd className="mt-2 text-[15px] font-medium text-[#1A1A1A]">{dd}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── 01 · Catalogue ───────────────────────────────────────────── */}
      <section className="px-5 md:px-6 pt-20 md:pt-28" id="catalogue">
        <div className="max-w-[1280px] mx-auto">
          <Reveal>
            <SectionHeader
              index="01"
              title="The catalogue"
              aside={
                <Link
                  href="/courses"
                  className="group hidden sm:inline-flex items-center gap-1.5 text-[13px] font-medium text-[#5A5A5A] hover:text-[#1A1A1A] transition-colors"
                >
                  All programmes
                  <ArrowUpRight size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </Link>
              }
            />
          </Reveal>

          <Reveal delay={0.05}>
            <ol className="border-b border-[#E8E2D8]">
              {PROGRAMMES.map(p => (
                <li key={p.slug}>
                  <Link
                    href={`/courses/${p.slug}`}
                    className="group grid grid-cols-[2rem_minmax(0,1fr)_1.5rem] md:grid-cols-[3rem_minmax(0,1fr)_11rem_11rem_2rem] items-center gap-x-4 py-5 md:py-6 border-t border-[#E8E2D8] px-2 -mx-2 hover:bg-[#FFFDF9] transition-colors"
                  >
                    <span
                      className="text-[13px] italic leading-none text-[#9A8878] tabular-nums group-hover:text-[#C4A35A] transition-colors"
                      style={{ fontFamily: SERIF }}
                    >
                      {p.n}
                    </span>
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                        <span
                          className="text-[19px] md:text-[21px] leading-snug text-[#1A1A1A] group-hover:underline decoration-[#C4A35A] underline-offset-4 decoration-1"
                          style={{ fontFamily: SERIF }}
                        >
                          {p.name}
                        </span>
                        <span
                          lang="ar"
                          dir="rtl"
                          className="text-[15px] text-[#9A8878]"
                          style={{ fontFamily: NASKH }}
                        >
                          {p.ar}
                        </span>
                      </span>
                      <span className="block mt-1 text-[13px] leading-relaxed text-[#6A6A6A] max-w-[480px]">
                        {p.desc}
                      </span>
                    </span>
                    <span className="hidden md:block text-[13px] text-[#4A4A4A]">{p.level}</span>
                    <span className="hidden md:block text-[13px] text-[#6A6A6A]">{p.rhythm}</span>
                    <ArrowRight
                      size={16}
                      className="justify-self-end text-[#C4BCB0] group-hover:text-[#1A1A1A] group-hover:translate-x-1 transition-all"
                    />
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/contact"
                  className="group flex items-center justify-between gap-4 py-5 border-t border-[#E8E2D8] px-2 -mx-2 hover:bg-[#FFFDF9] transition-colors"
                >
                  <span className="text-[13.5px] text-[#6A6A6A]">
                    <span className="italic" style={{ fontFamily: SERIF }}>By arrangement</span>
                    {" — "}private tutoring and ijazah supervision are set up individually with the registrar.
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#1A1A1A] shrink-0">
                    Ask the registrar
                    <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </Link>
              </li>
            </ol>
          </Reveal>

          <Reveal delay={0.05}>
            <p className="sm:hidden mt-6 text-center">
              <Link href="/courses" className="text-[13px] font-medium text-[#5A5A5A] underline underline-offset-4">
                View all programmes
              </Link>
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── 02 · Enrolment ───────────────────────────────────────────── */}
      <section className="px-5 md:px-6 pt-20 md:pt-28">
        <div className="max-w-[1280px] mx-auto">
          <Reveal>
            <SectionHeader index="02" title="How enrolment works" />
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-10 mt-10 md:mt-12">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 0.06}>
                <div className="border-t-2 border-[#1A1A1A] pt-4 flex flex-col h-full">
                  <span
                    className="text-[30px] italic leading-none text-[#C4A35A] tabular-nums"
                    style={{ fontFamily: SERIF }}
                  >
                    {s.n}
                  </span>
                  <h3
                    className="mt-3 text-[22px] leading-tight text-[#1A1A1A]"
                    style={{ fontFamily: SERIF }}
                  >
                    {s.title}
                  </h3>
                  <p className="mt-2.5 text-[13.5px] leading-relaxed text-[#6A6A6A] flex-1">
                    {s.text}
                  </p>
                  <Link
                    href={s.href}
                    className="group mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-[#1A1A1A]"
                  >
                    <span className="border-b border-[#D4CEC6] group-hover:border-[#1A1A1A] transition-colors">
                      {s.action}
                    </span>
                    <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── 03 · Method ──────────────────────────────────────────────── */}
      <section className="px-5 md:px-6 pt-20 md:pt-28">
        <div className="max-w-[1280px] mx-auto">
          <Reveal>
            <SectionHeader index="03" title="How we teach" />
          </Reveal>
          <div className="grid lg:grid-cols-12 gap-10 lg:gap-14 mt-10 md:mt-12">
            <div className="lg:col-span-7">
              {PRINCIPLES.map((pr, i) => (
                <Reveal key={pr.n} delay={i * 0.05}>
                  <div className={`grid grid-cols-[2.5rem_1fr] gap-4 py-6 ${i > 0 ? "border-t border-[#E8E2D8]" : ""} ${i === 0 ? "pt-0" : ""}`}>
                    <span
                      className="text-[26px] leading-none text-[#C4A35A] tabular-nums"
                      style={{ fontFamily: SERIF }}
                    >
                      {pr.n}.
                    </span>
                    <div>
                      <h3 className="text-[17px] font-semibold text-[#1A1A1A]">{pr.title}</h3>
                      <p className="mt-1.5 text-[14px] leading-relaxed text-[#6A6A6A] max-w-[480px]">
                        {pr.text}
                      </p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
            <Reveal delay={0.1} className="lg:col-span-5">
              <figure className="h-full border border-[#D4CEC6] bg-[#FFFDF9] p-2">
                <div className="h-full bg-[#F0EDE8] border border-[#E8E2D8] px-7 py-10 md:px-10 md:py-12 flex flex-col justify-center relative">
                  <span className="absolute top-5 left-6 text-[10px] font-semibold tracking-[0.2em] uppercase text-[#9A8878]">
                    Plate II
                  </span>
                  <blockquote
                    lang="ar"
                    dir="rtl"
                    className="text-[clamp(1.7rem,3vw,2.4rem)] leading-[1.6] text-[#1A1A1A] text-center"
                    style={{ fontFamily: NASKH }}
                  >
                    اطلبوا العلم من المهد إلى اللحد
                  </blockquote>
                  <div className="mt-6 flex items-center justify-center gap-2" aria-hidden="true">
                    <span className="w-8 h-px bg-[#C4A35A]" />
                    <Khatam className="w-2 h-2 text-[#C4A35A]" />
                    <span className="w-8 h-px bg-[#C4A35A]" />
                  </div>
                  <figcaption className="mt-6 text-center">
                    <p className="text-[15px] italic text-[#4A4A4A]" style={{ fontFamily: SERIF }}>
                      “Seek knowledge from the cradle to the grave.”
                    </p>
                    <p className="mt-2 text-[11px] tracking-[0.16em] uppercase text-[#9A8878]">
                      The first thing every student hears
                    </p>
                  </figcaption>
                </div>
              </figure>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── 04 · Student words ───────────────────────────────────────── */}
      <section className="px-5 md:px-6 pt-20 md:pt-28">
        <div className="max-w-[1280px] mx-auto">
          <Reveal>
            <SectionHeader index="04" title="Student words" />
          </Reveal>
          <div className="grid lg:grid-cols-12 gap-10 lg:gap-14 mt-10 md:mt-14">
            <Reveal className="lg:col-span-7">
              <figure className="relative">
                <span
                  aria-hidden="true"
                  className="absolute -top-2 -left-2 md:-left-8 text-[72px] leading-[0.6] text-[#C4A35A] select-none"
                  style={{ fontFamily: SERIF }}
                >
                  “
                </span>
                <blockquote
                  className="text-[clamp(1.6rem,3.2vw,2.5rem)] leading-[1.25] text-[#1A1A1A] md:pl-6"
                  style={{ fontFamily: SERIF }}
                >
                  {QUOTES[0].text}
                </blockquote>
                <figcaption className="mt-6 text-[13px] text-[#6A6A6A] md:pl-6">
                  <span className="font-semibold text-[#1A1A1A]">{QUOTES[0].name}</span>
                  {" — "}
                  {QUOTES[0].context}
                </figcaption>
              </figure>
            </Reveal>
            <div className="lg:col-span-5 flex flex-col">
              {QUOTES.slice(1).map((q, i) => (
                <Reveal key={q.name} delay={0.08 + i * 0.06}>
                  <figure className={`py-7 ${i === 0 ? "lg:pt-0 border-t lg:border-t-0 border-[#E8E2D8]" : "border-t border-[#E8E2D8]"}`}>
                    <blockquote className="text-[15px] leading-relaxed text-[#4A4A4A]">
                      “{q.text}”
                    </blockquote>
                    <figcaption className="mt-4 text-[12.5px] text-[#6A6A6A]">
                      <span className="font-semibold text-[#1A1A1A]">{q.name}</span>
                      {" — "}
                      {q.context}
                    </figcaption>
                  </figure>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 05 · Portals ─────────────────────────────────────────────── */}
      <section className="px-5 md:px-6 pt-20 md:pt-28">
        <div className="max-w-[1280px] mx-auto">
          <Reveal>
            <SectionHeader
              index="05"
              title="Portals"
              aside={
                <span className="hidden sm:block text-[12px] text-[#9A8878]">
                  For enrolled students &amp; staff
                </span>
              }
            />
          </Reveal>
          <Reveal delay={0.05}>
            <div className="grid md:grid-cols-2 gap-x-12 mt-2">
              {PORTALS.map(p => (
                <Link
                  key={p.role}
                  href={p.href}
                  className="group flex items-center justify-between gap-6 py-5 border-b border-[#E8E2D8] hover:bg-[#FFFDF9] px-2 -mx-2 transition-colors"
                >
                  <span className="min-w-0">
                    <span className="block text-[15.5px] font-semibold text-[#1A1A1A]">
                      {p.role}
                    </span>
                    <span className="block mt-0.5 text-[13px] text-[#6A6A6A]">
                      {p.desc}
                    </span>
                  </span>
                  <ArrowRight
                    size={15}
                    className="shrink-0 text-[#C4BCB0] group-hover:text-[#1A1A1A] group-hover:translate-x-1 transition-all"
                  />
                </Link>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── CTA band ─────────────────────────────────────────────────── */}
      <section className="mt-20 md:mt-28 bg-[#1A1A1A] text-[#F7F5F0] relative overflow-hidden">
        <span
          lang="ar"
          dir="rtl"
          aria-hidden="true"
          className="absolute -right-4 md:right-10 top-1/2 -translate-y-1/2 text-[16rem] md:text-[22rem] leading-none text-white/[0.07] select-none pointer-events-none"
          style={{ fontFamily: RUQAA }}
        >
          اقرأ
        </span>
        <div className="relative max-w-[1280px] mx-auto px-5 md:px-6 py-20 md:py-28">
          <div className="flex items-center gap-3 mb-8" aria-hidden="true">
            <span className="w-10 h-px bg-[#C4A35A]/60" />
            <Khatam className="w-2.5 h-2.5 text-[#C4A35A]" />
            <span className="w-10 h-px bg-[#C4A35A]/60" />
          </div>
          <Eyebrow>
            <span className="text-[#C4A35A]">Admissions</span>
          </Eyebrow>
          <h2
            className="mt-5 text-[clamp(2.4rem,5.5vw,4.4rem)] leading-[1.02] tracking-tight max-w-[640px]"
            style={{ fontFamily: SERIF }}
          >
            Start your free<br />
            <span className="italic">online trial.</span>
          </h2>
          <p className="mt-6 text-[15px] md:text-[16px] leading-[1.7] text-white/55 max-w-[440px]">
            A free trial lesson and a free placement test — take the first step,
            and the registrar takes it from there.
          </p>
          <div className="mt-9 flex flex-col sm:flex-row gap-3">
            <Link
              href="/book-free-trial"
              className="group inline-flex items-center justify-center gap-2 bg-[#F7F5F0] text-[#1A1A1A] text-[15px] font-semibold px-7 py-3.5 rounded-md hover:bg-white transition-colors"
            >
              Free trial lesson
              <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              href="/book-placement-test"
              className="inline-flex items-center justify-center gap-2 border border-white/25 text-[#F7F5F0] text-[15px] font-medium px-7 py-3.5 rounded-md hover:bg-white/10 transition-colors"
            >
              Book a placement test
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="px-5 md:px-6 pt-16 pb-10">
        <div className="max-w-[1280px] mx-auto">
          <div className="grid sm:grid-cols-2 lg:grid-cols-12 gap-10 pb-12">
            <div className="sm:col-span-2 lg:col-span-5">
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-md bg-[#1A1A1A] flex items-center justify-center">
                  <span className="text-[#F7F5F0] text-[19px] leading-none" style={{ fontFamily: NASKH }}>ن</span>
                </span>
                <div>
                  <span className="block font-semibold text-[15px] tracking-tight leading-tight">Nile Center</span>
                  <span lang="ar" dir="rtl" className="block text-[13px] text-[#9A8878] leading-tight" style={{ fontFamily: NASKH }}>
                    مركز النيل
                  </span>
                </div>
              </div>
              <p className="mt-5 text-[13.5px] leading-relaxed text-[#6A6A6A] max-w-[320px]">
                Arabic language and Qur’anic studies since 1998 — two campuses
                in Nasr City, Cairo, and live online.
              </p>
              <div className="mt-4 space-y-1.5 text-[12.5px] text-[#6A6A6A]">
                <p>Branch 1 — 37 Abd Al-Shafy Mohammed, Nasr City</p>
                <p>Branch 2 — 6 Fadl ibn Rabea, Nasr City</p>
                <p>info@nilecenter.edu.eg</p>
              </div>
              <p className="mt-4 text-[12px] tracking-[0.14em] uppercase text-[#9A8878]">
                Onsite +20 109 566 1266 · Online +20 102 178 7789
              </p>
            </div>
            {[
              {
                title: "Programmes",
                links: [
                  ["Quran Courses", "/courses/quran"],
                  ["Arabic Courses", "/courses/arabic"],
                  ["Islamic Studies", "/courses/islamic-studies"],
                  ["All programmes", "/courses"],
                ],
              },
              {
                title: "School",
                links: [
                  ["About", "/about"],
                  ["Free trial", "/book-free-trial"],
                  ["Placement test", "/book-placement-test"],
                  ["Contact", "/contact"],
                ],
              },
              {
                title: "Accounts",
                links: [
                  ["Sign in", "/auth/login"],
                  ["Verify a certificate", "/verify-certificate"],
                  ["FAQ", "/faq"],
                  ["Terms & privacy", "/terms"],
                ],
              },
            ].map(col => (
              <div key={col.title} className="lg:col-span-2">
                <h3 className="text-[11px] font-semibold tracking-[0.16em] uppercase text-[#9A8878]">
                  {col.title}
                </h3>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map(([label, href]) => (
                    <li key={label}>
                      <Link href={href} className="text-[13.5px] text-[#5A5A5A] hover:text-[#1A1A1A] transition-colors">
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-[#E8E2D8] pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <p className="text-[12.5px] text-[#9A8878]">© 2026 Nile Learning Center. Est. 1998. All rights reserved.</p>
            <p className="hidden md:block text-[11px] tracking-[0.12em] uppercase text-[#B4AA9C]">
              Set in Instrument Serif · Inter · Noto Naskh Arabic · Aref Ruqaa
            </p>
            <Link href="/privacy" className="text-[12.5px] text-[#9A8878] hover:text-[#1A1A1A] transition-colors">
              Privacy policy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
