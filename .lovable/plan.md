

# תיקון: לידים לא מוצגים בטנאנט Bull

## הבעיה
לטנאנט "Bull" אין רשומות בטבלת `lead_pipeline_stages`. הפונקציה `get_leads_by_stages` (שמשמשת את תצוגת הקנבן) עוברת על השלבים מהטבלה הזו -- ואם אין שלבים, היא מחזירה אובייקט ריק `{}` ולכן אין לידים מוצגים.

112 הלידים שייבאת קיימים במסד הנתונים בסטטוס "new", אבל אין שלב "new" מוגדר לטנאנט הזה.

## הפתרון

### שלב 1: אתחול שלבי פייפליין לטנאנט Bull
הכנסת שלבי פייפליין ברירת מחדל לטנאנט `6f7245dc-1121-4793-b708-61ba38e4d4da` (אותם שלבים שקיימים בטנאנטים אחרים).

### שלב 2: מניעה עתידית
הוספת טריגר אוטומטי שמאתחל שלבי פייפליין בעת יצירת טנאנט חדש (כמו שכבר קיים עבור `lead_statuses` ו-`menu_items`).

## פרטים טכניים

### מיגרציית SQL

```sql
-- אתחול שלבי פייפליין לטנאנט Bull
INSERT INTO public.lead_pipeline_stages (tenant_id, stage_key, label, color, sort_order, is_active)
VALUES
  ('6f7245dc-1121-4793-b708-61ba38e4d4da', 'new', 'חדש', '#3B82F6', 1, true),
  ('6f7245dc-1121-4793-b708-61ba38e4d4da', 'contacted', 'יצרנו קשר', '#8B5CF6', 2, true),
  ('6f7245dc-1121-4793-b708-61ba38e4d4da', 'meeting_scheduled', 'נקבעה פגישה', '#F59E0B', 3, true),
  ('6f7245dc-1121-4793-b708-61ba38e4d4da', 'proposal_sent', 'נשלחה הצעה', '#EC4899', 4, true),
  ('6f7245dc-1121-4793-b708-61ba38e4d4da', 'negotiation', 'משא ומתן', '#10B981', 5, true),
  ('6f7245dc-1121-4793-b708-61ba38e4d4da', 'closed', 'נסגר', '#22C55E', 6, true)
ON CONFLICT (tenant_id, stage_key) DO NOTHING;

-- פונקציה לאתחול שלבי פייפליין
CREATE OR REPLACE FUNCTION public.initialize_tenant_pipeline_stages(_tenant_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.lead_pipeline_stages (tenant_id, stage_key, label, color, sort_order, is_active)
  VALUES
    (_tenant_id, 'new', 'חדש', '#3B82F6', 1, true),
    (_tenant_id, 'contacted', 'יצרנו קשר', '#8B5CF6', 2, true),
    (_tenant_id, 'meeting_scheduled', 'נקבעה פגישה', '#F59E0B', 3, true),
    (_tenant_id, 'proposal_sent', 'נשלחה הצעה', '#EC4899', 4, true),
    (_tenant_id, 'negotiation', 'משא ומתן', '#10B981', 5, true),
    (_tenant_id, 'closed', 'נסגר', '#22C55E', 6, true)
  ON CONFLICT (tenant_id, stage_key) DO NOTHING;
END;
$$;

-- טריגר אוטומטי ליצירת טנאנט חדש
CREATE OR REPLACE FUNCTION public.handle_new_tenant_pipeline_stages()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM initialize_tenant_pipeline_stages(NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_tenant_created_pipeline_stages
  AFTER INSERT ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_tenant_pipeline_stages();
```

אין שינויים בקוד הפרונט-אנד. לאחר המיגרציה, רענון הדף יציג את 112 הלידים.

