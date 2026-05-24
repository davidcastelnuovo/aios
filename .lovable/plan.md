## הבעיה

ב-`src/pages/WordPressSettings.tsx` הדיאלוג "שייך טפסים לקמפיינים" שומר את הערכים ל-DB (אימתתי שלאתר eco-trip יש כיום `campaign_form_mapping` ו-`campaign_url_mapping` מאוכלסים), אבל בפתיחה מחדש השיוך נראה ריק. הסיבה שילוב של מספר באגים:

1. **`mappingMode` לא מתאפס ב-`openMapping`** — אם בפעם הקודמת היה במצב "slug", נשאר במצב הזה גם עבור אתר חדש. ה-draft מתאתחל מ-`campaign_form_mapping` (לא מ-url) — חוסר התאמה.
2. **התחלת ה-draft שלא תואמת ל-mode הנבחר** — `openMapping` תמיד מטעין `campaign_form_mapping` ל-draft, גם כשהטאב הפעיל הוא slug. התוצאה: ערכי slug שמורים לא מופיעים.
3. **`mappingSite` הוא snapshot ישן** — אחרי שמירה, הדיאלוג נסגר ו-`setMappingSite(null)`. כשהמשתמש פותח שוב מיד, ייתכן שה-query עוד לא הספיק לעדכן, ו-`site` מגיע במצב ישן.
4. **דריסת mappingDraft בשינוי טאב** מאפסת עריכות לא שמורות — לא קריטי, אבל כדאי לתקן.

## התיקון

ערוך את `src/pages/WordPressSettings.tsx`:

**א. `openMapping` (סביב שורה 474):**
- בחר mode התחלתי לפי תוכן: אם `campaign_form_mapping` ריק ויש ערכים ב-`campaign_url_mapping` — התחל ב-`"slug"`, אחרת `"form"`.
- אתחל את `mappingDraft` מהמיפוי שתואם ל-mode הנבחר.
- שמור את ה-mode שנבחר באמצעות `setMappingMode(...)`.

**ב. שינוי טאב (סביב שורה 1355):**
- במקום לדרוס draft מ-`mappingSite`, מזג: שמור את ערכי ה-mode הנוכחי, החלף mode, וטען את ה-draft מ-`mappingSite[mode-המתאים]` רק אם ה-draft של ה-mode החדש עוד לא נטען (כלומר שמור per-mode draft). אופציה פשוטה יותר: שמור שני state נפרדים `formDraft` ו-`slugDraft` והשתמש בנבחר לפי mode.

**ג. שמירה (`mappingMutation` סביב שורה 545):**
- אחרי הצלחה: במקום לסגור מיד את הדיאלוג, עדכן את `mappingSite` המקומי עם הערכים החדשים שנשמרו (`{...mappingSite, campaign_form_mapping: clean}` או url בהתאם), והשאר את הדיאלוג פתוח. כך המשתמש רואה מיד שהשיוך נשמר. הוסף כפתור "סגור" לצד "שמור".
- לחילופין, אם רוצים לסגור: השתמש ב-`await queryClient.refetchQueries({ queryKey: ["wordpress-sites-admin"] })` לפני `setMappingSite(null)` כדי להבטיח ש-`sites` עודכן.

**ד. הגנה נוספת:** ב-`openMapping` קרא ל-`queryClient.invalidateQueries(["wordpress-sites-admin"])` ואז השתמש בנתוני האתר הטריים (אפשר לעשות זאת ע"י לקיחת ה-site מתוך `sites.find(s => s.id === site.id)` בכל פתיחה).

## בלי שינוי
- אין שינוי בסכמת DB / RLS — בדקתי ש-`tenant_isolation` policy מאפשרת UPDATE.
- אין שינוי ב-edge function `fetch-elementor-submissions`.
- אין שינוי בלוגיקת הסנכרון של Google Ads.

## אימות
אחרי התיקון:
1. פתח דיאלוג, בחר קמפיין בטופס, שמור — אמור להישאר פתוח עם הערך מוצג.
2. סגור ופתח מחדש — הערך השמור עדיין מוצג.
3. עבור בין טאב טופס לעמוד — עריכות לא שמורות נשמרות לכל טאב בנפרד.
4. שמירה ב-slug לא דורסת `campaign_form_mapping` ולהפך (כבר כך מאחר ש-payload כולל רק שדה אחד).
