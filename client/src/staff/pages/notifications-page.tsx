import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import {
  deleteAllNccNotificationsRequest,
  deleteNccNotificationRequest,
  markAllNccNotificationsReadRequest,
  markNccNotificationReadRequest,
  type NccNotificationDto,
} from "@/lib/backend/api";
import { useNcc } from "../api";
import { copy } from "../copy";
import { intlLocale } from "../i18n";
import { runAction } from "../run-action";
import { ConfirmDialog } from "../ui/confirm-dialog";
import {
  ActiveMark,
  EmptyState,
  ErrorState,
  LoadingRows,
  PageHeader,
} from "../ui/primitives";

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(intlLocale(), {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function StaffNotificationsPage() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const view =
    new URLSearchParams(search).get("view") === "unread" ? "unread" : "all";
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  const list = useNcc<{ items: NccNotificationDto[] }>(
    "/api/ncc/notifications",
    { limit: 100, ...(view === "unread" ? { unread: "true" } : {}) }
  );
  const count = useNcc<{ unreadCount: number }>(
    "/api/ncc/notifications/unread-count"
  );

  const items = list.data?.items;
  const unreadCount = count.data?.unreadCount ?? 0;
  const error = list.error || count.error;

  function setView(next: "all" | "unread") {
    const params = new URLSearchParams(search);
    if (next === "unread") params.set("view", "unread");
    else params.delete("view");
    const raw = params.toString();
    navigate(raw ? `?${raw}` : "?", { replace: true });
  }

  async function refresh() {
    await Promise.all([list.mutate(), count.mutate()]);
  }

  async function markRead(item: NccNotificationDto) {
    if (item.readAt !== null) return;
    await runAction(
      async () => {
        const result = await markNccNotificationReadRequest(item.id);
        if (!result.ok) {
          throw new Error(result.error ?? copy.notifications.actionFailed);
        }
        await refresh();
      },
      { success: copy.notifications.markedRead }
    );
  }

  async function markAll() {
    await runAction(
      async () => {
        const result = await markAllNccNotificationsReadRequest();
        if (!result.ok) {
          throw new Error(result.error ?? copy.notifications.actionFailed);
        }
        await refresh();
      },
      { success: copy.notifications.allMarkedRead }
    );
  }

  async function remove(item: NccNotificationDto) {
    await runAction(
      async () => {
        const result = await deleteNccNotificationRequest(item.id);
        if (!result.ok) {
          throw new Error(result.error ?? copy.notifications.actionFailed);
        }
        await refresh();
      },
      { success: copy.notifications.deleted }
    );
  }

  async function removeAll() {
    await runAction(
      async () => {
        const result = await deleteAllNccNotificationsRequest();
        if (!result.ok) {
          throw new Error(result.error ?? copy.notifications.actionFailed);
        }
        await refresh();
      },
      { success: copy.notifications.allDeleted }
    );
  }

  return (
    <>
      <PageHeader
        title={copy.notifications.title}
        description={copy.notifications.description}
        actions={
          <>
            <button
              type="button"
              className="staff-btn"
              disabled={unreadCount === 0}
              onClick={() => void markAll()}
            >
              {copy.notifications.markAllRead}
            </button>
            <button
              type="button"
              className="staff-btn"
              data-variant="destructive-outline"
              disabled={!items || items.length === 0}
              onClick={() => setConfirmDeleteAll(true)}
            >
              {copy.notifications.deleteAll}
            </button>
          </>
        }
      />

      <div className="staff-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={view === "all"}
          data-active={view === "all"}
          className="staff-tab"
          onClick={() => setView("all")}
        >
          {view === "all" ? <ActiveMark group="notifications-view" /> : null}
          {copy.notifications.all}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "unread"}
          data-active={view === "unread"}
          className="staff-tab"
          onClick={() => setView("unread")}
        >
          {view === "unread" ? <ActiveMark group="notifications-view" /> : null}
          {copy.notifications.unread}
          {unreadCount > 0 ? ` (${unreadCount})` : ""}
        </button>
      </div>

      {list.isLoading || count.isLoading ? (
        <LoadingRows rows={5} />
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refresh()} />
      ) : !items || items.length === 0 ? (
        <EmptyState
          title={copy.notifications.empty}
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map(item => (
            <li
              key={item.id}
              className="staff-notification"
              data-unread={item.readAt === null}
            >
              <div className="staff-notification-body">
                <p className="staff-notification-title">
                  {item.title}
                  {item.readAt === null ? (
                    <span className="staff-badge ms-2" data-tone="amber">
                      {copy.notifications.unreadBadge}
                    </span>
                  ) : null}
                </p>
                {item.body ? (
                  <p className="staff-notification-text">{item.body}</p>
                ) : null}
                <p className="staff-notification-meta">
                  {item.category} · {formatWhen(item.createdAt)}
                  {item.readAt !== null
                    ? ` · ${copy.notifications.read}`
                    : ""}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {item.readAt === null ? (
                  <button
                    type="button"
                    className="staff-btn"
                    data-size="sm"
                    onClick={() => void markRead(item)}
                  >
                    {copy.notifications.markRead}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="staff-btn"
                  data-variant="quiet"
                  data-size="sm"
                  onClick={() => void remove(item)}
                >
                  {copy.notifications.delete}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={confirmDeleteAll}
        onOpenChange={setConfirmDeleteAll}
        title={copy.notifications.deleteAllTitle}
        description={copy.notifications.deleteAllBody}
        confirmLabel={copy.notifications.deleteAll}
        destructive
        onConfirm={removeAll}
      />
    </>
  );
}
