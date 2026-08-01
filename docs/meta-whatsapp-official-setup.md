# Meta WhatsApp הרשמי — הגדרת האפליקציה ו־App Review

המערכת משתמשת באותה אפליקציית Meta שכבר משרתת את חיבורי Facebook, ומוסיפה לה את
מוצר WhatsApp. כל ארגון עובר **Embedded Signup** ומעניק לאפליקציה גישה ל־WABA
ולמספרים שלו. החיבור נשמר ב־AIOS לפי `tenant_id` ו־`phone_number_id`, כך שאותו
webhook משרת את כל הארגונים ומנותב בבטחה למספר המתאים.
אסימון ה־Business של כל חיבור נשמר בטבלת שרת ייעודית שאינה נגישה למשתמשי
ה־Frontend או ל־API בתפקיד `authenticated`.

## 1. הוספת מוצר WhatsApp לאפליקציה

1. היכנסו ל־[Meta for Developers](https://developers.facebook.com/apps/) ובחרו
   באפליקציית ה־Business הקיימת.
2. תחת **Add products** הוסיפו:
   - **WhatsApp**
   - **Facebook Login for Business** (אם עדיין אינו קיים).
3. ודאו שב־**App settings → Basic** מוגדרים:
   - App domains: `aios.co.il`
   - Privacy Policy URL: `https://aios.co.il/privacy`
   - Terms URL: `https://aios.co.il/terms`
   - Data deletion instructions URL לפי ההגדרה הקיימת של האפליקציה.
   - Business Portfolio מאומת ובעלות על הדומיין.

## 2. יצירת Embedded Signup Configuration

> **תנאי מקדים.** הבחירה ב־login variation מסוג *WhatsApp Embedded Signup*
> מופיעה רק לאפליקציות שקיבלו גישת Tech Provider / Solution Partner. באפליקציה
> ללא הגישה הזו ניתן לשמור Configuration רגיל של Facebook Login for Business,
> אבל הוא לא יפעיל את מסכי ה־WhatsApp. במקרה כזה יש להשתמש ב"חיבור ידני עם
> Access Token" — ראו סעיף 9.

1. היכנסו ל־**Facebook Login for Business → Configurations**.
2. צרו Configuration עבור WhatsApp Embedded Signup בגרסה העדכנית. אל תיצרו
   אינטגרציה חדשה על Embedded Signup v2: Meta הודיעה ש־v2 יוצאת משימוש
   ב־15 באוקטובר 2026; יש להשתמש ב־v4 או בגרסה העדכנית שמוצגת בדשבורד.
3. בחרו את ההרשאות:
   - `whatsapp_business_management`
   - `whatsapp_business_messaging`
4. הפעילו session logging. הוא חובה למסלול Coexistence.
5. תחת Allowed domains / Valid OAuth redirect URIs הוסיפו:
   - `https://aios.co.il`
   - `https://aios.co.il/`
6. העתיקו את ה־Configuration ID. הוא יישמר בסוד
   `META_WHATSAPP_CONFIG_ID`.

ה־Frontend פותח את הזרימה עם `sessionInfoVersion: "3"`. במסלול מספר קיים הוא
מוסיף:

```json
{
  "featureType": "whatsapp_business_app_onboarding"
}
```

זהו מסלול ה־Coexistence הרשמי: המשתמש ממשיך לשלוח ולקבל הודעות באפליקציית
WhatsApp Business, ובמקביל AIOS משתמשת ב־Cloud API. הודעות שנשלחות מהטלפון
מגיעות ל־AIOS דרך `smb_message_echoes`; אנשי קשר והיסטוריה מסונכרנים מיד לאחר
החיבור.

## 3. Webhook

ב־**WhatsApp → Configuration → Webhooks** הגדירו:

- Callback URL:
  `https://zvoijyneresvkadpprel.supabase.co/functions/v1/meta-whatsapp-webhook`
- Verify token: ערך אקראי וחזק; אותו ערך יוגדר בסוד
  `META_WHATSAPP_WEBHOOK_VERIFY_TOKEN`.

הירשמו לפחות לשדות:

- `messages`
- `message_template_status_update`
- `account_update`
- `history`
- `smb_app_state_sync`
- `smb_message_echoes`

שלושת השדות האחרונים נדרשים ל־Coexistence. ה־webhook מאמת
`X-Hub-Signature-256` באמצעות App Secret לפני עיבוד כל payload.

## 4. סודות Supabase

יש להגדיר בפרויקט `zvoijyneresvkadpprel`:

```text
FACEBOOK_APP_ID=<Meta App ID הקיים>
META_APP_SECRET=<Meta App Secret>
META_WHATSAPP_CONFIG_ID=<Embedded Signup Configuration ID>
META_WHATSAPP_WEBHOOK_VERIFY_TOKEN=<verify token אקראי>
META_GRAPH_API_VERSION=v25.0
```

`META_GRAPH_API_VERSION` אופציונלי; ברירת המחדל בקוד היא `v25.0`. יש לעדכן את
הערך כאשר Meta מפסיקה לתמוך בגרסה זו.

## 5. Advanced Access ו־App Review

ב־**App Review → Permissions and Features** בקשו Advanced Access עבור:

### `whatsapp_business_management`

טקסט מוצע באנגלית:

> AIOS is a multi-tenant CRM and automation platform. Each customer organization
> explicitly connects its own WhatsApp Business Account through Meta Embedded
> Signup. We use whatsapp_business_management to retrieve the WABA and business
> phone number selected by the customer, register Cloud API phone numbers,
> subscribe our app to the customer's WABA webhooks, and display connection and
> synchronization status inside the customer's isolated tenant. We never access
> WhatsApp assets that the customer did not select and authorize.

הווידאו צריך להציג:

1. כניסה לארגון בדיקה ב־AIOS.
2. אינטגרציות → WhatsApp Business הרשמי.
3. לחיצה על החיבור, מסך Embedded Signup ובחירת WABA ומספר.
4. חזרה ל־AIOS והצגת verified name, מספר, WABA ID ו־Phone Number ID.

### `whatsapp_business_messaging`

טקסט מוצע באנגלית:

> AIOS uses whatsapp_business_messaging to send and receive WhatsApp messages on
> behalf of customer organizations that explicitly onboard their own business
> phone number. Authorized organization users can reply to CRM clients and leads
> from the AIOS chat. Incoming messages and delivery events are received through
> Meta-signed webhooks and stored only in the tenant that owns the selected phone
> number. Free-form messages are sent only within Meta's customer-service window;
> outside that window the platform requires an approved WhatsApp template.

הווידאו צריך להציג ברצף:

1. מספר מחובר ופעיל ב־AIOS.
2. שליחת הודעה מתוך צ׳אט של לקוח/ליד.
3. קבלת ההודעה במכשיר WhatsApp של הנמען.
4. תשובה מהמכשיר והופעתה באותו thread ב־AIOS.

למסלול Coexistence מומלץ להוסיף קטע שמציג הודעה שנשלחת מאפליקציית WhatsApp
Business בטלפון ומופיעה ב־AIOS, ולהסביר שהיא התקבלה דרך
`smb_message_echoes`.

## 6. דרישות לפני הגשת Review

- האפליקציה במצב Live, עם Business Verification שהושלם.
- חשבון בדיקה ומספר בדיקה עובדים מקצה לקצה.
- Reviewer instructions כוללים משתמש בדיקה ל־AIOS, כתובת הארגון וצעדי ניווט.
- Privacy Policy, Terms ו־Data Deletion נגישים ללא התחברות.
- סרטוני review אינם חתוכים ומציגים גם את AIOS וגם את מכשיר WhatsApp.
- אין להציג App Secret, access token או מידע של לקוח אמיתי בסרטון.

במצב Development ניתן לבדוק עם משתמשי Meta שהם Admin/Developer/Tester של
האפליקציה. חיבור ארגונים חיצוניים דורש Advanced Access מאושר.

## 7. מספר חדש לעומת מספר קיים

### מספר חדש

- המספר אינו יכול להיות פעיל ב־WhatsApp Messenger הרגיל.
- הוא עובר אימות SMS/שיחה ב־Embedded Signup.
- AIOS מבקשת PIN בן 6 ספרות ורושמת את המספר ל־Cloud API.
- Meta דורשת להשלים registration בתוך 14 יום מה־signup.

### מספר שכבר פעיל ב־WhatsApp Business

- נדרש WhatsApp Business App בגרסה `2.24.17` ומעלה.
- האפליקציה חייבת להיות מוכרת כ־Tech Provider או Solution Partner.
- Embedded Signup חייב לפעול עם session logging ועם
  `featureType: whatsapp_business_app_onboarding`.
- לאחר החיבור AIOS בודקת `is_on_biz_app` ו־`platform_type`, נרשמת ל־WABA
  ומבקשת סנכרון contacts + history בתוך חלון 24 השעות של Meta.
- הלקוח יכול להמשיך להשתמש באפליקציה בטלפון לשיחות אחד־על־אחד.
- ניתוק מלא של Coexistence נעשה מתוך WhatsApp Business:
  **Settings → Account → Business Platform → Disconnect Account**.

Coexistence אינו זמין לכל מספר אוטומטית. Meta עשויה לדחות מספר שאינו זכאי,
מספר ללא מספיק פעילות, Business לא מאומת, או מספר שמשויך ל־Business Portfolio
אחר. במקרה כזה יש להשלים את דרישות הזכאות ב־Meta או לחבר מספר חדש.

## 8. מגבלות מוצר חשובות

- Cloud API אינו תומך בקבוצות WhatsApp.
- הודעה חופשית מותרת בתוך חלון שירות של 24 שעות מהודעת הלקוח; לאחר מכן נדרשת
  תבנית מאושרת.
- תבניות מנוהלות ישירות מתוך **אינטגרציות → WhatsApp Business הרשמי**. ניתן
  ליצור תבנית שירות/שיווק, לעקוב אחר סטטוס האישור, למחוק ולשלוח תבנית מאושרת
  למספר טלפון. Meta היא מקור האמת לסטטוס ולא נשמר עותק מקומי.
- יצירה ומחיקה דורשות `whatsapp_business_management`; שליחה דורשת
  `whatsapp_business_messaging`.
- כל התמחור, messaging limits, quality rating ואישור templates נקבעים על ידי
  Meta.
- מחיקת חיבור ב־AIOS מסירה את הגישה מהמערכת בלבד. היא אינה מוחקת WABA או מספר
  מ־Meta.

## 9. חיבור ידני עם Access Token

מסלול חלופי שאינו תלוי ב־Embedded Signup. הוא מתאים כשהאפליקציה אינה Tech
Provider, כשה־Configuration אינו זרימת WhatsApp, או כשרוצים לחבר מספר שכבר קיים
תחת ה־Business של הארגון.

### איך מזהים שצריך אותו

Meta מדלגת על כל מסכי ה־WhatsApp, מציגה אישור פייסבוק רגיל ומחזירה מיד לאתר.
הקוד שחוזר אינו קוד של Facebook Login for Business, ולכן החלפתו לאסימון נכשלת עם
`error_subcode 36008`. AIOS מזהה את המצב, מציגה הודעה מתאימה ופותחת אוטומטית את
כרטיס החיבור הידני.

### הפקת האסימון

1. **Meta Business Settings → Users → System users** ויצירת משתמש מערכת
   (מומלץ Admin).
2. **Add Assets** ובחירת חשבון ה־WhatsApp (WABA) עם הרשאת Full control.
3. **Generate new token**, בחירת האפליקציה, וסימון:
   - `whatsapp_business_management`
   - `whatsapp_business_messaging`
4. אסימון של System User אינו פג. אין להעביר אותו בערוצים לא מאובטחים.

### החיבור עצמו

בדף **WhatsApp Business הרשמי** פותחים את "חיבור ידני עם Access Token",
מדביקים את האסימון ולוחצים **שליפת חשבונות ומספרים**. AIOS קוראת את הנכסים
שהאסימון מורשה עליהם, מציגה כל WABA עם המספרים שלו, ומחברת את המספר שנבחר:
נרשמת ל־webhooks, מריצה `register` עם PIN אם המספר אינו במצב Coexistence, ומפעילה
סנכרון אנשי קשר והיסטוריה כשהוא כן.

האסימון נשמר בטבלת `meta_whatsapp_tokens` שנגישה ל־service role בלבד, ואינו מוחזר
לדפדפן. חיבורים שנוצרו כך מסומנים ב־`settings.onboarding_method = "manual_token"`.

### בדיקת תצורה

הכפתור **בדיקת תצורת Meta** מריץ את פעולת `diagnose` ב־`meta-whatsapp-auth`,
שמדווחת מה Meta מחזירה עבור ה־`META_WHATSAPP_CONFIG_ID` המוגדר ואילו webhooks
רשומים לאפליקציה. זו הדרך המהירה לוודא אם ה־Configuration בכלל קיים ונגיש.
