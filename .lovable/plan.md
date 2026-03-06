

# תיקון: הזמנה לצ'אט שומרת tenant_id שגוי

## הבעיה
כשיוצרים קישור הזמנה לערוץ, הקוד שומר את `tenantId` מה-context הנוכחי (מבוסס URL) ולא את ה-`tenant_id` של הערוץ עצמו. כך כשאתה (super admin) נמצא בארגון "פודקאסטודיו" אבל מזמין לערוץ של "MarketingCaptain", ההזמנה נוצרת עם tenant_id שגוי → פליקס הצטרף לארגון הלא נכון ולא נוסף לערוץ הנכון.

## מה שצריך לתקן

### 1. תיקון יצירת הזמנה (`TeamChat.tsx`)
בקוד `generateInviteLink` — להשתמש ב-`channel.tenant_id` במקום `tenantId` מה-context:
```typescript
tenant_id: channel.tenant_id,  // במקום tenantId
```

### 2. תיקון `process-chat-invite` Edge Function
להשתמש ב-`tenant_id` של הערוץ (מה-join) במקום של ההזמנה, כהגנה נוספת:
```typescript
const tenantId = invite.team_channels?.tenant_id || invite.tenant_id;
```

### 3. תיקון הנתונים הקיימים (מיגרציה)
- עדכון ההזמנה הקיימת לערוץ "אנה / פליקס / דוד" ל-tenant_id הנכון (`2dcdaac6...`)
- הוספת פליקס כ-tenant_user ב-MarketingCaptain (אם לא קיים)
- הוספת פליקס כ-member בערוץ הנכון
- הסרת ה-member הכפול של David עם tenant שגוי

### 4. תיקון יצירת חברים בערוץ
גם בעת הוספת חברים חדשים לערוץ (דיאלוג ניהול חברים) — להשתמש ב-`channel.tenant_id`.

