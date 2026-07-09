import { useMemo, useState, type FormEvent } from "react";
import { CheckCircle2, LifeBuoy, Search, Send } from "lucide-react";
import { toast } from "sonner";
import PlatformShell from "@/components/platform/PlatformShell";
import { WorkspaceLayout } from "@/components/platform/PlatformLayouts";
import {
  DataTableCard,
  StatusBadge,
} from "@/components/platform/PlatformPrimitives";
import { platformStore } from "@/lib/domain/store";
import type { EntityStatus, SupportTicket } from "@/lib/domain/types";
import { getDemoUser } from "@/lib/platformData";

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

export default function StudentSupportPage() {
  const [version, setVersion] = useState(0);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [result, setResult] = useState("");
  const [draft, setDraft] = useState<{
    subject: string;
    priority: TicketPriority;
  }>({
    subject: "",
    priority: "normal",
  });
  const state = useMemo(() => platformStore.getState(), [version]);
  const user = getDemoUser("student");
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
  const openTickets = tickets.filter(
    ticket => ticket.status !== "completed" && ticket.status !== "cancelled"
  ).length;

  const createTicket = (event: FormEvent) => {
    event.preventDefault();
    const subject = draft.subject.trim();
    if (!subject) {
      toast.error("Request subject is required");
      return;
    }

    const next = structuredClone(state);
    const id = `ticket_${Date.now().toString(36)}`;
    next.supportTickets = [
      {
        id,
        requesterId: user.id,
        subject,
        status: "pending",
        priority: draft.priority,
        lastUpdatedAt: new Date().toISOString(),
      },
      ...next.supportTickets,
    ];
    platformStore.setState(next);
    platformStore.audit(
      "support.ticket_created",
      "SupportTicket",
      id,
      `Created support ticket: ${subject}.`,
      user.id
    );
    setDraft({ subject: "", priority: "normal" });
    setResult(`Created support request ${id}.`);
    setVersion(value => value + 1);
    toast.success("Support request created", { description: id });
  };

  return (
    <PlatformShell role="student" title="Support">
      <WorkspaceLayout
        className="student-support-page"
        title="Support"
        description="Ask for help and follow your open requests."
        context="Student"
        actions={
          <button
            type="submit"
            form="student-support-request-form"
            className="platform-primary-button"
          >
            <Send size={15} />
            Create request
          </button>
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
            <DataTableCard title="New request" subtitle="Tell us what happened">
              <form
                id="student-support-request-form"
                className="student-support-form simple-form-section"
                onSubmit={createTicket}
              >
                <label>
                  Request subject
                  <input
                    value={draft.subject}
                    onChange={event =>
                      setDraft(value => ({
                        ...value,
                        subject: event.target.value,
                      }))
                    }
                    placeholder="Example: I need help with class recording"
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
                {result ? (
                  <div className="simple-success-state" role="status">
                    <CheckCircle2 size={15} />
                    <span>{result}</span>
                  </div>
                ) : null}
              </form>
            </DataTableCard>

            <DataTableCard
              title="Support requests"
              subtitle={`${filteredTickets.length} request(s)`}
            >
              <table className="student-support-table">
                <thead>
                  <tr>
                    <th>Request</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTickets.length ? (
                    filteredTickets.map(ticket => (
                      <tr key={ticket.id}>
                        <td>
                          <strong>{ticket.subject}</strong>
                          <small>{ticket.id}</small>
                        </td>
                        <td>{priorityLabel(ticket.priority)}</td>
                        <td>
                          <StatusBadge tone={statusTone(ticket.status)}>
                            {humanize(ticket.status)}
                          </StatusBadge>
                        </td>
                        <td>
                          {new Date(ticket.lastUpdatedAt).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4}>
                        <strong>No support requests found</strong>
                        <small>
                          Try a different search or create a request.
                        </small>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </DataTableCard>
          </div>
        }
        side={
          <aside className="portal-simple-stack">
            <section className="portal-simple-side-card">
              <span>
                <LifeBuoy size={15} />
                Support status
              </span>
              <strong>{openTickets} open</strong>
              <p>Support requests stay attached to your student account.</p>
            </section>
            <section className="portal-simple-side-card">
              <span>
                <CheckCircle2 size={15} />
                What helps
              </span>
              <strong>Keep it short</strong>
              <p>
                Include the class, lesson, or assignment name when relevant.
              </p>
            </section>
          </aside>
        }
      />
    </PlatformShell>
  );
}
