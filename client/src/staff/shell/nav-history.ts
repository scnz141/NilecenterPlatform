import { useSyncExternalStore } from "react";

/**
 * This tab's in-app history, kept in step with the browser's. wouter fires
 * `pushState`, `replaceState` and `popstate` events; each history entry is
 * tagged with its position (silently, through the unpatched History method),
 * so Back and Forward always land on the right record. Lets the Back control
 * return to the list with its filters and scroll intact.
 */
type Entry = { path: string; search: string; scroll: number };
type NavType = "push" | "replace" | "pop" | "load";

const STORE_KEY = "nilelearn.staff.history";
const TAG = "__nlIndex";
const LIMIT = 100;

let entries: Entry[] = [];
let index = 0;
let navType: NavType = "load";
let version = 0;
const listeners = new Set<() => void>();
let installed = false;

const here = (): Entry => ({ path: location.pathname, search: location.search, scroll: 0 });

function tag() {
  const state = history.state && typeof history.state === "object" ? history.state : {};
  History.prototype.replaceState.call(history, { ...state, [TAG]: index }, "");
}

function save() {
  try {
    sessionStorage.setItem(STORE_KEY, JSON.stringify({ entries, index }));
  } catch {
    // Private mode: history lives for this page only.
  }
}

function changed(type: NavType) {
  navType = type;
  version += 1;
  save();
  listeners.forEach(listener => listener());
}

function onPush() {
  entries = entries.slice(0, index + 1);
  entries.push(here());
  if (entries.length > LIMIT) entries = entries.slice(entries.length - LIMIT);
  index = entries.length - 1;
  tag();
  changed("push");
}

function onReplace() {
  const previous = entries[index];
  entries[index] = { ...here(), scroll: previous?.path === location.pathname ? previous.scroll : 0 };
  tag();
  changed("replace");
}

function onPop() {
  const tagged = (history.state as Record<string, unknown> | null)?.[TAG];
  if (typeof tagged === "number" && entries[tagged]) {
    index = tagged;
    entries[index] = { ...entries[index], path: location.pathname, search: location.search };
  } else {
    // An entry from before this app loaded: start a fresh stack here.
    entries = [here()];
    index = 0;
    tag();
  }
  changed("pop");
}

export function installNavHistory() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  try {
    const stored = JSON.parse(sessionStorage.getItem(STORE_KEY) ?? "null") as {
      entries: Entry[];
      index: number;
    } | null;
    const tagged = (history.state as Record<string, unknown> | null)?.[TAG];
    if (stored && typeof tagged === "number" && stored.entries[tagged]?.path === location.pathname) {
      entries = stored.entries;
      index = tagged;
    }
  } catch {
    // Unreadable store: start fresh.
  }
  if (!entries.length) {
    entries = [here()];
    index = 0;
  }
  tag();
  save();
  window.addEventListener("pushState", onPush);
  window.addEventListener("replaceState", onReplace);
  window.addEventListener("popstate", onPop);
}

export function useNavHistory(): { navType: NavType; version: number } {
  useSyncExternalStore(
    listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => version,
    () => 0
  );
  return { navType, version };
}

export function lastNavType(): NavType {
  return navType;
}

export function rememberScroll(top: number) {
  if (entries[index]) entries[index].scroll = top;
}

export function savedScroll(): number {
  return entries[index]?.scroll ?? 0;
}

/**
 * How many steps back the closest earlier page is, when that page is `path`.
 * Query-only changes on the current page (tabs, filters) are skipped.
 */
export function stepsBackTo(path: string): number | null {
  const current = entries[index]?.path;
  let j = index - 1;
  while (j >= 0 && entries[j].path === current) j -= 1;
  return j >= 0 && entries[j].path === path ? j - index : null;
}

/** The filters a list had when it was last visited in this tab. */
export function lastSearchFor(path: string): string {
  for (let j = entries.length - 1; j >= 0; j -= 1) {
    if (entries[j].path === path) return entries[j].search;
  }
  return "";
}

/** Test hook: reset the module state. */
export function resetNavHistoryForTests() {
  entries = [];
  index = 0;
  navType = "load";
  version = 0;
  installed = false;
}
