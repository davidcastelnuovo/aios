# מודול "מחלקת שיווק" — איפיון מלא

מודול אחד מאוחד שמחליף את: **ניהול סושיאל**, **רשתות חברתיות**, **התראות קמפיינים**, **ניטור נראות AI**.
(נשארים בנפרד: דשבורדים ודוחות.)

---

## 1. החוויה (UX)

### כניסה
- מסך מלא (`h-screen overflow-hidden`) — כמו `AutomationFlow`. ללא header/sidebar שמכרסם.
- שלב ראשון: **בורר לקוח** (Combobox עליון). הבחירה נשמרת ב-URL: `/t/:slug/marketing/:clientId`.
- מציג למעלה ביישור ימין סטטוס חיבורים של הלקוח: Meta Ads, Google Ads, FB/IG Pages, אתר WordPress, GSC. אינדיקציה ירוק/אדום + קישור מהיר לחיבור חסר.

### תצוגה ראשית: Pipeline ויזואלי
- שני מצבים בלשוניות:
  1. **תצוגת פס יצור (Flow)** — קנבס `@xyflow/react` במסך מלא, אופקי משמאל לימין (RTL aware).
  2. **תצוגת לוח תוכן (Calendar)** — Gantt חודשי קיים (`SocialGanttVisualView`) מלמעלה למטה לכל הפריטים שעוברים בפס.

### פס היצור (5 שלבים)
```
[אסטרטגיה] → [כתיבת תוכן] → [קריאייטיב] → [יעד: קמפיין / SEO-GEO / סושיאל אורגני] → [מדידה]
```
כל שלב = node בקנבס, עם:
- שם השלב + אייקון
- אייג'נט אחראי (תמונה+שם, נשלף מ-`ai_agents`)
- מצב הרצה: Idle / Running / Waiting Approval / Done / Failed
- מד התקדמות פריטים (X/Y פריטים בשלב)
- כפתור "הרץ" (ידני) / "הגדרות"
- קליק על node פותח Sheet מימין עם פרטי השלב + רשימת הפריטים + הגדרות אישור (ידני/אוטומטי).

### יצירת פריט תוכן
- כפתור "+ פריט תוכן חדש" יוצר `marketing_work_item` שמתחיל בשלב 1.
- כל פריט = יחידה שזורמת בפס. אפשר לראות אותה כקלף קטן מתחת ל-node הנוכחי, או ב-Sheet הצדדי.
- מעבר בין שלבים: ידני (כפתור), אוטומטי (אם מוגדר), או דרך אישור אייג'נט.

### Approval Gate לכל שלב
לכל שלב יש toggle בהגדרות:
- **ידני** — האייג'נט מציע, אדם מאשר.
- **אוטומטי** — האייג'נט מבצע ועובר הלאה.
- **היברידי** — אוטומטי תחת תנאי (למשל "ציון איכות > 80").

### Visual Flow View נוסף
כפתור "תצוגת פלואו מלא" — מציג את הפריט הבודד כדיאגרמה: כל הצמתים והקישורים, איפה הוא נתקע, מי האחראי.

---

## 2. השלבים בפירוט

### שלב 1 — אסטרטגיה
- **אייג'נט:** Strategy Agent (חדש; LLM מבוסס Gemini).
- **קלט:** ברייף לקוח, יעדים, קהל יעד, מתחרים, לוח שנה (חגים/אירועים).
- **פלט:** `strategy_brief` (JSONB): נושאי-על, פילרים, KPIs, לוח תוכן חודשי מומלץ.
- **UI:** טופס בריף + תצוגה של הצעות אסטרטגיה לאישור.

### שלב 2 — כתיבת תוכן
- **אייג'נט:** Copy Agent (קיים — `CopyAgent.tsx`, `social-gantt-generate`).
- **בורר סוג תוכן:** פוסט סושיאל / מודעה / מאמר SEO / תיאור מוצר / מייל.
- **פלט:** `copy_text` + 3 וריאציות.

### שלב 3 — קריאייטיב
- **אייג'נט:** Creative Agent (קיים — `CreativeAgent.tsx`, `ai-generate-social-image`).
- מייצר תמונה/וידאו לפי הקופי + פרומפט.
- **פלט:** `creative_url` ב-Storage.

