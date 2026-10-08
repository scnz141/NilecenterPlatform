import { useState, type ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/staff/ui/kit";
import { Spinner } from "@/staff/ui/kit";
import { copy } from "../copy";
import { ConfirmDialog } from "./confirm-dialog";

/**
 * Right-side form sheet with a sticky Save/Cancel footer. Confirms before
 * closing while `dirty`. `fieldErrors` (e.g. provider 422 details) render under
 * matching fields via `errorFor(name)`. Submit must throw to keep the sheet
 * open on failure.
 */
export function FormSheet({
  open,
  onOpenChange,
  title,
  description,
  dirty,
  saving,
  fieldErrors,
  onSubmit,
  children,
  saveLabel = copy.actions.save,
  saveDisabled = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  dirty: boolean;
  saving: boolean;
  fieldErrors?: Record<string, string[]>;
  onSubmit: () => Promise<void> | void;
  children: ReactNode | ((errorFor: (name: string) => string | null) => ReactNode);
  saveLabel?: string;
  /** Disables the primary action when there is nothing to save. */
  saveDisabled?: boolean;
}) {
  const [confirmClose, setConfirmClose] = useState(false);

  function requestClose() {
    if (saving) return;
    if (dirty) {
      setConfirmClose(true);
      return;
    }
    onOpenChange(false);
  }

  const errorFor = (name: string) => fieldErrors?.[name]?.join(" ") ?? null;

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={next => {
          if (!next) requestClose();
          else onOpenChange(true);
        }}
      >
        <SheetContent
          side="right"
          className="staff-form-sheet"
          onInteractOutside={event => {
            if (dirty) event.preventDefault();
          }}
        >
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
            {description ? (
              <SheetDescription>{description}</SheetDescription>
            ) : null}
          </SheetHeader>
          <form
            className="staff-sheet-form"
            onSubmit={event => {
              event.preventDefault();
              if (saving) return;
              void onSubmit();
            }}
          >
            <div className="staff-sheet-body">
              {typeof children === "function" ? children(errorFor) : children}
            </div>
            <div className="staff-sheet-footer">
              <button
                type="button"
                className="staff-btn"
                disabled={saving}
                onClick={requestClose}
              >
                {copy.actions.cancel}
              </button>
              <button
                type="submit"
                className="staff-btn"
                data-variant="primary"
                disabled={saving || saveDisabled}
              >
                {saving ? (
                  <Spinner aria-hidden />
                ) : null}
                {saving ? copy.actions.saving : saveLabel}
              </button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
      <ConfirmDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        title={copy.actions.discardTitle}
        description={copy.actions.discardBody}
        confirmLabel={copy.actions.discard}
        destructive
        onConfirm={() => {
          setConfirmClose(false);
          onOpenChange(false);
        }}
      />
    </>
  );
}

export function StaffField({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="staff-field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {error ? (
        <span className="staff-field-error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
