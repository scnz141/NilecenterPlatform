import { requireActiveUser } from "@/lib/auth/session";
import { useMemo, useState } from "react";
import { CheckCircle2, CreditCard, Download, Search } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import PlatformShell from "@/components/platform/PlatformShell";
import {
  DetailLayout,
  WorkspaceLayout,
} from "@/components/platform/PlatformLayouts";
import {
  DataTableCard,
  StatusBadge,
} from "@/components/platform/PlatformPrimitives";
import { runPlatformWorkflowActionRequest } from "@/lib/backend/api";
import { platformStore } from "@/lib/domain/store";
import type { PaymentStatus } from "@/lib/domain/types";

type PaymentFilter = "all" | PaymentStatus;

type BranchPaymentsPageProps = {
  invoiceId?: string;
};

function statusTone(
  status: PaymentStatus
): "green" | "amber" | "red" | "slate" {
  if (status === "paid") return "green";
  if (status === "pending" || status === "issued" || status === "draft") {
    return "amber";
  }
  if (status === "overdue" || status === "cancelled" || status === "refunded") {
    return "red";
  }
  return "slate";
}

function humanize(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, item => item.toUpperCase());
}

function formatDate(value?: string) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export default function BranchPaymentsPage({
  invoiceId,
}: BranchPaymentsPageProps) {
  const [version, setVersion] = useState(0);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<PaymentFilter>("all");
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentRecorded, setPaymentRecorded] = useState(false);
  const [paymentError, setPaymentError] = useState("");

  const state = useMemo(() => platformStore.getState(), [version]);
  const actorId = requireActiveUser("branchadmin").id;
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
  const invoiceRows = state.invoices
    .filter(invoice => branchStudentIds.has(invoice.studentId))
    .map(invoice => {
      const student = state.students.find(
        item => item.id === invoice.studentId
      );
      const user = state.users.find(item => item.id === student?.userId);
      const payments = state.payments
        .filter(payment => payment.invoiceId === invoice.id)
        .sort(
          (a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime()
        );
      const paid = payments
        .filter(payment => payment.status === "paid")
        .reduce((sum, payment) => sum + payment.amount, 0);
      const balance = Math.max(0, invoice.amount - paid);
      const invoiceStatus: PaymentStatus =
        balance <= 0 ? "paid" : invoice.status;
      return { invoice, user, payments, paid, balance, status: invoiceStatus };
    });
  const selectedRow = invoiceId
    ? invoiceRows.find(row => row.invoice.id === invoiceId)
    : undefined;
  const firstOpenInvoice = invoiceRows.find(
    row =>
      row.balance > 0 && row.status !== "cancelled" && row.status !== "refunded"
  );
  const filteredRows = invoiceRows.filter(row => {
    const text = [
      row.invoice.id,
      row.user?.name,
      row.status,
      row.invoice.currency,
    ]
      .join(" ")
      .toLowerCase();
    const matchesQuery =
      !query.trim() || text.includes(query.trim().toLowerCase());
    const matchesStatus = status === "all" || row.status === status;
    return matchesQuery && matchesStatus;
  });

  const refresh = () => setVersion(value => value + 1);

  const recordPayment = async () => {
    if (!selectedRow || paymentSaving) return;
    setPaymentSaving(true);
    setPaymentError("");
    setPaymentRecorded(false);
    const result = await runPlatformWorkflowActionRequest({
      type: "payment.record",
      invoiceId: selectedRow.invoice.id,
      method: "manual",
      actorId,
    });
    setPaymentSaving(false);

    if (!result.ok || !result.data) {
      const message = result.error ?? "The payment could not be recorded.";
      setPaymentError(message);
      toast.error("Payment record failed", { description: message });
      return;
    }

    platformStore.setState(result.data.state);
    refresh();
    setPaymentRecorded(true);
    toast.success("Payment recorded");
  };

  const exportPaymentsCsv = () => {
    const rows = invoiceRows.map(row => ({
      invoice: row.invoice.id,
      student: row.user?.name ?? row.invoice.studentId,
      status: row.status,
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

  if (invoiceId) {
    const canRecord = Boolean(
      selectedRow &&
        selectedRow.balance > 0 &&
        selectedRow.status !== "cancelled" &&
        selectedRow.status !== "refunded"
    );

    return (
      <PlatformShell role="branchadmin" title="Record payment">
        <DetailLayout
          className="branch-payments-page branch-payment-detail-page"
          title={selectedRow?.user?.name ?? "Invoice"}
          description={
            selectedRow
              ? "Review one branch invoice and record a payment."
              : "This invoice is not available in your branch."
          }
          context={branch?.name ?? "Branch"}
          actions={
            <Link
              className="platform-secondary-button"
              href="/app/branch/payments"
            >
              Back to payments
            </Link>
          }
          main={
            selectedRow ? (
              <div className="branch-payment-detail-stack">
                <section className="branch-payment-detail-summary">
                  <div>
                    <span>Invoice</span>
                    <strong>{selectedRow.invoice.id}</strong>
                    <p>Due {formatDate(selectedRow.invoice.dueAt)}</p>
                  </div>
                  <StatusBadge tone={statusTone(selectedRow.status)}>
                    {humanize(selectedRow.status)}
                  </StatusBadge>
                </section>

                <dl className="branch-payment-detail-facts">
                  <div>
                    <dt>Total due</dt>
                    <dd>
                      {selectedRow.invoice.currency}{" "}
                      {selectedRow.invoice.amount}
                    </dd>
                  </div>
                  <div>
                    <dt>Already paid</dt>
                    <dd>
                      {selectedRow.invoice.currency} {selectedRow.paid}
                    </dd>
                  </div>
                  <div>
                    <dt>Remaining</dt>
                    <dd>
                      {selectedRow.invoice.currency} {selectedRow.balance}
                    </dd>
                  </div>
                </dl>

                {canRecord ? (
                  <section
                    className="branch-payment-action"
                    data-testid="branch-payment-record-detail"
                  >
                    <div>
                      <h2>Record payment</h2>
                      <p>
                        Record the remaining balance as an internal receipt.
                      </p>
                    </div>
                    {paymentError ? (
                      <p className="platform-form-error">{paymentError}</p>
                    ) : null}
                    {paymentRecorded ? (
                      <div
                        className="branch-payment-success"
                        data-testid="branch-payment-success"
                      >
                        <CheckCircle2 size={18} />
                        <span>
                          Payment recorded. The balance is up to date.
                        </span>
                      </div>
                    ) : null}
                    <button
                      type="button"
                      className="platform-primary-button"
                      disabled={paymentSaving}
                      onClick={recordPayment}
                    >
                      <CreditCard size={15} />
                      {paymentSaving ? "Recording payment" : "Record payment"}
                    </button>
                  </section>
                ) : (
                  <section
                    className="branch-payment-complete"
                    data-testid={
                      paymentRecorded ? "branch-payment-success" : undefined
                    }
                  >
                    <CheckCircle2 size={18} />
                    <div>
                      <strong>
                        {paymentRecorded
                          ? "Payment recorded"
                          : "No payment action needed"}
                      </strong>
                      <p>
                        {paymentRecorded
                          ? "The remaining balance is now settled."
                          : "This invoice is settled or cannot accept another payment."}
                      </p>
                    </div>
                  </section>
                )}

                <DataTableCard
                  title="Payment history"
                  subtitle={`${selectedRow.payments.length} record(s)`}
                  className="branch-payment-record-card branch-payment-history-card"
                >
                  <div className="branch-payment-record-list branch-payment-history-list">
                    {selectedRow.payments.map(payment => (
                      <article
                        key={payment.id}
                        className="branch-payment-record branch-payment-history-record"
                      >
                        <div className="branch-payment-record-primary">
                          <strong>{formatDate(payment.paidAt)}</strong>
                          <span>{humanize(payment.method)}</span>
                        </div>
                        <dl className="branch-payment-record-facts">
                          <div>
                            <dt>Reference</dt>
                            <dd>{payment.reference ?? "No reference"}</dd>
                          </div>
                          <div>
                            <dt>Amount</dt>
                            <dd>
                              {selectedRow.invoice.currency} {payment.amount}
                            </dd>
                          </div>
                        </dl>
                        <StatusBadge tone={statusTone(payment.status)}>
                          {humanize(payment.status)}
                        </StatusBadge>
                      </article>
                    ))}
                    {!selectedRow.payments.length ? (
                      <div className="platform-empty-state">
                        <strong>No payment records yet</strong>
                        <span>Receipts for this invoice will appear here.</span>
                      </div>
                    ) : null}
                  </div>
                </DataTableCard>
              </div>
            ) : (
              <div className="platform-empty-state">
                <strong>Invoice not found</strong>
                <span>
                  Return to the branch payment list and choose another invoice.
                </span>
              </div>
            )
          }
        />
      </PlatformShell>
    );
  }

  return (
    <PlatformShell role="branchadmin" title="Payments">
      <WorkspaceLayout
        className="branch-payments-page branch-payments-list-page"
        title="Payments"
        description="Review branch invoices and record internal payments."
        context={branch?.name ?? "Branch access"}
        actions={
          <>
            <button
              type="button"
              className="platform-secondary-button"
              onClick={exportPaymentsCsv}
              disabled={!invoiceRows.length}
            >
              <Download size={15} />
              Export CSV
            </button>
            {firstOpenInvoice ? (
              <Link
                className="platform-primary-button"
                href={`/app/branch/payments/${firstOpenInvoice.invoice.id}`}
              >
                <CreditCard size={15} />
                Record payment
              </Link>
            ) : null}
          </>
        }
        toolbar={
          <div
            className="branch-payment-toolbar-v4"
            data-testid="branch-payments-toolbar"
          >
            <label className="branch-payment-search">
              <span className="sr-only">Search invoices</span>
              <Search size={15} />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Search invoices"
              />
            </label>
            <label className="branch-payment-filter">
              <span>Status</span>
              <select
                value={status}
                onChange={event =>
                  setStatus(event.target.value as PaymentFilter)
                }
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
            className="branch-payment-record-card branch-payment-list-card"
          >
            <div
              className="branch-payment-record-list branch-payment-list"
              data-testid="branch-payments-list"
            >
              {filteredRows.map(row => (
                <article
                  key={row.invoice.id}
                  className="branch-payment-record branch-payment-list-record"
                  data-invoice-id={row.invoice.id}
                >
                  <div className="branch-payment-record-primary">
                    <strong>{row.user?.name ?? "Learner"}</strong>
                    <span>{row.invoice.id}</span>
                  </div>
                  <dl className="branch-payment-record-facts">
                    <div>
                      <dt>Due</dt>
                      <dd>{formatDate(row.invoice.dueAt)}</dd>
                    </div>
                    <div>
                      <dt>Paid</dt>
                      <dd>
                        {row.invoice.currency} {row.paid}
                      </dd>
                    </div>
                    <div>
                      <dt>Balance</dt>
                      <dd>
                        {row.invoice.currency} {row.balance}
                      </dd>
                    </div>
                  </dl>
                  <StatusBadge tone={statusTone(row.status)}>
                    {humanize(row.status)}
                  </StatusBadge>
                  <Link
                    className="platform-row-link"
                    href={`/app/branch/payments/${row.invoice.id}`}
                  >
                    {row.balance > 0 ? "Record" : "View"}
                  </Link>
                </article>
              ))}
              {!filteredRows.length ? (
                <div className="platform-empty-state">
                  <strong>No branch invoices found</strong>
                  <span>
                    Try another search or status filter for this branch.
                  </span>
                </div>
              ) : null}
            </div>
          </DataTableCard>
        }
      />
    </PlatformShell>
  );
}
