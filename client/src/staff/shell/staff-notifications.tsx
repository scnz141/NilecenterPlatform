import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { Bell } from "lucide-react";
import {
  markAllNccNotificationsReadRequest,
  markNccNotificationReadRequest,
  type NccNotificationDto,
} from "@/lib/backend/api";
import { useNcc } from "../api";
import { copy } from "../copy";
import { intlLocale } from "../i18n";

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(intlLocale(), {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Notifications bell + popover for the staff shell top bar. */
export function StaffNotificationsBell() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const list = useNcc<{ items: NccNotificationDto[] }>(
    "/api/ncc/notifications",
    { limit: 6 }
  );
  const count = useNcc<{ unreadCount: number }>(
    "/api/ncc/notifications/unread-count"
  );

  // Fail closed: only show authoritative state when both reads succeed.
  const items = list.data?.items ?? [];
  const unreadCount = count.data?.unreadCount ?? 0;
  const loading = list.isLoading || count.isLoading;
  const error =
    listError ?? (list.error || count.error
      ? copy.notifications.actionFailed
      : null);

  useEffect(() => {
    if (!open) return;
    setListError(null);
    void Promise.all([list.mutate(), count.mutate()]).catch(() => undefined);
    const onDown = (event: MouseEvent) => {
      if (
        rootRef.current &&
        event.target instanceof Node &&
        !rootRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function markRead(id: string): Promise<boolean> {
    const result = await markNccNotificationReadRequest(id);
    if (!result.ok) {
      setListError(result.error ?? copy.notifications.actionFailed);
      return false;
    }
    setListError(null);
    await Promise.all([list.mutate(), count.mutate()]);
    return true;
  }

  async function markAll() {
    setBusy(true);
    try {
      const result = await markAllNccNotificationsReadRequest();
      if (!result.ok) {
        setListError(result.error ?? copy.notifications.actionFailed);
        return;
      }
      await Promise.all([list.mutate(), count.mutate()]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="staff-bell"
        aria-label={
          unreadCount > 0
            ? `${copy.nav.notifications}, ${unreadCount} ${copy.notifications.unread.toLowerCase()}`
            : copy.nav.notifications
        }
        aria-expanded={open}
        data-open={open}
        onClick={() => setOpen(current => !current)}
      >
        <Bell strokeWidth={1.75} aria-hidden />
        {unreadCount > 0 ? (
          <span className="staff-count" aria-hidden>
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="staff-popover" role="dialog" aria-label={copy.nav.notifications}>
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-sm font-semibold">
              {copy.nav.notifications}
            </span>
            <button
              type="button"
              className="staff-btn"
              data-variant="ghost"
              data-size="sm"
              disabled={unreadCount === 0 || busy || loading}
              onClick={() => void markAll()}
            >
              {copy.notifications.markAllRead}
            </button>
          </div>
          {loading ? (
            <p className="staff-muted px-2 py-3">{copy.state.loading}</p>
          ) : error ? (
            <div className="px-2 py-3">
              <p className="staff-muted">{error}</p>
              <button
                type="button"
                className="staff-btn mt-2"
                data-size="sm"
                onClick={() => {
                  setListError(null);
                  void Promise.all([list.mutate(), count.mutate()]);
                }}
              >
                {copy.state.retry}
              </button>
            </div>
          ) : items.length === 0 ? (
            <p className="staff-muted px-2 py-3">
              {copy.notifications.empty}
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {items.map(item => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="staff-menu-item !items-start flex-col !gap-0.5"
                    data-unread={item.readAt === null}
                    onClick={() => {
                      if (item.readAt === null) void markRead(item.id);
                    }}
                  >
                    <span className="flex w-full items-center gap-2 font-medium">
                      {item.title}
                    </span>
                    {item.body ? (
                      <span className="staff-muted line-clamp-2">
                        {item.body}
                      </span>
                    ) : null}
                    <span className="text-xs text-[var(--staff-muted)]">
                      {formatWhen(item.createdAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="staff-menu-sep" />
          <Link
            href="/app/notifications"
            className="staff-menu-item justify-center text-[var(--staff-blue)]"
            onClick={() => setOpen(false)}
          >
            {copy.shell.viewAll}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
