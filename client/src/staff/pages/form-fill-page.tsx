import "@/styles/nile-forms.css";
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
  const invalidate = useInvalidate();
  const bundle = useNcc<FormResponderBundle>(
    publicationId ? `/api/forms/assigned/${encodeURIComponent(publicationId)}` : null
  );
  useStaffCrumb(bundle.data?.definition.title ?? null);

  if (bundle.error) return <ErrorState error={bundle.error} onRetry={() => void bundle.mutate()} />;
  if (!bundle.data) return <LoadingRows />;
  return (
    <div className="staff-fill">
      <NileFormRenderer
        bundle={bundle.data}
        mode="assigned"
        onSubmitted={() => {
          toast.success(F.sentToast);
          void invalidate("/api/forms");
          navigate("/app/forms?tab=fill");
        }}
      />
    </div>
  );
}
