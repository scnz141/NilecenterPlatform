import { useMemo, useState } from "react";
import { ArrowRight, CreditCard, Download, Search, WalletCards } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import PlatformShell from "@/components/platform/PlatformShell";
import { WorkspaceLayout } from "@/components/platform/PlatformLayouts";
import {
  DataTableCard,
  StatusBadge,
} from "@/components/platform/PlatformPrimitives";
import { runPlatformWorkflowActionRequest } from "@/lib/backend/api";
import { platformStore } from "@/lib/domain/store";
import type { PaymentStatus } from "@/lib/domain/types";
import { getDemoUser } from "@/lib/platformData";

type PaymentFilter = "all" | PaymentStatus;

function statusTone(status: PaymentStatus): "green" | "amber" | "red" | "slate" {
  if (status === "paid") return "green";
  if (status === "pending" || status === "issued" || status === "draft") {
    return "amber";
  }
  if (status === "overdue" || status === "cancelled" || status === "refunded") {
    return "red";
  }
  return "slate";
}

export default function BranchPaymentsPage() {
  const [version, setVersion] = useState(0);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<PaymentFilter>("all");
  const [paymentSaving, setPaymentSaving] = useState<string | null>(null);

  const state = useMemo(() => platformStore.getState(), [version]);
  const actorId = getDemoUser("branchadmin").id;
  const actor = state.users.find(user => user.id === actorId);
  const staffProfile = state.staffProfiles.find(
    profile => profile.userId === actorId && profile.role === "branchadmin"
  );
  const branchId = actor?.branchId ?? staffProfile?.branchIds[0] ?? "br_cairo";
  const branch = state.branches.find(item => item.id === branchId);
  const branchStudents = state.students.filter(student => {
    const user = state.users.find(item => item.id === student.userId);
    return user?.branchId === branch?.id;
  });
  const branchStudentIds = new Set(branchStudents.map(student => student.id));
  const branchInvoices = state.invoices.filter(invoice =>
    branchStudentIds.has(invoice.studentId)
  );

  const invoiceRows = branchInvoices.map(invoice => {
    const student = state.students.find(item => item.id === invoice.studentId);
    const user = state.users.find(item => item.id === student?.userId);
    const paid = state.payments
      .filter(payment => payment.invoiceId === invoice.id && payment.status === "paid")
      .reduce((sum, payment) => sum + payment.amount, 0);
    const balance = Math.max(0, invoice.amount - paid);
    return { invoice, user, paid, balance };
  });

  const openRows = invoiceRows.filter(
    row =>
      row.balance > 0 &&
      !["paid", "cancelled", "refunded"].includes(row.invoice.status)
  );
  const paidRows = invoiceRows.filter(row => row.invoice.status === "paid");
  const overdueRows = invoiceRows.filter(row => row.invoice.status === "overdue");
  const openBalance = openRows.reduce((sum, row) => sum + row.balance, 0);
  const collectedTotal = invoiceRows.reduce((sum, row) => sum + row.paid, 0);

  const filteredRows = invoiceRows.filter(row => {
    const text = [
      row.invoice.id,
      row.user?.name,
      row.invoice.status,
      row.invoice.currency,
    ]
      .join(" ")
      .toLowerCase();
    const matchesQuery =
      !query.trim() || text.includes(query.trim().toLowerCase());
    const matchesStatus = status === "all" || row.invoice.status === status;
    return matchesQuery && matchesStatus;
  });

  const refresh = () => setVersion(value => value + 1);

  const recordPayment = async (invoiceId: string) => {
    setPaymentSaving(invoiceId);
    const result = await runPlatformWorkflowActionRequest({
      type: "payment.record",
      invoiceId,
      method: "manual",
      actorId,
    });
    setPaymentSaving(null);

    if (!result.ok || !result.data) {
      toast.error("Payment record failed", {
        description: result.error ?? "The server could not record this payment.",
      });
      return;
    }

    platformStore.setState(result.data.state);
    refresh();
    toast.success("Payment recorded", {
      description: `${invoiceId} · ${result.data.persistence}`,
    });
  };

  const exportPaymentsCsv = () => {
    const rows = invoiceRows.map(row => ({
      invoice: row.invoice.id,
      student: row.user?.name ?? row.invoice.studentId,
      status: row.invoice.status,
      amount: row.invoice.amount,
      paid: row.paid,
      balance: row.balance,
      due: row.invoice.dueAt,
    }));
    const csv = platformStore.buildCsv(rows);
    if (!csv) {
      toast.info("No branch payments to export");
      return;
    }
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `branch-${branch?.code ?? "payments"}-payments.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Payments CSV exported", {
      description: `${rows.length} row(s)`,
    });
  };

  return (
    <PlatformShell role="branchadmin" title="Payments">
      <WorkspaceLayout
        title="Payments"
        description="Review branch invoices and record internal payments."
        context={branch?.name ?? "Branch access"}
        actions={
          <Link className="platform-primary-button" href="/app/branch/reports">
            Open reports
            <ArrowRight size={15} />
          </Link>
        }
        toolbar={
          <div className="simple-portal-toolbar">
            <label>
              Search
              <span>
                <Search size={15} />
                <input
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="Invoice or student"
                />
              </span>
            </label>
            <label>
              Status
              <select
                value={status}
                onChange={event => setStatus(event.target.value as PaymentFilter)}
              >
                <option value="all">All statuses</option>
                <option value="pending">Pending</option>
                <option value="overdue">Overdue</option>
                <option value="paid">Paid</option>
                <option value="cancelled">Cancelled</option>
                <option value="refunded">Refunded</option>
              </select>
            </label>
          </div>
        }
        main={
          <DataTableCard
            title="Branch invoices"
            subtitle={`${filteredRows.length} invoice(s)`}
          >
            <div className="branch-class-list compact">
              {filteredRows.length ? (
                filteredRows.map(row => (
                  <article key={row.invoice.id}>
                    <div>
                      <strong>{row.invoice.id}</strong>
                      <small>
                        {row.user?.name ?? row.invoice.studentId} · due{" "}
                        {new Date(row.invoice.dueAt).toLocaleDateString()} · paid{" "}
                        {row.invoice.currency} {row.paid}
                      </small>
                    </div>
                    <StatusBadge tone={statusTone(row.invoice.status)}>
                      {row.invoice.status}
                    </StatusBadge>
                    <em>
                      {row.balance > 0
                        ? `${row.invoice.currency} ${row.balance}`
                        : "settled"}
                    </em>
                    <button
                      className="platform-secondary-button compact"
                      disabled={
                        paymentSaving === row.invoice.id ||
                        row.balance <= 0 ||
                        row.invoice.status === "paid" ||
                        row.invoice.status === "cancelled" ||
                        row.invoice.status === "refunded"
                      }
                      onClick={() => void recordPayment(row.invoice.id)}
                    >
                      <CreditCard size={15} />
                      {paymentSaving === row.invoice.id
                        ? "Recording payment"
                        : "Record payment"}
                    </button>
                  </article>
                ))
              ) : (
                <article>
                  <div>
                    <strong>No branch invoices found</strong>
                    <small>
                      Try another search or status filter for this branch.
                    </small>
                  </div>
                  <StatusBadge tone="slate">Empty</StatusBadge>
                </article>
              )}
            </div>
          </DataTableCard>
        }
        side={
          <>
            <section className="branch-panel branch-payment-panel">
              <div className="branch-panel-head">
                <div>
                  <span>Payment summary</span>
                  <strong>EGP {openBalance}</strong>
                </div>
                <WalletCards size={18} />
              </div>
              <div className="branch-settings-list">
                {[
                  ["Open invoices", `${openRows.length} invoice(s)`],
                  ["Overdue", `${overdueRows.length} invoice(s)`],
                  ["Paid invoices", `${paidRows.length} invoice(s)`],
                  ["Collected", `EGP ${collectedTotal}`],
                ].map(([label, value]) => (
                  <article key={label}>
                    <CreditCard size={15} />
                    <div>
                      <strong>{label}</strong>
                      <small>{value}</small>
                    </div>
                  </article>
                ))}
              </div>
            </section>
            <section className="branch-panel">
              <div className="branch-panel-head">
                <div>
                  <span>Next action</span>
                  <strong>
                    {openRows.length ? "Record branch payment" : "Payments clear"}
                  </strong>
                </div>
                <StatusBadge tone={openRows.length ? "amber" : "green"}>
                  {openRows.length ? "Review" : "Ready"}
                </StatusBadge>
              </div>
              <div className="branch-class-list compact">
                {openRows.slice(0, 3).map(row => (
                  <article key={row.invoice.id}>
                    <div>
                      <strong>{row.user?.name ?? row.invoice.studentId}</strong>
                      <small>
                        {row.invoice.id} · {row.invoice.currency} {row.balance}
                      </small>
                    </div>
                    <span>{row.invoice.status}</span>
                  </article>
                ))}
                {!openRows.length ? (
                  <article>
                    <div>
                      <strong>No open balances</strong>
                      <small>All visible branch invoices are settled or closed.</small>
                    </div>
                    <span>0</span>
                  </article>
                ) : null}
              </div>
              <button
                className="platform-secondary-button"
                onClick={exportPaymentsCsv}
                disabled={!invoiceRows.length}
              >
                <Download size={15} />
                Export payments CSV
              </button>
            </section>
          </>
        }
      />
    </PlatformShell>
  );
}
