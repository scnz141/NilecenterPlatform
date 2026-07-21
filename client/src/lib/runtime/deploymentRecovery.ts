const RELOAD_MARKER_KEY = "nilelearn.runtime.stale-deployment-reload";
const RELOAD_RETRY_WINDOW_MS = 60_000;

interface ReloadMarker {
  href: string;
  attemptedAt: number;
}

interface ReloadMarkerStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function claimStaleDeploymentReload(
  storage: ReloadMarkerStorage,
  href: string,
  now = Date.now()
): boolean {
  try {
    const value = storage.getItem(RELOAD_MARKER_KEY);
    const marker = value ? (JSON.parse(value) as Partial<ReloadMarker>) : null;

    if (
      marker?.href === href &&
      typeof marker.attemptedAt === "number" &&
      now - marker.attemptedAt < RELOAD_RETRY_WINDOW_MS
    ) {
      return false;
    }

    storage.setItem(
      RELOAD_MARKER_KEY,
      JSON.stringify({ href, attemptedAt: now } satisfies ReloadMarker)
    );
  } catch {
    // A refresh is still the safest recovery when browser storage is unavailable.
  }

  return true;
}

export function installStaleDeploymentRecovery(): void {
  window.addEventListener("vite:preloadError", event => {
    event.preventDefault();

    if (
      claimStaleDeploymentReload(window.sessionStorage, window.location.href)
    ) {
      window.location.reload();
    }
  });
}
