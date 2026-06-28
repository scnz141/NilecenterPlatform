import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Building2, Globe, Shield, Database, Palette, Users } from "lucide-react";
import { toast } from "sonner";

const SECTIONS = [
  { id: "general", label: "General", icon: Building2 },
  { id: "branches", label: "Branches", icon: Globe },
  { id: "roles", label: "Roles & Permissions", icon: Shield },
  { id: "integrations", label: "Integrations", icon: Database },
  { id: "appearance", label: "Appearance", icon: Palette },
];

export default function Settings() {
  const [section, setSection] = useState("general");
  const inputStyle = { width: "100%", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 7, fontSize: 13, color: "var(--foreground)", background: "var(--background)", outline: "none", boxSizing: "border-box" as const };
  const labelStyle = { fontSize: 12, fontWeight: 500, color: "var(--foreground)", marginBottom: 5, display: "block" as const };

  return (
    <DashboardLayout>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.025em", color: "var(--foreground)" }}>Settings</h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 3 }}>Configure platform settings, branches, and integrations</p>
      </div>

      <div style={{ display: "flex", gap: 20 }}>
        <div style={{ width: 200, flexShrink: 0 }}>
          <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", background: "var(--card)", padding: "6px 8px" }}>
            {SECTIONS.map(s => {
              const Icon = s.icon;
              return (
                <button key={s.id} onClick={() => setSection(s.id)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 8px", borderRadius: 6, fontSize: 12, fontWeight: section === s.id ? 500 : 400, cursor: "pointer", border: "none", background: section === s.id ? "var(--muted)" : "transparent", color: section === s.id ? "var(--foreground)" : "var(--muted-foreground)", textAlign: "left" }}>
                  <Icon size={13} /> {s.label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ flex: 1, border: "1px solid var(--border)", borderRadius: 10, background: "var(--card)", overflow: "hidden" }}>
          {section === "general" && (
            <div>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>General Settings</div>
                <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>Basic platform configuration</div>
              </div>
              <div style={{ padding: "20px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                  <div>
                    <label style={labelStyle}>Institution Name</label>
                    <input defaultValue="Nile Center for Arabic & Islamic Studies" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Short Name</label>
                    <input defaultValue="Nile Center" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Contact Email</label>
                    <input defaultValue="contact@nilelearn.local" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Contact Phone</label>
                    <input defaultValue="+20 100 000 0000" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Academic Year</label>
                    <select style={inputStyle}>
                      <option>2024–2025</option>
                      <option>2025–2026</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Default Currency</label>
                    <select style={inputStyle}>
                      <option>EGP — Egyptian Pound</option>
                      <option>USD — US Dollar</option>
                    </select>
                  </div>
                </div>
                <button onClick={() => toast.success("Settings saved")} style={{ padding: "8px 18px", background: "var(--foreground)", color: "var(--background)", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>Save Settings</button>
              </div>
            </div>
          )}

          {section === "branches" && (
            <div>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>Branch Management</div>
                  <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>Manage all center branches and locations</div>
                </div>
                <button onClick={() => toast.info("Add branch")} style={{ padding: "6px 12px", background: "var(--foreground)", color: "var(--background)", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: "pointer" }}>Add Branch</button>
              </div>
              <div style={{ padding: "16px 20px" }}>
                {[
                  { name: "Branch 1 — Cairo", address: "12 Nile Street, Cairo", admin: "Eslam El-Naggar", students: 245, status: "active" },
                  { name: "Branch 2 — Alexandria", address: "5 Corniche Road, Alexandria", admin: "Radwa Osama", students: 180, status: "active" },
                  { name: "Online Branch", address: "Virtual — Zoom/Moodle", admin: "Sara Mostafa", students: 312, status: "active" },
                ].map((b, i) => (
                  <div key={b.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", border: "1px solid var(--border)", borderRadius: 8, marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>{b.name}</div>
                      <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>{b.address} · {b.students} students · Admin: {b.admin}</div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 4, background: "var(--nc-green-light)", color: "var(--nc-green)" }}>{b.status}</span>
                      <button onClick={() => toast.info(`Edit ${b.name}`)} style={{ padding: "4px 10px", border: "1px solid var(--border)", borderRadius: 5, fontSize: 11, background: "transparent", color: "var(--foreground)", cursor: "pointer" }}>Edit</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {section === "roles" && (
            <div>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>Roles & Permissions</div>
                <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>Define what each role can access and modify</div>
              </div>
              <div style={{ padding: "16px 20px" }}>
                {[
                  { role: "Head of Department", users: 1, color: "#10B981", permissions: ["Full access", "User management", "Financial reports", "Settings"] },
                  { role: "Branch Admin", users: 2, color: "#3B82F6", permissions: ["Branch management", "Student enrollment", "Payments", "Reports"] },
                  { role: "Registrar", users: 3, color: "#8B5CF6", permissions: ["Student registration", "Enrollment approval", "Payments", "Attendance"] },
                  { role: "Teacher", users: 8, color: "#F59E0B", permissions: ["Class management", "Attendance marking", "Grade entry", "Messages"] },
                  { role: "Accountant", users: 2, color: "#EF4444", permissions: ["Payment processing", "Financial reports", "Invoicing"] },
                  { role: "Student", users: 620, color: "#6B7280", permissions: ["View courses", "View grades", "View attendance", "Messages"] },
                ].map(r => (
                  <div key={r.role} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "12px 14px", border: "1px solid var(--border)", borderRadius: 8, marginBottom: 8 }}>
                    <div style={{ display: "flex", gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: r.color + "18", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Users size={13} style={{ color: r.color }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>{r.role}</div>
                        <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>{r.users} user{r.users !== 1 ? "s" : ""}</div>
                        <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                          {r.permissions.map(p => (
                            <span key={p} style={{ fontSize: 10, padding: "1px 6px", borderRadius: 3, background: r.color + "12", color: r.color }}>{p}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <button onClick={() => toast.info(`Edit ${r.role} permissions`)} style={{ padding: "4px 10px", border: "1px solid var(--border)", borderRadius: 5, fontSize: 11, background: "transparent", color: "var(--foreground)", cursor: "pointer", flexShrink: 0 }}>Edit</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {section === "integrations" && (
            <div>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>Integrations</div>
                <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>Connect external services and platforms</div>
              </div>
              <div style={{ padding: "16px 20px" }}>
                {[
                  { name: "Moodle LMS", desc: "Learning management system for course delivery", url: "nilecenter.online", status: "connected", color: "#F59E0B" },
                  { name: "WhatsApp Business", desc: "Send automated notifications to students", status: "disconnected", color: "#10B981" },
                  { name: "Zoom", desc: "Online class delivery for remote students", status: "connected", color: "#3B82F6" },
                  { name: "Google Calendar", desc: "Sync class schedules with Google Calendar", status: "disconnected", color: "#EF4444" },
                ].map(int => (
                  <div key={int.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", border: "1px solid var(--border)", borderRadius: 8, marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: int.color + "18", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Database size={14} style={{ color: int.color }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>{int.name}</div>
                        <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 1 }}>{int.desc}</div>
                        {int.url && <div style={{ fontSize: 10, color: "var(--nc-blue)", marginTop: 1 }}>{int.url}</div>}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 4, background: int.status === "connected" ? "var(--nc-green-light)" : "var(--muted)", color: int.status === "connected" ? "var(--nc-green)" : "var(--muted-foreground)" }}>{int.status}</span>
                      <button onClick={() => toast.info(int.status === "connected" ? `Disconnect ${int.name}` : `Connect ${int.name}`)} style={{ padding: "4px 10px", border: "1px solid var(--border)", borderRadius: 5, fontSize: 11, background: "transparent", color: "var(--foreground)", cursor: "pointer" }}>
                        {int.status === "connected" ? "Configure" : "Connect"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {section === "appearance" && (
            <div>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>Appearance</div>
                <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>Customize the platform's visual appearance</div>
              </div>
              <div style={{ padding: "20px" }}>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Theme</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {["Light", "Dark", "System"].map(t => (
                      <button key={t} onClick={() => toast.info(`Theme: ${t}`)} style={{ padding: "6px 16px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12, background: t === "Light" ? "var(--foreground)" : "transparent", color: t === "Light" ? "var(--background)" : "var(--foreground)", cursor: "pointer" }}>{t}</button>
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Accent Color</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {["#3B82F6", "#10B981", "#8B5CF6", "#F59E0B", "#EF4444", "#06B6D4"].map(c => (
                      <div key={c} onClick={() => toast.info(`Color: ${c}`)} style={{ width: 24, height: 24, borderRadius: "50%", background: c, cursor: "pointer", border: c === "#3B82F6" ? "2px solid var(--foreground)" : "2px solid transparent" }} />
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Sidebar Density</label>
                  <select style={inputStyle}>
                    <option>Comfortable</option>
                    <option>Compact</option>
                  </select>
                </div>
                <button onClick={() => toast.success("Appearance saved")} style={{ padding: "8px 18px", background: "var(--foreground)", color: "var(--background)", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>Save Appearance</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
