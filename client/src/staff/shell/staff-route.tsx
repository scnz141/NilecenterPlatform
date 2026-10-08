import { Fragment, type ReactNode } from "react";
import { Redirect, Route } from "wouter";
import { copy } from "../copy";
import { useStaffDocument } from "../display";
import { staffGateDecision } from "../gate";
import { useStaffLocale } from "../i18n";
import { useStaffSession, StaffSessionProvider } from "../session";
import "../staff.css";
import { LoadingCenter } from "../ui/primitives";
import { WorkspaceGate } from "./workspace-gate";
import { StaffShell } from "./staff-shell";

/** Remounts the staff tree when the language changes so every string re-reads copy. */
function StaffLocaleRoot({ path, children }: { path: string; children: ReactNode }) {
  useStaffDocument();
  const locale = useStaffLocale();
  return (
    <Fragment key={locale}>
      <StaffGate path={path}>{children}</StaffGate>
    </Fragment>
  );
}

function StaffGate({ path, children }: { path: string; children: ReactNode }) {
  const { session, loading } = useStaffSession();
  const decision = staffGateDecision(session, loading, path);

  if (decision === "loading") {
    return (
      <div className="staff-app staff-gate">
        <LoadingCenter label={copy.shell.checkingSession} />
      </div>
    );
  }
  if (decision === "login") {
    return <Redirect to="/login" />;
  }
  if (decision === "workspace") {
    return <WorkspaceGate />;
  }

  return (
    <StaffShell path={path}>
      {decision === "denied" ? (
        <div className="staff-error" role="alert">
          <span className="staff-state-title">{copy.shell.noAccess}</span>
          <span className="staff-state-body">{copy.shell.noAccessHint}</span>
        </div>
      ) : (
        children
      )}
    </StaffShell>
  );
}

/** Route guard for the unified staff app. Requires an NCC staff session. */
export function StaffRoute({
  path,
  children,
}: {
  path: string;
  children: ReactNode;
}) {
  return (
    <Route path={path}>
      <StaffSessionProvider>
        <StaffLocaleRoot path={path}>{children}</StaffLocaleRoot>
      </StaffSessionProvider>
    </Route>
  );
}
