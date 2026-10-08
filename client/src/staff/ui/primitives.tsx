import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { CircleAlert, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { copy } from "../copy";
import { StaffApiError } from "../session";

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  eyebrow?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("staff-page-header", className)}>
      <div className="staff-page-heading">
        {eyebrow ? <div className="staff-eyebrow">{eyebrow}</div> : null}
        <h1>{title}</h1>
        {description ? <p className="staff-page-desc">{description}</p> : null}
      </div>
      {actions ? <div className="staff-page-actions">{actions}</div> : null}
    </header>
  );
}

/**
 * The selected mark inside a segmented control or tab row. One mark per
 * group slides between options (`group` from `useId`), like a native
 * segmented control. The active option's colour and weight stay the static
 * cue; MotionConfig in the shell drops the slide under reduced motion.
 */
export function ActiveMark({ group }: { group: string }) {
  return (
    <motion.span
      layoutId={`staff-active-${group}`}
      className="staff-active-mark"
      transition={{ type: "spring", duration: 0.35, bounce: 0 }}
      aria-hidden
    />
  );
}

/** Placeholder text for a value the record does not have. */
export function NotSet() {
  return <span className="staff-muted">{copy.state.notSet}</span>;
}

function errorMessage(error: unknown): { title: string; body: string; fields?: Record<string, string[]> } {
  if (error instanceof StaffApiError) {
    const status = error.status;
    if (status === 403) return { title: copy.state.error403, body: error.message };
    if (status === 404) return { title: copy.state.error404, body: error.message };
    if (status === 409) return { title: copy.state.error409, body: error.message };
    if (status === 422)
      return {
        title: copy.state.error422,
        body: error.message,
        fields: error.details,
      };
    if (status === 429) return { title: copy.state.error429, body: error.message };
    if (status === 503) return { title: copy.state.error503, body: error.message };
    if (status === undefined)
      return { title: copy.state.errorNetwork, body: error.message };
    return { title: copy.state.errorGeneric, body: error.message };
  }
  if (error instanceof Error && error.name === "TypeError") {
    return { title: copy.state.errorNetwork, body: error.message };
  }
  return {
    title: copy.state.errorGeneric,
    body: error instanceof Error ? error.message : "",
  };
}

export function ErrorState({
  error,
  onRetry,
  className,
}: {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}) {
  const { title, body, fields } = errorMessage(error);
  return (
    <div className={cn("staff-error", className)} role="alert">
      <span className="staff-state-icon" aria-hidden>
        <CircleAlert strokeWidth={1.75} />
      </span>
      <span className="staff-state-title">{title}</span>
      {body ? <span className="staff-state-body">{body}</span> : null}
      {fields ? (
        <ul className="staff-field-errors">
          {Object.entries(fields).map(([field, errors]) => (
            <li key={field}>
              {field}: {errors.join(", ")}
            </li>
          ))}
        </ul>
      ) : null}
      {onRetry ? (
        <button type="button" className="staff-btn" onClick={onRetry}>
          {copy.state.retry}
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon = <Inbox strokeWidth={1.75} />,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  /** Glyph in the soft circle above the title; `null` hides it. */
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("staff-empty", className)}>
      {icon ? (
        <span className="staff-state-icon" aria-hidden>
          {icon}
        </span>
      ) : null}
      <span className="staff-state-title">{title}</span>
      {description ? (
        <span className="staff-state-body">{description}</span>
      ) : null}
      {action ? <div className="staff-state-action">{action}</div> : null}
    </div>
  );
}

/** Quiet, content-shaped placeholder for a table or list that is loading. */
export function LoadingRows({ rows = 6 }: { rows?: number }) {
  return (
    <div
      className="staff-placeholder"
      aria-busy="true"
      aria-label={copy.state.loading}
      role="status"
    >
      <span className="staff-placeholder-head" />
      {Array.from({ length: rows }).map((_, index) => (
        <span key={index} className="staff-placeholder-row">
          <span style={{ inlineSize: `${38 - ((index * 7) % 18)}%` }} />
          <span style={{ inlineSize: `${18 + ((index * 5) % 10)}%` }} />
          <span style={{ inlineSize: "12%" }} />
        </span>
      ))}
    </div>
  );
}

export function LoadingCenter({ label }: { label?: string }) {
  return (
    <div className="staff-center" role="status">
      <span className="ui-spinner" aria-hidden />
      <span>{label ?? copy.state.loading}</span>
    </div>
  );
}

const AVATAR_TONES = ["river", "positive", "caution", "critical", "neutral"] as const;
type AvatarTone = (typeof AVATAR_TONES)[number];

function avatarTone(seed: string): AvatarTone {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

function nameInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/** Initials avatar; the tone is stable per user id. */
export function Avatar({
  name,
  seed,
  size = "md",
  className,
}: {
  name: string;
  /** Stable id the colour is derived from; falls back to the name. */
  seed?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span
      className={cn("staff-avatar", className)}
      data-tone={avatarTone(seed ?? name)}
      data-size={size}
      aria-hidden
    >
      {nameInitials(name)}
    </span>
  );
}

const TONES: Record<string, "green" | "blue" | "amber" | "red" | "plain"> = {
  active: "green",
  enrolled: "green",
  completed: "green",
  registered: "green",
  ok: "green",
  healthy: "green",
  scheduled: "blue",
  pending_class: "blue",
  pending_group: "blue",
  in_process: "blue",
  trial_lesson: "blue",
  placement_test: "blue",
  pending: "amber",
  pending_payment: "amber",
  follow_up: "amber",
  future_registration: "amber",
  invited: "amber",
  degraded: "amber",
  warning: "amber",
  cancelled: "plain",
  canceled: "plain",
  left: "plain",
  lost: "red",
  no_show: "red",
  disabled: "plain",
  error: "red",
  unhealthy: "red",
};

export function statusLabel(status: string): string {
  const known = (copy.status as Record<string, string>)[status];
  if (known) return known;
  return status
    .split("_")
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: string;
  label?: string;
  className?: string;
}) {
  const text = label ?? statusLabel(status);
  return (
    <span className={cn("staff-badge", className)} data-tone={TONES[status]}>
      {text}
    </span>
  );
}
