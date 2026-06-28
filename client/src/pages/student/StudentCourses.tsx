import StudentLayout from "@/components/StudentLayout";
import { BookOpen, Play, ExternalLink, Clock, Users, CheckCircle } from "lucide-react";

const COURSES = [
  {
    id: 1, title: "Standard Arabic — Level 3", teacher: "Ahmed Hassan", progress: 68,
    nextClass: "Mon, Jun 30 · 09:00 AM · Room 4", sessions: 24, completed: 16,
    grade: "A", color: "#3B82F6", category: "Arabic Language",
    description: "Comprehensive Arabic language course covering grammar, reading, writing, and conversation at intermediate level.",
    schedule: "Mon / Wed / Fri · 09:00–10:30 AM",
    branch: "B1", fee: "EGP 2,400", enrolled: "Jan 15, 2025",
    syllabus: ["Grammar & Syntax", "Reading Comprehension", "Writing Skills", "Conversation Practice", "Vocabulary Building"],
  },
  {
    id: 2, title: "Quran Memorization (Juz 1–5)", teacher: "Fatima Al-Zahra", progress: 45,
    nextClass: "Tue, Jul 1 · 10:00 AM · Room 2", sessions: 20, completed: 9,
    grade: "A+", color: "#10B981", category: "Quran & Tajweed",
    description: "Structured Quran memorization program with Tajweed rules, covering Juz 1 through 5 with proper recitation.",
    schedule: "Daily · 10:00–11:00 AM",
    branch: "B1", fee: "EGP 1,800", enrolled: "Feb 3, 2025",
    syllabus: ["Tajweed Rules", "Juz 1 Memorization", "Juz 2 Memorization", "Juz 3 Memorization", "Recitation Review"],
  },
  {
    id: 3, title: "Islamic Fiqh — Fundamentals", teacher: "Omar Khalil", progress: 82,
    nextClass: "Thu, Jul 3 · 12:00 PM · Room 7", sessions: 18, completed: 15,
    grade: "B+", color: "#8B5CF6", category: "Islamic Studies",
    description: "Introduction to Islamic jurisprudence covering worship, transactions, and contemporary issues.",
    schedule: "Tue / Thu · 12:00–01:30 PM",
    branch: "B2", fee: "EGP 2,000", enrolled: "Mar 10, 2025",
    syllabus: ["Purification & Prayer", "Fasting & Zakat", "Hajj Fundamentals", "Transactions", "Contemporary Issues"],
  },
];

export default function StudentCourses() {
  return (
    <StudentLayout>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.025em", color: "var(--foreground)" }}>My Courses</h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 3 }}>3 courses enrolled this semester</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {COURSES.map(c => (
          <div key={c.id} style={{ border: "1px solid var(--border)", borderRadius: 12, background: "var(--card)", overflow: "hidden" }}>
            {/* Top bar */}
            <div style={{ height: 4, background: c.color }} />
            <div style={{ padding: "20px 22px" }}>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 10, background: c.color + "18", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <BookOpen size={18} style={{ color: c.color }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)" }}>{c.title}</div>
                    <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>{c.teacher} · {c.category}</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, padding: "4px 10px", borderRadius: 6, background: c.color + "18", color: c.color }}>Grade: {c.grade}</span>
                  <a href="https://nilecenter.online" target="_blank" rel="noopener noreferrer"
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", border: "1px solid var(--border)", borderRadius: 7, fontSize: 12, fontWeight: 500, color: "var(--foreground)", textDecoration: "none", transition: "background 100ms" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--muted)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    <Play size={11} /> Open in Moodle <ExternalLink size={10} />
                  </a>
                </div>
              </div>

              {/* Description */}
              <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginBottom: 16, lineHeight: 1.6 }}>{c.description}</p>

              {/* Stats grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 16 }}>
                {[
                  { label: "Sessions", value: `${c.completed}/${c.sessions}`, icon: CheckCircle },
                  { label: "Schedule", value: c.schedule, icon: Clock },
                  { label: "Branch", value: c.branch, icon: Users },
                  { label: "Enrolled", value: c.enrolled, icon: Clock },
                ].map(s => {
                  const Icon = s.icon;
                  return (
                    <div key={s.label} style={{ padding: "10px 12px", borderRadius: 8, background: "var(--muted)" }}>
                      <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginBottom: 3, display: "flex", alignItems: "center", gap: 4 }}>
                        <Icon size={10} /> {s.label}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)" }}>{s.value}</div>
                    </div>
                  );
                })}
              </div>

              {/* Progress */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground)" }}>Course Progress</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: c.color }}>{c.progress}%</span>
                </div>
                <div style={{ height: 6, background: "var(--muted)", borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${c.progress}%`, background: c.color, borderRadius: 99 }} />
                </div>
              </div>

              {/* Syllabus */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)", marginBottom: 8 }}>Syllabus Topics</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {c.syllabus.map((topic, i) => (
                    <span key={i} style={{
                      fontSize: 11, padding: "3px 9px", borderRadius: 99, border: "1px solid var(--border)",
                      background: i < Math.floor(c.sessions * c.progress / 100 / (c.sessions / c.syllabus.length)) ? c.color + "18" : "transparent",
                      color: i < Math.floor(c.sessions * c.progress / 100 / (c.sessions / c.syllabus.length)) ? c.color : "var(--muted-foreground)",
                      fontWeight: 500,
                    }}>
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </StudentLayout>
  );
}
