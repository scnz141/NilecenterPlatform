import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "wouter";
import { MotionConfig, motion } from "framer-motion";
import { Building2, Menu, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import {
  fetchAuthWorkspacesRequest,
  type AuthSessionDto,
  type AuthWorkspaceDto,
  type NccRole,
} from "@/lib/backend/api";
import { copy } from "../copy";
import {
  DISPLAY_SIZES,
  setDisplaySize,
  useDisplaySize,
  type DisplaySize,
} from "../display";
import { STAFF_LOCALES, setStaffLocale, useStaffLocale } from "../i18n";
import {
  navTrailForPath,
  staffNavForRole,
  switchableRoles,
  titleForPath,
} from "../nav";
import { needsWorkspaceBranch, roleLabel } from "../roles";
import { runAction } from "../run-action";
import { useStaffSession } from "../session";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { GlyphCheck } from "../ui/glyphs";
import { Avatar } from "../ui/primitives";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetTitle,
} from "../ui/kit";
import { NileRosette } from "@/components/brand/NileLogo";
import { StaffNotificationsBell } from "./staff-notifications";
import { RoleViewChip } from "./role-view-bar";
import { isTypingTarget, setSidebarCollapsed, useSidebarCollapsed } from "./sidebar-state";
import { StaffCommandMenu } from "./command-menu";

const StaffCrumbContext = createContext<(label: string | null) => void>(
  () => {},
);

/** Pages call this to append a final breadcrumb crumb (e.g. a person name). */
export function useStaffCrumb(label: string | null) {
  const setCrumb = useContext(StaffCrumbContext);
  useEffect(() => {
    setCrumb(label);
    return () => setCrumb(null);
  }, [label, setCrumb]);
}

function displayLabel(size: DisplaySize): string {
  if (size === "large") return copy.shell.displayLarge;
  if (size === "xlarge") return copy.shell.displayXLarge;
  return copy.shell.displayStandard;
}

function MenuCheck({ on }: { on: boolean }) {
  return (
    <span className="ui-menu-check" aria-hidden>
      {on ? <GlyphCheck /> : null}
    </span>
  );
}

function Brand() {
  return (
    <Link href="/app/dashboard" className="staff-brand">
      <NileRosette className="staff-brand-mark" />
      <span className="staff-brand-text">
        <span className="staff-brand-name">{copy.brand.name}</span>
        <span className="staff-brand-sub">{copy.brand.product}</span>
      </span>
    </Link>
  );
}

/**
 * Floating label for the icon rail. Portaled to `document.body` because the
 * sticky sidebar forms its own stacking context — a fixed child still paints
 * under `.staff-main`.
 */
function useRailTip(enabled: boolean) {
  const [tip, setTip] = useState<{ label: string; top: number } | null>(null);
  const [path] = useLocation();
  useEffect(() => {
    setTip(null);
  }, [enabled, path]);
  const show = (label: string) => (event: { currentTarget: HTMLElement }) => {
    if (!enabled) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setTip({ label, top: rect.top + rect.height / 2 });
  };
  const showFocus =
    (label: string) => (event: { currentTarget: HTMLElement }) => {
      // Only keyboard focus opens the label; mouse press already navigates.
      if (event.currentTarget.matches(":focus-visible")) show(label)(event);
    };
  const node = tip
    ? createPortal(
        <span className="staff-rail-tip" role="tooltip" style={{ insetBlockStart: tip.top }}>
          {tip.label}
        </span>,
        document.body
      )
    : null;
  return { show, showFocus, hide: () => setTip(null), node };
}

