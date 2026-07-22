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

- **כרמן שומעת:** מיקרופון → `MediaRecorder` → edge function `transcribe-voice` (Whisper עברית) → שליחה אוטומטית.
- **כרמן מדברת:** התשובה זורמת ב-SSE; כל משפט שמסתיים נשלח מיד ל-`carmen-speak` (TTS) ומתנגן בתור רציף — הדיבור מתחיל אחרי המשפט הראשון, לא בסוף התשובה. ה-audio עובר דרך `AudioContext` analyser שמניע את הפה של הפנים.
- כיבוי/הדלקה: כפתור הרמקול בשורת הצ'אט.

## מה עדיין לא מחובר (ראו `carmen-dashboard-data-map.md`)

- מעקב טוקנים/עלות בצ'אט הראשי (`run-ai-agent` v1 לא רושם usage) — דורש שינוי אדיטיבי בקוד הריצה של כרמן, ממתין לאישור.
- שמירת שיחות מהצ'אט הפנימי ל-`ai_conversations`, וחיבור `ai_agents.voice` ל-TTS — אותו סטטוס.
