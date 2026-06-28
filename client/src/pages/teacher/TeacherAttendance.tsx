import { useState } from "react";
import TeacherLayout from "@/components/TeacherLayout";
import { CheckCircle, XCircle, Clock, Save } from "lucide-react";
import { toast } from "sonner";

const STUDENTS = [
  { id: 1, name: "Mohammed Al-Rashid", id_num: "STU-001" },
  { id: 2, name: "Aisha Rahman", id_num: "STU-002" },
  { id: 3, name: "Omar Abdullah", id_num: "STU-003" },
  { id: 4, name: "Sara Hassan", id_num: "STU-004" },
  { id: 5, name: "Ali Mahmoud", id_num: "STU-005" },
  { id: 6, name: "Nour Khalil", id_num: "STU-006" },
  { id: 7, name: "Yusuf Ibrahim", id_num: "STU-007" },
  { id: 8, name: "Maryam Saeed", id_num: "STU-008" },
  { id: 9, name: "Khalid Mansour", id_num: "STU-009" },
  { id: 10, name: "Layla Farouk", id_num: "STU-010" },
  { id: 11, name: "Tariq Hussain", id_num: "STU-011" },
  { id: 12, name: "Samira Aziz", id_num: "STU-012" },
  { id: 13, name: "Hassan Ali", id_num: "STU-013" },
  { id: 14, name: "Zainab Noor", id_num: "STU-014" },
];

type Status = "present" | "absent" | "late" | null;

export default function TeacherAttendance() {
  const [selectedClass, setSelectedClass] = useState("Standard Arabic L3 — Group A");
  const [attendance, setAttendance] = useState<Record<number, Status>>({});
  const [saved, setSaved] = useState(false);

  const setStatus = (id: number, status: Status) => {
    setAttendance(prev => ({ ...prev, [id]: prev[id] === status ? null : status }));
    setSaved(false);
  };

  const markAll = (status: Status) => {
    const all: Record<number, Status> = {};
    STUDENTS.forEach(s => { all[s.id] = status; });
    setAttendance(all);
    setSaved(false);
  };

  const handleSave = () => {
    setSaved(true);
    toast.success("Attendance saved successfully");
  };

  const presentCount = Object.values(attendance).filter(v => v === "present").length;
  const absentCount = Object.values(attendance).filter(v => v === "absent").length;
  const lateCount = Object.values(attendance).filter(v => v === "late").length;
  const unmarked = STUDENTS.length - presentCount - absentCount - lateCount;

  return (
    <TeacherLayout>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.025em", color: "var(--foreground)" }}>Take Attendance</h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 3 }}>Mark attendance for today's session</p>
      </div>

      {/* Session selector */}
      <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "16px 20px", background: "var(--card)", marginBottom: 14, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1 }}>
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
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 4, fontWeight: 500 }}>Date</div>
          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)" }}>Friday, June 26, 2026</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 4, fontWeight: 500 }}>Session</div>
          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)" }}>Session 17 · 09:00 AM</div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 14 }}>
        {[
          { label: "Present", value: presentCount, color: "#10B981" },
          { label: "Absent", value: absentCount, color: "#EF4444" },
          { label: "Late", value: lateCount, color: "#F59E0B" },
          { label: "Unmarked", value: unmarked, color: "var(--muted-foreground)" },
        ].map(s => (
          <div key={s.label} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "12px 14px", background: "var(--card)", textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <button onClick={() => markAll("present")} style={{ fontSize: 12, fontWeight: 500, padding: "6px 12px", borderRadius: 6, background: "#10B98118", color: "#10B981", border: "1px solid #10B98140", cursor: "pointer" }}>
          Mark All Present
        </button>
        <button onClick={() => markAll("absent")} style={{ fontSize: 12, fontWeight: 500, padding: "6px 12px", borderRadius: 6, background: "#EF444418", color: "#EF4444", border: "1px solid #EF444440", cursor: "pointer" }}>
          Mark All Absent
        </button>
        <button onClick={() => setAttendance({})} style={{ fontSize: 12, fontWeight: 500, padding: "6px 12px", borderRadius: 6, background: "var(--muted)", color: "var(--muted-foreground)", border: "1px solid var(--border)", cursor: "pointer" }}>
          Clear All
        </button>
        <div style={{ flex: 1 }} />
        <button onClick={handleSave} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, padding: "7px 16px", borderRadius: 7, background: "var(--foreground)", color: "var(--background)", border: "none", cursor: "pointer" }}>
          <Save size={13} /> Save Attendance
        </button>
      </div>

      {/* Student list */}
      <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", background: "var(--card)" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>Students ({STUDENTS.length})</div>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Click to mark status</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {STUDENTS.map((s, i) => {
            const status = attendance[s.id];
            return (
              <div key={s.id} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 18px",
                borderBottom: i < STUDENTS.length - 1 ? "1px solid var(--border)" : "none",
                background: status === "present" ? "#10B98108" : status === "absent" ? "#EF444408" : status === "late" ? "#F59E0B08" : "transparent",
              }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--muted)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "var(--muted-foreground)" }}>{s.name.split(" ").map(n => n[0]).join("")}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)" }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{s.id_num}</div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {[
                    { key: "present" as Status, label: "P", icon: CheckCircle, color: "#10B981" },
                    { key: "late" as Status, label: "L", icon: Clock, color: "#F59E0B" },
                    { key: "absent" as Status, label: "A", icon: XCircle, color: "#EF4444" },
                  ].map(btn => {
                    const Icon = btn.icon;
                    const active = status === btn.key;
                    return (
                      <button key={btn.key} onClick={() => setStatus(s.id, btn.key)}
                        style={{
                          width: 32, height: 32, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center",
                          background: active ? btn.color + "20" : "var(--muted)", border: active ? `1.5px solid ${btn.color}` : "1px solid var(--border)",
                          cursor: "pointer", transition: "all 100ms",
                        }}>
                        <Icon size={14} style={{ color: active ? btn.color : "var(--muted-foreground)" }} />
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </TeacherLayout>
  );
}
