import DashboardLayout from "@/components/DashboardLayout";
import { Bell, CreditCard, Users, BookOpen, AlertCircle, CheckCircle } from "lucide-react";
import { toast } from "sonner";

const NOTIFICATIONS = [
  { id: 1, type: "payment", icon: CreditCard, color: "#10B981", title: "Payment received", desc: "Mohammed Al-Rashid paid EGP 2,400 for Arabic L3", time: "10 min ago", read: false },
  { id: 2, type: "student", icon: Users, color: "#3B82F6", title: "New student registration", desc: "Khalid Ibrahim submitted enrollment for Quran Memorization", time: "1 hour ago", read: false },
  { id: 3, type: "course", icon: BookOpen, color: "#8B5CF6", title: "Course milestone reached", desc: "Arabic L3 Group A has completed 50% of the curriculum", time: "2 hours ago", read: false },
  { id: 4, type: "alert", icon: AlertCircle, color: "#F59E0B", title: "Low attendance alert", desc: "3 students in Fiqh class have attendance below 75%", time: "Yesterday", read: true },
  { id: 5, type: "payment", icon: CreditCard, color: "#10B981", title: "Payment received", desc: "Aisha Binte Yusuf paid EGP 1,800 for Quran Memorization", time: "Yesterday", read: true },
  { id: 6, type: "system", icon: CheckCircle, color: "#6B7280", title: "Monthly report ready", desc: "June 2025 performance report is available for download", time: "Jun 25", read: true },
  { id: 7, type: "student", icon: Users, color: "#3B82F6", title: "Student profile updated", desc: "Fatima Zahra updated her contact information", time: "Jun 24", read: true },
  { id: 8, type: "alert", icon: AlertCircle, color: "#EF4444", title: "Payment overdue", desc: "Omar Abdullah has an outstanding balance of EGP 1,600", time: "Jun 23", read: true },
];

export default function Notifications() {
  const unread = NOTIFICATIONS.filter(n => !n.read).length;

  return (
    <DashboardLayout>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.025em", color: "var(--foreground)" }}>Notifications</h1>
            {unread > 0 && <span style={{ fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 99, background: "var(--nc-blue)", color: "white" }}>{unread}</span>}
          </div>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 3 }}>Stay updated on payments, enrollments, and alerts</p>
        </div>
        <button onClick={() => toast.success("All notifications marked as read")} style={{ padding: "6px 14px", border: "1px solid var(--border)", borderRadius: 7, fontSize: 12, fontWeight: 500, background: "transparent", color: "var(--foreground)", cursor: "pointer" }}>
          Mark all read
        </button>
      </div>

      <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", background: "var(--card)" }}>
        {NOTIFICATIONS.map((n, i) => {
          const Icon = n.icon;
          return (
            <div key={n.id} style={{
              display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 16px",
              borderBottom: i < NOTIFICATIONS.length - 1 ? "1px solid var(--border)" : "none",
              background: !n.read ? "oklch(0.99 0.005 260)" : "transparent",
              cursor: "pointer", transition: "background 80ms",
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--muted)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = !n.read ? "oklch(0.99 0.005 260)" : "transparent"; }}
            >
              <div style={{ width: 32, height: 32, borderRadius: 8, background: n.color + "18", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                <Icon size={14} style={{ color: n.color }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ fontSize: 13, fontWeight: n.read ? 400 : 600, color: "var(--foreground)" }}>{n.title}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, marginLeft: 12 }}>
                    <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{n.time}</span>
                    {!n.read && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--nc-blue)" }} />}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>{n.desc}</div>
              </div>
            </div>
          );
        })}
      </div>
    </DashboardLayout>
  );
}
