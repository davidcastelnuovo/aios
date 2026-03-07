

# הוספת פיצ'רים לדף Gmail + אינטגרציית AIOS

## 3 דרישות:
1. **סימון אימיילים + קטגוריה** — כבר קיים חלקית (assign category בהובר), צריך להוסיף multi-select עם checkbox
2. **מחיקת אימיילים + חסימת שולחים** — חסימה קיימת, צריך להוסיף מחיקה (trash) דרך Gmail API + פעולות bulk
3. **AIOS גישה לאימיילים** — הוספת tools חדשים ל-`ai-support-chat` Edge Function

## שינויים

### 1. Frontend — `src/pages/Gmail.tsx`
- **Multi-select**: הוסיף `selectedIds: Set<string>` state + checkbox בכל שורה + toolbar עליון כשיש סימונים
- **Toolbar פעולות bulk**: כפתורי "קטגוריה", "מחק", "חסום" שפועלים על כל הנבחרים
- **כפתור מחיקה**: בהובר על שורה (ליד חסימה) + ב-bulk toolbar
- **Select All**: checkbox ב-header לסימון/ביטול כל ההודעות

### 2. Backend — `supabase/functions/gmail-api/index.ts`
- **action: `trash`** — קריאה ל-Gmail API `POST /messages/{id}/trash` למחיקת הודעה
- **action: `batchModify`** — מחיקה/סימון מרובה (optional, אפשר גם loop בצד לקוח)

### 3. AIOS — `supabase/functions/ai-support-chat/index.ts`
הוספת 4 tools חדשים:

- **`list_emails`** — שליפת רשימת אימיילים (query, maxResults, date)
  - קורא ל-`gmail-api` עם action: list
- **`get_email`** — קריאת אימייל ספציפי
  - קורא ל-`gmail-api` עם action: get
- **`send_email`** — שליחת אימייל
  - קורא ל-`gmail-api` עם action: send
- **`delete_email`** — מחיקת אימייל
  - קורא ל-`gmail-api` עם action: trash

כל ה-tools יקראו ל-Edge Function `gmail-api` עם ה-Authorization header של המשתמש (כבר מועבר ב-auth).

### 4. עדכון System Prompt ב-AIOS
הוספת תיאור ליכולות Gmail בסעיף "פעולות שאתה יכול לבצע":
```
7. **אימיילים** - קריאה, שליחה, מחיקה של אימיילים מ-Gmail
```

## סיכום קבצים שישתנו:
1. `src/pages/Gmail.tsx` — multi-select + bulk actions + delete button
2. `supabase/functions/gmail-api/index.ts` — action: trash
3. `supabase/functions/ai-support-chat/index.ts` — 4 email tools + system prompt

