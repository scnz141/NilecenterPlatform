import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
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
  Languages,
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
import {
  getDemoUser,
  roleInspirations,
  roleMeta,
  type Role,
} from "@/lib/platformData";
import { getSidebarForRole } from "@/lib/rbac";
import {
  getDirection,
  isSupportedLocale,
  localeOptions,
  t,
  translateUiLabel,
  type Locale,
} from "@/lib/i18n";
import { UiLanguageProvider } from "@/lib/i18n-context";
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

type SidebarItem = ReturnType<typeof getSidebarForRole>[number];
type SidebarSection = {
  label?: string;
  items: string[];
  collapsible?: boolean;
};
type GroupedSidebarSection = {
  label?: string;
  items: SidebarItem[];
  collapsible?: boolean;
};

const sidebarWorkflowGroups: Record<Role, SidebarSection[]> = {
  student: [
    { label: "Today", items: ["Dashboard", "Calendar"] },
    {
      label: "Learning",
      items: [
        "Courses",
        "Course Map",
        "Assignments",
        "Quizzes",
        "Quran Progress",
      ],
    },
    { label: "Progress", items: ["Grades", "Attendance", "Certificates"] },
    {
      label: "Help",
      items: ["Forms", "Requests", "Messages", "Reports", "Support", "Profile"],
    },
  ],
  teacher: [
    { label: "Today", items: ["Dashboard", "Classes", "Calendar"] },
    {
      label: "Teaching",
      items: [
        "Attendance",
        "Assignments",
        "Grading",
        "Quizzes",
        "Question Bank",
        "Quran Review",
      ],
    },
    {
      label: "More",
      items: ["Forms", "Requests", "Messages", "Reports", "Profile"],
    },
    { label: "Advanced", items: ["Moodle"], collapsible: true },
  ],
  registrar: [
    { label: "Today", items: ["Dashboard"] },
    {
      label: "Admissions",
      items: ["Leads", "Applications", "Placement Tests"],
    },
    {
      label: "Students",
      items: ["Students", "Enrollments", "Classes", "Schedule"],
    },
    {
      label: "Office",
      items: [
        "Forms",
        "Requests",
        "Payments",
        "Messages",
        "Reports",
        "Settings",
      ],
    },
  ],
  headofdepartment: [
    { label: "Today", items: ["Dashboard"] },
    {
      label: "Courses",
      items: ["Departments", "Programs", "Courses", "Levels", "Curriculum"],
    },
    { label: "Teachers", items: ["Teachers", "Classes", "Schedule"] },
    {
      label: "Review",
      items: [
        "Assessments",
        "Forms",
        "Requests",
        "Certificates",
        "Reports",
        "Messages",
      ],
    },
    { label: "Advanced", items: ["Moodle"], collapsible: true },
  ],
  branchadmin: [
    { label: "Today", items: ["Dashboard", "Classes", "Rooms", "Schedule"] },
    { label: "People", items: ["Students", "Teachers"] },
    { label: "Operations", items: ["Attendance", "Payments"] },
    {
      label: "Office",
      items: ["Forms", "Requests", "Reports", "Messages", "Settings"],
    },
  ],
  superadmin: [
    { items: ["Dashboard"] },
    {
      label: "People",
      items: ["Users", "Roles & access", "Access rules", "Messages"],
    },
    {
      label: "Learning",
      items: ["Programs", "Courses", "Moodle", "Certificates"],
    },
    {
      label: "Operations",
      items: ["Branches", "Departments", "Schedule", "Forms", "Requests"],
    },
    { label: "Business", items: ["Reports"] },
    {
      label: "System",
      items: [
        "Blueprint",
        "Connections",
        "Activity log",
        "Health",
        "Settings",
        "Profile",
      ],
      collapsible: true,
    },
  ],
};

const navLabelBySource: Record<string, string> = {
  "Audit Logs": "Activity log",
  Blueprint: "School setup",
  Integrations: "Connections",
  "Audit Trail": "Activity",
  "Audit trail": "Activity",
  "Moodle Source": "Moodle",
  "Permission Matrix": "Access rules",
  Permissions: "Access rules",
  "Platform State": "System data",
  "Question Bank": "Questions",
  "Quran Progress": "Quran",
  "Quran Review": "Quran",
  Roles: "Roles & access",
  "Server-only": "Protected",
  "System Health": "Health",
  "Placement Tests": "Placement",
};

function getNavLabel(item: SidebarItem) {
  return navLabelBySource[item.label] ?? item.label;
}

