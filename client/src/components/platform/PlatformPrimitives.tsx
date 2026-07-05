import { motion } from "framer-motion";
import type { ReactNode } from "react";

export const platformReveal = {
  hidden: { opacity: 0, y: 18 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.42, delay, ease: [0.23, 1, 0.32, 1] as const },
  }),
};

export function PlatformPageHeader({
  title,
  description,
  context,
  actions,
  compact = false,
}: {
  title: ReactNode;
  description?: ReactNode;
  context?: ReactNode;
  actions?: ReactNode;
  compact?: boolean;
}) {
  return (
    <motion.section
      className={`platform-page-header${compact ? " compact" : ""}`}
      initial="hidden"
      animate="visible"
      custom={0}
      variants={platformReveal}
    >
      <div className="platform-page-header-copy">
        {context ? <div className="platform-page-context">{context}</div> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="platform-header-actions">{actions}</div> : null}
    </motion.section>
  );
}

export function PlatformWorkspaceHeader({
  title,
  description,
  context,
  meta,
  actions,
  aside,
  className = "",
  copyClassName = "",
  actionsClassName = "platform-workspace-actions",
}: {
  title: ReactNode;
  description?: ReactNode;
  context?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  aside?: ReactNode;
  className?: string;
  copyClassName?: string;
  actionsClassName?: string;
}) {
  return (
    <section className={`platform-workspace-header ${className}`.trim()}>
      <div className={`platform-workspace-header-copy ${copyClassName}`.trim()}>
        {context ? <div className="platform-page-context">{context}</div> : null}
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
        {meta}
      </div>
      {actions ? <div className={actionsClassName}>{actions}</div> : null}
      {aside}
    </section>
  );
}

export function StatCard({
  label,
  value,
  change,
  tone = "slate",
  delay = 0,
}: {
  label: ReactNode;
  value: ReactNode;
  change?: ReactNode;
  tone?: "teal" | "amber" | "green" | "red" | "purple" | "slate";
  delay?: number;
}) {
  const toneColor: Record<string, string> = {
    teal: "#1A4A3A",
    amber: "#C4A35A",
    green: "#2D5016",
    red: "#C75B39",
    purple: "#3D1A5C",
    slate: "#1A1A1A",
  };
  return (
    <motion.article
      className="platform-metric"
      custom={delay}
      variants={platformReveal}
      whileHover={{ y: -1, boxShadow: "0 12px 28px -12px rgba(0,0,0,0.14)" }}
      transition={{ duration: 0.2 }}
    >
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      {change ? (
        <small style={{ color: toneColor[tone], background: `${toneColor[tone]}14` }}>
          {change}
        </small>
      ) : null}
    </motion.article>
  );
}

export function StatusBadge({
  children,
  tone = "slate"
}: {
  children: ReactNode;
  tone?: "teal" | "amber" | "green" | "red" | "purple" | "slate"
}) {
  const toneColor: Record<string, string> = {
    teal: "#1A4A3A",
    amber: "#C4A35A",
    green: "#2D5016",
    red: "#C75B39",
    purple: "#3D1A5C",
    slate: "#1A1A1A",
  };
  return (
    <span className="platform-status" style={{ color: toneColor[tone], background: `${toneColor[tone]}14` }}>
      {children}
    </span>
  );
}

export function DataTableCard({
  title,
  subtitle,
  className = "",
  delay = 0,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  className?: string;
  delay?: number;
  children: ReactNode;
}) {
  return (
    <motion.article
      className={`platform-table-card ${className}`.trim()}
      custom={delay}
      variants={platformReveal}
      whileHover={{ y: -2, boxShadow: "0 16px 40px -8px rgba(0,0,0,0.08)" }}
      transition={{ duration: 0.2 }}
    >
      <div className="platform-card-title compact">
        <div>
          {subtitle ? <span>{subtitle}</span> : null}
          <strong>{title}</strong>
        </div>
      </div>
      {children}
    </motion.article>
  );
}
