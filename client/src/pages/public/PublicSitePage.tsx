import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  Award,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Download,
  Globe,
  GraduationCap,
  Mail,
  MessageSquare,
  Search,
  Send,
  ShieldCheck,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import { publicCourses } from "@/lib/platformData";
import { saveBackendRecord, verifyPublicCertificateRequest, type PublicCertificateVerificationDto } from "@/lib/backend/api";
import { platformStore } from "@/lib/domain/store";
import { leadFormSchema, placementFormSchema } from "@/lib/validators/platform";

type PublicMode =
  | "catalog"
  | "course"
  | "trial"
  | "placement"
  | "verify"
  | "faq"
  | "contact"
  | "about"
  | "privacy"
  | "terms";

export default function PublicSitePage({ mode, slug }: { mode: PublicMode; slug?: string }) {
  if (mode === "trial") return <PublicFrame><BookingForm type="trial" /></PublicFrame>;
  if (mode === "placement") return <PublicFrame><BookingForm type="placement" /></PublicFrame>;
  if (mode === "verify") return <PublicFrame><CertificateVerification /></PublicFrame>;
  if (mode === "course") return <PublicFrame><CourseDetail slug={slug ?? "arabic"} /></PublicFrame>;
  if (mode === "catalog") return <PublicFrame><CourseCatalog initialSlug={slug} /></PublicFrame>;
  return <PublicFrame><StaticPublicPage mode={mode} /></PublicFrame>;
}

function PublicFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="public-modern-page">
      <header className="public-modern-nav">
        <Link href="/" className="public-modern-logo">
          <span>NC</span>
          Nile Learn
        </Link>
        <nav>
          <Link href="/courses">Courses</Link>
          <Link href="/book-free-trial">Free trial</Link>
          <Link href="/book-placement-test">Placement test</Link>
          <Link href="/verify-certificate">Verify</Link>
          <Link href="/faq">FAQ</Link>
          <Link href="/contact">Contact</Link>
        </nav>
        <Link href="/auth/login" className="public-modern-login">Sign in</Link>
      </header>
      {children}
      <footer className="public-modern-footer">
        <div>
          <strong>Nile Center</strong>
          <p>Modern Arabic, Quran, and language education with role-based learning operations.</p>
        </div>
        <div>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/verify-certificate">Verify certificate</Link>
          <Link href="/auth/login">Portal</Link>
        </div>
      </footer>
    </div>
  );
}

