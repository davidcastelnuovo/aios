

## תיקון: בידוד ערוצים לפי ארגון + תיקון קישור הזמנה

### בעיות שזוהו

**בעיה 1 - ערוצים מופיעים בארגונים אחרים:**
- טבלת `team_channel_members` חסרה עמודת `tenant_id`
- הפונקציה `is_channel_member()` בודקת רק `channel_id + user_id` בלי סינון tenant
- השאילתה ב-TeamChat שולפת ערוצים לפי membership בלי לסנן לפי tenant
- משתמש שקיים בכמה ארגונים רואה ערוצים מכולם

**בעיה 2 - קישור הזמנה נכשל:**
- דף ההזמנה (ChatInvite) שולף את ההזמנה דרך הקליינט המאומת, אבל משתמש חדש לא מאומת
- ה-RLS policy ל-`anon` קיימת אבל הקליינט משתמש ב-authenticated role
- צריך לוודא שהשאילתה עובדת גם למשתמשים לא מאומתים

### תוכנית תיקון

**1. מיגרציית DB - הוספת tenant_id ל-team_channel_members + תיקון RLS:**
- הוספת עמודת `tenant_id` ל-`team_channel_members`
- מילוי אוטומטי של `tenant_id` מ-`team_channels` לרשומות קיימות
- עדכון `is_channel_member()` לכלול סינון tenant
- עדכון מדיניות RLS של `team_channels` לסנן לפי tenant

```sql
-- Add tenant_id to team_channel_members
ALTER TABLE public.team_channel_members 
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);

-- Backfill from team_channels
UPDATE public.team_channel_members tcm
SET tenant_id = tc.tenant_id
FROM public.team_channels tc
WHERE tcm.channel_id = tc.id AND tcm.tenant_id IS NULL;

ALTER TABLE public.team_channel_members 
  ALTER COLUMN tenant_id SET NOT NULL;

-- Replace is_channel_member to include tenant scoping
CREATE OR REPLACE FUNCTION public.is_channel_member(p_channel_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_channel_members
    WHERE channel_id = p_channel_id 
      AND user_id = p_user_id
      AND tenant_id = (SELECT get_user_tenant_id(p_user_id))
  )
$$;

-- Update team_channels SELECT policy to also check tenant
DROP POLICY IF EXISTS "Members can view their channels" ON public.team_channels;
CREATE POLICY "Members can view their channels" ON public.team_channels
  FOR SELECT TO authenticated
  USING (
    tenant_id = get_user_tenant_id(auth.uid()) 
    AND (is_channel_member(id, auth.uid()) OR is_super_admin(auth.uid()))
  );
```

**2. Frontend - סינון ערוצים לפי tenant:**
- הוספת `.eq("tenant_id", tenantId)` לשאילתת team_channel_members ב-TeamChat
- וידוא שיצירת channel member כוללת tenant_id

**3. תיקון ChatInvite - שליפת הזמנה:**
- שינוי שאילתת ההזמנה לעבוד גם למשתמש לא מאומת (שימוש ב-edge function או RLS policy מתאימה)
- וידוא שה-anon policy עובדת נכון

### קבצים שישתנו
- מיגרציית SQL חדשה (tenant_id + RLS updates)
- `src/pages/TeamChat.tsx` - סינון לפי tenant + שליחת tenant_id ביצירת members
- `src/pages/ChatInvite.tsx` - תיקון שליפת הזמנה
- `supabase/functions/process-chat-invite/index.ts` - הוספת tenant_id ליצירת member

