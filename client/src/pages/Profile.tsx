import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Camera, Shield, Bell, Globe, Key } from "lucide-react";
import { toast } from "sonner";

const TABS = [
  { id: "personal", label: "Personal Info" },
  { id: "security", label: "Security" },
  { id: "notifications", label: "Notifications" },
  { id: "preferences", label: "Preferences" },
];

export default function Profile() {
  const [tab, setTab] = useState("personal");
  const [name, setName] = useState("Eslam El-Naggar");
  const [email, setEmail] = useState("hod.demo@nilelearn.local");
  const [phone, setPhone] = useState("+20 100 000 0000");
  const [notifications, setNotifications] = useState({ email: true, sms: false, payments: true, attendance: true, reports: false });

  const inputStyle = { width: "100%", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 7, fontSize: 13, color: "var(--foreground)", background: "var(--background)", outline: "none", boxSizing: "border-box" as const };
  const labelStyle = { fontSize: 12, fontWeight: 500, color: "var(--foreground)", marginBottom: 5, display: "block" as const };

  return (
    <DashboardLayout>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.025em", color: "var(--foreground)" }}>Profile</h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 3 }}>Manage your account settings and preferences</p>
      </div>

      <div style={{ display: "flex", gap: 20 }}>
        {/* Sidebar */}
        <div style={{ width: 200, flexShrink: 0 }}>
          <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", background: "var(--card)", marginBottom: 12 }}>
            <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", alignItems: "center", borderBottom: "1px solid var(--border)" }}>
              <div style={{ position: "relative", marginBottom: 10 }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#3B82F6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 18, fontWeight: 700, color: "white" }}>EE</span>
                </div>
                <button onClick={() => toast.info("Upload photo")} style={{ position: "absolute", bottom: 0, right: 0, width: 18, height: 18, borderRadius: "50%", background: "var(--foreground)", border: "2px solid var(--card)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <Camera size={9} style={{ color: "var(--background)" }} />
                </button>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", textAlign: "center" }}>Eslam El-Naggar</div>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>Head of Department</div>
            </div>
            <div style={{ padding: "6px 8px" }}>
              {TABS.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 8px", borderRadius: 6, fontSize: 12, fontWeight: tab === t.id ? 500 : 400, cursor: "pointer", border: "none", background: tab === t.id ? "var(--muted)" : "transparent", color: tab === t.id ? "var(--foreground)" : "var(--muted-foreground)", textAlign: "left" }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, border: "1px solid var(--border)", borderRadius: 10, background: "var(--card)", overflow: "hidden" }}>
          {tab === "personal" && (
            <div>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>Personal Information</div>
                <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>Update your name, email, and contact details</div>
              </div>
              <div style={{ padding: "20px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                  <div>
                    <label style={labelStyle}>Full Name</label>
                    <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Email Address</label>
                    <input value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Phone Number</label>
                    <input value={phone} onChange={e => setPhone(e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Role</label>
                    <input value="Head of Department" readOnly style={{ ...inputStyle, background: "var(--muted)", color: "var(--muted-foreground)" }} />
                  </div>
                  <div>
                    <label style={labelStyle}>Branch</label>
                    <select style={inputStyle}>
                      <option>All Branches</option>
                      <option>Branch 1</option>
                      <option>Branch 2</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Language</label>
                    <select style={inputStyle}>
                      <option>English</option>
                      <option>Arabic</option>
                    </select>
                  </div>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Bio</label>
                  <textarea placeholder="Write a short bio..." style={{ ...inputStyle, resize: "none", height: 80, fontFamily: "inherit" }} />
                </div>
                <button onClick={() => toast.success("Profile updated")} style={{ padding: "8px 18px", background: "var(--foreground)", color: "var(--background)", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>Save Changes</button>
              </div>
            </div>
          )}

          {tab === "security" && (
            <div>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>Security Settings</div>
                <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>Manage your password and account security</div>
              </div>
              <div style={{ padding: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", border: "1px solid var(--border)", borderRadius: 8, marginBottom: 12 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: "#3B82F618", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Key size={14} style={{ color: "#3B82F6" }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)" }}>Change Password</div>
                    <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Last changed 3 months ago</div>
                  </div>
                  <button onClick={() => toast.info("Change password flow")} style={{ padding: "5px 12px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12, background: "transparent", color: "var(--foreground)", cursor: "pointer" }}>Change</button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
                  <div>
                    <label style={labelStyle}>Current Password</label>
                    <input type="password" placeholder="••••••••" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>New Password</label>
                    <input type="password" placeholder="••••••••" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Confirm New Password</label>
                    <input type="password" placeholder="••••••••" style={inputStyle} />
                  </div>
                </div>
                <button onClick={() => toast.success("Password updated")} style={{ padding: "8px 18px", background: "var(--foreground)", color: "var(--background)", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>Update Password</button>
              </div>
            </div>
          )}

          {tab === "notifications" && (
            <div>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>Notification Preferences</div>
                <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>Choose what notifications you receive</div>
              </div>
              <div style={{ padding: "20px" }}>
                {[
                  { key: "email", label: "Email Notifications", desc: "Receive notifications via email" },
                  { key: "sms", label: "SMS Notifications", desc: "Receive notifications via SMS" },
                  { key: "payments", label: "Payment Alerts", desc: "Notify when a payment is received or overdue" },
                  { key: "attendance", label: "Attendance Reports", desc: "Daily attendance summary notifications" },
                  { key: "reports", label: "Monthly Reports", desc: "Monthly performance and financial reports" },
                ].map(n => (
                  <div key={n.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)" }}>{n.label}</div>
                      <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>{n.desc}</div>
                    </div>
                    <div
                      onClick={() => setNotifications(prev => ({ ...prev, [n.key]: !prev[n.key as keyof typeof prev] }))}
                      style={{ width: 36, height: 20, borderRadius: 10, background: notifications[n.key as keyof typeof notifications] ? "var(--nc-blue)" : "var(--muted)", cursor: "pointer", position: "relative", transition: "background 150ms" }}
                    >
                      <div style={{ position: "absolute", top: 2, left: notifications[n.key as keyof typeof notifications] ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "white", transition: "left 150ms", boxShadow: "0 1px 3px oklch(0 0 0 / 0.2)" }} />
                    </div>
                  </div>
                ))}
                <button onClick={() => toast.success("Preferences saved")} style={{ marginTop: 16, padding: "8px 18px", background: "var(--foreground)", color: "var(--background)", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>Save Preferences</button>
              </div>
            </div>
          )}

          {tab === "preferences" && (
            <div>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>Display Preferences</div>
                <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>Customize your platform experience</div>
              </div>
              <div style={{ padding: "20px" }}>
                {[
                  { label: "Interface Language", options: ["English", "Arabic (العربية)"] },
                  { label: "Date Format", options: ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"] },
                  { label: "Time Format", options: ["12-hour (AM/PM)", "24-hour"] },
                  { label: "Currency Display", options: ["EGP (Egyptian Pound)", "USD (US Dollar)"] },
                ].map(p => (
                  <div key={p.label} style={{ marginBottom: 14 }}>
                    <label style={labelStyle}>{p.label}</label>
                    <select style={inputStyle}>
                      {p.options.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                ))}
                <button onClick={() => toast.success("Preferences saved")} style={{ padding: "8px 18px", background: "var(--foreground)", color: "var(--background)", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>Save Preferences</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