function CourseCatalog({ initialSlug }: { initialSlug?: string }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState(initialSlug ?? "all");
  const courses = useMemo(() => {
    return publicCourses.filter((course) => {
      const filterMatch = filter === "all" || course.slug === filter;
      const queryMatch = course.title.toLowerCase().includes(query.toLowerCase()) || course.description.toLowerCase().includes(query.toLowerCase());
      return filterMatch && queryMatch;
    });
  }, [filter, query]);

  return (
    <main>
      <section className="public-catalog-hero">
        <span>Course catalog</span>
        <h1>Find the right Nile Center pathway.</h1>
        <p>Search Arabic, Quran, Islamic studies, language, kids, teacher training, and organization programs.</p>
        <div className="public-search-row">
          <Search size={18} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by subject, level, or goal" />
        </div>
      </section>

      <section className="public-course-layout">
        <aside>
          <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>All courses</button>
          {publicCourses.map((course) => (
            <button key={course.slug} className={filter === course.slug ? "active" : ""} onClick={() => setFilter(course.slug)}>
              {course.title}
            </button>
          ))}
        </aside>
        <div className="public-course-grid">
          {courses.map((course) => (
            <Link key={course.slug} href={`/courses/${course.slug}`} className="public-course-card">
              <span>{course.level}</span>
              <h2>{course.title}</h2>
              <p>{course.description}</p>
              <ul>
                {course.outcomes.map((outcome) => (
                  <li key={outcome}><CheckCircle2 size={15} />{outcome}</li>
                ))}
              </ul>
              <strong>{course.schedule}</strong>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

function CertificateVerification() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<PublicCertificateVerificationDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const resultState = loading
    ? "loading"
    : result?.valid
      ? "valid"
      : result?.error?.toLowerCase().includes("unavailable") ||
          result?.error?.toLowerCase().includes("too many") ||
          result?.error?.toLowerCase().includes("enter")
        ? "error"
        : "missing";

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) {
      setResult({ valid: false, error: "Enter a certificate code." });
      setSubmitted(true);
      return;
    }

    setLoading(true);
    setSubmitted(true);
    setResult(null);
    const response = await verifyPublicCertificateRequest(trimmed);
    setLoading(false);
    if (!response.ok || !response.data) {
      setResult({ valid: false, error: response.error ?? "Verification is unavailable." });
      toast.error("Verification unavailable", {
        description: response.error ?? "Try again later.",
      });
      return;
    }
    setResult(response.data);
    if (response.data.valid) {
      toast.success("Issued certificate verified");
    } else {
      toast.info("No issued certificate found");
    }
  };

  return (
    <main className="public-verification-main">
      <section>
        <span>
          <Award size={18} /> Certificate verification
        </span>
        <h1>Verify an issued Nile Learn certificate.</h1>
        <p>
          Enter the verification code printed on the certificate. Pending,
          revoked, or internal approval records are never exposed publicly.
        </p>
      </section>

      <form className="public-verification-card" onSubmit={submit}>
        <label>
          Verification code
          <input
            value={code}
            onChange={event => setCode(event.target.value)}
            placeholder="NCL-AR2-DEMO"
            autoComplete="off"
          />
        </label>
        <button type="submit" disabled={loading}>
          <ShieldCheck size={16} />
          {loading ? "Checking" : "Verify certificate"}
        </button>

        {submitted ? (
          <div className={`public-verification-result ${resultState}`}>
            {loading ? (
              <>
                <strong>Checking certificate</strong>
                <p>Looking for an issued Nile Learn certificate.</p>
              </>
            ) : result?.valid ? (
              <>
                <strong>Issued certificate found</strong>
                <div className="public-verification-preview">
                  <span>Verified</span>
                  <em>{result.certificate.verificationCode}</em>
                  <p>{result.certificate.studentName}</p>
                  <small>
                    {result.certificate.courseTitle}
                    {result.certificate.issuedAt
                      ? ` · issued ${new Date(result.certificate.issuedAt).toLocaleDateString()}`
                      : ""}
                  </small>
                </div>
                <div className="public-verification-actions">
                  <button type="button" onClick={() => window.print()}>
                    <ShieldCheck size={15} />
                    Print verification
                  </button>
                  <button type="button" disabled>
                    <Download size={15} />
                    PDF download pending
                  </button>
                </div>
              </>
            ) : (
              <>
                <strong>
                  {result?.error?.toLowerCase().includes("enter")
                    ? "Certificate code required"
                    : resultState === "error"
                      ? "Verification unavailable"
                      : "No issued certificate found"}
                </strong>
                <p>{result?.error ?? "Check the code and confirm the certificate has been issued."}</p>
              </>
            )}
          </div>
        ) : null}
      </form>
    </main>
  );
}

function CourseDetail({ slug }: { slug: string }) {
  const course = publicCourses.find((item) => item.slug === slug) ?? publicCourses[0];
  const modules = ["Orientation and placement", "Core lessons", "Practice and feedback", "Assessment and certificate"];

  return (
    <main>
      <section className="public-detail-hero">
        <div>
          <span>{course.level}</span>
          <h1>{course.title}</h1>
          <p>{course.description}</p>
          <div>
            <Link href="/book-free-trial">Book free trial</Link>
            <Link href="/book-placement-test">Book placement test</Link>
          </div>
        </div>
        <article>
          <BookOpen size={34} />
          <strong>Live pathway</strong>
          <p>{course.schedule}</p>
          <small>Online and branch options are coordinated by the registrar.</small>
        </article>
      </section>

      <section className="public-detail-grid">
        <article>
          <h2>Outcomes</h2>
          {course.outcomes.map((outcome) => (
            <p key={outcome}><CheckCircle2 size={16} />{outcome}</p>
          ))}
        </article>
        <article>
          <h2>Curriculum</h2>
          {modules.map((module, index) => (
            <p key={module}><span>{index + 1}</span>{module}</p>
          ))}
        </article>
        <article>
          <h2>Assessment</h2>
          <p><ShieldCheck size={16} />Quizzes, teacher feedback, attendance, and certificate eligibility are tracked in the student portal.</p>
        </article>
      </section>
    </main>
  );
}

function BookingForm({ type }: { type: "trial" | "placement" }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const schema = type === "trial" ? leadFormSchema : placementFormSchema;
  const title = type === "trial" ? "Book a free trial" : "Book a placement test";

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = schema.safeParse(values);
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Check the form");
      return;
    }
    if (type === "trial") {
      const lead = platformStore.createLead({
        fullName: result.data.fullName,
        email: result.data.email,
        phone: result.data.phone,
        country: result.data.country,
        subject: result.data.subject,
        source: "trial_form",
        notes: [
          result.data.notes,
          result.data.preferredLanguage ? `Preferred language: ${result.data.preferredLanguage}` : "",
          result.data.ageGroup ? `Age group: ${result.data.ageGroup}` : "",
          result.data.preferredSchedule ? `Preferred schedule: ${result.data.preferredSchedule}` : "",
        ]
          .filter(Boolean)
          .join(" | "),
      });
      toast.success("Trial lead created", {
        description: `Registrar queue now includes ${lead.fullName}.`,
      });
      const backend = await saveBackendRecord("lead", { ...result.data, source: "trial_form", localId: lead.id }, "public");
      if (!backend.ok) toast.warning("Saved locally; backend sync pending", { description: backend.error });
    } else {
      const data = result.data as typeof result.data & {
        branch: string;
        preferredDate: string;
        currentLevel: string;
      };
      const booking = platformStore.createPlacementBooking({
        fullName: data.fullName,
        email: data.email,
        phone: data.phone,
        branchId: mapBranchToId(data.branch),
        subject: data.subject,
        preferredDate: data.preferredDate,
        currentLevel: data.currentLevel,
      });
      toast.success("Placement booking created", {
        description: `${booking.fullName} is ready for registrar assignment.`,
      });
      const backend = await saveBackendRecord("placement", { ...data, branchId: mapBranchToId(data.branch), localId: booking.id }, "public");
      if (!backend.ok) toast.warning("Saved locally; backend sync pending", { description: backend.error });
    }
    setError(null);
    setSubmitted(true);
  };

  return (
    <main className="public-form-main">
      <section>
        <span>{type === "trial" ? "Start learning" : "Level mapping"}</span>
        <h1>{title}</h1>
        <p>
          {type === "trial"
            ? "Share your goals and schedule preferences. The registrar workflow will create a safe demo lead record."
            : "Choose a subject, branch, and preferred time. The result can later convert into an enrollment."}
        </p>
      </section>
      <form className="public-booking-form" onSubmit={submit}>
        <label>
          Full name
          <input value={values.fullName ?? ""} onChange={(event) => setValues((prev) => ({ ...prev, fullName: event.target.value }))} />
        </label>
        <label>
          Email
          <input type="email" placeholder="student.demo@nilelearn.local" value={values.email ?? ""} onChange={(event) => setValues((prev) => ({ ...prev, email: event.target.value }))} />
        </label>
        <label>
          Phone / WhatsApp
          <input value={values.phone ?? ""} onChange={(event) => setValues((prev) => ({ ...prev, phone: event.target.value }))} />
        </label>
        {type === "trial" ? (
          <>
            <label>
              Country
              <input value={values.country ?? ""} onChange={(event) => setValues((prev) => ({ ...prev, country: event.target.value }))} />
            </label>
            <label>
              Preferred language
              <select value={values.preferredLanguage ?? ""} onChange={(event) => setValues((prev) => ({ ...prev, preferredLanguage: event.target.value }))}>
                <option value="">Select language</option>
                <option>English</option>
                <option>Arabic</option>
                <option>Turkish</option>
                <option>French</option>
              </select>
            </label>
          </>
        ) : null}
        <label>
          Subject
          <select value={values.subject ?? ""} onChange={(event) => setValues((prev) => ({ ...prev, subject: event.target.value }))}>
            <option value="">Select subject</option>
            {publicCourses.slice(0, 5).map((course) => (
              <option key={course.slug} value={course.title}>{course.title}</option>
            ))}
          </select>
        </label>
        {type === "trial" ? (
          <>
            <label>
              Age group
              <select value={values.ageGroup ?? ""} onChange={(event) => setValues((prev) => ({ ...prev, ageGroup: event.target.value }))}>
                <option value="">Select age group</option>
                <option>Child</option>
                <option>Teen</option>
                <option>Adult</option>
                <option>Organization group</option>
              </select>
            </label>
            <label>
              Preferred schedule
              <input placeholder="Weekdays evening, weekends..." value={values.preferredSchedule ?? ""} onChange={(event) => setValues((prev) => ({ ...prev, preferredSchedule: event.target.value }))} />
            </label>
          </>
        ) : null}
        {type === "placement" ? (
          <>
            <label>
              Branch
              <select value={values.branch ?? ""} onChange={(event) => setValues((prev) => ({ ...prev, branch: event.target.value }))}>
                <option value="">Select branch</option>
                <option>Cairo B1</option>
                <option>Alexandria B2</option>
                <option>Online</option>
              </select>
            </label>
            <label>
              Preferred date
              <input type="date" value={values.preferredDate ?? ""} onChange={(event) => setValues((prev) => ({ ...prev, preferredDate: event.target.value }))} />
            </label>
            <label>
              Current level
              <select value={values.currentLevel ?? ""} onChange={(event) => setValues((prev) => ({ ...prev, currentLevel: event.target.value }))}>
                <option value="">Select level</option>
                <option>New beginner</option>
                <option>Some reading ability</option>
                <option>Intermediate</option>
                <option>Advanced</option>
              </select>
            </label>
          </>
        ) : null}
        <label className="full">
          Notes
          <textarea value={values.notes ?? ""} onChange={(event) => setValues((prev) => ({ ...prev, notes: event.target.value }))} />
        </label>
        {error ? <p className="public-form-error">{error}</p> : null}
        {submitted ? <p className="public-form-success"><CheckCircle2 size={16} />Request saved in the demo workflow.</p> : null}
        <button type="submit">
          <Send size={16} />
          Submit request
        </button>
      </form>
    </main>
  );
}

