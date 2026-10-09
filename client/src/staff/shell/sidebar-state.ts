import { useSyncExternalStore } from "react";

const KEY = "nilelearn.staff.sidebar";
const listeners = new Set<() => void>();

function read(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "collapsed";
  } catch {
    return false;
  }
}

/** Collapse or expand the desktop sidebar; remembered on this device. */
export function setSidebarCollapsed(collapsed: boolean) {
  try {
    window.localStorage.setItem(KEY, collapsed ? "collapsed" : "expanded");
  } catch {
    // Private mode: the choice lasts for this page only.
  }
  listeners.forEach(listener => listener());
}

export function useSidebarCollapsed(): boolean {
  return useSyncExternalStore(
    listener => {
      listeners.add(listener);
      const onStorage = (event: StorageEvent) => event.key === KEY && listener();
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(listener);
        window.removeEventListener("storage", onStorage);
      };
    },
    read,
    () => false
  );
}

/* ---------- Folded navigation groups ------------------------------------ */

const FOLD_KEY = "nilelearn.staff.sidebar.folded";
const foldListeners = new Set<() => void>();
let foldCache: { raw: string | null; ids: ReadonlySet<string> } = {
  raw: null,
  ids: new Set(),
};

function readFolded(): ReadonlySet<string> {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(FOLD_KEY);
  } catch {
    raw = null;
  }
  // useSyncExternalStore needs a stable snapshot for unchanged storage.
  if (raw === foldCache.raw) return foldCache.ids;
  let ids: string[] = [];
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) ids = parsed.filter(id => typeof id === "string");
  } catch {
    ids = [];
  }
  foldCache = { raw, ids: new Set(ids) };
  return foldCache.ids;
}

/** Fold or unfold one navigation group; remembered on this device. */
export function toggleGroupFolded(id: string) {
  const next = new Set(readFolded());
  if (next.has(id)) next.delete(id);
  else next.add(id);
  try {
    window.localStorage.setItem(FOLD_KEY, JSON.stringify(Array.from(next)));
  } catch {
    foldCache = { raw: foldCache.raw, ids: next };
  }
  foldListeners.forEach(listener => listener());
}

const EMPTY_FOLDED: ReadonlySet<string> = new Set();

export function useFoldedGroups(): ReadonlySet<string> {
  return useSyncExternalStore(
    listener => {
      foldListeners.add(listener);
      const onStorage = (event: StorageEvent) =>
        event.key === FOLD_KEY && listener();
      window.addEventListener("storage", onStorage);
      return () => {
        foldListeners.delete(listener);
        window.removeEventListener("storage", onStorage);
      };
    },
    readFolded,
    () => EMPTY_FOLDED
  );
}

/** Typing in a field never toggles the sidebar. */
export function isTypingTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  return Boolean(
    element &&
      (element.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName))
  );
}
