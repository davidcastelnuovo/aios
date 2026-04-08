

# הוספת יכולת חיבור חשבון מודעות פייסבוק לכרמן

## מה ישתנה
כרמן תקבל שני כלים חדשים שיאפשרו לה לשלוף רשימת חשבונות מודעות פייסבוק ולחבר אותם ללקוחות דרך טבלאות דינמיות (crm_tables) — בדיוק כמו שעושים ידנית בממשק הדוחות.

## שינויים טכניים

### קובץ: `supabase/functions/run-ai-agent/index.ts`

**1. שני כלים חדשים ב-ALL_TOOLS:**

- **`list_facebook_ad_accounts`** — שולף את כל חשבונות המודעות מ-Facebook Graph API דרך הטוקן השמור ב-tenant_integrations. מחזיר רשימת חשבונות (id, name, status, currency).

- **`create_facebook_report_table`** — יוצר טבלת crm_tables חדשה מסוג `facebook_insights` עם `integration_settings.ad_account_id` ו-`client_id`. זה בדיוק מה שקורה כשמגדירים דוח פייסבוק ידנית.

**2. הוספת tool handler ב-executeTool:**

- **`list_facebook_ad_accounts`**: שולף את ה-access_token מ-tenant_integrations (כולל fallback ל-shared_from_integration_id), קורא ל-Graph API v21.0, מחזיר רשימת חשבונות.

- **`create_facebook_report_table`**: מקבל `client_id` + `ad_account_id` + `ad_account_name`. בודק שלא קיימת כבר טבלה לאותו לקוח. יוצר רשומה ב-crm_tables עם integration_type=facebook_insights.

**3. כלי עזר: `list_unconnected_clients`** — שולף לקוחות פעילים שאין להם טבלת facebook_insights ב-crm_tables. מחזיר רשימת לקוחות שצריכים חיבור.

**4. סקיל prompt חדש `facebook-account-setup`** ב-SKILLS_PROMPTS ו-TASK_SKILLS_PROMPTS:
- הנחיות לכרמן: קודם תריצי `list_unconnected_clients`, אז `list_facebook_ad_accounts`, ואז תנסי להתאים לפי שם (fuzzy match בין שם הלקוח לשם חשבון המודעות). אם יש התאמה ברורה — חברי אוטומטית עם `create_facebook_report_table`. אם לא — צרי משימה לקמפיינר לבצע את החיבור ידנית.

## תוצאה
כרמן תוכל:
1. לזהות לקוחות שלא מחוברים לפייסבוק
2. לשלוף רשימת חשבונות מודעות
3. לחבר אוטומטית כשיש התאמת שמות
4. ליצור משימה כשאין התאמה ברורה

