import { requireActiveUser } from "@/lib/auth/session";
import { useMemo, useState, type FormEvent } from "react";
import { CheckCircle2, Search, Send } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import PlatformShell from "@/components/platform/PlatformShell";
import {
  FormFlowLayout,
  WorkspaceLayout,
} from "@/components/platform/PlatformLayouts";
import {
  DataTableCard,
  StatusBadge,
} from "@/components/platform/PlatformPrimitives";
import { platformStore } from "@/lib/domain/store";
import { runPlatformWorkflowActionRequest } from "@/lib/backend/api";
import type { EntityStatus, SupportTicket } from "@/lib/domain/types";

type TicketPriority = SupportTicket["priority"];

function statusTone(status: EntityStatus): "green" | "amber" | "red" | "slate" {
  if (status === "completed" || status === "active") return "green";
  if (status === "pending" || status === "draft") return "amber";
  if (status === "cancelled" || status === "overdue") return "red";
  return "slate";
}

function priorityLabel(priority: TicketPriority) {
  if (priority === "normal") return "Normal";
  return priority.replace(/\b\w/g, character => character.toUpperCase());
}

function humanize(value: string) {
  return value
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, character => character.toUpperCase());
}

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function StudentSupportPage({
  mode = "list",
}: {
  mode?: "list" | "create";
}) {
  const [version, setVersion] = useState(0);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [result, setResult] = useState("");
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<{
    subject: string;
    details: string;
    category: string;
    priority: TicketPriority;
  }>({
    subject: "",
    details: "",
    category: "learning",
    priority: "normal",
  });
  const state = useMemo(() => platformStore.getState(), [version]);
  const user = requireActiveUser("student");
  const tickets = state.supportTickets
    .filter(ticket => ticket.requesterId === user.id)
    .sort(
      (a, b) =>
        new Date(b.lastUpdatedAt).getTime() -
        new Date(a.lastUpdatedAt).getTime()
    );
  const statuses = Array.from(new Set(tickets.map(ticket => ticket.status)));
  const filteredTickets = tickets.filter(ticket => {
    const text =
      `${ticket.subject} ${ticket.status} ${ticket.priority}`.toLowerCase();
    return (
      (!query.trim() || text.includes(query.trim().toLowerCase())) &&
      (status === "all" || ticket.status === status)
    );
  });
  const createTicket = async (event: FormEvent) => {
    event.preventDefault();
    const subject = draft.subject.trim();
    if (subject.length < 4) {
      toast.error("Request subject must contain at least 4 characters");
      return;
    }
    if (draft.details.trim().length < 20) {
      toast.error("Add at least 20 characters describing the issue");
      return;
    }
    setSaving(true);
    const response = await runPlatformWorkflowActionRequest({
      type: "support.ticket.create",
      idempotencyKey: `support.ticket.create:${crypto.randomUUID()}`,
      subject,
      details: draft.details.trim(),
      category: draft.category,
      priority: draft.priority,
    });
    setSaving(false);
    if (!response.ok || !response.data) {
      toast.error("Support request could not be created", {
        description: response.error,
      });
      return;
    }
    platformStore.setState(response.data.state);
    setDraft({
      subject: "",
      details: "",
      category: "learning",
      priority: "normal",
    });
    setResult("Your support request has been created.");
    setVersion(value => value + 1);
    toast.success("Support request created", {
      description: "Your request is now in the support queue.",
    });
  };

  if (mode === "create") {
    return (
      <PlatformShell role="student" title="New support request">
        <FormFlowLayout
          className="student-support-page student-support-create-page"
          title="New support request"
          description="Tell the school team what you need help with."
          context="Student"
          actions={
            result ? (
              <Link
                className="platform-primary-button"
                href="/app/student/support"
              >
                View requests
              </Link>
            ) : (
              <>
                <Link
                  className="platform-secondary-button"
                  href="/app/student/support"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  form="student-support-request-form"
                  className="platform-primary-button"
                  disabled={saving}
                >
                  <Send size={15} />
                  {saving ? "Sending request" : "Send request"}
                </button>
              </>
            )
          }
          main={
            <section className="student-support-create-surface">
              {result ? (
                <div className="student-support-success" role="status">
                  <CheckCircle2 size={20} />
                  <div>
                    <strong>Request sent</strong>
                    <span>{result}</span>
                  </div>
                </div>
              ) : (
                <form
                  id="student-support-request-form"
                  className="student-support-form simple-form-section"
                  onSubmit={createTicket}
                >
                  <div className="student-support-create-heading">
                    <span>Step 1 of 1</span>
                    <h2>Describe the help you need</h2>
                    <p>
                      Keep the subject short. The support team will follow up in
                      your message inbox.
                    </p>
                  </div>
                  <label>
                    Request subject
                    <input
                      autoFocus
                      value={draft.subject}
                      onChange={event =>
                        setDraft(value => ({
                          ...value,
                          subject: event.target.value,
                        }))
                      }
                      placeholder="Example: I need help with a class recording"
                    />
                  </label>
                  <label>
                    Category
                    <select
                      value={draft.category}
                      onChange={event =>
                        setDraft(value => ({
                          ...value,
                          category: event.target.value,
                        }))
                      }
                    >
                      <option value="learning">Learning</option>
                      <option value="schedule">Schedule</option>
                      <option value="account">Account</option>
                      <option value="technical">Technical</option>
                    </select>
                  </label>
                  <label>
                    Details
                    <textarea
                      value={draft.details}
                      onChange={event =>
                        setDraft(value => ({
                          ...value,
                          details: event.target.value,
                        }))
                      }
                      placeholder="Describe what happened and what you expected."
                    />
                  </label>
                  <label>
                    Priority
                    <select
                      value={draft.priority}
                      onChange={event =>
                        setDraft(value => ({
                          ...value,
                          priority: event.target.value as TicketPriority,
                        }))
                      }
                    >
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </label>
                </form>
              )}
            </section>
          }
        />
      </PlatformShell>
    );
  }

  return (
    <PlatformShell role="student" title="Support">
      <WorkspaceLayout
        className="student-support-page"
        title="Support"
        description="Ask for help and follow your open requests."
        context="Student"
        actions={
          <Link
            className="platform-primary-button"
            href="/app/student/support/new"
          >
            <Send size={15} />
            New request
          </Link>
        }
        toolbar={
          <div className="simple-portal-toolbar student-support-toolbar">
            <label>
              Search
              <span>
                <Search size={15} />
                <input
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="Search requests"
                />
              </span>
            </label>
            <label>
              Status
              <select
                value={status}
                onChange={event => setStatus(event.target.value)}
              >
                <option value="all">All statuses</option>
                {statuses.map(item => (
                  <option key={item} value={item}>
                    {humanize(item)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        }
        main={
          <div className="student-support-main">
            <DataTableCard
              title="Support requests"
              subtitle={`${filteredTickets.length} request(s)`}
              className="student-support-record-card"
            >
              {filteredTickets.length ? (
                <div className="student-support-record-list">
                  {filteredTickets.map(ticket => (
                    <article key={ticket.id}>
                      <div className="student-support-record-copy">
                        <span>Support request</span>
                        <strong>{ticket.subject}</strong>
                      </div>
                      <dl className="student-support-record-facts">
                        <div>
                          <dt>Priority</dt>
                          <dd>{priorityLabel(ticket.priority)}</dd>
                        </div>
                        <div>
                          <dt>Updated</dt>
                          <dd>{formatUpdatedAt(ticket.lastUpdatedAt)}</dd>
                        </div>
                      </dl>
                      <StatusBadge tone={statusTone(ticket.status)}>
                        {humanize(ticket.status)}
                      </StatusBadge>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="platform-empty-state">
                  <strong>No support requests found</strong>
                  <span>Try a different search or create a request.</span>
                </div>
              )}
            </DataTableCard>
          </div>
        }
      />
    </PlatformShell>
  );
}
