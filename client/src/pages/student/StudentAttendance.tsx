import StudentLayout from "@/components/StudentLayout";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { CheckCircle, XCircle, Clock } from "lucide-react";

const MONTHLY = [
  { month: "Jan", rate: 92 }, { month: "Feb", rate: 88 }, { month: "Mar", rate: 95 },
  { month: "Apr", rate: 90 }, { month: "May", rate: 96 }, { month: "Jun", rate: 94 },
];

const BY_COURSE = [
  { course: "Standard Arabic L3", attended: 15, total: 16, rate: 94, color: "#3B82F6" },
  { course: "Quran Memorization", attended: 8, total: 9, rate: 89, color: "#10B981" },
  { course: "Islamic Fiqh", attended: 14, total: 15, rate: 93, color: "#8B5CF6" },
];

const SESSIONS = [
  { date: "Jun 23", course: "Arabic L3", status: "present", time: "09:00 AM" },
  { date: "Jun 22", course: "Quran Mem.", status: "present", time: "10:00 AM" },
  { date: "Jun 20", course: "Islamic Fiqh", status: "present", time: "12:00 PM" },
  { date: "Jun 19", course: "Arabic L3", status: "absent", time: "09:00 AM" },
  { date: "Jun 18", course: "Quran Mem.", status: "present", time: "10:00 AM" },
  { date: "Jun 17", course: "Islamic Fiqh", status: "present", time: "12:00 PM" },
  { date: "Jun 16", course: "Arabic L3", status: "late", time: "09:15 AM" },
  { date: "Jun 15", course: "Quran Mem.", status: "present", time: "10:00 AM" },
];

const statusConfig = {
  present: { label: "Present", color: "#10B981", bg: "#10B98118", icon: CheckCircle },
  absent: { label: "Absent", color: "#EF4444", bg: "#EF444418", icon: XCircle },
  late: { label: "Late", color: "#F59E0B", bg: "#F59E0B18", icon: Clock },
};

export default function StudentAttendance() {
  const totalSessions = BY_COURSE.reduce((a, c) => a + c.total, 0);
  const totalAttended = BY_COURSE.reduce((a, c) => a + c.attended, 0);
  const overallRate = Math.round((totalAttended / totalSessions) * 100);

  return (
    <StudentLayout>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.025em", color: "var(--foreground)" }}>Attendance</h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 3 }}>Track your attendance across all enrolled courses</p>
      </div>

      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
        {[
          { label: "Overall Rate", value: `${overallRate}%`, color: "#10B981" },
          { label: "Sessions Attended", value: `${totalAttended}`, color: "#3B82F6" },
          { label: "Total Sessions", value: `${totalSessions}`, color: "var(--foreground)" },
          { label: "Absences", value: `${totalSessions - totalAttended}`, color: "#EF4444" },
        ].map(s => (
          <div key={s.label} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "16px", background: "var(--card)" }}>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 6, fontWeight: 500 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        {/* Monthly chart */}
        <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "20px", background: "var(--card)" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", marginBottom: 4 }}>Monthly Attendance Rate</div>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 16 }}>Attendance % across all courses per month</div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={MONTHLY} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="attGrad2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <YAxis domain={[80, 100]} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 11 }} />
              <Area type="monotone" dataKey="rate" stroke="#10B981" strokeWidth={2} fill="url(#attGrad2)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* By course */}
        <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "20px", background: "var(--card)" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", marginBottom: 16 }}>Attendance by Course</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {BY_COURSE.map(c => (
              <div key={c.course}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)" }}>{c.course}</span>
                    <span style={{ fontSize: 11, color: "var(--muted-foreground)", marginLeft: 8 }}>{c.attended}/{c.total} sessions</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: c.color }}>{c.rate}%</span>
                </div>
                <div style={{ display: "flex", gap: 3 }}>
                  {Array.from({ length: c.total }).map((_, i) => (
                    <div key={i} style={{ flex: 1, height: 8, borderRadius: 3, background: i < c.attended ? c.color : "var(--muted)" }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Session history */}
      <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", background: "var(--card)" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>Session History</div>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 1 }}>Recent class attendance records</div>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--muted)" }}>
              {["Date", "Course", "Time", "Status"].map(h => (
                <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SESSIONS.map((s, i) => {
              const cfg = statusConfig[s.status as keyof typeof statusConfig];
              const Icon = cfg.icon;
              return (
                <tr key={i} style={{ borderBottom: i < SESSIONS.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <td style={{ padding: "10px 16px", color: "var(--foreground)", fontWeight: 500 }}>{s.date}</td>
                  <td style={{ padding: "10px 16px", color: "var(--muted-foreground)" }}>{s.course}</td>
                  <td style={{ padding: "10px 16px", color: "var(--muted-foreground)" }}>{s.time}</td>
                  <td style={{ padding: "10px 16px" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 99, background: cfg.bg, color: cfg.color }}>
                      <Icon size={10} /> {cfg.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </StudentLayout>
  );
}
