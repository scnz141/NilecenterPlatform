import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  MessageSquare,
  Paperclip,
  RefreshCw,
  Search,
  Send,
} from "lucide-react";
import { Link } from "wouter";
import PlatformShell from "@/components/platform/PlatformShell";
import {
  FormFlowLayout,
  WorkspaceLayout,
} from "@/components/platform/PlatformLayouts";
import {
  fetchPlatformStateRequest,
  runPlatformWorkflowActionRequest,
} from "@/lib/backend/api";
import { requireActiveUser } from "@/lib/auth/session";
import { getMessageRecipientScope } from "@/lib/domain/messageScope";
import {
  buildMessageConversations,
  replyMessageSubject,
  type MessageConversation,
} from "@/lib/domain/messageThreads";
import { platformStore } from "@/lib/domain/store";
import type { Message, User } from "@/lib/domain/types";
import { roleMeta, type Role } from "@/lib/platformData";

type PortalMessagesPageProps = {
  role: Role;
  mode?: "inbox" | "compose";
};

const titleByRole: Record<Role, string> = {
  student: "Messages",
  teacher: "Messages",
  registrar: "Messages",
  headofdepartment: "Messages",
  branchadmin: "Messages",
  superadmin: "Messages",
};

function formatDate(value?: string) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function userLabel(user?: User) {
  if (!user) return "Unknown";
  return `${user.name} · ${roleMeta[user.activeRole].label}`;
}

