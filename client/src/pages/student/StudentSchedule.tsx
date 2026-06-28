import StudentLayout from "@/components/StudentLayout";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];
const HOURS = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00"];

const SCHEDULE: Record<string, { title: string; teacher: string; room: string; color: string; start: number; duration: number }[]> = {
  Monday: [{ title: "Standard Arabic L3", teacher: "Ahmed Hassan", room: "Room 4", color: "#3B82F6", start: 9, duration: 1.5 }],
  Tuesday: [{ title: "Quran Memorization", teacher: "Fatima Al-Zahra", room: "Room 2", color: "#10B981", start: 10, duration: 1 }],
  Wednesday: [{ title: "Standard Arabic L3", teacher: "Ahmed Hassan", room: "Room 4", color: "#3B82F6", start: 9, duration: 1.5 }],
  Thursday: [
    { title: "Islamic Fiqh", teacher: "Omar Khalil", room: "Room 7", color: "#8B5CF6", start: 12, duration: 1.5 },
    { title: "Quran Memorization", teacher: "Fatima Al-Zahra", room: "Room 2", color: "#10B981", start: 10, duration: 1 },
  ],
  Sunday: [],
};

const UPCOMING = [
  { day: "Mon Jun 30", sessions: [{ title: "Arabic L3 — Session 17", time: "09:00–10:30", room: "Room 4", color: "#3B82F6" }] },
  { day: "Tue Jul 1", sessions: [{ title: "Quran Memorization", time: "10:00–11:00", room: "Room 2", color: "#10B981" }] },
  { day: "Wed Jul 2", sessions: [{ title: "Arabic L3 — Session 18", time: "09:00–10:30", room: "Room 4", color: "#3B82F6" }] },
  { day: "Thu Jul 3", sessions: [
    { title: "Quran Memorization", time: "10:00–11:00", room: "Room 2", color: "#10B981" },
    { title: "Islamic Fiqh", time: "12:00–13:30", room: "Room 7", color: "#8B5CF6" },
  ]},
];

export default function StudentSchedule() {
  return (
    <StudentLayout>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.025em", color: "var(--foreground)" }}>My Schedule</h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 3 }}>Weekly class timetable · Summer 2025</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: 16 }}>
        {/* Timetable */}
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
                      <td style={{ padding: "4px 12px", fontSize: 11, color: "var(--muted-foreground)", verticalAlign: "top", paddingTop: 8, whiteSpace: "nowrap" }}>{hour}</td>
                      {DAYS.map(day => {
                        const sessions = (SCHEDULE[day] || []).filter(s => s.start === h);
                        return (
                          <td key={day} style={{ padding: "3px", verticalAlign: "top", borderLeft: "1px solid var(--border)" }}>
                            {sessions.map((s, i) => (
                              <div key={i} style={{
                                padding: "5px 8px", borderRadius: 6, background: s.color + "18",
                                borderLeft: `3px solid ${s.color}`, marginBottom: 2,
                              }}>
                                <div style={{ fontSize: 11, fontWeight: 600, color: s.color, lineHeight: 1.2 }}>{s.title}</div>
                                <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 2 }}>{s.room}</div>
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

        {/* Upcoming */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "18px", background: "var(--card)" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", marginBottom: 14 }}>Upcoming Sessions</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {UPCOMING.map((day, di) => (
                <div key={di}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 6 }}>{day.day}</div>
                  {day.sessions.map((s, si) => (
                    <div key={si} style={{ padding: "9px 11px", borderRadius: 7, background: "var(--muted)", borderLeft: `3px solid ${s.color}`, marginBottom: 5 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground)" }}>{s.title}</div>
                      <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>{s.time} · {s.room}</div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "16px", background: "var(--card)" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", marginBottom: 10 }}>Courses</div>
            {[
              { title: "Standard Arabic L3", color: "#3B82F6" },
              { title: "Quran Memorization", color: "#10B981" },
              { title: "Islamic Fiqh", color: "#8B5CF6" },
            ].map(c => (
              <div key={c.title} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: c.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{c.title}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </StudentLayout>
  );
}
