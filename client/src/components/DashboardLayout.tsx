import { useState } from "react";
import { Link, useLocation } from "wouter";

type NavItem = {
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  label: string;
  href: string;
  badge?: number;
  sub?: { label: string; href: string }[];
};
import {
  LayoutDashboard, Users, BookOpen, CalendarDays, CreditCard,
  MessageSquare, BarChart3, Clock, Settings, LogOut, Bell,
  Search, ChevronRight, Globe, Menu, X, GraduationCap, Building2
} from "lucide-react";
import { toast } from "sonner";

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "MAIN",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
      {
        icon: GraduationCap, label: "Students", href: "/students",
        sub: [
          { label: "All Students", href: "/students" },
          { label: "Register Student", href: "/students/register" },
          { label: "Pending Enrollment", href: "/students/pending" },
          { label: "Course Report", href: "/students/course-report" },
        ]
      },
      {
        icon: BookOpen, label: "Courses", href: "/courses",
        sub: [
          { label: "Course Catalog", href: "/courses" },
          { label: "Pending Students", href: "/courses/pending" },
          { label: "Student Numbers", href: "/courses/numbers" },
        ]
      },
      {
        icon: CalendarDays, label: "Classes", href: "/classes",
        sub: [
          { label: "All Classes", href: "/classes" },
          { label: "Attendance", href: "/classes/attendance" },
          { label: "Detailed Attendance", href: "/classes/attendance-detail" },
          { label: "Scores & Grades", href: "/classes/scores" },
        ]
      },
    ]
  },
  {
    label: "MANAGEMENT",
    items: [
      {
        icon: Users, label: "Users", href: "/users",
        sub: [
          { label: "Staff List", href: "/users" },
          { label: "Weekly Timetable", href: "/users/timetable" },
        ]
      },
      { icon: Clock, label: "Schedule", href: "/schedule" },
      {
        icon: CreditCard, label: "Payments", href: "/payments",
        sub: [
          { label: "Today's Payments", href: "/payments" },
          { label: "Payment History", href: "/payments/history" },
          { label: "Financial Summary", href: "/payments/summary" },
        ]
      },
      { icon: MessageSquare, label: "Messages", href: "/messages", badge: 3 },
      { icon: BarChart3, label: "Reports", href: "/reports" },
    ]
  },
  {
    label: "SYSTEM",
    items: [
      { icon: GraduationCap, label: "Student Portal", href: "/student-portal" },
      { icon: Bell, label: "Notifications", href: "/notifications", badge: 3 },
      { icon: Settings, label: "Settings", href: "/settings" },
    ]
  }
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [expanded, setExpanded] = useState<string[]>(["Students", "Courses", "Classes", "Payments"]);
  const [activeBranch, setActiveBranch] = useState("B1");
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggle = (label: string) =>
    setExpanded(prev => prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]);

  const isActive = (href: string) =>
    href === "/dashboard" ? location === href : location.startsWith(href);

  const SidebarInner = () => (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Logo */}
      <div style={{ height: 52, minHeight: 52, borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", padding: "0 14px", gap: 8, flexShrink: 0 }}>
        <div style={{ width: 22, height: 22, borderRadius: 5, background: "var(--foreground)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: "var(--background)", letterSpacing: 0 }}>NC</span>
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: "-0.02em" }}>Nile Center</span>
        {mobileOpen && (
          <button onClick={() => setMobileOpen(false)} style={{ marginLeft: "auto", color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer", display: "flex" }}>
            <X size={15} />
          </button>
        )}
      </div>

      {/* Branch switcher */}
      <div style={{ padding: "10px 10px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--muted-foreground)", marginBottom: 6, paddingLeft: 2 }}>Branch</div>
        <div style={{ display: "flex", gap: 4 }}>
          {["B1", "B2", "Online"].map(b => (
            <button key={b} onClick={() => setActiveBranch(b)} style={{
              flex: 1, padding: "4px 0", borderRadius: 4, fontSize: 11, fontWeight: 500, cursor: "pointer", border: "none", transition: "all 100ms",
              background: activeBranch === b ? "var(--foreground)" : "var(--muted)",
              color: activeBranch === b ? "var(--background)" : "var(--muted-foreground)",
            }}>{b}</button>
          ))}
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: "auto", padding: "10px 8px", display: "flex", flexDirection: "column", gap: 16 }}>
        {NAV_GROUPS.map(group => (
          <div key={group.label}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--muted-foreground)", padding: "0 6px", marginBottom: 4 }}>
              {group.label}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                const hasSub = "sub" in item && item.sub && item.sub.length > 0;
                const isExp = expanded.includes(item.label);

                return (
                  <div key={item.label}>
                    {hasSub ? (
                      <button onClick={() => toggle(item.label)} style={{
                        width: "100%", display: "flex", alignItems: "center", gap: 7, padding: "5px 7px", borderRadius: 5,
                        fontSize: 13, fontWeight: active ? 500 : 450, cursor: "pointer", border: "none", textAlign: "left",
                        background: active ? "var(--muted)" : "transparent",
                        color: active ? "var(--foreground)" : "var(--muted-foreground)",
                        transition: "background 100ms, color 100ms",
                      }}
                        onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = "var(--muted)"; (e.currentTarget as HTMLElement).style.color = "var(--foreground)"; } }}
                        onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--muted-foreground)"; } }}
                      >
                        <Icon size={14} style={{ flexShrink: 0, opacity: active ? 1 : 0.65 }} />
                        <span style={{ flex: 1 }}>{item.label}</span>
                        {"badge" in item && item.badge && (
                          <span style={{ fontSize: 10, fontWeight: 600, background: "var(--nc-blue)", color: "white", padding: "1px 5px", borderRadius: 99 }}>{item.badge}</span>
                        )}
                        <ChevronRight size={11} style={{ opacity: 0.5, transform: isExp ? "rotate(90deg)" : "none", transition: "transform 150ms" }} />
                      </button>
                    ) : (
                      <Link href={item.href}>
                        <div style={{
                          display: "flex", alignItems: "center", gap: 7, padding: "5px 7px", borderRadius: 5,
                          fontSize: 13, fontWeight: active ? 500 : 450, cursor: "pointer",
                          background: active ? "var(--muted)" : "transparent",
                          color: active ? "var(--foreground)" : "var(--muted-foreground)",
                          transition: "background 100ms, color 100ms",
                        }}
                          onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = "var(--muted)"; (e.currentTarget as HTMLElement).style.color = "var(--foreground)"; } }}
                          onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--muted-foreground)"; } }}
                        >
                          <Icon size={14} style={{ flexShrink: 0, opacity: active ? 1 : 0.65 }} />
                          <span style={{ flex: 1 }}>{item.label}</span>
                          {"badge" in item && item.badge && (
                            <span style={{ fontSize: 10, fontWeight: 600, background: "var(--nc-blue)", color: "white", padding: "1px 5px", borderRadius: 99 }}>{item.badge}</span>
                          )}
                        </div>
                      </Link>
                    )}

                    {hasSub && isExp && (
                      <div style={{ marginLeft: 14, marginTop: 2, paddingLeft: 10, borderLeft: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 1 }}>
                        {(item as any).sub.map((s: { label: string; href: string }) => (
                          <Link key={s.href} href={s.href}>
                            <div style={{
                              padding: "4px 7px", borderRadius: 4, fontSize: 12, cursor: "pointer",
                              fontWeight: location === s.href ? 500 : 400,
                              color: location === s.href ? "var(--foreground)" : "var(--muted-foreground)",
                              background: location === s.href ? "var(--muted)" : "transparent",
                              transition: "background 100ms, color 100ms",
                            }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--foreground)"; }}
                              onMouseLeave={e => { if (location !== s.href) (e.currentTarget as HTMLElement).style.color = "var(--muted-foreground)"; }}
                            >
                              {s.label}
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
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
            <span style={{ marginLeft: "auto", fontSize: 10, background: "var(--nc-blue-light)", color: "var(--nc-blue)", padding: "1px 5px", borderRadius: 3, fontWeight: 500 }}>↗</span>
          </a>
        </div>
        <div style={{ padding: "10px 12px", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--foreground)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: "var(--background)" }}>EN</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Eslam El-Naggar</div>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Head of Dept</div>
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
      {/* Desktop sidebar */}
      <aside style={{ width: 220, minWidth: 220, height: "100vh", position: "sticky", top: 0, background: "var(--sidebar)", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column" }}>
        <SidebarInner />
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50 }}>
          <div style={{ position: "absolute", inset: 0, background: "oklch(0 0 0 / 0.3)" }} onClick={() => setMobileOpen(false)} />
          <aside style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 220, background: "var(--sidebar)", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column" }}>
            <SidebarInner />
          </aside>
        </div>
      )}

      {/* Main */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Topbar */}
        <header style={{ height: 52, minHeight: 52, borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", padding: "0 20px", gap: 10, background: "var(--background)", position: "sticky", top: 0, zIndex: 10 }}>
          <button className="md:hidden" onClick={() => setMobileOpen(true)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", display: "flex", padding: 4 }}>
            <Menu size={16} />
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", background: "var(--muted)", borderRadius: 6, flex: 1, maxWidth: 280, border: "1px solid transparent" }}>
            <Search size={13} style={{ color: "var(--muted-foreground)", flexShrink: 0 }} />
            <input placeholder="Search anything..." style={{ background: "transparent", border: "none", outline: "none", fontSize: 13, color: "var(--foreground)", width: "100%" }} />
            <kbd style={{ fontSize: 10, color: "var(--muted-foreground)", background: "var(--border)", padding: "1px 4px", borderRadius: 3, whiteSpace: "nowrap" }}>⌘K</kbd>
          </div>

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
            <button onClick={() => toast.info("No new notifications")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", display: "flex", padding: 6, borderRadius: 6, position: "relative" }}>
              <Bell size={15} />
              <span style={{ position: "absolute", top: 5, right: 5, width: 6, height: 6, borderRadius: "50%", background: "var(--nc-blue)" }} />
            </button>
            <a href="https://nilecenter.online" target="_blank" rel="noopener noreferrer" style={{
              display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12, fontWeight: 500, color: "var(--foreground)", textDecoration: "none", transition: "background 100ms",
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--muted)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <Globe size={13} />
              <span className="hidden sm:inline">Moodle LMS</span>
            </a>
          </div>
        </header>

        {/* Content */}
        <main style={{ flex: 1, overflowY: "auto", padding: "28px 28px" }} className="animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}
