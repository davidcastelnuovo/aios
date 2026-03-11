

# תיקון: לידים מפייסבוק ללא פרטים + תצוגה מקדימה בטסט

## שורש הבעיה

שתי בעיות נפרדות:

### 1. הסנכרון לא שומר פרטי ליד מטפסים עם שדות CUSTOM
טופס `860909982017655` מגדיר את כל השדות כ-`CUSTOM`:
- "נשמח לדעת את שמכם" (type: CUSTOM) — זה השם
- "מספר הטלפון שלכם" (type: CUSTOM) — זה הטלפון
- "האם יש לך מוצרים..." (type: CUSTOM) — שאלה

הקוד בודק רק `FULL_NAME`, `PHONE`, `EMAIL` — שדות CUSTOM נדלגים לגמרי, ולכן `company_name` נופל ל-"ליד מפייסבוק" והשאר null.

### 2. ה-Enrichment מ-Facebook API נכשל
לידים ישנים (מעל 90 יום) לא זמינים ב-API. הלוגים מראים:
```
❌ Facebook API error: 400 - Object does not exist
```
לכן גם ה-enrichment בזמן טסט לא עובד.

### 3. ה-notes לא כולל את ערכי השדות
ה-notes שומר רק `leadgen_id` ו-`Facebook Form` — לא את הנתונים עצמם.

## פתרון

### קובץ 1: `supabase/functions/cron-sync-facebook-leads/index.ts`
שורות ~579-599 — הוספת הכרה בשדות CUSTOM:

```typescript
for (const ff of formFields) {
  const val = fieldData[ff.key] || fieldData[ff.label] || '';
  if (!val) continue;
  
  if (ff.type === 'FULL_NAME') { mappedName = val; }
  else if (ff.type === 'PHONE') { mappedPhone = val; }
  else if (ff.type === 'EMAIL') { mappedEmail = val; }
  else if (ff.type === 'CUSTOM') {
    // Heuristic: check label/key for name/phone/email keywords
    const lbl = (ff.label || ff.key || '').toLowerCase();
    if (!mappedName && (lbl.includes('שם') || lbl.includes('name'))) mappedName = val;
    if (!mappedPhone && (lbl.includes('טלפון') || lbl.includes('phone') || lbl.includes('נייד'))) mappedPhone = val;
    if (!mappedEmail && (lbl.includes('אימייל') || lbl.includes('דוא') || lbl.includes('email') || lbl.includes('mail'))) mappedEmail = val;
  }
}
```

גם לשמור את ערכי השדות ב-notes:
```typescript
// Build notes with actual field values
let notesLines = [`leadgen_id: ${leadgenId}`, `Facebook Form: ${info.formId}`];
for (const [k, v] of Object.entries(fieldData)) {
  if (v) notesLines.push(`fb_${k}: ${v}`);
}
notesLines.push(`Created: ${fbLead.created_time || 'unknown'}`, 'Source: Flow-based sync');
const notes = notesLines.join('\n');
```

### קובץ 2: `supabase/functions/trigger-automation/index.ts`
עדכון ה-enrichment: במקום לפנות ל-Facebook API (שנכשל), לנתח את ה-notes של הליד ולחלץ שדות `fb_*` משם:

```typescript
// Parse fb_ fields from notes instead of calling Facebook API
if (payloadData.test && !hasFbFields && payloadData.notes) {
  const lines = String(payloadData.notes).split('\n');
  for (const line of lines) {
    const match = line.match(/^(fb_[^:]+):\s*(.+)$/);
    if (match) {
      payloadData[match[1]] = match[2].trim();
    }
  }
}
```
להסיר את הקריאה ל-Facebook API מה-enrichment (כי היא לא עובדת לרוב הלידים).

### קובץ 3: `src/components/automations/TestFlowWithLeadDialog.tsx`
הוספת תצוגה מקדימה של פרמטרים כשליד נבחר (ליד יחיד):
- כשנבחר ליד אחד בלבד, להציג תיבה עם הפרמטרים שייקחו מה-notes (fb_ fields)
- לנתח את ה-notes ולהציג את השדות שנמצאו
- להציג אזהרה אם אין שדות fb_ ב-notes

```
┌──────────────────────────────────┐
│ 📋 פרמטרים שימשכו לטסט:         │
│ fb_נשמח_לדעת_את_שמכם: דוד כהן  │
│ fb_מספר_הטלפון_שלכם: 0501234567 │
│ contact_name: דוד כהן            │
│ phone: 0501234567                │
└──────────────────────────────────┘
```

## קבצים לעריכה:
1. `supabase/functions/cron-sync-facebook-leads/index.ts` — heuristic ל-CUSTOM + שמירת ערכים ב-notes
2. `supabase/functions/trigger-automation/index.ts` — enrichment מ-notes במקום Facebook API
3. `src/components/automations/TestFlowWithLeadDialog.tsx` — תצוגה מקדימה של פרמטרים

