import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { motion } from "framer-motion";
import { Link, useLocation } from "wouter";
import { ArrowLeft, ArrowRight, BookOpen, Eye, EyeOff, Globe, GraduationCap, ShieldCheck, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";
import { signInWithPassword } from "@/lib/auth/session";
import { roleInspirations, type Role, type RoleInspiration } from "@/lib/platformData";

type LoginAudience = "gateway" | "student" | "administration";

const roles = [
  { id: "student", label: "Student", color: "#2D5016", route: "/app/student/dashboard", desc: "Courses, progress, certificates", email: "student.demo@nilelearn.local" },
  { id: "teacher", label: "Teacher", color: "#1A3A5C", route: "/app/teacher/dashboard", desc: "Classes, attendance, grading", email: "teacher.demo@nilelearn.local" },
  { id: "registrar", label: "Registrar", color: "#5C2D00", route: "/app/registrar/dashboard", desc: "Admissions and payments", email: "registrar.demo@nilelearn.local" },
  { id: "headofdepartment", label: "Head of Dept", color: "#3D1A5C", route: "/app/hod/dashboard", desc: "Academic oversight", email: "hod.demo@nilelearn.local" },
  { id: "branchadmin", label: "Branch Admin", color: "#1A4A3A", route: "/app/branch/dashboard", desc: "Branch operations", email: "branch.demo@nilelearn.local" },
  { id: "superadmin", label: "Super Admin", color: "#4A3A1A", route: "/app/admin/dashboard", desc: "Platform administration", email: "admin.demo@nilelearn.local" },
] as const;

const panels = [
  {
    href: "/auth/student-login",
    icon: GraduationCap,
    label: "Student portal",
    title: "Learning workspace",
    copy: "Courses, live classes, assignments, Quran progress, certificates, and support in one focused student route.",
  },
  {
    href: "/auth/administration-login",
    icon: ShieldCheck,
    label: "Administration portal",
    title: "Operations workspace",
    copy: "Teacher, registrar, HOD, branch, and super-admin access are separated from the learner sign-in path.",
  },
];

const reveal = {
  hidden: { opacity: 0, y: 24 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.48, delay, ease: [0.23, 1, 0.32, 1] as const },
  }),
};

const gatewayInspiration: RoleInspiration = {
  arabic: "اقْرَأْ بِاسْمِ رَبِّكَ",
  meaning: "Begin every path of learning with purpose.",
  source: "Qur'an 96:1",
  theme: "Nile Learn",
};

export default function Login({ audience = "gateway" }: { audience?: LoginAudience }) {
  if (audience === "gateway") return <LoginGateway />;
  return <LoginForm audience={audience} />;
}

