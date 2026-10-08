import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/staff/ui/kit";
import {
  bindNccStaffMoodleRequest,
  cancelNccStaffInvitationRequest,
  disableNccStaffUserRequest,
  enableNccStaffUserRequest,
  inviteNccStaffUserRequest,
  resetNccStaffMoodlePasswordRequest,
  resetNccStaffPasswordRequest,
  type NccStaffUserDto,
} from "@/lib/backend/api";
import { staffWrite, useInvalidate } from "../api";
import { copy } from "../copy";
import { runAction } from "../run-action";
import { useStaffSession } from "../session";
import { CallerPasswordDialog } from "../ui/caller-password-dialog";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { MoodleBindDialog } from "../ui/moodle-bind-dialog";
import { SecretDialog, type StaffSecret } from "../ui/secret-dialog";

const C = copy.staffUsers;

type PendingAction =
  | { kind: "invite"; user: NccStaffUserDto }
  | { kind: "cancel-invitation"; user: NccStaffUserDto }
  | { kind: "password"; user: NccStaffUserDto }
  | { kind: "moodle-password"; user: NccStaffUserDto }
  | { kind: "disable"; user: NccStaffUserDto }
  | { kind: "enable"; user: NccStaffUserDto };

/**
 * The staff row action menu plus every dialog it opens. Shared by the staff
 * list rows and the staff detail header so both stay in sync.
 */
