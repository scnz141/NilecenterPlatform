import TeacherLayout from "@/components/TeacherLayout";
import { Users, Clock, ChevronRight } from "lucide-react";
import { Link } from "wouter";

const CLASSES = [
  {
    id: 1, name: "Standard Arabic L3 — Group A", level: "Level 3", students: 14,
    schedule: "Mon / Wed / Fri · 09:00–10:30 AM", room: "Room 4", branch: "B1",
    progress: 68, sessions: 24, completed: 16, color: "#3B82F6",
    nextSession: "Mon, Jun 30 · 09:00 AM",
    studentList: ["Mohammed Al-Rashid", "Aisha Rahman", "Omar Abdullah", "Sara Hassan", "Ali Mahmoud", "Nour Khalil", "Yusuf Ibrahim", "Maryam Saeed"],
  },
  {
    id: 2, name: "Standard Arabic L2 — Group B", level: "Level 2", students: 11,
    schedule: "Tue / Thu · 11:00 AM–12:30 PM", room: "Room 3", branch: "B1",
    progress: 45, sessions: 20, completed: 9, color: "#F59E0B",
    nextSession: "Tue, Jul 1 · 11:00 AM",
    studentList: ["Fatima Zahra", "Hassan Ali", "Zainab Noor", "Bilal Qasim", "Ruqayyah Hamid"],
  },
  {
    id: 3, name: "Arabic Conversation — Advanced", level: "Advanced", students: 8,
    schedule: "Thu · 14:00–15:30 PM", room: "Room 6", branch: "B2",
    progress: 82, sessions: 18, completed: 15, color: "#10B981",
    nextSession: "Thu, Jul 3 · 14:00 PM",
    studentList: ["Khalid Mansour", "Layla Farouk", "Tariq Hussain", "Samira Aziz"],
  },
];

export default function TeacherClasses() {
  return (
    <TeacherLayout>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.025em", color: "var(--foreground)" }}>My Classes</h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 3 }}>3 active classes · 33 total students</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {CLASSES.map(c => (
          <div key={c.id} style={{ border: "1px solid var(--border)", borderRadius: 12, background: "var(--card)", overflow: "hidden" }}>
            <div style={{ height: 4, background: c.color }} />
            <div style={{ padding: "20px 22px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)" }}>{c.name}</div>
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 3 }}>{c.schedule} · {c.room} · Branch {c.branch}</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Link href="/teacher/attendance">
                    <button style={{ fontSize: 12, fontWeight: 500, padding: "6px 12px", borderRadius: 7, background: c.color + "18", color: c.color, border: `1px solid ${c.color}40`, cursor: "pointer" }}>
                      Take Attendance
                    </button>
                  </Link>
                  <Link href="/teacher/scores">
                    <button style={{ fontSize: 12, fontWeight: 500, padding: "6px 12px", borderRadius: 7, background: "var(--foreground)", color: "var(--background)", border: "none", cursor: "pointer" }}>
                      Enter Scores
                    </button>
                  </Link>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 16 }}>
                {[
                  { label: "Students", value: `${c.students}`, icon: Users },
                  { label: "Sessions Done", value: `${c.completed}/${c.sessions}`, icon: Clock },
                  { label: "Next Session", value: c.nextSession, icon: Clock },
                  { label: "Level", value: c.level, icon: ChevronRight },
                ].map(s => {
                  const Icon = s.icon;
                  return (
                    <div key={s.label} style={{ padding: "10px 12px", borderRadius: 8, background: "var(--muted)" }}>
                      <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginBottom: 3 }}>{s.label}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)" }}>{s.value}</div>
                    </div>
                  );
                })}
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground)" }}>Course Progress</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: c.color }}>{c.progress}%</span>
                </div>
                <div style={{ height: 5, background: "var(--muted)", borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${c.progress}%`, background: c.color, borderRadius: 99 }} />
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)", marginBottom: 8 }}>Students ({c.students})</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {c.studentList.map((s, i) => (
                    <span key={i} style={{ fontSize: 11, padding: "3px 9px", borderRadius: 99, background: "var(--muted)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>
                      {s}
                    </span>
                  ))}
                  {c.students > c.studentList.length && (
                    <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 99, background: c.color + "18", color: c.color, border: `1px solid ${c.color}40`, fontWeight: 500 }}>
                      +{c.students - c.studentList.length} more
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </TeacherLayout>
  );
}
