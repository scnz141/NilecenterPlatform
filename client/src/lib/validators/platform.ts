import { z } from "zod";

export const leadFormSchema = z.object({
  fullName: z.string().min(2, "Enter a full name"),
  email: z.string().email("Enter a valid email"),
  phone: z.string().min(7, "Enter a phone or WhatsApp number"),
  country: z.string().optional(),
  preferredLanguage: z.string().optional(),
  subject: z.string().min(1, "Choose a subject"),
  ageGroup: z.string().optional(),
  preferredSchedule: z.string().optional(),
  notes: z.string().optional(),
});

export const placementFormSchema = leadFormSchema.extend({
  branch: z.string().min(1, "Choose a branch"),
  preferredDate: z.string().min(1, "Choose a preferred date"),
  currentLevel: z.string().min(1, "Choose a current level"),
});

export const platformRecordSchema = z.object({
  title: z.string().min(2, "Title is required"),
  owner: z.string().min(2, "Owner is required"),
  date: z.string().min(1, "Date is required"),
  status: z.string().min(1, "Status is required"),
  notes: z.string().optional(),
});

export type LeadFormValues = z.infer<typeof leadFormSchema>;
export type PlacementFormValues = z.infer<typeof placementFormSchema>;
export type PlatformRecordValues = z.infer<typeof platformRecordSchema>;
