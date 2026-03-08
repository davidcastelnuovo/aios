

# תיקון באג: מעבר בין ארגונים לא עובד

## שורש הבעיה

`TenantProvider` נמצא **מחוץ** ל-Routes (שורה 120 ב-App.tsx), ולכן `useParams()` מחזיר תמיד `undefined` עבור `tenantSlug`. זה אומר:

1. השאילתה `tenant-by-slug` **אף פעם לא רצה** (כי `enabled: !!tenantSlug` = false)
2. הלוגיקה של "URL wins" (שורות 52-66) **אף פעם לא מופעלת**
3. ה-tenant תמיד נקבע לפי `localStorage` / `user_active_tenant` ולא לפי ה-URL
4. בנוסף, הסנכרון ל-DB (שורות 100-116) הוא fire-and-forget אבל `isActiveTenantSynced` נהפך ל-`true` מיד (שורה 123), מה שיוצר race condition

## הפתרון

### שינוי 1: TenantContext.tsx - לפרסר את ה-slug מה-URL ישירות

במקום להסתמך על `useParams()` (שלא עובד מחוץ ל-Route), לפרסר את ה-slug מ-`window.location.pathname` ולהאזין לשינויי ניווט:

```typescript
// במקום: const { tenantSlug } = useParams();
// להשתמש ב:
const [tenantSlug, setTenantSlug] = useState<string | null>(() => {
  const match = window.location.pathname.match(/^\/t\/([^/]+)/);
  return match ? match[1] : null;
});

// + useEffect שמאזין לשינויי URL (popstate + interval fallback)
```

### שינוי 2: TenantContext.tsx - להמתין לסנכרון DB לפני שחרור

לשנות את הסנכרון ל-DB מ-fire-and-forget ל-await, כך ש-`isActiveTenantSynced` יהפוך ל-`true` רק אחרי שה-DB באמת עודכן:

```typescript
// במקום fire-and-forget:
const { data: { user } } = await supabase.auth.getUser();
if (user) {
  const { error } = await supabase
    .from("user_active_tenant")
    .upsert({ ... }, { onConflict: "user_id" });
  // רק עכשיו: setIsActiveTenantSynced(true)
}
```

### שינוי 3: AppSidebar.tsx - הסרת `useParams` המיותר

`useCurrentTenant` כבר יחזיר את ה-tenant הנכון אחרי התיקון, אז אין צורך ב-`displayTenantId` נפרד.

## סיכום קבצים לשינוי

| קובץ | שינוי |
|-------|-------|
| `src/contexts/TenantContext.tsx` | פירסור slug מ-URL ישירות + await לסנכרון DB |
| `src/components/layout/AppSidebar.tsx` | פישוט - שימוש ב-`currentTenantId` ישירות |

