import { useState } from "react";
import { toast } from "sonner";
import {
  changePasswordRequest,
  deleteNccAuthSessionRequest,
  type NccAuthSessionDto,
  type NccSelfProfileDto,
} from "@/lib/backend/api";
import { useNcc } from "../api";
import { copy } from "../copy";
import { intlLocale } from "../i18n";
import { roleLabel } from "../roles";
import { runAction } from "../run-action";
import { useStaffSession } from "../session";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { StaffField } from "../ui/form-sheet";
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  PageHeader,
  StatusBadge,
} from "../ui/primitives";

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(intlLocale(), {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function DetailsCard() {
  const { session } = useStaffSession();
  const profile = useNcc<{ profile: NccSelfProfileDto }>(
    "/api/ncc/account/profile"
  );
  const ncc = session?.ncc;

  const raw = profile.data
    ? `${profile.data.profile.firstName} ${profile.data.profile.lastName}`.trim()
    : session?.name;
  const name = raw && raw.trim() ? raw : copy.profile.nameNotSet;

  return (
    <section className="staff-card" aria-labelledby="staff-profile-details">
      <h2
        id="staff-profile-details"
        className="mb-3 text-base font-semibold"
        style={{ fontSize: "1rem" }}
      >
        {copy.profile.details}
      </h2>
      {profile.error ? (
        <ErrorState
          error={profile.error}
          onRetry={() => void profile.mutate()}
        />
      ) : (
        <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
          <div>
            <dt className="staff-muted">{copy.profile.name}</dt>
            <dd>{profile.isLoading ? "…" : name}</dd>
          </div>
          <div>
            <dt className="staff-muted">{copy.profile.email}</dt>
            <dd>{session?.email}</dd>
          </div>
          <div>
            <dt className="staff-muted">{copy.profile.role}</dt>
            <dd>{ncc ? roleLabel(ncc.assignedRole) : ""}</dd>
          </div>
          {ncc && ncc.activeRole !== ncc.assignedRole ? (
            <div>
              <dt className="staff-muted">{copy.shell.viewingAs}</dt>
              <dd>{roleLabel(ncc.activeRole)}</dd>
            </div>
          ) : null}
          {profile.data?.profile.phone ? (
            <div>
              <dt className="staff-muted">{copy.profile.phone}</dt>
              <dd>{profile.data.profile.phone}</dd>
            </div>
          ) : null}
        </dl>
      )}
    </section>
  );
}

function PasswordCard() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setFormError(null);
    if (newPassword !== confirmPassword) {
      setFormError(copy.profile.passwordsDiffer);
      return;
    }
    setSaving(true);
    try {
      const result = await changePasswordRequest({
        currentPassword,
        newPassword,
      });
      if (!result.ok) {
        setFormError(result.error ?? copy.profile.passwordFailed);
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success(copy.profile.passwordChanged);
    } finally {
      setSaving(false);
    }
  }

  const disabled =
    saving || !currentPassword || !newPassword || !confirmPassword;

  return (
    <section className="staff-card" aria-labelledby="staff-profile-password">
      <h2
        id="staff-profile-password"
        className="mb-3 font-semibold"
        style={{ fontSize: "1rem" }}
      >
        {copy.profile.changePassword}
      </h2>
      <form
        className="flex max-w-sm flex-col gap-3"
        onSubmit={event => {
          event.preventDefault();
          void submit();
        }}
      >
        <StaffField label={copy.profile.currentPassword} htmlFor="staff-pw-current">
          <input
            id="staff-pw-current"
            type="password"
            className="staff-input"
            autoComplete="current-password"
            value={currentPassword}
            onChange={event => setCurrentPassword(event.target.value)}
          />
        </StaffField>
        <StaffField label={copy.profile.newPassword} htmlFor="staff-pw-new">
          <input
            id="staff-pw-new"
            type="password"
            className="staff-input"
            autoComplete="new-password"
            value={newPassword}
            onChange={event => setNewPassword(event.target.value)}
          />
        </StaffField>
        <StaffField label={copy.profile.confirmPassword} htmlFor="staff-pw-confirm">
          <input
            id="staff-pw-confirm"
            type="password"
            className="staff-input"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={event => setConfirmPassword(event.target.value)}
          />
        </StaffField>
        {formError ? (
          <p className="staff-field-error" role="alert">
            {formError}
          </p>
        ) : null}
        <div>
          <button
            type="submit"
            className="staff-btn"
            data-variant="primary"
            disabled={disabled}
          >
            {saving ? copy.actions.saving : copy.profile.changePassword}
          </button>
        </div>
      </form>
    </section>
  );
}

function SessionsCard() {
  const { signOutEverywhere } = useStaffSession();
  const sessions = useNcc<{ items: NccAuthSessionDto[] }>(
    "/api/ncc/auth/sessions"
  );
  const [confirmAll, setConfirmAll] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  async function revoke(sessionId: string) {
    setBusy(sessionId);
    try {
      await runAction(
        async () => {
          const result = await deleteNccAuthSessionRequest(sessionId);
          if (!result.ok) {
            throw new Error(result.error ?? copy.state.errorGeneric);
          }
          await sessions.mutate();
        },
        { success: copy.profile.sessionRevoked }
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="staff-card" aria-labelledby="staff-profile-sessions">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2
            id="staff-profile-sessions"
            className="font-semibold"
            style={{ fontSize: "1rem" }}
          >
            {copy.profile.sessions}
          </h2>
          <p className="staff-muted">{copy.profile.sessionsHint}</p>
        </div>
        <button
          type="button"
          className="staff-btn"
          data-variant="destructive-outline"
          onClick={() => setConfirmAll(true)}
        >
          {copy.profile.signOutEverywhere}
        </button>
      </div>
      {sessions.isLoading ? (
        <LoadingRows rows={3} />
      ) : sessions.error ? (
        <ErrorState
          error={sessions.error}
          onRetry={() => void sessions.mutate()}
        />
      ) : !sessions.data || sessions.data.items.length === 0 ? (
        <EmptyState title={copy.state.empty} />
      ) : (
        <ul>
          {sessions.data.items.map(item => (
            <li key={item.id} className="staff-session-row">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {item.userAgent ?? copy.profile.unknownDevice}
                </p>
                <p className="staff-muted">
                  {copy.profile.issued} {formatWhen(item.issuedAt)} ·{" "}
                  {copy.profile.lastSeen} {formatWhen(item.lastSeenAt)}
                </p>
              </div>
              {item.isCurrent ? (
                <StatusBadge status="active" label={copy.profile.thisSession} />
              ) : (
                <button
                  type="button"
                  className="staff-btn"
                  data-size="sm"
                  disabled={busy !== null}
                  onClick={() => void revoke(item.id)}
                >
                  {busy === item.id
                    ? copy.state.loading
                    : copy.profile.signOutSession}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={confirmAll}
        onOpenChange={setConfirmAll}
        title={copy.profile.signOutEverywhereTitle}
        description={copy.profile.signOutEverywhereBody}
        confirmLabel={copy.profile.signOutEverywhere}
        destructive
        onConfirm={() => signOutEverywhere()}
      />
    </section>
  );
}

export default function StaffProfilePage() {
  return (
    <>
      <PageHeader
        title={copy.profile.title}
        description={copy.profile.description}
      />
      <DetailsCard />
      <PasswordCard />
      <SessionsCard />
    </>
  );
}

