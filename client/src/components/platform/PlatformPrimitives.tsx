import { motion } from "framer-motion";
import { isValidElement, type ReactNode } from "react";
import { useUiLabel } from "@/lib/i18n-context";

export const platformReveal = {
  hidden: { opacity: 0, y: 18 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.42, delay, ease: [0.23, 1, 0.32, 1] as const },
  }),
};

const genericRoleContexts = new Set([
  "admin",
  "branch admin",
  "head of department",
  "hod",
  "registrar",
  "student",
  "super admin",
  "teacher",
]);

function shouldShowContext(context: ReactNode) {
  if (typeof context === "string") {
    return !genericRoleContexts.has(context.trim().toLowerCase());
  }
  if (isValidElement<{ children?: ReactNode }>(context)) {
    const child = context.props.children;
    if (typeof child === "string") {
      return !genericRoleContexts.has(child.trim().toLowerCase());
    }
  }
  return Boolean(context);
}

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
  const ui = useUiLabel();
  return (
    <motion.section
      className={`platform-page-header${compact ? " compact" : ""}`}
      initial="hidden"
      animate="visible"
      custom={0}
      variants={platformReveal}
    >
      <div className="platform-page-header-copy">
        {shouldShowContext(context) ? (
          <div className="platform-page-context">{ui(context)}</div>
        ) : null}
        <h1>{ui(title)}</h1>
        {description ? <p>{ui(description)}</p> : null}
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
  const ui = useUiLabel();
  return (
    <section className={`platform-workspace-header ${className}`.trim()}>
      <div className={`platform-workspace-header-copy ${copyClassName}`.trim()}>
        {shouldShowContext(context) ? (
          <div className="platform-page-context">{ui(context)}</div>
        ) : null}
        <h2>{ui(title)}</h2>
        {description ? <p>{ui(description)}</p> : null}
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
  const ui = useUiLabel();
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
      transition={{ duration: 0.2 }}
    >
      <div>
        <span>{ui(label)}</span>
        <strong>{value}</strong>
      </div>
      {change ? (
        <small style={{ color: toneColor[tone], background: `${toneColor[tone]}14` }}>
          {ui(change)}
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
  const ui = useUiLabel();
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
      {ui(children)}
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
  const ui = useUiLabel();
  return (
    <motion.article
      className={`platform-table-card ${className}`.trim()}
      custom={delay}
      variants={platformReveal}
      transition={{ duration: 0.2 }}
    >
      <div className="platform-card-title compact">
        <div>
          {subtitle ? <span>{ui(subtitle)}</span> : null}
          <strong>{ui(title)}</strong>
        </div>
      </div>
      {children}
    </motion.article>
  );
}
