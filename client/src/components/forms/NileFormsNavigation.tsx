import "@/styles/nile-forms.css";
import {
  ClipboardList,
  FilePenLine,
  Import,
  Inbox,
  WifiOff,
} from "lucide-react";
import { Link, useLocation } from "wouter";

import type { Role } from "@/lib/platformData";
import {
  canManageForms,
  canUseOfflineForms,
  formsRoute,
} from "@/lib/forms/routes";

export default function NileFormsNavigation({ role }: { role: Role }) {
  const [location] = useLocation();
  const items = [
    {
      label: "Assigned",
      href: formsRoute(role),
      icon: ClipboardList,
      show: true,
      active:
        location === formsRoute(role) ||
        (location.startsWith(`${formsRoute(role)}/`) &&
          !location.includes("/manage") &&
          !location.includes("/review") &&
          !location.includes("/offline") &&
          !location.includes("/migration")),
    },
    {
      label: "Offline",
      href: formsRoute(role, "/offline"),
      icon: WifiOff,
      show: canUseOfflineForms(role),
      active: location.includes("/forms/offline"),
    },
    {
      label: "Manage",
      href: formsRoute(role, "/manage"),
      icon: FilePenLine,
      show: canManageForms(role),
      active: location.includes("/forms/manage"),
    },
    {
      label: "Review",
      href: formsRoute(role, "/review"),
      icon: Inbox,
      show: canManageForms(role),
      active: location.includes("/forms/review"),
    },
    {
      label: "Migration",
      href: formsRoute(role, "/migration"),
      icon: Import,
      show: role === "superadmin",
      active: location.includes("/forms/migration"),
    },
  ].filter(item => item.show);

  return (
    <nav className="nile-forms-subnav" aria-label="Forms">
      {items.map(item => {
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={item.active ? "is-active" : ""}
            aria-current={item.active ? "page" : undefined}
          >
            <Icon size={15} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
