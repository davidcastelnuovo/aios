## מטרה
לאפשר ש‑Green API ו‑Manus WhatsApp יהיו מחוברים ופעילים בו‑זמנית לאותו משתמש, עם בחירת ספק בצ'אט ובאוטומציות.

## מצב נוכחי
- **דף "אינטגרציות צ'אט"**: ה‑toggles של Green API ו‑Manus WA כבר נפרדים פר־משתמש ולא מבטלים אחד את השני. אפשרי טכנית להפעיל את שניהם.
- **`ChatView`**: כבר קיים מתג בין ספקים (`availableProviders.length > 1`) — מציג כפתורי Green / Manus / ManyChat ושומר את הבחירה ב‑localStorage לכל tenant.
- **`StepConfigPanel` (אוטומציות חדשות, צעדי WhatsApp)**: כבר טוען גם `green_api` וגם `manus_wa` ובוחר ביניהם.
- **`AddAutomationForm` / `EditAutomationDialog` (המסך הישן של אוטומציות)**: טוענים אך ורק `green_api` בשם השדה `green_api_integration_id` — לא ניתן לבחור Manus.
- **`ChatView` שאילתת `chat-integrations`**: לא מסננת לפי `user_id`, ולכן אם באותו tenant יש חיבור Green של משתמש אחר היא עלולה להציג ספק שאינו של המשתמש המחובר.

## שינויים מוצעים (Frontend בלבד)

### 1. `src/components/chat/ChatView.tsx`
- להוסיף סינון `user_id = currentUser` לשאילתת `chat-integrations` עבור `green_api` ו‑`manus_wa` (לשמור על `manychat` ברמת tenant).
- כך מתג הספקים יציג רק את אלה ששייכים למשתמש המחובר ובאמת פעילים אצלו.
- לוודא שכשמשנים ספק נטענת מחדש היסטוריית ההודעות עבור אותו contact מאותו ספק (כבר כך לפי `connectionUserId`).

### 2. `src/pages/ChatIntegrations.tsx`
- שום שינוי לוגי נדרש — אבל לעדכן את הטקסט/UX כך שיובהר שניתן להפעיל גם Green וגם Manus במקביל, ולהסיר כל רמיזה ל"בחירה הדדית" אם קיימת.
- (אופציונלי) הוספת חיווי "ספק ברירת מחדל לצ'אט" שמסומן ב‑localStorage כדי שיהיה ברור איזה ייפתח כברירת מחדל בצ'אט.

### 3. `src/components/forms/AddAutomationForm.tsx` ו‑`EditAutomationDialog.tsx`
- בשליפת האינטגרציות לאוטומציות WhatsApp: להחליף את הסינון מ‑`.eq('integration_type', 'green_api')` ל‑`.in('integration_type', ['green_api','manus_wa'])`.
- לשנות את שם השדה הלוגי בטופס מ‑`green_api_integration_id` ל‑`whatsapp_integration_id` (השמירה עדיין ב‑`configuration.integration_id` כפי שהיום — תאימות לאחור נשמרת).
- ב‑Select של החיבור להציג תווית "Green API" / "Manus WA" לצד שם החיבור (כמו ש‑`StepConfigPanel` כבר עושה).
- לעדכן את ה‑labels וה‑placeholders בטופס מ"חיבור Green API" ל"חיבור WhatsApp".

### 4. בדיקה ידנית
- להפעיל את שני הספקים באותו משתמש, לפתוח צ'אט ולוודא שהמתג בין Green ל‑Manus מופיע ועובד.
- ביצירת אוטומציה חדשה לבחור חיבור Manus WA ולוודא שמירה ושליחה תקינה.

## הערות
- אין שינויי DB / RLS / Edge Functions — כל היכולת קיימת כבר ברמת הנתונים; חסר רק חשיפה ב‑UI ותיקון סינון.
- אין שינוי לפלואים שאינם WhatsApp (ManyChat / Telegram).