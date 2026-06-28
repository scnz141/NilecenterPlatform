import RegistrarLayout from "@/components/RegistrarLayout";
import { Clock, CheckCircle, XCircle, Eye } from "lucide-react";
import { toast } from "sonner";

const PENDING = [
  { id: "APP-001", name: "Bilal Qasim", phone: "+20 100 111 2222", course: "Standard Arabic L1", branch: "B1 — Cairo Main", date: "Jun 25, 2026", fee: 2400, paymentType: "Full", status: "pending" },
  { id: "APP-002", name: "Hana Mustafa", phone: "+20 100 333 4444", course: "Quran Memorization (Juz 1–5)", branch: "B2 — Giza", date: "Jun 25, 2026", fee: 1800, paymentType: "Installment", status: "pending" },
  { id: "APP-003", name: "Tariq Nasser", phone: "+20 100 555 6666", course: "Islamic Fiqh — Fundamentals", branch: "B1 — Cairo Main", date: "Jun 24, 2026", fee: 2000, paymentType: "Full", status: "pending" },
  { id: "APP-004", name: "Ruqayyah Hamid", phone: "+20 100 777 8888", course: "Arabic Calligraphy", branch: "B3 — Alexandria", date: "Jun 24, 2026", fee: 1600, paymentType: "Full", status: "pending" },
  { id: "APP-005", name: "Khalid Farouk", phone: "+20 100 999 0000", course: "Standard Arabic L2", branch: "Online", date: "Jun 23, 2026", fee: 2200, paymentType: "Scholarship", status: "pending" },
];

export default function PendingEnrollment() {
  const handleApprove = (name: string) => toast.success(`${name} enrollment approved`);
  const handleReject = (name: string) => toast.error(`${name} enrollment rejected`);

  return (
    <RegistrarLayout>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.025em", color: "var(--foreground)" }}>Pending Enrollment</h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 3 }}>Students awaiting course enrollment approval</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
        {[
          { label: "Pending", value: PENDING.length, color: "#F59E0B" },
          { label: "Approved Today", value: 3, color: "#10B981" },
          { label: "Rejected Today", value: 1, color: "#EF4444" },
        ].map(s => (
          <div key={s.label} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px", background: "var(--card)", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", fontWeight: 500 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", background: "var(--card)" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>Applications ({PENDING.length})</div>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--muted)" }}>
              {["Application ID", "Student", "Course", "Branch", "Fee", "Payment", "Date", "Actions"].map(h => (
                <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PENDING.map((p, i) => (
              <tr key={p.id} style={{ borderBottom: i < PENDING.length - 1 ? "1px solid var(--border)" : "none" }}>
                <td style={{ padding: "12px 14px" }}>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 4, background: "#F59E0B18", color: "#F59E0B" }}>{p.id}</span>
                </td>
                <td style={{ padding: "12px 14px" }}>
                  <div style={{ fontWeight: 500, color: "var(--foreground)" }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{p.phone}</div>
                </td>
                <td style={{ padding: "12px 14px", color: "var(--muted-foreground)" }}>{p.course}</td>
                <td style={{ padding: "12px 14px", color: "var(--muted-foreground)" }}>{p.branch}</td>
                <td style={{ padding: "12px 14px", fontWeight: 600, color: "var(--foreground)" }}>EGP {p.fee.toLocaleString()}</td>
                <td style={{ padding: "12px 14px" }}>
                  <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 4, background: p.paymentType === "Scholarship" ? "#8B5CF618" : "var(--muted)", color: p.paymentType === "Scholarship" ? "#8B5CF6" : "var(--muted-foreground)" }}>
                    {p.paymentType}
                  </span>
                </td>
                <td style={{ padding: "12px 14px", color: "var(--muted-foreground)", fontSize: 12 }}>{p.date}</td>
                <td style={{ padding: "12px 14px" }}>
                  <div style={{ display: "flex", gap: 5 }}>
                    <button onClick={() => handleApprove(p.name)} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 500, padding: "4px 8px", borderRadius: 5, background: "#10B98118", color: "#10B981", border: "1px solid #10B98140", cursor: "pointer" }}>
                      <CheckCircle size={10} /> Approve
                    </button>
                    <button onClick={() => handleReject(p.name)} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 500, padding: "4px 8px", borderRadius: 5, background: "#EF444418", color: "#EF4444", border: "1px solid #EF444440", cursor: "pointer" }}>
                      <XCircle size={10} /> Reject
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </RegistrarLayout>
  );
}
