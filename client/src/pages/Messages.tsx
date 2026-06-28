import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Search, Pencil, Star, Trash2, Send, Paperclip, ChevronLeft } from "lucide-react";
import { toast } from "sonner";

const THREADS = [
  { id: 1, from: "Ahmed Hassan", avatar: "AH", subject: "Class schedule change for Arabic L3", preview: "I wanted to let you know that next Monday's class will be moved to...", time: "10:24 AM", unread: true, starred: false },
  { id: 2, from: "Radwa Osama", avatar: "RO", subject: "New student registration — Khalid Ibrahim", preview: "A new student has submitted their registration form and is awaiting approval...", time: "09:15 AM", unread: true, starred: true },
  { id: 3, from: "System", avatar: "SY", subject: "Monthly report ready for June 2025", preview: "Your monthly performance report for June 2025 is now available for download...", time: "Yesterday", unread: false, starred: false },
  { id: 4, from: "Omar Khalil", avatar: "OK", subject: "Request for additional study materials", preview: "Dear admin, I would like to request additional Fiqh textbooks for the upcoming semester...", time: "Jun 24", unread: false, starred: false },
  { id: 5, from: "Fatima Al-Zahra", avatar: "FA", subject: "Attendance report — Quran class", preview: "Please find attached the attendance report for the Quran Memorization class for this week...", time: "Jun 23", unread: false, starred: true },
];

const AVATAR_COLORS: Record<string, string> = { AH: "#3B82F6", RO: "#8B5CF6", SY: "#6B7280", OK: "#10B981", FA: "#F59E0B" };

