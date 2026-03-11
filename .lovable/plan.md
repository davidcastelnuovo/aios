

# תיקון: לידים מפייסבוק עדיין ללא שדות fb_ ב-notes

## שורש הבעיה

הלידים שמוצגים בצילום המסך נוצרו דרך ה-**Webhook** (לא ה-Cron). ה-Webhook שומר notes בפורמט אחר:

```
Facebook Lead ID: 123456
Form ID: 860909...
Source: Facebook Lead Ads (via Flow)

--- שדות טופס פייסבוק ---
field1: value1
field2: value2
```

אבל ה-enrichment ב-`trigger-automation` מחפש פורמט `fb_field: value`. בנוסף, ה-Webhook **לא מחיל** את ה-CUSTOM heuristic לשם/טלפון/אימייל.

## שינויים נדרשים

### 1. `supabase/functions/facebook-lead-webhook/index.ts`
**שורות ~200-230 (Flow path):**
- הוסיף CUSTOM heuristic (כמו ב-cron) למיפוי שם/טלפון/אימייל מ-flowFieldData
- שנה את פורמט ה-notes לשמור `fb_key: value` (כמו ב-cron) במקום הפורמט הנוכחי

**שורות ~370-400 (Non-flow/legacy path):**
- אותו דבר — שמירת `fb_key: value` ב-notes + CUSTOM heuristic

### 2. `supabase/functions/trigger-automation/index.ts`
**שורות ~416-435 (FB enrichment block):**
- הרחבת הפרסור כדי לתפוס גם את הפורמט הישן: שורות אחרי `--- שדות טופס פייסבוק ---` ללא prefix `fb_` — להוסיף `fb_` prefix אוטומטית

### 3. `src/components/automations/TestFlowWithLeadDialog.tsx`
- אותו דבר בתצוגה מקדימה — לפרסר גם את הפורמט הישן של notes

כך גם לידים ישנים (שנוצרו לפני התיקון) וגם חדשים יעבדו.

