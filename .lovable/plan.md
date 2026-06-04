נמצא למה זה קורה: בדוח eco.co.il יש 93 ביטויים במעקב, מתוכם 11 ב-Top 3 ו-37 ב-Top 10, אבל כרטיסי המדדים מציגים את `snapshot.org_keywords_top3/top10`. בסנכרון האחרון בקשת `organic-keywords` של Ahrefs נכשלה בגלל שדה `traffic` שלא קיים יותר בתשובת ה-API, ולכן `organic_keywords` ריק וה-snapshot נשמר עם Top 3/Top 10 = 0, למרות ש-`tracked_keywords` מלאים.

תוכנית תיקון:
1. לתקן את `fetch-ahrefs-snapshot` כך שבקשת Ahrefs ל-`organic-keywords` תשתמש בשדות התקינים של API v3 (`best_position`, `sum_traffic`, וכו׳) ותנרמל אותם ל-`position/traffic/url`.
2. להוסיף fallback בשרת: אם הספירה האורגנית חסרה או ריקה, לחשב `org_keywords_top3` ו-`org_keywords_top10` מתוך `tracked_keywords`, כדי שהכרטיסים לא יראו 0 כשיש ביטויים במעקב.
3. לעדכן את כרטיסי המדדים בדוח SEO כך שיקבלו גם את רשימת הביטויים במעקב ויציגו ספירה מחושבת מהנתונים בפועל כאשר ערכי ה-snapshot חסרים/0.
4. לפרוס את הפונקציה ולבדוק שוב סנכרון עבור eco.co.il כדי לוודא שהנתונים החדשים מציגים Top 3 ≈ 11 ו-Top 10 ≈ 37 לפי הביטויים שבמעקב.