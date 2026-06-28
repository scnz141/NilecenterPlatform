import DashboardLayout from "@/components/DashboardLayout";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { TrendingUp, TrendingDown, Users, BookOpen, CreditCard, Clock, ArrowRight, MoreHorizontal, CheckCircle2, AlertCircle, Circle } from "lucide-react";
import { Link } from "wouter";

const STATS = [
  { label: "Total Students", value: "5,284", change: "+12%", up: true, icon: Users, color: "var(--nc-blue)" },
  { label: "Active Courses", value: "295", change: "+8%", up: true, icon: BookOpen, color: "var(--nc-green)" },
  { label: "Monthly Revenue", value: "EGP 142K", change: "+5%", up: true, icon: CreditCard, color: "var(--nc-purple)" },
  { label: "Pending Enrollments", value: "47", change: "-3", up: false, icon: Clock, color: "var(--nc-amber)" },
];

const ENROLLMENT_DATA = [
  { month: "Jan", students: 420 }, { month: "Feb", students: 480 }, { month: "Mar", students: 510 },
  { month: "Apr", students: 490 }, { month: "May", students: 560 }, { month: "Jun", students: 620 },
  { month: "Jul", students: 580 }, { month: "Aug", students: 640 }, { month: "Sep", students: 710 },
  { month: "Oct", students: 680 }, { month: "Nov", students: 750 }, { month: "Dec", students: 800 },
];

const REVENUE_DATA = [
  { month: "Jan", amount: 95 }, { month: "Feb", amount: 108 }, { month: "Mar", amount: 112 },
  { month: "Apr", amount: 98 }, { month: "May", amount: 125 }, { month: "Jun", amount: 142 },
];

const TODAY_CLASSES = [
  { time: "09:00", course: "Standard Arabic L3", teacher: "Ahmed Hassan", room: "Room 4", students: 18, status: "ongoing" },
  { time: "10:30", course: "Quran Memorization", teacher: "Fatima Al-Zahra", room: "Room 2", students: 12, status: "ongoing" },
  { time: "12:00", course: "Islamic Fiqh", teacher: "Omar Khalil", room: "Room 7", students: 24, status: "upcoming" },
  { time: "14:00", course: "Turkish Beginner A1", teacher: "Yusuf Ali", room: "Room 1", students: 15, status: "upcoming" },
  { time: "16:00", course: "Academic English", teacher: "Sara Mostafa", room: "Room 5", students: 20, status: "upcoming" },
  { time: "18:00", course: "Arabic Calligraphy", teacher: "Nour Ibrahim", room: "Room 3", students: 10, status: "upcoming" },
];

const RECENT_ENROLLMENTS = [
  { name: "Mohammed Al-Rashid", course: "Standard Arabic L1", date: "Today, 10:24", avatar: "MA", status: "approved" },
  { name: "Aisha Binte Yusuf", course: "Quran Memorization", date: "Today, 09:15", avatar: "AY", status: "pending" },
  { name: "Khalid Ibrahim", course: "Islamic Fiqh", date: "Yesterday", avatar: "KI", status: "approved" },
  { name: "Fatima Zahra", course: "Turkish Beginner", date: "Yesterday", avatar: "FZ", status: "approved" },
  { name: "Omar Abdullah", course: "Academic English", date: "2 days ago", avatar: "OA", status: "pending" },
];

const AVATAR_COLORS = ["#3B82F6", "#8B5CF6", "#10B981", "#F59E0B", "#EF4444", "#06B6D4"];

