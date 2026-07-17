import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  KeyRound,
  LogOut,
  Mail,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { Link } from "wouter";
import { AuthExperience } from "@/components/auth/AuthExperience";
import { clearStoredSession, setStoredRole } from "@/lib/auth/session";
import { confirmPasswordReset, requestPasswordReset } from "@/lib/backend/api";
import { isSupportedLocale, translateUiLabel, type Locale } from "@/lib/i18n";
import type { Role } from "@/lib/platformData";

type AuthFlowMode =
  | "forgot-password"
  | "reset-password"
  | "select-role"
  | "logout";

const roleOptions: { label: string; value: Role; href: string }[] = [
  { label: "Student", value: "student", href: "/app/student/dashboard" },
  { label: "Teacher", value: "teacher", href: "/app/teacher/dashboard" },
  { label: "Registrar", value: "registrar", href: "/app/registrar/dashboard" },
  { label: "HOD", value: "headofdepartment", href: "/app/hod/dashboard" },
  {
    label: "Branch Admin",
    value: "branchadmin",
    href: "/app/branch/dashboard",
  },
  { label: "Super Admin", value: "superadmin", href: "/app/admin/dashboard" },
];

function initialLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const saved = window.localStorage.getItem("nilelearn.locale");
  return isSupportedLocale(saved) ? saved : "en";
}

function isRole(value: string | null): value is Role {
  return roleOptions.some(option => option.value === value);
}

