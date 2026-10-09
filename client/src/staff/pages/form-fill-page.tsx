import "@/styles/nile-forms.css";
import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";
import NileFormRenderer from "@/components/forms/NileFormRenderer";
import type { FormResponderBundle } from "../../../../server/nileFormsService";
import { useInvalidate, useNcc } from "../api";
import { copy } from "../copy";
import { useStaffCrumb } from "../shell/staff-shell";
import { ErrorState, LoadingRows } from "../ui/primitives";

const F = copy.forms;

/** Answer a form assigned to me (or my role) without leaving the staff app. */
export default function FormFillPage() {
  const { publicationId } = useParams<{ publicationId: string }>();
  const [, navigate] = useLocation();
  const [submitted, setSubmitted] = useState(false);
  const invalidate = useInvalidate();
  const bundle = useNcc<FormResponderBundle>(
    publicationId ? `/api/forms/assigned/${encodeURIComponent(publicationId)}` : null
  );
  useStaffCrumb(bundle.data?.definition.title ?? null);

  // After submitting, EMS 409s the assigned-bundle refetch — keep rendering
  // the last bundle (the renderer shows its own success panel) instead of
  // replacing the page with an error state.
  if (bundle.error && !bundle.data)
    return <ErrorState error={bundle.error} onRetry={() => void bundle.mutate()} />;
  if (!bundle.data) return <LoadingRows />;
  return (
    <div className="staff-fill">
      <NileFormRenderer
        bundle={bundle.data}
        mode="assigned"
        onSubmitted={() => {
          setSubmitted(true);
          toast.success(F.sentToast);
          void invalidate("/api/forms");
        }}
      />
      {submitted ? (
        <div className="staff-fill-done">
          <button
            type="button"
            className="staff-btn"
            data-variant="primary"
            onClick={() => navigate("/app/forms?tab=fill")}
          >
            {F.backToForms}
          </button>
        </div>
      ) : null}
    </div>
  );
}
