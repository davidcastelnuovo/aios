import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

export default function Terms() {
  return (
    <div className="min-h-screen bg-background p-4 md:p-8" dir="rtl">
      <div className="container max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">תנאי שימוש</CardTitle>
            <p className="text-muted-foreground mt-2">
              ברוכים הבאים ל-AfterLead. תנאי שימוש אלה ("התנאים") מסדירים את השימוש שלך בפלטפורמת AfterLead ובשירותים הנלווים.
            </p>
          </CardHeader>
          <CardContent className="prose prose-slate dark:prose-invert max-w-none space-y-8">
            
            <section>
              <h2 className="text-2xl font-semibold mb-3">1. הגדרות</h2>
              <ul className="list-disc pr-6 space-y-2">
                <li><strong>"השירות"</strong> - פלטפורמת AfterLead לניהול לקוחות, לידים ותהליכי מכירה</li>
                <li><strong>"המשתמש" / "אתה"</strong> - כל אדם או ארגון המשתמש בשירות</li>
                <li><strong>"החשבון"</strong> - חשבון המשתמש שנוצר במערכת</li>
                <li><strong>"התוכן"</strong> - כל מידע, נתונים או חומרים שהועלו למערכת</li>
                <li><strong>"ארגון" / "Tenant"</strong> - יחידה עסקית נפרדת בתוך המערכת</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">2. קבלת התנאים</h2>
              <p>
                על ידי גישה ושימוש בשירות, אתה מסכים להיות כפוף לתנאים אלה. אם אינך מסכים לתנאים, אנא הימנע משימוש בשירות. אם אתה משתמש בשירות בשם ארגון, אתה מצהיר שיש לך סמכות לחייב את הארגון בתנאים אלה.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">3. תיאור השירות</h2>
              <p className="mb-3">AfterLead היא פלטפורמה לניהול מערכות יחסים עם לקוחות (CRM) המציעה:</p>
              <ul className="list-disc pr-6 space-y-2">
                <li>ניהול לקוחות, לידים ומשימות</li>
                <li>ניהול סוכנויות ולקוחות מרובים</li>
                <li>מעקב אחר תהליכי מכירה</li>
                <li>ניהול צוותים והרשאות</li>
                <li>אינטגרציות עם שירותי צד שלישי</li>
                <li>אוטומציות ותהליכי עבודה</li>
                <li>דוחות ואנליטיקה</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">4. אינטגרציות צד שלישי</h2>
              <p className="mb-3">
                השירות מאפשר חיבור לשירותי צד שלישי. השימוש בשירותים אלה כפוף לתנאים שלהם:
              </p>
              <ul className="list-disc pr-6 space-y-2">
                <li><strong>Google Calendar:</strong> לסנכרון אירועים ופגישות. כפוף ל-<a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">תנאי השימוש של Google</a></li>
                <li><strong>Facebook / Meta:</strong> לקבלת לידים מקמפיינים. כפוף ל-<a href="https://www.facebook.com/legal/terms" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">תנאי השירות של Meta</a></li>
                <li><strong>WhatsApp (Green API):</strong> לשליחה וקבלה של הודעות. כפוף לתנאי WhatsApp ו-Green API</li>
                <li><strong>ManyChat:</strong> לאוטומציות הודעות. כפוף לתנאי ManyChat</li>
              </ul>
              <p className="mt-3">
                אתה אחראי לעמידה בתנאי השימוש של כל שירות צד שלישי שאתה מחבר. אנו לא אחראים לשירותים אלה או לתוצאות השימוש בהם.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">5. חשבון משתמש</h2>
              <h3 className="text-lg font-medium mt-4 mb-2">5.1 יצירת חשבון</h3>
              <p>עליך לספק מידע מדויק ועדכני בעת ההרשמה. אתה אחראי לשמור על עדכניות המידע.</p>
              
              <h3 className="text-lg font-medium mt-4 mb-2">5.2 אבטחת חשבון</h3>
              <ul className="list-disc pr-6 space-y-2">
                <li>שמור על סודיות פרטי ההתחברות שלך</li>
                <li>הודע לנו מיד על כל שימוש בלתי מורשה</li>
                <li>אל תשתף את פרטי החשבון שלך</li>
                <li>אתה אחראי לכל הפעילות בחשבונך</li>
              </ul>

              <h3 className="text-lg font-medium mt-4 mb-2">5.3 משתמשים מרובים</h3>
              <p>אם אתה מנהל ארגון, אתה אחראי לפעולות של כל המשתמשים שהזמנת לארגון.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">6. שימוש מותר ואסור</h2>
              <h3 className="text-lg font-medium mt-4 mb-2">6.1 שימוש מותר</h3>
              <ul className="list-disc pr-6 space-y-2">
                <li>ניהול לקוחות ולידים לגיטימיים</li>
                <li>תקשורת עסקית עם הסכמת הנמענים</li>
                <li>שימוש באינטגרציות בהתאם לתנאיהן</li>
              </ul>

              <h3 className="text-lg font-medium mt-4 mb-2">6.2 שימוש אסור</h3>
              <ul className="list-disc pr-6 space-y-2">
                <li>שימוש בלתי חוקי או מזיק</li>
                <li>שליחת ספאם או הודעות ללא הסכמה</li>
                <li>ניסיון לפרוץ או לפגוע במערכת</li>
                <li>העתקה, שינוי או הפצה של המערכת</li>
                <li>שימוש לתחרות ישירה עם AfterLead</li>
                <li>הפרת זכויות קניין רוחני</li>
                <li>התחזות או הונאה</li>
                <li>העלאת תוכן פוגעני, מאיים או בלתי חוקי</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">7. תשלומים וחיוב</h2>
              <h3 className="text-lg font-medium mt-4 mb-2">7.1 מנוי ותשלום</h3>
              <ul className="list-disc pr-6 space-y-2">
                <li>התשלום מבוצע על בסיס מנוי חודשי או שנתי</li>
                <li>החיוב יתבצע אוטומטית בתחילת כל תקופה</li>
                <li>המחירים כוללים מע"מ אלא אם צוין אחרת</li>
              </ul>

              <h3 className="text-lg font-medium mt-4 mb-2">7.2 ביטול וחזרה</h3>
              <ul className="list-disc pr-6 space-y-2">
                <li>ניתן לבטל את המנוי בכל עת</li>
                <li>הביטול ייכנס לתוקף בסוף תקופת החיוב הנוכחית</li>
                <li>לא יינתן החזר עבור תקופות שכבר שולמו</li>
                <li>לאחר ביטול, הגישה לנתונים תישמר ל-30 יום</li>
              </ul>

              <h3 className="text-lg font-medium mt-4 mb-2">7.3 שינוי מחירים</h3>
              <p>אנו שומרים את הזכות לשנות מחירים עם התראה של 30 יום מראש.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">8. קניין רוחני</h2>
              <h3 className="text-lg font-medium mt-4 mb-2">8.1 הקניין שלנו</h3>
              <p>
                כל זכויות הקניין הרוחני בשירות, כולל קוד, עיצוב, לוגו וסימנים מסחריים, שייכים ל-AfterLead או למעניקי הרישיון שלנו.
              </p>

              <h3 className="text-lg font-medium mt-4 mb-2">8.2 התוכן שלך</h3>
              <p>
                אתה שומר על הבעלות על כל התוכן שאתה מעלה למערכת. אתה מעניק לנו רישיון מוגבל לאחסן, לעבד ולהציג את התוכן לצורך אספקת השירות.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">9. הגבלת אחריות</h2>
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="mb-3">
                  <strong>השירות מסופק "AS IS" (כמות שהוא) ללא אחריות מכל סוג, מפורשת או משתמעת.</strong>
                </p>
                <p className="mb-3">אנו לא מתחייבים ש:</p>
                <ul className="list-disc pr-6 space-y-1">
                  <li>השירות יהיה זמין ללא הפרעות</li>
                  <li>השירות יהיה נקי מתקלות או באגים</li>
                  <li>התוצאות יעמדו בציפיותיך</li>
                </ul>
                <p className="mt-3">
                  בשום מקרה לא נהיה אחראים לנזקים עקיפים, מיוחדים, תוצאתיים או עונשיים, כולל אובדן רווחים, נתונים או מוניטין.
                </p>
                <p className="mt-3">
                  <strong>אחריותנו המקסימלית מוגבלת לסכום ששילמת לנו ב-12 החודשים האחרונים.</strong>
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">10. שיפוי</h2>
              <p>
                אתה מסכים לשפות ולפטור את AfterLead, עובדיה, מנהליה ושותפיה מכל תביעה, נזק, הפסד או הוצאה הנובעים מ:
              </p>
              <ul className="list-disc pr-6 space-y-2">
                <li>הפרה של תנאים אלה על ידך</li>
                <li>הפרת זכויות צד שלישי על ידך</li>
                <li>שימוש בלתי חוקי בשירות על ידך</li>
                <li>התוכן שהעלית למערכת</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">11. סיום השירות</h2>
              <h3 className="text-lg font-medium mt-4 mb-2">11.1 סיום על ידך</h3>
              <p>תוכל לסיים את השימוש בשירות בכל עת על ידי ביטול המנוי שלך.</p>

              <h3 className="text-lg font-medium mt-4 mb-2">11.2 סיום על ידינו</h3>
              <p>אנו רשאים להשעות או לסיים את חשבונך אם:</p>
              <ul className="list-disc pr-6 space-y-2">
                <li>הפרת את תנאי השימוש</li>
                <li>לא שילמת עבור השירות</li>
                <li>השתמשת בשירות באופן בלתי חוקי</li>
                <li>פגעת במשתמשים אחרים או במערכת</li>
              </ul>

              <h3 className="text-lg font-medium mt-4 mb-2">11.3 לאחר סיום</h3>
              <p>
                לאחר סיום השירות, הנתונים שלך יישמרו ל-30 יום ולאחר מכן יימחקו לצמיתות. ניתן לייצא את הנתונים לפני הסיום.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">12. שינויים בשירות ובתנאים</h2>
              <h3 className="text-lg font-medium mt-4 mb-2">12.1 שינויים בשירות</h3>
              <p>אנו רשאים לשנות, לעדכן או להפסיק תכונות בשירות עם או בלי התראה מוקדמת.</p>

              <h3 className="text-lg font-medium mt-4 mb-2">12.2 שינויים בתנאים</h3>
              <p>
                אנו עשויים לעדכן תנאים אלה מעת לעת. שינויים מהותיים יפורסמו באתר ותקבל התראה. המשך השימוש לאחר השינויים מהווה הסכמה לתנאים המעודכנים.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">13. דין וסמכות שיפוט</h2>
              <p>
                תנאי שימוש אלה כפופים לחוקי מדינת ישראל. כל מחלוקת הנובעת מתנאים אלה או מהשימוש בשירות תידון בבתי המשפט המוסמכים במחוז תל אביב-יפו, ישראל.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">14. הוראות כלליות</h2>
              <ul className="list-disc pr-6 space-y-2">
                <li><strong>הסכם מלא:</strong> תנאים אלה מהווים את ההסכם המלא בינינו</li>
                <li><strong>הפרדה:</strong> אם סעיף יימצא בלתי תקף, שאר התנאים יישארו בתוקף</li>
                <li><strong>ויתור:</strong> אי אכיפת סעיף לא תהווה ויתור על זכויותינו</li>
                <li><strong>העברה:</strong> אינך רשאי להעביר את זכויותיך ללא הסכמתנו</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">15. יצירת קשר</h2>
              <p className="mb-3">לשאלות בנוגע לתנאי השימוש:</p>
              <div className="bg-muted/50 p-4 rounded-lg">
                <p><strong>AfterLead</strong></p>
                <p>אימייל: <a href="mailto:support@afterlead.com" className="text-primary hover:underline">support@afterlead.com</a></p>
                <p>אתר: <a href="https://afterlead.com" className="text-primary hover:underline">afterlead.com</a></p>
              </div>
            </section>

            <div className="text-sm text-muted-foreground mt-8 pt-4 border-t">
              עדכון אחרון: {new Date().toLocaleDateString('he-IL')}
            </div>

            {/* Footer Links */}
            <div className="flex items-center justify-between pt-6 border-t">
              <Link to="/landing" className="text-primary hover:underline flex items-center gap-1">
                <ArrowRight className="h-4 w-4" />
                חזרה לדף הבית
              </Link>
              <Link to="/privacy" className="text-primary hover:underline">
                מדיניות פרטיות
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
