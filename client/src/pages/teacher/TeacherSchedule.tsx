import TeacherLayout from "@/components/TeacherLayout";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];
const HOURS = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00"];

const SCHEDULE: Record<string, { title: string; room: string; color: string; start: number; students: number }[]> = {
  Monday: [{ title: "Arabic L3 — Group A", room: "Room 4", color: "#3B82F6", start: 9, students: 14 }],
  Tuesday: [{ title: "Arabic L2 — Group B", room: "Room 3", color: "#F59E0B", start: 11, students: 11 }],
  Wednesday: [{ title: "Arabic L3 — Group A", room: "Room 4", color: "#3B82F6", start: 9, students: 14 }],
  Thursday: [
    { title: "Arabic L2 — Group B", room: "Room 3", color: "#F59E0B", start: 11, students: 11 },
    { title: "Conversation — Advanced", room: "Room 6", color: "#10B981", start: 14, students: 8 },
  ],
  Sunday: [],
};

export default function TeacherSchedule() {
  return (
    <TeacherLayout>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.025em", color: "var(--foreground)" }}>My Schedule</h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 3 }}>Weekly teaching schedule · Summer 2025</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 240px", gap: 16 }}>
        <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", background: "var(--card)" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>Weekly Timetable</div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th style={{ width: 60, padding: "8px 12px", fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)", textAlign: "left", background: "var(--muted)" }}>Time</th>
                  {DAYS.map(d => (
                    <th key={d} style={{ padding: "8px 12px", fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)", textAlign: "center", background: "var(--muted)", borderLeft: "1px solid var(--border)" }}>{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {HOURS.map((hour, hi) => {
                  const h = parseInt(hour);
                  return (
                    <tr key={hour} style={{ borderBottom: "1px solid var(--border)", height: 52 }}>
                      <td style={{ padding: "4px 12px", fontSize: 11, color: "var(--muted-foreground)", verticalAlign: "top", paddingTop: 8 }}>{hour}</td>
                      {DAYS.map(day => {
                        const sessions = (SCHEDULE[day] || []).filter(s => s.start === h);
                        return (
                          <td key={day} style={{ padding: "3px", verticalAlign: "top", borderLeft: "1px solid var(--border)" }}>
                            {sessions.map((s, i) => (
                              <div key={i} style={{ padding: "5px 8px", borderRadius: 6, background: s.color + "18", borderLeft: `3px solid ${s.color}`, marginBottom: 2 }}>
                                <div style={{ fontSize: 11, fontWeight: 600, color: s.color, lineHeight: 1.2 }}>{s.title}</div>
                                <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 2 }}>{s.room} · {s.students} stu.</div>
                              </div>
                            ))}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "18px", background: "var(--card)" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", marginBottom: 14 }}>This Week Summary</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { day: "Monday", sessions: 1, hours: "1.5h" },
                { day: "Tuesday", sessions: 1, hours: "1.5h" },
                { day: "Wednesday", sessions: 1, hours: "1.5h" },
                { day: "Thursday", sessions: 2, hours: "3h" },
              ].map(d => (
                <div key={d.day} style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", borderRadius: 7, background: "var(--muted)" }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground)" }}>{d.day}</span>
                  <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{d.sessions} session · {d.hours}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 8, background: "#3B82F618", border: "1px solid #3B82F630" }}>
              <div style={{ fontSize: 11, color: "#3B82F6", fontWeight: 600 }}>Total this week</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#3B82F6" }}>5 sessions · 7.5h</div>
            </div>
          </div>

          <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "16px", background: "var(--card)" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", marginBottom: 10 }}>Classes</div>
            {[
              { title: "Arabic L3 — Group A", color: "#3B82F6" },
              { title: "Arabic L2 — Group B", color: "#F59E0B" },
              { title: "Conversation — Advanced", color: "#10B981" },
            ].map(c => (
              <div key={c.title} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: c.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{c.title}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </TeacherLayout>
  );
}
