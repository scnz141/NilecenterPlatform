import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Search, Plus, Download, Filter, ChevronDown, MoreHorizontal, CheckCircle2, AlertCircle, XCircle, Eye, Edit, Trash2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const STUDENTS = [
  { id: "STU-001", name: "Student Demo A", email: "student.a@nilelearn.local", phone: "+20 100 000 0001", course: "Standard Arabic L3", branch: "B1", status: "active", enrolled: "Jan 15, 2025", fees: "EGP 2,400", paid: true, avatar: "SA" },
  { id: "STU-002", name: "Student Demo B", email: "student.b@nilelearn.local", phone: "+20 100 000 0002", course: "Quran Memorization", branch: "Online", status: "active", enrolled: "Feb 3, 2025", fees: "EGP 1,800", paid: true, avatar: "SB" },
  { id: "STU-003", name: "Student Demo C", email: "student.c@nilelearn.local", phone: "+20 100 000 0003", course: "Islamic Fiqh", branch: "B2", status: "pending", enrolled: "Mar 10, 2025", fees: "EGP 2,000", paid: false, avatar: "SC" },
  { id: "STU-004", name: "Student Demo D", email: "student.d@nilelearn.local", phone: "+20 100 000 0004", course: "Turkish Beginner", branch: "B1", status: "active", enrolled: "Jan 28, 2025", fees: "EGP 2,200", paid: true, avatar: "SD" },
  { id: "STU-005", name: "Student Demo E", email: "student.e@nilelearn.local", phone: "+20 100 000 0005", course: "Academic English", branch: "Online", status: "pending", enrolled: "Apr 5, 2025", fees: "EGP 1,600", paid: false, avatar: "SE" },
  { id: "STU-006", name: "Student Demo F", email: "student.f@nilelearn.local", phone: "+20 100 000 0006", course: "Standard Arabic L1", branch: "B1", status: "active", enrolled: "Feb 14, 2025", fees: "EGP 2,400", paid: true, avatar: "SF" },
  { id: "STU-007", name: "Student Demo G", email: "student.g@nilelearn.local", phone: "+20 100 000 0007", course: "Arabic Calligraphy", branch: "B2", status: "inactive", enrolled: "Dec 1, 2024", fees: "EGP 1,200", paid: false, avatar: "SG" },
  { id: "STU-008", name: "Student Demo H", email: "student.h@nilelearn.local", phone: "+20 100 000 0008", course: "Quran Memorization", branch: "Online", status: "active", enrolled: "Mar 22, 2025", fees: "EGP 1,800", paid: true, avatar: "SH" },
];

const PENDING = [
  { id: "ENR-047", name: "Ahmad Karimi", course: "Standard Arabic L2", branch: "B1", date: "Today, 11:30", type: "New", fees: "EGP 2,400" },
  { id: "ENR-046", name: "Nadia Benali", course: "Quran Tajweed", branch: "Online", date: "Today, 09:15", type: "Transfer", fees: "EGP 1,800" },
  { id: "ENR-045", name: "Tariq Osman", course: "Islamic Studies", branch: "B2", date: "Yesterday", type: "New", fees: "EGP 2,000" },
  { id: "ENR-044", name: "Layla Hassan", course: "Turkish Intermediate", branch: "B1", date: "Yesterday", type: "Renewal", fees: "EGP 2,200" },
  { id: "ENR-043", name: "Bilal Chaudhry", course: "Academic English", branch: "Online", date: "2 days ago", type: "New", fees: "EGP 1,600" },
];

const AVATAR_COLORS = ["#3B82F6", "#8B5CF6", "#10B981", "#F59E0B", "#EF4444", "#06B6D4", "#EC4899", "#14B8A6"];

const FORM_FIELDS = [
  { label: "Full Name", key: "name", type: "text", placeholder: "Mohammed Al-Rashid" },
  { label: "Email Address", key: "email", type: "email", placeholder: "student.demo@nilelearn.local" },
  { label: "Phone Number", key: "phone", type: "tel", placeholder: "+20 100 000 0000" },
  { label: "Date of Birth", key: "dob", type: "date", placeholder: "" },
  { label: "Nationality", key: "nationality", type: "text", placeholder: "Egyptian" },
  { label: "National ID / Passport", key: "id", type: "text", placeholder: "29901010100000" },
];

