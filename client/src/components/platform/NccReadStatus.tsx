import { Link } from "wouter";
import type { NccReadState } from "@/lib/backend/nccReadState";

export default function NccReadStatus({
  state,
  onRetry,
}: {
  state: NccReadState<unknown>;
  onRetry?: () => void;
}) {
  if (state.status === "loading") {
    return (
      <div className="platform-empty-state" role="status">
        <strong>Loading from EMS</strong>
      </div>
    );
  }
  if (state.status === "unavailable") {
    return (
      <div className="platform-empty-state" role="status">
        <strong>This EMS data is not connected in this environment yet.</strong>
      </div>
    );
  }
  if (state.status === "workspace") {
    return (
      <div className="platform-empty-state" role="status">
        <strong>Choose a branch to continue.</strong>
        <Link
          className="platform-secondary-button"
          href="/auth/select-workspace"
        >
          Choose branch
        </Link>
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div className="platform-empty-state" role="alert">
        <strong>EMS data could not be loaded</strong>
        <span>{state.message}</span>
        {onRetry ? (
          <button
            type="button"
            className="platform-secondary-button"
            onClick={onRetry}
          >
            Retry
          </button>
        ) : null}
      </div>
    );
  }
  return null;
}
