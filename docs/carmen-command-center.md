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
  CarmenChatBar.tsx     # "דברי עם כרמן": SSE + הקלטה + TTS זורם לפי משפטים
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

שלוש שכבות, מהטובה ביותר למטה:

1. **שיחה חיה — OpenAI Realtime (ברירת המחדל):** לחיצה על המיקרופון פותחת session דרך `carmen-realtime-session` (טוקן זמני, המפתח לא בפרונט) → WebRTC ישיר דפדפן↔OpenAI (`gpt-realtime`, קול marin). latency ~300ms, VAD בצד השרת, barge-in (אפשר לקטוע באמצע). שאלות על נתוני המערכת עוברות דרך הכלי `ask_carmen` → `run-ai-agent` (non-streaming) עם ה-JWT של המשתמש — המוח של כרמן נשאר המקור היחיד לנתונים. עלות: ~$0.10–0.30 לדקת שיחה.
2. **Fallback — לולאת VAD מקומית:** אם ה-session לא נפתח (אין רשת/מפתח) — הקלטה עם זיהוי סוף-דיבור לפי שקט (~1.2s) → `transcribe-voice` (Whisper) → תשובה ב-TTS זורם משפט-משפט דרך `carmen-speak` עם prefetch.
3. **טקסט:** הצ'אט הרגיל ב-SSE; כפתור הרמקול מפעיל/מכבה הקראה.

`carmen-speak` תומך גם ב-`instructions` (הכוונת סגנון עברית ל-`gpt-4o-mini-tts`, פעיל כברירת מחדל) וגם ב-`provider:'elevenlabs'` (eleven_multilingual_v2, דורש `ELEVENLABS_API_KEY`; אפשר לקבוע קול עם `ELEVENLABS_VOICE_ID`).

## מה עדיין לא מחובר (ראו `carmen-dashboard-data-map.md`)

- מעקב טוקנים/עלות בצ'אט הראשי (`run-ai-agent` v1 לא רושם usage) — דורש שינוי אדיטיבי בקוד הריצה של כרמן, ממתין לאישור.
- שמירת שיחות מהצ'אט הפנימי ל-`ai_conversations`, וחיבור `ai_agents.voice` ל-TTS — אותו סטטוס.