function AllStudents() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const filtered = STUDENTS.filter(s =>
    (statusFilter === "all" || s.status === statusFilter) &&
    (s.name.toLowerCase().includes(search.toLowerCase()) || s.id.includes(search))
  );

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", background: "var(--muted)", borderRadius: 6, flex: 1, maxWidth: 280 }}>
          <Search size={13} style={{ color: "var(--muted-foreground)", flexShrink: 0 }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search students..." style={{ background: "transparent", border: "none", outline: "none", fontSize: 13, color: "var(--foreground)", width: "100%" }} />
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {["all", "active", "pending", "inactive"].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} style={{
              padding: "5px 10px", borderRadius: 5, fontSize: 12, fontWeight: 500, cursor: "pointer", border: "1px solid",
              borderColor: statusFilter === s ? "var(--foreground)" : "var(--border)",
              background: statusFilter === s ? "var(--foreground)" : "transparent",
              color: statusFilter === s ? "var(--background)" : "var(--muted-foreground)",
              transition: "all 100ms", textTransform: "capitalize",
            }}>{s}</button>
          ))}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button onClick={() => toast.info("Exporting...")} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12, fontWeight: 500, background: "transparent", color: "var(--foreground)", cursor: "pointer" }}>
            <Download size={13} /> Export
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", background: "var(--card)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["Student", "Course", "Branch", "Enrolled", "Fees", "Status", ""].map(h => (
                <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted-foreground)", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((s, i) => (
              <tr key={s.id} style={{ borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none", transition: "background 80ms" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--muted)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                <td style={{ padding: "10px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: AVATAR_COLORS[i % AVATAR_COLORS.length], display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: "white" }}>{s.avatar}</span>
                    </div>
                    <div>
                      <div style={{ fontWeight: 500, color: "var(--foreground)" }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{s.id}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: "10px 14px", color: "var(--foreground)" }}>{s.course}</td>
                <td style={{ padding: "10px 14px" }}>
                  <span style={{ fontSize: 11, fontWeight: 500, padding: "2px 7px", borderRadius: 4, background: "var(--muted)", color: "var(--muted-foreground)" }}>{s.branch}</span>
                </td>
                <td style={{ padding: "10px 14px", color: "var(--muted-foreground)", fontSize: 12 }}>{s.enrolled}</td>
                <td style={{ padding: "10px 14px" }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground)" }}>{s.fees}</div>
                  <div style={{ fontSize: 10, color: s.paid ? "var(--nc-green)" : "var(--nc-amber)", marginTop: 1 }}>{s.paid ? "Paid" : "Pending"}</div>
                </td>
                <td style={{ padding: "10px 14px" }}>
                  <span style={{
                    fontSize: 11, fontWeight: 500, padding: "2px 7px", borderRadius: 4,
                    background: s.status === "active" ? "var(--nc-green-light)" : s.status === "pending" ? "var(--nc-amber-light)" : "var(--muted)",
                    color: s.status === "active" ? "var(--nc-green)" : s.status === "pending" ? "oklch(0.55 0.16 75)" : "var(--muted-foreground)",
                  }}>{s.status}</span>
                </td>
                <td style={{ padding: "10px 14px" }}>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => toast.info(`Viewing ${s.name}`)} style={{ padding: 5, borderRadius: 4, background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)" }}>
                      <Eye size={13} />
                    </button>
                    <button onClick={() => toast.info(`Editing ${s.name}`)} style={{ padding: 5, borderRadius: 4, background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)" }}>
                      <Edit size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ padding: "12px 14px", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{filtered.length} of {STUDENTS.length} students</span>
          <div style={{ display: "flex", gap: 4 }}>
            {[1, 2, 3, "..."].map((p, i) => (
              <button key={i} style={{ width: 28, height: 28, borderRadius: 5, border: "1px solid", fontSize: 12, cursor: "pointer", borderColor: i === 0 ? "var(--foreground)" : "var(--border)", background: i === 0 ? "var(--foreground)" : "transparent", color: i === 0 ? "var(--background)" : "var(--muted-foreground)" }}>{p}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function RegisterStudent() {
  const [form, setForm] = useState<Record<string, string>>({});
  const [course, setCourse] = useState("");
  const [branch, setBranch] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await new Promise(r => setTimeout(r, 900));
    setLoading(false);
    toast.success("Student registered successfully");
  };

  return (
    <div style={{ maxWidth: 680 }}>
      <form onSubmit={handleSubmit}>
        <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", background: "var(--card)", marginBottom: 16 }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>Personal Information</div>
          </div>
          <div style={{ padding: "20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {FORM_FIELDS.map(f => (
              <div key={f.key}>
                <label style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground)", display: "block", marginBottom: 6 }}>{f.label}</label>
                <input type={f.type} placeholder={f.placeholder} value={form[f.key] || ""} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  style={{ width: "100%", padding: "7px 10px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 13, color: "var(--foreground)", background: "var(--background)", outline: "none", boxSizing: "border-box" }}
                  onFocus={e => { (e.target as HTMLInputElement).style.borderColor = "var(--foreground)"; }}
                  onBlur={e => { (e.target as HTMLInputElement).style.borderColor = "var(--border)"; }}
                />
              </div>
            ))}
          </div>
        </div>

        <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", background: "var(--card)", marginBottom: 16 }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>Enrollment Details</div>
          </div>
          <div style={{ padding: "20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground)", display: "block", marginBottom: 6 }}>Course</label>
              <select value={course} onChange={e => setCourse(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 13, color: "var(--foreground)", background: "var(--background)", outline: "none", boxSizing: "border-box" }}>
                <option value="">Select course...</option>
                {["Standard Arabic L1", "Standard Arabic L2", "Standard Arabic L3", "Quran Memorization", "Quran Tajweed", "Islamic Fiqh", "Turkish Beginner", "Academic English", "Arabic Calligraphy"].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground)", display: "block", marginBottom: 6 }}>Branch</label>
              <select value={branch} onChange={e => setBranch(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 13, color: "var(--foreground)", background: "var(--background)", outline: "none", boxSizing: "border-box" }}>
                <option value="">Select branch...</option>
                <option value="B1">Branch 1 — Cairo</option>
                <option value="B2">Branch 2 — Alexandria</option>
                <option value="Online">Online</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground)", display: "block", marginBottom: 6 }}>Start Date</label>
              <input type="date" style={{ width: "100%", padding: "7px 10px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 13, color: "var(--foreground)", background: "var(--background)", outline: "none", boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground)", display: "block", marginBottom: 6 }}>Fee Amount (EGP)</label>
              <input type="number" placeholder="2400" style={{ width: "100%", padding: "7px 10px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 13, color: "var(--foreground)", background: "var(--background)", outline: "none", boxSizing: "border-box" }} />
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button type="submit" disabled={loading} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 18px", background: "var(--foreground)", color: "var(--background)", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: "pointer", opacity: loading ? 0.7 : 1 }}>
            {loading ? <span style={{ width: 13, height: 13, border: "2px solid var(--background)", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin 0.6s linear infinite" }} /> : null}
            Register Student
          </button>
          <button type="button" style={{ padding: "8px 18px", border: "1px solid var(--border)", borderRadius: 7, fontSize: 13, fontWeight: 500, background: "transparent", color: "var(--foreground)", cursor: "pointer" }}>
            Cancel
          </button>
        </div>
      </form>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function PendingEnrollments() {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <div style={{ padding: "4px 10px", borderRadius: 99, background: "var(--nc-amber-light)", fontSize: 12, fontWeight: 600, color: "oklch(0.55 0.16 75)" }}>
          {PENDING.length} pending
        </div>
      </div>
      <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", background: "var(--card)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["ID", "Student", "Course", "Branch", "Type", "Date", "Fees", "Actions"].map(h => (
                <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted-foreground)", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PENDING.map((p, i) => (
              <tr key={p.id} style={{ borderBottom: i < PENDING.length - 1 ? "1px solid var(--border)" : "none" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--muted)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                <td style={{ padding: "10px 14px", fontSize: 11, color: "var(--muted-foreground)", fontFamily: "monospace" }}>{p.id}</td>
                <td style={{ padding: "10px 14px", fontWeight: 500, color: "var(--foreground)" }}>{p.name}</td>
                <td style={{ padding: "10px 14px", color: "var(--foreground)" }}>{p.course}</td>
                <td style={{ padding: "10px 14px" }}><span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, background: "var(--muted)", color: "var(--muted-foreground)" }}>{p.branch}</span></td>
                <td style={{ padding: "10px 14px" }}><span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, background: "var(--nc-blue-light)", color: "var(--nc-blue)" }}>{p.type}</span></td>
                <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--muted-foreground)" }}>{p.date}</td>
                <td style={{ padding: "10px 14px", fontSize: 12, fontWeight: 500, color: "var(--foreground)" }}>{p.fees}</td>
                <td style={{ padding: "10px 14px" }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => toast.success(`Approved ${p.name}`)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 5, fontSize: 11, fontWeight: 500, background: "var(--nc-green-light)", color: "var(--nc-green)", border: "none", cursor: "pointer" }}>
                      <CheckCircle2 size={11} /> Approve
                    </button>
                    <button onClick={() => toast.error(`Rejected ${p.name}`)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 5, fontSize: 11, fontWeight: 500, background: "var(--nc-red-light)", color: "var(--nc-red)", border: "none", cursor: "pointer" }}>
                      <XCircle size={11} /> Reject
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CourseReport() {
  const REPORT = [
    { course: "Standard Arabic", levels: 5, students: 1240, completion: 78, revenue: "EGP 42K" },
    { course: "Quran Memorization", levels: 3, students: 980, completion: 85, revenue: "EGP 31K" },
    { course: "Islamic Fiqh", levels: 2, students: 560, completion: 72, revenue: "EGP 18K" },
    { course: "Turkish Language", levels: 4, students: 275, completion: 65, revenue: "EGP 11K" },
    { course: "Academic English", levels: 3, students: 430, completion: 70, revenue: "EGP 14K" },
    { course: "Arabic Calligraphy", levels: 2, students: 180, completion: 90, revenue: "EGP 6K" },
  ];
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", background: "var(--card)" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            {["Course", "Levels", "Students", "Completion Rate", "Revenue"].map(h => (
              <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {REPORT.map((r, i) => (
            <tr key={r.course} style={{ borderBottom: i < REPORT.length - 1 ? "1px solid var(--border)" : "none" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--muted)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <td style={{ padding: "12px 14px", fontWeight: 500, color: "var(--foreground)" }}>{r.course}</td>
              <td style={{ padding: "12px 14px", color: "var(--muted-foreground)" }}>{r.levels}</td>
              <td style={{ padding: "12px 14px", fontWeight: 500, color: "var(--foreground)" }}>{r.students.toLocaleString()}</td>
              <td style={{ padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ flex: 1, height: 4, background: "var(--muted)", borderRadius: 99, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${r.completion}%`, background: "var(--nc-blue)", borderRadius: 99 }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 500, color: "var(--foreground)", width: 32 }}>{r.completion}%</span>
                </div>
              </td>
              <td style={{ padding: "12px 14px", fontWeight: 500, color: "var(--foreground)" }}>{r.revenue}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const TABS = [
  { id: "list", label: "All Students" },
  { id: "register", label: "Register Student" },
  { id: "pending", label: "Pending Enrollment", badge: 5 },
  { id: "course-report", label: "Course Report" },
];

export default function Students() {
  const [location] = useLocation();
  const activeTab = location.includes("/register") ? "register" : location.includes("/pending") ? "pending" : location.includes("/course-report") ? "course-report" : "list";
  const [tab, setTab] = useState(activeTab);

  return (
    <DashboardLayout>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.025em", color: "var(--foreground)" }}>Students</h1>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 3 }}>Manage student registrations, enrollments, and reports</p>
        </div>
        {tab === "list" && (
          <button onClick={() => setTab("register")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", background: "var(--foreground)", color: "var(--background)", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
            <Plus size={14} /> Register Student
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", marginBottom: 20, gap: 0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "8px 14px", fontSize: 13, fontWeight: tab === t.id ? 500 : 400, cursor: "pointer", border: "none", background: "transparent",
            color: tab === t.id ? "var(--foreground)" : "var(--muted-foreground)",
            borderBottom: `2px solid ${tab === t.id ? "var(--foreground)" : "transparent"}`,
            marginBottom: -1, display: "flex", alignItems: "center", gap: 6, transition: "color 100ms",
          }}>
            {t.label}
            {t.badge && <span style={{ fontSize: 10, fontWeight: 600, background: "var(--nc-amber-light)", color: "oklch(0.55 0.16 75)", padding: "1px 5px", borderRadius: 99 }}>{t.badge}</span>}
          </button>
        ))}
      </div>

      {tab === "list" && <AllStudents />}
      {tab === "register" && <RegisterStudent />}
      {tab === "pending" && <PendingEnrollments />}
      {tab === "course-report" && <CourseReport />}
    </DashboardLayout>
  );
}
