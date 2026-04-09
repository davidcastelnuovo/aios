

## תוכנית: איחוד סטטוסי Mood ו-Communication Status

### הבעיה
יש שני סטי סטטוסים שונים שחופפים חלקית:

```text
Mood (בצ'אט/כרטיס לקוח)         Communication (בטאב עדכונים)
──────────────────────────       ──────────────────────────
😊 מבסוט (happy)                 תקין (normal)
😐 מתנדנד (wavering)             רגיש (sensitive)
😟 סכנת נטישה (churn_risk)       תלונה (complaint)
😔 לא מתקדם (not_progressing)    — אין מקביל —
```

כשמעדכנים communication status, המערכת ממפה אותו ל-mood — אבל הם מוצגים בשני מקומות עם שמות שונים וללא עקביות.

### הפתרון

**איחוד לסט אחד** — שמירה על ערכי ה-mood הקיימים בבסיס הנתונים (`happy`, `wavering`, `churn_risk`, `not_progressing`) כערכים הקנוניים, ושינוי ה-UI בכל המקומות להציג את אותם שמות ואימוג'ים:

| ערך DB | תצוגה |
|--------|--------|
| `happy` | 😊 מבסוט / תקין |
| `wavering` | 😐 מתנדנד / רגיש |
| `churn_risk` | 😟 סכנת נטישה / תלונה |
| `not_progressing` | 😔 לא מתקדם |

### שינויים

1. **`ClientUpdatesTab.tsx`** — החלפת `COMM_STATUS_OPTIONS` (normal/sensitive/complaint) בערכי mood ישירים (happy/wavering/churn_risk/not_progressing). הסרת `COMM_TO_MOOD` mapping — שמירה ישירה של `mood_status` בלי תרגום. שינוי הכותרת מ-"עדכון מצב תקשורת" ל-"עדכון מצב לקוח"

2. **`ClientsChatView.tsx`** — הדרופדאון כבר עובד עם mood values — ללא שינוי נדרש

3. **`ManualHealthEditDialog.tsx`** — כבר עובד עם mood values — לוודא עקביות בשמות

4. **`Clients.tsx`** — הדרופדאון בטבלה ובעריכה כבר עובד עם mood — ללא שינוי

5. **`communication_logs` table** — שדה `status` ישמור mood value ישירות (`happy`/`wavering`/`churn_risk`/`not_progressing`) במקום `normal`/`sensitive`/`complaint`

### קבצים שישתנו
- `src/components/clients/ClientUpdatesTab.tsx` — עיקר השינוי
- `src/lib/healthScore.ts` — עדכון `COMMUNICATION_STATUS_LABELS` לתאימות (או הסרה אם לא נדרש)

