import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { PlatformPageHeader, platformReveal } from "./PlatformPrimitives";

export type PlatformLayoutArchetype =
  | "dashboard"
  | "workspace"
  | "detail"
  | "form-flow"
  | "report"
  | "settings";

type BaseLayoutProps = {
  archetype: PlatformLayoutArchetype;
  title: ReactNode;
  description?: ReactNode;
  context?: ReactNode;
  actions?: ReactNode;
  toolbar?: ReactNode;
  main: ReactNode;
  side?: ReactNode;
  footer?: ReactNode;
  className?: string;
};

function BaseLayout({
  archetype,
  title,
  description,
  context,
  actions,
  toolbar,
  main,
  side,
  footer,
  className = "",
}: BaseLayoutProps) {
  return (
    <div className={`platform-v2-layout platform-v2-${archetype}-layout ${className}`.trim()} data-layout={archetype}>
      <PlatformPageHeader compact title={title} description={description} context={context} actions={actions} />
      {toolbar ? (
        <motion.div className="platform-v2-layout-toolbar" initial="hidden" animate="visible" custom={0.08} variants={platformReveal}>
          {toolbar}
        </motion.div>
      ) : null}
      <motion.div className="platform-v2-layout-grid" initial="hidden" animate="visible" custom={0.14} variants={platformReveal}>
        <main className="platform-v2-layout-main">{main}</main>
        {side ? <aside className="platform-v2-layout-side">{side}</aside> : null}
      </motion.div>
      {footer ? (
        <motion.div className="platform-v2-layout-footer" initial="hidden" animate="visible" custom={0.2} variants={platformReveal}>
          {footer}
        </motion.div>
      ) : null}
    </div>
  );
}

export type PlatformLayoutProps = Omit<BaseLayoutProps, "archetype">;

export function DashboardLayout(props: PlatformLayoutProps) {
  return <BaseLayout {...props} archetype="dashboard" />;
}

export function WorkspaceLayout(props: PlatformLayoutProps) {
  return <BaseLayout {...props} archetype="workspace" />;
}

export function DetailLayout(props: PlatformLayoutProps) {
  return <BaseLayout {...props} archetype="detail" />;
}

export function FormFlowLayout(props: PlatformLayoutProps) {
  return <BaseLayout {...props} archetype="form-flow" />;
}

export function ReportLayout(props: PlatformLayoutProps) {
  return <BaseLayout {...props} archetype="report" />;
}

export function SettingsLayout(props: PlatformLayoutProps) {
  return <BaseLayout {...props} archetype="settings" />;
}

