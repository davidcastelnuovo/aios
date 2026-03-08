

# תיקון: מסך לבן כשהדאטה-בייס לא מגיב

## הבעיה
ב-`TenantContext.tsx`, כשהמערכת מנסה לסנכרן את ה-tenant לדאטה-בייס (שורה 106-126), אם הדאטה-בייס לא מגיב (timeout), הפונקציה נתקעת לנצח. ה-UI חסום (שורה 225) כי `isActiveTenantSynced` נשאר `false`.

למרות שיש catch block, הוא לא עוזר כשהפרומיס לא מחזיר תשובה בכלל (timeout ללא rejection).

## הפתרון
הוסיף timeout של 5 שניות לפונקציית `syncTenantToDb`. אם הסנכרון לא מסתיים תוך 5 שניות — לסמן כ-synced ולהמשיך (הנתונים יהיו נכונים ב-99% מהמקרים כי ה-URL כבר מגדיר את ה-tenant).

## שינויים
**קובץ: `src/contexts/TenantContext.tsx`**

בפונקציית `syncTenantToDb` (שורות ~68-139), לעטוף את כל הלוגיקה ב-`Promise.race` עם timeout:

```typescript
const syncTenantToDb = async () => {
  if (!currentTenantId || isActiveTenantSynced) return;

  const timeoutPromise = new Promise<void>((resolve) => {
    setTimeout(() => {
      console.warn("⚠️ Tenant sync timed out after 5s, unblocking UI");
      resolve();
    }, 5000);
  });

  const syncPromise = (async () => {
    // ... existing sync logic ...
  })();

  await Promise.race([syncPromise, timeoutPromise]);
  setIsActiveTenantSynced(true);
};
```

זה מבטיח שה-UI לעולם לא ייתקע יותר מ-5 שניות, גם אם הדאטה-בייס לא מגיב.

