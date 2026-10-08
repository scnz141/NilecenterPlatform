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

/** Typing in a field never toggles the sidebar. */
export function isTypingTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  return Boolean(
    element &&
      (element.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName))
  );
}
