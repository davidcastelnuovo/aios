

# תיקון: קישור הזמנה לצ'אט משתמש בדומיין הלא נכון

## הבעיה
בקובץ `src/pages/TeamChat.tsx`, קישור ההזמנה נבנה כך:
```
window.location.origin + "/chat-invite/" + token
```
זה מחזיר את הדומיין של הפריביו (`lovableproject.com`) במקום הדומיין של האפליקציה המפורסמת (`after-lead.lovable.app` או דומיין מותאם אישית).

## הפתרון
להחליף את `window.location.origin` בקישורי ההזמנה בדומיין המפורסם של האפליקציה. שתי אפשרויות:

1. **שימוש ב-env variable** — להגדיר `VITE_APP_URL` או להשתמש בדומיין הפורסם הקיים
2. **לוגיקה חכמה** — אם הדומיין הנוכחי מכיל `lovableproject.com`, להחליף לדומיין המפורסם

הגישה הטובה ביותר: להוסיף פונקציית עזר `getPublicOrigin()` שמחזירה את הדומיין המפורסם (`https://after-lead.lovable.app`) כאשר הדומיין הנוכחי הוא lovableproject/lovable.app, ואחרת משתמשת ב-`window.location.origin`.

## שינויים
**קובץ: `src/pages/TeamChat.tsx`**
- שורה ~1793: החלפת `window.location.origin` ב-`getPublicOrigin()`
- שורה ~1812: אותו דבר
- הוספת פונקציית עזר בראש הקובץ

**קובץ: `src/pages/ChatInvite.tsx`**
- שורה ~167: עדכון ה-`redirectTo` של Google OAuth באותה צורה

