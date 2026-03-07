

# תיקון ג'יבריש עברית באימיילים - Gmail API

## הבעיה
הפונקציה `getEmailBody` משתמשת ב-`atob()` לפענוח base64, אבל `atob` מחזיר string בינארי (Latin-1) ולא UTF-8. טקסט עברי (ותווי Unicode אחרים) נשבר ומוצג כג'יבריש.

## הפתרון
החלפת `atob()` בפונקציית decode שתומכת ב-UTF-8 נכון. ב-Deno אפשר להשתמש ב-`TextDecoder`:

```typescript
function decodeBase64Utf8(base64url: string): string {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder('utf-8').decode(bytes);
}
```

## שינויים ב-`supabase/functions/gmail-api/index.ts`
1. הוספת פונקציית `decodeBase64Utf8` (לפני `getEmailBody`)
2. החלפת 2 קריאות `atob(...)` ב-`getEmailBody` בקריאות ל-`decodeBase64Utf8(...)`
   - שורה 53: `return decodeBase64Utf8(payload.body.data);`
   - שורה 61: `return decodeBase64Utf8(part.body.data);`

שינוי קטן — פונקציה חדשה אחת + 2 שורות מוחלפות.

