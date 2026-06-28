import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Search, Plus, Users, BookOpen, ArrowRight, Filter } from "lucide-react";
import { toast } from "sonner";

const COURSES = [
  { id: "C-001", name: "Standard Arabic", level: "L1–L5", category: "Arabic Language", students: 1240, teacher: "Ahmed Hassan", branch: "B1 + Online", status: "active", fee: "EGP 2,400", sessions: "3x/week", color: "#3B82F6" },
  { id: "C-002", name: "Quran Memorization", level: "Juz 1–30", category: "Quran & Tajweed", students: 980, teacher: "Fatima Al-Zahra", branch: "All", status: "active", fee: "EGP 1,800", sessions: "5x/week", color: "#10B981" },
  { id: "C-003", name: "Islamic Fiqh", level: "Fundamentals", category: "Islamic Studies", students: 560, teacher: "Omar Khalil", branch: "B2 + Online", status: "active", fee: "EGP 2,000", sessions: "2x/week", color: "#8B5CF6" },
  { id: "C-004", name: "Turkish Beginner", level: "A1–A2", category: "Turkish Language", students: 275, teacher: "Yusuf Ali", branch: "B1", status: "active", fee: "EGP 2,200", sessions: "3x/week", color: "#F59E0B" },
  { id: "C-005", name: "Academic English", level: "B1–B2", category: "English Language", students: 430, teacher: "Sara Mostafa", branch: "Online", status: "active", fee: "EGP 1,600", sessions: "3x/week", color: "#EF4444" },
  { id: "C-006", name: "Arabic Calligraphy", level: "Beginner–Advanced", category: "Arabic Arts", students: 180, teacher: "Nour Ibrahim", branch: "B1 + B2", status: "active", fee: "EGP 1,200", sessions: "2x/week", color: "#06B6D4" },
  { id: "C-007", name: "Quran Tajweed", level: "Rules & Practice", category: "Quran & Tajweed", students: 640, teacher: "Hassan Al-Amin", branch: "All", status: "active", fee: "EGP 1,600", sessions: "4x/week", color: "#10B981" },
  { id: "C-008", name: "Arabic Teacher Training", level: "Methodology", category: "Teacher Training", students: 180, teacher: "Mariam Youssef", branch: "Online", status: "active", fee: "EGP 3,200", sessions: "2x/week", color: "#EC4899" },
];

const CATEGORIES = ["All", "Arabic Language", "Quran & Tajweed", "Islamic Studies", "Turkish Language", "English Language", "Arabic Arts", "Teacher Training"];

const STUDENT_NUMBERS = [
  { course: "Standard Arabic", b1: 480, b2: 320, online: 440, total: 1240 },
  { course: "Quran Memorization", b1: 280, b2: 200, online: 500, total: 980 },
  { course: "Islamic Fiqh", b1: 180, b2: 180, online: 200, total: 560 },
  { course: "Turkish Beginner", b1: 275, b2: 0, online: 0, total: 275 },
  { course: "Academic English", b1: 0, b2: 0, online: 430, total: 430 },
  { course: "Arabic Calligraphy", b1: 90, b2: 90, online: 0, total: 180 },
];

const TABS = [
  { id: "catalog", label: "Course Catalog" },
  { id: "pending", label: "Pending Students", badge: 12 },
  { id: "numbers", label: "Student Numbers" },
];

