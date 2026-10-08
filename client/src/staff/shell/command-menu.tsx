import { useLocation } from "wouter";
import { LogOut, UserPlus } from "lucide-react";
import { useNcc } from "../api";
import { copy } from "../copy";
import { staffNavForRole } from "../nav";
import { isStaffManager } from "../roles";
import { useStaffSession } from "../session";
import type { NccStaffUserDto } from "@/lib/backend/api";
import { Avatar } from "../ui/primitives";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Dialog,
  DialogContent,
  DialogTitle,
} from "../ui/kit";

export function StaffCommandMenu({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { session, signOut } = useStaffSession();
  const [, navigate] = useLocation();
  const role = session?.ncc?.activeRole ?? "teacher";
  const canManageStaff = isStaffManager(role);
  // Only fetch staff while the menu is open.
  const users = useNcc<{ items: NccStaffUserDto[] }>(
    open && canManageStaff ? "/api/ncc/directory/users" : null,
  );

  function go(href: string) {
    onOpenChange(false);
    navigate(href);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="staff-command" size="lg">
        <DialogTitle className="sr-only">{copy.shell.search}</DialogTitle>
        <Command label={copy.shell.search} loop>
          <CommandInput placeholder={copy.shell.search} autoFocus />
          <CommandList>
            <CommandEmpty>{copy.shell.commandEmpty}</CommandEmpty>
            <CommandGroup heading={copy.shell.commandPages}>
              {staffNavForRole(role).flatMap((group) =>
                group.items.map((item) => (
                  <CommandItem
                    key={item.href}
                    value={item.label}
                    keywords={[group.label]}
                    onSelect={() => go(item.href)}
                  >
                    <item.icon strokeWidth={1.75} aria-hidden />
                    {item.label}
                  </CommandItem>
                )),
              )}
            </CommandGroup>
            {canManageStaff ? (
              <CommandGroup heading={copy.shell.commandPeople}>
                {(users.data?.items ?? []).map((u) => (
                  <CommandItem
                    key={u.id}
                    value={u.id}
                    keywords={[u.name, u.email]}
                    onSelect={() => go(`/app/staff/${u.id}`)}
                  >
                    <Avatar name={u.name} seed={u.id} size="sm" />
                    <span className="ui-command-person">
                      <span>{u.name}</span>
                      <span className="ui-command-person-email">{u.email}</span>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            <CommandGroup heading={copy.shell.commandActions}>
              {canManageStaff ? (
                <CommandItem
                  value={copy.staffUsers.createTitle}
                  onSelect={() => go("/app/staff?new=1")}
                >
                  <UserPlus strokeWidth={1.75} aria-hidden />
                  {copy.staffUsers.createTitle}
                </CommandItem>
              ) : null}
              <CommandItem
                value={copy.shell.signOut}
                onSelect={() => void signOut()}
              >
                <LogOut strokeWidth={1.75} aria-hidden />
                {copy.shell.signOut}
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