function LoginGateway() {
  return (
    <main className="auth-modern-page">
      <AuthBrandRail quote={gatewayInspiration} />
      <motion.section className="auth-gateway" initial="hidden" animate="visible">
        <motion.div className="auth-gateway-copy" custom={0} variants={reveal}>
          <Link href="/" className="auth-modern-logo">
            <span>NC</span>
            Nile Center
          </Link>
          <span className="auth-kicker"><Sparkles size={15} /> Choose your portal</span>
          <h1>One platform, separate access for learners and operations.</h1>
          <p>Student learning and administration workflows now enter through separate routes so each role starts in the right context.</p>
        </motion.div>

        <div className="auth-portal-grid">
          {panels.map((panel, index) => {
            const Icon = panel.icon;
            return (
              <motion.div key={panel.href} custom={0.1 + index * 0.08} variants={reveal}>
                <Link href={panel.href} className="auth-portal-card">
                  <span><Icon size={22} /></span>
                  <small>{panel.label}</small>
                  <strong>{panel.title}</strong>
                  <p>{panel.copy}</p>
                  <em>Continue <ArrowRight size={15} /></em>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </motion.section>
    </main>
  );
}

function LoginForm({ audience }: { audience: Exclude<LoginAudience, "gateway"> }) {
  const [, navigate] = useLocation();
  const availableRoles = useMemo(() => roles.filter((role) => (audience === "student" ? role.id === "student" : role.id !== "student")), [audience]);
  const [role, setRole] = useState<Role>(availableRoles[0].id);
  const currentRole = roles.find((item) => item.id === role) ?? roles[0];
  const [email, setEmail] = useState<string>(currentRole.email);
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(false);
  const [language, setLanguage] = useState("English");
  const [loading, setLoading] = useState(false);

  const pageTitle = audience === "student" ? "Student sign in" : "Administration sign in";
  const pageCopy =
    audience === "student"
      ? "Open your courses, schedule, assignments, grades, Quran progress, and certificates."
      : "Use the staff route for teaching, admissions, academic, branch, and platform operations.";

  const handleRoleChange = (nextRole: Role) => {
    const next = roles.find((item) => item.id === nextRole);
    if (!next) return;
    setRole(nextRole);
    if (!email || email === currentRole.email) setEmail(next.email);
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    const result = await signInWithPassword(email, password, role);
    setLoading(false);

    if (!result.ok) {
      toast.error("Sign in failed", { description: result.error });
      return;
    }

    toast.success(`Signed in as ${currentRole.label}`, { description: `Session provider: ${result.session.provider}` });
    if (remember) localStorage.setItem("nile-demo-remember", "true");
    navigate(currentRole.route);
  };

  return (
    <main className="auth-modern-page">
      <AuthBrandRail quote={roleInspirations[role]} />
      <motion.section className="auth-login-panel" initial="hidden" animate="visible">
        <motion.div className="auth-login-card" custom={0} variants={reveal}>
          <div className="auth-login-heading">
            <Link href="/auth/login" className="auth-back-link">
              <ArrowLeft size={15} />
              Portal selection
            </Link>
            <span className="auth-login-icon">{audience === "student" ? <GraduationCap size={22} /> : <ShieldCheck size={22} />}</span>
            <h1>{pageTitle}</h1>
            <p>{pageCopy}</p>
          </div>

          {audience === "administration" ? (
            <div className="auth-role-switcher" aria-label="Administration role">
              {availableRoles.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={role === item.id ? "active" : ""}
                  style={{ "--role-color": item.color } as CSSProperties}
                  onClick={() => handleRoleChange(item.id)}
                >
                  <strong>{item.label}</strong>
                  <small>{item.desc}</small>
                </button>
              ))}
            </div>
          ) : null}

          <form className="auth-login-form" onSubmit={handleLogin}>
            <label>
              Email
              <input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder={currentRole.email} required />
            </label>
            <label>
              <span>
                Password
                <Link href="/auth/forgot-password">Forgot?</Link>
              </span>
              <div className="auth-password-field">
                <input
                  type={showPass ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter password"
                  required
                />
                <button type="button" onClick={() => setShowPass((value) => !value)} aria-label={showPass ? "Hide password" : "Show password"}>
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </label>

            <div className="auth-login-options">
              <label>
                <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
                Remember me
              </label>
              <select value={language} onChange={(event) => setLanguage(event.target.value)} aria-label="Language">
                <option>English</option>
                <option>Arabic</option>
              </select>
            </div>

            <button type="submit" className="auth-login-submit" disabled={loading}>
              {loading ? <span className="auth-submit-spinner" /> : <><span>Sign in</span><ArrowRight size={15} /></>}
            </button>
          </form>

          <div className="auth-route-note">
            {audience === "student" ? (
              <Link href="/auth/administration-login"><Users size={15} /> Staff and administration sign in</Link>
            ) : (
              <Link href="/auth/student-login"><GraduationCap size={15} /> Student sign in</Link>
            )}
          </div>
        </motion.div>
      </motion.section>
    </main>
  );
}

function AuthBrandRail({ quote }: { quote: RoleInspiration }) {
  return (
    <motion.aside className="auth-brand-rail" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.55 }}>
      <div className="auth-orbit" />
      <Link href="/" className="auth-modern-logo">
        <span>NC</span>
        Nile Center
      </Link>
      <div className="auth-calligraphy-panel" aria-label={`${quote.theme} inspiration`}>
        <span aria-hidden="true">۞</span>
        <strong lang="ar" dir="rtl">{quote.arabic}</strong>
        <p>{quote.meaning}</p>
        <small>{quote.source}</small>
      </div>
      <div className="auth-brand-copy">
        <span><BookOpen size={16} /> Nile Learn</span>
        <h2>Education operations with a calm, modern workspace.</h2>
        <p>Arabic, Quran, language learning, admissions, scheduling, certificates, reports, and administration now share one platform foundation.</p>
      </div>
      <div className="auth-brand-stats">
        <div><strong>5k+</strong><span>Students</span></div>
        <div><strong>295+</strong><span>Courses</span></div>
        <div><strong>6</strong><span>Roles</span></div>
      </div>
      <a href="https://nilecenter.online" target="_blank" rel="noopener noreferrer" className="auth-moodle-link">
        <Globe size={15} />
        Moodle LMS
        <ArrowRight size={14} />
      </a>
    </motion.aside>
  );
}
