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
