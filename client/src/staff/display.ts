import { useLayoutEffect, useSyncExternalStore } from "react";
import { mountStaffLocale } from "./i18n";

/**
 * Display size for the staff app. The base type scale already grows with the
 * viewport (see staff.css). This multiplier adds headroom for wall displays
 * and meeting-room screens viewed from a distance. Stored per device.
 */
export type DisplaySize = "standard" | "large" | "xlarge";

export const DISPLAY_SIZES: DisplaySize[] = ["standard", "large", "xlarge"];

const STORAGE_KEY = "staff.displaySize";
// Large and Extra large add headroom for meeting-room viewing distances
// (about 1 inch of letter height per 10 to 20 feet of viewing distance).
const SCALE: Record<DisplaySize, string> = {
  standard: "1",
  large: "1.25",
  xlarge: "1.5",
};

const listeners = new Set<() => void>();

function read(): DisplaySize {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return DISPLAY_SIZES.includes(value as DisplaySize)
      ? (value as DisplaySize)
      : "standard";
  } catch {
    return "standard";
  }
}

export function setDisplaySize(size: DisplaySize) {
  try {
    window.localStorage.setItem(STORAGE_KEY, size);
  } catch {
    /* preference only */
  }
  document.documentElement.style.setProperty("--ui-scale", SCALE[size]);
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useDisplaySize(): DisplaySize {
  return useSyncExternalStore(subscribe, read, () => "standard");
}

/**
 * Marks the document as the staff app while mounted, so portaled layers share
 * its styles, display scale, language, and direction.
 */
export function useStaffDocument() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.add("staff-ui");
    root.style.setProperty("--ui-scale", SCALE[read()]);
    const restoreLocale = mountStaffLocale();
    return () => {
      root.classList.remove("staff-ui");
      root.style.removeProperty("--ui-scale");
      restoreLocale();
    };
  }, []);
}
