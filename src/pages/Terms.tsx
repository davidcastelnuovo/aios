import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Terms() {
  return (
    <div className="min-h-screen bg-background p-4 md:p-8" dir="rtl">
      <div className="container max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">תנאי שימוש</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-slate dark:prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-2xl font-semibold mb-3">1. קבלת התנאים</h2>
              <p>
                על ידי גישה ושימוש במערכת After Lead, אתה מסכים לתנאי שימוש אלה. אם אינך מסכים לתנאים אלה, אנא הימנע משימוש במערכת.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">2. רישיון שימוש</h2>
              <p>
                אנו מעניקים לך רישיון מוגבל, לא בלעדי ולא ניתן להעברה לשימוש במערכת למטרות עסקיות חוקיות.
              </p>
              <ul className="list-disc pr-6 space-y-2">
                <li>אסור להעתיק, לשנות או להפיץ את המערכת</li>
                <li>אסור להשתמש במערכת למטרות בלתי חוקיות</li>
                <li>אסור לנסות לחדור למערכת או לפגוע בה</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">3. חשבון משתמש</h2>
              <p>
                אתה אחראי על:
              </p>
              <ul className="list-disc pr-6 space-y-2">
                <li>שמירה על סודיות פרטי ההתחברות שלך</li>
                <li>כל הפעילות שמתבצעת בחשבונך</li>
                <li>עדכון מידע מדויק ועדכני</li>
                <li>הודעה מיידית על כל שימוש בלתי מורשה בחשבונך</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">4. תשלומים והחזרים</h2>
              <p>
                התשלום עבור השירות מבוצע על בסיס מנוי חודשי או שנתי.
              </p>
              <ul className="list-disc pr-6 space-y-2">
                <li>התשלום יגבה באופן אוטומטי בתחילת כל תקופת חיוב</li>
                <li>ביטול המנוי יתבצע עד לתום תקופת החיוב הנוכחית</li>
                <li>לא יינתן החזר כספי עבור תקופות שכבר שולמו</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">5. קניין רוחני</h2>
              <p>
                כל התכנים, הסימנים המסחריים והקניין הרוחני במערכת שייכים לנו או למעניקי הרישיון שלנו.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">6. הגבלת אחריות</h2>
              <p>
                המערכת מסופקת "כמות שהיא" ללא אחריות מכל סוג. אנו לא נהיה אחראים לכל נזק ישיר או עקיף הנובע משימוש במערכת.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">7. שינויים בשירות</h2>
              <p>
                אנו שומרים לעצמנו את הזכות:
              </p>
              <ul className="list-disc pr-6 space-y-2">
                <li>לשנות או להפסיק את השירות בכל עת</li>
                <li>לעדכן את תנאי השימוש</li>
                <li>להגביל גישה למשתמשים המפרים את התנאים</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">8. סיום חשבון</h2>
              <p>
                אנו רשאים להשעות או לסיים את חשבונך במקרה של הפרת תנאי שימוש אלה, ללא התראה מוקדמת.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">9. דין וסמכות שיפוט</h2>
              <p>
                תנאי שימוש אלה כפופים לחוקי מדינת ישראל. כל מחלוקת תידון בבתי המשפט המוסמכים בישראל.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-3">10. יצירת קשר</h2>
              <p>
                לשאלות בנוגע לתנאי השימוש, אנא צור קשר עימנו דרך מערכת התמיכה.
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
