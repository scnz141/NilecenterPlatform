import StudentLayout from "@/components/StudentLayout";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";

const GRADES = [
  { subject: "Standard Arabic L3", q1: 88, q2: 91, q3: 85, final: null, overall: 88, grade: "A", color: "#3B82F6" },
  { subject: "Quran Memorization", q1: 95, q2: 97, q3: null, final: null, overall: 96, grade: "A+", color: "#10B981" },
  { subject: "Islamic Fiqh", q1: 82, q2: 86, q3: 89, final: null, overall: 86, grade: "B+", color: "#8B5CF6" },
];

const RADAR_DATA = [
  { subject: "Arabic", score: 88 },
  { subject: "Quran", score: 96 },
  { subject: "Fiqh", score: 86 },
  { subject: "Attendance", score: 93 },
  { subject: "Participation", score: 90 },
];

const BAR_DATA = [
  { quiz: "Q1", arabic: 88, quran: 95, fiqh: 82 },
  { quiz: "Q2", arabic: 91, quran: 97, fiqh: 86 },
  { quiz: "Q3", arabic: 85, quran: null, fiqh: 89 },
];

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>—</span>;
  const color = score >= 90 ? "#10B981" : score >= 80 ? "#3B82F6" : "#F59E0B";
  return (
    <span style={{ fontSize: 14, fontWeight: 700, color }}>{score}</span>
  );
}

export default function StudentGrades() {
  return (
    <StudentLayout>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.025em", color: "var(--foreground)" }}>Grades & Performance</h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 3 }}>Academic Year 2024–2025 · Semester 2</p>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
        {GRADES.map(g => (
          <div key={g.subject} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "16px", background: "var(--card)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--muted-foreground)" }}>{g.subject}</span>
              <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 5, background: g.color + "18", color: g.color }}>{g.grade}</span>
            </div>
            <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.04em", color: g.color }}>{g.overall}%</div>
            <div style={{ height: 4, background: "var(--muted)", borderRadius: 99, overflow: "hidden", marginTop: 10 }}>
              <div style={{ height: "100%", width: `${g.overall}%`, background: g.color, borderRadius: 99 }} />
            </div>
          </div>
        ))}
      </div>

      {/* Grade table */}
      <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", background: "var(--card)", marginBottom: 16 }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>Grade Breakdown</div>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 1 }}>Scores by assessment type</div>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--muted)" }}>
              {["Subject", "Quiz 1", "Quiz 2", "Quiz 3", "Final Exam", "Overall", "Grade"].map(h => (
                <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GRADES.map((g, i) => (
              <tr key={g.subject} style={{ borderBottom: i < GRADES.length - 1 ? "1px solid var(--border)" : "none" }}>
                <td style={{ padding: "12px 16px", fontWeight: 500, color: "var(--foreground)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: g.color, flexShrink: 0 }} />
                    {g.subject}
                  </div>
                </td>
                <td style={{ padding: "12px 16px" }}><ScoreBadge score={g.q1} /></td>
                <td style={{ padding: "12px 16px" }}><ScoreBadge score={g.q2} /></td>
                <td style={{ padding: "12px 16px" }}><ScoreBadge score={g.q3} /></td>
                <td style={{ padding: "12px 16px" }}><ScoreBadge score={g.final} /></td>
                <td style={{ padding: "12px 16px" }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: g.color }}>{g.overall}%</span>
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 8px", borderRadius: 5, background: g.color + "18", color: g.color }}>{g.grade}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "20px", background: "var(--card)" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", marginBottom: 4 }}>Performance Radar</div>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 16 }}>Overall performance across all dimensions</div>
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={RADAR_DATA}>
              <PolarGrid stroke="var(--border)" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
              <Radar name="Score" dataKey="score" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.15} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "20px", background: "var(--card)" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", marginBottom: 4 }}>Quiz Scores Comparison</div>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 16 }}>Score trend across quizzes per subject</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={BAR_DATA} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="quiz" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <YAxis domain={[70, 100]} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 11 }} />
              <Bar dataKey="arabic" fill="#3B82F6" radius={[3, 3, 0, 0]} name="Arabic" />
              <Bar dataKey="quran" fill="#10B981" radius={[3, 3, 0, 0]} name="Quran" />
              <Bar dataKey="fiqh" fill="#8B5CF6" radius={[3, 3, 0, 0]} name="Fiqh" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </StudentLayout>
  );
}