export default function Courses() {
  const [tab, setTab] = useState("catalog");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");

  const filtered = COURSES.filter(c =>
    (category === "All" || c.category === category) &&
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.025em", color: "var(--foreground)" }}>Courses</h1>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 3 }}>Manage course catalog, enrollments, and student numbers</p>
        </div>
        <button onClick={() => toast.info("Add course — coming soon")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", background: "var(--foreground)", color: "var(--background)", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
          <Plus size={14} /> Add Course
        </button>
      </div>

      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", marginBottom: 20 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "8px 14px", fontSize: 13, fontWeight: tab === t.id ? 500 : 400, cursor: "pointer", border: "none", background: "transparent",
            color: tab === t.id ? "var(--foreground)" : "var(--muted-foreground)",
            borderBottom: `2px solid ${tab === t.id ? "var(--foreground)" : "transparent"}`,
            marginBottom: -1, display: "flex", alignItems: "center", gap: 6,
          }}>
            {t.label}
            {t.badge && <span style={{ fontSize: 10, fontWeight: 600, background: "var(--nc-amber-light)", color: "oklch(0.55 0.16 75)", padding: "1px 5px", borderRadius: 99 }}>{t.badge}</span>}
          </button>
        ))}
      </div>

      {tab === "catalog" && (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", background: "var(--muted)", borderRadius: 6, flex: 1, maxWidth: 260 }}>
              <Search size={13} style={{ color: "var(--muted-foreground)" }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search courses..." style={{ background: "transparent", border: "none", outline: "none", fontSize: 13, color: "var(--foreground)", width: "100%" }} />
            </div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {CATEGORIES.map(c => (
                <button key={c} onClick={() => setCategory(c)} style={{
                  padding: "5px 10px", borderRadius: 5, fontSize: 11, fontWeight: 500, cursor: "pointer", border: "1px solid",
                  borderColor: category === c ? "var(--foreground)" : "var(--border)",
                  background: category === c ? "var(--foreground)" : "transparent",
                  color: category === c ? "var(--background)" : "var(--muted-foreground)",
                  transition: "all 100ms",
                }}>{c}</button>
              ))}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 10 }}>
            {filtered.map(c => (
              <div key={c.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "18px 20px", background: "var(--card)", cursor: "pointer", transition: "box-shadow 150ms" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 16px oklch(0 0 0 / 0.06)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: c.color, background: c.color + "18", padding: "2px 8px", borderRadius: 4 }}>{c.category}</span>
                  <span style={{ fontSize: 10, fontWeight: 500, color: "var(--nc-green)", background: "var(--nc-green-light)", padding: "2px 6px", borderRadius: 4 }}>Active</span>
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)", marginBottom: 3 }}>{c.name}</div>
                <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 14 }}>{c.level} · {c.sessions}</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--muted-foreground)" }}>
                    <Users size={12} />
                    {c.students.toLocaleString()} students
                  </div>
                  <div style={{ fontWeight: 600, color: "var(--foreground)" }}>{c.fee}</div>
                </div>
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)", fontSize: 12, color: "var(--muted-foreground)" }}>
                  {c.teacher} · {c.branch}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "pending" && (
        <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", background: "var(--card)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Student", "Course", "Branch", "Applied", "Actions"].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { name: "Ahmad Karimi", course: "Standard Arabic L2", branch: "B1", date: "Today" },
                { name: "Nadia Benali", course: "Quran Tajweed", branch: "Online", date: "Today" },
                { name: "Tariq Osman", course: "Islamic Studies", branch: "B2", date: "Yesterday" },
                { name: "Layla Hassan", course: "Turkish Intermediate", branch: "B1", date: "Yesterday" },
              ].map((s, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--muted)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  <td style={{ padding: "10px 14px", fontWeight: 500, color: "var(--foreground)" }}>{s.name}</td>
                  <td style={{ padding: "10px 14px", color: "var(--foreground)" }}>{s.course}</td>
                  <td style={{ padding: "10px 14px" }}><span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, background: "var(--muted)", color: "var(--muted-foreground)" }}>{s.branch}</span></td>
                  <td style={{ padding: "10px 14px", color: "var(--muted-foreground)", fontSize: 12 }}>{s.date}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => toast.success("Approved")} style={{ padding: "4px 10px", borderRadius: 5, fontSize: 11, fontWeight: 500, background: "var(--nc-green-light)", color: "var(--nc-green)", border: "none", cursor: "pointer" }}>Approve</button>
                      <button onClick={() => toast.error("Rejected")} style={{ padding: "4px 10px", borderRadius: 5, fontSize: 11, fontWeight: 500, background: "var(--nc-red-light)", color: "var(--nc-red)", border: "none", cursor: "pointer" }}>Reject</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "numbers" && (
        <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", background: "var(--card)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Course", "Branch 1", "Branch 2", "Online", "Total"].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {STUDENT_NUMBERS.map((r, i) => (
                <tr key={r.course} style={{ borderBottom: i < STUDENT_NUMBERS.length - 1 ? "1px solid var(--border)" : "none" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--muted)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  <td style={{ padding: "12px 14px", fontWeight: 500, color: "var(--foreground)" }}>{r.course}</td>
                  <td style={{ padding: "12px 14px", color: "var(--foreground)" }}>{r.b1 || "—"}</td>
                  <td style={{ padding: "12px 14px", color: "var(--foreground)" }}>{r.b2 || "—"}</td>
                  <td style={{ padding: "12px 14px", color: "var(--foreground)" }}>{r.online || "—"}</td>
                  <td style={{ padding: "12px 14px", fontWeight: 700, color: "var(--foreground)" }}>{r.total.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardLayout>
  );
}