function initialsFromName(name?: string) {
  if (!name) return "NL";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "NL";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function messagesHref(role: Role) {
  if (role === "headofdepartment") return "/app/hod/messages";
  if (role === "branchadmin") return "/app/branch/messages";
  if (role === "superadmin") return "/app/admin/messages";
  return `/app/${role}/messages`;
}

function userForId(users: User[], userId?: string) {
  return userId ? users.find(user => user.id === userId) : undefined;
}

function conversationParticipantLabel(
  conversation: MessageConversation,
  users: User[],
  actorId: string
) {
  const isParticipant = conversation.participantUserIds.includes(actorId);
  const participantNames = conversation.participantUserIds
    .map(userId => userForId(users, userId)?.name)
    .filter((name): name is string => Boolean(name));

  if (isParticipant) {
    return (
      userForId(users, conversation.counterpartUserId)?.name ?? "Nile Learn"
    );
  }

  return participantNames.join(" and ") || "Nile Learn";
}

export default function PortalMessagesPage({
  role,
  mode = "inbox",
}: PortalMessagesPageProps) {
  const [version, setVersion] = useState(0);
  const [query, setQuery] = useState("");
  const [recipientId, setRecipientId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [replySaving, setReplySaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState("");
  const [mobileShowReader, setMobileShowReader] = useState(false);
  const [result, setResult] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const [replyResult, setReplyResult] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const pendingReadMessageIds = useRef(new Set<string>());
  const refreshInFlight = useRef(false);

  const state = useMemo(() => platformStore.getState(), [version]);
  const activeUser = requireActiveUser(role);
  const actor: User = state.users.find(user => user.id === activeUser.id) ?? {
    id: activeUser.id,
    name: activeUser.name,
    email: activeUser.email,
    roles: activeUser.roles,
    activeRole: activeUser.activeRole,
    status: "active",
  };
  const actorId = actor.id;
  const inboxHref = messagesHref(role);

  const recipientScope = useMemo(
    () => getMessageRecipientScope(state, role, actorId),
    [actorId, role, state]
  );
  const recipients = state.users.filter(user =>
    recipientScope.sendableUserIds.has(user.id)
  );
  const selectedRecipientId = recipientId || recipients[0]?.id || "";
  const messages = useMemo(
    () =>
      state.messages.filter(
        message =>
          role === "superadmin" ||
          message.fromUserId === actorId ||
          message.toUserId === actorId
      ),
    [actorId, role, state.messages]
  );
  const filteredMessages = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return messages;
    return messages.filter(message => {
      const from = userForId(state.users, message.fromUserId);
      const to = userForId(state.users, message.toUserId);
      const text = [message.subject, message.body, from?.name, to?.name]
        .join(" ")
        .toLowerCase();
      return text.includes(normalizedQuery);
    });
  }, [messages, query, state.users]);
  const conversations = useMemo(
    () => buildMessageConversations(filteredMessages, actorId),
    [actorId, filteredMessages]
  );
  const unreadCount = conversations.reduce(
    (total, conversation) => total + conversation.unreadCount,
    0
  );
  const selectedConversation =
    conversations.find(
      conversation => conversation.id === selectedConversationId
    ) ??
    conversations[0] ??
    null;
  const selectedConversationMessages = selectedConversation?.messages ?? [];
  const unreadConversationMessageIds = selectedConversationMessages
    .filter(message => message.toUserId === actorId && !message.read)
    .map(message => message.id);
  const unreadConversationKey = unreadConversationMessageIds.join(":");
  const actorIsConversationParticipant = Boolean(
    selectedConversation?.participantUserIds.includes(actorId)
  );
  const selectedCounterpart = actorIsConversationParticipant
    ? userForId(state.users, selectedConversation?.counterpartUserId)
    : undefined;
  const replyRecipientId =
    selectedCounterpart &&
    recipientScope.sendableUserIds.has(selectedCounterpart.id)
      ? selectedCounterpart.id
      : "";
  const canReply = Boolean(replyRecipientId && selectedConversation);

  const refreshMessages = useCallback(async (showError = false) => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    if (showError) setRefreshing(true);

    try {
      const response = await fetchPlatformStateRequest();
      if (!response.ok || !response.data) {
        if (showError) {
          setSyncError(response.error ?? "Messages could not be refreshed.");
        }
        return;
      }
      platformStore.setState(response.data.state);
      setVersion(current => current + 1);
      setSyncError(null);
    } finally {
      refreshInFlight.current = false;
      if (showError) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (mode !== "inbox") return;

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void refreshMessages();
      }
    };
    const timer = window.setInterval(() => void refreshMessages(), 45_000);

    void refreshMessages();
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [mode, refreshMessages]);

  useEffect(() => {
    if (!recipientId && recipients[0]?.id) {
      setRecipientId(recipients[0].id);
    }
  }, [recipientId, recipients]);

  useEffect(() => {
    if (!conversations.length) {
      setSelectedConversationId("");
      setMobileShowReader(false);
      return;
    }
    if (
      !conversations.some(
        conversation => conversation.id === selectedConversationId
      )
    ) {
      setSelectedConversationId(conversations[0].id);
    }
  }, [conversations, selectedConversationId]);

  useEffect(() => {
    setReplyBody("");
    setReplyResult(null);
  }, [selectedConversationId]);

  useEffect(() => {
    if (!unreadConversationMessageIds.length) return;

    let active = true;
    const markConversationRead = async () => {
      for (const messageId of unreadConversationMessageIds) {
        if (pendingReadMessageIds.current.has(messageId)) continue;
        pendingReadMessageIds.current.add(messageId);
        try {
          const response = await runPlatformWorkflowActionRequest({
            type: "message.read",
            messageId,
          });
          if (active && response.ok && response.data) {
            platformStore.setState(response.data.state);
            setVersion(current => current + 1);
          }
        } finally {
          pendingReadMessageIds.current.delete(messageId);
        }
      }
    };

    void markConversationRead();
    return () => {
      active = false;
    };
  }, [unreadConversationKey]);

  const sendLabel =
    role === "branchadmin"
      ? "Send branch message"
      : role === "headofdepartment"
        ? "Send academic message"
        : "Send message";

  const deliverMessage = async (input: {
    toUserId: string;
    subject: string;
    body: string;
    replyToMessageId?: string;
  }) => {
    const response = await runPlatformWorkflowActionRequest({
      type: "message.send",
      toUserId: input.toUserId,
      subject: input.subject,
      body: input.body,
      replyToMessageId: input.replyToMessageId,
      channel: "in_app",
    });
    if (!response.ok || !response.data) {
      return {
        ok: false as const,
        error: response.error ?? "Message could not be sent.",
      };
    }
    platformStore.setState(response.data.state);
    setVersion(current => current + 1);
    return { ok: true as const };
  };

  const sendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    setResult(null);
    if (!selectedRecipientId || !subject.trim() || !body.trim()) {
      setResult({
        tone: "error",
        text: "Recipient, subject, and message are required.",
      });
      return;
    }
    setSaving(true);
    const response = await deliverMessage({
      toUserId: selectedRecipientId,
      subject: subject.trim(),
      body: body.trim(),
    });
    setSaving(false);
    if (!response.ok) {
      setResult({ tone: "error", text: response.error });
      return;
    }
    setSubject("");
    setBody("");
    setResult({ tone: "success", text: "Message sent." });
  };

  const sendReply = async (event: React.FormEvent) => {
    event.preventDefault();
    setReplyResult(null);
    const latestMessage = selectedConversationMessages.at(-1);
    if (
      !selectedConversation ||
      !latestMessage ||
      !replyRecipientId ||
      !replyBody.trim()
    ) {
      setReplyResult({
        tone: "error",
        text: canReply
          ? "Write a reply before sending."
          : "This conversation is outside your message scope.",
      });
      return;
    }
    setReplySaving(true);
    const response = await deliverMessage({
      toUserId: replyRecipientId,
      subject: replyMessageSubject(selectedConversation.subject),
      body: replyBody.trim(),
      replyToMessageId: latestMessage.id,
    });
    setReplySaving(false);
    if (!response.ok) {
      setReplyResult({ tone: "error", text: response.error });
      return;
    }
    setReplyBody("");
    setReplyResult({ tone: "success", text: "Reply sent." });
  };

  const openConversation = (conversationId: string) => {
    setSelectedConversationId(conversationId);
    setMobileShowReader(true);
    setReplyResult(null);
  };

  if (mode === "compose") {
    return (
      <PlatformShell role={role} title="New message">
        <FormFlowLayout
          className="portal-messages-page nile-message-compose-page"
          title="New message"
          context={roleMeta[role].label}
          actions={
            result?.tone === "success" ? (
              <Link className="platform-primary-button" href={inboxHref}>
                View messages
              </Link>
            ) : (
              <>
                <Link className="platform-secondary-button" href={inboxHref}>
                  Cancel
                </Link>
                <button
                  type="submit"
                  form="portal-message-compose-form"
                  className="platform-primary-button"
                  disabled={!recipients.length || saving}
                >
                  <Send size={15} />
                  {saving ? "Sending" : sendLabel}
                </button>
              </>
            )
          }
          main={
            <section
              className="nile-message-compose-surface"
              data-testid={`portal-message-compose-${role}`}
            >
              {result?.tone === "success" ? (
                <div className="nile-message-compose-success" role="status">
                  <MessageSquare size={20} />
                  <strong>Message sent</strong>
                </div>
              ) : (
                <form
                  id="portal-message-compose-form"
                  className="nile-message-compose-form"
                  onSubmit={sendMessage}
                >
                  <label>
                    Recipient
                    <select
                      value={selectedRecipientId}
                      onChange={event => setRecipientId(event.target.value)}
                    >
                      {recipients.map(user => (
                        <option key={user.id} value={user.id}>
                          {userLabel(user)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Subject
                    <input
                      autoFocus
                      maxLength={160}
                      value={subject}
                      onChange={event => setSubject(event.target.value)}
                      placeholder={`${roleMeta[role].shortLabel} update`}
                    />
                  </label>
                  <label className="nile-message-compose-body">
                    Message
                    <textarea
                      maxLength={10000}
                      value={body}
                      onChange={event => setBody(event.target.value)}
                      placeholder="Write a short update"
                    />
                  </label>
                  {!recipients.length ? (
                    <p className="platform-attendance-error">
                      There is no one in your current workspace to message yet.
                    </p>
                  ) : null}
                  {result ? (
                    <p aria-live="polite" className="platform-attendance-error">
                      {result.text}
                    </p>
                  ) : null}
                </form>
              )}
            </section>
          }
        />
      </PlatformShell>
    );
  }

  return (
    <PlatformShell role={role} title={titleByRole[role]}>
      <WorkspaceLayout
        className="portal-messages-page"
        title={titleByRole[role]}
        context={roleMeta[role].label}
        actions={
          <Link className="platform-primary-button" href={`${inboxHref}/new`}>
            <MessageSquare size={15} />
            New message
          </Link>
        }
        main={
          <section
            className={`nile-message-workspace${
              mobileShowReader ? " is-reading" : ""
            }`}
            data-testid={`portal-messages-inbox-${role}`}
          >
            <aside className="nile-message-rail" aria-label="Conversations">
              <header className="nile-message-rail-head">
                <div>
                  <strong>Inbox</strong>
                </div>
                <div className="nile-message-rail-actions">
                  {unreadCount ? <small>{unreadCount} unread</small> : null}
                  <button
                    type="button"
                    className="nile-message-refresh"
                    aria-label="Refresh messages"
                    title="Refresh messages"
                    disabled={refreshing}
                    onClick={() => void refreshMessages(true)}
                  >
                    <RefreshCw
                      aria-hidden="true"
                      className={refreshing ? "is-spinning" : undefined}
                      size={15}
                    />
                  </button>
                </div>
              </header>

              <div
                className="nile-message-search"
                data-testid={`portal-messages-toolbar-${role}`}
              >
                <label>
                  <span className="sr-only">Search messages</span>
                  <Search aria-hidden="true" size={15} />
                  <input
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                    placeholder="Search messages"
                  />
                </label>
              </div>

              {syncError ? (
                <p className="nile-message-sync-error" role="status">
                  {syncError}
                </p>
              ) : null}

              <ul
                className="nile-message-conversation-list"
                aria-label="Message conversations"
              >
                {conversations.map(conversation => {
                  const latestMessage = conversation.latestMessage;
                  const counterpart = userForId(
                    state.users,
                    conversation.counterpartUserId
                  );
                  const isActive = selectedConversation?.id === conversation.id;
                  const unread = conversation.unreadCount > 0;
                  const participantLabel = conversationParticipantLabel(
                    conversation,
                    state.users,
                    actorId
                  );
                  return (
                    <li key={conversation.id}>
                      <button
                        type="button"
                        className={`nile-message-conversation${
                          unread ? " unread" : ""
                        }${isActive ? " is-active" : ""}`}
                        aria-current={isActive ? "page" : undefined}
                        aria-label={`${participantLabel}, ${conversation.subject}, ${conversation.messages.length} message${
                          conversation.messages.length === 1 ? "" : "s"
                        }${unread ? `, ${conversation.unreadCount} unread` : ""}`}
                        data-message-conversation-id={conversation.id}
                        onClick={() => openConversation(conversation.id)}
                      >
                        <span
                          aria-hidden="true"
                          className="nile-message-avatar"
                        >
                          {initialsFromName(
                            counterpart?.name ?? participantLabel
                          )}
                        </span>
                        <span className="nile-message-conversation-copy">
                          <span className="nile-message-conversation-meta">
                            <span>
                              {conversationParticipantLabel(
                                conversation,
                                state.users,
                                actorId
                              )}
                            </span>
                            <time dateTime={latestMessage.createdAt}>
                              {formatDate(latestMessage.createdAt)}
                            </time>
                          </span>
                          <strong>{conversation.subject}</strong>
                          <p>{latestMessage.body}</p>
                        </span>
                        {unread ? (
                          <span
                            aria-label={`${conversation.unreadCount} unread`}
                            className="nile-message-unread-count"
                          >
                            {conversation.unreadCount}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
                {!conversations.length ? (
                  <li className="nile-message-empty">
                    <strong>No messages</strong>
                  </li>
                ) : null}
              </ul>
            </aside>

            <article className="nile-message-reader" aria-live="polite">
              {selectedConversation ? (
                <div
                  key={selectedConversation.id}
                  className="nile-message-reader-content"
                >
                  <header className="nile-message-reader-head">
                    <button
                      type="button"
                      className="nile-message-reader-back"
                      onClick={() => setMobileShowReader(false)}
                    >
                      <ArrowLeft size={16} />
                      Inbox
                    </button>
                    <div className="nile-message-reader-title">
                      <h2>{selectedConversation.subject}</h2>
                    </div>
                    <div className="nile-message-reader-person">
                      <span
                        aria-hidden="true"
                        className="nile-message-avatar is-large"
                      >
                        {initialsFromName(
                          selectedCounterpart?.name ??
                            conversationParticipantLabel(
                              selectedConversation,
                              state.users,
                              actorId
                            )
                        )}
                      </span>
                      <div>
                        <strong>
                          {actorIsConversationParticipant
                            ? (selectedCounterpart?.name ?? "Nile Learn")
                            : conversationParticipantLabel(
                                selectedConversation,
                                state.users,
                                actorId
                              )}
                        </strong>
                      </div>
                    </div>
                  </header>

                  <ol
                    className="nile-message-transcript"
                    aria-label="Conversation history"
                  >
                    {selectedConversationMessages.map(message => {
                      const outgoing = message.fromUserId === actorId;
                      const sender = userForId(state.users, message.fromUserId);
                      return (
                        <li
                          key={message.id}
                          className={`nile-message-entry${
                            outgoing ? " is-outgoing" : ""
                          }`}
                        >
                          <article className="nile-message-bubble">
                            <header>
                              <strong>
                                {outgoing
                                  ? "You"
                                  : (sender?.name ?? "Nile Learn")}
                              </strong>
                              <time dateTime={message.createdAt}>
                                {formatDate(message.createdAt)}
                              </time>
                            </header>
                            <p>{message.body}</p>
                            {message.attachments?.length ? (
                              <ul
                                className="nile-message-attachments"
                                aria-label="Attachments"
                              >
                                {message.attachments.map(attachment => (
                                  <li key={`${message.id}-${attachment.name}`}>
                                    <Paperclip aria-hidden="true" size={13} />
                                    <span title={attachment.name}>
                                      {attachment.previewLabel ||
                                        attachment.name}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </article>
                        </li>
                      );
                    })}
                  </ol>

                  {canReply ? (
                    <form
                      className="nile-message-reply"
                      onSubmit={sendReply}
                      data-testid={`portal-message-reply-${role}`}
                    >
                      <label className="nile-message-reply-field">
                        <span className="sr-only">
                          Reply to {selectedCounterpart?.name ?? "recipient"}
                        </span>
                        <textarea
                          maxLength={10000}
                          value={replyBody}
                          onChange={event => {
                            setReplyBody(event.target.value);
                            if (replyResult) setReplyResult(null);
                          }}
                          placeholder={`Reply to ${selectedCounterpart?.name ?? "them"}…`}
                          disabled={replySaving}
                          rows={3}
                        />
                      </label>
                      <div className="nile-message-reply-actions">
                        {replyResult ? (
                          <span
                            aria-live="polite"
                            className={`nile-message-reply-status is-${replyResult.tone}`}
                          >
                            {replyResult.text}
                          </span>
                        ) : null}
                        <button
                          type="submit"
                          className="platform-primary-button"
                          disabled={replySaving || !replyBody.trim()}
                        >
                          <Send size={15} />
                          {replySaving ? "Sending" : "Send reply"}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <footer className="nile-message-reply-unavailable">
                      <span>
                        {actorIsConversationParticipant
                          ? "Reply unavailable"
                          : "View only"}
                      </span>
                      <Link
                        className="platform-secondary-button"
                        href={`${inboxHref}/new`}
                      >
                        New message
                      </Link>
                    </footer>
                  )}
                </div>
              ) : (
                <div className="nile-message-reader-empty">
                  <MessageSquare size={28} />
                  <strong>Select a conversation</strong>
                </div>
              )}
            </article>
          </section>
        }
      />
    </PlatformShell>
  );
}
