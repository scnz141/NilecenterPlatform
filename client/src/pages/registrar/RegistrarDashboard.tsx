import RegistrarLayout from "@/components/RegistrarLayout";
import { UserPlus, Clock, CreditCard, Users, ChevronRight } from "lucide-react";
import { Link } from "wouter";

const PENDING = [
  { name: "Bilal Qasim", course: "Standard Arabic L1", date: "Jun 25", branch: "B1" },
  { name: "Hana Mustafa", course: "Quran Memorization", date: "Jun 25", branch: "B2" },
  { name: "Tariq Nasser", course: "Islamic Fiqh", date: "Jun 24", branch: "B1" },
  { name: "Ruqayyah Hamid", course: "Arabic Calligraphy", date: "Jun 24", branch: "B3" },
];

const TODAY_PAYMENTS = [
  { name: "Mohammed Al-Rashid", course: "Arabic L3", amount: 2400, method: "Cash", time: "09:15 AM" },
  { name: "Aisha Rahman", course: "Quran Mem.", amount: 1800, method: "Bank Transfer", time: "10:30 AM" },
  { name: "Omar Abdullah", course: "Islamic Fiqh", amount: 2000, method: "Cash", time: "11:00 AM" },
];

export default function RegistrarDashboard() {
  return (
    <RegistrarLayout>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--foreground)", marginBottom: 4 }}>
          Good morning, Radwa 👋
        </h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
          Friday, June 26, 2026 · 4 pending enrollments · 3 payments today
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
        {[
          { label: "Pending Enrollment", value: "4", sub: "Awaiting approval", icon: Clock, color: "#F59E0B" },
          { label: "Registered Today", value: "3", sub: "New students", icon: UserPlus, color: "#10B981" },
          { label: "Today's Payments", value: "EGP 6,200", sub: "3 transactions", icon: CreditCard, color: "#3B82F6" },
          { label: "Total Students", value: "284", sub: "Active this semester", icon: Users, color: "#8B5CF6" },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "16px", background: "var(--card)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: "var(--muted-foreground)", fontWeight: 500 }}>{s.label}</span>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: s.color + "18", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={13} style={{ color: s.color }} />
                </div>
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--foreground)", marginBottom: 2 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{s.sub}</div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {/* Pending */}
        <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "20px", background: "var(--card)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>Pending Enrollment</div>
              <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 1 }}>Students awaiting approval</div>
            </div>
            <Link href="/registrar/pending">
              <button style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer" }}>
                View all <ChevronRight size={13} />
              </button>
            </Link>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {PENDING.map((p, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, background: "var(--muted)" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#F59E0B18", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: "#F59E0B" }}>{p.name.split(" ").map(n => n[0]).join("")}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground)" }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{p.course} · Branch {p.branch}</div>
                </div>
                <div style={{ display: "flex", gap: 5 }}>
                  <button style={{ fontSize: 11, fontWeight: 500, padding: "3px 8px", borderRadius: 5, background: "#10B98118", color: "#10B981", border: "1px solid #10B98140", cursor: "pointer" }}>Approve</button>
                  <button style={{ fontSize: 11, fontWeight: 500, padding: "3px 8px", borderRadius: 5, background: "#EF444418", color: "#EF4444", border: "1px solid #EF444440", cursor: "pointer" }}>Reject</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Today's payments */}
        <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "20px", background: "var(--card)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>Today's Payments</div>
              <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 1 }}>Payments received today</div>
            </div>
            <Link href="/registrar/payments">
              <button style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer" }}>
                View all <ChevronRight size={13} />
              </button>
            </Link>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {TODAY_PAYMENTS.map((p, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, background: "var(--muted)" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#3B82F618", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: "#3B82F6" }}>{p.name.split(" ").map(n => n[0]).join("")}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground)" }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{p.course} · {p.method} · {p.time}</div>
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#10B981" }}>EGP {p.amount.toLocaleString()}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 8, background: "#10B98118", border: "1px solid #10B98130", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#10B981" }}>Total Today</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: "#10B981" }}>EGP 6,200</span>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        <Link href="/registrar/register">
          <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "18px", background: "var(--card)", cursor: "pointer", transition: "background 100ms" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--muted)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "var(--card)"; }}
          >
            <div style={{ width: 36, height: 36, borderRadius: 9, background: "#10B98118", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
              <UserPlus size={16} style={{ color: "#10B981" }} />
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>Register New Student</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 3 }}>Add a new student to the system</div>
          </div>
        </Link>
        <Link href="/registrar/pending">
          <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "18px", background: "var(--card)", cursor: "pointer", transition: "background 100ms" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--muted)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "var(--card)"; }}
          >
            <div style={{ width: 36, height: 36, borderRadius: 9, background: "#F59E0B18", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
              <Clock size={16} style={{ color: "#F59E0B" }} />
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>Manage Pending</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 3 }}>Review and approve enrollments</div>
          </div>
        </Link>
        <Link href="/registrar/payments">
          <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "18px", background: "var(--card)", cursor: "pointer", transition: "background 100ms" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--muted)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "var(--card)"; }}
          >
            <div style={{ width: 36, height: 36, borderRadius: 9, background: "#3B82F618", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
              <CreditCard size={16} style={{ color: "#3B82F6" }} />
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>Today's Payments</div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 3 }}>View all payments received today</div>
          </div>
        </Link>
      </div>
    </RegistrarLayout>
  );
}
