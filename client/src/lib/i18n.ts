export type Locale = "en" | "ar" | "tr" | "ru" | "fr" | "id" | "ms" | "de" | "fa" | "zh" | "kk" | "ky" | "uz";

export const localeOptions: { value: Locale; label: string; dir: "ltr" | "rtl" }[] = [
  { value: "en", label: "English", dir: "ltr" },
  { value: "ar", label: "العربية", dir: "rtl" },
  { value: "tr", label: "Turkish", dir: "ltr" },
  { value: "ru", label: "Russian", dir: "ltr" },
  { value: "fr", label: "French", dir: "ltr" },
  { value: "id", label: "Indonesian", dir: "ltr" },
  { value: "ms", label: "Malay", dir: "ltr" },
  { value: "de", label: "German", dir: "ltr" },
  { value: "fa", label: "Persian", dir: "rtl" },
  { value: "zh", label: "Chinese", dir: "ltr" },
  { value: "kk", label: "Kazakh", dir: "ltr" },
  { value: "ky", label: "Kyrgyz", dir: "ltr" },
  { value: "uz", label: "Uzbek", dir: "ltr" },
];

const translations = {
  en: {
    search: "Search students, courses, classes, teachers, invoices",
    quickActions: "Quick actions",
    notifications: "Notifications",
    language: "Language",
    branch: "Branch",
    term: "Term",
    accessDenied: "Access denied",
    save: "Save",
    cancel: "Cancel",
    export: "Export",
    markRead: "Mark read",
  },
  ar: {
    search: "ابحث عن الطلاب والدورات والفصول والمعلمين والفواتير",
    quickActions: "إجراءات سريعة",
    notifications: "الإشعارات",
    language: "اللغة",
    branch: "الفرع",
    term: "الفصل",
    accessDenied: "غير مصرح",
    save: "حفظ",
    cancel: "إلغاء",
    export: "تصدير",
    markRead: "تحديد كمقروء",
  },
} as const;

export function getDirection(locale: Locale): "ltr" | "rtl" {
  return localeOptions.find((option) => option.value === locale)?.dir ?? "ltr";
}

export function t(locale: Locale, key: keyof typeof translations.en): string {
  if (locale === "ar") return translations.ar[key] ?? translations.en[key];
  return translations.en[key];
}

