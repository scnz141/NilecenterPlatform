import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { BookOpen, Clock, Award, TrendingUp, Play, CheckCircle, Circle, ExternalLink } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const MY_COURSES = [
  { id: 1, title: "Standard Arabic — Level 3", teacher: "Ahmed Hassan", progress: 68, nextClass: "Mon 9:00 AM", sessions: 24, completed: 16, grade: "A", color: "#3B82F6" },
  { id: 2, title: "Quran Memorization (Juz 1-5)", teacher: "Fatima Al-Zahra", progress: 45, nextClass: "Tue 10:00 AM", sessions: 20, completed: 9, grade: "A+", color: "#10B981" },
  { id: 3, title: "Islamic Fiqh — Fundamentals", teacher: "Omar Khalil", progress: 82, nextClass: "Thu 12:00 PM", sessions: 18, completed: 15, grade: "B+", color: "#8B5CF6" },
];

const GRADES = [
  { subject: "Arabic L3", q1: 88, q2: 91, q3: 85, final: null },
  { subject: "Quran Mem.", q1: 95, q2: 97, q3: null, final: null },
  { subject: "Islamic Fiqh", q1: 82, q2: 86, q3: 89, final: null },
];

const ATTENDANCE = [
  { month: "Jan", rate: 92 }, { month: "Feb", rate: 88 }, { month: "Mar", rate: 95 },
  { month: "Apr", rate: 90 }, { month: "May", rate: 96 }, { month: "Jun", rate: 94 },
];

const UPCOMING = [
  { title: "Arabic L3 — Session 17", date: "Mon, Jun 30", time: "9:00 AM", room: "Room 4" },
  { title: "Quran Memorization", date: "Tue, Jul 1", time: "10:00 AM", room: "Room 2" },
  { title: "Islamic Fiqh", date: "Thu, Jul 3", time: "12:00 PM", room: "Room 7" },
];

const TABS = [{ id: "overview", label: "Overview" }, { id: "courses", label: "My Courses" }, { id: "grades", label: "Grades" }, { id: "attendance", label: "Attendance" }];

