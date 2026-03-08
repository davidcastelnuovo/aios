

# תוכנית: כיבוי האוטומציה הבעייתית וביצוע בדיקה

## שורש הבעיה
האוטומציה **"פלוו חדש"** (`75c7a6da-cff8-4ee1-8d15-823ee361db44`) מכילה trigger step מסוג `whatsapp_message_received` שמחפש את המילה "דוד" בקבוצה ספציפית.

**מה קורה בפועל**: כל הודעת WhatsApp נכנסת (מכל שיחה, לא רק מהקבוצה) גורמת ל:
1. `green-api-webhook` רץ → health check + DB queries לזיהוי tenant
2. קורא ל-`trigger-automation` עם `trigger_type: whatsapp_message_received`
3. `trigger-automation` מושך את כל ה-`automation_flow_steps` עם `action_type: whatsapp_message_received` מה-DB
4. רק אז מסנן לפי קבוצה/מילת מפתח

כלומר גם אם ההודעה לא מהקבוצה הנכונה ולא מכילה "דוד" -- עדיין רצות 3-4 שאילתות DB **לכל הודעה**. בנוסף, ה-webhook קורא ל-`trigger-automation` כ-fire-and-forget, מה שמייצר עומס מצטבר.

## הפתרון

### שלב 1 - כיבוי האוטומציה (מיגרציה)
```sql
UPDATE automations SET active = false WHERE id = '75c7a6da-cff8-4ee1-8d15-823ee361db44';
```

### שלב 2 - הרצת ANALYZE + idle timeout (מיגרציה)
המיגרציה שנכשלה קודם בגלל העומס:
```sql
ANALYZE public.user_active_tenant;
ANALYZE public.user_roles;
ANALYZE public.tenant_users;
ANALYZE public.profiles;
ALTER ROLE authenticator SET idle_in_transaction_session_timeout = '30s';
```

### שלב 3 - בדיקה
אחרי כיבוי האוטומציה, לבדוק שהמערכת חוזרת לפעולה תקינה.

## איך לבנות את זה נכון בעתיד
כשנרצה להחזיר את האוטומציה, צריך לוודא שהסינון לפי קבוצה קורה **בתוך ה-webhook עצמו** (לפני הקריאה ל-trigger-automation) -- כך רק הודעות מהקבוצה הרלוונטית יגרמו לעומס DB.

