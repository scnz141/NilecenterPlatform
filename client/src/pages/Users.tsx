import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Plus, Search, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";

const USERS = [
  { id: "USR-001", name: "Teacher Demo A", email: "teacher.a@nilelearn.local", role: "Teacher", branch: "B1", status: "active", joined: "Jan 2024", avatar: "TA", courses: 3 },
  { id: "USR-002", name: "Teacher Demo B", email: "teacher.b@nilelearn.local", role: "Teacher", branch: "All", status: "active", joined: "Mar 2023", avatar: "TB", courses: 4 },
  { id: "USR-003", name: "Teacher Demo C", email: "teacher.c@nilelearn.local", role: "Teacher", branch: "B2", status: "active", joined: "Jun 2023", avatar: "TC", courses: 2 },
  { id: "USR-004", name: "Registrar Demo", email: "registrar.demo@nilelearn.local", role: "Registrar", branch: "B1", status: "active", joined: "Sep 2022", avatar: "RD", courses: 0 },
  { id: "USR-005", name: "HOD Demo", email: "hod.demo@nilelearn.local", role: "Head of Dept", branch: "All", status: "active", joined: "Jan 2022", avatar: "HD", courses: 0 },
  { id: "USR-006", name: "Teacher Demo D", email: "teacher.d@nilelearn.local", role: "Teacher", branch: "B1", status: "active", joined: "Apr 2024", avatar: "TD", courses: 2 },
  { id: "USR-007", name: "Teacher Demo E", email: "teacher.e@nilelearn.local", role: "Teacher", branch: "Online", status: "active", joined: "Feb 2024", avatar: "TE", courses: 3 },
  { id: "USR-008", name: "Teacher Demo F", email: "teacher.f@nilelearn.local", role: "Teacher", branch: "B1 + B2", status: "inactive", joined: "Nov 2023", avatar: "TF", courses: 1 },
];

const ROLE_COLORS: Record<string, string> = {
  "Teacher": "#3B82F6",
  "Registrar": "#8B5CF6",
  "Head of Dept": "#10B981",
  "Branch Admin": "#F59E0B",
  "Accountant": "#EF4444",
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TIMES = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];

const TIMETABLE: Record<string, Record<string, string>> = {
  "Teacher Demo A": { "Mon-09:00": "Arabic L3", "Wed-09:00": "Arabic L3", "Fri-09:00": "Arabic L3", "Tue-11:00": "Arabic L1", "Thu-11:00": "Arabic L1" },
  "Teacher Demo B": { "Mon-10:00": "Quran Mem", "Tue-10:00": "Quran Mem", "Wed-10:00": "Quran Mem", "Thu-10:00": "Quran Mem", "Fri-10:00": "Quran Mem" },
  "Teacher Demo C": { "Tue-12:00": "Fiqh", "Thu-12:00": "Fiqh", "Sat-14:00": "Fiqh Adv" },
};

const TABS = [{ id: "staff", label: "Staff List" }, { id: "timetable", label: "Weekly Timetable" }];

export default function Users() {
  const [tab, setTab] = useState("staff");
  const [search, setSearch] = useState("");
  const filtered = USERS.filter(u => u.name.toLowerCase().includes(search.toLowerCase()) || u.role.toLowerCase().includes(search.toLowerCase()));

  return (
    <DashboardLayout>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.025em", color: "var(--foreground)" }}>Users</h1>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 3 }}>Manage staff accounts and weekly timetables</p>
        </div>
        <button onClick={() => toast.info("Add user — coming soon")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", background: "var(--foreground)", color: "var(--background)", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
          <Plus size={14} /> Add User
        </button>
      </div>

      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", marginBottom: 20 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: "8px 14px", fontSize: 13, fontWeight: tab === t.id ? 500 : 400, cursor: "pointer", border: "none", background: "transparent", color: tab === t.id ? "var(--foreground)" : "var(--muted-foreground)", borderBottom: `2px solid ${tab === t.id ? "var(--foreground)" : "transparent"}`, marginBottom: -1 }}>{t.label}</button>
        ))}
      </div>

      {tab === "staff" && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", background: "var(--muted)", borderRadius: 6, flex: 1, maxWidth: 260 }}>
              <Search size={13} style={{ color: "var(--muted-foreground)" }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search staff..." style={{ background: "transparent", border: "none", outline: "none", fontSize: 13, color: "var(--foreground)", width: "100%" }} />
            </div>
          </div>
          <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", background: "var(--card)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["Staff Member", "Role", "Branch", "Courses", "Status", "Joined", ""].map(h => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((u, i) => (
                  <tr key={u.id} style={{ borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--muted)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: "50%", background: ROLE_COLORS[u.role] || "#6B7280", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <span style={{ fontSize: 9, fontWeight: 700, color: "white" }}>{u.avatar}</span>
                        </div>
                        <div>
                          <div style={{ fontWeight: 500, color: "var(--foreground)" }}>{u.name}</div>
                          <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ fontSize: 11, fontWeight: 500, padding: "2px 7px", borderRadius: 4, background: (ROLE_COLORS[u.role] || "#6B7280") + "18", color: ROLE_COLORS[u.role] || "#6B7280" }}>{u.role}</span>
                    </td>
                    <td style={{ padding: "10px 14px", color: "var(--muted-foreground)", fontSize: 12 }}>{u.branch}</td>
                    <td style={{ padding: "10px 14px", color: "var(--foreground)", fontWeight: 500 }}>{u.courses || "—"}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, background: u.status === "active" ? "var(--nc-green-light)" : "var(--muted)", color: u.status === "active" ? "var(--nc-green)" : "var(--muted-foreground)" }}>{u.status}</span>
                    </td>
                    <td style={{ padding: "10px 14px", color: "var(--muted-foreground)", fontSize: 12 }}>{u.joined}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={() => toast.info(`Edit ${u.name}`)} style={{ padding: 5, borderRadius: 4, background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)" }}><Edit size={13} /></button>
                        <button onClick={() => toast.error(`Delete ${u.name}?`)} style={{ padding: 5, borderRadius: 4, background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)" }}><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "timetable" && (
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 700, border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", background: "var(--card)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)", width: 80 }}>Time</th>
                  {DAYS.map(d => (
                    <th key={d} style={{ padding: "10px 8px", textAlign: "center", fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)" }}>{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TIMES.map((time, ti) => (
                  <tr key={time} style={{ borderBottom: ti < TIMES.length - 1 ? "1px solid var(--border)" : "none" }}>
                    <td style={{ padding: "8px 14px", fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)" }}>{time}</td>
                    {DAYS.map(day => {
                      const key = `${day}-${time}`;
                      const teacher = Object.keys(TIMETABLE).find(t => TIMETABLE[t][key]);
                      const course = teacher ? TIMETABLE[teacher][key] : null;
                      return (
                        <td key={day} style={{ padding: "4px 4px", textAlign: "center" }}>
                          {course && (
                            <div style={{ padding: "4px 6px", borderRadius: 5, background: "var(--nc-blue-light)", fontSize: 10, fontWeight: 500, color: "var(--nc-blue)", lineHeight: 1.3 }}>
                              <div>{course}</div>
                              <div style={{ fontSize: 9, color: "var(--nc-blue)", opacity: 0.7 }}>{teacher?.split(" ")[0]}</div>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
