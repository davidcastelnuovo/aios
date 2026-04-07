

# תוכנית: שיפור תהליך החיבור ב-Unified.to

## הבעיות הנוכחיות
1. אחרי חיבור מוצלח בחלון Unified.to, אין זיהוי אוטומטי — המשתמש צריך להדביק Connection ID ידנית
2. כל הקטגוריות מוצגות תמיד, ללא סימון אילו כבר מחוברות
3. אין חיווי ויזואלי ברור למצב חיבור

## הפתרון

### שלב 1: דף Callback אוטומטי
יצירת דף `/unified-callback` שמקבל את ה-`id` מה-URL אחרי חיבור מוצלח, שומר אוטומטית את החיבור דרך ה-Edge Function, ומעביר הודעה לחלון האב (`window.opener.postMessage`) כדי לרענן את הרשימה — ואז סוגר את עצמו.

### שלב 2: עדכון UnifiedProviderPicker
- שינוי `success_redirect` לכתובת ה-callback החדשה (כולל פרמטרים של category ו-integration_type)
- הסרת שלב ה-"Save" הידני (הזנת Connection ID)
- הוספת האזנה ל-`postMessage` מחלון ה-callback — כשמתקבלת הודעת הצלחה, הדיאלוג נסגר ורשימת החיבורים מתרעננת

### שלב 3: סימון קטגוריות מחוברות בדף UnifiedSettings
- הצלבה בין הקטגוריות לחיבורים הפעילים
- הוספת Badge ירוק "מחובר" על קטגוריות עם חיבור פעיל
- הצגת שם הספק המחובר על הקטגוריה

### שלב 4: הוספת Route חדש
הוספת `/unified-callback` ל-Router של האפליקציה.

## קבצים שישתנו
- `src/pages/UnifiedCallback.tsx` — חדש
- `src/components/unified/UnifiedProviderPicker.tsx` — הסרת שלב ידני, הוספת postMessage listener
- `src/pages/UnifiedSettings.tsx` — סימון קטגוריות מחוברות
- `src/App.tsx` — הוספת route

## פרטים טכניים
- ה-callback page ישלח `action: "save_connection"` ל-Edge Function עם ה-`id` מה-URL
- `window.opener.postMessage({ type: "unified-connected" })` ירענן את הדף הראשי
- הקטגוריות המחוברות יזוהו לפי שדה `unified_category` ב-settings של החיבורים הפעילים

