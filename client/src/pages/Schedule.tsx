import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { ChevronLeft, ChevronRight, Printer } from "lucide-react";
import { toast } from "sonner";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const HOURS = Array.from({ length: 13 }, (_, i) => `${(i + 8).toString().padStart(2, "0")}:00`);

const EVENTS = [
  { day: 0, start: 9, duration: 1.5, title: "Arabic L3 — Group A", teacher: "Ahmed Hassan", room: "Room 4", color: "#3B82F6" },
  { day: 0, start: 11, duration: 1, title: "Arabic L1 — Group C", teacher: "Ahmed Hassan", room: "Room 4", color: "#3B82F6" },
  { day: 1, start: 10, duration: 1.5, title: "Quran Memorization", teacher: "Fatima Al-Zahra", room: "Room 2", color: "#10B981" },
  { day: 1, start: 12, duration: 1, title: "Islamic Fiqh", teacher: "Omar Khalil", room: "Room 7", color: "#8B5CF6" },
  { day: 2, start: 9, duration: 1.5, title: "Arabic L3 — Group A", teacher: "Ahmed Hassan", room: "Room 4", color: "#3B82F6" },
  { day: 2, start: 14, duration: 1.5, title: "Turkish Beginner", teacher: "Yusuf Ali", room: "Room 1", color: "#F59E0B" },
  { day: 3, start: 10, duration: 1.5, title: "Quran Memorization", teacher: "Fatima Al-Zahra", room: "Room 2", color: "#10B981" },
  { day: 3, start: 12, duration: 1, title: "Islamic Fiqh", teacher: "Omar Khalil", room: "Room 7", color: "#8B5CF6" },
  { day: 4, start: 9, duration: 1.5, title: "Arabic L3 — Group A", teacher: "Ahmed Hassan", room: "Room 4", color: "#3B82F6" },
  { day: 4, start: 16, duration: 1.5, title: "Academic English", teacher: "Sara Mostafa", room: "Room 5", color: "#EF4444" },
  { day: 5, start: 10, duration: 2, title: "Arabic Calligraphy", teacher: "Nour Ibrahim", room: "Room 3", color: "#06B6D4" },
  { day: 5, start: 14, duration: 1.5, title: "Turkish Beginner", teacher: "Yusuf Ali", room: "Room 1", color: "#F59E0B" },
];

const CELL_HEIGHT = 56;

export default function Schedule() {
  const [view, setView] = useState<"week" | "day">("week");
  const [selectedDay, setSelectedDay] = useState(0);

  return (
    <DashboardLayout>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.025em", color: "var(--foreground)" }}>Schedule</h1>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 3 }}>Weekly timetable for all classes and sessions</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ display: "flex", border: "1px solid var(--border)", borderRadius: 7, overflow: "hidden" }}>
            {(["week", "day"] as const).map(v => (
              <button key={v} onClick={() => setView(v)} style={{ padding: "6px 14px", fontSize: 12, fontWeight: 500, cursor: "pointer", border: "none", background: view === v ? "var(--foreground)" : "transparent", color: view === v ? "var(--background)" : "var(--muted-foreground)", textTransform: "capitalize" }}>{v}</button>
            ))}
          </div>
          <button onClick={() => toast.info("Printing...")} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", border: "1px solid var(--border)", borderRadius: 7, fontSize: 12, fontWeight: 500, background: "transparent", color: "var(--foreground)", cursor: "pointer" }}>
            <Printer size={13} /> Print
          </button>
        </div>
      </div>

      {view === "week" && (
        <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "auto", background: "var(--card)" }}>
          <div style={{ minWidth: 900 }}>
            {/* Header */}
            <div style={{ display: "grid", gridTemplateColumns: "64px repeat(7, 1fr)", borderBottom: "1px solid var(--border)" }}>
              <div style={{ padding: "10px 8px" }} />
              {DAYS.map((d, i) => (
                <div key={d} style={{ padding: "10px 8px", textAlign: "center", fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", borderLeft: "1px solid var(--border)" }}>{d.slice(0, 3)}</div>
              ))}
            </div>
            {/* Grid */}
            <div style={{ position: "relative" }}>
              {HOURS.map((h, hi) => (
                <div key={h} style={{ display: "grid", gridTemplateColumns: "64px repeat(7, 1fr)", borderBottom: hi < HOURS.length - 1 ? "1px solid var(--border)" : "none", height: CELL_HEIGHT }}>
                  <div style={{ padding: "4px 8px", fontSize: 10, fontWeight: 600, color: "var(--muted-foreground)", display: "flex", alignItems: "flex-start" }}>{h}</div>
                  {DAYS.map((_, di) => (
                    <div key={di} style={{ borderLeft: "1px solid var(--border)", position: "relative" }} />
                  ))}
                </div>
              ))}
              {/* Events overlay */}
              {EVENTS.map((ev, i) => (
                <div key={i} style={{
                  position: "absolute",
                  left: `calc(64px + ${ev.day} * (100% - 64px) / 7 + 2px)`,
                  width: `calc((100% - 64px) / 7 - 4px)`,
                  top: `${(ev.start - 8) * CELL_HEIGHT}px`,
                  height: `${ev.duration * CELL_HEIGHT - 2}px`,
                  background: ev.color + "20",
                  borderLeft: `2px solid ${ev.color}`,
                  borderRadius: "0 5px 5px 0",
                  padding: "4px 6px",
                  overflow: "hidden",
                  cursor: "pointer",
                  transition: "opacity 100ms",
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "0.8"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
                >
                  <div style={{ fontSize: 10, fontWeight: 600, color: ev.color, lineHeight: 1.3 }}>{ev.title}</div>
                  <div style={{ fontSize: 9, color: ev.color, opacity: 0.8, marginTop: 1 }}>{ev.room}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {view === "day" && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <button onClick={() => setSelectedDay(Math.max(0, selectedDay - 1))} style={{ padding: 6, borderRadius: 5, border: "1px solid var(--border)", background: "transparent", cursor: "pointer", color: "var(--foreground)", display: "flex" }}><ChevronLeft size={14} /></button>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>{DAYS[selectedDay]}</span>
            <button onClick={() => setSelectedDay(Math.min(6, selectedDay + 1))} style={{ padding: 6, borderRadius: 5, border: "1px solid var(--border)", background: "transparent", cursor: "pointer", color: "var(--foreground)", display: "flex" }}><ChevronRight size={14} /></button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {EVENTS.filter(e => e.day === selectedDay).length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "var(--muted-foreground)", fontSize: 13 }}>No classes scheduled for this day</div>
            ) : (
              EVENTS.filter(e => e.day === selectedDay).sort((a, b) => a.start - b.start).map((ev, i) => (
                <div key={i} style={{ display: "flex", gap: 12, padding: "14px 16px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--card)", borderLeft: `3px solid ${ev.color}` }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)", width: 48, flexShrink: 0 }}>{ev.start.toString().padStart(2, "0")}:00</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>{ev.title}</div>
                    <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>{ev.teacher} · {ev.room} · {ev.duration}h</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
