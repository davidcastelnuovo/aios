
## הבעיה
כשיוצרים/שולחים דוח (`ClientReportPanel`) או דשבורד (`ClientDashboardPanel`), לפעמים נוצר קישור שיתוף **חדש** למרות שכבר קיים קישור באותה טבלה/דשבורד.

### למה זה קורה
ב-`ensureShareLink` / `ensureShareToken` הבדיקה היא רק `if (shareLink) return shareLink` — אבל ה-state `shareLink` מגיע מ-React Query עם תנאי `is_active = true` בלבד:
```ts
.eq("table_id", table.id)
.eq("is_active", true)   // ← מסנן קישורים לא-פעילים
.limit(1)
```

תוצאה — נוצר קישור כפול בשני מקרים:
1. **קיים קישור לא פעיל** באותה טבלה (`is_active=false`) → השאילתה מחזירה `null` → `ensureShareLink` מכניס שורה חדשה.
2. **השאילתה עדיין לא הושלמה** (race condition) כשהמשתמש לוחץ "שלח" מהר → `shareLink` עדיין `null` → נוצר קישור נוסף.

## הפתרון

### 1. `ensureShareLink` ב-`ClientReportPanel.tsx` (שורות 276–304)
לפני `INSERT` — לבצע שאילתה ישירה ל-DB שמחפשת **כל** שיתוף קיים לטבלה (ללא סינון `is_active`):
- אם נמצא קישור לא פעיל → להפעיל אותו מחדש (`UPDATE is_active = true`) ולהחזיר את ה-token הקיים.
- אם לא נמצא כלום → רק אז ליצור חדש.

### 2. `ensureShareToken` ב-`ClientDashboardPanel.tsx` (שורות 152–179)
אותה לוגיקה — שאילתה ישירה ל-`dashboard_shares` לפי `dashboard_id`, החזרת קיים (גם לא פעיל אחרי הפעלה מחדש), אחרת יצירה חדשה.

### 3. עדכון השאילתה הראשית
להסיר את `eq("is_active", true)` מ-`useQuery` של `table-share-link` ו-`dashboard-share-link`, כדי שגם קישור שלא פעיל יוצג ויטופל. במקום זאת — בצד ה-UI להציג חיווי "לא פעיל" (אופציונלי).

## קבצים לעריכה
- `src/components/clients/ClientReportPanel.tsx` — תיקון `ensureShareLink` + שאילתת `table-share-link`.
- `src/components/clients/ClientDashboardPanel.tsx` — תיקון `ensureShareToken` + שאילתת `dashboard-share-link`.

## תוצאה צפויה
לכל טבלה/דשבורד יהיה לכל היותר **קישור שיתוף אחד** — קיים יוּפעל מחדש במקום ייווצר חדש.
