
ALTER TABLE public.ai_skills
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS system_prompt text,
  ADD COLUMN IF NOT EXISTS output_template text,
  ADD COLUMN IF NOT EXISTS allowed_tools text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'tenant',
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS triggers text[] DEFAULT '{}'::text[];

ALTER TABLE public.ai_skills ALTER COLUMN tenant_id DROP NOT NULL;
ALTER TABLE public.ai_skills ALTER COLUMN user_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ai_skills_slug_global_uniq
  ON public.ai_skills (slug) WHERE scope = 'global';

CREATE OR REPLACE FUNCTION public.bump_ai_skill_version()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (
       NEW.system_prompt IS DISTINCT FROM OLD.system_prompt
    OR NEW.output_template IS DISTINCT FROM OLD.output_template
    OR NEW.allowed_tools IS DISTINCT FROM OLD.allowed_tools
    OR NEW.triggers IS DISTINCT FROM OLD.triggers
    OR NEW.steps IS DISTINCT FROM OLD.steps
  ) THEN
    NEW.version := COALESCE(OLD.version, 1) + 1;
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bump_ai_skill_version_trg ON public.ai_skills;
CREATE TRIGGER bump_ai_skill_version_trg
BEFORE UPDATE ON public.ai_skills
FOR EACH ROW EXECUTE FUNCTION public.bump_ai_skill_version();

DROP POLICY IF EXISTS "Super admin manages global skills" ON public.ai_skills;
CREATE POLICY "Super admin manages global skills"
ON public.ai_skills FOR ALL TO authenticated
USING (scope = 'global' AND public.is_super_admin(auth.uid()))
WITH CHECK (scope = 'global' AND public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "All authenticated can read global skills" ON public.ai_skills;
CREATE POLICY "All authenticated can read global skills"
ON public.ai_skills FOR SELECT TO authenticated
USING (scope = 'global');

DELETE FROM public.ai_skills WHERE scope='global' AND slug IN ('pulse_check','ecommerce_pulse','ad_accounts_health');

INSERT INTO public.ai_skills (slug, scope, name, description, system_prompt, output_template, allowed_tools, triggers, is_active, steps, created_by_agent) VALUES
('pulse_check','global','בדיקת דופק','סקירת ביצועים שבועית לכלל הלקוחות המחוברים, מחולקת לפי סוכנות.',
$$אתה מבצע בדיקת דופק. הריצי analyze_campaign_performance (כל הסקופ של הקורא או agency_name אם פורט). במקביל הריצי check_ad_accounts_health. הצליבי לתוצאה אחת. אסור להמציא מספרים. אסור לדלג על לקוחות. לקוחות עם is_ecommerce=true -> השתמשי בסקיל ecommerce_pulse לאותה שורה.$$,
$$בדיקת דופק עדכנית לכלל הלקוחות המחוברים, מחולקת לפי סוכנויות:

לכל סוכנות:
**<שם סוכנות>**
🔴 <שם לקוח> — CPL <X> | <N> לידים | <סיבת אדום>
🟠 <שם לקוח> — CPL <X> | <N> לידים | עלייה של <P>%
🟢 <שם לקוח> — CPL <X> | <N> לידים

ללא חיבור דוחות: <שמות מופרדים בפסיקים>

סיכום מהיר: אדומים בולטים — ... | כתומים בולטים — ...

חוקי דגלים:
🔴 אין spend 7 ימים | חשבון disabled/closed | ירידה חדה 45%+ | חריגת ספנד | התייקרות CPL 100%+
🟠 CPL עלה 20-99% | spend ירד 30%+ | רגיש
🟢 ביצועים תקינים$$,
ARRAY['analyze_campaign_performance','check_ad_accounts_health','list_clients'],
ARRAY['בדיקת דופק','בדיקת דוח','סיכום קמפיינים','מצב קמפיינים','מצב לקוחות','pulse check','pulse'],
true,'',false),
('ecommerce_pulse','global','בדיקת דופק איקומרס','שורת לקוח לאיקומרס: רכישות, CPP, רווח, ROAS.',
$$ללקוחות is_ecommerce=true: אסור CPL/לידים. חשב/י purchases_7d, revenue_7d, cpp_7d=spend_7d/purchases_7d, roas_7d=revenue_7d/spend_7d, profit_7d=revenue_7d-spend_7d. נתונים מ-analyze_campaign_performance + Shopify/Woo. אם חסר חיבור חנות — ציין/י "ללא חיבור חנות".$$,
$$🔴/🟠/🟢 <שם> — <N> רכישות | CPP ₪<X> | רווח ₪<Y> | ROAS <Z>

🔴 ROAS<1 | אין רכישות 7 ימים | חשבון disabled
🟠 ROAS 1-1.5 | CPP עלה 25%+ | ירידה ברווח
🟢 ROAS>=1.5 ויציב$$,
ARRAY['analyze_campaign_performance','check_ad_accounts_health','list_woocommerce_orders','list_shopify_orders'],
ARRAY['איקומרס','ecommerce','e-commerce','רכישות','roas','cpp'],
true,'',false),
('ad_accounts_health','global','בדיקת תקינות חשבונות מודעות','disabled/closed, אין spend 7 ימים, כל הקמפיינים paused, token פג.',
$$הריצי check_ad_accounts_health. דווחי רק חשבונות עם בעיה.$$,
$$🚨 חשבונות מודעות לא תקינים:
• <שם לקוח> — <Facebook/Google> — <disabled / closed / pending_review / no_spend_7d / all_paused / token_expired / api_error>

אם הכל תקין: "✅ כל חשבונות המודעות תקינים."$$,
ARRAY['check_ad_accounts_health'],
ARRAY['חשבונות מודעות','חשבון מודעות','ad account','ad accounts','token פג','disabled'],
true,'',false);

CREATE INDEX IF NOT EXISTS ai_skills_active_lookup_idx
  ON public.ai_skills (slug, scope, tenant_id, version) WHERE is_active = true;