export default function Messages() {
  const [selected, setSelected] = useState<number | null>(null);
  const [composing, setComposing] = useState(false);
  const [folder, setFolder] = useState("inbox");
  const [reply, setReply] = useState("");

  const thread = THREADS.find(t => t.id === selected);

  return (
    <DashboardLayout>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.025em", color: "var(--foreground)" }}>Messages</h1>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 3 }}>Internal communication and notifications</p>
        </div>
        <button onClick={() => setComposing(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", background: "var(--foreground)", color: "var(--background)", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
          <Pencil size={13} /> Compose
        </button>
      </div>

      <div style={{ display: "flex", gap: 12, height: "calc(100vh - 200px)", minHeight: 500 }}>
        {/* Sidebar */}
        <div style={{ width: 200, flexShrink: 0 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {[
              { id: "inbox", label: "Inbox", count: 2 },
              { id: "starred", label: "Starred", count: 0 },
              { id: "sent", label: "Sent", count: 0 },
              { id: "trash", label: "Trash", count: 0 },
            ].map(f => (
              <button key={f.id} onClick={() => setFolder(f.id)} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 10px", borderRadius: 6, fontSize: 13, fontWeight: folder === f.id ? 500 : 400, cursor: "pointer", border: "none",
                background: folder === f.id ? "var(--muted)" : "transparent",
                color: folder === f.id ? "var(--foreground)" : "var(--muted-foreground)",
                textAlign: "left",
              }}>
                {f.label}
                {f.count > 0 && <span style={{ fontSize: 10, fontWeight: 700, background: "var(--nc-blue)", color: "white", padding: "1px 5px", borderRadius: 99 }}>{f.count}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Thread list */}
        <div style={{ flex: selected ? "0 0 320px" : 1, border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", background: "var(--card)", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 8px", background: "var(--muted)", borderRadius: 6 }}>
              <Search size={12} style={{ color: "var(--muted-foreground)" }} />
              <input placeholder="Search messages..." style={{ background: "transparent", border: "none", outline: "none", fontSize: 12, color: "var(--foreground)", width: "100%" }} />
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {THREADS.map((t, i) => (
              <div key={t.id} onClick={() => setSelected(t.id)} style={{
                padding: "12px 14px", borderBottom: i < THREADS.length - 1 ? "1px solid var(--border)" : "none", cursor: "pointer",
                background: selected === t.id ? "var(--muted)" : t.unread ? "oklch(0.99 0.005 260)" : "transparent",
                transition: "background 80ms",
              }}
                onMouseEnter={e => { if (selected !== t.id) (e.currentTarget as HTMLElement).style.background = "var(--muted)"; }}
                onMouseLeave={e => { if (selected !== t.id) (e.currentTarget as HTMLElement).style.background = t.unread ? "oklch(0.99 0.005 260)" : "transparent"; }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: AVATAR_COLORS[t.avatar] || "#6B7280", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: "white" }}>{t.avatar}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                      <span style={{ fontSize: 12, fontWeight: t.unread ? 600 : 500, color: "var(--foreground)" }}>{t.from}</span>
                      <span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>{t.time}</span>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: t.unread ? 500 : 400, color: "var(--foreground)", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.subject}</div>
                    <div style={{ fontSize: 11, color: "var(--muted-foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.preview}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Message view */}
        {selected && thread && (
          <div style={{ flex: 1, border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", background: "var(--card)", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
              <button onClick={() => setSelected(null)} style={{ padding: 4, borderRadius: 5, background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)" }}><ChevronLeft size={16} /></button>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>{thread.subject}</div>
                <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 1 }}>From: {thread.from} · {thread.time}</div>
              </div>
              <button onClick={() => toast.info("Starred")} style={{ padding: 5, borderRadius: 5, background: "none", border: "none", cursor: "pointer", color: thread.starred ? "#F59E0B" : "var(--muted-foreground)" }}><Star size={14} /></button>
              <button onClick={() => toast.info("Deleted")} style={{ padding: 5, borderRadius: 5, background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)" }}><Trash2 size={14} /></button>
            </div>
            <div style={{ flex: 1, padding: "20px 18px", overflowY: "auto", fontSize: 13, color: "var(--foreground)", lineHeight: 1.7 }}>
              <p>Dear Admin,</p>
              <p style={{ marginTop: 12 }}>{thread.preview} Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.</p>
              <p style={{ marginTop: 12 }}>Please let me know if you have any questions or concerns regarding this matter.</p>
              <p style={{ marginTop: 12 }}>Best regards,<br />{thread.from}</p>
            </div>
            <div style={{ padding: "12px 18px", borderTop: "1px solid var(--border)" }}>
              <textarea value={reply} onChange={e => setReply(e.target.value)} placeholder="Write a reply..." style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 13, color: "var(--foreground)", background: "var(--background)", outline: "none", resize: "none", height: 70, boxSizing: "border-box", fontFamily: "inherit" }} />
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                <button onClick={() => { toast.success("Reply sent"); setReply(""); }} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 14px", background: "var(--foreground)", color: "var(--background)", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
                  <Send size={12} /> Send Reply
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Compose modal */}
      {composing && (
        <div style={{ position: "fixed", inset: 0, background: "oklch(0 0 0 / 0.3)", display: "flex", alignItems: "flex-end", justifyContent: "flex-end", padding: 24, zIndex: 50 }}>
          <div style={{ width: 480, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", boxShadow: "0 20px 60px oklch(0 0 0 / 0.15)" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>New Message</span>
              <button onClick={() => setComposing(false)} style={{ padding: 4, borderRadius: 4, background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", fontSize: 16 }}>×</button>
            </div>
            <div style={{ padding: "12px 16px" }}>
              <input placeholder="To:" style={{ width: "100%", padding: "6px 0", border: "none", borderBottom: "1px solid var(--border)", outline: "none", fontSize: 13, color: "var(--foreground)", background: "transparent", marginBottom: 8, boxSizing: "border-box" }} />
              <input placeholder="Subject:" style={{ width: "100%", padding: "6px 0", border: "none", borderBottom: "1px solid var(--border)", outline: "none", fontSize: 13, color: "var(--foreground)", background: "transparent", marginBottom: 8, boxSizing: "border-box" }} />
              <textarea placeholder="Message..." style={{ width: "100%", padding: "8px 0", border: "none", outline: "none", fontSize: 13, color: "var(--foreground)", background: "transparent", resize: "none", height: 140, boxSizing: "border-box", fontFamily: "inherit" }} />
            </div>
            <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button style={{ padding: 6, borderRadius: 5, background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)" }}><Paperclip size={14} /></button>
              <button onClick={() => { toast.success("Message sent"); setComposing(false); }} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 14px", background: "var(--foreground)", color: "var(--background)", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
                <Send size={12} /> Send
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
