import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Download, CreditCard, TrendingUp, DollarSign, AlertCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { toast } from "sonner";

const TODAY_PAYMENTS = [
  { id: "PAY-2847", student: "Mohammed Al-Rashid", course: "Standard Arabic L3", amount: 2400, method: "Cash", time: "10:24 AM", status: "completed" },
  { id: "PAY-2846", student: "Aisha Binte Yusuf", course: "Quran Memorization", amount: 1800, method: "Bank Transfer", time: "09:45 AM", status: "completed" },
  { id: "PAY-2845", student: "Fatima Zahra", course: "Turkish Beginner", amount: 2200, method: "Cash", time: "09:15 AM", status: "completed" },
  { id: "PAY-2844", student: "Omar Abdullah", course: "Academic English", amount: 1600, method: "Card", time: "08:50 AM", status: "pending" },
  { id: "PAY-2843", student: "Mariam Youssef", course: "Standard Arabic L1", amount: 2400, method: "Cash", time: "08:30 AM", status: "completed" },
];

const MONTHLY_DATA = [
  { month: "Jan", amount: 95 }, { month: "Feb", amount: 108 }, { month: "Mar", amount: 112 },
  { month: "Apr", amount: 98 }, { month: "May", amount: 125 }, { month: "Jun", amount: 142 },
];

const TABS = [{ id: "today", label: "Today's Payments" }, { id: "history", label: "Payment History" }, { id: "summary", label: "Financial Summary" }];

export default function Payments() {
  const [tab, setTab] = useState("today");

  return (
    <DashboardLayout>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.025em", color: "var(--foreground)" }}>Payments</h1>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 3 }}>Track fees, payments, and financial reports</p>
        </div>
        <button onClick={() => toast.info("Exporting...")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", border: "1px solid var(--border)", borderRadius: 7, fontSize: 13, fontWeight: 500, background: "transparent", color: "var(--foreground)", cursor: "pointer" }}>
          <Download size={14} /> Export
        </button>
      </div>

      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", marginBottom: 20 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: "8px 14px", fontSize: 13, fontWeight: tab === t.id ? 500 : 400, cursor: "pointer", border: "none", background: "transparent", color: tab === t.id ? "var(--foreground)" : "var(--muted-foreground)", borderBottom: `2px solid ${tab === t.id ? "var(--foreground)" : "transparent"}`, marginBottom: -1 }}>{t.label}</button>
        ))}
      </div>

      {tab === "today" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
            {[
              { label: "Today's Total", value: "EGP 10,400", icon: DollarSign, color: "var(--nc-green)" },
              { label: "Transactions", value: "5", icon: CreditCard, color: "var(--nc-blue)" },
              { label: "Pending", value: "EGP 1,600", icon: AlertCircle, color: "var(--nc-amber)" },
            ].map(s => {
              const Icon = s.icon;
              return (
                <div key={s.label} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px", background: "var(--card)", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: s.color + "18", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon size={15} style={{ color: s.color }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{s.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--foreground)" }}>{s.value}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", background: "var(--card)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["ID", "Student", "Course", "Amount", "Method", "Time", "Status"].map(h => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TODAY_PAYMENTS.map((p, i) => (
                  <tr key={p.id} style={{ borderBottom: i < TODAY_PAYMENTS.length - 1 ? "1px solid var(--border)" : "none" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--muted)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    <td style={{ padding: "10px 14px", fontSize: 11, color: "var(--muted-foreground)", fontFamily: "monospace" }}>{p.id}</td>
                    <td style={{ padding: "10px 14px", fontWeight: 500, color: "var(--foreground)" }}>{p.student}</td>
                    <td style={{ padding: "10px 14px", color: "var(--muted-foreground)", fontSize: 12 }}>{p.course}</td>
                    <td style={{ padding: "10px 14px", fontWeight: 600, color: "var(--foreground)" }}>EGP {p.amount.toLocaleString()}</td>
                    <td style={{ padding: "10px 14px" }}><span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, background: "var(--muted)", color: "var(--muted-foreground)" }}>{p.method}</span></td>
                    <td style={{ padding: "10px 14px", color: "var(--muted-foreground)", fontSize: 12 }}>{p.time}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ fontSize: 11, fontWeight: 500, padding: "2px 7px", borderRadius: 4, background: p.status === "completed" ? "var(--nc-green-light)" : "var(--nc-amber-light)", color: p.status === "completed" ? "var(--nc-green)" : "oklch(0.55 0.16 75)" }}>{p.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "history" && (
        <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", background: "var(--card)" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", gap: 8 }}>
            {["All", "Cash", "Bank Transfer", "Card"].map(f => (
              <button key={f} style={{ padding: "4px 10px", borderRadius: 5, fontSize: 12, border: "1px solid var(--border)", background: f === "All" ? "var(--foreground)" : "transparent", color: f === "All" ? "var(--background)" : "var(--muted-foreground)", cursor: "pointer" }}>{f}</button>
            ))}
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["ID", "Student", "Course", "Amount", "Method", "Date", "Status"].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...TODAY_PAYMENTS, ...TODAY_PAYMENTS.map(p => ({ ...p, id: "PAY-" + (parseInt(p.id.split("-")[1]) - 10), time: "Jun 25" }))].map((p, i) => (
                <tr key={p.id + i} style={{ borderBottom: "1px solid var(--border)" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--muted)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  <td style={{ padding: "10px 14px", fontSize: 11, color: "var(--muted-foreground)", fontFamily: "monospace" }}>{p.id}</td>
                  <td style={{ padding: "10px 14px", fontWeight: 500, color: "var(--foreground)" }}>{p.student}</td>
                  <td style={{ padding: "10px 14px", color: "var(--muted-foreground)", fontSize: 12 }}>{p.course}</td>
                  <td style={{ padding: "10px 14px", fontWeight: 600, color: "var(--foreground)" }}>EGP {p.amount.toLocaleString()}</td>
                  <td style={{ padding: "10px 14px" }}><span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, background: "var(--muted)", color: "var(--muted-foreground)" }}>{p.method}</span></td>
                  <td style={{ padding: "10px 14px", color: "var(--muted-foreground)", fontSize: 12 }}>{p.time}</td>
                  <td style={{ padding: "10px 14px" }}><span style={{ fontSize: 11, fontWeight: 500, padding: "2px 7px", borderRadius: 4, background: "var(--nc-green-light)", color: "var(--nc-green)" }}>completed</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "summary" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
            {[
              { label: "Total Revenue (YTD)", value: "EGP 680K" },
              { label: "This Month", value: "EGP 142K" },
              { label: "Outstanding Fees", value: "EGP 38K" },
              { label: "Avg per Student", value: "EGP 2,100" },
            ].map(s => (
              <div key={s.label} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "16px 18px", background: "var(--card)" }}>
                <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 6 }}>{s.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--foreground)" }}>{s.value}</div>
              </div>
            ))}
          </div>
          <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "20px", background: "var(--card)" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", marginBottom: 16 }}>Monthly Revenue (EGP thousands)</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={MONTHLY_DATA} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }} />
                <Bar dataKey="amount" fill="var(--nc-blue)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