export function StaffActionsMenu({
  user,
  trigger = "icon",
  onEdit,
}: {
  user: NccStaffUserDto;
  /** "icon" renders the compact row trigger; "button" a labelled button. */
  trigger?: "icon" | "button";
  onEdit: () => void;
}) {
  const { session } = useStaffSession();
  const isSelf = user.email.toLowerCase() === (session?.email?.toLowerCase() ?? null);
  const invalidate = useInvalidate();
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [secrets, setSecrets] = useState<StaffSecret[] | null>(null);
  const [moodleBindUser, setMoodleBindUser] =
    useState<NccStaffUserDto | null>(null);

  async function refreshUsers() {
    await invalidate("/api/ncc/directory/users");
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {trigger === "icon" ? (
            <button
              type="button"
              className="staff-icon-btn"
              aria-label={copy.actions.rowActions}
            >
              <MoreHorizontal strokeWidth={1.75} aria-hidden />
            </button>
          ) : (
            <button type="button" className="staff-btn" data-size="sm">
              {copy.staffUsers.moreActions}
            </button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onSelect={onEdit}>
            {copy.actions.edit}
          </DropdownMenuItem>
          {!isSelf && user.status === "invited" ? (
            <>
              <DropdownMenuItem
                onSelect={() =>
                  setPending({ kind: "invite", user })
                }
              >
                {C.resendInvite}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  setPending({ kind: "cancel-invitation", user })
                }
              >
                {C.cancelInvite}
              </DropdownMenuItem>
            </>
          ) : null}
          {!isSelf && user.status === "active" ? (
            <DropdownMenuItem
              onSelect={() => setPending({ kind: "invite", user })}
            >
              {C.invite}
            </DropdownMenuItem>
          ) : null}
          {!isSelf && user.status !== "disabled" ? (
            <DropdownMenuItem
              onSelect={() => setPending({ kind: "password", user })}
            >
              {C.setPassword}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          {!isSelf &&
            (user.moodleLinked ? (
              <DropdownMenuItem
                onSelect={() =>
                  setPending({ kind: "moodle-password", user })
                }
              >
                {C.moodleReset}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => setMoodleBindUser(user)}>
                {C.moodleAccount}
              </DropdownMenuItem>
            ))}
          {!isSelf && user.status === "active" ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-[var(--staff-red)]"
                onSelect={() => setPending({ kind: "disable", user })}
              >
                {copy.actions.disable}
              </DropdownMenuItem>
            </>
          ) : null}
          {!isSelf && user.status === "disabled" ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => setPending({ kind: "enable", user })}
              >
                {copy.actions.enable}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <SecretDialog secrets={secrets} onClose={() => setSecrets(null)} />

      {/* Invite / resend */}
      <ConfirmDialog
        open={pending?.kind === "invite"}
        onOpenChange={open => {
          if (!open) setPending(null);
        }}
        title={C.inviteTitle}
        description={C.inviteBody}
        confirmLabel={C.invite}
        onConfirm={() =>
          runAction(async () => {
            const result = await staffWrite(
              inviteNccStaffUserRequest(pending!.user.id)
            );
            const next: StaffSecret[] = [];
            if (result.oneTime.invitationPath) {
              next.push({
                label: C.invitationLink,
                value: `${window.location.origin}${result.oneTime.invitationPath}`,
              });
            }
            if (next.length) setSecrets(next);
            await refreshUsers();
          })
        }
      />

      <ConfirmDialog
        open={pending?.kind === "cancel-invitation"}
        onOpenChange={open => {
          if (!open) setPending(null);
        }}
        title={C.cancelInviteTitle}
        description={C.cancelInviteBody}
        confirmLabel={C.cancelInvite}
        destructive
        onConfirm={() =>
          runAction(async () => {
            await staffWrite(
              cancelNccStaffInvitationRequest(pending!.user.id)
            );
            await refreshUsers();
          }, { success: C.cancelledToast })
        }
      />

      {/* Set password: Super Admin targets need the caller's own password. */}
      {pending?.kind === "password" && pending.user.emsRole === "super_admin" ? (
        <CallerPasswordDialog
          open
          onOpenChange={open => {
            if (!open) setPending(null);
          }}
          title={C.setPasswordTitle}
          description={C.setPasswordBody}
          confirmLabel={C.setPassword}
          onConfirm={async callerPassword => {
            const result = await runAction(async () => {
              const out = await staffWrite(
                resetNccStaffPasswordRequest(pending!.user.id, callerPassword)
              );
              setSecrets([
                {
                  label: C.temporaryPassword,
                  value: out.oneTime.generatedPassword,
                },
              ]);
            }, { success: C.passwordToast });
            return result !== undefined;
          }}
        />
      ) : (
        <ConfirmDialog
          open={pending?.kind === "password"}
          onOpenChange={open => {
            if (!open) setPending(null);
          }}
          title={C.setPasswordTitle}
          description={C.setPasswordBody}
          confirmLabel={C.setPassword}
          onConfirm={() =>
            runAction(async () => {
              const result = await staffWrite(
                resetNccStaffPasswordRequest(pending!.user.id)
              );
              setSecrets([
                {
                  label: C.temporaryPassword,
                  value: result.oneTime.generatedPassword,
                },
              ]);
            }, { success: C.passwordToast })
          }
        />
      )}

      <ConfirmDialog
        open={pending?.kind === "moodle-password"}
        onOpenChange={open => {
          if (!open) setPending(null);
        }}
        title={C.moodleResetTitle}
        description={C.moodleResetBody}
        confirmLabel={C.moodleReset}
        onConfirm={() =>
          runAction(async () => {
            const result = await staffWrite(
              resetNccStaffMoodlePasswordRequest(pending!.user.id)
            );
            if (result.oneTime.generatedMoodlePassword) {
              setSecrets([
                {
                  label: C.moodlePassword,
                  value: result.oneTime.generatedMoodlePassword,
                },
              ]);
            }
          }, { success: C.moodleToast })
        }
      />

      {/* Disable needs an action reason of kind disable_staff. */}
      <ConfirmDialog
        open={pending?.kind === "disable"}
        onOpenChange={open => {
          if (!open) setPending(null);
        }}
        title={C.disableTitle}
        description={C.disableBody}
        confirmLabel={copy.actions.disable}
        destructive
        reasonKind="disable_staff"
        reasonRequired
        onConfirm={reasonId =>
          runAction(async () => {
            await staffWrite(
              disableNccStaffUserRequest(pending!.user.id, reasonId)
            );
            await refreshUsers();
          }, { success: C.disabledToast })
        }
      />

      <ConfirmDialog
        open={pending?.kind === "enable"}
        onOpenChange={open => {
          if (!open) setPending(null);
        }}
        title={C.enableTitle}
        description={C.enableBody}
        confirmLabel={copy.actions.enable}
        onConfirm={() =>
          runAction(async () => {
            await staffWrite(enableNccStaffUserRequest(pending!.user.id));
            await refreshUsers();
          }, { success: C.enabledToast })
        }
      />

      <MoodleBindDialog
        open={moodleBindUser !== null}
        onOpenChange={open => {
          if (!open) setMoodleBindUser(null);
        }}
        onConfirm={bind =>
          runAction(async () => {
            const result = await staffWrite(
              bindNccStaffMoodleRequest(moodleBindUser!.id, bind)
            );
            if (result.oneTime.generatedMoodlePassword) {
              setSecrets([
                {
                  label: C.moodlePassword,
                  value: result.oneTime.generatedMoodlePassword,
                },
              ]);
            }
            await refreshUsers();
            setMoodleBindUser(null);
          }, { success: C.moodleToast })
        }
      />
    </>
  );
}
