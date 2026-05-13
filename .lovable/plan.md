## הבעיה

ב-`CampaignerTasksTab.tsx` (טאב משימות בעמוד הקמפיינרים) השאילתה מסננת רק לפי `campaigner_id` בלי שום סינון לפי הארגון הנוכחי:

```ts
supabase.from("tasks").select(...).eq("campaigner_id", campaignerId)
```

מכיוון שקמפיינרים יכולים להיות משותפים בין ארגונים (cross-tenant via `campaigner_agencies`), כל המשימות שלהם בכל הארגונים זולגות לתצוגה — גם משימות של DMM-LTD, MarketingCaptain וכו' מופיעות תחת ה-tab של הקמפיינר ב-DMM.

## התיקון

ב-`src/components/campaigners/CampaignerTasksTab.tsx`:

1. למשוך את `tenantId` הנוכחי מ-`useCurrentTenant()`.
2. להוסיף סינון `tenant_id` לשאילתה כך שיוצגו רק:
   - משימות שה-`tenant_id` שלהן = הארגון הנוכחי, **או**
   - משימות שה-`client_id` שלהן שייך ללקוח בארגון הנוכחי (במקרים נדירים שה-tenant_id לא מוגדר על המשימה אבל הלקוח כן בארגון).
3. להוסיף `tenantId` ל-queryKey כדי שהקאש יתרענן בעת החלפת ארגון.

הגישה הפשוטה והבטוחה: `.eq("tenant_id", tenantId)` — תואם ל-RLS הקיים ולעקרון ה-Core memory ש-RLS SELECT צריך להתאים בדיוק לסינון בצד הלקוח.

```ts
const { tenantId } = useCurrentTenant();

let query = supabase
  .from("tasks")
  .select(`...`)
  .eq("campaigner_id", campaignerId)
  .eq("tenant_id", tenantId)         // ← חדש
  .order("due_date", { ascending: false });
```

ועדכון:
```ts
queryKey: ["campaigner-tasks", tenantId, campaignerId, dateFilter],
enabled: !!campaignerId && !!tenantId,
```

## מה לא משתנה

- אין שינוי ב-RLS / migrations.
- אין שינוי בלוגיקת ההרשאות שתוקנה בהודעות הקודמות (Clients, Tasks, Dashboard, DynamicTables).
- שום קומפוננטה אחרת לא משתנה.

## קובץ שמשתנה

- `src/components/campaigners/CampaignerTasksTab.tsx` בלבד.
