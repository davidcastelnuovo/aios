

# תוכנית: מעקב לידים בפלאו — משיכה מתאריך + דדופ לכל פלאו

## הבעיה
כרגע הפלאו מושך לידים מפייסבוק ומשתמש ב-`leadgen_id` בתוך ה-`notes` של טבלת `leads` כדי לזהות כפילויות. אבל:
1. אין אפשרות להגדיר מאיזה תאריך להתחיל למשוך
2. לידים שעוברים בפלאו **לא בהכרח נכנסים ל-CRM** — אז אין דרך לדעת אם ליד כבר עובד
3. צריך טבלת מעקב נפרדת שתשמור לכל פלאו איזה `leadgen_id` כבר עובד

## שינויים

### 1. טבלת מעקב חדשה: `flow_processed_leads`
```sql
CREATE TABLE public.flow_processed_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  leadgen_id text NOT NULL,
  facebook_form_id text,
  processed_at timestamptz DEFAULT now(),
  UNIQUE(automation_id, leadgen_id)
);

ALTER TABLE flow_processed_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view flow processed leads in their tenant"
ON flow_processed_leads FOR SELECT TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Service can manage flow processed leads"
ON flow_processed_leads FOR ALL TO service_role USING (true);

CREATE INDEX idx_flow_processed_leads_automation ON flow_processed_leads(automation_id, leadgen_id);
```

### 2. Frontend: הגדרת `sync_since_date` בטריגר
**קובץ:** `src/components/automations/StepConfigPanel.tsx`

בקומפוננטת `LeadSourceConfig`, כשהמקור הוא `facebook_form`, להוסיף שדה תאריך "משוך לידים מתאריך":
- Input מסוג `date` שנשמר ב-`configuration.sync_since_date`
- ברירת מחדל: ריק (= מרגע ההפעלה)
- תווית: "משוך לידים החל מתאריך (אופציונלי)"

### 3. Backend: עדכון `cron-sync-facebook-leads`
**קובץ:** `supabase/functions/cron-sync-facebook-leads/index.ts`

ב-Pass 2 (Flow-based sync, שורה ~466-614):

**א. שימוש ב-`sync_since_date` מה-config:**
- קריאת `sync_since_date` מה-`configuration` של הטריגר step
- אם קיים ועדיין לא היה סנכרון (`last_sync_at` ריק), להשתמש בו כתאריך התחלה במקום ברירת המחדל של 24 שעות

**ב. בדיקת דדופ מטבלת `flow_processed_leads`:**
- לפני עיבוד כל ליד, לבדוק ב-`flow_processed_leads` אם כבר עובד לאוטומציה הזו
- אחרי עיבוד מוצלח, לשמור את ה-`leadgen_id` + `automation_id` בטבלה

```typescript
// Before processing each lead:
const { data: alreadyProcessed } = await supabase
  .from('flow_processed_leads')
  .select('id')
  .eq('automation_id', info.automationId)
  .eq('leadgen_id', leadgenId)
  .limit(1);

if (alreadyProcessed?.length > 0) {
  totalSkipped++;
  continue;
}

// After successful trigger:
await supabase.from('flow_processed_leads').insert({
  automation_id: info.automationId,
  tenant_id: info.tenantId,
  leadgen_id: leadgenId,
  facebook_form_id: info.formId,
});
```

**ג. קריאת `sync_since_date`:**
```typescript
// Get trigger step config for sync_since_date
const { data: triggerStep } = await supabase
  .from('automation_flow_steps')
  .select('configuration')
  .eq('automation_id', info.automationId)
  .eq('step_type', 'trigger')
  .maybeSingle();

const syncSinceDate = triggerStep?.configuration?.sync_since_date;
const flowSinceDate = fbInt?.last_sync_at 
  ? new Date(fbInt.last_sync_at)
  : syncSinceDate 
    ? new Date(syncSinceDate)
    : new Date(Date.now() - 24 * 60 * 60 * 1000);
```

### קבצים לעריכה:
1. **מיגרציה** — יצירת טבלת `flow_processed_leads`
2. **`supabase/functions/cron-sync-facebook-leads/index.ts`** — דדופ מהטבלה החדשה + תמיכה ב-`sync_since_date`
3. **`src/components/automations/StepConfigPanel.tsx`** — שדה תאריך בטריגר

