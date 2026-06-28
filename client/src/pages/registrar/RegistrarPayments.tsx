import RegistrarLayout from "@/components/RegistrarLayout";
import { CreditCard, Banknote, Smartphone } from "lucide-react";

const PAYMENTS = [
  { id: "PAY-001", name: "Mohammed Al-Rashid", course: "Arabic L3", amount: 2400, method: "Cash", time: "09:15 AM", receipt: "RCP-001" },
  { id: "PAY-002", name: "Aisha Rahman", course: "Quran Mem.", amount: 1800, method: "Bank Transfer", time: "10:30 AM", receipt: "RCP-002" },
  { id: "PAY-003", name: "Omar Abdullah", course: "Islamic Fiqh", amount: 2000, method: "Cash", time: "11:00 AM", receipt: "RCP-003" },
  { id: "PAY-004", name: "Sara Hassan", course: "Arabic L2", amount: 2200, method: "Vodafone Cash", time: "12:15 PM", receipt: "RCP-004" },
  { id: "PAY-005", name: "Ali Mahmoud", course: "Arabic Calligraphy", amount: 1600, method: "Cash", time: "01:30 PM", receipt: "RCP-005" },
];

const methodIcon = { Cash: Banknote, "Bank Transfer": CreditCard, "Vodafone Cash": Smartphone };
const methodColor = { Cash: "#10B981", "Bank Transfer": "#3B82F6", "Vodafone Cash": "#EF4444" };

export default function RegistrarPayments() {
  const total = PAYMENTS.reduce((a, p) => a + p.amount, 0);
  const cash = PAYMENTS.filter(p => p.method === "Cash").reduce((a, p) => a + p.amount, 0);
  const bank = PAYMENTS.filter(p => p.method === "Bank Transfer").reduce((a, p) => a + p.amount, 0);
  const voda = PAYMENTS.filter(p => p.method === "Vodafone Cash").reduce((a, p) => a + p.amount, 0);

  return (
    <RegistrarLayout>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.025em", color: "var(--foreground)" }}>Today's Payments</h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 3 }}>Friday, June 26, 2026 · All payments received today</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
        {[
          { label: "Total Collected", value: `EGP ${total.toLocaleString()}`, color: "#10B981" },
          { label: "Cash", value: `EGP ${cash.toLocaleString()}`, color: "#10B981" },
          { label: "Bank Transfer", value: `EGP ${bank.toLocaleString()}`, color: "#3B82F6" },
          { label: "Vodafone Cash", value: `EGP ${voda.toLocaleString()}`, color: "#EF4444" },
        ].map(s => (
          <div key={s.label} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px", background: "var(--card)" }}>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 5, fontWeight: 500 }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", background: "var(--card)" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>Payment Records ({PAYMENTS.length})</div>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--muted)" }}>
              {["Receipt", "Student", "Course", "Amount", "Method", "Time"].map(h => (
                <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PAYMENTS.map((p, i) => {
              const Icon = methodIcon[p.method as keyof typeof methodIcon] || CreditCard;
              const color = methodColor[p.method as keyof typeof methodColor] || "#3B82F6";
              return (
                <tr key={p.id} style={{ borderBottom: i < PAYMENTS.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 4, background: "var(--muted)", color: "var(--muted-foreground)" }}>{p.receipt}</span>
                  </td>
                  <td style={{ padding: "12px 16px", fontWeight: 500, color: "var(--foreground)" }}>{p.name}</td>
                  <td style={{ padding: "12px 16px", color: "var(--muted-foreground)" }}>{p.course}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#10B981" }}>EGP {p.amount.toLocaleString()}</span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 99, background: color + "18", color }}>
                      <Icon size={10} /> {p.method}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px", color: "var(--muted-foreground)", fontSize: 12 }}>{p.time}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ padding: "14px 20px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Total for today:</span>
          <span style={{ fontSize: 18, fontWeight: 800, color: "#10B981" }}>EGP {total.toLocaleString()}</span>
        </div>
      </div>
    </RegistrarLayout>
  );
}