export default function StudentPortal() {
  const [tab, setTab] = useState("overview");

  return (
    <DashboardLayout>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.025em", color: "var(--foreground)" }}>Student Portal</h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 3 }}>Welcome back, Mohammed — here's your learning overview</p>
      </div>

      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", marginBottom: 20 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: "8px 14px", fontSize: 13, fontWeight: tab === t.id ? 500 : 400, cursor: "pointer", border: "none", background: "transparent", color: tab === t.id ? "var(--foreground)" : "var(--muted-foreground)", borderBottom: `2px solid ${tab === t.id ? "var(--foreground)" : "transparent"}`, marginBottom: -1 }}>{t.label}</button>
        ))}
      </div>

      {tab === "overview" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
            {[
              { label: "Enrolled Courses", value: "3", icon: BookOpen, color: "#3B82F6" },
              { label: "Avg. Attendance", value: "93%", icon: CheckCircle, color: "#10B981" },
              { label: "Overall Grade", value: "A", icon: Award, color: "#F59E0B" },
              { label: "Hours Studied", value: "142h", icon: Clock, color: "#8B5CF6" },
            ].map(s => {
              const Icon = s.icon;
              return (
                <div key={s.label} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px", background: "var(--card)", display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: s.color + "18", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon size={14} style={{ color: s.color }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{s.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--foreground)" }}>{s.value}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 12 }}>
            <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "18px", background: "var(--card)" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", marginBottom: 14 }}>Course Progress</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {MY_COURSES.map(c => (
                  <div key={c.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)" }}>{c.title}</div>
                        <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{c.teacher} · {c.completed}/{c.sessions} sessions</div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: c.color }}>{c.progress}%</div>
                    </div>
                    <div style={{ height: 5, background: "var(--muted)", borderRadius: 99, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${c.progress}%`, background: c.color, borderRadius: 99, transition: "width 600ms cubic-bezier(0.23, 1, 0.32, 1)" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "18px", background: "var(--card)" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", marginBottom: 14 }}>Upcoming Classes</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {UPCOMING.map((u, i) => (
                  <div key={i} style={{ padding: "10px 12px", borderRadius: 8, background: "var(--muted)", borderLeft: "2px solid var(--nc-blue)" }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground)" }}>{u.title}</div>
                    <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 3 }}>{u.date} · {u.time}</div>
                    <div style={{ fontSize: 10, color: "var(--muted-foreground)" }}>{u.room}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "courses" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {MY_COURSES.map(c => (
            <div key={c.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "18px", background: "var(--card)" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: c.color + "18", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <BookOpen size={15} style={{ color: c.color }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>{c.title}</div>
                    <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{c.teacher}</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 8px", borderRadius: 5, background: c.color + "18", color: c.color }}>Grade: {c.grade}</span>
                  <a href="https://nilecenter.online" target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12, color: "var(--foreground)", textDecoration: "none" }}>
                    <Play size={11} /> Open in Moodle <ExternalLink size={10} />
                  </a>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 12 }}>
                {[
                  { label: "Sessions Completed", value: `${c.completed}/${c.sessions}` },
                  { label: "Next Class", value: c.nextClass },
                  { label: "Progress", value: `${c.progress}%` },
                ].map(s => (
                  <div key={s.label} style={{ padding: "8px 10px", borderRadius: 7, background: "var(--muted)" }}>
                    <div style={{ fontSize: 10, color: "var(--muted-foreground)" }}>{s.label}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", marginTop: 2 }}>{s.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ height: 5, background: "var(--muted)", borderRadius: 99, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${c.progress}%`, background: c.color, borderRadius: 99 }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "grades" && (
        <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", background: "var(--card)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Subject", "Quiz 1", "Quiz 2", "Quiz 3", "Final Exam", "Overall"].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {GRADES.map((g, i) => {
                const scores = [g.q1, g.q2, g.q3].filter(Boolean) as number[];
                const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
                return (
                  <tr key={g.subject} style={{ borderBottom: i < GRADES.length - 1 ? "1px solid var(--border)" : "none" }}>
                    <td style={{ padding: "10px 14px", fontWeight: 500, color: "var(--foreground)" }}>{g.subject}</td>
                    {[g.q1, g.q2, g.q3, g.final].map((score, si) => (
                      <td key={si} style={{ padding: "10px 14px" }}>
                        {score !== null ? (
                          <span style={{ fontSize: 13, fontWeight: 600, color: score >= 90 ? "var(--nc-green)" : score >= 80 ? "var(--nc-blue)" : "var(--nc-amber)" }}>{score}</span>
                        ) : (
                          <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>—</span>
                        )}
                      </td>
                    ))}
                    <td style={{ padding: "10px 14px" }}>
                      {avg && <span style={{ fontSize: 13, fontWeight: 700, padding: "2px 7px", borderRadius: 5, background: avg >= 90 ? "var(--nc-green-light)" : "var(--nc-blue-light)", color: avg >= 90 ? "var(--nc-green)" : "var(--nc-blue)" }}>{avg}%</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === "attendance" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "20px", background: "var(--card)" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", marginBottom: 4 }}>Attendance Rate</div>
              <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 16 }}>Monthly attendance across all courses</div>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={ATTENDANCE} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="attGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.12} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                  <YAxis domain={[80, 100]} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }} />
                  <Area type="monotone" dataKey="rate" stroke="#10B981" strokeWidth={2} fill="url(#attGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "20px", background: "var(--card)" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", marginBottom: 14 }}>By Course</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  { course: "Arabic L3", attended: 15, total: 16, rate: 94 },
                  { course: "Quran Memorization", attended: 8, total: 9, rate: 89 },
                  { course: "Islamic Fiqh", attended: 14, total: 15, rate: 93 },
                ].map(a => (
                  <div key={a.course}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                      <span style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground)" }}>{a.course}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--nc-green)" }}>{a.rate}%</span>
                    </div>
                    <div style={{ display: "flex", gap: 3 }}>
                      {Array.from({ length: a.total }).map((_, i) => (
                        <div key={i} style={{ flex: 1, height: 6, borderRadius: 2, background: i < a.attended ? "var(--nc-green)" : "var(--muted)" }} />
                      ))}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 3 }}>{a.attended}/{a.total} sessions attended</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
