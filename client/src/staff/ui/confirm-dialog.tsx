import { useEffect, useState, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/staff/ui/kit";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/staff/ui/kit";
import { Spinner } from "@/staff/ui/kit";
import { Link } from "wouter";
import type {
  NccActionReasonDto,
  NccActionReasonKind,
} from "@/lib/backend/api";
import { useNcc } from "../api";
import { copy } from "../copy";

/**
 * Controlled confirmation dialog with a pending state.
 *
 * Reason sources, in order of precedence:
 * - `reasonKind`: loads active action reasons for that kind from the settings
 *   API while the dialog is open. When `reasonRequired` is true (the upstream
 *   contract requires a reason body) an empty reason list blocks confirmation
 *   and shows a link to the action-reasons page.
 * - `reasons`: caller-supplied list; confirm stays disabled until one is
 *   selected.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  destructive,
  reasons,
  reasonKind,
  reasonRequired,
  reasonLabel = "Reason",
  reasonsEmpty: reasonsEmptyContent,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
  reasons?: { id: string; label: string }[];
  reasonKind?: NccActionReasonKind;
  reasonRequired?: boolean;
  reasonLabel?: string;
  /** Rendered instead of the default action-reasons hint when the required
   *  reason list is empty (e.g. the account cannot list lost reasons). */
  reasonsEmpty?: ReactNode;
  onConfirm: (reasonId?: string) => Promise<void> | void;
}) {
  const [pending, setPending] = useState(false);
  const [reasonId, setReasonId] = useState("");
  const loadedReasons = useNcc<{ items: NccActionReasonDto[] }>(
    open && reasonKind ? "/api/ncc/settings/action-reasons" : null,
    { kind: reasonKind, activeOnly: true }
  );

  useEffect(() => {
    if (!open) setReasonId("");
  }, [open]);

  const reasonOptions =
    reasons ??
    loadedReasons.data?.items.map(item => ({ id: item.id, label: item.name }));
  const reasonsReady = reasons !== undefined || !loadedReasons.isLoading;
  const reasonsEmpty = reasonsReady && (reasonOptions?.length ?? 0) === 0;

  const needsReason = Boolean(reasonKind) || Boolean(reasons);
  const blocked = Boolean(needsReason && reasonRequired && reasonsEmpty);
  const canConfirm =
    !pending &&
    (!needsReason ||
      (reasonsReady && (Boolean(reasonId) || (!reasonRequired && reasonsEmpty))));

  async function confirm() {
    setPending(true);
    try {
      await onConfirm(needsReason && reasonId ? reasonId : undefined);
      onOpenChange(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={next => {
        if (pending) return;
        onOpenChange(next);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>
        {needsReason && !blocked ? (
          <div className="staff-field">
            <span className="staff-field-label">{reasonLabel}</span>
            <Select
              value={reasonId || undefined}
              onValueChange={value => setReasonId(value ?? "")}
              disabled={pending || !reasonsReady}
            >
              <SelectTrigger aria-label={reasonLabel} className="w-full">
                <SelectValue
                  placeholder={
                    reasonsReady ? reasonLabel : copy.state.loading
                  }
                />
              </SelectTrigger>
              <SelectContent className="z-[70]">
                {(reasonOptions ?? []).map(reason => (
                  <SelectItem key={reason.id} value={reason.id}>
                    {reason.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        {blocked ? (
          (reasonsEmptyContent ?? (
            <p className="staff-confirm-reason-missing">
              {copy.actions.noReasons}{" "}
              <Link href="/app/action-reasons" className="staff-link">
                {copy.actions.openActionReasons}
              </Link>
            </p>
          ))
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>
            {copy.actions.cancel}
          </AlertDialogCancel>
          <button
            type="button"
            className="staff-btn"
            data-variant={destructive ? "destructive" : "primary"}
            disabled={!canConfirm}
            onClick={() => void confirm()}
          >
            {pending ? (
              <Spinner aria-hidden />
            ) : null}
            {confirmLabel}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