### שלב 4 — יעד (Branching)
ה-node מתפצל לפי `target_channel` של הפריט:
  - **קמפיין ממומן** — שולח ל-Meta/Google Ads (יוצר Draft Ad). מנטר דרך `fb-campaign-monitor` הקיים → שולף את `campaign_alerts` של הלקוח אל ה-node.
  - **SEO-GEO** — מפרסם ל-WordPress (`social_media_wordpress_sites` קיים) + מסמן ב-GSC.
  - **סושיאל אורגני** — `social-publish` ל-FB/IG/TikTok/LinkedIn (`social_pages` קיים).

### שלב 5 — מדידה
- **אייג'נט:** Insights Agent.
- מסכם ביצועים: התראות קמפיין, נראות AI (`ai_detection_scores`), אנגייג'מנט סושיאל, תנועה ל-WP.
- **פלט:** סיכום שבועי לדשבורד הראשי + הזנה חזרה לשלב 1 (לולאת לימוד).

---

## 3. ארכיטקטורה טכנית

### דאטה — טבלאות חדשות

```sql
-- צינור לכל לקוח (אחד לכל לקוח, ניתן להתאמה אישית)
CREATE TABLE public.marketing_pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'מחלקת שיווק',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(client_id)
);

-- שלבים (nodes) של הפיפליין
CREATE TYPE marketing_stage_type AS ENUM
  ('strategy','copy','creative','target_paid','target_seo','target_organic','measurement');

CREATE TYPE marketing_approval_mode AS ENUM ('manual','auto','hybrid');

CREATE TABLE public.marketing_pipeline_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL REFERENCES public.marketing_pipelines(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  stage_type marketing_stage_type NOT NULL,
  name text NOT NULL,
  agent_id uuid REFERENCES public.ai_agents(id),
  approval_mode marketing_approval_mode DEFAULT 'manual',
  position_x int DEFAULT 0,
  position_y int DEFAULT 0,
  parent_stage_id uuid REFERENCES public.marketing_pipeline_stages(id),
  configuration jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- פריטי עבודה הזורמים בפיפליין
CREATE TYPE marketing_item_status AS ENUM
  ('draft','in_progress','waiting_approval','approved','published','failed','archived');

CREATE TABLE public.marketing_work_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL REFERENCES public.marketing_pipelines(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  client_id uuid NOT NULL,
  current_stage_id uuid REFERENCES public.marketing_pipeline_stages(id),
  target_channel text, -- 'paid_ads' | 'seo_geo' | 'organic_social'
  title text,
  status marketing_item_status DEFAULT 'draft',
  payload jsonb DEFAULT '{}'::jsonb, -- {brief, copy_text, creative_url, scheduled_date, ...}
  links jsonb DEFAULT '{}'::jsonb,    -- {social_gantt_post_id, social_publication_id, campaign_id, wp_post_id}
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- לוג מעברי שלבים
CREATE TABLE public.marketing_item_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.marketing_work_items(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  from_stage_id uuid,
  to_stage_id uuid,
  triggered_by uuid, -- user or agent
  trigger_type text, -- 'manual' | 'auto' | 'agent'
  notes text,
  created_at timestamptz DEFAULT now()
);
```
כל הטבלאות עם RLS לפי `tenant_id` + GRANTים מלאים — לפי תקן הפרויקט.

### שימוש מחדש בקיים
- **`social_gantt_posts`** — כל פריט אורגני יוצר/מתחבר לרשומה כאן (דרך `marketing_work_items.links.social_gantt_post_id`). הקלנדר בלשונית #2 של המודול נטען מ-`social_gantt_posts` כפי שהוא היום.
- **`social_publications`, `social_pages`, `social-publish`** — שלב היעד האורגני.
- **`social_media_wordpress_sites`** — שלב היעד SEO-GEO.
- **`campaign_alerts`, `fb-campaign-monitor`** — מוצגים בתוך node "קמפיין ממומן" כ-feed חי.
- **`ai_detection_*`** — מוצגים בתוך node "מדידה" + node צד "ניטור נראות AI".

