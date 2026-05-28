# שיתוף חיבור Manus WA (Carmen) עם ארגונים אחרים

## תקציר
התשתית לשיתוף אינטגרציה בין ארגונים כבר קיימת ועובדת ב-Green API (טבלת `integration_tenant_access` + רכיב `ShareIntegrationTenantsDialog`). צריך רק לחבר את אותו רכיב לעמוד `ManusWhatsAppSettings`.

## שינוי בקוד
**`src/pages/ManusWhatsAppSettings.tsx`**:
1. Import `ShareIntegrationTenantsDialog` ו-`Share2` icon.
2. State חדש: `sharingIntegrationId: string | null`.
3. בכרטיס של כל חיבור (ליד "ערוך"/"סנכרן סוד") — כפתור חדש **"שתף עם ארגונים"** שפותח את הדיאלוג עם `integrationId={i.id}` ו-`integrationName={i.display_name || 'Manus WA'}`.
4. רינדור הדיאלוג בתחתית הקומפוננטה.

## איך זה עובד בריצה
- כשמסמנים ארגון יעד בדיאלוג → נוצרת רשומה ב-`integration_tenant_access` (`integration_id` של Carmen, `accessing_tenant_id` של היעד).
- אוטומציות בארגון היעד יכולות לבחור את החיבור הזה ב-WaProviderConnectionPicker (שכבר תומך באינטגרציות משותפות).
- ה-webhook של Manus וה-send-manus-wa-message ימשיכו לרוץ דרך אותו instance (Carmen), אבל ההודעות יתויגו לארגון של האוטומציה שהפעילה את השליחה.

## מה זה לא משנה
- לא מועבר owner של החיבור; דקל/הבעלים המקורי נשאר ב-`user_id` ו-`tenant_id`.
- ניתן להסיר שיתוף בכל רגע מאותו דיאלוג.
