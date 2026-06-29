import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link, useLocation } from "wouter";
import {
  Activity,
  Award,
  BarChart3,
  Bell,
  BookCopy,
  BookMarked,
  BookOpen,
  Building2,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  Database,
  DoorOpen,
  FileText,
  GraduationCap,
  KeyRound,
  Layers,
  LayoutDashboard,
  Library,
  LifeBuoy,
  ListChecks,
  LogOut,
  Megaphone,
  Menu,
  MessageSquare,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  PenLine,
  PlugZap,
  Presentation,
  ScrollText,
  Search,
  Settings,
  ShieldCheck,
  UserCircle,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { getDemoUser, roleInspirations, roleMeta, type Role } from "@/lib/platformData";
import { getSidebarForRole } from "@/lib/rbac";
import { getDirection, localeOptions, t, type Locale } from "@/lib/i18n";
import { platformStore } from "@/lib/domain/store";

const iconMap = {
  Activity,
  Award,
  BarChart3,
  Bell,
  BookCopy,
  BookMarked,
  BookOpen,
  Building2,
  CalendarDays,
  CheckSquare,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  Database,
  DoorOpen,
  FileText,
  GraduationCap,
  KeyRound,
  Layers,
  LayoutDashboard,
  Library,
  LifeBuoy,
  ListChecks,
  Megaphone,
  MessageSquare,
  Network,
  PenLine,
  PlugZap,
  Presentation,
  ScrollText,
  Settings,
  ShieldCheck,
  UserCircle,
  UserPlus,
  Users,
};

type ShellProps = {
  role: Role;
  children: ReactNode;
  title?: string;
};

type ScopeConfig = {
  label: string;
  description: string;
  options: string[];
};

const getScopeConfig = (role: Role, defaultScope: string): ScopeConfig => {
  switch (role) {
    case "student":
      return {
        label: "Learning branch",
        description: "Course access",
        options: [defaultScope],
      };
    case "teacher":
      return {
        label: "Teaching scope",
        description: "Classes and attendance",
        options: [defaultScope, "Online", "Cairo B1"],
      };
    case "registrar":
      return {
        label: "Admissions branch",
        description: "Enrollment pipeline",
        options: [defaultScope, "Cairo B1", "Alexandria B2", "Online"],
      };
    case "headofdepartment":
      return {
        label: "Academic scope",
        description: "Department oversight",
        options: [defaultScope, "All departments", "Cairo B1", "Online"],
      };
    case "branchadmin":
      return {
        label: "Branch scope",
        description: "Local operations",
        options: [defaultScope],
      };
    case "superadmin":
      return {
        label: "Platform scope",
        description: "Governance view",
        options: [defaultScope, "All branches", "Cairo B1", "Alexandria B2", "Online"],
      };
  }

  return {
    label: "Workspace scope",
    description: "Current view",
    options: [defaultScope],
  };
};

function canShowSearchResult(role: Role, href: string) {
  if (href.startsWith("/courses")) return true;
  if (role === "superadmin") return href.startsWith("/app/admin") || href.startsWith("/courses");
  const rolePrefix: Record<Role, string> = {
    student: "/app/student",
    teacher: "/app/teacher",
    registrar: "/app/registrar",
    headofdepartment: "/app/hod",
    branchadmin: "/app/branch",
    superadmin: "/app/admin",
  };
  return href.startsWith(rolePrefix[role]);
}

export default function PlatformShell({ role, children, title }: ShellProps) {
  const [location, navigate] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [notificationVersion, setNotificationVersion] = useState(0);
  const [query, setQuery] = useState("");
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const mobileDrawerRef = useRef<HTMLElement | null>(null);
  const notificationButtonRef = useRef<HTMLButtonElement | null>(null);
  const notificationPopoverRef = useRef<HTMLDivElement | null>(null);
  const accountButtonRef = useRef<HTMLButtonElement | null>(null);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const searchWrapRef = useRef<HTMLDivElement | null>(null);
  const user = getDemoUser(role);
  const meta = roleMeta[role];
  const inspiration = roleInspirations[role];
  const [locale, setLocale] = useState<Locale>(() => {
    if (typeof window === "undefined") return "en";
    const saved = window.localStorage.getItem("nilelearn.locale");
    return localeOptions.some((option) => option.value === saved) ? (saved as Locale) : "en";
  });
  const scopeConfig = useMemo(() => getScopeConfig(role, meta.branchLabel), [meta.branchLabel, role]);
  const branchOptions = useMemo(() => Array.from(new Set(scopeConfig.options)), [scopeConfig.options]);
  const showScopeSelector = branchOptions.length > 1;
  const [branch, setBranch] = useState(() => {
    if (typeof window === "undefined") return branchOptions[0];
    const saved = window.localStorage.getItem(`nilelearn.branch.${role}`);
    return saved && branchOptions.includes(saved) ? saved : branchOptions[0];
  });
  const sidebar = getSidebarForRole(role);
  const dir = getDirection(locale);
  const profileHref = sidebar.find((item) => item.label === "Profile")?.href ?? meta.defaultRoute;
  const hasSearchQuery = Boolean(query.trim());
  const isDashboardRoute = location.endsWith("/dashboard");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(`nilelearn.branch.${role}`);
    setBranch(saved && branchOptions.includes(saved) ? saved : branchOptions[0]);
  }, [branchOptions, role]);

  const searchResults = useMemo(() => {
    return platformStore.search(query).filter((item) => canShowSearchResult(role, item.href));
  }, [query, role]);
  const notificationItems = useMemo(() => {
    const state = platformStore.getState();
    return state.notifications
      .filter((notification) => notification.userId === user.id || role === "superadmin")
      .slice(0, 6);
  }, [notificationVersion, role, user.id]);
  const unreadCount = notificationItems.filter((item) => !item.read).length;

  useEffect(() => {
    setMobileOpen(false);
    setNotificationsOpen(false);
    setAccountOpen(false);
    setQuery("");
  }, [location]);

  useEffect(() => {
    if (!mobileOpen || typeof document === "undefined") return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusableSelector = [
      "a[href]",
      "button:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      "input:not([disabled])",
      "[tabindex]:not([tabindex='-1'])",
    ].join(",");
    const drawer = mobileDrawerRef.current;
    const focusable = Array.from(drawer?.querySelectorAll<HTMLElement>(focusableSelector) ?? []);
    focusable[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileOpen(false);
        return;
      }
      if (event.key !== "Tab" || !focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      menuButtonRef.current?.focus();
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setNotificationsOpen(false);
        setAccountOpen(false);
        setQuery("");
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        notificationsOpen &&
        !notificationButtonRef.current?.contains(target) &&
        !notificationPopoverRef.current?.contains(target)
      ) {
        setNotificationsOpen(false);
      }
      if (hasSearchQuery && !searchWrapRef.current?.contains(target)) {
        setQuery("");
      }
      if (
        accountOpen &&
        !accountButtonRef.current?.contains(target) &&
        !accountMenuRef.current?.contains(target)
      ) {
        setAccountOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [accountOpen, hasSearchQuery, notificationsOpen]);

  const sidebarMarkup = (
    <div className="platform-sidebar-inner">
      <div className="platform-brand">
        <Link href="/">
          <span className="platform-logo" style={{ background: meta.color }}>
            NC
          </span>
        </Link>
        <div className="platform-brand-copy">
          <span>Nile Learn</span>
          <small>{meta.shortLabel} portal</small>
        </div>
        <button className="platform-icon-button platform-mobile-close" aria-label="Close menu" onClick={() => setMobileOpen(false)}>
          <X size={16} />
        </button>
        <button
          type="button"
          className="platform-sidebar-toggle"
          aria-label={sidebarExpanded ? "Collapse sidebar" : "Expand sidebar"}
          aria-pressed={sidebarExpanded}
          onClick={() => setSidebarExpanded((expanded) => !expanded)}
        >
          {sidebarExpanded ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
        </button>
      </div>

      {showScopeSelector ? (
        <div className="platform-selector-row">
          <div>
            <label>{scopeConfig.label}</label>
            <small>{scopeConfig.description}</small>
          </div>
          <select
            aria-label={scopeConfig.label}
            value={branch}
            onChange={(event) => {
              const nextBranch = event.target.value;
              setBranch(nextBranch);
              window.localStorage.setItem(`nilelearn.branch.${role}`, nextBranch);
              toast.success(`${scopeConfig.label} set to ${nextBranch}`);
            }}
          >
            {branchOptions.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="platform-nav-section-label">{role === "superadmin" ? "Administration" : "Workspace"}</div>
      <nav className="platform-nav" aria-label={`${meta.label} navigation`}>
        {sidebar.map((item) => {
          const Icon = iconMap[item.icon as keyof typeof iconMap] ?? LayoutDashboard;
          const active = location === item.href || location.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`platform-nav-item ${active ? "active" : ""}`}
              aria-label={item.label}
              title={item.label}
              onClick={() => setMobileOpen(false)}
            >
              <Icon size={16} />
              <span>{item.label}</span>
              {item.badge ? <em style={{ background: meta.color }}>{item.badge}</em> : null}
            </Link>
          );
        })}
      </nav>
    </div>
  );

  return (
    <div className="platform-shell" dir={dir} style={{ "--role-color": meta.color, "--role-tint": meta.tint } as CSSProperties}>
      <motion.aside
        className={`platform-desktop-sidebar ${sidebarExpanded ? "expanded" : ""} ${!sidebarExpanded && sidebarHovered ? "hovered" : ""}`}
        onMouseEnter={() => setSidebarHovered(true)}
        onMouseLeave={() => setSidebarHovered(false)}
        onFocus={() => setSidebarHovered(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setSidebarHovered(false);
          }
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.38, ease: [0.23, 1, 0.32, 1] }}
      >
        {sidebarMarkup}
      </motion.aside>

      <AnimatePresence>
        {mobileOpen ? (
          <motion.div
            className="platform-mobile-overlay"
            role="presentation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <button className="platform-mobile-backdrop" aria-label="Close menu" onClick={() => setMobileOpen(false)} />
            <motion.aside
              id="platform-mobile-sidebar"
              ref={mobileDrawerRef}
              className="platform-mobile-sidebar"
              role="dialog"
              aria-modal="true"
              aria-label={`${meta.label} navigation menu`}
              initial={{ x: dir === "rtl" ? 280 : -280 }}
              animate={{ x: 0 }}
              exit={{ x: dir === "rtl" ? 280 : -280 }}
              transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
            >
              {sidebarMarkup}
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="platform-main">
        <motion.header
          className="platform-topbar"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.34, ease: [0.23, 1, 0.32, 1], delay: 0.04 }}
        >
          <button
            ref={menuButtonRef}
            className="platform-icon-button platform-menu-button"
            aria-label="Open menu"
            aria-expanded={mobileOpen}
            aria-controls="platform-mobile-sidebar"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={18} />
          </button>

          <div className="platform-breadcrumb">
            <span style={{ background: meta.tint, color: meta.color }}>{meta.shortLabel}</span>
            <strong>{title ?? meta.label}</strong>
          </div>

          <div className="platform-search" ref={searchWrapRef}>
            <Search size={15} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t(locale, "search")}
              aria-label="Global search"
              aria-expanded={hasSearchQuery}
              aria-controls="platform-search-results"
            />
            {hasSearchQuery ? (
              <div className="platform-search-results" id="platform-search-results" role="listbox" aria-label="Search results">
                {searchResults.length ? (
                  searchResults.map((item) => (
                    <button
                      key={`${item.type}-${item.label}`}
                      onClick={() => {
                        setQuery("");
                        navigate(item.href);
                      }}
                    >
                      <strong>{item.type}</strong> {item.label}
                    </button>
                  ))
                ) : (
                  <div className="platform-search-empty">No matching records</div>
                )}
              </div>
            ) : null}
          </div>

          <div className="platform-topbar-actions">
            <select
              className="platform-language"
              value={locale}
              aria-label={t(locale, "language")}
              onChange={(event) => {
                const nextLocale = event.target.value as Locale;
                setLocale(nextLocale);
                window.localStorage.setItem("nilelearn.locale", nextLocale);
              }}
            >
              {localeOptions.slice(0, 4).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <button
              ref={notificationButtonRef}
              className="platform-icon-button"
              aria-label={t(locale, "notifications")}
              aria-expanded={notificationsOpen}
              aria-controls="platform-notifications-popover"
              onClick={() => setNotificationsOpen((open) => !open)}
            >
              <Bell size={17} />
              {unreadCount ? <span className="platform-notification-dot" style={{ background: meta.accent }} /> : null}
            </button>

            {notificationsOpen ? (
              <div
                className="platform-notification-popover"
                id="platform-notifications-popover"
                ref={notificationPopoverRef}
                role="menu"
                aria-label={t(locale, "notifications")}
              >
                <div className="platform-popover-title">
                  <strong>{t(locale, "notifications")}</strong>
                  <button
                    onClick={() => {
                      notificationItems.forEach((notification) => platformStore.markNotificationRead(notification.id));
                      setNotificationVersion((version) => version + 1);
                      toast.success("Notifications marked read");
                    }}
                  >
                    {t(locale, "markRead")}
                  </button>
                </div>
                {notificationItems.map((item) => (
                  <button
                    key={item.id}
                    className="platform-notification-item"
                    role="menuitem"
                    onClick={() => {
                      platformStore.markNotificationRead(item.id);
                      setNotificationVersion((version) => version + 1);
                      setNotificationsOpen(false);
                      navigate(item.href);
                    }}
                  >
                    <span style={{ background: roleMeta[role].tint, color: roleMeta[role].color }}>{item.read ? "Read" : "Unread"}</span>
                    <strong>{item.title}</strong>
                    <small>{item.body}</small>
                  </button>
                ))}
                {!notificationItems.length ? (
                  <div className="platform-notification-empty">No notifications for this role.</div>
                ) : null}
              </div>
            ) : null}

            <div className="platform-account">
              <button
                ref={accountButtonRef}
                type="button"
                className="platform-user-pill"
                aria-label={`${user.name} account menu`}
                aria-expanded={accountOpen}
                aria-controls="platform-account-menu"
                onClick={() => setAccountOpen((open) => !open)}
              >
                <span
                  className="platform-user-avatar"
                  style={role === "superadmin" ? { background: meta.tint, color: meta.color } : { background: meta.color }}
                >
                  {role === "superadmin" ? <ShieldCheck size={16} /> : user.avatar}
                </span>
                <span className="platform-user-copy">
                  <strong>{user.name}</strong>
                  <small>{meta.label}</small>
                </span>
                <ChevronDown size={14} />
              </button>

              {accountOpen ? (
                <div
                  id="platform-account-menu"
                  ref={accountMenuRef}
                  className="platform-account-menu"
                  role="menu"
                  aria-label={`${user.name} account actions`}
                >
                  <div className="platform-account-menu-head">
                    <span
                      className="platform-user-avatar"
                      style={role === "superadmin" ? { background: meta.tint, color: meta.color } : { background: meta.color }}
                    >
                      {role === "superadmin" ? <ShieldCheck size={16} /> : user.avatar}
                    </span>
                    <div>
                      <strong>{user.name}</strong>
                      <small>{meta.label}</small>
                    </div>
                  </div>
                  <Link href={profileHref} className="platform-account-menu-item" role="menuitem">
                    <UserCircle size={15} />
                    Profile
                  </Link>
                  <Link href="/auth/logout" className="platform-account-menu-item danger" role="menuitem">
                    <LogOut size={15} />
                    Sign out
                  </Link>
                </div>
              ) : null}
            </div>
          </div>
        </motion.header>

        {isDashboardRoute ? (
          <motion.section
            className="platform-context-quote"
            style={{ "--role-color": meta.color, "--role-tint": meta.tint } as CSSProperties}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.38, ease: [0.23, 1, 0.32, 1], delay: 0.08 }}
            aria-label={`${meta.label} inspiration`}
          >
            <span className="platform-quote-mark" aria-hidden="true">۞</span>
            <div>
              <small>{inspiration.theme}</small>
              <strong lang="ar" dir="rtl">{inspiration.arabic}</strong>
              <p>{inspiration.meaning}</p>
            </div>
            <em>{inspiration.source}</em>
          </motion.section>
        ) : null}

        <motion.main
          key={location}
          className="platform-content"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.36, ease: [0.23, 1, 0.32, 1] }}
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
}