### Edge Functions
- `marketing-pipeline-advance` — חדש; מקדם פריט שלב (קורא ל-CopyAgent/CreativeAgent/הפרסום הקיימים).
- `marketing-strategy-agent` — חדש; שלב 1.
- `marketing-insights-agent` — חדש; שלב 5.
- שאר הפונקציות נשארות (`social-gantt-generate`, `ai-generate-social-image`, `social-publish`, `fb-campaign-monitor`, `ai-detection-scan`).

### קומפוננטות חזית
```
src/pages/MarketingDepartment.tsx        (מסך מלא, בורר לקוח, לשוניות Flow/Calendar)
src/components/marketing/
  PipelineCanvas.tsx                     (@xyflow/react, מקביל ל-FlowEditor)
  StageNode.tsx                          (custom node — אייג'נט+סטטוס+מד פריטים)
  StageConfigSheet.tsx                   (Sheet מימין, מצב אישור, בחירת אייג'נט)
  WorkItemList.tsx                       (כרטיסי פריטים תחת node נבחר)
  WorkItemDetailPanel.tsx                (פרטי פריט יחיד + מעברים)
  WorkItemFlowDialog.tsx                 (תצוגת פלואו של פריט בודד)
  ClientConnectionsBar.tsx               (אינדיקציות חיבורים)
  ClientSelector.tsx
  agents/
    StrategyPanel.tsx
    CopyPanel.tsx        (עוטף CopyAgent הקיים)
    CreativePanel.tsx    (עוטף CreativeAgent הקיים)
    TargetPaidPanel.tsx  (משלב CampaignAlerts)
    TargetSeoPanel.tsx
    TargetOrganicPanel.tsx (משלב SocialPublisher)
    InsightsPanel.tsx    (משלב AiDetection)
```

### ניתוב + תפריט
- נתיב חדש: `/t/:slug/marketing` (ברירת מחדל: בורר לקוח), `/t/:slug/marketing/:clientId`.
- `menuStructure.ts`: מוסיפים פריט אחד `marketing-department` תחת קטגוריית "שיווק".
- מוחקים את 4 פריטי התפריט הישנים.

---

## 4. מחיקות

לאחר שכל ה-import-ים מועברים אל המודול החדש, נמחקים:
- `src/pages/SocialDashboard.tsx`, `src/pages/SocialPublisher.tsx`, `src/pages/CampaignAlerts.tsx`, `src/pages/AiDetection.tsx`
- `src/components/social-gantt/*` (חוץ מ-CopyAgent/CreativeAgent שעוברים ל-`src/components/marketing/agents/`)
- `src/components/ai-detection/*` (עוברים ל-`InsightsPanel`)
- הנתיבים המתאימים ב-`App.tsx`
- הפריטים המתאימים ב-`menuStructure.ts` ו-`AppSidebar.tsx`

הטבלאות בדאטה **נשארות** — `social_gantt_posts`, `social_publications`, `social_pages`, `campaign_alerts`, `ai_detection_*` נדרשות למודול החדש.

---

## 5. תוכנית מימוש (סדר ביצוע)

1. מיגרציה: 4 הטבלאות החדשות + RLS + GRANTs.
2. עמוד `MarketingDepartment.tsx` עם בורר לקוח + שורת חיבורים + שלד 2 לשוניות.
3. `PipelineCanvas.tsx` עם @xyflow/react ו-`StageNode` בסיסי (5 צמתים default).
4. `StageConfigSheet` + מצבי אישור.
5. עטיפת CopyAgent/CreativeAgent הקיימים בפאנלים החדשים.
6. שלב יעד — שילוב SocialPublisher + CampaignAlerts + WordPress.
7. שלב מדידה — שילוב AiDetection.
8. Edge functions חדשים: strategy + advance + insights.
9. תצוגת פלואו לפריט בודד (`WorkItemFlowDialog`).
10. ניתוב + תפריט + מחיקת המודולים הישנים.
11. seed: יצירת pipeline ברירת מחדל לכל לקוח קיים.

זמן משוער למימוש מלא: ~6–8 צעדי build.
