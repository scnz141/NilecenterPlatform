import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Search, CheckCircle2, XCircle, MinusCircle, Download } from "lucide-react";
import { toast } from "sonner";

const CLASSES_LIST = [
  { id: "CLS-001", name: "Standard Arabic L3 — Group A", teacher: "Ahmed Hassan", room: "Room 4", schedule: "Mon/Wed/Fri 09:00", students: 18, progress: 72, branch: "B1" },
  { id: "CLS-002", name: "Quran Memorization — Juz 15", teacher: "Fatima Al-Zahra", room: "Room 2", schedule: "Daily 10:30", students: 12, progress: 85, branch: "Online" },
  { id: "CLS-003", name: "Islamic Fiqh — Fundamentals", teacher: "Omar Khalil", room: "Room 7", schedule: "Tue/Thu 12:00", students: 24, progress: 60, branch: "B2" },
  { id: "CLS-004", name: "Turkish Beginner A1 — Group B", teacher: "Yusuf Ali", room: "Room 1", schedule: "Mon/Wed/Sat 14:00", students: 15, progress: 45, branch: "B1" },
  { id: "CLS-005", name: "Academic English B1", teacher: "Sara Mostafa", room: "Room 5", schedule: "Sun/Tue/Thu 16:00", students: 20, progress: 55, branch: "Online" },
];

const ATTENDANCE_STUDENTS = [
  { name: "Mohammed Al-Rashid", id: "STU-001", status: "present" },
  { name: "Aisha Binte Yusuf", id: "STU-002", status: "present" },
  { name: "Khalid Ibrahim", id: "STU-003", status: "absent" },
  { name: "Fatima Zahra", id: "STU-004", status: "present" },
  { name: "Omar Abdullah", id: "STU-005", status: "late" },
  { name: "Mariam Youssef", id: "STU-006", status: "present" },
  { name: "Hassan Al-Amin", id: "STU-007", status: "present" },
  { name: "Zainab Mustafa", id: "STU-008", status: "absent" },
];

const SCORES = [
  { name: "Mohammed Al-Rashid", id: "STU-001", midterm: 88, final: 92, assignment: 95, total: 91 },
  { name: "Aisha Binte Yusuf", id: "STU-002", midterm: 76, final: 82, assignment: 88, total: 82 },
  { name: "Khalid Ibrahim", id: "STU-003", midterm: 65, final: 70, assignment: 75, total: 70 },
  { name: "Fatima Zahra", id: "STU-004", midterm: 92, final: 95, assignment: 98, total: 95 },
  { name: "Omar Abdullah", id: "STU-005", midterm: 58, final: 65, assignment: 70, total: 64 },
  { name: "Mariam Youssef", id: "STU-006", midterm: 80, final: 85, assignment: 90, total: 85 },
];

const TABS = [
  { id: "list", label: "Classes" },
  { id: "attendance", label: "Attendance" },
  { id: "detailed", label: "Detailed Attendance" },
  { id: "scores", label: "Scores & Grades" },
];

