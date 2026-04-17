

## אבחון

**שורש הבעיה (לוג Edge Function):**
```
ERROR Gmail API error: Token refresh failed
```
ה-`refresh_token` של Gmail פג/לא תקף — לכן ה-edge function זורקת 500 ולכן ה-toast "שגיאה בשליחת הדוח". האימייל לא נשלח כי **חיבור Gmail צריך חידוש**.

**הסניפט של SEO לא קיים בכלל:**
ב-`ClientReportSnapshot.tsx` יש לוגיקה רק ל-Ads (`facebook_insights`, `facebook_ecommerce`, `google_ads`) ולפילדים גנריים. כשהטבלה היא דוח SEO (`integration_settings.data_source === 'ahrefs_reports'`) — הוא נופל ל-fallback של "אין נתונים לתקופה זו" כי ה-records של Ahrefs לא מתאימים לפילטר 7-ימים. לכן הצילום ריק/לא רלוונטי.

**אין יצירה אוטומטית של share link:**
ב-`ClientReportPanel.tsx` שורה 119-138 — רק *קוראים* קישור קיים. אם אין — לא נוצר. יש להוסיף mutation שיוצר אם חסר.

---

## פתרון

### 1. שיפור הודעת השגיאה ב-Gmail (UX)
ב-`ClientReportPanel.tsx` `handleSend` — לזהות שגיאות `Token refresh failed` / `Gmail not connected` ולהציג הודעה ברורה: *"חיבור ה-Gmail פג. יש להתחבר מחדש בדף Gmail Settings"* + כפתור ניווט.

### 2. יצירה אוטומטית של Share Link אם חסר
- אם `shareLink` הוא `null` — לפני שליחה, להריץ אוטומטית `INSERT` ל-`table_shares` עם token קריא (זהה ללוגיקה ב-`ShareTableDialog.generateReadableToken`).
- לאחר היצירה — invalidate השאילתה ולהמשיך עם הקישור החדש.
- אופציונלי: כפתור קטן "צור קישור" בתוך אזור ה-Share info שכרגע מציג "אין קישור שיתוף פעיל".

### 3. תמיכת SEO בצילום (Top 10 ביטויים)
ב-`ClientReportSnapshot.tsx`:
- לזהות `integration_type === 'ahrefs_reports'` או `integration_settings.data_source === 'ahrefs_reports'`.
- אם זה SEO — לטעון את ה-keywords של הלקוח דרך אותן שאילתות ש-`SeoDashboardView`/`useAhrefsEnrichment` משתמשים בהן (טבלאות `ahrefs_keywords` או דרך `useAhrefsEnrichment` hook על-ידי קריאה ישירה לטבלאות).
- לרנדר:
  - כותרת + שם הלקוח/דומיין
  - 4 כרטיסי snapshot: תנועה אורגנית / Top 3 / Top 10 / סך מילות מפתח (אם יש)
  - **טבלה של עד Top 10 ביטויים ראשונים** (sorted by position ≤ 10, asc) — עמודות: ביטוי, מיקום, שינוי חודשי, נפח, URL.
- ה-snapshot המוכן יישלח כתמונה דרך אותו `toPng` קיים — לא צריך לשנות את ה-capture flow.

### 4. הסרת הקאש של html-to-image שגרם לאזהרות (לא בלוקר)
מוסיפים `skipFonts: true` לקריאת `toPng` כדי למנוע את ה-`SecurityError` עם Google Fonts (אזהרות בלבד, אבל הצילום עובד).

---

## קבצים לעדכון

1. **`src/components/clients/ClientReportSnapshot.tsx`** — הוספת תמיכה ב-SEO:
   - שאילתה לטעינת `ahrefs_keywords` + `ahrefs_overview` (snapshot)
   - מצב רנדור חדש: ראשי snapshot + Top 10 keywords table
2. **`src/components/clients/ClientReportPanel.tsx`**:
   - `ensureShareLink()` — אם אין share link, יצירה אוטומטית עם token קריא לפני השליחה
   - שיפור error handling של Gmail (זיהוי "Token refresh failed" → הודעה ברורה + כפתור "התחבר מחדש")
   - הוספת `skipFonts: true` ל-`toPng`

---

## תוצאה למשתמש

- **דוח SEO**: הצילום מציג Top 10 ביטויים בעמוד הראשון (כפי שביקשת) + מטריקות snapshot.
- **קישור שיתוף**: אם אין — נוצר אוטומטית בלחיצה על "שלח דוח", ומצורף לקפשן/מייל.
- **אימייל**: במקום "שגיאה כללית" יוצגה הודעה ספציפית: "חיבור Gmail פג — יש להתחבר מחדש" + ניתוב לדף ההתחברות.

