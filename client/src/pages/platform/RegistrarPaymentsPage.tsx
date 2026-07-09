import { useMemo, useState } from "react";
import { CreditCard, Filter, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import PlatformShell from "@/components/platform/PlatformShell";
import { WorkspaceLayout } from "@/components/platform/PlatformLayouts";
import { runPlatformWorkflowActionRequest } from "@/lib/backend/api";
import { platformStore } from "@/lib/domain/store";
import type { Payment } from "@/lib/domain/types";
import { getDemoUser } from "@/lib/platformData";

const paymentMethods: Payment["method"][] = [
  "manual",
  "cash",
  "bank_transfer",
  "card",
];

export default function RegistrarPaymentsPage() {
  const [version, setVersion] = useState(0);
  const [paymentSearch, setPaymentSearch] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<
    "all" | "open" | "paid" | "overdue"
  >("all");
  const [paymentAmountDrafts, setPaymentAmountDrafts] = useState<
    Record<string, string>
  >({});
  const [paymentMethodDrafts, setPaymentMethodDrafts] = useState<
    Record<string, Payment["method"]>
  >({});
  const [paymentReferenceDrafts, setPaymentReferenceDrafts] = useState<
    Record<string, string>
  >({});
  const [pendingAction, setPendingAction] = useState("");

  const state = useMemo(() => platformStore.getState(), [version]);
  const actorId = getDemoUser("registrar").id;
  const refresh = () => setVersion(current => current + 1);
  const isAnyActionPending = Boolean(pendingAction);
  const isActionPending = (actionKey: string) => pendingAction === actionKey;

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
    const payments = state.payments.filter(
      payment => payment.invoiceId === invoice.id && payment.status === "paid"
    );
    const paid = payments.reduce((sum, payment) => sum + payment.amount, 0);
    const balance = Math.max(0, invoice.amount - paid);
    const lastPayment = [...payments].sort((a, b) =>
      b.paidAt.localeCompare(a.paidAt)
    )[0];
    const status = balance <= 0 ? "paid" : invoice.status;

    return {
      invoice,
      student,
      user,
      branch,
      enrollment,
      run,
      course,
      classGroup,
      payments,
      paid,
      balance,
      lastPayment,
      status,
    };
  });

  const filteredPaymentRows = paymentRows.filter(row => {
    const query = paymentSearch.trim().toLowerCase();
    const matchesQuery =
      !query ||
      [
        row.invoice.id,
        row.enrollment?.id,
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
      paymentStatusFilter === "all" ||
      (paymentStatusFilter === "open" &&
        row.balance > 0 &&
        row.status !== "overdue") ||
      (paymentStatusFilter === "paid" && row.balance <= 0) ||
      (paymentStatusFilter === "overdue" && row.status === "overdue");
    return matchesQuery && matchesStatus;
  });

  const paymentTotals = {
    invoices: paymentRows.length,
    open: paymentRows.filter(row => row.balance > 0).length,
    paid: paymentRows.filter(row => row.balance <= 0).length,
    collected: paymentRows.reduce((sum, row) => sum + row.paid, 0),
    balance: paymentRows.reduce((sum, row) => sum + row.balance, 0),
  };

  const recordInvoicePayment = async (invoiceId: string, balance: number) => {
    const paymentRow = Array.from(
      document.querySelectorAll<HTMLElement>(".registrar-payment-row")
    ).find(row => row.dataset.invoiceId === invoiceId);
    const amountInput = paymentRow?.querySelector<HTMLInputElement>(
      ".registrar-payment-amount-input"
    );
    const methodSelect = paymentRow?.querySelector<HTMLSelectElement>(
      ".registrar-payment-record-fields select"
    );
    const referenceInput = Array.from(
      paymentRow?.querySelectorAll<HTMLInputElement>(
        ".registrar-payment-record-fields input"
      ) ?? []
    ).find(input => !input.classList.contains("registrar-payment-amount-input"));
    const requestedAmount = Number(
      paymentAmountDrafts[invoiceId] ?? amountInput?.value ?? balance
    );
    const actionKey = `payment.record:${invoiceId}`;

    setPendingAction(actionKey);
    try {
      const response = await runPlatformWorkflowActionRequest({
        type: "payment.record",
        invoiceId,
        amount: Number.isFinite(requestedAmount) ? requestedAmount : balance,
        method: (paymentMethodDrafts[invoiceId] ??
          methodSelect?.value ??
          "manual") as Payment["method"],
        reference:
          paymentReferenceDrafts[invoiceId]?.trim() ||
          referenceInput?.value.trim() ||
          undefined,
        actorId,
      });

      if (!response.data) {
        throw new Error(response.error ?? "Payment action returned no state.");
      }

      platformStore.setState(response.data.state);
      refresh();
      toast.success("Payment recorded");
      setPaymentAmountDrafts(current => {
        const next = { ...current };
        delete next[invoiceId];
        return next;
      });
      setPaymentReferenceDrafts(current => {
        const next = { ...current };
        delete next[invoiceId];
        return next;
      });
    } catch (error) {
      toast.error("Payment could not be recorded", {
        description:
          error instanceof Error
            ? error.message
            : "Check the invoice and try again.",
      });
    } finally {
      setPendingAction("");
    }
  };

  return (
    <PlatformShell role="registrar" title="Registrar payments">
      <WorkspaceLayout
        title="Payments"
        description="Record receipts and review open balances."
        context="Registrar"
        main={
          <div className="registrar-payment-desk">
            <section className="registrar-payment-command registrar-panel">
              <div className="registrar-panel-head">
                <div>
                  <span>Payment operations</span>
                  <strong>Collect, reconcile, and audit invoices</strong>
                </div>
                <CreditCard size={18} />
              </div>
              <div className="registrar-payment-summary">
                <article>
                  <span>Total invoices</span>
                  <strong>{paymentTotals.invoices}</strong>
                  <small>Visible in registrar scope</small>
                </article>
                <article>
                  <span>Open balances</span>
                  <strong>{paymentTotals.open}</strong>
                  <small>EGP {paymentTotals.balance} remaining</small>
                </article>
                <article>
                  <span>Collected</span>
                  <strong>EGP {paymentTotals.collected}</strong>
                  <small>{paymentTotals.paid} settled invoice(s)</small>
                </article>
              </div>
              <div className="registrar-payment-toolbar">
                <label>
                  <Search size={15} />
                  <input
                    aria-label="Search registrar payment ledger"
                    value={paymentSearch}
                    onChange={event => setPaymentSearch(event.target.value)}
                    placeholder="Search invoice, student, email, branch"
                  />
                </label>
                <label>
                  <Filter size={15} />
                  <select
                    value={paymentStatusFilter}
                    onChange={event =>
                      setPaymentStatusFilter(
                        event.target.value as typeof paymentStatusFilter
                      )
                    }
                  >
                    <option value="all">All statuses</option>
                    <option value="open">Open balance</option>
                    <option value="paid">Paid</option>
                    <option value="overdue">Overdue</option>
                  </select>
                </label>
              </div>
            </section>

            <section className="registrar-panel registrar-payment-table-card">
              <div className="registrar-panel-head">
                <div>
                  <span>Invoice ledger</span>
                  <strong>{filteredPaymentRows.length} row(s)</strong>
                </div>
                <ShieldCheck size={18} />
              </div>
              <div
                className="registrar-payment-table"
                role="table"
                aria-label="Registrar invoice ledger"
              >
                <div className="registrar-payment-table-head" role="row">
                  <span role="columnheader">Student</span>
                  <span role="columnheader">Invoice</span>
                  <span role="columnheader">Amount</span>
                  <span role="columnheader">Paid</span>
                  <span role="columnheader">Balance</span>
                  <span role="columnheader">Status</span>
                  <span role="columnheader">Record</span>
                  <span role="columnheader">Action</span>
                </div>
                {filteredPaymentRows.map(row => (
                  <article
                    key={row.invoice.id}
                    className="registrar-payment-row"
                    data-invoice-id={row.invoice.id}
                    role="row"
                  >
                    <div role="cell">
                      <strong>{row.user?.name ?? row.invoice.studentId}</strong>
                      <small>
                        {row.user?.email ?? "No email"} ·{" "}
                        {row.branch?.name ?? "No branch"} ·{" "}
                        {row.course?.title ?? "No course"}
                      </small>
                    </div>
                    <div role="cell">
                      <strong>{row.invoice.id}</strong>
                      <small>
                        {row.enrollment?.id ?? "No enrollment"} ·{" "}
                        {row.classGroup?.name ?? "Class pending"} · due{" "}
                        {row.invoice.dueAt} ·{" "}
                        {row.lastPayment
                          ? `${row.lastPayment.method}${row.lastPayment.reference ? ` · ${row.lastPayment.reference}` : ""} · ${row.lastPayment.paidAt.slice(0, 10)}`
                          : "No receipt yet"}
                      </small>
                    </div>
                    <span role="cell">
                      {row.invoice.currency} {row.invoice.amount}
                    </span>
                    <span role="cell">
                      {row.invoice.currency} {row.paid}
                    </span>
                    <span
                      role="cell"
                      className={row.balance > 0 ? "attention" : "settled"}
                    >
                      {row.invoice.currency} {row.balance}
                    </span>
                    <span
                      role="cell"
                      className={`registrar-payment-status ${row.status}`}
                    >
                      {row.status}
                    </span>
                    <div className="registrar-payment-record-fields" role="cell">
                      <input
                        className="registrar-payment-amount-input"
                        type="number"
                        min="0"
                        max={row.balance}
                        value={
                          paymentAmountDrafts[row.invoice.id] ??
                          String(row.balance)
                        }
                        disabled={
                          row.balance <= 0 ||
                          row.invoice.status === "paid" ||
                          isAnyActionPending
                        }
                        aria-label={`Payment amount for ${row.invoice.id}`}
                        onChange={event =>
                          setPaymentAmountDrafts(current => ({
                            ...current,
                            [row.invoice.id]: event.target.value,
                          }))
                        }
                      />
                      <select
                        value={paymentMethodDrafts[row.invoice.id] ?? "manual"}
                        disabled={
                          row.balance <= 0 ||
                          row.invoice.status === "paid" ||
                          isAnyActionPending
                        }
                        aria-label={`Payment method for ${row.invoice.id}`}
                        onChange={event =>
                          setPaymentMethodDrafts(current => ({
                            ...current,
                            [row.invoice.id]: event.target
                              .value as Payment["method"],
                          }))
                        }
                      >
                        {paymentMethods.map(method => (
                          <option key={method} value={method}>
                            {method.replace("_", " ")}
                          </option>
                        ))}
                      </select>
                      <input
                        value={paymentReferenceDrafts[row.invoice.id] ?? ""}
                        disabled={
                          row.balance <= 0 ||
                          row.invoice.status === "paid" ||
                          isAnyActionPending
                        }
                        aria-label={`Payment reference for ${row.invoice.id}`}
                        placeholder="Reference"
                        onChange={event =>
                          setPaymentReferenceDrafts(current => ({
                            ...current,
                            [row.invoice.id]: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <button
                      type="button"
                      disabled={
                        row.balance <= 0 ||
                        row.invoice.status === "paid" ||
                        isAnyActionPending
                      }
                      onClick={() =>
                        recordInvoicePayment(row.invoice.id, row.balance)
                      }
                    >
                      {isActionPending(`payment.record:${row.invoice.id}`)
                        ? "Recording..."
                        : row.balance <= 0 || row.invoice.status === "paid"
                          ? "Settled"
                          : "Record payment"}
                    </button>
                  </article>
                ))}
                {filteredPaymentRows.length === 0 ? (
                  <div className="registrar-payment-empty">
                    <CreditCard size={18} />
                    <strong>No invoices match this view</strong>
                    <small>Clear the search or switch the status filter.</small>
                  </div>
                ) : null}
              </div>
            </section>
          </div>
        }
      />
    </PlatformShell>
  );
}
