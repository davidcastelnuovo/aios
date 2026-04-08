# מדריך דפלוימנט — after-lead ב-Lovable

## סקירה כללית

פרויקט **after-lead** בנוי על React + TypeScript + Supabase.
הדפלוימנט מתבצע דרך [Lovable](https://lovable.dev) שמחבר ישירות ל-GitHub ומפרסם לאוטומטית.

---

## שלב 1 — הכנת Supabase

### 1.1 יצירת פרויקט Supabase

1. היכנסו ל-[supabase.com](https://supabase.com) וצרו פרויקט חדש
2. שמרו את הפרטים הבאים (תצטרכו אותם בהמשך):
   - **Project URL** — `https://xxxx.supabase.co`
   - **anon key** — מפתח ציבורי
   - **service_role key** — מפתח שרת (סודי!)

### 1.2 הרצת מיגרציות

בממשק Supabase → SQL Editor, הריצו את כל קבצי ה-SQL מתיקיית `supabase/migrations/` לפי סדר:

```sql
-- דוגמה: הריצו כל קובץ בנפרד לפי שם (תאריך עולה)
```

### 1.3 פריסת Edge Functions

```bash
# התקינו Supabase CLI
npm install -g supabase

# התחברות
supabase login

# קישור לפרויקט
supabase link --project-ref YOUR_PROJECT_REF

# פריסת הפונקציה
supabase functions deploy social-gantt-generate
```

### 1.4 הגדרת Secrets לפונקציה

```bash
supabase secrets set LOVABLE_API_KEY=your_lovable_api_key_here
```

> **איפה מקבלים LOVABLE_API_KEY?**
> Lovable Dashboard → Settings → API Keys → צרו מפתח חדש

---

## שלב 2 — הגדרת Lovable

### 2.1 ייבוא הפרויקט

1. היכנסו ל-[lovable.dev](https://lovable.dev)
2. לחצו **"Import from GitHub"**
3. בחרו את ה-repository: `davidcastelnuovo/after-lead`
4. Lovable יזהה אוטומטית את הפרויקט כ-Vite + React

### 2.2 הגדרת משתני סביבה

ב-Lovable Dashboard → Project Settings → Environment Variables, הוסיפו:

| משתנה | ערך | הסבר |
|-------|-----|-------|
| `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` | כתובת פרויקט Supabase |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` | מפתח ציבורי של Supabase |

> **חשוב:** משתני `VITE_*` נחשפים ל-frontend. אל תכניסו כאן מפתחות סודיים.

### 2.3 הגדרת Build

Lovable מזהה אוטומטית את הגדרות ה-build מ-`package.json`:
- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Node version:** 18+

אם צריך לשנות — לכו ל-Project Settings → Build Settings.

---

## שלב 3 — דפלוימנט ראשון

### 3.1 Trigger ידני

1. ב-Lovable Dashboard → לחצו **"Deploy"**
2. המתינו לסיום הבנייה (2-5 דקות)
3. Lovable יספק URL ציבורי: `https://your-project.lovable.app`

### 3.2 Auto-Deploy מ-GitHub

לאחר ההגדרה הראשונית, כל push ל-branch `main` יגרום לדפלוימנט אוטומטי.

```bash
# כל commit ל-main מפרסם אוטומטית
git push origin main
```

---

## שלב 4 — הגדרת דומיין מותאם (אופציונלי)

1. Lovable Dashboard → Domains → Add Custom Domain
2. הזינו את הדומיין שלכם: `app.yourdomain.com`
3. הוסיפו CNAME record ב-DNS שלכם:
   ```
   CNAME app.yourdomain.com → your-project.lovable.app
   ```
4. Lovable מטפל אוטומטית ב-SSL

---

## שלב 5 — הגדרת Supabase Auth (לאחר דפלוימנט)

### 5.1 הוסיפו את ה-URL המותר

ב-Supabase → Authentication → URL Configuration:

```
Site URL: https://your-project.lovable.app
Redirect URLs:
  https://your-project.lovable.app/**
  https://app.yourdomain.com/**  (אם יש דומיין מותאם)
```

---

## שלב 6 — בדיקות לאחר דפלוימנט

### Checklist

- [ ] האפליקציה נטענת ללא שגיאות console
- [ ] התחברות עם Supabase Auth עובדת
- [ ] הגאנט מציג את ימי החודש
- [ ] לחיצה על יום ריק פותחת את פאנל הרעיונות
- [ ] כפתור "ייצר רעיונות" מחזיר תוצאות מה-AI
- [ ] יצירת פוסט חדש שומרת ל-Supabase
- [ ] עריכת פוסט קיים עובדת
- [ ] Edge Function `social-gantt-generate` מגיבה

### בדיקת Edge Function

```bash
# בדיקה ישירה של הפונקציה
curl -X POST https://xxxx.supabase.co/functions/v1/social-gantt-generate \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action": "generate_day_ideas", "date": "2026-04-15", "tenant_id": "test"}'
```

---

## פתרון בעיות נפוצות

### שגיאה: "LOVABLE_API_KEY not configured"

```bash
# ודאו שה-secret הוגדר נכון
supabase secrets list
supabase secrets set LOVABLE_API_KEY=your_key_here
supabase functions deploy social-gantt-generate  # deploy מחדש
```

### שגיאה: "Unauthorized" בקריאות ל-Supabase

ודאו שמשתני הסביבה `VITE_SUPABASE_URL` ו-`VITE_SUPABASE_ANON_KEY` הוגדרו נכון ב-Lovable.

### הגאנט ריק לאחר דפלוימנט

לחצו על כפתור **"טען דמו"** שמופיע כשאין פוסטים — הוא יוסיף 12 פוסטי דמו לחשבון הנוכחי.

### Build נכשל ב-Lovable

בדקו את לוג ה-build ב-Lovable Dashboard. בעיות נפוצות:
- חסרים משתני סביבה
- גרסת Node לא תואמת (השתמשו ב-18+)
- dependency חסר ב-`package.json`

---

## ארכיטקטורת הפרויקט

```
after-lead/
├── src/
│   ├── components/
│   │   └── social-gantt/          ← רכיבי הגאנט
│   │       ├── SocialGanttVisualView.tsx   ← לוח חודשי מלא
│   │       ├── SocialGanttPostPanel.tsx    ← פאנל עריכת פוסט
│   │       ├── DayIdeaPanel.tsx            ← פאנל רעיונות AI
│   │       ├── SocialGanttHeader.tsx       ← כותרת + פילטרים
│   │       ├── CopyAgent.tsx               ← סוכן קופי
│   │       └── CreativeAgent.tsx           ← סוכן קריאייטיב
│   └── pages/
│       └── SocialDashboard.tsx    ← דשבורד ראשי
├── supabase/
│   ├── functions/
│   │   └── social-gantt-generate/ ← Edge Function לAI
│   └── migrations/                ← מיגרציות DB
└── LOVABLE_DEPLOYMENT.md          ← המדריך הזה
```

---

## קישורים שימושיים

- [Lovable Documentation](https://docs.lovable.dev)
- [Supabase CLI Reference](https://supabase.com/docs/reference/cli)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode)
