# Carmen Command Center — מדריך

דשבורד פיקוד ובקרה מסך-מלא לכרמן. נפתח מלחיצה על האייקון של כרמן ב-header, או ישירות ב-`/t/<tenant-slug>/command-center`.

## איך מריצים

```bash
npm install
npm run dev        # פיתוח מקומי
npm run build      # בדיקת build
```

אין env vars חדשים — הדשבורד משתמש באותם `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` הקיימים. כל הקריאות מאומתות ב-JWT של המשתמש ומסוננות לפי tenant (RLS).

## מבנה הקוד

```
src/pages/CarmenCommandCenter.tsx        # העמוד — פריסה, מצב הפנים, Realtime
src/components/carmen-command/
  CarmenFace.tsx        # הפנים (Canvas): idle / listening / speaking / alert
  CarmenChatBar.tsx     # הקלדה + Realtime + בורר מוח (ערוץ ישיר / פרלמנט)
  BrainRouteSelector.tsx
  ParliamentBoard.tsx
  useBrainChannel.ts    # gateway agent-channel-send
  panels.tsx            # HudPanel + פאנלים: Core, פיד, דופק, משימות, ציר זמן, פקודות
  UsagePanel.tsx        # גרף שימוש ב-API (recharts)
  useCommandData.ts     # כל שאילתות הנתונים (react-query) + Realtime
  command-center.css    # שפת העיצוב (משתני CSS, גריד, אנימציות)
```

## איך מוסיפים פאנל חדש

1. מוסיפים hook נתונים ב-`useCommandData.ts` (עם `queryKey` ייחודי בתחזית `["cc-...", tenantId]`, `enabled: !!tenantId`, וטיפול בשגיאות שמחזיר "לא זמין" במקום לקרוס).
2. יוצרים קומפוננטה שעטופה ב-`<HudPanel title="..." icon={...}>` — מקבלים אוטומטית את מסגרת ה-HUD.
3. משבצים אותה בגריד ב-`CarmenCommandCenter.tsx` (מובייל = עמודה אחת לפי `order`, דסקטופ = `lg:col-span-*`).
4. אם הפאנל צריך רענון חי — מוסיפים `postgres_changes` ב-`useCommandRealtime`.

## שכבת הניטור (uptime)

- **טבלה:** `service_health_checks` (מיגרציה `20260722160000`) — היסטוריית סטטוס/latency לכל שירות. קריאה למשתמשים מחוברים (שורות גלובליות + של הטננטים שלהם); כתיבה רק ל-service role.
- **Probe:** edge function `carmen-health-probe` — בודקת DB, שרתי MCP (`system-graph-mcp`, `claude-mcp`), OpenAI, ו-WhatsApp gateway פר-טננט. שומרת 7 ימי היסטוריה.
- **תזמון:** pg_cron כל 10 דקות (הפקודה המדויקת מתועדת בגוף המיגרציה — מופעלת על פרוד ידנית כמו שאר ה-cron jobs, עם ה-anon key).
- הפאנל "בדיקות דופק" מציג את הבדיקה החיה מהדפדפן (DB latency) + היסטוריית ה-probe אם קיימת. בלי ה-cron הפאנל עדיין עובד — פשוט בלי פסי היסטוריה.

## קול

שלוש שכבות נפרדות — אין ערבוב:

1. **הקלדה:** שליחת טקסט מחזירה טקסט על המסך בלבד. אין `carmen-speak`, אין הקראה, ואין תמלול.
2. **תמלול לקומפוזר (`transcribe_only`):** בורר מצב מיקרופון → "תמלול לקומפוזר". הקלטה → `transcribe-voice` → הטקסט נכנס לתיבת ההודעה לעריכה לפני שליחה. תשובה **טקסט בלבד** — בלי Realtime, בלי TTS. בסיידבר: כפתור `CarmenComposerMicButton` תמיד זמין.
3. **שיחה חיה — OpenAI Realtime:** בורר מצב מיקרופון → "שיחה חיה". לחיצה על המיקרופון פותחת session דרך `carmen-realtime-session` → WebRTC דפדפן↔OpenAI. אם Realtime נכשל מוצגת שגיאה ברורה; **אין** fallback ל-`transcribe-voice`.
4. מתג עוצמת הקול מופיע רק בזמן שיחה חיה פעילה.

`transcribe-voice` משמש גם את הצ'אט הפנימי (`AIOSDialog`) ואת הסיידבר — תמלול לקומפוזר, ואת הודעות הקול בוואטסאפ (🎤).

`carmen-speak` משמש כאן רק לתצוגת דוגמת קול בבורר, לא לתשובות מוקלדות או תמלול בלבד.

## סיידבר כרמן (הקשר מסך)

כפתור **פתחי סיידבר** בכותרת פותח פאנל מימין — דוחף את תוכן מרכז הבקרה שמאלה (לא overlay). במצב מרכז בקרה, כשהסיידבר פתוח הצ'אט התחתון מוסתר; במצב סוכנים — הצ'אט המלא נשאר לצד הסיידבר.

- כל הודעה מהסיידבר נשלחת עם `ui_context` (מסלול, מודול, מזהים מה-URL).
- **שלחי תיקון לפיתוח** — רק למורשים → כרמן מנתבת ל-Cursor דרך `request_dev_task`.

## בורר מוח

הבורר ב-Command Center בוחר **נתיב שיחה**, לא רק מודל:

- מוח פנימי → `run-ai-agent` (stream)
- Cursor / Grok / Claude / ChatGPT Direct → `agent-channel-send` + callback לשיחה
- פרלמנט → Cursor+Grok, שני סבבים, סינתזה של כרמן

פירוט: `docs/agent-brain-channels.md`. טאב MCP Connections נשאר לכלי האצלה.

## גישה ו-API keys

- **בעלים (allowlist):** משתמשים ב-`COMMAND_CENTER_ALLOWLIST` (משוכפל ב-`access.ts` ובפונקציות הקול) משתמשים במפתח הארגוני.
- **כל משתמש אחר — bring your own key:** מזין מפתח OpenAI אישי בכרטיס "כרמן — מפתח API אישי" באזור האישי (`user_api_keys`, RLS של הבעלים בלבד). המפתח נבדק מול OpenAI לפני שמירה. ברגע שיש מפתח: כפתור כרמן מופיע, וכל שרשרת הקול (Realtime / TTS / תמלול) מחויבת על המפתח האישי — כולל בצד השרת (403 בלעדיו).

## מה עדיין לא מחובר (ראו `carmen-dashboard-data-map.md`)

- מעקב טוקנים/עלות בצ'אט הראשי (`run-ai-agent` v1 לא רושם usage) — דורש שינוי אדיטיבי בקוד הריצה של כרמן, ממתין לאישור.
- שמירת שיחות מהצ'אט הפנימי ל-`ai_conversations`, וחיבור `ai_agents.voice` ל-TTS — אותו סטטוס.
