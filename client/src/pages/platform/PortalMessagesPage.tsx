import { useEffect, useMemo, useState } from "react";
import { MessageSquare, Search, Send } from "lucide-react";
import PlatformShell from "@/components/platform/PlatformShell";
import { WorkspaceLayout } from "@/components/platform/PlatformLayouts";
import {
  DataTableCard,
  StatusBadge,
} from "@/components/platform/PlatformPrimitives";
import { runPlatformWorkflowActionRequest } from "@/lib/backend/api";
import { getStoredAuthSession } from "@/lib/auth/session";
import { platformStore } from "@/lib/domain/store";
import type { User } from "@/lib/domain/types";
import { roleMeta, type Role } from "@/lib/platformData";

type PortalMessagesPageProps = {
  role: Role;
};

type MessageTone = "green" | "amber" | "slate";

const fallbackUserIdByRole: Record<Role, string> = {
  student: "usr_student_demo",
  teacher: "usr_teacher_demo",
  registrar: "usr_registrar_demo",
  headofdepartment: "usr_hod_demo",
  branchadmin: "usr_branch_demo",
  superadmin: "usr_admin_demo",
};

const titleByRole: Record<Role, string> = {
  student: "Messages",
  teacher: "Messages",
  registrar: "Messages",
  headofdepartment: "Department messages",
  branchadmin: "Branch messages",
  superadmin: "Platform messages",
};