export default function Classes() {
  const [tab, setTab] = useState("list");
  const [attendance, setAttendance] = useState<Record<string, string>>(
    Object.fromEntries(ATTENDANCE_STUDENTS.map(s => [s.id, s.status]))
  );

  return (
    <DashboardLayout>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.025em", color: "var(--foreground)" }}>Classes</h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 3 }}>Manage class sessions, attendance, and student scores</p>
      </div>

      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", marginBottom: 20 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "8px 14px", fontSize: 13, fontWeight: tab === t.id ? 500 : 400, cursor: "pointer", border: "none", background: "transparent",
            color: tab === t.id ? "var(--foreground)" : "var(--muted-foreground)",
            borderBottom: `2px solid ${tab === t.id ? "var(--foreground)" : "transparent"}`,
            marginBottom: -1,
          }}>{t.label}</button>
        ))}
      </div>

      {tab === "list" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {CLASSES_LIST.map(c => (
            <div key={c.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "16px 18px", background: "var(--card)", display: "flex", alignItems: "center", gap: 16, cursor: "pointer", transition: "box-shadow 150ms" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 8px oklch(0 0 0 / 0.05)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", marginBottom: 3 }}>{c.name}</div>
                <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{c.teacher} · {c.schedule} · {c.room}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 20, flexShrink: 0 }}>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>{c.students}</div>
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>students</div>
                </div>
                <div style={{ width: 80 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>Progress</span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: "var(--foreground)" }}>{c.progress}%</span>
                  </div>
                  <div style={{ height: 3, background: "var(--muted)", borderRadius: 99, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${c.progress}%`, background: "var(--nc-blue)", borderRadius: 99 }} />
                  </div>
                </div>
                <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 4, background: "var(--muted)", color: "var(--muted-foreground)" }}>{c.branch}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "attendance" && (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
              Standard Arabic L3 — Group A · {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
            </div>
            <button onClick={() => toast.success("Attendance saved")} style={{ padding: "6px 14px", background: "var(--foreground)", color: "var(--background)", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
              Save Attendance
            </button>
          </div>
          <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", background: "var(--card)" }}>
            {ATTENDANCE_STUDENTS.map((s, i) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderBottom: i < ATTENDANCE_STUDENTS.length - 1 ? "1px solid var(--border)" : "none" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)" }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{s.id}</div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {["present", "late", "absent"].map(status => (
                    <button key={status} onClick={() => setAttendance(p => ({ ...p, [s.id]: status }))} style={{
                      padding: "4px 10px", borderRadius: 5, fontSize: 11, fontWeight: 500, cursor: "pointer", border: "1px solid",
                      borderColor: attendance[s.id] === status ? (status === "present" ? "var(--nc-green)" : status === "late" ? "oklch(0.75 0.15 75)" : "var(--nc-red)") : "var(--border)",
                      background: attendance[s.id] === status ? (status === "present" ? "var(--nc-green-light)" : status === "late" ? "var(--nc-amber-light)" : "var(--nc-red-light)") : "transparent",
                      color: attendance[s.id] === status ? (status === "present" ? "var(--nc-green)" : status === "late" ? "oklch(0.55 0.16 75)" : "var(--nc-red)") : "var(--muted-foreground)",
                      textTransform: "capitalize",
                    }}>{status}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "detailed" && (
        <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", background: "var(--card)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Student", "Total Sessions", "Present", "Absent", "Late", "Rate"].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ATTENDANCE_STUDENTS.map((s, i) => {
                const present = Math.floor(Math.random() * 10) + 15;
                const absent = Math.floor(Math.random() * 4);
                const late = Math.floor(Math.random() * 3);
                const total = present + absent + late;
                const rate = Math.round((present / total) * 100);
                return (
                  <tr key={s.id} style={{ borderBottom: i < ATTENDANCE_STUDENTS.length - 1 ? "1px solid var(--border)" : "none" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--muted)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    <td style={{ padding: "10px 14px", fontWeight: 500, color: "var(--foreground)" }}>{s.name}</td>
                    <td style={{ padding: "10px 14px", color: "var(--muted-foreground)" }}>{total}</td>
                    <td style={{ padding: "10px 14px", color: "var(--nc-green)", fontWeight: 500 }}>{present}</td>
                    <td style={{ padding: "10px 14px", color: "var(--nc-red)", fontWeight: 500 }}>{absent}</td>
                    <td style={{ padding: "10px 14px", color: "oklch(0.55 0.16 75)", fontWeight: 500 }}>{late}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 60, height: 4, background: "var(--muted)", borderRadius: 99, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${rate}%`, background: rate >= 80 ? "var(--nc-green)" : rate >= 60 ? "oklch(0.75 0.15 75)" : "var(--nc-red)", borderRadius: 99 }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground)" }}>{rate}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === "scores" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <button onClick={() => toast.info("Exporting grades...")} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12, fontWeight: 500, background: "transparent", color: "var(--foreground)", cursor: "pointer" }}>
              <Download size={13} /> Export Grades
            </button>
          </div>
          <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", background: "var(--card)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["Student", "Midterm", "Final Exam", "Assignments", "Total", "Grade"].map(h => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SCORES.map((s, i) => {
                  const grade = s.total >= 90 ? "A" : s.total >= 80 ? "B" : s.total >= 70 ? "C" : s.total >= 60 ? "D" : "F";
                  const gradeColor = grade === "A" ? "var(--nc-green)" : grade === "B" ? "var(--nc-blue)" : grade === "C" ? "oklch(0.55 0.16 75)" : "var(--nc-red)";
                  return (
                    <tr key={s.id} style={{ borderBottom: i < SCORES.length - 1 ? "1px solid var(--border)" : "none" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--muted)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                    >
                      <td style={{ padding: "10px 14px", fontWeight: 500, color: "var(--foreground)" }}>{s.name}</td>
                      <td style={{ padding: "10px 14px", color: "var(--foreground)" }}>{s.midterm}</td>
                      <td style={{ padding: "10px 14px", color: "var(--foreground)" }}>{s.final}</td>
                      <td style={{ padding: "10px 14px", color: "var(--foreground)" }}>{s.assignment}</td>
                      <td style={{ padding: "10px 14px", fontWeight: 700, color: "var(--foreground)" }}>{s.total}</td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: gradeColor, background: gradeColor + "18", padding: "2px 8px", borderRadius: 4 }}>{grade}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
