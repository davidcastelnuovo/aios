# מחלקת שיווק — שיפורים ויזואליים והרחבה

## 1. הזרימה מימין לשמאל (RTL)
שינוי `PipelineCanvas`:
- להפוך `Handle` של node — מקור (`source`) משמאל, יעד (`target`) מימין.
- להחליף את הסדר האופקי של ברירת המחדל ב-`ensurePipeline.ts`:
  - אסטרטגיה: x=1180 (ימין) → כתיבה: 880 → קריאייטיב: 560 → 3 יעדים: 280 → מדידה: 0 (שמאל).
- להשאיר `dir="ltr"` רק על המיכל של ReactFlow (חובה לטופוגרפיית הקנבס), אבל הנתיב הוויזואלי יזרום מימין לשמאל.

## 2. בחירת לקוח לפי סוכנות + רק פעילים
שכתוב `ClientSelector.tsx`:
- שאילתה: `clients` עם `status = 'active'` בלבד, יחד עם `agency_id` ו-join ל-`agencies(name)`.
- ב-Popover: שתי רמות:
  1. רשימת סוכנויות (כפתורי `CommandItem` עם חץ).
  2. בלחיצה — פתיחת רשימת לקוחות של אותה סוכנות + תיבת חיפוש פנימית.
- כפתור "חזרה" בראש רשימת הלקוחות; "כל הלקוחות" כאופציה ראשונה.
- שמירת הסוכנות הנבחרת ב-state מקומי כך שכשפותחים שוב — חוזרים לרמה אחרונה.

## 3. Pop-up (Dialog) לכל שלב
החלפת ה-`onClick` של `StageNode` בפתיחת `StageConfigDialog` חדש (`src/components/marketing/StageConfigDialog.tsx`).

מבנה ה-Dialog (טאבים, RTL):
- **טאב כללי**: שם השלב, מצב אישור (manual/auto/hybrid), הוראות פתיחה (system prompt).
- **טאב אייג'נט**: בחירת `ai_agents` (filter לפי tenant), טמפרטורה/מודל (אם רלוונטי), תיאור תפקיד.
- **טאב כלים** (`tools`): צ'קבוקסים — בהתאם לסוג השלב:
  - `copy` — מודולים: AI text, מאגר ידע, חיפוש אינטרנט.
  - `creative` — image-gen / video-gen / לבחור ספק.
  - `target_paid` — Meta Ads / Google Ads (טוען מ-`tenant_integrations` של הלקוח).
  - `target_seo` — אתר יעד (פירוט בטאב יעד).
  - `target_organic` — עמודי סושיאל מחוברים.
  - `measurement` — GA / GSC / Meta Insights / Google Ads Reports.
- **טאב יעד** (תלוי `stage_type`):
  - `target_organic`: שולף מ-`social_pages` של הלקוח (FB/IG/TikTok וכו') + checkbox לבחירה. אם **אין עמודים** — כפתור "חבר עמוד" (פותח את `ChatIntegrations`/Facebook OAuth) או שדה ידני להוספה ב-`social_pages`.
  - `target_seo`: dropdown של ה-`website` מ-`clients`. אם ריק — שדה להגדרת אתר ושמירה ב-`clients.website` + שמירת `social_media_wordpress_sites` ראשי אם רלוונטי.
  - `target_paid`: הצגת `meta_ads_account_id` / `google_ads_account_id` מהלקוח. אם ריקים — שדה להזנה ושמירה ב-`clients`.

כל המידע נשמר ל-`marketing_pipeline_stages.configuration` (jsonb) — מבנה:
```json
{
  "instructions": "…",
  "agent_id": "…",
  "tools": ["image_gen","social_publish"],
  "target": { "channel_ids":[…], "website":"https://…", "ad_account":"…" }
}
```

## 4. הרחבת כרטיס לקוח — חיבורים
ב-`EditClientDialog.tsx` להוסיף טאב חדש **"חיבורים שיווקיים"**:
- עמודי סושיאל (`social_pages` מסוננים לפי `client_id`) — רשימה + הוסף/הסר ידנית (page_id, platform, page_name).
- אתר ראשי — שדה `website` קיים + שדות אופציונליים ל-`social_media_wordpress_sites`.
- חשבונות מודעות — `meta_ads_account_id`, `google_ads_account_id` (קיימים בטבלה).
- ערוצים נוספים — קישור ידני (`social_media_channels`).

הטאב משותף עם ה-Dialog בשלב היעד: שניהם יקראו לאותו hook חדש `useClientConnections(clientId)`.

## 5. פרטים טכניים
**קבצים חדשים:**
- `src/components/marketing/StageConfigDialog.tsx`
- `src/components/marketing/stage-config/AgentTab.tsx`, `ToolsTab.tsx`, `TargetTab.tsx`
- `src/components/marketing/lib/useClientConnections.ts`
- `src/components/clients/ClientConnectionsTab.tsx`

**קבצים לעריכה:**
- `src/components/marketing/ClientSelector.tsx` — בחירה דו-שכבתית סוכנות→לקוח, סינון פעילים.
- `src/components/marketing/PipelineCanvas.tsx` — הפיכת Handles + פתיחת StageConfigDialog.
- `src/components/marketing/lib/ensurePipeline.ts` — קואורדינטות RTL.
- `src/components/forms/EditClientDialog.tsx` — תוספת טאב "חיבורים".

**ללא שינויי schema** — כל הטבלאות הדרושות כבר קיימות (`marketing_pipeline_stages.configuration`, `social_pages`, `clients`, `ai_agents`).

## 6. סדר ביצוע
1. `ensurePipeline` + `PipelineCanvas` RTL (סעיף 1).
2. `ClientSelector` חדש לפי סוכנות + פעילים בלבד (סעיף 2).
3. `useClientConnections` (משותף).
4. `StageConfigDialog` + 3 הטאבים (סעיף 3).
5. טאב "חיבורים שיווקיים" ב-`EditClientDialog` (סעיף 4).
