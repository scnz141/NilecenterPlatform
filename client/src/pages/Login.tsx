import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  GraduationCap,
  ShieldCheck,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { AuthExperience } from "@/components/auth/AuthExperience";
import { signInWithPassword } from "@/lib/auth/session";
import { isSupportedLocale, translateUiLabel, type Locale } from "@/lib/i18n";
import type { Role } from "@/lib/platformData";

type LoginAudience = "gateway" | "student" | "administration";

const REMEMBERED_EMAIL_KEY = "nilelearn.auth.rememberedEmail";
const REMEMBERED_ROLE_KEY = "nilelearn.auth.rememberedRole";

const roles = [
  {
    id: "student",
    label: "Student",
    route: "/app/student/dashboard",
    desc: "Courses, progress, certificates",
    email: "s@nl.test",
  },
  {
    id: "teacher",
    label: "Teacher",
    route: "/app/teacher/dashboard",
    desc: "Classes, attendance, grading",
    email: "t@nl.test",
  },
  {
    id: "registrar",
    label: "Registrar",
    route: "/app/registrar/dashboard",
    desc: "Admissions and payments",
    email: "r@nl.test",
  },
  {
    id: "headofdepartment",
    label: "Head of Dept",
    route: "/app/hod/dashboard",
    desc: "Academic oversight",
    email: "h@nl.test",
  },
  {
    id: "branchadmin",
    label: "Branch Admin",
    route: "/app/branch/dashboard",
    desc: "Branch operations",
    email: "b@nl.test",
  },
  {
    id: "superadmin",
    label: "Super Admin",
    route: "/app/admin/dashboard",
    desc: "Platform administration",
    email: "a@nl.test",
  },
] as const;

const reveal = {
  hidden: { opacity: 0, y: 12 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.42,
      delay,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  }),
};

function initialLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const saved = window.localStorage.getItem("nilelearn.locale");
  return isSupportedLocale(saved) ? saved : "en";
}

function isRole(value: string | null): value is Role {
  return roles.some(role => role.id === value);
}

function getRememberedRole(audience: Exclude<LoginAudience, "gateway">): Role {
  if (audience === "student" || typeof window === "undefined") return "student";
  const saved = window.localStorage.getItem(REMEMBERED_ROLE_KEY);
  return isRole(saved) && saved !== "student" ? saved : "teacher";
}

export default function Login({
  audience = "gateway",
}: {
  audience?: LoginAudience;
}) {
  if (audience === "gateway") return <LoginGateway />;
  return <LoginForm audience={audience} />;
}

function LoginGateway() {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const ui = (label: string) => translateUiLabel(locale, label);

  const changeLocale = (nextLocale: Locale) => {
    setLocale(nextLocale);
    window.localStorage.setItem("nilelearn.locale", nextLocale);
  };

  return (
    <AuthExperience
      variant="gateway"
      locale={locale}
      onLocaleChange={changeLocale}
    >
      <motion.div
        className="auth-v2-gateway-content"
        initial="hidden"
        animate="visible"
      >
        <motion.div custom={0} variants={reveal}>
          <h1>{ui("Choose your workspace")}</h1>
          <p>
            {ui(
              "Student learning and school operations have separate, focused sign-in paths."
            )}
          </p>
        </motion.div>

        <nav
          className="auth-v2-portal-list"
          aria-label={ui("Choose your portal")}
        >
          <motion.div custom={0.08} variants={reveal}>
            <Link href="/auth/student-login" className="auth-v2-portal-option">
              <span className="auth-v2-portal-icon">
                <GraduationCap size={22} aria-hidden="true" />
              </span>
              <span>
                <strong>{ui("Student portal")}</strong>
                <small>
                  {ui("Courses, assignments, progress, and support.")}
                </small>
              </span>
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </motion.div>
          <motion.div custom={0.14} variants={reveal}>
            <Link
              href="/auth/administration-login"
              className="auth-v2-portal-option"
            >
              <span className="auth-v2-portal-icon">
                <ShieldCheck size={22} aria-hidden="true" />
              </span>
              <span>
                <strong>{ui("Administration portal")}</strong>
                <small>
                  {ui("Teaching, admissions, academic, and school operations.")}
                </small>
              </span>
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </motion.div>
        </nav>
      </motion.div>
    </AuthExperience>
  );
}

