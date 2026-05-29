
## סטטוס בדיקה

### ✅ מה תקין בקוד

**`supabase/functions/manage-manus-wa/index.ts`** — מוטמע נכון:
- משתמש ב-`MANUS_GATEWAY_URL` ו-`MANUS_GATEWAY_WORKER_SECRET` מ-env
- שולח `X-Worker-Secret` ל-Admin endpoints (`/api/admin/instances`, `/qr-token`, `/status`)
- שולח `X-Api-Key` per-instance ל-REST (`/api/v1/instances/:id/send/text`)
- 4 actions: `create_instance`, `get_qr_link`, `get_status`, `send_message`
- שגיאה ברורה אם `WORKER_SECRET` חסר

**`supabase/functions/run-ai-agent/index.ts`** — 4 כלים של כרמן מחוברים:
- `create_whatsapp_instance` (שורה 140)
- `get_whatsapp_qr_link` (שורה 141)
- `get_whatsapp_status` (שורה 142)
- `send_whatsapp_via_gateway` (שורה 143)
- כל ה-cases ב-`executeTool` קוראים ל-`manage-manus-wa` עם service-role key

### ❌ מה חסר — secrets לא הוגדרו

בדקתי את רשימת ה-secrets בפרויקט. **שניהם חסרים:**

| Secret | סטטוס |
|--------|--------|
| `MANUS_GATEWAY_URL` | ❌ לא קיים |
| `MANUS_GATEWAY_WORKER_SECRET` | ❌ לא קיים |

בלעדיהם, הפונקציה תחזיר מיד שגיאה:
> `MANUS_GATEWAY_WORKER_SECRET is not configured.`

(הקוד נופל ל-fallback `https://whatsappgw-pzpyrrww.manus.space` אם `MANUS_GATEWAY_URL` חסר, אז זה לא קריטי — אבל עדיף להגדיר אותו במפורש.)

## שלב הבא (לאחר אישור Build)

1. אקרא ל-`add_secret` עבור שני ה-secrets. תקבל טופס מאובטח להזנת:
   - `MANUS_GATEWAY_URL` = `https://whatsappgw-pzpyrrww.manus.space`
   - `MANUS_GATEWAY_WORKER_SECRET` = הערך של `WORKER_SECRET` מה-Gateway ב-Manus
2. אבדוק `cloud_status` ואדפלוי מחדש את `manage-manus-wa` אם צריך.
3. אריץ test call ל-`manage-manus-wa` עם `action: create_instance` (test tenant) כדי לוודא שה-Gateway מגיב 200 OK.
4. אבדוק logs ב-`manage-manus-wa` אחרי הקריאה.

**לא נדרשים שינויי קוד.** רק הגדרת secrets ובדיקת deploy.
