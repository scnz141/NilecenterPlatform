import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/staff/ui/kit";
import { Spinner } from "@/staff/ui/kit";
import { copy } from "../copy";

/**
 * Step-up dialog: collects the signed-in user's own EMS password and hands it
 * to `onConfirm`. The action runs only after confirmation; the password is
 * held in state only for the duration of the request.
 */
export function CallerPasswordDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel: string;
  /** Return true when the action succeeded; the dialog then closes. */
  onConfirm: (callerPassword: string) => Promise<boolean>;
}) {
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!password || submitting) return;
    setSubmitting(true);
    try {
      const ok = await onConfirm(password);
      if (ok) {
        setPassword("");
        onOpenChange(false);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const C = copy.staffUsers;

  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        if (!next) setPassword("");
        onOpenChange(next);
      }}
    >
      <DialogContent size="sm">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description ? (
              <DialogDescription>{description}</DialogDescription>
            ) : null}
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <p className="staff-muted">{C.yourPasswordHint}</p>
            <div className="staff-field">
              <label htmlFor="staff-caller-password">{C.yourPassword}</label>
              <input
                id="staff-caller-password"
                type="password"
                className="staff-input"
                required
                autoComplete="current-password"
                value={password}
                onChange={event => setPassword(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <button
              type="button"
              className="staff-btn"
              disabled={submitting}
              onClick={() => onOpenChange(false)}
            >
              {copy.actions.cancel}
            </button>
            <button
              type="submit"
              className="staff-btn"
              data-variant="primary"
              disabled={submitting || !password}
            >
              {submitting ? (
                <Spinner aria-hidden />
              ) : null}
              {confirmLabel}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
