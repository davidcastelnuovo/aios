## הבעיה
ב-Desktop ה-`TaskBacklogPanel` מסומן כ-`sticky left-0` בתוך קונטיינר RTL עם גלילה אופקית. ב-RTL, הצמדה לצד הימני (הצד הנראה לעין שבו הפאנל מופיע) דורשת `right-0`, לא `left-0`. לכן כשגוללים ימינה הפאנל "בורח" עם הגלילה במקום להישאר נעוץ.

## התיקון
ב-`src/components/tasks/WeeklyTaskBoard.tsx` שורה 1356:

- להחליף `sticky left-0 top-0` ב-`sticky right-0 top-0` כדי שהפאנל יישאר נעוץ בצד הימני הנראה תוך כדי גלילה אופקית של היומן.
- לוודא ש-z-index (`z-20`) מספיק כדי שהפאנל יציג מעל עמודות הימים בזמן גלילה — להוסיף רקע מלא (`bg-background`) לעטיפה אם חסר, כך שעמודות לא "יציצו" מתחתיו.

לא נדרש שינוי בלוגיקת ה-DnD — הפאנל כבר תומך כ-drop target, רק צריך להישאר נראה.

## קבצים
- `src/components/tasks/WeeklyTaskBoard.tsx` — שינוי class יחיד בעטיפת ה-`TaskBacklogPanel`.