function LoginForm({
  audience,
}: {
  audience: Exclude<LoginAudience, "gateway">;
}) {
  const [, navigate] = useLocation();
  const availableRoles = useMemo(
    () =>
      roles.filter(role =>
        audience === "student" ? role.id === "student" : role.id !== "student"
      ),
    [audience]
  );
  const initialRole = getRememberedRole(audience);
  const initialRoleData =
    roles.find(item => item.id === initialRole) ?? roles[0];
  const rememberedEmail =
    typeof window === "undefined"
      ? ""
      : (window.localStorage.getItem(REMEMBERED_EMAIL_KEY) ?? "");
  const rememberedRole =
    typeof window === "undefined"
      ? ""
      : (window.localStorage.getItem(REMEMBERED_ROLE_KEY) ?? "");

  const [role, setRole] = useState<Role>(initialRole);
  const [email, setEmail] = useState(
    rememberedEmail && rememberedRole === initialRole
      ? rememberedEmail
      : initialRoleData.email
  );
  const [emailTouched, setEmailTouched] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(
    Boolean(rememberedEmail && rememberedRole === initialRole)
  );
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [loading, setLoading] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [formError, setFormError] = useState("");
  const currentRole = roles.find(item => item.id === role) ?? roles[0];
  const ui = (label: string) => translateUiLabel(locale, label);

  const pageTitle =
    audience === "student" ? "Student sign in" : "Administration sign in";
  const pageCopy =
    audience === "student"
      ? "Use your student account to continue learning."
      : "Use your school account to continue to your workspace.";

  const changeLocale = (nextLocale: Locale) => {
    setLocale(nextLocale);
    window.localStorage.setItem("nilelearn.locale", nextLocale);
  };

  const handleRoleChange = (nextRole: Role) => {
    const next = roles.find(item => item.id === nextRole);
    if (!next) return;
    setRole(nextRole);
    if (!emailTouched) setEmail(next.email);
  };

  const handleRememberChange = (checked: boolean) => {
    setRemember(checked);
    if (!checked) {
      window.localStorage.removeItem(REMEMBERED_EMAIL_KEY);
      window.localStorage.removeItem(REMEMBERED_ROLE_KEY);
    }
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError("");
    setLoading(true);
    const result = await signInWithPassword(email.trim(), password, role);

    if (!result.ok) {
      setLoading(false);
      setFormError(result.error);
      toast.error(ui("Sign in failed"), { description: result.error });
      return;
    }

    if (remember) {
      window.localStorage.setItem(REMEMBERED_EMAIL_KEY, email.trim());
      window.localStorage.setItem(REMEMBERED_ROLE_KEY, role);
    } else {
      window.localStorage.removeItem(REMEMBERED_EMAIL_KEY);
      window.localStorage.removeItem(REMEMBERED_ROLE_KEY);
    }

    setSignedIn(true);
    toast.success(ui("Signed in"), {
      description: ui("Opening workspace"),
    });
    await new Promise(resolve => window.setTimeout(resolve, 180));
    navigate(currentRole.route);
  };

  const forgotParams = new URLSearchParams({ role, email: email.trim() });

  return (
    <AuthExperience
      variant={audience}
      locale={locale}
      onLocaleChange={changeLocale}
    >
      <motion.div
        className="auth-v2-form-wrap"
        initial="hidden"
        animate="visible"
        custom={0}
        variants={reveal}
      >
        <Link href="/auth/login" className="auth-v2-back">
          <ArrowLeft size={16} aria-hidden="true" />
          {ui("Portal selection")}
        </Link>

        <div className="auth-v2-heading">
          <span className="auth-v2-heading-icon" aria-hidden="true">
            {audience === "student" ? (
              <GraduationCap size={22} />
            ) : (
              <ShieldCheck size={22} />
            )}
          </span>
          <h1>{ui(pageTitle)}</h1>
          <p>{ui(pageCopy)}</p>
        </div>

        <form
          className="auth-v2-form"
          onSubmit={handleLogin}
          aria-busy={loading}
        >
          {audience === "administration" ? (
            <label className="auth-v2-field">
              <span>{ui("Workspace")}</span>
              <select
                value={role}
                onChange={event => handleRoleChange(event.target.value as Role)}
                aria-describedby="auth-role-description"
              >
                {availableRoles.map(item => (
                  <option key={item.id} value={item.id}>
                    {ui(item.label)}
                  </option>
                ))}
              </select>
              <small id="auth-role-description">{ui(currentRole.desc)}</small>
            </label>
          ) : null}

          <label className="auth-v2-field">
            <span>{ui("Email")}</span>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={event => {
                setEmail(event.target.value);
                setEmailTouched(true);
              }}
              placeholder={currentRole.email}
              required
            />
          </label>

          <label className="auth-v2-field">
            <span className="auth-v2-field-heading">
              <span>{ui("Password")}</span>
              <Link href={`/auth/forgot-password?${forgotParams.toString()}`}>
                {ui("Forgot password?")}
              </Link>
            </span>
            <span className="auth-v2-password">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                placeholder={ui("Enter password")}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(value => !value)}
                aria-label={ui(
                  showPassword ? "Hide password" : "Show password"
                )}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </span>
          </label>

          <label className="auth-v2-remember">
            <input
              type="checkbox"
              checked={remember}
              onChange={event => handleRememberChange(event.target.checked)}
            />
            <span>
              <strong>{ui("Remember email and workspace")}</strong>
              <small>{ui("Never saves your password.")}</small>
            </span>
          </label>

          {formError ? (
            <p className="auth-v2-status error" role="alert">
              {formError}
            </p>
          ) : null}

          <button
            type="submit"
            className="auth-v2-submit"
            disabled={loading || signedIn}
          >
            {signedIn ? (
              <>
                <CheckCircle2 size={18} /> {ui("Opening workspace")}
              </>
            ) : loading ? (
              <>
                <span className="auth-v2-spinner" /> {ui("Signing in")}
              </>
            ) : (
              <>
                {ui("Sign in")} <ArrowRight size={17} aria-hidden="true" />
              </>
            )}
          </button>
        </form>

        <div className="auth-v2-route-switch">
          {audience === "student" ? (
            <Link href="/auth/administration-login">
              <ShieldCheck size={16} />
              {ui("Staff and administration sign in")}
            </Link>
          ) : (
            <Link href="/auth/student-login">
              <GraduationCap size={16} />
              {ui("Student sign in")}
            </Link>
          )}
        </div>
      </motion.div>
    </AuthExperience>
  );
}
