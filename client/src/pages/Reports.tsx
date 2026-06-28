import DashboardLayout from "@/components/DashboardLayout";
import { Download, FileText, BarChart2, Users, CreditCard, BookOpen, Calendar } from "lucide-react";
import { toast } from "sonner";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const REPORTS = [
  { icon: Users, title: "Student Enrollment Report", desc: "Complete list of all enrolled students with course and payment details", color: "#3B82F6", updated: "Today" },
  { icon: CreditCard, title: "Financial Summary Report", desc: "Monthly and yearly revenue breakdown by course and branch", color: "#10B981", updated: "Today" },
  { icon: BookOpen, title: "Course Performance Report", desc: "Completion rates, attendance, and grade distributions per course", color: "#8B5CF6", updated: "Yesterday" },
  { icon: BarChart2, title: "Attendance Report", desc: "Student attendance rates across all classes and sessions", color: "#F59E0B", updated: "Yesterday" },
  { icon: Calendar, title: "Schedule Report", desc: "Weekly timetable and room utilization for all branches", color: "#EF4444", updated: "Jun 24" },
  { icon: FileText, title: "Teacher Performance Report", desc: "Class delivery metrics, student feedback, and session completion", color: "#06B6D4", updated: "Jun 23" },
];

const ENROLLMENT_TREND = [
  { month: "Jan", students: 420 }, { month: "Feb", students: 480 }, { month: "Mar", students: 510 },
  { month: "Apr", students: 490 }, { month: "May", students: 560 }, { month: "Jun", students: 620 },
];

const COURSE_DIST = [
  { name: "Arabic Language", value: 38, color: "#3B82F6" },
  { name: "Quran & Tajweed", value: 28, color: "#10B981" },
  { name: "Islamic Studies", value: 16, color: "#8B5CF6" },
  { name: "Turkish", value: 8, color: "#F59E0B" },
  { name: "English", value: 7, color: "#EF4444" },
  { name: "Other", value: 3, color: "#6B7280" },
];

export default function Reports() {
  return (
    <DashboardLayout>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.025em", color: "var(--foreground)" }}>Reports</h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 3 }}>Download and view analytical reports for all platform data</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10, marginBottom: 24 }}>
        {REPORTS.map(r => {
          const Icon = r.icon;
          return (
            <div key={r.title} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "16px 18px", background: "var(--card)", cursor: "pointer", transition: "box-shadow 150ms" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 16px oklch(0 0 0 / 0.06)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: r.color + "18", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={15} style={{ color: r.color }} />
                </div>
                <button onClick={() => toast.success(`Downloading ${r.title}...`)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", border: "1px solid var(--border)", borderRadius: 5, fontSize: 11, fontWeight: 500, background: "transparent", color: "var(--muted-foreground)", cursor: "pointer" }}>
                  <Download size={11} /> Export
                </button>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", marginBottom: 4 }}>{r.title}</div>
              <div style={{ fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.5, marginBottom: 10 }}>{r.desc}</div>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Updated: {r.updated}</div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "20px", background: "var(--card)" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", marginBottom: 4 }}>Enrollment Trend</div>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 16 }}>Monthly new student registrations</div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={ENROLLMENT_TREND} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }} />
              <Area type="monotone" dataKey="students" stroke="#3B82F6" strokeWidth={2} fill="url(#grad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "20px", background: "var(--card)" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", marginBottom: 4 }}>Course Distribution</div>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 16 }}>Students by course category</div>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <ResponsiveContainer width={140} height={140}>
              <PieChart>
                <Pie data={COURSE_DIST} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" strokeWidth={0}>
                  {COURSE_DIST.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
              {COURSE_DIST.map(c => (
                <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: c.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: "var(--muted-foreground)", flex: 1 }}>{c.name}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--foreground)" }}>{c.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
