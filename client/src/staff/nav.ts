import type { NccRole } from "@/lib/backend/api";
import {
  Activity,
  Bell,
  BookOpen,
  Building2,
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  FileText,
  DoorOpen,
  GraduationCap,
  LayoutDashboard,
  Library,
  ListChecks,
  Network,
  Plug,
  Presentation,
  ScrollText,
  School,
  SlidersHorizontal,
  UserMinus,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { ROLE_ORDER, canSwitchRoles } from "./roles";
import { copy } from "./copy";

export interface StaffNavItem {
  label: string;
  href: string;
  roles: NccRole[];
  /** Pages that exist in this phase. Others stay hidden until wired. */
  available: boolean;
  icon: LucideIcon;
}

export interface StaffNavGroup {
  label: string;
  items: StaffNavItem[];
}

const ALL: NccRole[] = [...ROLE_ORDER];

const ADMISSIONS: NccRole[] = [
  "super_admin",
  "branch_admin",
  "vice_manager",
  "registrar",
  "ssa",
];

const ROOM_READ: NccRole[] = [
  "super_admin",
  "branch_admin",
  "vice_manager",
  "hod",
  "registrar",
  "ssa",
];

const CLASS_READ: NccRole[] = [...ROOM_READ, "teacher"];

const STAFF_AUDIT: NccRole[] = ["super_admin", "branch_admin", "vice_manager"];

const BRANCH_PICKER: NccRole[] = [
  "super_admin",
  "branch_admin",
  "vice_manager",
  "registrar",
  "ssa",
];

/** Built on each call so labels follow the active language. */
export function staffNav(): StaffNavGroup[] {
  return [
    {
      label: copy.nav.overview,
      items: [
        {
          label: copy.nav.dashboard,
          href: "/app/dashboard",
          roles: ALL,
          available: true,
          icon: LayoutDashboard,
        },
        {
          label: copy.nav.forms,
          href: "/app/forms",
          roles: ALL,
          available: true,
          icon: FileText,
        },
        {
          label: copy.nav.notifications,
          href: "/app/notifications",
          roles: ALL,
          available: true,
          icon: Bell,
        },
      ],
    },
    {
      label: copy.nav.admissions,
      items: [
        {
          label: copy.nav.students,
          href: "/app/students",
          roles: ADMISSIONS,
          available: true,
          icon: GraduationCap,
        },
        {
          label: copy.nav.leads,
          href: "/app/leads",
          roles: ADMISSIONS,
          available: true,
          icon: UserPlus,
        },
        {
          label: copy.nav.enrolments,
          href: "/app/enrolments",
          roles: ADMISSIONS,
          available: true,
          icon: ClipboardList,
        },
        {
          label: copy.nav.placementTests,
          href: "/app/placement-tests",
          roles: ADMISSIONS,
          available: true,
          icon: ClipboardCheck,
        },
        {
          label: copy.nav.trialLessons,
          href: "/app/trial-lessons",
          roles: ADMISSIONS,
          available: true,
          icon: Presentation,
        },
      ],
    },
    {
      label: copy.nav.delivery,
      items: [
        {
          label: copy.nav.courses,
          href: "/app/courses",
          roles: ALL,
          available: true,
          icon: BookOpen,
        },
        {
          label: copy.nav.classes,
          href: "/app/classes",
          roles: CLASS_READ,
          available: true,
          icon: School,
        },
        {
          label: copy.nav.sessions,
          href: "/app/sessions",
          roles: ["teacher"],
          available: true,
          icon: CalendarClock,
        },
        {
          label: copy.nav.rooms,
          href: "/app/rooms",
          roles: ROOM_READ,
          available: true,
          icon: DoorOpen,
        },
      ],
    },
    {
      label: copy.nav.organisation,
      items: [
        {
          label: copy.nav.staffUsers,
          href: "/app/staff",
          roles: STAFF_AUDIT,
          available: true,
          icon: Users,
        },
        {
          label: copy.nav.branches,
          href: "/app/branches",
          roles: BRANCH_PICKER,
          available: true,
          icon: Building2,
        },
        {
          label: copy.nav.departments,
          href: "/app/departments",
          roles: ["super_admin"],
          available: true,
          icon: Network,
        },
      ],
    },
    {
      label: copy.nav.setup,
      items: [
        {
          label: copy.nav.lostReasons,
          href: "/app/lost-reasons",
          roles: ["super_admin"],
          available: true,
          icon: UserMinus,
        },
        {
          label: copy.nav.actionReasons,
          href: "/app/action-reasons",
          roles: ["super_admin"],
          available: true,
          icon: ListChecks,
        },
        {
          label: copy.nav.areasOfStudy,
          href: "/app/areas-of-study",
          roles: ["super_admin"],
          available: true,
          icon: Library,
        },
        {
          label: copy.nav.customFields,
          href: "/app/custom-fields",
          roles: ["super_admin"],
          available: true,
          icon: SlidersHorizontal,
        },
      ],
    },
    {
      label: copy.nav.system,
      items: [
        {
          label: copy.nav.moodleSite,
          href: "/app/moodle",
          roles: ["super_admin"],
          available: true,
          icon: Plug,
        },
        {
          label: copy.nav.systemHealth,
          href: "/app/system",
          roles: ["super_admin"],
          available: true,
          icon: Activity,
        },
        {
          label: copy.nav.auditLog,
          href: "/app/audit",
          roles: STAFF_AUDIT,
          available: true,
          icon: ScrollText,
        },
      ],
    },
  ];
}

/** Nav for an active role; hidden until each page is wired in a later phase. */
export function staffNavForRole(role: NccRole): StaffNavGroup[] {
  return staffNav()
    .map(group => ({
      ...group,
      items: group.items.filter(
        item => item.roles.includes(role) && item.available
      ),
    }))
    .filter(group => group.items.length > 0);
}

const STAFF_PREFIX = "/app";

/** Whether `pathname` is allowed for `activeRole` (nav + known exceptions). */
export function canAccess(pathname: string, activeRole: NccRole): boolean {
  const path = pathname.startsWith(STAFF_PREFIX)
    ? pathname
    : `${STAFF_PREFIX}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
  if (path === "/app/profile" || path.startsWith("/app/profile/")) return true;
  if (path === "/app/dashboard" || path.startsWith("/app/dashboard/"))
    return true;
  if (path === "/app/notifications" || path.startsWith("/app/notifications/"))
    return true;
  if (/^\/app\/students\/[^/]+\/report/.test(path)) return true;

  const items = staffNav()
    .flatMap(group => group.items)
    .filter(item => item.available)
    .sort((a, b) => b.href.length - a.href.length);
  for (const item of items) {
    if (path === item.href || path.startsWith(`${item.href}/`)) {
      return item.roles.includes(activeRole);
    }
  }
  return false;
}

/** Roles the assigned role may switch into (strictly lower privilege). */
export function switchableRoles(assigned: NccRole): NccRole[] {
  if (!canSwitchRoles(assigned)) return [];
  return ROLE_ORDER.filter(
    role => ROLE_ORDER.indexOf(role) > ROLE_ORDER.indexOf(assigned)
  );
}

/** Sidebar/top-bar title for a staff path, or a generic fallback. */
export function titleForPath(pathname: string): string {
  if (pathname === "/app/profile" || pathname.startsWith("/app/profile/")) {
    return copy.nav.profile;
  }
  const items = staffNav()
    .flatMap(group => group.items)
    .sort((a, b) => b.href.length - a.href.length);
  for (const item of items) {
    if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
      return item.label;
    }
  }
  return copy.brand.name;
}

/** Breadcrumb trail: the nav group and the longest-matching item. */
export function navTrailForPath(
  pathname: string
): { group: string; item: StaffNavItem } | null {
  const matches: { group: string; item: StaffNavItem }[] = [];
  for (const group of staffNav()) {
    for (const item of group.items) {
      if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
        matches.push({ group: group.label, item });
      }
    }
  }
  matches.sort((a, b) => b.item.href.length - a.item.href.length);
  return matches[0] ?? null;
}