export default function Dashboard() {
  return (
    <DashboardLayout>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.025em", color: "var(--foreground)" }}>Overview</h1>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 3 }}>
            {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <Link href="/students/register">
          <a style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", background: "var(--foreground)", color: "var(--background)", borderRadius: 7, fontSize: 13, fontWeight: 500, textDecoration: "none" }}>
            + Register Student
          </a>
        </Link>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12, marginBottom: 24 }}>
        {STATS.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={s.label} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "16px 18px", background: "var(--card)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontSize: 12, color: "var(--muted-foreground)", fontWeight: 500 }}>{s.label}</span>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: s.color + "14", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={14} style={{ color: s.color }} />
                </div>
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--foreground)", marginBottom: 6 }}>{s.value}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                {s.up ? <TrendingUp size={12} style={{ color: "var(--nc-green)" }} /> : <TrendingDown size={12} style={{ color: "var(--nc-red)" }} />}
                <span style={{ color: s.up ? "var(--nc-green)" : "var(--nc-red)", fontWeight: 500 }}>{s.change}</span>
                <span style={{ color: "var(--muted-foreground)" }}>vs last month</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
        {/* Enrollment chart */}
        <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "20px", background: "var(--card)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>Student Enrollment</div>
              <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>Monthly new enrollments</div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--nc-green)", background: "var(--nc-green-light)", padding: "2px 7px", borderRadius: 4 }}>+12%</span>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={ENROLLMENT_DATA} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--nc-blue)" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="var(--nc-blue)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }} />
              <Area type="monotone" dataKey="students" stroke="var(--nc-blue)" strokeWidth={2} fill="url(#blueGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Revenue chart */}
        <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "20px", background: "var(--card)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>Revenue</div>
              <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>Monthly (EGP thousands)</div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--nc-blue)", background: "var(--nc-blue-light)", padding: "2px 7px", borderRadius: 4 }}>+5%</span>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={REVENUE_DATA} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }} />
              <Bar dataKey="amount" fill="var(--nc-blue)" radius={[4, 4, 0, 0]} opacity={0.85} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom row */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 12 }}>
        {/* Today's classes */}
        <div style={{ border: "1px solid var(--border)", borderRadius: 10, background: "var(--card)", overflow: "hidden" }}>
          <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>Today's Classes</div>
            <Link href="/classes">
              <a style={{ fontSize: 12, color: "var(--muted-foreground)", textDecoration: "none", display: "flex", alignItems: "center", gap: 3 }}>
                View all <ArrowRight size={11} />
              </a>
            </Link>
          </div>
          <div>
            {TODAY_CLASSES.map((c, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 18px", borderBottom: i < TODAY_CLASSES.length - 1 ? "1px solid var(--border)" : "none" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)", width: 36, flexShrink: 0 }}>{c.time}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.course}</div>
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 1 }}>{c.teacher} · {c.room}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{c.students} students</span>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 4,
                    background: c.status === "ongoing" ? "var(--nc-green-light)" : "var(--muted)",
                    color: c.status === "ongoing" ? "var(--nc-green)" : "var(--muted-foreground)",
                  }}>
                    {c.status === "ongoing" ? "● Live" : "Upcoming"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent enrollments */}
        <div style={{ border: "1px solid var(--border)", borderRadius: 10, background: "var(--card)", overflow: "hidden" }}>
          <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>Recent Enrollments</div>
            <Link href="/students/pending">
              <a style={{ fontSize: 12, color: "var(--muted-foreground)", textDecoration: "none", display: "flex", alignItems: "center", gap: 3 }}>
                View all <ArrowRight size={11} />
              </a>
            </Link>
          </div>
          <div>
            {RECENT_ENROLLMENTS.map((e, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 18px", borderBottom: i < RECENT_ENROLLMENTS.length - 1 ? "1px solid var(--border)" : "none" }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: AVATAR_COLORS[i % AVATAR_COLORS.length], display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: "white" }}>{e.avatar}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</div>
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.course}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flexShrink: 0 }}>
                  <span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>{e.date}</span>
                  {e.status === "approved"
                    ? <CheckCircle2 size={13} style={{ color: "var(--nc-green)" }} />
                    : <AlertCircle size={13} style={{ color: "var(--nc-amber)" }} />
                  }
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
