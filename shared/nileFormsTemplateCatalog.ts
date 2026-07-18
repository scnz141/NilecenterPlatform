import type { FormDefinition, LocalizedText } from "./nileForms.js";

export const nileFormsTemplateKeys = [
  "enquiry",
  "application",
  "placement",
  "support",
  "attendance_exception",
  "consent",
  "incident",
] as const;

export type NileFormsTemplateKey = (typeof nileFormsTemplateKeys)[number];

export const nileFormsTemplateCategories: Record<
  NileFormsTemplateKey,
  FormDefinition["category"]
> = {
  enquiry: "admissions",
  application: "admissions",
  placement: "admissions",
  support: "student_support",
  attendance_exception: "attendance",
  consent: "consent",
  incident: "branch_operations",
};

export const nileFormsTemplateCatalog: Array<{
  key: NileFormsTemplateKey;
  category: FormDefinition["category"];
  title: Required<LocalizedText>;
}> = [
  {
    key: "enquiry",
    category: "admissions",
    title: {
      en: "Free trial enquiry",
      ar: "طلب حصة تجريبية",
      tr: "Ücretsiz deneme talebi",
    },
  },
  {
    key: "application",
    category: "admissions",
    title: {
      en: "Course application",
      ar: "طلب الالتحاق بدورة",
      tr: "Ders başvurusu",
    },
  },
  {
    key: "placement",
    category: "admissions",
    title: {
      en: "Placement request",
      ar: "طلب اختبار تحديد المستوى",
      tr: "Seviye belirleme talebi",
    },
  },
  {
    key: "support",
    category: "student_support",
    title: {
      en: "Student support request",
      ar: "طلب دعم للطالب",
      tr: "Öğrenci destek talebi",
    },
  },
  {
    key: "attendance_exception",
    category: "attendance",
    title: {
      en: "Attendance exception request",
      ar: "طلب استثناء للحضور",
      tr: "Devam istisnası talebi",
    },
  },
  {
    key: "consent",
    category: "consent",
    title: {
      en: "Learning consent acknowledgment",
      ar: "إقرار الموافقة على التعلم",
      tr: "Öğrenim onayı beyanı",
    },
  },
  {
    key: "incident",
    category: "branch_operations",
    title: {
      en: "Branch incident or maintenance request",
      ar: "بلاغ حادث أو صيانة في الفرع",
      tr: "Şube olay veya bakım talebi",
    },
  },
];
