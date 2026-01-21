import { z } from "zod";

/**
 * שדות משותפים לטפסי לקוחות וליידים
 */
export const commonContactFields = {
  phone: z.string().optional(),
  email: z.string().email("כתובת אימייל לא תקינה").optional().or(z.literal("")),
  notes: z.string().optional(),
};

/**
 * סכימה ללקוח בדיאלוג המרה
 */
export const convertClientSchema = z.object({
  name: z.string().min(1, "שם הוא שדה חובה"),
  agency_id: z.string().min(1, "סוכנות היא שדה חובה"),
  ...commonContactFields,
});

/**
 * סכימה לליד בדיאלוג המרה
 */
export const convertLeadSchema = z.object({
  company_name: z.string().min(1, "שם החברה הוא שדה חובה"),
  contact_name: z.string().optional(),
  agency_id: z.string().optional(),
  ...commonContactFields,
});

/**
 * סכימה לקבוצה בדיאלוג המרה
 */
export const convertGroupSchema = z.object({
  group_name: z.string().min(1, "שם הקבוצה הוא שדה חובה"),
  agency_id: z.string().optional(),
  description: z.string().optional(),
});

/**
 * טיפוסים מיוצאים
 */
export type ConvertClientFormValues = z.infer<typeof convertClientSchema>;
export type ConvertLeadFormValues = z.infer<typeof convertLeadSchema>;
export type ConvertGroupFormValues = z.infer<typeof convertGroupSchema>;
