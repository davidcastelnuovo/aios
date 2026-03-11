

# הפרדה קריטית: אינטגרציה ראשית (CRM) מול פלוו

## הבעיה

כרגע שני הנתיבים מעורבבים:

1. **Pass 1 (CRM)** יוצר ליד → קורא ל-`trigger-automation` עם `trigger_type: 'lead_created'` → `trigger-automation` מחפש **גם** flow trigger steps (שורה 316-321) → פלווים עם טריגר `lead_created` עלולים להיתפס
2. **Pass 2 (Flow)** יוצר ליד **ב-CRM** של הטננט של הפלוו (שורה 605) → גם קורא ל-`trigger-automation` → ייתכן שגם אוטומציות CRM רגילות נתפסות

```text
כרגע:
┌─────────────────┐          ┌──────────────────┐
│  Pass 1 (CRM)   │──lead──▶ │ trigger-automation│──▶ CRM automations + FLOWS (!)
└─────────────────┘          └──────────────────┘
┌─────────────────┐          ┌──────────────────┐
│  Pass 2 (Flow)  │──lead──▶ │ trigger-automation│──▶ CRM automations (!) + FLOWS
└─────────────────┘          └──────────────────┘

נדרש:
┌─────────────────┐          ┌──────────────────┐
│  Pass 1 (CRM)   │──lead──▶ │ trigger-automation│──▶ CRM automations בלבד
└─────────────────┘          └──────────────────┘
┌─────────────────┐          ┌──────────────────┐
│  Pass 2 (Flow)  │─────────▶│ trigger-automation│──▶ הפלוו הספציפי בלבד
└─────────────────┘          └──────────────────┘
```

## הפתרון

### 1. `trigger-automation/index.ts` — הוספת פרמטר `source`

הוספת שדה `source` ל-payload:
- `source: 'crm'` → מחפש **רק** אוטומציות CRM רגילות (שורות 300-306), **מדלג** על חיפוש flow trigger steps (שורות 316-357)
- `source: 'flow'` + `automation_id` → מריץ **רק** את הפלוו הספציפי שצוין, לא מחפש אוטומציות אחרות

### 2. `cron-sync-facebook-leads/index.ts` — Pass 1

שורות 225-248 ו-363-386: הוספת `source: 'crm'` ל-payload של `trigger-automation`:
```typescript
body: JSON.stringify({
  trigger_type: 'lead_created',
  source: 'crm',  // ← חדש
  data: { ... },
  tenant_id: integration.tenant_id,
}),
```

### 3. `cron-sync-facebook-leads/index.ts` — Pass 2

שורות 636-660: שינוי לקריאה ישירה לאוטומציה הספציפית במקום trigger גנרי:
```typescript
body: JSON.stringify({
  automationId: info.automationId,  // ← ישירות לפלוו
  source: 'flow',
  data: {
    ...leadData,
    facebook_form_id: info.formId,
    ...fbFields,
  },
}),
```

### 4. `facebook-lead-webhook/index.ts` — אותה הפרדה

כשה-Webhook יוצר ליד, גם הוא צריך לשלוח `source: 'flow'` + `automationId` ספציפי (אם מגיע מפלוו) או `source: 'crm'` (אם מגיע מאינטגרציה ראשית).

### 5. הפרדה בין טפסים בפלוו

כבר קיימת בשורה 332 של `trigger-automation`:
```typescript
if (config.facebook_form_id && config.facebook_form_id !== payloadData?.facebook_form_id) return false
```
אבל כעת עם הקריאה הישירה (`automationId`), ההפרדה מובטחת ברמת ה-Pass 2 — כל טופס מופנה ישירות לפלוו שלו.

### קבצים לעריכה:
1. **`supabase/functions/trigger-automation/index.ts`** — תמיכה ב-`source` parameter, דילוג על flows כש-`source: 'crm'`
2. **`supabase/functions/cron-sync-facebook-leads/index.ts`** — Pass 1 שולח `source: 'crm'`, Pass 2 שולח `automationId` ישירות
3. **`supabase/functions/facebook-lead-webhook/index.ts`** — אותה הפרדה

