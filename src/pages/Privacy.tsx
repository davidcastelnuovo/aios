import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background p-4 md:p-8" dir="rtl">
      <div className="container max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">מדיניות פרטיות</CardTitle>
            <p className="text-muted-foreground mt-2">
              AfterLead ("אנחנו", "שלנו" או "החברה") מחויבת להגנה על פרטיותך. מדיניות פרטיות זו מסבירה כיצד אנו אוספים, משתמשים, שומרים ומגנים על המידע שלך בעת השימוש בפלטפורמת AfterLead.
            </p>
          </CardHeader>
          <CardContent className="prose prose-slate dark:prose-invert max-w-none space-y-8">
            
            <section>
              <h2 className="text-2xl font-semibold mb-3">1. מידע שאנו אוספים</h2>
              
              <h3 className="text-lg font-medium mt-4 mb-2">1.1 מידע שאתה מספק לנו</h3>
              <ul className="list-disc pr-6 space-y-2">
                <li><strong>פרטי חשבון:</strong> שם מלא, כתובת אימייל, מספר טלפון, סיסמה</li>
                <li><strong>פרטי ארגון:</strong> שם הסוכנות/חברה, תחום עיסוק, מספר עובדים</li>
                <li><strong>מידע עסקי:</strong> פרטי לקוחות, לידים, משימות, הערות ותיעוד</li>
                <li><strong>פרטי תשלום:</strong> במידה ורלוונטי, פרטי כרטיס אשראי מעובדים באמצעות ספק תשלומים מאובטח</li>
              </ul>

              <h3 className="text-lg font-medium mt-4 mb-2">1.2 מידע שנאסף אוטומטית</h3>
              <ul className="list-disc pr-6 space-y-2">
                <li><strong>מידע טכני:</strong> כתובת IP, סוג דפדפן, מערכת הפעלה, מזהה מכשיר</li>
                <li><strong>נתוני שימוש:</strong> דפים שנצפו, זמן שהייה במערכת, פעולות שבוצעו</li>
                <li><strong>Cookies:</strong> לשיפור חווית המשתמש ואבטחה</li>
              </ul>

              <h3 className="text-lg font-medium mt-4 mb-2">1.3 מידע מאינטגרציות צד שלישי</h3>
              <p className="mb-2">כאשר אתה מחבר שירותים חיצוניים, אנו עשויים לקבל מידע מ:</p>
              <ul className="list-disc pr-6 space-y-2">
                <li><strong>Google Calendar:</strong> גישה ליומן שלך ליצירת ועדכון אירועים ופגישות, כתובת האימייל המקושרת לחשבון Google שלך</li>
                <li><strong>Facebook Lead Ads:</strong> לידים מקמפיינים פרסומיים, מידע על טפסים וקמפיינים, שם מלא, אימייל וטלפון של לידים</li>
                <li><strong>WhatsApp (Green API):</strong> הודעות נכנסות ויוצאות, מספרי טלפון של אנשי קשר, תוכן הודעות לצורך תיעוד ותקשורת</li>
                <li><strong>ManyChat:</strong> מזהי מנויים, היסטוריית הודעות, מידע על אוטומציות</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">2. כיצד אנו משתמשים במידע</h2>
              <ul className="list-disc pr-6 space-y-2">
                <li><strong>אספקת השירות:</strong> ניהול לקוחות, לידים, משימות ותהליכים עסקיים</li>
                <li><strong>שיפור המוצר:</strong> ניתוח דפוסי שימוש לשיפור הפונקציונליות</li>
                <li><strong>תקשורת:</strong> שליחת עדכונים, התראות ותמיכה טכנית</li>
                <li><strong>אבטחה:</strong> זיהוי ומניעת גישה בלתי מורשית או שימוש לרעה</li>
                <li><strong>אינטגרציות:</strong> סנכרון נתונים עם שירותים חיצוניים שחיברת</li>
                <li><strong>אוטומציות:</strong> הפעלת תהליכים אוטומטיים שהגדרת (כגון שליחת הודעות, יצירת משימות)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">3. שיתוף מידע עם צדדים שלישיים</h2>
              <p className="mb-3">אנו לא מוכרים את המידע האישי שלך. אנו עשויים לשתף מידע עם:</p>
              <ul className="list-disc pr-6 space-y-2">
                <li><strong>ספקי שירות:</strong> חברות המסייעות לנו בהפעלת המערכת (אחסון ענן, עיבוד תשלומים)</li>
                <li><strong>אינטגרציות שאישרת:</strong> שירותים שבחרת לחבר (Google, Facebook, WhatsApp, ManyChat)</li>
                <li><strong>דרישות חוקיות:</strong> כאשר נדרש על פי חוק, צו בית משפט או בקשה ממשלתית</li>
                <li><strong>הגנה על זכויות:</strong> למניעת הונאה או פעילות בלתי חוקית</li>
              </ul>
              
              <h3 className="text-lg font-medium mt-4 mb-2">ספקי שירות עיקריים</h3>
              <ul className="list-disc pr-6 space-y-1">
                <li>Supabase - אחסון מידע ואימות משתמשים</li>
                <li>Google Cloud - שירותי יומן</li>
                <li>Meta (Facebook) - קבלת לידים מפרסום</li>
                <li>Green API - אינטגרציית WhatsApp</li>
                <li>ManyChat - אוטומציות הודעות</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">4. מדיניות Google API Services</h2>
              <div className="bg-muted/50 p-4 rounded-lg border">
                <p className="mb-3">
                  השימוש שלנו במידע שהתקבל מ-Google APIs עומד בדרישות 
                  <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline mx-1">
                    Google API Services User Data Policy
                  </a>
                  , כולל דרישות Limited Use.
                </p>
                <p className="mb-2"><strong>אנו מתחייבים ש:</strong></p>
                <ul className="list-disc pr-6 space-y-1">
                  <li>ניגשים רק למידע הנדרש לפונקציונליות שביקשת (יצירת אירועים ביומן, שליפת פרטי יומן)</li>
                  <li>לא נעביר מידע מ-Google לצדדים שלישיים, למעט לצורך אספקת השירות</li>
                  <li>לא נשתמש במידע מ-Google למטרות פרסום או שיווק</li>
                  <li>המידע מ-Google נשמר באופן מאובטח ומוצפן</li>
                  <li>תוכל לבטל את הגישה שלנו לחשבון Google שלך בכל עת</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">5. אבטחת מידע</h2>
              <p className="mb-3">אנו נוקטים באמצעי אבטחה מתקדמים כדי להגן על המידע שלך:</p>
              <ul className="list-disc pr-6 space-y-2">
                <li><strong>הצפנה:</strong> כל הנתונים מוצפנים בהעברה (TLS/SSL) ובאחסון</li>
                <li><strong>Row Level Security (RLS):</strong> הפרדה מלאה בין נתוני לקוחות שונים</li>
                <li><strong>אימות דו-שלבי:</strong> אפשרות להוספת שכבת אבטחה נוספת</li>
                <li><strong>גישה מוגבלת:</strong> רק צוות מורשה יכול לגשת לתשתיות</li>
                <li><strong>גיבויים:</strong> גיבויים אוטומטיים ומאובטחים</li>
                <li><strong>ניטור:</strong> מעקב מתמיד אחר פעילות חשודה</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">6. Cookies וטכנולוגיות מעקב</h2>
              <p className="mb-3">אנו משתמשים ב-Cookies לצורך:</p>
              <ul className="list-disc pr-6 space-y-2">
                <li><strong>Cookies הכרחיים:</strong> לתפקוד בסיסי של המערכת (אימות, session)</li>
                <li><strong>Cookies פונקציונליים:</strong> לשמירת העדפות המשתמש</li>
                <li><strong>Cookies אנליטיים:</strong> לניתוח שימוש ושיפור המוצר</li>
              </ul>
              <p className="mt-3">תוכל לנהל את הגדרות ה-Cookies דרך הדפדפן שלך.</p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">7. שמירת מידע</h2>
              <ul className="list-disc pr-6 space-y-2">
                <li><strong>נתוני חשבון:</strong> נשמרים כל עוד החשבון פעיל ועד 90 יום לאחר מחיקה</li>
                <li><strong>נתונים עסקיים:</strong> נשמרים לפי הגדרות הארגון שלך</li>
                <li><strong>לוגים טכניים:</strong> נשמרים עד 12 חודשים לצורכי אבטחה</li>
                <li><strong>נתוני גיבוי:</strong> נשמרים עד 30 יום לאחר מחיקה מהמערכת</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">8. זכויותיך</h2>
              <p className="mb-3">בהתאם לחוקי הגנת הפרטיות, יש לך זכות:</p>
              <ul className="list-disc pr-6 space-y-2">
                <li><strong>גישה:</strong> לבקש עותק של המידע האישי שלך</li>
                <li><strong>תיקון:</strong> לתקן מידע לא מדויק או חסר</li>
                <li><strong>מחיקה:</strong> לבקש מחיקת המידע שלך ("הזכות להישכח")</li>
                <li><strong>העברה:</strong> לקבל את המידע שלך בפורמט מובנה</li>
                <li><strong>התנגדות:</strong> להתנגד לעיבוד מסוים של המידע</li>
                <li><strong>הגבלה:</strong> לבקש הגבלת העיבוד בנסיבות מסוימות</li>
                <li><strong>ביטול הסכמה:</strong> לבטל הסכמות שנתת בכל עת</li>
              </ul>
              <p className="mt-3">לממש את זכויותיך, פנה אלינו בכתובת: <strong>privacy@afterlead.com</strong></p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">9. פרטיות ילדים</h2>
              <p>
                המערכת מיועדת לשימוש עסקי בלבד ואינה מיועדת לילדים מתחת לגיל 18. אנו לא אוספים ביודעין מידע מילדים.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">10. שינויים במדיניות</h2>
              <p>
                אנו עשויים לעדכן מדיניות זו מעת לעת. שינויים מהותיים יפורסמו באתר ותקבל התראה באימייל. המשך השימוש במערכת לאחר השינויים מהווה הסכמה למדיניות המעודכנת.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">11. יצירת קשר</h2>
              <p className="mb-3">לשאלות, בקשות או תלונות בנוגע לפרטיות:</p>
              <div className="bg-muted/50 p-4 rounded-lg">
                <p><strong>AfterLead</strong></p>
                <p>אימייל: <a href="mailto:privacy@afterlead.com" className="text-primary hover:underline">privacy@afterlead.com</a></p>
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
              <Link to="/terms" className="text-primary hover:underline">
                תנאי שימוש
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
