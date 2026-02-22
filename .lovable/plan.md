

# תוכנית: מניעת חזרה של לידים שנמחקו מפייסבוק

## הבעיה
כשמוחקים ליד שהגיע מפייסבוק, ה-`leadgen_id` שלו (שמור ב-`notes`) נמחק יחד איתו. בסנכרון הבא, המערכת לא מוצאת את ה-`leadgen_id` ויוצרת את הליד מחדש.

## הפתרון - 3 שלבים

### שלב 1: טבלת "זיכרון" ללידים שנמחקו
יצירת טבלת `deleted_facebook_leads` שתשמור את ה-`leadgen_id` של כל ליד פייסבוק שנמחק.

- עמודות: `id`, `tenant_id`, `leadgen_id`, `deleted_at`
- אילוץ ייחודי על `tenant_id + leadgen_id`
- RLS מופעל עם מדיניות מתאימה

### שלב 2: טריגר אוטומטי על מחיקת ליד
טריגר `BEFORE DELETE` על טבלת `leads` שמחלץ את ה-`leadgen_id` מתוך ה-`notes` ושומר אותו בטבלה החדשה לפני שהליד נמחק.

### שלב 3: עדכון פונקציית הסנכרון
עדכון `cron-sync-facebook-leads` כך שלפני יצירת ליד חדש, תבדוק גם בטבלת `deleted_facebook_leads` -- אם ה-`leadgen_id` נמצא שם, הליד ידולג.

---

## פרטים טכניים

### מיגרציית SQL

```sql
-- טבלה לשמירת leadgen_ids של לידים שנמחקו
CREATE TABLE public.deleted_facebook_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  leadgen_id text NOT NULL,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, leadgen_id)
);

ALTER TABLE public.deleted_facebook_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.deleted_facebook_leads
  FOR ALL USING (true) WITH CHECK (true);

-- טריגר שמתעד leadgen_id לפני מחיקת ליד
CREATE OR REPLACE FUNCTION public.track_deleted_facebook_lead()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $$
DECLARE
  v_leadgen_id text;
BEGIN
  IF OLD.notes IS NOT NULL AND OLD.notes LIKE '%leadgen_id:%' THEN
    v_leadgen_id := trim(split_part(split_part(OLD.notes, 'leadgen_id: ', 2), E'\n', 1));
    IF v_leadgen_id IS NOT NULL AND v_leadgen_id != '' THEN
      INSERT INTO deleted_facebook_leads (tenant_id, leadgen_id)
      VALUES (OLD.tenant_id, v_leadgen_id)
      ON CONFLICT (tenant_id, leadgen_id) DO NOTHING;
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER on_lead_delete_track_facebook
  BEFORE DELETE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.track_deleted_facebook_lead();
```

### עדכון Edge Function: `cron-sync-facebook-leads`
בשני המקומות בקוד (לולאה ראשית ולולאת pagination), לפני יצירת ליד חדש, יתווסף:

```typescript
// Check if this lead was previously deleted
const { data: deletedLead } = await supabase
  .from('deleted_facebook_leads')
  .select('id')
  .eq('tenant_id', integration.tenant_id)
  .eq('leadgen_id', leadgenId)
  .limit(1);

if (deletedLead && deletedLead.length > 0) {
  console.log(`🗑️ Lead ${leadgenId} was previously deleted, skipping`);
  totalSkipped++;
  continue;
}
```

## תוצאה צפויה
- לידים שנמחקים לא יחזרו בסנכרון הבא
- השינוי אוטומטי לחלוטין -- לא דורש פעולה ידנית
- אין השפעה על לידים קיימים או על תהליכים אחרים
