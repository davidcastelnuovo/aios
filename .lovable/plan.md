

# תיקון: ברירת מחדל MarketingCaptain בהתחברות

## הבעיה
בכל התחברות חדשה, `resolveTenantSlug` שולף את רשימת הטנאנטים מ-`tenant_users` ובוחר את הראשון עם `status === 'active'`. הסדר לא מובטח, ולכן PodcastStudio נבחר לפני MarketingCaptain.

## הפתרון
שינוי הלוגיקה ב-`resolveTenantSlug` כך שכאשר אין `user_active_tenant`, הפונקציה תעדיף את MarketingCaptain (slug = `marketingcaptain`) מתוך רשימת הטנאנטים של המשתמש. רק אם המשתמש לא חבר ב-MarketingCaptain, תיבחר האופציה הראשונה כפי שהיה.

## קבצים לעריכה

### `src/hooks/useResolveTenant.ts`
- בשלב 2 (fallback), לאחר שליפת `userTenants`, לבדוק אם יש tenant עם slug `marketingcaptain` ולהעדיף אותו
- שורה ~53: שינוי הלוגיקה של `candidate` selection:

```typescript
// Prefer marketingcaptain tenant if user is a member
const mcTenant = userTenants.find((t: any) => t?.tenants?.slug === 'marketingcaptain');
const candidate = mcTenant || 
  userTenants.find((t: any) => t?.tenants?.status === 'active') || 
  userTenants[0];
```

### `src/contexts/TenantContext.tsx`
- בשאילתה `user-tenant` (שורה ~142), אותה לוגיקה - כשאין `activeTenant`, להעדיף MarketingCaptain:

```typescript
// Prefer marketingcaptain
const mcTenant = userTenants.find((t: any) => t?.tenants?.slug === 'marketingcaptain');
return mcTenant || userTenants[0];
```

## סיכום
שינוי קטן בשני קבצים - העדפת MarketingCaptain כברירת מחדל לכל מי שחבר בו, בלי לשבור שום דבר למשתמשים שלא חברים בו.