function NavList({ onNavigate, collapsed = false }: { onNavigate?: () => void; collapsed?: boolean }) {
  const { session } = useStaffSession();
  const [path] = useLocation();
  const tip = useRailTip(collapsed);
  const role = session?.ncc?.activeRole ?? "teacher";
  const sections = staffNavForRole(role);
  const bestMatch = sections
    .flatMap(section => section.items)
    .filter(
      item =>
        item.available &&
        (path === item.href ||
          (item.href !== "/app" && path.startsWith(item.href + "/"))),
    )
    .sort((a, b) => b.href.length - a.href.length)[0];

  return (
    <nav className="staff-nav" aria-label={copy.shell.staffNav}>
      {sections.map(section => (
        <div key={section.label} className="staff-nav-group">
          <p className="staff-nav-group-label">{section.label}</p>
          <ul className="staff-nav-list">
            {section.items.map(item => {
              const active = bestMatch?.href === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="staff-nav-link"
                    data-active={active}
                    aria-current={active ? "page" : undefined}
                    onClick={onNavigate}
                    onPointerEnter={tip.show(item.label)}
                    onPointerLeave={tip.hide}
                    onFocus={tip.showFocus(item.label)}
                    onBlur={tip.hide}
                  >
                    {active ? (
                      <motion.span
                        layoutId="staff-nav-active"
                        className="staff-nav-active"
                        transition={{ type: "spring", duration: 0.25, bounce: 0 }}
                        aria-hidden
                      />
                    ) : null}
                    <item.icon
                      className="staff-nav-icon"
                      strokeWidth={1.75}
                      aria-hidden
                    />
                    <span className="staff-nav-label">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {tip.node}
    </nav>
  );
}

/** Workspace branch switcher for roles that work inside one branch. */
function WorkspaceSwitcher({ compact = false }: { compact?: boolean }) {
  const { session, switchWorkspace } = useStaffSession();
  const role = session?.ncc?.activeRole;
  const needsBranch = role ? needsWorkspaceBranch(role) : false;
  const [items, setItems] = useState<AuthWorkspaceDto[]>([]);

  useEffect(() => {
    if (!needsBranch) return;
    let cancelled = false;
    fetchAuthWorkspacesRequest().then(result => {
      if (cancelled) return;
      if (result.ok && result.data) setItems(result.data.items);
    });
    return () => {
      cancelled = true;
    };
  }, [needsBranch]);

  if (!session || !needsBranch) return null;

  const active = session.ncc?.workspaceBranchId ?? "";

  if (compact) {
    const current = items.find(workspace => workspace.id === active);
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="staff-rail-btn"
            aria-label={`${copy.shell.workspace}: ${current?.name ?? copy.shell.chooseWorkspaceOption}`}
            title={current?.name}
          >
            <Building2 strokeWidth={1.75} aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="right" sideOffset={10}>
          <DropdownMenuLabel>{copy.shell.workspace}</DropdownMenuLabel>
          {items.map(workspace => (
            <DropdownMenuItem
              key={workspace.id}
              role="menuitemradio"
              aria-checked={workspace.id === active}
              onSelect={() => void switchWorkspace(workspace.id)}
            >
              <MenuCheck on={workspace.id === active} />
              {workspace.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <Select
      value={active || undefined}
      onValueChange={value => void switchWorkspace(value)}
    >
      <SelectTrigger
        className="staff-workspace-select"
        aria-label={copy.shell.workspace}
      >
        <SelectValue placeholder={copy.shell.chooseWorkspaceOption} />
      </SelectTrigger>
      <SelectContent>
        {items.map(workspace => (
          <SelectItem key={workspace.id} value={workspace.id}>
            {workspace.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function UserMenu({ session, compact = false }: { session: AuthSessionDto; compact?: boolean }) {
  const { signOut, signOutEverywhere, switchRole } = useStaffSession();
  const locale = useStaffLocale();
  const displaySize = useDisplaySize();
  const [confirmOutAll, setConfirmOutAll] = useState(false);
  const ncc = session.ncc;
  if (!ncc) return null;
  const targets = switchableRoles(ncc.assignedRole);
  const actingDown = ncc.activeRole !== ncc.assignedRole;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="staff-user-trigger"
            aria-label={session.name}
          >
            <Avatar name={session.name} seed={session.userId} />
            <span className="staff-user-meta">
              <span className="staff-user-name">{session.name}</span>
              <span className="staff-user-role">
                {actingDown
                  ? `${copy.shell.viewingAs} ${roleLabel(ncc.activeRole)}`
                  : roleLabel(ncc.activeRole)}
              </span>
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side={compact ? "right" : "top"} sideOffset={compact ? 10 : 8}>
          <DropdownMenuLabel className="!font-normal">
            <span className="block font-medium">{session.name}</span>
            <span className="staff-muted block text-xs">{session.email}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/app/profile">{copy.nav.profile}</Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {targets.length > 0 ? (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                {copy.shell.viewAsRole}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {[ncc.assignedRole, ...targets].map(target => (
                  <DropdownMenuItem
                    key={target}
                    onSelect={() =>
                      void runAction(() => switchRole(target), {
                        success:
                          target === ncc.assignedRole
                            ? copy.shell.roleViewEnded
                            : `${copy.shell.roleViewChanged} ${roleLabel(target)}.`,
                      })
                    }
                    aria-checked={target === ncc.activeRole}
                    role="menuitemradio"
                  >
                    <MenuCheck on={target === ncc.activeRole} />
                    {roleLabel(target)}
                    {target === ncc.assignedRole
                      ? ` (${copy.shell.ownRole})`
                      : ""}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ) : null}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>{copy.shell.displaySize}</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {DISPLAY_SIZES.map(size => (
                <DropdownMenuItem
                  key={size}
                  onSelect={() => setDisplaySize(size)}
                  aria-checked={size === displaySize}
                  role="menuitemradio"
                >
                  <MenuCheck on={size === displaySize} />
                  {displayLabel(size)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>{copy.language.label}</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {STAFF_LOCALES.map(option => (
                <DropdownMenuItem
                  key={option.value}
                  lang={option.value}
                  onSelect={() => setStaffLocale(option.value)}
                  aria-checked={option.value === locale}
                  role="menuitemradio"
                >
                  <MenuCheck on={option.value === locale} />
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => void signOut()}>
            {copy.shell.signOut}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setConfirmOutAll(true)}>
            {copy.shell.signOutEverywhere}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirmOutAll}
        onOpenChange={setConfirmOutAll}
        title={copy.profile.signOutEverywhereTitle}
        description={copy.profile.signOutEverywhereBody}
        confirmLabel={copy.profile.signOutEverywhere}
        destructive
        onConfirm={() => signOutEverywhere()}
      />
    </>
  );
}

function SidebarFooter({ session, compact = false }: { session: AuthSessionDto; compact?: boolean }) {
  return (
    <div className="staff-sidebar-footer">
      <WorkspaceSwitcher compact={compact} />
      <UserMenu session={session} compact={compact} />
    </div>
  );
}

function Breadcrumb({ path, crumb }: { path: string; crumb: string | null }) {
  const trail = navTrailForPath(path);
  if (!trail) {
    return (
      <span className="staff-crumb staff-crumb-current">
        {crumb ?? titleForPath(path)}
      </span>
    );
  }
  return (
    <>
      <span className="staff-crumb staff-crumb-group">{trail.group}</span>
      <span className="staff-crumb-sep" aria-hidden>
        /
      </span>
      <Link
        href={trail.item.href}
        className="staff-crumb staff-crumb-page staff-crumb-link"
      >
        {trail.item.label}
      </Link>
      {crumb ? (
        <>
          <span className="staff-crumb-sep" aria-hidden>
            /
          </span>
          <span className="staff-crumb staff-crumb-current">{crumb}</span>
        </>
      ) : null}
    </>
  );
}

/**
 * Large-title behaviour: the page title lives in the content; once it
 * scrolls under the top bar, a compact copy fades into the bar and a hairline
 * appears, as in native large-title navigation. Returns the scroll container
 * ref and the bar state. A new page always starts at the top.
 */
function useCollapsingTitle(location: string) {
  const mainRef = useRef<HTMLDivElement>(null);
  const [bar, setBar] = useState<{
    scrolled: boolean;
    compact: boolean;
    title: string | null;
  }>({ scrolled: false, compact: false, title: null });

  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    main.scrollTo({ top: 0 });
    setBar({ scrolled: false, compact: false, title: null });
    let frame = 0;
    const measure = () => {
      frame = 0;
      const topbar = main.querySelector<HTMLElement>(".staff-topbar");
      const heading = main.querySelector<HTMLElement>(
        ".staff-content h1, .staff-content .staff-detail-name"
      );
      const barBottom =
        main.getBoundingClientRect().top + (topbar?.offsetHeight ?? 0);
      const hidden = heading
        ? heading.getBoundingClientRect().bottom <= barBottom
        : false;
      setBar(current => {
        // The title text stays while the compact title fades out.
        const next = {
          scrolled: main.scrollTop > 2,
          compact: hidden,
          title: hidden
            ? (heading?.textContent?.trim() ?? null)
            : current.title,
        };
        return current.scrolled === next.scrolled &&
          current.compact === next.compact &&
          current.title === next.title
          ? current
          : next;
      });
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    main.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      main.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [location]);

  return { mainRef, ...bar };
}

export function StaffShell({
  path,
  children,
}: {
  path: string;
  children: ReactNode;
}) {
  const { session } = useStaffSession();
  const [location] = useLocation();
  const [mobileNav, setMobileNav] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [crumb, setCrumb] = useState<string | null>(null);
  const bar = useCollapsingTitle(location);
  const collapsed = useSidebarCollapsed();
  const isMac =
    typeof navigator !== "undefined" &&
    /mac/i.test(navigator.platform || navigator.userAgent);
  const collapsedRef = useRef(collapsed);
  collapsedRef.current = collapsed;
  const toggleHint = `${collapsed ? copy.shell.expandSidebar : copy.shell.collapseSidebar} ([)`;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(open => !open);
        return;
      }
      // "[" (or Cmd/Ctrl + \) folds the sidebar into an icon rail.
      const bracket = event.key === "[" && !event.metaKey && !event.ctrlKey && !event.altKey;
      const backslash = (event.metaKey || event.ctrlKey) && event.key === "\\";
      if ((bracket && !isTypingTarget(event.target)) || backslash) {
        event.preventDefault();
        setSidebarCollapsed(!collapsedRef.current);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);


  return (
    <MotionConfig reducedMotion="user">
      <StaffCrumbContext.Provider value={setCrumb}>
        <div className="staff-app staff-shell" data-sidebar={collapsed ? "collapsed" : "expanded"}>
          <aside className="staff-sidebar">
            <div className="staff-sidebar-head">
              <Brand />
              <button
                type="button"
                className="staff-sidebar-toggle"
                onClick={() => setSidebarCollapsed(!collapsed)}
                aria-label={collapsed ? copy.shell.expandSidebar : copy.shell.collapseSidebar}
                aria-expanded={!collapsed}
                title={toggleHint}
              >
                {collapsed ? (
                  <PanelLeftOpen className="staff-rtl-flip" strokeWidth={1.75} aria-hidden />
                ) : (
                  <PanelLeftClose className="staff-rtl-flip" strokeWidth={1.75} aria-hidden />
                )}
              </button>
            </div>
            <NavList collapsed={collapsed} />
            {session ? <SidebarFooter session={session} compact={collapsed} /> : null}
          </aside>

          <div className="staff-main" ref={bar.mainRef}>
            <header
              className="staff-topbar"
              data-scrolled={bar.scrolled || undefined}
              data-compact={bar.compact || undefined}
            >
              <button
                type="button"
                className="staff-menu-toggle"
                onClick={() => setMobileNav(true)}
                aria-label={copy.shell.openMenu}
              >
                <Menu strokeWidth={1.75} aria-hidden />
              </button>
              <nav className="staff-crumbs" aria-label={copy.shell.breadcrumb}>
                <Breadcrumb path={path} crumb={crumb} />
              </nav>
              <span className="staff-topbar-title" aria-hidden>
                {bar.title}
              </span>
              <div className="staff-topbar-tools">
                <RoleViewChip />
                <button
                  type="button"
                  className="staff-search-btn"
                  onClick={() => setCommandOpen(true)}
                  aria-label={copy.shell.search}
                >
                  <Search strokeWidth={1.75} aria-hidden />
                  <span className="staff-search-btn-text">
                    {copy.shell.search}
                  </span>
                  <kbd className="staff-kbd" aria-hidden>
                    {isMac ? "⌘K" : "Ctrl K"}
                  </kbd>
                </button>
                <StaffNotificationsBell />
              </div>
            </header>

            <main className="staff-content" key={location}>
              {children}
            </main>
          </div>

          <Sheet open={mobileNav} onOpenChange={setMobileNav}>
            <SheetContent
              side="left"
              className="staff-nav-sheet"
              aria-label={copy.shell.staffNav}
            >
              <SheetTitle className="sr-only">{copy.shell.staffNav}</SheetTitle>
              <Brand />
              <NavList onNavigate={() => setMobileNav(false)} />
              {session ? <SidebarFooter session={session} /> : null}
            </SheetContent>
          </Sheet>

          <StaffCommandMenu open={commandOpen} onOpenChange={setCommandOpen} />
        </div>
      </StaffCrumbContext.Provider>
    </MotionConfig>
  );
}
