/**
 * NILE CENTER — HOME PAGE
 * Design: Syncrun-inspired editorial minimalism
 * - Warm off-white (#F7F5F0) background, charcoal text
 * - Massive Instrument Serif display headlines
 * - Pill-shaped CTA buttons (black fill + outlined)
 * - Alternating feature cards with product mockup images
 * - Section labels: "||||" prefix + uppercase small caps
 * - Logo marquee strip
 * - Testimonials horizontal scroll
 * - Generous whitespace, no clutter
 * - Framer Motion scroll-reveal on every section
 */

import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import { Link } from "wouter";
import {
  BookOpen, GraduationCap, Users, Star, ChevronRight, ArrowRight,
  Play, CheckCircle2, Globe, Clock, Award, BarChart3, MessageSquare,
  BookMarked, Mic, PenTool, Menu, X
} from "lucide-react";

// ─── Animation Variants ───────────────────────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.6, delay: i * 0.1 }
  })
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: (i = 0) => ({
    opacity: 1,
    transition: { duration: 0.5, delay: i * 0.08 }
  })
};

// ─── Section Label ─────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      <div className="flex gap-[2px]">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="w-[3px] h-4 rounded-full bg-[#B8A898]" />
        ))}
      </div>
      <span className="text-[11px] font-semibold tracking-[0.15em] uppercase text-[#9A8878]">
        {children}
      </span>
    </div>
  );
}

// ─── Scroll Reveal Wrapper ─────────────────────────────────────────────────────
function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      custom={delay}
      variants={fadeUp}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── Stats Counter ─────────────────────────────────────────────────────────────
function CountUp({ end, suffix = "" }: { end: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && !started) setStarted(true); },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started) return;
    let start = 0;
    const duration = 1800;
    const step = end / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= end) { setCount(end); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [started, end]);

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

// ─── Marquee ──────────────────────────────────────────────────────────────────
const PARTNERS = [
  "Al-Azhar University", "Islamic Online University", "Qalam Institute",
  "Bayyinah Institute", "SeekersGuidance", "Al-Maghrib Institute",
  "Mishkah University", "Zaytuna College"
];

function Marquee() {
  return (
    <div className="overflow-hidden py-6 border-y border-[#E8E2D8]">
      <motion.div
        className="flex gap-16 whitespace-nowrap"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
      >
        {[...PARTNERS, ...PARTNERS].map((p, i) => (
          <span key={i} className="text-[13px] font-medium text-[#9A8878] tracking-wide shrink-0">
            {p}
          </span>
        ))}
      </motion.div>
    </div>
  );
}

// ─── Testimonials ─────────────────────────────────────────────────────────────
const TESTIMONIALS = [
  {
    name: "Ahmed Al-Rashidi", role: "Student, Arabic Calligraphy", rating: 5,
    text: "The platform transformed how I learn Arabic. The structured curriculum and live sessions with qualified teachers made all the difference.",
    avatar: "أ"
  },
  {
    name: "Fatima Hassan", role: "Student, Quran Memorization", rating: 5,
    text: "I completed my first Juz in just 3 months. The attendance tracking and progress reports kept me accountable throughout.",
    avatar: "ف"
  },
  {
    name: "Omar Khalid", role: "Student, Islamic Studies", rating: 5,
    text: "Nile Center's approach to teaching Tajweed is exceptional. The teachers are patient and the materials are beautifully designed.",
    avatar: "ع"
  },
  {
    name: "Maryam Yusuf", role: "Parent", rating: 5,
    text: "My children have been attending for two years. The registration system is seamless and the progress reports give us full visibility.",
    avatar: "م"
  },
  {
    name: "Ibrahim Al-Sayed", role: "Student, Arabic Grammar", rating: 5,
    text: "The Nahw and Sarf courses are world-class. I can now read classical Arabic texts with confidence after just one year.",
    avatar: "إ"
  }
];