const descriptionByRole: Record<Role, string> = {
  student: "Send and read learning messages.",
  teacher: "Send class updates and read student messages.",
  registrar: "Send admissions follow-ups and read replies.",
  headofdepartment: "Send academic updates within your department.",
  branchadmin: "Send branch updates and read local messages.",
  superadmin: "Send platform updates and review message activity.",
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

function messageTone(read?: boolean): MessageTone {
  return read ? "slate" : "amber";
}

function roleRoot(role: Role) {
  if (role === "headofdepartment") return "hod";
  if (role === "branchadmin") return "branch";
  if (role === "superadmin") return "admin";
  return role;
}

function userLabel(user?: User) {
  if (!user) return "Unknown";
  return `${user.name} · ${roleMeta[user.activeRole].label}`;
}

export default function PortalMessagesPage({ role }: PortalMessagesPageProps) {
  const [version, setVersion] = useState(0);
  const [query, setQuery] = useState("");
  const [recipientId, setRecipientId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  const state = useMemo(() => platformStore.getState(), [version]);
  const session = getStoredAuthSession();
  const actor =
    state.users.find(
      user => user.id === session?.userId && user.activeRole === role
    ) ?? state.users.find(user => user.id === fallbackUserIdByRole[role]);
  const actorId = actor?.id ?? fallbackUserIdByRole[role];

  const scopedTeacherRunIds = new Set(
    state.courseRuns.filter(run => run.teacherId === actorId).map(run => run.id)
  );
  const scopedTeacherStudentIds = new Set(
    state.enrollments
      .filter(enrollment => scopedTeacherRunIds.has(enrollment.courseRunId))
      .map(enrollment => enrollment.studentId)
  );
  const scopedTeacherStudentUserIds = new Set(
    state.students
      .filter(student => scopedTeacherStudentIds.has(student.id))
      .map(student => student.userId)
  );
  const branchIds =
    role === "branchadmin"
      ? new Set(
          [
            actor?.branchId,
            ...state.staffProfiles
              .filter(profile => profile.userId === actorId)
              .flatMap(profile => profile.branchIds),
          ].filter(Boolean)
        )
      : new Set<string>();
  const departmentIds =
    role === "headofdepartment"
      ? new Set(
          [
            actor?.departmentId,
            ...state.staffProfiles
              .filter(profile => profile.userId === actorId)
              .flatMap(profile => profile.departmentIds),
          ].filter(Boolean)
        )
      : new Set<string>();

  const recipientIds = new Set<string>();
  if (role === "student") {
    state.enrollments
      .filter(enrollment =>
        state.students.some(
          student =>
            student.id === enrollment.studentId && student.userId === actorId
        )
      )
      .forEach(enrollment => {
        if (enrollment.teacherId) {
          recipientIds.add(enrollment.teacherId);
        }
      });
    recipientIds.add("usr_registrar_demo");
  } else if (role === "teacher") {
    scopedTeacherStudentUserIds.forEach(id => recipientIds.add(id));
    recipientIds.add("usr_hod_demo");
  } else if (role === "registrar") {
    state.users
      .filter(
        user =>
          user.branchId === actor?.branchId || user.activeRole === "student"
      )
      .forEach(user => recipientIds.add(user.id));
  } else if (role === "headofdepartment") {
    state.users
      .filter(user => user.departmentId && departmentIds.has(user.departmentId))
      .forEach(user => recipientIds.add(user.id));
    recipientIds.add("usr_teacher_demo");
  } else if (role === "branchadmin") {
    state.users
      .filter(user => user.branchId && branchIds.has(user.branchId))
      .forEach(user => recipientIds.add(user.id));
    recipientIds.add("usr_teacher_demo");
  } else {
    state.users.forEach(user => recipientIds.add(user.id));
  }
  recipientIds.delete(actorId);

  const recipients = state.users.filter(user => recipientIds.has(user.id));
  const selectedRecipientId = recipientId || recipients[0]?.id || "";
  const visibleMessageIds = new Set([
    actorId,
    ...recipients.map(user => user.id),
  ]);
  const messages = state.messages
    .filter(
      message =>
        visibleMessageIds.has(message.fromUserId) ||
        visibleMessageIds.has(message.toUserId)
    )
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  const filteredMessages = messages.filter(message => {
    const from = state.users.find(user => user.id === message.fromUserId);
    const to = state.users.find(user => user.id === message.toUserId);
    const text = [message.subject, message.body, from?.name, to?.name]
      .join(" ")
      .toLowerCase();
    return text.includes(query.toLowerCase());
  });

  useEffect(() => {
    if (!recipientId && recipients[0]?.id) {
      setRecipientId(recipients[0].id);
    }
  }, [recipientId, recipients]);

  const sendLabel =
    role === "branchadmin"
      ? "Send branch message"
      : role === "headofdepartment"
        ? "Send academic message"
        : "Send message";

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
    const response = await runPlatformWorkflowActionRequest({
      type: "message.send",
      toUserId: selectedRecipientId,
      subject: subject.trim(),
      body: body.trim(),
      channel: "in_app",
    });
    setSaving(false);
    if (!response.ok || !response.data) {
      setResult({
        tone: "error",
        text: response.error ?? "Message could not be sent.",
      });
      return;
    }
    platformStore.setState(response.data.state);
    setVersion(current => current + 1);
    setSubject("");
    setBody("");
    setResult({ tone: "success", text: "Message sent." });
  };

  return (
    <PlatformShell role={role} title={titleByRole[role]}>
      <WorkspaceLayout
        className="portal-messages-page"
        title={titleByRole[role]}
        description={descriptionByRole[role]}
        context={roleMeta[role].label}
        toolbar={
          <div className="portal-simple-toolbar portal-messages-toolbar">
            <label>
              Search
              <span>
                <Search size={14} />
                <input
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="Search messages"
                />
              </span>
            </label>
          </div>
        }
        main={
          <DataTableCard
            title="Conversation list"
            subtitle={`${filteredMessages.length} messages`}
          >
            <div className="admin-ia-table-wrap">
              <table className="portal-messages-table">
                <thead>
                  <tr>
                    <th>Message</th>
                    <th>People</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMessages.map(message => {
                    const from = state.users.find(
                      user => user.id === message.fromUserId
                    );
                    const to = state.users.find(
                      user => user.id === message.toUserId
                    );
                    return (
                      <tr key={message.id}>
                        <td>
                          <strong>{message.subject}</strong>
                          <small>{message.body}</small>
                        </td>
                        <td>
                          <strong>{from?.name ?? "Sender"}</strong>
                          <small>To {to?.name ?? "recipient"}</small>
                        </td>
                        <td>
                          <StatusBadge tone={messageTone(message.read)}>
                            {message.read ? "read" : "unread"}
                          </StatusBadge>
                        </td>
                        <td>{formatDate(message.createdAt)}</td>
                      </tr>
                    );
                  })}
                  {!filteredMessages.length ? (
                    <tr>
                      <td colSpan={4}>
                        <div className="platform-empty-state">
                          <strong>No messages found</strong>
                          <span>Send a message or adjust search.</span>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </DataTableCard>
        }
        side={
          <section className="platform-workflow-card portal-message-compose">
            <div className="platform-workflow-title">
              <span>
                <MessageSquare size={16} /> New message
              </span>
              <strong>{recipients.length} recipients</strong>
            </div>
            <form className="platform-inline-form" onSubmit={sendMessage}>
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
                  value={subject}
                  onChange={event => setSubject(event.target.value)}
                  placeholder={`${roleMeta[role].shortLabel} update`}
                />
              </label>
              <label>
                Message
                <textarea
                  value={body}
                  onChange={event => setBody(event.target.value)}
                  placeholder="Write a short update"
                />
              </label>
              {result ? (
                <p
                  className={
                    result.tone === "success"
                      ? "platform-scheduler-feedback success"
                      : "platform-attendance-error"
                  }
                >
                  {result.text}
                </p>
              ) : null}
              <button
                type="submit"
                className="platform-primary-button"
                disabled={!recipients.length || saving}
              >
                <Send size={15} />
                {saving ? "Sending" : sendLabel}
              </button>
            </form>
          </section>
        }
      />
    </PlatformShell>
  );
}
