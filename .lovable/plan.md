
# תיקון ספירת Pageviews ו-Events

## הבעיה שזוהו

### 1. Pageviews לא נשמרים בכלל
בעת `session_start` (כניסה ראשונית לאתר), הקוד בצד הלקוח שולח את הנתונים כ-`session_start` ולא כ-`pageview`. 
הקוד בצד השרת (`analytics-track`) יוצר את ה-session אבל **לא שומר את ה-pageview הראשון**.

```javascript
// Client-side - שולח session_start בכניסה ראשונה
track(state.sessionId ? 'pageview' : 'session_start', data);
```

```typescript
// Server-side - מטפל ב-pageview רק אם event_type === "pageview"
if (event_type === "pageview" && session_id && data.page_url) {
  // שומר pageview
}
// ב-session_start לא נשמר pageview!
```

### 2. page_count תמיד 0
מכיוון שה-pageview הראשון לא נשמר, ה-page_count לא מתעדכן.

---

## פתרון טכני

### שינוי ב-Edge Function: `analytics-track/index.ts`

צריך להוסיף שמירת pageview גם במקרה של `session_start`:

```typescript
// After creating session (around line 160), add:
if (event_type === "session_start" && session_id && data.page_url) {
  // Save the initial pageview
  const { error: pageviewError } = await supabase
    .from("site_pageviews")
    .insert({
      session_id,
      visitor_id: visitor.id,
      tracking_config_id,
      page_url: data.page_url,
      page_path: data.page_path,
      page_title: data.page_title,
      scroll_depth: data.scroll_depth || 0,
      tenant_id,
    });

  if (pageviewError) {
    console.error("Error creating initial pageview:", pageviewError);
  }

  // Set initial page count to 1
  await supabase
    .from("site_sessions")
    .update({ page_count: 1 })
    .eq("id", session_id);
}
```

---

## תוצאה צפויה

לאחר התיקון:
- כל כניסה לאתר תיצור pageview ראשון
- ה-page_count יתחיל מ-1
- הדשבורד יציג נתוני דפים פופולריים
- ספירת "צפיות דפים היום" תהיה מדויקת

---

## שלבים ליישום

| שלב | פעולה |
|-----|-------|
| 1 | עדכון `supabase/functions/analytics-track/index.ts` להוסיף שמירת pageview גם ב-session_start |
| 2 | Deploy אוטומטי של ה-Edge Function |

