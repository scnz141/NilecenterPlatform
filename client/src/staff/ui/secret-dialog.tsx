import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/staff/ui/kit";
import { copy } from "../copy";

export interface StaffSecret {
  label: string;
  value: string;
}

/**
 * Shows one-time secrets (generated passwords, invitation links) that the API
 * returns exactly once. They are never stored or fetched again.
 */
export function SecretDialog({
  secrets,
  onClose,
}: {
  secrets: StaffSecret[] | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  async function copyValue(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      toast.success(copy.staffUsers.copied);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error(copy.state.errorGeneric);
    }
  }

  const C = copy.staffUsers;

  return (
    <Dialog open={secrets !== null} onOpenChange={open => !open && onClose()}>
      <DialogContent size="sm">
        <DialogHeader className="min-w-0">
          <DialogTitle className="flex items-center gap-2">
            {C.secretTitle}
          </DialogTitle>
          <DialogDescription>{C.secretBody}</DialogDescription>
        </DialogHeader>
        <div className="flex min-w-0 flex-col gap-3">
          {(secrets ?? []).map(secret => (
            <div key={secret.label} className="flex min-w-0 flex-col gap-1.5">
              <span className="staff-muted text-xs font-semibold uppercase tracking-wide">
                {secret.label}
              </span>
              <div className="flex min-w-0 items-start gap-2 rounded-md border border-[var(--staff-border)] bg-[var(--staff-sand)] p-2">
                <code className="min-w-0 flex-1 break-all text-sm">
                  {secret.value}
                </code>
                <button
                  type="button"
                  className="staff-btn shrink-0"
                  data-size="sm"
                  onClick={() => void copyValue(secret.value)}
                  aria-label={`${C.copyValue} ${secret.label}`}
                >
                  {copied === secret.value ? C.copied : C.copyValue}
                </button>
              </div>
            </div>
          ))}
          <p className="staff-muted">{C.secretShare}</p>
        </div>
        <DialogFooter>
          <button
            type="button"
            className="staff-btn"
            data-variant="primary"
            onClick={onClose}
          >
            {C.secretDone}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
