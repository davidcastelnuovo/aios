## הוספת שורת חיפוש קמפיינים בדיאלוג מיפוי WordPress

### רקע
בדיאלוג "שייך טפסים לקמפיינים" (WordPress Settings → Map Forms/Slugs to Campaigns), המשתמש צריך לבחור קמפיין מרשימת הקמפיינים המסונכרנים מהלקוח. כשיש הרבה קמפיינים, קשה למצוא את הנכון.

### שינוי
1. הוספת state `campaignSearch` בקומפוננטה הראשית שמתאפס כש-`mappingSite` משתנה.
2. חישוב `filteredCampaigns` על ידי סינון `clientCampaigns` לפי `campaign_name` (case-insensitive, includes).
3. בכל `SelectContent` (טאב form וטאב slug) - הוספת `Input` חיפוש בראש הרשימה (sticky) עם `onKeyDown={(e) => e.stopPropagation()}` כדי לא להפריע ל-typeahead של Radix Select.
4. הצגת `filteredCampaigns` במקום `clientCampaigns` בתוך כל Select.
5. הצגת הודעת "לא נמצאו תוצאות" אם אין קמפיינים תואמים.

### קבצים
- `src/pages/WordPressSettings.tsx` — שינוי בדיאלוג מיפוי הקמפיינים בלבד.

### פרטים טכניים
- השדה יופיע בתוך `SelectContent` לפני ה-`SelectItem` הראשון.
- `campaignSearch` shared state עבור שני הטאבים (מספיק כי רק טאב אחד נראה בכל רגע).
- לא משפיע על שמירה/טעינה של מיפוי.