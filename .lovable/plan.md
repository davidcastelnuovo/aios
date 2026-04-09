
# תיקון: כרמן לא מזהה טבלאות Facebook קיימות

## הבעיה
הכלי `sync_meta_ads` מחפש `integration_type = 'meta_ads'`, אבל כל הטבלאות בבסיס הנתונים מוגדרות כ-`facebook_insights` או `facebook_ecommerce`. לכן כרמן תמיד מחזירה "לא נמצאו טבלאות".

## התיקון
### קובץ: `supabase/functions/ai-support-chat/index.ts`

**שורה 1466** — שינוי הפילטר מ:
```typescript
.eq('integration_type', 'meta_ads')
```
ל:
```typescript
.in('integration_type', ['meta_ads', 'facebook_insights', 'facebook_ecommerce'])
```

**שורה 1499** — גם ב-`sync-meta-ads-data` Edge Function, צריך לתמוך ב-`facebook_insights` בנוסף ל-`meta_ads`.

### קובץ: `supabase/functions/sync-meta-ads-data/index.ts`

**שורה ~59** — שינוי הבדיקה מ:
```typescript
if (table.integration_type !== 'meta_ads')
```
ל:
```typescript
if (!['meta_ads', 'facebook_insights', 'facebook_ecommerce'].includes(table.integration_type))
```

## תוצאה
כרמן תזהה את כל טבלאות הפייסבוק הקיימות ותוכל לסנכרן אותן בהצלחה.
