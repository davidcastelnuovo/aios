## הבעיה

הלוגים מ-`manus-wa-webhook` מראים בבירור:
```
Webhook secret mismatch for instance YwIn7GY3Ul3OAxXG
```

ז"א — Manus **כן** שולח webhooks (גם כשפליקס שלח, גם כשאתה שלחת מהטלפון), אבל ה-webhook שלנו דוחה את כולם עם 401 כי הסוד לא תואם. בנוסף, גם אם זה היה עובר, השדה `settings.phone_number` ריק → ההודעות שאתה שולח מהטלפון היו נרשמות בכיוון הפוך (inbound במקום outbound).

לכן: שום הודעה — לא נכנסת מלקוחות, ולא יוצאת מהטלפון — לא נשמרת ב-DB ולא מופיעה בצ'אט.

## מה אעשה (3 תיקונים)

### 1. תיקון אימות ה-Webhook Secret
- ב-`manus-wa-webhook`: לקבל את הסוד מאחד מכמה headers אפשריים ש-Manus עשוי לשלוח: `x-wa-gateway-secret`, `x-webhook-secret`, `x-manus-secret`, או query-param `?secret=`. אם אחד מהם תואם — לקבל.
- **Auto-heal:** אם `settings.webhook_secret` ריק במסד אבל headerSecret קיים — לשמור את הסוד שהתקבל ולקבל את ההודעה (one-time bootstrap).
- כפתור חדש ב-`ManusWhatsAppSettings`: "סנכרן סוד מ-Manus" — מאפס את `webhook_secret` במסד וממתין ל-webhook הראשון כדי לתפוס את הסוד שמוגדר בפועל ב-Manus.

### 2. אכיפת שמירת `phone_number`
- ב-`ManusWhatsAppSettings`: לאחר `saveMutation` מוצלח, להריץ אוטומטית `manus-wa-status` כדי למשוך את ה-`phoneNumber` ולעדכן את ה-settings.
- ב-`manus-wa-webhook`: גם אם `myPhone` ריק, לזהות outbound לפי שדות אלטרנטיביים בפיילוד של Manus (`fromMe: true`, או `direction: 'outgoing'`) במקום להסתמך רק על השוואת מספרים.

### 3. שיפור עמידות + לוגים
- להדפיס ב-webhook את ה-headers שמתקבלים בפעם הראשונה (פעם אחת לכל instance) — כדי שאוכל לאתר את שם ה-header הנכון אם Manus ישנו אותו.
- להחזיר 200 (במקום 401) על mismatch אחרי שמירת רשומת diagnostic, כדי ש-Manus לא יפסיק לנסות.
- להוסיף Alert ב-UI: "אם אתה לא רואה הודעות נכנסות — לחץ 'סנכרן סוד'".

## קבצים שישתנו

- `supabase/functions/manus-wa-webhook/index.ts` — multi-header secret + auto-heal + fromMe detection + diagnostic logging
- `src/pages/ManusWhatsAppSettings.tsx` — auto-status אחרי שמירה + כפתור "סנכרן סוד" + Alert הסבר

## אחרי הדפלוי

תלחץ בדף ההגדרות "סנכרן סוד" → תלך ל-Manus → תוודא שה-Webhook Secret שם זהה לזה שמופיע אצלנו (או תשמור ב-Manus סוד חדש ותחזור ללחוץ "בדוק סטטוס"). ההודעה הבאה מפליקס תיכנס.