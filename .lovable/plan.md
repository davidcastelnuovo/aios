## הבעיה

בדיאלוג "שיוך אתר ללקוח" (`src/pages/WordPressSettings.tsx`, סביב שורות 1242–1330) הבחירה של הלקוח היא `<Select>` רגיל ללא חיפוש, והרשימה מסוננת רק ללקוחות של הסוכנות שנבחרה (`linkAgency` → `clients.agency_id = linkAgency`).

לכן "א.י זוהר עץ" לא מופיע ב-DMM-LTD — או שהוא משויך לסוכנות אחרת בארגון DMM, או שאין לו `agency_id` בכלל. בנוסף אין שדה חיפוש, אז גם כשהרשימה ארוכה אי אפשר למצוא לפי שם.

## הפתרון

### 1. רשימת לקוחות מורחבת (שאילתה)
ב-`linkClients` query (שורות 452–475):
- כשנבחרה סוכנות — להביא גם לקוחות עם `agency_id = linkAgency` וגם לקוחות באותו `tenant_id` עם `agency_id IS NULL` (כך שלקוחות לא משויכים לסוכנות יופיעו ולא ייעלמו).
- להוסיף הודעת עזרה קטנה כשמסומנת סוכנות: "מציג לקוחות הסוכנות + לקוחות ללא סוכנות בארגון".
- כשלא נבחרה סוכנות אך יש `linkEffectiveTenantId` — להמשיך להביא את כל לקוחות הארגון (כבר עובד).

### 2. Combobox עם חיפוש במקום Select
להחליף את ה-`<Select>` של הלקוח (שורות ~1307–1326) ב-Combobox מבוסס `Popover` + `Command` (כמו ב-`src/components/ui/command.tsx`, דפוס שכבר בשימוש בפרויקט):
- שדה חיפוש בעברית "חפש לקוח לפי שם…"
- סינון client-side על `c.name` (כולל normalize לרווחים/נקודות כדי ש-"אי זוהר" ימצא "א.י זוהר עץ").
- הצגת שם הארגון בסוגריים כשהלקוח חוצה-ארגוני (כמו היום).
- אופציית "ללא" בראש הרשימה.
- הצגת state ריק: "לא נמצאו לקוחות" / "אין לקוחות בארגון".

### 3. ללא שינויים נוספים
- שמירה (`save_link` mutation), RLS, ועמודת ה-`Select` של ה-tenant/agency נשארים כפי שהם.
- לא נוגעים בטופס "הוסף/ערוך אתר" הגדול (שורות 700–818) — רק בדיאלוג השיוך המהיר.

## פרטים טכניים

- קובץ יחיד שמשתנה: `src/pages/WordPressSettings.tsx`.
- שאילתה: שינוי `q = q.eq("agency_id", linkAgency)` ל-`q = q.or(\`agency_id.eq.${linkAgency},and(agency_id.is.null,tenant_id.eq.${linkEffectiveTenantId})\`)` (עם `linkEffectiveTenantId` ידוע).
- Combobox: `Popover` + `Command`/`CommandInput`/`CommandList`/`CommandItem` (קומפוננטות קיימות ב-`@/components/ui`).
- שמירה על `dir="rtl"` בתוך ה-Popover.
- אין שינוי DB / edge functions / RLS.