function groupSidebarItems(
  role: Role,
  sidebar: SidebarItem[]
): GroupedSidebarSection[] {
  const used = new Set<string>();
  const sections: GroupedSidebarSection[] = sidebarWorkflowGroups[role]
    .map(group => {
      const items = group.items
        .map(label => sidebar.find(item => item.label === label))
        .filter((item): item is SidebarItem => Boolean(item));
      items.forEach(item => used.add(item.href));
      return { label: group.label, items, collapsible: group.collapsible };
    })
    .filter(group => group.items.length > 0);

  const remaining = sidebar.filter(item => !used.has(item.href));
  if (remaining.length && role !== "superadmin") {
    sections.push({ label: "More", items: remaining });
  }

  return sections;
}

const getScopeConfig = (role: Role, defaultScope: string): ScopeConfig => {
  switch (role) {
    case "student":
      return {
        label: "Branch",
        description: "Learning",
        options: [defaultScope],
      };
    case "teacher":
      return {
        label: "Teaching",
        description: "Classes",
        options: [defaultScope, "Online", "Cairo B1"],
      };
    case "registrar":
      return {
        label: "Branch",
        description: "Admissions",
        options: [defaultScope, "Cairo B1", "Alexandria B2", "Online"],
      };
    case "headofdepartment":
      return {
        label: "Academic area",
        description: "Courses",
        options: [defaultScope, "All departments", "Cairo B1", "Online"],
      };
    case "branchadmin":
      return {
        label: "Branch",
        description: "Operations",
        options: [defaultScope],
      };
    case "superadmin":
      return {
        label: "School scope",
        description: "All work",
        options: [
          defaultScope,
          "All branches",
          "Cairo B1",
          "Alexandria B2",
          "Online",
        ],
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
  if (role === "superadmin")
    return href.startsWith("/app/admin") || href.startsWith("/courses");
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
  const [sidebarExpanded, setSidebarExpanded] = useState(() => {
    if (typeof window === "undefined") return true;
    return (
      window.localStorage.getItem("nilelearn.sidebar.expanded") !== "false"
    );
  });
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [notificationVersion, setNotificationVersion] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const mobileDrawerRef = useRef<HTMLElement | null>(null);
  const notificationButtonRef = useRef<HTMLButtonElement | null>(null);
  const notificationPopoverRef = useRef<HTMLDivElement | null>(null);
  const accountButtonRef = useRef<HTMLButtonElement | null>(null);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const searchWrapRef = useRef<HTMLDivElement | null>(null);
  const searchButtonRef = useRef<HTMLButtonElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const user = getDemoUser(role);
  const meta = roleMeta[role];
  const inspiration = roleInspirations[role];
  const userScopeLabel = useMemo(() => {
    const state = platformStore.getState();
    const platformUser = state.users.find(item => item.id === user.id);
    if (!platformUser) return meta.branchLabel;

    const branch = state.branches.find(
      item => item.id === platformUser.branchId
    );
    const department = state.departments.find(
      item => item.id === platformUser.departmentId
    );

    if (role === "headofdepartment") {
      return department?.name ?? branch?.name ?? meta.branchLabel;
    }
    if (role === "superadmin") return meta.branchLabel;
    return branch?.name ?? department?.name ?? meta.branchLabel;
  }, [meta.branchLabel, role, user.id]);
  const [locale, setLocale] = useState<Locale>(() => {
    if (typeof window === "undefined") return "en";
    const saved = window.localStorage.getItem("nilelearn.locale");
    return isSupportedLocale(saved) ? saved : "en";
  });
  const scopeConfig = useMemo(
    () => getScopeConfig(role, userScopeLabel),
    [role, userScopeLabel]
  );
  const scopeValue = scopeConfig.options[0] ?? userScopeLabel;
  const sidebar = getSidebarForRole(role);
  const sidebarSections = useMemo(
    () => groupSidebarItems(role, sidebar),
    [role, sidebar]
  );
  const dir = getDirection(locale);
  const profileHref =
    sidebar.find(item => item.label === "Profile")?.href ?? meta.defaultRoute;
  const hasSearchQuery = Boolean(query.trim());
  const isDashboard = /\/dashboard\/?$/.test(location);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      "nilelearn.sidebar.expanded",
      String(sidebarExpanded)
    );
  }, [sidebarExpanded]);

  const searchResults = useMemo(() => {
    return platformStore
      .search(query)
      .filter(item => canShowSearchResult(role, item.href));
  }, [query, role]);
  const notificationItems = useMemo(() => {
    const state = platformStore.getState();
    return state.notifications
      .filter(
        notification => notification.userId === user.id || role === "superadmin"
      )
      .slice(0, 6);
  }, [notificationVersion, role, user.id]);
  const unreadCount = notificationItems.filter(item => !item.read).length;

  useEffect(() => {
    setMobileOpen(false);
    setNotificationsOpen(false);
    setAccountOpen(false);
    setSearchOpen(false);
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
      "summary",
      "[contenteditable='true']",
      "[tabindex]:not([tabindex='-1'])",
    ].join(",");
    const drawer = mobileDrawerRef.current;
    const getFocusableElements = () =>
      Array.from(
        drawer?.querySelectorAll<HTMLElement>(focusableSelector) ?? []
      ).filter(element => {
        const style = window.getComputedStyle(element);
        return (
          !element.closest("[inert]") &&
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          element.getClientRects().length > 0
        );
      });
    const focusFrame = window.requestAnimationFrame(() => {
      const closeButton = drawer?.querySelector<HTMLButtonElement>(
        ".platform-mobile-close"
      );
      (closeButton ?? drawer)?.focus();
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = getFocusableElements();
      if (!focusable.length) {
        event.preventDefault();
        drawer?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement as HTMLElement | null;
      if (!activeElement || !drawer?.contains(activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      menuButtonRef.current?.focus();
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setNotificationsOpen(false);
        setAccountOpen(false);
        if (searchOpen) {
          event.preventDefault();
          setSearchOpen(false);
          setQuery("");
          searchButtonRef.current?.focus();
        }
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
      if (searchOpen && !searchWrapRef.current?.contains(target)) {
        setSearchOpen(false);
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
  }, [accountOpen, notificationsOpen, searchOpen]);

  const sidebarMarkup = (
    <div className="platform-sidebar-inner">
      <div className="platform-brand">
        <Link href="/">
          <span className="platform-logo">NL</span>
        </Link>
        <div className="platform-brand-copy">
          <span>Nile Learn</span>
          <small>{translateUiLabel(locale, meta.label)}</small>
        </div>
        <button
          type="button"
          className="platform-sidebar-toggle"
          aria-label={
            sidebarExpanded
              ? t(locale, "collapseSidebar")
              : t(locale, "expandSidebar")
          }
          aria-pressed={sidebarExpanded}
          title={
            sidebarExpanded
              ? t(locale, "collapseSidebar")
              : t(locale, "expandSidebar")
          }
          onClick={() => setSidebarExpanded(expanded => !expanded)}
        >
          {sidebarExpanded ? (
            <PanelLeftClose size={15} />
          ) : (
            <PanelLeftOpen size={15} />
          )}
        </button>
        <button
          type="button"
          className="platform-icon-button platform-mobile-close"
          aria-label={t(locale, "closeMenu")}
          onClick={() => setMobileOpen(false)}
        >
          <X size={16} />
        </button>
      </div>

      {scopeValue ? (
        <div className="platform-selector-row platform-scope-summary">
          <div>
            <label>{translateUiLabel(locale, scopeConfig.label)}</label>
            <small>{translateUiLabel(locale, scopeConfig.description)}</small>
          </div>
          <strong>{translateUiLabel(locale, scopeValue)}</strong>
        </div>
      ) : null}

      <nav
        className="platform-nav"
        aria-label={`${translateUiLabel(locale, meta.label)} ${translateUiLabel(locale, "navigation menu")}`}
      >
        {sidebarSections.map(section => {
          const sectionIsActive = section.items.some(
            item =>
              location === item.href || location.startsWith(`${item.href}/`)
          );
          const sectionItems = (
            <div className="platform-nav-group-items">
              {section.items.map(item => {
                const displayLabel = translateUiLabel(
                  locale,
                  getNavLabel(item)
                );
                const Icon =
                  iconMap[item.icon as keyof typeof iconMap] ?? LayoutDashboard;
                const active =
                  location === item.href ||
                  location.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`platform-nav-item ${active ? "active" : ""}`}
                    aria-label={displayLabel}
                    aria-current={
                      active
                        ? location === item.href
                          ? "page"
                          : "location"
                        : undefined
                    }
                    title={displayLabel}
                    onClick={() => setMobileOpen(false)}
                  >
                    <Icon size={16} />
                    <span>{displayLabel}</span>
                    {item.badge ? (
                      <em style={{ background: meta.tint, color: meta.color }}>
                        {item.badge}
                      </em>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          );

          return section.collapsible ? (
            <details
              key={
                section.label ?? section.items.map(item => item.href).join(":")
              }
              className="platform-nav-group platform-nav-details"
              open={sectionIsActive || undefined}
            >
              <summary className="platform-nav-section-label">
                {translateUiLabel(locale, section.label)}
              </summary>
              {sectionItems}
            </details>
          ) : (
            <div
              key={
                section.label ?? section.items.map(item => item.href).join(":")
              }
              className="platform-nav-group"
            >
              {section.label ? (
                <div className="platform-nav-section-label">
                  {translateUiLabel(locale, section.label)}
                </div>
              ) : null}
              {sectionItems}
            </div>
          );
        })}
      </nav>
    </div>
  );

  return (
    <UiLanguageProvider locale={locale}>
      <div
        className="platform-shell"
        data-role={role}
        dir={dir}
        style={
          {
            "--role-color": meta.color,
            "--role-tint": meta.tint,
          } as CSSProperties
        }
      >
        <a
          className="platform-skip-link"
          href="#platform-main-content"
          onClick={event => {
            event.preventDefault();
            document.getElementById("platform-main-content")?.focus();
          }}
        >
          {translateUiLabel(locale, "Skip to main content")}
        </a>

        <motion.aside
          className={`platform-desktop-sidebar ${sidebarExpanded ? "expanded" : "collapsed"}`}
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
              <button
                className="platform-mobile-backdrop"
                aria-label="Close menu"
                onClick={() => setMobileOpen(false)}
              />
              <motion.aside
                id="platform-mobile-sidebar"
                ref={mobileDrawerRef}
                className="platform-mobile-sidebar"
                role="dialog"
                tabIndex={-1}
                aria-modal="true"
                aria-label={`${translateUiLabel(locale, meta.label)} ${translateUiLabel(locale, "navigation menu")}`}
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
            data-search-open={searchOpen ? "true" : undefined}
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.34,
              ease: [0.23, 1, 0.32, 1],
              delay: 0.04,
            }}
          >
            <button
              ref={menuButtonRef}
              className="platform-icon-button platform-menu-button"
              aria-label={t(locale, "openMenu")}
              aria-expanded={mobileOpen}
              aria-controls="platform-mobile-sidebar"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={18} />
            </button>

            <div
              className="platform-breadcrumb"
              aria-label={translateUiLabel(locale, title ?? meta.label)}
            >
              <strong>{translateUiLabel(locale, title ?? meta.label)}</strong>
            </div>

            <div
              className="platform-topbar-end"
              ref={searchWrapRef}
              data-search-open={searchOpen ? "true" : undefined}
            >
              {searchOpen ? (
                <div
                  id="platform-global-search"
                  className="platform-search"
                  role="search"
                  aria-label={t(locale, "globalSearch")}
                >
                  <Search size={15} aria-hidden="true" />
                  <input
                    ref={searchInputRef}
                    type="search"
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                    placeholder={t(locale, "search")}
                    aria-label={t(locale, "globalSearch")}
                    aria-controls={
                      hasSearchQuery ? "platform-search-results" : undefined
                    }
                  />
                  {hasSearchQuery ? (
                    <ul
                      className="platform-search-results"
                      id="platform-search-results"
                      aria-label={t(locale, "searchResults")}
                    >
                      {searchResults.length ? (
                        searchResults.map(item => (
                          <li key={`${item.type}-${item.label}`}>
                            <button
                              type="button"
                              onClick={() => {
                                setSearchOpen(false);
                                setQuery("");
                                navigate(item.href);
                              }}
                            >
                              <strong>{item.type}</strong> {item.label}
                            </button>
                          </li>
                        ))
                      ) : (
                        <li className="platform-search-empty">
                          {t(locale, "noMatchingRecords")}
                        </li>
                      )}
                    </ul>
                  ) : null}
                </div>
              ) : null}

              <div className="platform-topbar-actions">
                <button
                  ref={searchButtonRef}
                  type="button"
                  className="platform-icon-button platform-search-trigger"
                  aria-label={t(locale, "globalSearch")}
                  aria-expanded={searchOpen}
                  aria-controls="platform-global-search"
                  onClick={() => {
                    if (searchOpen) setQuery("");
                    setSearchOpen(open => !open);
                  }}
                >
                  <Search size={17} />
                </button>

                <div className="platform-language-control">
                  <Languages aria-hidden="true" size={16} />
                  <select
                    className="platform-language"
                    value={locale}
                    aria-label={t(locale, "language")}
                    onChange={event => {
                      const nextLocale = event.target.value as Locale;
                      setLocale(nextLocale);
                      window.localStorage.setItem(
                        "nilelearn.locale",
                        nextLocale
                      );
                    }}
                  >
                    {localeOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  ref={notificationButtonRef}
                  className="platform-icon-button"
                  aria-label={t(locale, "notifications")}
                  aria-expanded={notificationsOpen}
                  aria-controls="platform-notifications-popover"
                  onClick={() => setNotificationsOpen(open => !open)}
                >
                  <Bell size={17} />
                  {unreadCount ? (
                    <span
                      className="platform-notification-dot"
                      style={{ background: meta.accent }}
                    />
                  ) : null}
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
                          notificationItems.forEach(notification =>
                            platformStore.markNotificationRead(notification.id)
                          );
                          setNotificationVersion(version => version + 1);
                          toast.success(t(locale, "notificationsMarkedRead"));
                        }}
                      >
                        {t(locale, "markRead")}
                      </button>
                    </div>
                    {notificationItems.map(item => (
                      <button
                        key={item.id}
                        className="platform-notification-item"
                        role="menuitem"
                        onClick={() => {
                          platformStore.markNotificationRead(item.id);
                          setNotificationVersion(version => version + 1);
                          setNotificationsOpen(false);
                          navigate(item.href);
                        }}
                      >
                        <span
                          style={{
                            background: roleMeta[role].tint,
                            color: roleMeta[role].color,
                          }}
                        >
                          {item.read ? t(locale, "read") : t(locale, "unread")}
                        </span>
                        <strong>{item.title}</strong>
                        <small>{item.body}</small>
                      </button>
                    ))}
                    {!notificationItems.length ? (
                      <div className="platform-notification-empty">
                        {t(locale, "noNotifications")}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="platform-account">
                  <button
                    ref={accountButtonRef}
                    type="button"
                    className="platform-user-pill"
                    aria-label={`${user.name} ${t(locale, "accountMenu")}`}
                    aria-expanded={accountOpen}
                    aria-controls="platform-account-menu"
                    onClick={() => setAccountOpen(open => !open)}
                  >
                    <span
                      className="platform-user-avatar"
                      style={
                        role === "superadmin"
                          ? { background: meta.tint, color: meta.color }
                          : { background: meta.color }
                      }
                    >
                      {role === "superadmin" ? (
                        <ShieldCheck size={16} />
                      ) : (
                        user.avatar
                      )}
                    </span>
                    <span className="platform-user-copy">
                      <strong>{user.name}</strong>
                      <small>{translateUiLabel(locale, meta.label)}</small>
                    </span>
                    <ChevronDown size={14} />
                  </button>

                  {accountOpen ? (
                    <div
                      id="platform-account-menu"
                      ref={accountMenuRef}
                      className="platform-account-menu"
                      role="menu"
                      aria-label={`${user.name} ${t(locale, "accountActions")}`}
                    >
                      <div className="platform-account-menu-head">
                        <span
                          className="platform-user-avatar"
                          style={
                            role === "superadmin"
                              ? { background: meta.tint, color: meta.color }
                              : { background: meta.color }
                          }
                        >
                          {role === "superadmin" ? (
                            <ShieldCheck size={16} />
                          ) : (
                            user.avatar
                          )}
                        </span>
                        <div>
                          <strong>{user.name}</strong>
                          <small>{translateUiLabel(locale, meta.label)}</small>
                        </div>
                      </div>
                      <Link
                        href={profileHref}
                        className="platform-account-menu-item"
                        role="menuitem"
                      >
                        <UserCircle size={15} />
                        {t(locale, "profile")}
                      </Link>
                      <Link
                        href="/auth/logout"
                        className="platform-account-menu-item danger"
                        role="menuitem"
                      >
                        <LogOut size={15} />
                        {t(locale, "signOut")}
                      </Link>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </motion.header>

          {isDashboard ? (
            <section
              className="platform-context-quote"
              aria-label={`${translateUiLabel(locale, meta.label)} inspiration`}
            >
              <span className="platform-quote-mark" aria-hidden="true">
                ۞
              </span>
              <div>
                <small>{inspiration.theme}</small>
                <strong lang="ar" dir="rtl">
                  {inspiration.arabic}
                </strong>
                <p>{inspiration.meaning}</p>
              </div>
              <em>{inspiration.source}</em>
            </section>
          ) : null}

          <motion.main
            key={location}
            id="platform-main-content"
            className="platform-content"
            tabIndex={-1}
            aria-label={translateUiLabel(locale, title ?? meta.label)}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.36, ease: [0.23, 1, 0.32, 1] }}
          >
            {children}
          </motion.main>
        </div>
      </div>
    </UiLanguageProvider>
  );
}