function mapBranchToId(branch: string) {
  if (branch === "Cairo B1") return "br_cairo";
  if (branch === "Alexandria B2") return "br_alex";
  return "br_online";
}

function StaticPublicPage({ mode }: { mode: Exclude<PublicMode, "catalog" | "course" | "trial" | "placement" | "verify"> }) {
  const content = {
    faq: {
      icon: MessageSquare,
      title: "Frequently asked questions",
      description: "Clear answers for students, parents, and organizations.",
      items: ["How do placement tests work?", "Can I study online?", "How are certificates approved?", "Can parents follow kids progress?"],
    },
    contact: {
      icon: Mail,
      title: "Contact Nile Center",
      description: "Use the trial or placement form to start. Registrar messages are tracked inside the platform.",
      items: ["Admissions and registration", "Teacher and class coordination", "Branch schedule support", "Certificate verification"],
    },
    about: {
      icon: GraduationCap,
      title: "About Nile Center",
      description: "A modern learning platform for Arabic, Quran, Islamic studies, and languages.",
      items: ["Certified teachers", "Structured programs", "Branch and online delivery", "Progress-centered operations"],
    },
    privacy: {
      icon: ShieldCheck,
      title: "Privacy",
      description: "The demo uses safe local data only. Production integrations should keep credentials in environment variables.",
      items: ["No hard-coded secrets", "Role-based route access", "Audit-ready workflows", "Integration placeholders"],
    },
    terms: {
      icon: FileTerms,
      title: "Terms",
      description: "Program policies, attendance expectations, assessment rules, and certificate requirements can be managed by admins.",
      items: ["Attendance policies", "Payment terms", "Certificate eligibility", "Support and communication"],
    },
  }[mode];
  const Icon = content.icon;

  return (
    <main className="public-static-main">
      <section>
        <span><Icon size={20} /></span>
        <h1>{content.title}</h1>
        <p>{content.description}</p>
      </section>
      <div className="public-static-grid">
        {content.items.map((item) => (
          <article key={item}>
            <Star size={17} />
            <strong>{item}</strong>
            <p>Managed through a clean Nile Learn workflow with clear status and ownership.</p>
          </article>
        ))}
      </div>
    </main>
  );
}

function FileTerms(props: { size?: number }) {
  return <Globe size={props.size ?? 20} />;
}
