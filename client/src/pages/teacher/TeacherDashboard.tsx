import TeacherLayout from "@/components/TeacherLayout";
import { BookOpen, Users, CheckSquare, BarChart2, ChevronRight, Clock } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Link } from "wouter";

const CLASSES = [
  { id: 1, name: "Standard Arabic L3 — Group A", students: 14, nextSession: "Mon 09:00", room: "Room 4", progress: 68, color: "#3B82F6" },
  { id: 2, name: "Standard Arabic L2 — Group B", students: 11, nextSession: "Tue 11:00", room: "Room 3", progress: 45, color: "#F59E0B" },
  { id: 3, name: "Arabic Conversation — Advanced", students: 8, nextSession: "Thu 14:00", room: "Room 6", progress: 82, color: "#10B981" },
];

const ATT_DATA = [
  { day: "Mon", rate: 92 }, { day: "Tue", rate: 85 }, { day: "Wed", rate: 96 },
  { day: "Thu", rate: 88 }, { day: "Fri", rate: 94 },
];

const TODAY_SESSIONS = [
  { time: "09:00 AM", class: "Standard Arabic L3 — Group A", room: "Room 4", students: 14, status: "upcoming" },
  { time: "11:00 AM", class: "Standard Arabic L2 — Group B", room: "Room 3", students: 11, status: "upcoming" },
];

const RECENT_SCORES = [
  { student: "Mohammed Al-Rashid", class: "Arabic L3", score: 88, quiz: "Quiz 3", date: "Jun 20" },
  { student: "Fatima Zahra", class: "Arabic L2", score: 76, quiz: "Quiz 3", date: "Jun 20" },
  { student: "Omar Abdullah", class: "Arabic L3", score: 92, quiz: "Quiz 3", date: "Jun 20" },
  { student: "Aisha Rahman", class: "Conversation", score: 95, quiz: "Quiz 2", date: "Jun 18" },
];

export default function TeacherDashboard() {
  return (
    <TeacherLayout>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--foreground)", marginBottom: 4 }}>
          Good morning, Ahmed 👋
        </h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
          Friday, June 26, 2026 · 2 sessions scheduled today
        </p>
      </div>

      {/* KPI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
        {[
          { label: "Active Classes", value: "3", sub: "This semester", icon: BookOpen, color: "#3B82F6" },
          { label: "Total Students", value: "33", sub: "Across all classes", icon: Users, color: "#10B981" },
          { label: "Avg. Attendance", value: "91%", sub: "This week", icon: CheckSquare, color: "#F59E0B" },
          { label: "Avg. Score", value: "87%", sub: "Latest quizzes", icon: BarChart2, color: "#8B5CF6" },
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
              <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--foreground)", marginBottom: 2 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{s.sub}</div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        {/* My Classes */}
        <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "20px", background: "var(--card)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>My Classes</div>
            <Link href="/teacher/classes">
              <button style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer" }}>
                View all <ChevronRight size={13} />
              </button>
            </Link>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {CLASSES.map(c => (
              <div key={c.id} style={{ padding: "12px 14px", borderRadius: 8, background: "var(--muted)", borderLeft: `3px solid ${c.color}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)" }}>{c.name}</div>
                  <span style={{ fontSize: 11, color: c.color, fontWeight: 600 }}>{c.progress}%</span>
                </div>
                <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 8 }}>
                  {c.students} students · Next: {c.nextSession} · {c.room}
                </div>
                <div style={{ height: 4, background: "var(--border)", borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${c.progress}%`, background: c.color, borderRadius: 99 }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Attendance chart */}
        <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "20px", background: "var(--card)" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", marginBottom: 4 }}>Weekly Attendance</div>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 16 }}>Average attendance rate per day this week</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={ATT_DATA} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <YAxis domain={[70, 100]} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 11 }} />
              <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                {ATT_DATA.map((entry, i) => (
                  <Cell key={i} fill={entry.rate >= 90 ? "#10B981" : entry.rate >= 85 ? "#F59E0B" : "#EF4444"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {/* Today's sessions */}
        <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "20px", background: "var(--card)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>Today's Sessions</div>
            <Link href="/teacher/schedule">
              <button style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer" }}>
                Schedule <ChevronRight size={13} />
              </button>
            </Link>
          </div>
          {TODAY_SESSIONS.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px 0", color: "var(--muted-foreground)", fontSize: 13 }}>No sessions today</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {TODAY_SESSIONS.map((s, i) => (
                <div key={i} style={{ padding: "12px 14px", borderRadius: 8, background: "var(--muted)", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: "#3B82F618", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Clock size={15} style={{ color: "#3B82F6" }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)" }}>{s.class}</div>
                    <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>{s.time} · {s.room} · {s.students} students</div>
                  </div>
                  <Link href="/teacher/attendance">
                    <button style={{ fontSize: 11, fontWeight: 500, padding: "4px 10px", borderRadius: 5, background: "var(--foreground)", color: "var(--background)", border: "none", cursor: "pointer" }}>
                      Take Attendance
                    </button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent scores */}
        <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "20px", background: "var(--card)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>Recent Scores Entered</div>
            <Link href="/teacher/scores">
              <button style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer" }}>
                All scores <ChevronRight size={13} />
              </button>
            </Link>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {RECENT_SCORES.map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 7, background: "var(--muted)" }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#F59E0B18", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: "#F59E0B" }}>{s.student.split(" ").map(n => n[0]).join("")}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground)" }}>{s.student}</div>
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{s.class} · {s.quiz}</div>
                </div>
                <span style={{ fontSize: 15, fontWeight: 700, color: s.score >= 90 ? "#10B981" : s.score >= 80 ? "#3B82F6" : "#F59E0B" }}>{s.score}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </TeacherLayout>
  );
}
