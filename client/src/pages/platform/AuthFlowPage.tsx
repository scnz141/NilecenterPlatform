import { useEffect } from "react";
import { Link } from "wouter";
import { ArrowLeft, CheckCircle2, KeyRound, Mail, ShieldCheck } from "lucide-react";
import { clearStoredSession, setStoredRole } from "@/lib/auth/session";
import type { Role } from "@/lib/platformData";

export default function AuthFlowPage({ mode }: { mode: "forgot-password" | "reset-password" | "select-role" | "logout" }) {
  useEffect(() => {
    if (mode === "logout") clearStoredSession();
  }, [mode]);

  const copy = {
    "forgot-password": {
      title: "Reset your password",
      description: "Enter your account email and Nile Learn will send the next step when email delivery is connected.",
      action: "Send reset link",
      icon: Mail,
    },
    "reset-password": {
      title: "Choose a new password",
      description: "This secure reset screen is wired for the future auth provider and does not store credentials locally.",
      action: "Update password",
      icon: ShieldCheck,
    },
    "select-role": {
      title: "Select your role",
      description: "Users with multiple roles can choose the workspace they need for this session.",
      action: "Continue",
      icon: CheckCircle2,
    },
    logout: {
      title: "Signed out",
      description: "Your local demo session has ended.",
      action: "Return to login",
      icon: CheckCircle2,
    },
  }[mode];
  const quote = {
    "forgot-password": {
      arabic: "وَعَلَى اللَّهِ فَتَوَكَّلُوا",
      meaning: "Trust the process, then return with clarity.",
      source: "Qur'an 5:23",
    },
    "reset-password": {
      arabic: "إِنَّ مَعَ الْعُسْرِ يُسْرًا",
      meaning: "With hardship comes ease.",
      source: "Qur'an 94:6",
    },
    "select-role": {
      arabic: "رَبِّ زِدْنِي عِلْمًا",
      meaning: "My Lord, increase me in knowledge.",
      source: "Qur'an 20:114",
    },
    logout: {
      arabic: "وَاللَّهُ خَيْرٌ حَافِظًا",
      meaning: "Allah is the best guardian.",
      source: "Qur'an 12:64",
    },
  }[mode];
  const Icon = copy.icon;

  return (
    <div className="auth-flow-page">
      <div className="auth-flow-card">
        <Link href="/auth/login" className="auth-back-link">
          <ArrowLeft size={15} />
          Login
        </Link>
        <span className="auth-flow-icon">
          <Icon size={22} />
        </span>
        <h1>{copy.title}</h1>
        <p>{copy.description}</p>
        <div className="auth-flow-calligraphy" aria-label="Nile Learn inspiration">
          <span aria-hidden="true">
            <KeyRound size={15} />
          </span>
          <strong lang="ar" dir="rtl">{quote.arabic}</strong>
          <p>{quote.meaning}</p>
          <small>{quote.source}</small>
        </div>
        {mode === "select-role" ? (
          <div className="auth-role-list">
            {[
              ["Student", "student", "/app/student/dashboard"],
              ["Teacher", "teacher", "/app/teacher/dashboard"],
              ["Registrar", "registrar", "/app/registrar/dashboard"],
              ["HOD", "headofdepartment", "/app/hod/dashboard"],
              ["Branch Admin", "branchadmin", "/app/branch/dashboard"],
              ["Super Admin", "superadmin", "/app/admin/dashboard"],
            ].map(([label, role, href]) => (
              <Link key={label} href={href} onClick={() => setStoredRole(role as Role)}>
                {label}
              </Link>
            ))}
          </div>
        ) : mode === "logout" ? null : (
          <form>
            <label className="auth-flow-field">
              {mode === "reset-password" ? "New password" : "Account email"}
              <input
                type={mode === "reset-password" ? "password" : "email"}
                autoComplete={mode === "reset-password" ? "new-password" : "email"}
                placeholder={mode === "reset-password" ? "New password" : "name@example.com"}
              />
            </label>
            {mode === "reset-password" ? (
              <label className="auth-flow-field">
                Confirm password
                <input type="password" autoComplete="new-password" placeholder="Confirm password" />
              </label>
            ) : null}
            <button type="button">{copy.action}</button>
          </form>
        )}
        {mode === "logout" ? (
          <Link href="/auth/login" className="auth-submit-link">
            {copy.action}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