const reveal = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export default function AuthFlowPage({ mode }: { mode: AuthFlowMode }) {
  const currentSearch =
    typeof window === "undefined" ? "" : window.location.search;
  const query = useMemo(
    () => new URLSearchParams(currentSearch),
    [currentSearch]
  );
  const queryRole = query.get("role");
  const queryEmail = query.get("email") ?? "";
  const token = query.get("token") ?? "";
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [email, setEmail] = useState(queryEmail);
  const [role, setRole] = useState<Role>(
    isRole(queryRole) ? queryRole : "student"
  );
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [demoResetPath, setDemoResetPath] = useState("");
  const [logoutStatus, setLogoutStatus] = useState<
    "pending" | "success" | "error"
  >("pending");
  const logoutStarted = useRef(false);
  const ui = (label: string) => translateUiLabel(locale, label);

  const performLogout = async () => {
    setLogoutStatus("pending");
    setError("");
    const result = await clearStoredSession();
    if (!result.ok) {
      setLogoutStatus("error");
      setError(result.error);
      return;
    }
    setLogoutStatus("success");
  };

  useEffect(() => {
    if (mode !== "logout" || logoutStarted.current) return;
    logoutStarted.current = true;
    void performLogout();
  }, [mode]);

  useEffect(() => {
    if (mode !== "reset-password") return;
    setEmail(queryEmail);
    setPassword("");
    setConfirmPassword("");
    setMessage("");
    setError("");
  }, [mode, queryEmail, token]);

  const changeLocale = (nextLocale: Locale) => {
    setLocale(nextLocale);
    window.localStorage.setItem("nilelearn.locale", nextLocale);
  };

  const copy = {
    "forgot-password": {
      title: "Reset your password",
      description: "Enter your account email to receive the safe next step.",
      action: "Send reset link",
      icon: Mail,
    },
    "reset-password": {
      title: "Choose a new password",
      description: "Create a secure password for your Nile Learn account.",
      action: "Update password",
      icon: KeyRound,
    },
    "select-role": {
      title: "Choose your workspace",
      description: "Select the workspace you need for this session.",
      action: "Continue",
      icon: ShieldCheck,
    },
    logout: {
      title:
        logoutStatus === "success"
          ? "Signed out"
          : logoutStatus === "error"
            ? "Sign out not confirmed"
            : "Signing out",
      description:
        logoutStatus === "success"
          ? "Your Nile Learn session has ended safely."
          : logoutStatus === "error"
            ? "Your session was kept unchanged. Try again when the server is available."
            : "Waiting for the server to confirm your session has ended.",
      action: "Return to login",
      icon: LogOut,
    },
  }[mode];
  const Icon = copy.icon;
  const variant = role === "student" ? "student" : "administration";

  const requestReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setDemoResetPath("");
    if (!email.trim()) {
      setError(ui("Enter the account email."));
      return;
    }
    setSubmitting(true);
    const response = await requestPasswordReset({ email: email.trim(), role });
    setSubmitting(false);
    if (!response.ok || !response.data) {
      setError(response.error ?? ui("Reset request failed."));
      return;
    }
    setMessage(ui("If this account exists, reset instructions are ready."));
    setDemoResetPath(response.data.demoResetPath ?? "");
  };

  const confirmReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!token) {
      setError(ui("Open this page from a valid reset link."));
      return;
    }
    if (!email.trim()) {
      setError(ui("Enter the account email."));
      return;
    }
    if (password.length < 8) {
      setError(ui("Use at least 8 characters."));
      return;
    }
    if (password !== confirmPassword) {
      setError(ui("Passwords do not match."));
      return;
    }
    setSubmitting(true);
    const response = await confirmPasswordReset({
      token,
      email: email.trim(),
      password,
    });
    setSubmitting(false);
    if (!response.ok) {
      setError(response.error ?? ui("Password reset failed."));
      return;
    }
    setMessage(ui("Password updated. You can sign in now."));
  };

  return (
    <AuthExperience
      variant={
        mode === "select-role" || mode === "logout" ? "gateway" : variant
      }
      locale={locale}
      onLocaleChange={changeLocale}
    >
      <motion.div
        className="auth-v2-form-wrap auth-v2-flow"
        initial="hidden"
        animate="visible"
        variants={reveal}
      >
        <Link href="/auth/login" className="auth-v2-back">
          <ArrowLeft size={16} aria-hidden="true" />
          {ui("Portal selection")}
        </Link>

        <div className="auth-v2-heading">
          <span className="auth-v2-heading-icon" aria-hidden="true">
            <Icon size={22} />
          </span>
          <h1>{ui(copy.title)}</h1>
          <p>{ui(copy.description)}</p>
        </div>

        {mode === "select-role" ? (
          <nav
            className="auth-v2-role-list"
            aria-label={ui("Choose your workspace")}
          >
            {roleOptions.map(option => (
              <Link
                key={option.value}
                href={option.href}
                onClick={() => setStoredRole(option.value)}
              >
                <span>{ui(option.label)}</span>
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            ))}
          </nav>
        ) : mode === "forgot-password" ? (
          <form className="auth-v2-form" onSubmit={requestReset}>
            <label className="auth-v2-field">
              <span>{ui("Account email")}</span>
              <input
                type="email"
                autoComplete="email"
                placeholder="name@example.com"
                value={email}
                onChange={event => setEmail(event.target.value)}
                required
              />
            </label>
            <label className="auth-v2-field">
              <span>{ui("Workspace")}</span>
              <select
                value={role}
                onChange={event => setRole(event.target.value as Role)}
              >
                {roleOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {ui(option.label)}
                  </option>
                ))}
              </select>
            </label>
            <AuthStatus error={error} message={message} />
            {demoResetPath ? (
              <Link href={demoResetPath} className="auth-v2-secondary-action">
                {ui("Open demo reset link")}
                <ArrowRight size={16} />
              </Link>
            ) : null}
            <button
              className="auth-v2-submit"
              type="submit"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <span className="auth-v2-spinner" /> {ui("Sending")}
                </>
              ) : (
                <>
                  {ui(copy.action)} <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>
        ) : mode === "reset-password" ? (
          <form className="auth-v2-form" onSubmit={confirmReset}>
            <label className="auth-v2-field">
              <span>{ui("Account email")}</span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={event => setEmail(event.target.value)}
                required
              />
            </label>
            <label className="auth-v2-field">
              <span>{ui("New password")}</span>
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                required
              />
            </label>
            <label className="auth-v2-field">
              <span>{ui("Confirm password")}</span>
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={event => setConfirmPassword(event.target.value)}
                required
              />
            </label>
            <AuthStatus error={error} message={message} />
            {message ? (
              <Link href="/auth/login" className="auth-v2-secondary-action">
                {ui("Return to login")}
                <ArrowRight size={16} />
              </Link>
            ) : null}
            <button
              className="auth-v2-submit"
              type="submit"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <span className="auth-v2-spinner" /> {ui("Updating")}
                </>
              ) : (
                <>
                  {ui(copy.action)} <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>
        ) : (
          <div className="auth-v2-logout" aria-live="polite">
            {logoutStatus === "pending" ? (
              <p className="auth-v2-status">
                <span className="auth-v2-spinner dark" />{" "}
                {ui("Confirming sign out")}
              </p>
            ) : null}
            {logoutStatus === "error" ? (
              <>
                <AuthStatus error={error} message="" />
                <button
                  type="button"
                  className="auth-v2-submit"
                  onClick={() => void performLogout()}
                >
                  <RefreshCw size={17} /> {ui("Try again")}
                </button>
              </>
            ) : null}
            {logoutStatus === "success" ? (
              <>
                <p className="auth-v2-status success">
                  <CheckCircle2 size={17} /> {ui("Session ended safely")}
                </p>
                <Link
                  href="/auth/login"
                  className="auth-v2-submit auth-v2-submit-link"
                >
                  {ui(copy.action)} <ArrowRight size={17} />
                </Link>
              </>
            ) : null}
          </div>
        )}
      </motion.div>
    </AuthExperience>
  );
}

function AuthStatus({ error, message }: { error: string; message: string }) {
  return (
    <>
      {error ? (
        <p className="auth-v2-status error" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="auth-v2-status success" role="status">
          <CheckCircle2 size={17} /> {message}
        </p>
      ) : null}
    </>
  );
}
