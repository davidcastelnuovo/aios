import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background p-4 md:p-8" dir="rtl">
      <div className="container max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">מדיניות פרטיות</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-slate dark:prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-2xl font-semibold mb-3">1. איסוף מידע</h2>
              <p>
                אנו אוספים מידע שאתה מספק לנו במהלך השימוש במערכת, כולל:
              </p>
              <ul className="list-disc pr-6 space-y-2">
                <li>פרטים אישיים (שם, אימייל, טלפון)</li>
                <li>מידע על הארגון שלך</li>
                <li>נתוני שימוש במערכת</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">2. שימוש במידע</h2>
              <p>
                אנו משתמשים במידע שנאסף כדי:
              </p>
              <ul className="list-disc pr-6 space-y-2">
                <li>לספק ולשפר את השירות</li>
                <li>לתקשר איתך בנוגע לחשבונך</li>
                <li>לנתח ולשפר את חווית המשתמש</li>
                <li>לשלוח עדכונים ומידע רלוונטי</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">3. אבטחת מידע</h2>
              <p>
                אנו נוקטים באמצעי אבטחה מתקדמים כדי להגן על המידע שלך, כולל:
              </p>
              <ul className="list-disc pr-6 space-y-2">
                <li>הצפנת נתונים</li>
                <li>גישה מוגבלת למידע רגיש</li>
                <li>ניטור מתמיד של המערכת</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">4. שיתוף מידע</h2>
              <p>
                אנו לא משתפים את המידע האישי שלך עם צדדים שלישיים, למעט במקרים הבאים:
              </p>
              <ul className="list-disc pr-6 space-y-2">
                <li>כאשר נדרש על פי חוק</li>
                <li>עם ספקי שירות המסייעים לנו בהפעלת המערכת</li>
                <li>בהסכמתך המפורשת</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">5. זכויותיך</h2>
              <p>
                יש לך זכות:
              </p>
              <ul className="list-disc pr-6 space-y-2">
                <li>לגשת למידע האישי שלך</li>
                <li>לתקן מידע לא מדויק</li>
                <li>למחוק את חשבונך</li>
                <li>להתנגד לשימוש במידע שלך</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">6. שינויים במדיניות</h2>
              <p>
                אנו שומרים לעצמנו את הזכות לעדכן מדיניות זו מעת לעת. שינויים מהותיים יפורסמו באתר.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">7. יצירת קשר</h2>
              <p>
                לשאלות או בקשות בנוגע למדיניות פרטיות זו, אנא צור קשר עימנו דרך מערכת התמיכה.
              </p>
            </section>

            <div className="text-sm text-muted-foreground mt-8">
              עדכון אחרון: {new Date().toLocaleDateString('he-IL')}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