// ─── Courses ──────────────────────────────────────────────────────────────────
const COURSES = [
  { icon: BookOpen, label: "Quran Recitation", desc: "Tajweed, Hifz, and Tarteel with certified Huffaz", count: "240+ students", color: "#2D5016" },
  { icon: PenTool, label: "Arabic Calligraphy", desc: "Naskh, Thuluth, Ruq'ah, and Diwani scripts", count: "180+ students", color: "#1A3A5C" },
  { icon: BookMarked, label: "Arabic Language", desc: "Grammar, vocabulary, reading and writing", count: "320+ students", color: "#5C2D00" },
  { icon: Mic, label: "Islamic Studies", desc: "Fiqh, Aqeedah, Seerah and Hadith sciences", count: "150+ students", color: "#3D1A5C" },
  { icon: GraduationCap, label: "Children's Program", desc: "Age-appropriate Quran and Arabic for ages 5–14", count: "400+ students", color: "#1A4A3A" },
  { icon: Globe, label: "Online Intensive", desc: "Live sessions for international students worldwide", count: "500+ students", color: "#4A3A1A" },
];

// ─── Main Component ────────────────────────────────────────────────────────────
export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], ["0%", "20%"]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <div className="min-h-screen bg-[#F7F5F0] text-[#1A1A1A] font-sans overflow-x-hidden">

      {/* ── NAV ── */}
      <motion.nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? "bg-[#F7F5F0]/95 backdrop-blur-md shadow-[0_1px_0_0_rgba(0,0,0,0.06)]" : "bg-transparent"
        }`}
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
      >
        <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-[#1A1A1A] flex items-center justify-center">
              <span className="text-white font-bold text-sm" style={{ fontFamily: "'Noto Naskh Arabic', serif" }}>ن</span>
            </div>
            <span className="font-semibold text-[15px] tracking-tight">Nile Center</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            {[
              { label: "Courses", href: "/courses" },
              { label: "About", href: "/about" },
              { label: "Trial", href: "/book-free-trial" },
              { label: "Contact", href: "/contact" },
            ].map(item => (
              <Link key={item.label} href={item.href} className="text-[14px] text-[#5A5A5A] hover:text-[#1A1A1A] transition-colors duration-200">
                {item.label}
              </Link>
            ))}
          </div>

          {/* CTAs */}
          <div className="hidden md:flex items-center gap-3">
            <Link href="/auth/login" className="text-[14px] text-[#5A5A5A] hover:text-[#1A1A1A] transition-colors px-4 py-2">
              Sign in
            </Link>
            <Link
              href="/auth/login"
              className="bg-[#1A1A1A] text-white text-[14px] font-medium px-5 py-2.5 rounded-full hover:bg-[#333] transition-all duration-200 active:scale-[0.97]"
            >
              Get started
            </Link>
          </div>

          {/* Mobile menu */}
          <button className="md:hidden p-2" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-[#F7F5F0] border-t border-[#E8E2D8] px-6 py-4 flex flex-col gap-4"
            >
              {[
                { label: "Courses", href: "/courses" },
                { label: "About", href: "/about" },
                { label: "Trial", href: "/book-free-trial" },
                { label: "Contact", href: "/contact" },
              ].map(item => (
                <Link key={item.label} href={item.href} className="text-[15px] text-[#5A5A5A]">{item.label}</Link>
              ))}
              <Link href="/auth/login" className="bg-[#1A1A1A] text-white text-[14px] font-medium px-5 py-3 rounded-full text-center">
                Get started
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>

      {/* ── HERO ── */}
      <section ref={heroRef} className="relative min-h-screen flex flex-col items-center justify-center pt-20 pb-16 px-6 overflow-hidden">
        {/* Subtle background texture */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 50%, rgba(184,168,152,0.15) 0%, transparent 60%),
                              radial-gradient(circle at 80% 20%, rgba(45,80,22,0.08) 0%, transparent 50%)`
          }}
        />

        <motion.div
          style={{ y: heroY, opacity: heroOpacity }}
          className="relative z-10 max-w-[900px] mx-auto text-center"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="inline-flex items-center gap-2 bg-white border border-[#E8E2D8] rounded-full px-4 py-1.5 mb-8 shadow-sm"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-[#2D5016] animate-pulse" />
            <span className="text-[12px] font-medium text-[#5A5A5A] tracking-wide">
              ARABIC LANGUAGE & QURAN EDUCATION PLATFORM
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="text-[64px] md:text-[88px] leading-[1.0] font-bold tracking-tight mb-6"
            style={{ fontFamily: "'Instrument Serif', 'Georgia', serif" }}
          >
            Learn Arabic &<br />
            <span className="italic text-[#5A4A3A]">Quran</span> with<br />
            confidence.
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="text-[17px] text-[#6A6A6A] max-w-[520px] mx-auto leading-relaxed mb-10"
          >
            Nile Center connects students worldwide with certified teachers for
            structured Arabic language and Quran education — online and in-person.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.45 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <Link
              href="/auth/login"
              className="group flex items-center gap-2 bg-[#1A1A1A] text-white text-[15px] font-medium px-7 py-3.5 rounded-full hover:bg-[#333] transition-all duration-200 active:scale-[0.97] shadow-lg shadow-black/10"
            >
              Start learning
              <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <a
              href="#courses"
              className="flex items-center gap-2 border border-[#D4CEC6] text-[#1A1A1A] text-[15px] font-medium px-7 py-3.5 rounded-full hover:bg-[#F0EDE8] transition-all duration-200 active:scale-[0.97]"
            >
              <Play size={14} fill="currentColor" />
              View courses
            </a>
          </motion.div>

          {/* Social proof */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="mt-12 flex items-center justify-center gap-6 text-[13px] text-[#8A8A8A]"
          >
            <div className="flex items-center gap-1.5">
              <div className="flex -space-x-2">
                {["أ","ف","م","ع","إ"].map((l, i) => (
                  <div key={i} className="w-7 h-7 rounded-full bg-[#E8E2D8] border-2 border-[#F7F5F0] flex items-center justify-center text-[10px] font-bold text-[#5A4A3A]">{l}</div>
                ))}
              </div>
              <span>5,000+ active students</span>
            </div>
            <div className="w-px h-4 bg-[#D4CEC6]" />
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => <Star key={i} size={12} fill="#C4A35A" className="text-[#C4A35A]" />)}
              <span className="ml-1">4.9 rating</span>
            </div>
          </motion.div>
        </motion.div>

        {/* Hero Product Mockup */}
        <motion.div
          initial={{ opacity: 0, y: 48, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.5 }}
          className="relative z-10 mt-16 max-w-[900px] mx-auto w-full px-4"
        >
          <div className="relative rounded-2xl overflow-hidden shadow-[0_32px_80px_-12px_rgba(0,0,0,0.18)] border border-[#E8E2D8]">
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/310519663054618609/iE3uDMyhDt3MKxxF4wRZj3/hero-mockup-6QBaCKGDdp9ftZD34Dswc3.webp"
              alt="Nile Center Dashboard"
              className="w-full h-auto"
            />
            {/* Floating badge */}
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="absolute top-6 right-6 bg-white rounded-xl px-4 py-3 shadow-lg border border-[#E8E2D8] flex items-center gap-3"
            >
              <div className="w-8 h-8 rounded-lg bg-[#2D5016]/10 flex items-center justify-center">
                <CheckCircle2 size={16} className="text-[#2D5016]" />
              </div>
              <div>
                <div className="text-[11px] font-semibold text-[#1A1A1A]">Lesson completed</div>
                <div className="text-[10px] text-[#8A8A8A]">Surah Al-Fatiha · Tajweed</div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* ── TRUST STRIP ── */}
      <div className="py-4">
        <div className="max-w-[1200px] mx-auto px-6 mb-3">
          <p className="text-center text-[12px] font-medium tracking-[0.12em] uppercase text-[#9A8878]">
            [ Trusted by students from 40+ countries ]
          </p>
        </div>
        <Marquee />
      </div>

      {/* ── STATS ── */}
      <section className="py-24 px-6">
        <div className="max-w-[1200px] mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { value: 5000, suffix: "+", label: "Active Students" },
              { value: 120, suffix: "+", label: "Certified Teachers" },
              { value: 40, suffix: "+", label: "Countries Reached" },
              { value: 98, suffix: "%", label: "Satisfaction Rate" },
            ].map((stat, i) => (
              <Reveal key={i} delay={i * 0.1}>
                <div className="text-center">
                  <div
                    className="text-[52px] font-bold tracking-tight mb-1 text-[#1A1A1A]"
                    style={{ fontFamily: "'Instrument Serif', serif" }}
                  >
                    <CountUp end={stat.value} suffix={stat.suffix} />
                  </div>
                  <div className="text-[13px] text-[#8A8A8A] font-medium">{stat.label}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-[1200px] mx-auto">
          <Reveal>
            <SectionLabel>Features</SectionLabel>
          </Reveal>
          <Reveal delay={0.1}>
            <h2
              className="text-[48px] md:text-[60px] font-bold leading-[1.05] tracking-tight mb-4 max-w-[700px]"
              style={{ fontFamily: "'Instrument Serif', serif" }}
            >
              An education platform built for Arabic learning.
            </h2>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="text-[16px] text-[#6A6A6A] max-w-[480px] mb-20 leading-relaxed">
              Purpose-built tools for students, teachers, and administrators — all in one unified platform.
            </p>
          </Reveal>

          {/* Feature cards — alternating layout like Syncrun */}
          <div className="flex flex-col gap-6">

            {/* Feature 1 — Quran Recitation */}
            <Reveal>
              <div className="grid md:grid-cols-2 gap-6 bg-[#F7F5F0] rounded-2xl overflow-hidden border border-[#E8E2D8]">
                <div className="p-10 flex flex-col justify-center">
                  <SectionLabel>Quran Recitation</SectionLabel>
                  <h3
                    className="text-[32px] font-bold leading-tight mb-4"
                    style={{ fontFamily: "'Instrument Serif', serif" }}
                  >
                    Master Tajweed with certified Huffaz.
                  </h3>
                  <p className="text-[15px] text-[#6A6A6A] leading-relaxed mb-6">
                    Live one-on-one and group sessions with certified teachers. Track your memorization progress, attendance, and recitation quality.
                  </p>
                  <ul className="space-y-2.5">
                    {["Structured Hifz curriculum", "Audio recording & playback", "Progress tracking per Surah", "Tajweed correction in real-time"].map(f => (
                      <li key={f} className="flex items-center gap-2.5 text-[14px] text-[#4A4A4A]">
                        <CheckCircle2 size={15} className="text-[#2D5016] shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="relative overflow-hidden min-h-[320px]">
                  <img
                    src="https://d2xsxph8kpxj0f.cloudfront.net/310519663054618609/iE3uDMyhDt3MKxxF4wRZj3/feature-quran-QWePE76VrhAWcerJZJfLcx.webp"
                    alt="Quran Recitation Feature"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </Reveal>

            {/* Feature 2 — Arabic Calligraphy (reversed) */}
            <Reveal>
              <div className="grid md:grid-cols-2 gap-6 bg-[#F7F5F0] rounded-2xl overflow-hidden border border-[#E8E2D8]">
                <div className="relative overflow-hidden min-h-[320px] order-2 md:order-1">
                  <img
                    src="https://d2xsxph8kpxj0f.cloudfront.net/310519663054618609/iE3uDMyhDt3MKxxF4wRZj3/feature-arabic-QAQmVS3adzA27SABmJd6v9.webp"
                    alt="Arabic Calligraphy Feature"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-10 flex flex-col justify-center order-1 md:order-2">
                  <SectionLabel>Arabic Language</SectionLabel>
                  <h3
                    className="text-[32px] font-bold leading-tight mb-4"
                    style={{ fontFamily: "'Instrument Serif', serif" }}
                  >
                    From alphabet to classical texts.
                  </h3>
                  <p className="text-[15px] text-[#6A6A6A] leading-relaxed mb-6">
                    Comprehensive Arabic curriculum covering calligraphy, grammar (Nahw & Sarf), reading, writing, and classical literature.
                  </p>
                  <ul className="space-y-2.5">
                    {["Naskh, Thuluth & Ruq'ah calligraphy", "Nahw & Sarf grammar courses", "Vocabulary building programs", "Classical text reading"].map(f => (
                      <li key={f} className="flex items-center gap-2.5 text-[14px] text-[#4A4A4A]">
                        <CheckCircle2 size={15} className="text-[#1A3A5C] shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Reveal>

            {/* Feature 3 — Management */}
            <Reveal>
              <div className="grid md:grid-cols-2 gap-6 bg-[#F7F5F0] rounded-2xl overflow-hidden border border-[#E8E2D8]">
                <div className="p-10 flex flex-col justify-center">
                  <SectionLabel>Administration</SectionLabel>
                  <h3
                    className="text-[32px] font-bold leading-tight mb-4"
                    style={{ fontFamily: "'Instrument Serif', serif" }}
                  >
                    Full enrollment management, automated.
                  </h3>
                  <p className="text-[15px] text-[#6A6A6A] leading-relaxed mb-6">
                    From student registration to payment processing, attendance tracking, and grade reporting — everything in one dashboard.
                  </p>
                  <ul className="space-y-2.5">
                    {["Student registration & enrollment", "Payment tracking & invoicing", "Attendance & grade reports", "Multi-branch management"].map(f => (
                      <li key={f} className="flex items-center gap-2.5 text-[14px] text-[#4A4A4A]">
                        <CheckCircle2 size={15} className="text-[#5C2D00] shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="p-10 flex flex-col justify-center bg-[#1A1A1A] text-white">
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { icon: Users, label: "Students", value: "5,247", change: "+12%" },
                      { icon: BookOpen, label: "Active Courses", value: "48", change: "+3" },
                      { icon: BarChart3, label: "Attendance", value: "94%", change: "+2%" },
                      { icon: Award, label: "Completions", value: "1,832", change: "+18%" },
                    ].map(({ icon: Icon, label, value, change }) => (
                      <div key={label} className="bg-white/10 rounded-xl p-4">
                        <Icon size={16} className="text-white/60 mb-2" />
                        <div className="text-[22px] font-bold mb-0.5">{value}</div>
                        <div className="text-[11px] text-white/60">{label}</div>
                        <div className="text-[11px] text-[#7EC8A0] mt-1">{change} this month</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Reveal>

          </div>
        </div>
      </section>

      {/* ── COURSES ── */}
      <section id="courses" className="py-24 px-6">
        <div className="max-w-[1200px] mx-auto">
          <Reveal>
            <SectionLabel>Courses</SectionLabel>
          </Reveal>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <Reveal delay={0.1}>
              <h2
                className="text-[48px] md:text-[56px] font-bold leading-[1.05] tracking-tight max-w-[500px]"
                style={{ fontFamily: "'Instrument Serif', serif" }}
              >
                Everything you need to learn Arabic.
              </h2>
            </Reveal>
            <Reveal delay={0.2}>
              <Link
                href="/courses"
                className="flex items-center gap-2 text-[14px] font-medium text-[#1A1A1A] border border-[#D4CEC6] px-5 py-2.5 rounded-full hover:bg-[#F0EDE8] transition-all whitespace-nowrap"
              >
                View all courses <ChevronRight size={14} />
              </Link>
            </Reveal>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {COURSES.map((course, i) => (
              <Reveal key={i} delay={i * 0.08}>
                <motion.div
                  whileHover={{ y: -4, boxShadow: "0 16px 40px -8px rgba(0,0,0,0.12)" }}
                  transition={{ duration: 0.2 }}
                  className="bg-white rounded-2xl p-7 border border-[#E8E2D8] cursor-pointer group"
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center mb-5"
                    style={{ backgroundColor: `${course.color}14` }}
                  >
                    <course.icon size={18} style={{ color: course.color }} />
                  </div>
                  <h3 className="text-[17px] font-semibold mb-2 group-hover:text-[#5A4A3A] transition-colors">
                    {course.label}
                  </h3>
                  <p className="text-[13px] text-[#6A6A6A] leading-relaxed mb-4">{course.desc}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-[#9A8878] font-medium">{course.count}</span>
                    <ArrowRight size={14} className="text-[#C4C4C4] group-hover:text-[#1A1A1A] group-hover:translate-x-0.5 transition-all" />
                  </div>
                </motion.div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="py-24 px-6 bg-white overflow-hidden">
        <div className="max-w-[1200px] mx-auto">
          <Reveal>
            <SectionLabel>Testimonials</SectionLabel>
          </Reveal>
          <Reveal delay={0.1}>
            <h2
              className="text-[48px] md:text-[56px] font-bold leading-[1.05] tracking-tight mb-12 max-w-[600px]"
              style={{ fontFamily: "'Instrument Serif', serif" }}
            >
              Loved by students worldwide.
            </h2>
          </Reveal>

          <div className="flex gap-5 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory">
            {TESTIMONIALS.map((t, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 32 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="min-w-[320px] max-w-[320px] bg-[#F7F5F0] rounded-2xl p-7 border border-[#E8E2D8] snap-start flex flex-col justify-between"
              >
                <div>
                  <div className="flex gap-0.5 mb-4">
                    {[...Array(t.rating)].map((_, j) => (
                      <Star key={j} size={13} fill="#C4A35A" className="text-[#C4A35A]" />
                    ))}
                  </div>
                  <p className="text-[14px] text-[#4A4A4A] leading-relaxed mb-6">"{t.text}"</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#E8E2D8] flex items-center justify-center text-[14px] font-bold text-[#5A4A3A]">
                    {t.avatar}
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold text-[#1A1A1A]">{t.name}</div>
                    <div className="text-[11px] text-[#8A8A8A]">{t.role}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PORTALS ── */}
      <section className="py-24 px-6">
        <div className="max-w-[1200px] mx-auto">
          <Reveal>
            <SectionLabel>Portals</SectionLabel>
          </Reveal>
          <Reveal delay={0.1}>
            <h2
              className="text-[48px] md:text-[56px] font-bold leading-[1.05] tracking-tight mb-4 max-w-[600px]"
              style={{ fontFamily: "'Instrument Serif', serif" }}
            >
              Built for every role.
            </h2>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="text-[16px] text-[#6A6A6A] max-w-[440px] mb-12 leading-relaxed">
              Dedicated experiences for students, teachers, registrars, and administrators.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: GraduationCap, role: "Student", desc: "Access your courses, track grades, view attendance, and connect with teachers.", href: "/app/student/dashboard", color: "#2D5016" },
              { icon: BookOpen, role: "Teacher", desc: "Manage your classes, mark attendance, enter scores, and communicate with students.", href: "/app/teacher/dashboard", color: "#1A3A5C" },
              { icon: Users, role: "Registrar", desc: "Register students, process payments, manage enrollment, and generate reports.", href: "/app/registrar/dashboard", color: "#5C2D00" },
              { icon: BarChart3, role: "Head of Dept", desc: "Full oversight of courses, staff, students, schedules, and performance metrics.", href: "/app/hod/dashboard", color: "#3D1A5C" },
              { icon: Globe, role: "Branch Admin", desc: "Manage branch operations, staff assignments, and local scheduling.", href: "/app/branch/dashboard", color: "#1A4A3A" },
              { icon: Award, role: "Super Admin", desc: "Manage roles, permissions, branches, integrations, and global reports.", href: "/app/admin/dashboard", color: "#4A3A1A" },
            ].map((portal, i) => (
              <Reveal key={i} delay={i * 0.08}>
                <Link href={portal.href}>
                  <motion.div
                    whileHover={{ y: -3 }}
                    className="bg-white border border-[#E8E2D8] rounded-2xl p-7 cursor-pointer group hover:border-[#C4C4C4] transition-all duration-200"
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center mb-5"
                      style={{ backgroundColor: `${portal.color}12` }}
                    >
                      <portal.icon size={18} style={{ color: portal.color }} />
                    </div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-[16px] font-semibold">{portal.role} Portal</h3>
                      <ArrowRight size={14} className="text-[#C4C4C4] group-hover:text-[#1A1A1A] group-hover:translate-x-0.5 transition-all" />
                    </div>
                    <p className="text-[13px] text-[#6A6A6A] leading-relaxed">{portal.desc}</p>
                  </motion.div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 px-6">
        <div className="max-w-[1200px] mx-auto">
          <Reveal>
            <div className="bg-[#1A1A1A] rounded-3xl p-12 md:p-16 text-white text-center relative overflow-hidden">
              {/* Subtle bg pattern */}
              <div
                className="absolute inset-0 opacity-5"
                style={{
                  backgroundImage: `radial-gradient(circle at 30% 50%, rgba(255,255,255,0.3) 0%, transparent 60%),
                                    radial-gradient(circle at 70% 30%, rgba(196,163,90,0.4) 0%, transparent 50%)`
                }}
              />
              <div className="relative z-10">
                <div className="text-[12px] font-semibold tracking-[0.15em] uppercase text-white/50 mb-6">
                  Start your journey
                </div>
                <h2
                  className="text-[48px] md:text-[64px] font-bold leading-[1.05] tracking-tight mb-6"
                  style={{ fontFamily: "'Instrument Serif', serif" }}
                >
                  Begin learning Arabic<br />
                  <span className="italic text-[#C4A35A]">today.</span>
                </h2>
                <p className="text-[16px] text-white/60 max-w-[400px] mx-auto mb-10 leading-relaxed">
                  Join thousands of students learning Arabic and Quran with certified teachers from around the world.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <Link
                    href="/auth/login"
                    className="group flex items-center gap-2 bg-white text-[#1A1A1A] text-[15px] font-semibold px-8 py-3.5 rounded-full hover:bg-[#F0EDE8] transition-all duration-200 active:scale-[0.97]"
                  >
                    Get started free
                    <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                  <a
                    href="/contact"
                    className="flex items-center gap-2 border border-white/20 text-white text-[15px] font-medium px-8 py-3.5 rounded-full hover:bg-white/10 transition-all duration-200"
                  >
                    <MessageSquare size={15} />
                    Contact us
                  </a>
                </div>
                {/* Email input */}
                <div className="mt-8 flex items-center justify-center gap-3 max-w-[400px] mx-auto">
                  <input
                    type="email"
                    placeholder="Enter your email"
                    className="flex-1 bg-white/10 border border-white/20 text-white placeholder-white/40 text-[14px] px-4 py-3 rounded-full outline-none focus:border-white/40 transition-colors"
                  />
                  <button className="bg-white text-[#1A1A1A] text-[14px] font-semibold px-5 py-3 rounded-full hover:bg-[#F0EDE8] transition-colors whitespace-nowrap">
                    Send
                  </button>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="py-12 px-6 border-t border-[#E8E2D8]">
        <div className="max-w-[1200px] mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
            <div className="col-span-2">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-7 h-7 rounded-lg bg-[#1A1A1A] flex items-center justify-center">
                  <span className="text-white font-bold text-xs" style={{ fontFamily: "'Noto Naskh Arabic', serif" }}>ن</span>
                </div>
                <span className="font-semibold text-[14px]">Nile Center</span>
              </div>
              <p className="text-[13px] text-[#8A8A8A] leading-relaxed max-w-[220px]">
                Premium Arabic language and Quran education for students worldwide.
              </p>
            </div>
            {[
              { title: "Platform", links: [["Courses", "/courses"], ["Student Portal", "/app/student/dashboard"], ["Teacher Portal", "/app/teacher/dashboard"], ["Admin Portal", "/app/admin/dashboard"]] },
              { title: "Company", links: [["About", "/about"], ["Trial", "/book-free-trial"], ["Placement", "/book-placement-test"], ["Contact", "/contact"]] },
              { title: "Support", links: [["Contact", "/contact"], ["FAQ", "/faq"], ["Privacy Policy", "/privacy"], ["Terms", "/terms"]] },
            ].map(col => (
              <div key={col.title}>
                <div className="text-[11px] font-semibold tracking-[0.1em] uppercase text-[#9A8878] mb-4">{col.title}</div>
                <ul className="space-y-2.5">
                  {col.links.map(([link, href]) => (
                    <li key={link}>
                      <Link href={href} className="text-[13px] text-[#6A6A6A] hover:text-[#1A1A1A] transition-colors">{link}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8 border-t border-[#E8E2D8]">
            <p className="text-[12px] text-[#9A8878]">© 2025 Nile Center. All rights reserved.</p>
            <div className="flex items-center gap-2 text-[12px] text-[#9A8878]">
              <Clock size={12} />
              <span>Available 24/7 for online students</span>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
