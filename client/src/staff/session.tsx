import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  applyStoredAuthSession,
  clearLocalAuthSession,
  getStoredAuthSession,
  refreshServerSession,
} from "@/lib/auth/session";
import { copy } from "./copy";
import {
  logoutRequest,
  logoutAllNccRequest,
  setNccSessionScopesRequest,
  switchNccRoleRequest,
  switchWorkspaceRequest,
  type AuthSessionDto,
  type NccRole,
  type NccSessionScopesInputDto,
} from "@/lib/backend/api";

export class StaffApiError extends Error {
  status?: number;
  details?: Record<string, string[]>;
  constructor(message: string, status?: number, details?: Record<string, string[]>) {
    super(message);
    this.name = "StaffApiError";
    this.status = status;
    this.details = details;
  }
}

export function resultOrThrow<T>(result: {
  ok: boolean;
  data?: T;
  error?: string;
  status?: number;
  details?: Record<string, string[]>;
}): T {
  if (!result.ok) {
    throw new StaffApiError(
      result.error ?? copy.state.errorGeneric,
      result.status,
      result.details
    );
  }
  return result.data as T;
}

export interface StaffSessionValue {
  session: AuthSessionDto | null;
  loading: boolean;
  refresh: () => Promise<void>;
  switchRole: (target: NccRole) => Promise<void>;
  setScopes: (scopes: NccSessionScopesInputDto) => Promise<void>;
  switchWorkspace: (branchId: string) => Promise<void>;
  signOut: () => Promise<void>;
  signOutEverywhere: () => Promise<void>;
}

const StaffSessionContext = createContext<StaffSessionValue | null>(null);

export function StaffSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSessionDto | null>(() =>
    getStoredAuthSession()
  );
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const next = await refreshServerSession();
    setSession(next ?? null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = await refreshServerSession();
      if (!cancelled) {
        setSession(next ?? null);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const listener = () => setSession(getStoredAuthSession());
    window.addEventListener("nilelearn:session", listener);
    return () => window.removeEventListener("nilelearn:session", listener);
  }, []);

  const switchRole = useCallback(async (target: NccRole) => {
    const next = resultOrThrow(await switchNccRoleRequest(target)).session;
    applyStoredAuthSession(next);
    setSession(next);
  }, []);

  const setScopes = useCallback(async (scopes: NccSessionScopesInputDto) => {
    const next = resultOrThrow(await setNccSessionScopesRequest(scopes)).session;
    applyStoredAuthSession(next);
    setSession(next);
  }, []);

  const switchWorkspace = useCallback(async (branchId: string) => {
    const next = resultOrThrow(await switchWorkspaceRequest(branchId));
    applyStoredAuthSession(next);
    setSession(next);
  }, []);

  const signOut = useCallback(async () => {
    await logoutRequest().catch(() => undefined);
    clearLocalAuthSession();
    setSession(null);
  }, []);

  const signOutEverywhere = useCallback(async () => {
    await resultOrThrow(await logoutAllNccRequest());
    clearLocalAuthSession();
    setSession(null);
  }, []);

  const value = useMemo<StaffSessionValue>(
    () => ({
      session,
      loading,
      refresh,
      switchRole,
      setScopes,
      switchWorkspace,
      signOut,
      signOutEverywhere,
    }),
    [
      session,
      loading,
      refresh,
      switchRole,
      setScopes,
      switchWorkspace,
      signOut,
      signOutEverywhere,
    ]
  );

  return (
    <StaffSessionContext.Provider value={value}>
      {children}
    </StaffSessionContext.Provider>
  );
}

export function useStaffSession(): StaffSessionValue {
  const ctx = useContext(StaffSessionContext);
  if (!ctx) throw new Error("useStaffSession must be used within StaffSessionProvider");
  return ctx;
}

/** SWR scope segment: role + workspace so switches cannot share caches. */
export function staffScope(session: AuthSessionDto | null): string {
  const ncc = session?.ncc;
  return ncc
    ? `${ncc.activeRole}:${ncc.workspaceBranchId ?? ""}`
    : "anon";
}
