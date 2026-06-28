import { useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import {
  LayoutDashboard, UserPlus, Users, Clock, CreditCard,
  MessageSquare, Bell, User, LogOut, Menu, ClipboardList
} from "lucide-react";

const NAV = [
  { label: "Dashboard", href: "/registrar", icon: LayoutDashboard },
  { label: "Register Student", href: "/registrar/register", icon: UserPlus },
  { label: "All Students", href: "/students", icon: Users },
  { label: "Pending Enrollment", href: "/registrar/pending", icon: Clock },
  { label: "Today's Payments", href: "/registrar/payments", icon: CreditCard },
  { label: "Messages", href: "/messages", icon: MessageSquare },
  { label: "Notifications", href: "/notifications", icon: Bell },
  { label: "Profile", href: "/profile", icon: User },
];

export default function RegistrarLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const SidebarInner = () => (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div style={{ padding: "16px 14px 12px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        <Link href="/registrar">
          <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: "oklch(0.55 0.18 270)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ClipboardList size={13} style={{ color: "white" }} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--foreground)" }}>Nile Center</div>
              <div style={{ fontSize: 10, color: "var(--muted-foreground)", letterSpacing: "0.04em" }}>REGISTRAR PORTAL</div>
            </div>
          </div>
        </Link>
      </div>

      <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        <div style={{ padding: "8px 10px", borderRadius: 8, background: "oklch(0.97 0.015 270)", border: "1px solid oklch(0.88 0.04 270)" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "oklch(0.35 0.12 270)" }}>Radwa Osama</div>
          <div style={{ fontSize: 10, color: "oklch(0.5 0.08 270)", marginTop: 1 }}>REG-003 · Branch B1</div>
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
        <div style={{ padding: "10px 12px", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 26, height: 26, borderRadius: "50%", background: "oklch(0.55 0.18 270)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: "white" }}>RO</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Radwa Osama</div>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Registrar</div>
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
                <span style={{ position: "absolute", top: 5, right: 5, width: 6, height: 6, borderRadius: "50%", background: "oklch(0.55 0.18 270)" }} />
              </button>
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
