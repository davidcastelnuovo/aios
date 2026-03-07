

# תיקון שגיאת redirect_uri_mismatch - Gmail OAuth

## הבעיה
השגיאה `redirect_uri_mismatch` (error 400) מגוגל פירושה שה-redirect URI שנשלח בבקשת ה-OAuth לא תואם לאף URI שמוגדר ב-Google Cloud Console.

ה-redirect URI שהפונקציה שולחת הוא:
```
https://jnzguisakdtcollxmgzd.supabase.co/functions/v1/gmail-auth
```

## מה צריך לעשות
**זה לא תיקון קוד - זו הגדרה ב-Google Cloud Console.**

יש להוסיף את הכתובת הזו כ-**Authorized redirect URI** ב-Google Cloud Console:

1. לך ל-[Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials)
2. לחץ על ה-OAuth 2.0 Client ID שמשמש את הפרויקט
3. בסקציית **Authorized redirect URIs**, הוסף:
   ```
   https://jnzguisakdtcollxmgzd.supabase.co/functions/v1/gmail-auth
   ```
4. שמור את השינויים

לאחר ההוספה, יכול לקחת כמה דקות עד שגוגל תעדכן את ההגדרות.

## הקוד תקין
הקוד ב-`gmail-auth/index.ts` כבר משתמש ב-redirect URI נקי (ללא query params), ולכן אין שינויי קוד נדרשים.

