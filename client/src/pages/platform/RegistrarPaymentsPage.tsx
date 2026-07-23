import { requireActiveUser } from "@/lib/auth/session";
import { useMemo, useState } from "react";
import { CheckCircle2, CreditCard, Search } from "lucide-react";
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
import type { Payment, PaymentStatus } from "@/lib/domain/types";

type RegistrarPaymentsPageProps = {
  invoiceId?: string;
};

const paymentMethods: Payment["method"][] = [
  "manual",
  "cash",
  "bank_transfer",
  "card",
];

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

function humanize(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, item => item.toUpperCase());
}

function statusTone(
  status: PaymentStatus
): "green" | "amber" | "red" | "slate" {
  if (status === "paid") return "green";
  if (status === "overdue") return "red";
  if (status === "pending" || status === "issued" || status === "draft") {
    return "amber";
  }
  return "slate";
}

export default function RegistrarPaymentsPage({
  invoiceId,
}: RegistrarPaymentsPageProps) {
  const [version, setVersion] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "open" | "paid" | "overdue"
  >("all");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<Payment["method"]>("manual");
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [recorded, setRecorded] = useState(false);

  const state = useMemo(() => platformStore.getState(), [version]);
  const actorId = requireActiveUser("registrar").id;
  const refresh = () => setVersion(current => current + 1);

  const paymentRows = state.invoices.map(invoice => {
    const student = state.students.find(item => item.id === invoice.studentId);
    const user = state.users.find(item => item.id === student?.userId);
    const branch = state.branches.find(item => item.id === user?.branchId);
    const enrollment = state.enrollments.find(
      item => item.studentId === invoice.studentId
    );
    const run = state.courseRuns.find(
      item => item.id === enrollment?.courseRunId
    );
    const course = state.courses.find(item => item.id === run?.courseId);
    const classGroup = state.classGroups.find(
      item => item.id === enrollment?.classGroupId
    );
    const payments = state.payments
      .filter(payment => payment.invoiceId === invoice.id)
      .sort(
        (a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime()
      );
    const paid = payments
      .filter(payment => payment.status === "paid")
      .reduce((sum, payment) => sum + payment.amount, 0);
    const balance = Math.max(0, invoice.amount - paid);
    const status: PaymentStatus = balance <= 0 ? "paid" : invoice.status;

    return {
      invoice,
      user,
      branch,
      enrollment,
      course,
      classGroup,
      payments,
      paid,
      balance,
      status,
    };
  });

  const selectedRow = invoiceId
    ? paymentRows.find(row => row.invoice.id === invoiceId)
    : undefined;
  const firstOpenInvoice = paymentRows.find(
    row =>
      row.balance > 0 && row.status !== "cancelled" && row.status !== "refunded"
  );
  const filteredRows = paymentRows.filter(row => {
    const query = search.trim().toLowerCase();
    const matchesQuery =
      !query ||
      [
        row.invoice.id,
        row.user?.name,
        row.user?.email,
        row.branch?.name,
        row.course?.title,
        row.classGroup?.name,
        row.status,
      ]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(query));
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "open" &&
        row.balance > 0 &&
        row.status !== "overdue") ||
      (statusFilter === "paid" && row.balance <= 0) ||
      (statusFilter === "overdue" && row.status === "overdue");
    return matchesQuery && matchesStatus;
  });

  const recordPayment = async () => {
    if (!selectedRow || saving) return;
    const requestedAmount = Number(amount || selectedRow.balance);
    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
      setError("Enter a payment amount greater than zero.");
      return;
    }

    setSaving(true);
    setError("");
    setRecorded(false);
    const response = await runPlatformWorkflowActionRequest({
      type: "payment.record",
      invoiceId: selectedRow.invoice.id,
      amount: Math.min(requestedAmount, selectedRow.balance),
      method,
      reference: reference.trim() || undefined,
      actorId,
    });
    setSaving(false);

    if (!response.ok || !response.data) {
      const message = response.error ?? "Check the invoice and try again.";
      setError(message);
      toast.error("Payment could not be recorded", { description: message });
      return;
    }

    platformStore.setState(response.data.state);
    refresh();
    setAmount("");
    setReference("");
    setRecorded(true);
    toast.success("Payment recorded");
  };

  if (invoiceId) {
    const canRecord = Boolean(
      selectedRow &&
        selectedRow.balance > 0 &&
        selectedRow.status !== "cancelled" &&
        selectedRow.status !== "refunded"
    );

    return (
      <PlatformShell role="registrar" title="Record payment">
        <DetailLayout
          className="registrar-payments-page registrar-payment-detail-page"
          title={selectedRow?.user?.name ?? "Invoice"}
          description={
            selectedRow
              ? "Review one invoice and record a receipt."
              : "This invoice is no longer available."
          }
          context="Registrar"
          actions={
            <Link
              className="platform-secondary-button"
              href="/app/registrar/payments"
            >
              Back to payments
            </Link>
          }
          main={
            selectedRow ? (
              <div className="registrar-payment-detail-stack">
                <section className="registrar-payment-detail-summary">
                  <div>
                    <span>Invoice</span>
                    <strong>{selectedRow.invoice.id}</strong>
                    <p>
                      {selectedRow.course?.title ?? "Course"} ·{" "}
                      {selectedRow.branch?.name ?? "Branch"}
                    </p>
                  </div>
                  <StatusBadge tone={statusTone(selectedRow.status)}>
                    {humanize(selectedRow.status)}
                  </StatusBadge>
                </section>

                <dl className="registrar-payment-detail-facts">
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
                  <div>
                    <dt>Due date</dt>
                    <dd>{formatDate(selectedRow.invoice.dueAt)}</dd>
                  </div>
                </dl>

                {canRecord ? (
                  <section
                    className="portal-ia-form-card registrar-payment-record-form"
                    data-testid="registrar-payment-record-form"
                  >
                    <div>
                      <h2>Record receipt</h2>
                      <p>
                        Enter the amount received and the receipt reference.
                      </p>
                    </div>
                    {error ? (
                      <p className="platform-form-error">{error}</p>
                    ) : null}
                    {recorded ? (
                      <div
                        className="registrar-payment-success"
                        data-testid="registrar-payment-success"
                      >
                        <CheckCircle2 size={18} />
                        <span>
                          Payment recorded. The invoice balance is up to date.
                        </span>
                      </div>
                    ) : null}
                    <div className="portal-ia-form-grid">
                      <label>
                        Amount
                        <input
                          type="number"
                          min="0"
                          max={selectedRow.balance}
                          value={amount || String(selectedRow.balance)}
                          disabled={saving}
                          onChange={event => setAmount(event.target.value)}
                        />
                      </label>
                      <label>
                        Method
                        <select
                          value={method}
                          disabled={saving}
                          onChange={event =>
                            setMethod(event.target.value as Payment["method"])
                          }
                        >
                          {paymentMethods.map(option => (
                            <option key={option} value={option}>
                              {humanize(option)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="wide">
                        Receipt reference
                        <input
                          value={reference}
                          disabled={saving}
                          placeholder="Optional receipt or transfer reference"
                          onChange={event => setReference(event.target.value)}
                        />
                      </label>
                    </div>
                    <div className="portal-ia-actions">
                      <button
                        type="button"
                        className="platform-primary-button"
                        disabled={saving}
                        onClick={recordPayment}
                      >
                        <CreditCard size={15} />
                        {saving ? "Recording payment" : "Record payment"}
                      </button>
                    </div>
                  </section>
                ) : (
                  <section className="registrar-payment-complete">
                    <CheckCircle2 size={18} />
                    <div>
                      <strong>No payment action needed</strong>
                      <p>
                        This invoice is settled or cannot accept another
                        receipt.
                      </p>
                    </div>
                  </section>
                )}

                <DataTableCard
                  title="Payment history"
                  subtitle={`${selectedRow.payments.length} record(s)`}
                  className="registrar-record-card registrar-payment-history-card"
                >
                  <div className="registrar-record-list registrar-payment-history-list">
                    {selectedRow.payments.map(payment => (
                      <article
                        key={payment.id}
                        className="registrar-record-row registrar-payment-history-record"
                      >
                        <div className="registrar-record-primary">
                          <strong>{formatDate(payment.paidAt)}</strong>
                          <span>{humanize(payment.method)}</span>
                        </div>
                        <dl className="registrar-record-facts">
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
                        <strong>No receipt records yet</strong>
                        <span>Recorded payments will appear here.</span>
                      </div>
                    ) : null}
                  </div>
                </DataTableCard>
              </div>
            ) : (
              <div className="platform-empty-state">
                <strong>Invoice not found</strong>
                <span>
                  Return to the payments list and choose an available invoice.
                </span>
              </div>
            )
          }
        />
      </PlatformShell>
    );
  }

  return (
    <PlatformShell role="registrar" title="Payments">
      <WorkspaceLayout
        className="registrar-payments-page registrar-payments-list-page"
        title="Payments"
        description="Find invoices and record a receipt."
        context="Registrar"
        actions={
          firstOpenInvoice ? (
            <Link
              className="platform-primary-button"
              href={`/app/registrar/payments/${firstOpenInvoice.invoice.id}`}
            >
              <CreditCard size={15} />
              Record payment
            </Link>
          ) : undefined
        }
        toolbar={
          <div
            className="registrar-list-toolbar-v3"
            data-testid="registrar-payments-toolbar"
          >
            <label className="registrar-list-search">
              <span className="sr-only">Search payments</span>
              <Search size={15} />
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Search invoices"
              />
            </label>
            <label className="registrar-list-select">
              <span>Status</span>
              <select
                value={statusFilter}
                onChange={event =>
                  setStatusFilter(event.target.value as typeof statusFilter)
                }
              >
                <option value="all">All statuses</option>
                <option value="open">Open balance</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
              </select>
            </label>
          </div>
        }
        main={
          <DataTableCard
            title="Invoices"
            subtitle={`${filteredRows.length} invoice(s)`}
            className="registrar-record-card registrar-payments-record-card"
          >
            <div
              className="registrar-record-list registrar-payments-record-list"
              data-testid="registrar-payments-list"
            >
              {filteredRows.map(row => (
                <article
                  key={row.invoice.id}
                  className="registrar-record-row registrar-payment-record"
                  data-invoice-id={row.invoice.id}
                >
                  <div className="registrar-record-primary">
                    <strong>{row.user?.name ?? row.invoice.studentId}</strong>
                    <span>
                      {row.branch?.name ?? "No branch"} · {row.invoice.id}
                    </span>
                  </div>
                  <dl className="registrar-record-facts">
                    <div>
                      <dt>Course</dt>
                      <dd>{row.course?.title ?? "Course pending"}</dd>
                    </div>
                    <div>
                      <dt>Due</dt>
                      <dd>{formatDate(row.invoice.dueAt)}</dd>
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
                    href={`/app/registrar/payments/${row.invoice.id}`}
                  >
                    {row.balance > 0 ? "Record" : "View"}
                  </Link>
                </article>
              ))}
              {!filteredRows.length ? (
                <div className="platform-empty-state">
                  <strong>No invoices match this view</strong>
                  <span>Clear the search or choose another status.</span>
                </div>
              ) : null}
            </div>
          </DataTableCard>
        }
      />
    </PlatformShell>
  );
}
