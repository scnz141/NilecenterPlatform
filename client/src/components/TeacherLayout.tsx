import { useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import {
  LayoutDashboard, BookOpen, Users, CheckSquare, BarChart2,
  Calendar, MessageSquare, Bell, User, LogOut, Menu, Globe, Briefcase
} from "lucide-react";

const NAV = [
  { label: "Dashboard", href: "/teacher", icon: LayoutDashboard },
  { label: "My Classes", href: "/teacher/classes", icon: BookOpen },
  { label: "Attendance", href: "/teacher/attendance", icon: CheckSquare },
  { label: "Scores & Grades", href: "/teacher/scores", icon: BarChart2 },
  { label: "Schedule", href: "/teacher/schedule", icon: Calendar },
  { label: "Messages", href: "/messages", icon: MessageSquare },
  { label: "Notifications", href: "/notifications", icon: Bell },
  { label: "Profile", href: "/profile", icon: User },
];

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const SidebarInner = () => (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div style={{ padding: "16px 14px 12px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        <Link href="/teacher">
          <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: "var(--nc-amber)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Briefcase size={13} style={{ color: "white" }} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--foreground)" }}>Nile Center</div>
              <div style={{ fontSize: 10, color: "var(--muted-foreground)", letterSpacing: "0.04em" }}>TEACHER PORTAL</div>
            </div>
          </div>
        </Link>
      </div>

      <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        <div style={{ padding: "8px 10px", borderRadius: 8, background: "oklch(0.97 0.02 80)", border: "1px solid oklch(0.88 0.05 80)" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "oklch(0.35 0.12 80)" }}>Ahmed Hassan</div>
          <div style={{ fontSize: 10, color: "oklch(0.5 0.08 80)", marginTop: 1 }}>TCH-012 · Arabic Language Dept.</div>
        </div>
      </div>

      <nav style={{ flex: 1, overflowY: "auto", padding: "8px 8px", display: "flex", flexDirection: "column", gap: 1 }}>
        {NAV.map(item => {
          const Icon = item.icon;
          const active = location === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <div style={{
                display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 6,
                fontSize: 13, fontWeight: active ? 500 : 400, cursor: "pointer",
                color: active ? "var(--foreground)" : "var(--muted-foreground)",
                background: active ? "var(--muted)" : "transparent",
                transition: "background 100ms, color 100ms",
              }}
                onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = "var(--muted)"; (e.currentTarget as HTMLElement).style.color = "var(--foreground)"; } }}
                onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--muted-foreground)"; } }}
              >
                <Icon size={14} style={{ flexShrink: 0, opacity: active ? 1 : 0.65 }} />
                <span>{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      <div style={{ borderTop: "1px solid var(--border)", flexShrink: 0 }}>
        <div style={{ padding: "6px 8px" }}>
          <a href="https://nilecenter.online" target="_blank" rel="noopener noreferrer" style={{
            display: "flex", alignItems: "center", gap: 7, padding: "5px 7px", borderRadius: 5,
            fontSize: 13, color: "var(--muted-foreground)", textDecoration: "none", transition: "background 100ms",
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--muted)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            <Globe size={14} style={{ flexShrink: 0, opacity: 0.65 }} />
            <span>Moodle LMS</span>
            <span style={{ marginLeft: "auto", fontSize: 10, background: "oklch(0.93 0.03 80)", color: "oklch(0.35 0.12 80)", padding: "1px 5px", borderRadius: 3, fontWeight: 500 }}>↗</span>
          </a>
        </div>
        <div style={{ padding: "10px 12px", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--nc-amber)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: "white" }}>AH</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Ahmed Hassan</div>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Teacher</div>
          </div>
          <Link href="/login">
            <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", display: "flex", padding: 3, borderRadius: 4 }}
              onClick={() => toast.info("Signed out")}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--foreground)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--muted-foreground)"; }}
            >
              <LogOut size={13} />
            </button>
          </Link>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--background)" }}>
      <aside style={{ width: 220, minWidth: 220, height: "100vh", position: "sticky", top: 0, background: "var(--sidebar)", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column" }}>
        <SidebarInner />
      </aside>
      {mobileOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50 }}>
          <div style={{ position: "absolute", inset: 0, background: "oklch(0 0 0 / 0.3)" }} onClick={() => setMobileOpen(false)} />
          <aside style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 220, background: "var(--sidebar)", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column" }}>
            <SidebarInner />
          </aside>
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <header style={{ height: 52, minHeight: 52, borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", padding: "0 20px", gap: 10, background: "var(--background)", position: "sticky", top: 0, zIndex: 10 }}>
          <button onClick={() => setMobileOpen(true)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", display: "flex", padding: 4 }}>
            <Menu size={16} />
          </button>
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Link href="/notifications">
              <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", display: "flex", padding: 6, borderRadius: 6, position: "relative" }}>
                <Bell size={15} />
                <span style={{ position: "absolute", top: 5, right: 5, width: 6, height: 6, borderRadius: "50%", background: "var(--nc-amber)" }} />
              </button>
            </Link>
            <Link href="/profile">
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--nc-amber)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "white" }}>AH</span>
              </div>
            </Link>
          </div>
        </header>
        <main style={{ flex: 1, overflowY: "auto", padding: "28px 28px" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
