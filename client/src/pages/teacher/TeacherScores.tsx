import { useState } from "react";
import TeacherLayout from "@/components/TeacherLayout";
import { Save, Plus } from "lucide-react";
import { toast } from "sonner";

const STUDENTS = [
  { id: 1, name: "Mohammed Al-Rashid", id_num: "STU-001", scores: { q1: 88, q2: 91, q3: null } },
  { id: 2, name: "Aisha Rahman", id_num: "STU-002", scores: { q1: 92, q2: 95, q3: null } },
  { id: 3, name: "Omar Abdullah", id_num: "STU-003", scores: { q1: 78, q2: 82, q3: null } },
  { id: 4, name: "Sara Hassan", id_num: "STU-004", scores: { q1: 85, q2: 88, q3: null } },
  { id: 5, name: "Ali Mahmoud", id_num: "STU-005", scores: { q1: 70, q2: 75, q3: null } },
  { id: 6, name: "Nour Khalil", id_num: "STU-006", scores: { q1: 94, q2: 97, q3: null } },
  { id: 7, name: "Yusuf Ibrahim", id_num: "STU-007", scores: { q1: 80, q2: 83, q3: null } },
  { id: 8, name: "Maryam Saeed", id_num: "STU-008", scores: { q1: 88, q2: 90, q3: null } },
];

type ScoreKey = "q1" | "q2" | "q3";

export default function TeacherScores() {
  const [selectedClass, setSelectedClass] = useState("Standard Arabic L3 — Group A");
  const [activeQuiz, setActiveQuiz] = useState<ScoreKey>("q3");
  const [scores, setScores] = useState<Record<number, string>>({});

  const handleScore = (id: number, val: string) => {
    setScores(prev => ({ ...prev, [id]: val }));
  };

  const handleSave = () => {
    toast.success("Scores saved successfully");
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return "var(--muted-foreground)";
    return score >= 90 ? "#10B981" : score >= 80 ? "#3B82F6" : score >= 70 ? "#F59E0B" : "#EF4444";
  };

  const getGrade = (score: number | null) => {
    if (score === null) return "—";
    if (score >= 95) return "A+";
    if (score >= 90) return "A";
    if (score >= 85) return "B+";
    if (score >= 80) return "B";
    if (score >= 75) return "C+";
    if (score >= 70) return "C";
    return "F";
  };

  return (
    <TeacherLayout>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.025em", color: "var(--foreground)" }}>Scores & Grades</h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 3 }}>Enter and manage student quiz and exam scores</p>
      </div>

      {/* Controls */}
      <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "16px 20px", background: "var(--card)", marginBottom: 14, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 4, fontWeight: 500 }}>Class</div>
          <select
            value={selectedClass}
            onChange={e => setSelectedClass(e.target.value)}
            style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)", background: "var(--muted)", border: "1px solid var(--border)", borderRadius: 6, padding: "6px 10px", cursor: "pointer" }}
          >
            <option>Standard Arabic L3 — Group A</option>
            <option>Standard Arabic L2 — Group B</option>
            <option>Arabic Conversation — Advanced</option>
          </select>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 4, fontWeight: 500 }}>Assessment</div>
          <div style={{ display: "flex", gap: 4 }}>
            {(["q1", "q2", "q3"] as ScoreKey[]).map(q => (
              <button key={q} onClick={() => setActiveQuiz(q)}
                style={{
                  fontSize: 12, fontWeight: 500, padding: "5px 12px", borderRadius: 6, cursor: "pointer",
                  background: activeQuiz === q ? "var(--foreground)" : "var(--muted)",
                  color: activeQuiz === q ? "var(--background)" : "var(--muted-foreground)",
                  border: activeQuiz === q ? "none" : "1px solid var(--border)",
                }}>
                {q === "q1" ? "Quiz 1" : q === "q2" ? "Quiz 2" : "Quiz 3"}
              </button>
            ))}
            <button style={{ fontSize: 12, fontWeight: 500, padding: "5px 12px", borderRadius: 6, cursor: "pointer", background: "var(--muted)", color: "var(--muted-foreground)", border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 4 }}>
              <Plus size={11} /> Add Assessment
            </button>
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={handleSave}
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, padding: "7px 16px", borderRadius: 7, background: "var(--foreground)", color: "var(--background)", border: "none", cursor: "pointer" }}>
          <Save size={13} /> Save Scores
        </button>
      </div>

      {/* Score entry table */}
      <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", background: "var(--card)" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>
              {activeQuiz === "q1" ? "Quiz 1" : activeQuiz === "q2" ? "Quiz 2" : "Quiz 3"} — {selectedClass}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 1 }}>Max score: 100 · Enter scores for each student</div>
          </div>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
            {Object.keys(scores).length} / {STUDENTS.length} entered
          </div>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--muted)" }}>
              {["Student", "ID", "Quiz 1", "Quiz 2", "Quiz 3 (Active)", "Avg.", "Grade"].map(h => (
                <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {STUDENTS.map((s, i) => {
              const q3Score = scores[s.id] ? parseInt(scores[s.id]) : s.scores.q3;
              const avg = q3Score !== null
                ? Math.round((s.scores.q1 + s.scores.q2 + (q3Score || 0)) / 3)
                : Math.round((s.scores.q1 + s.scores.q2) / 2);
              return (
                <tr key={s.id} style={{ borderBottom: i < STUDENTS.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <td style={{ padding: "10px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--muted)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <span style={{ fontSize: 9, fontWeight: 700, color: "var(--muted-foreground)" }}>{s.name.split(" ").map(n => n[0]).join("")}</span>
                      </div>
                      <span style={{ fontWeight: 500, color: "var(--foreground)" }}>{s.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: "10px 16px", color: "var(--muted-foreground)", fontSize: 11 }}>{s.id_num}</td>
                  <td style={{ padding: "10px 16px" }}>
                    <span style={{ fontWeight: 600, color: getScoreColor(s.scores.q1) }}>{s.scores.q1}</span>
                  </td>
                  <td style={{ padding: "10px 16px" }}>
                    <span style={{ fontWeight: 600, color: getScoreColor(s.scores.q2) }}>{s.scores.q2}</span>
                  </td>
                  <td style={{ padding: "10px 16px" }}>
                    <input
                      type="number" min={0} max={100}
                      value={scores[s.id] ?? ""}
                      onChange={e => handleScore(s.id, e.target.value)}
                      placeholder="—"
                      style={{
                        width: 64, padding: "5px 8px", borderRadius: 6, border: "1px solid var(--border)",
                        background: scores[s.id] ? "#3B82F618" : "var(--muted)", fontSize: 13, fontWeight: 600,
                        color: scores[s.id] ? "#3B82F6" : "var(--muted-foreground)", textAlign: "center",
                        outline: "none",
                      }}
                    />
                  </td>
                  <td style={{ padding: "10px 16px" }}>
                    <span style={{ fontWeight: 700, color: getScoreColor(avg) }}>{avg}</span>
                  </td>
                  <td style={{ padding: "10px 16px" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 5, background: getScoreColor(avg) + "18", color: getScoreColor(avg) }}>
                      {getGrade(avg)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </TeacherLayout>
  );
}
