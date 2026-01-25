

# תיקון: לידים נעלמים - שרון וישינסקי (0525553051)

## סיכום הבעיה

הליד **קיים במסד הנתונים** אך לא מופיע במסך הלידים עקב באגים ב-RPC `get_leads_by_stages`.

| שדה | ערך |
|-----|-----|
| **שם** | Sharon Vichanski / שרון וישינסקי |
| **טלפון** | +972525553051 |
| **סטטוס** | new |
| **agency_id** | NULL ❌ |

---

## שורש הבעיות

### בעיה 1: עמודות שגויות ב-RPC
ה-RPC `get_leads_by_stages` מנסה לגשת לעמודות שלא קיימות:

| RPC מחפש | עמודה אמיתית |
|-----------|--------------|
| `l.pipeline_stage_id` | `l.status` |
| `stage_record.name` | `stage_record.label` |
| `stage_record.position` | `stage_record.sort_order` |

### בעיה 2: לידים ללא סוכנות לא נכללים
הלוגיקה הנוכחית:
```sql
AND (p_agency_ids IS NULL OR l.agency_id = ANY(p_agency_ids))
```

כאשר `l.agency_id = NULL`, התנאי מחזיר FALSE ומסנן את הליד.

---

## פתרון

### עדכון RPC: `get_leads_by_stages`

```sql
CREATE OR REPLACE FUNCTION public.get_leads_by_stages(...)
BEGIN
  -- תיקון 1: קריאה לעמודות נכונות מ-lead_pipeline_stages
  FOR stage_record IN
    SELECT id, stage_key, label, color, sort_order
    FROM lead_pipeline_stages
    WHERE tenant_id = p_tenant_id AND is_active = true
    ORDER BY sort_order ASC
  LOOP
    IF p_stages IS NULL OR stage_record.stage_key = ANY(p_stages) THEN
      
      -- תיקון 2: שימוש ב-status במקום pipeline_stage_id
      SELECT COUNT(*)
      INTO stage_count
      FROM leads l
      WHERE l.tenant_id = p_tenant_id
        AND l.status = stage_record.stage_key  -- ⬅️ תוקן!
        -- תיקון 3: כולל גם לידים עם agency_id NULL
        AND (p_agency_ids IS NULL OR l.agency_id IS NULL OR l.agency_id = ANY(p_agency_ids))
        ...
        
      -- אותו תיקון לשאילתת הלידים
      SELECT ... FROM leads l
      WHERE l.tenant_id = p_tenant_id
        AND l.status = stage_record.stage_key  -- ⬅️ תוקן!
        AND (p_agency_ids IS NULL OR l.agency_id IS NULL OR l.agency_id = ANY(p_agency_ids))
        ...
```

---

## שינויים טכניים

### 1. מיגרציית Database

עדכון הפונקציה `get_leads_by_stages`:

1. **שינוי שמות עמודות** ב-loop של `lead_pipeline_stages`:
   - `name` → `label`
   - `position` → `sort_order`

2. **שינוי תנאי השלב**:
   - מ: `l.pipeline_stage_id = stage_record.id`
   - ל: `l.status = stage_record.stage_key`

3. **הוספת תנאי לכלול לידים ללא סוכנות**:
   - מ: `(p_agency_ids IS NULL OR l.agency_id = ANY(p_agency_ids))`
   - ל: `(p_agency_ids IS NULL OR l.agency_id IS NULL OR l.agency_id = ANY(p_agency_ids))`

4. **עדכון ה-output** של הפונקציה:
   - `stage_name` → `stage_record.label`
   - `stage_position` → `stage_record.sort_order`

---

## תוצאה צפויה

לאחר התיקון:
- ✅ הליד של שרון וישינסקי יופיע בעמודת "חדש"
- ✅ כל הלידים עם `agency_id = NULL` יופיעו
- ✅ ה-Kanban יעבוד נכון עם שלבי הפייפליין הדינמיים

