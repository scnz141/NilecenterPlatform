import { useSyncExternalStore } from "react";
import { getDirection } from "@/lib/i18n";
import { ar } from "./copy.ar";
import { tr } from "./copy.tr";
import { copy, enMessages, type StaffMessages } from "./copy";

/**
 * Staff app language. Shares the `nilelearn.locale` preference with the rest
 * of Nile Learn. A language is listed only when its dictionary is complete.
 */
export type StaffLocale = "en" | "ar" | "tr";

export const STAFF_LOCALES: { value: StaffLocale; label: string }[] = [
  { value: "en", label: "English" },
  { value: "ar", label: "العربية" },
  { value: "tr", label: "Türkçe" },
];

const STORAGE_KEY = "nilelearn.locale";
const DICTIONARIES: Record<StaffLocale, StaffMessages> = { en: enMessages, ar, tr };
const INTL_TAGS: Record<StaffLocale, string> = {
  en: "en-GB",
  ar: "ar-EG-u-nu-latn",
  tr: "tr-TR",
};

let current: StaffLocale = "en";
const listeners = new Set<() => void>();

function readStored(): StaffLocale {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "ar" || stored === "tr" ? stored : "en";
  } catch {
    return "en";
  }
}

type Tree = { [key: string]: string | Tree };

function assignLeaves(target: Tree, source: Tree) {
  for (const key of Object.keys(source)) {
    const value = source[key];
    if (typeof value === "string") target[key] = value;
    else assignLeaves(target[key] as Tree, value);
  }
}

function loadCopy(locale: StaffLocale) {
  current = locale;
  assignLeaves(copy as unknown as Tree, DICTIONARIES[locale] as unknown as Tree);
}

function apply(locale: StaffLocale) {
  loadCopy(locale);
  const root = document.documentElement;
  root.lang = locale;
  root.dir = getDirection(locale);
}

// Strings are ready before the first staff render. The document attributes
// change only while the staff app is mounted (mountStaffLocale).
if (typeof window !== "undefined") loadCopy(readStored());

/** Loads the stored language. Returns a function that restores the document. */
export function mountStaffLocale() {
  const root = document.documentElement;
  const previous = { lang: root.lang, dir: root.dir };
  apply(readStored());
  return () => {
    root.lang = previous.lang;
    root.dir = previous.dir;
  };
}

export function setStaffLocale(locale: StaffLocale) {
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    /* preference only */
  }
  apply(locale);
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useStaffLocale(): StaffLocale {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => "en"
  );
}

/** BCP 47 tag for Intl formatting in the active language. */
export function intlLocale(): string {
  return INTL_TAGS[current];
}

/** Dates never break across lines in tables. */
function keepTogether(value: string): string {
  return value.replace(/ /g, "\u00a0");
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return keepTogether(
    date.toLocaleDateString(intlLocale(), {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  );
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return keepTogether(
    date.toLocaleString(intlLocale(), {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    })
  );
}
