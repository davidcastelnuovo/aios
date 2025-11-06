import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { 
  BarChart3, 
  Users, 
  Zap, 
  Shield, 
  TrendingUp, 
  Clock,
  CheckCircle2,
  ArrowLeft,
  Sparkles,
  Target,
  Activity,
  CheckSquare,
  UserPlus,
  Star,
  Building2,
  Layers
} from "lucide-react";
import dashboardScreenshot from "@/assets/dashboard-screenshot.png";
import analyticsDashboard from "@/assets/analytics-dashboard.png";
import leadsScreenshot from "@/assets/leads-screenshot.png";
import clientsScreenshot from "@/assets/clients-screenshot.png";
import tasksScreenshot from "@/assets/tasks-screenshot.png";

const Landing = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: Users,
      title: "ניהול לקוחות מרובים",
      description: "פתח חשבונות ללקוחות שלך ונהל אותם כולם ממקום אחד"
    },
    {
      icon: CheckSquare,
      title: "ניהול משימות",
      description: "מערכת משימות מתקדמת לניהול פרויקטים ועבודות עבור כל הלקוחות"
    },
    {
      icon: UserPlus,
      title: "קליטת לקוחות חכמה",
      description: "תהליך אונבורדינג מסודר שעוזר ללקוחות החדשים שלך להתחיל מהר"
    },
    {
      icon: Building2,
      title: "ניהול סוכנויות מרובות",
      description: "נהל עשרות סוכנויות ומאות לקוחות במערכת אחת"
    },
    {
      icon: Layers,
      title: "ניהול קמפיינרים וצוותים",
      description: "צור צוותי מכירות וקמפיינרים עם הרשאות וגישות מותאמות"
    },
    {
      icon: Target,
      title: "ניהול לידים מתקדם",
      description: "עקוב אחרי כל ליד מרגע הכניסה עד סגירת העסקה"
    },
    {
      icon: TrendingUp,
      title: "הכנסות נוספות",
      description: "הרווח יותר על ידי מכירת שירותי CRM ללקוחות שלך"
    },
    {
      icon: BarChart3,
      title: "תובנות בזמן אמת",
      description: "דשבורדים מתקדמים עם גרפים ודוחות מפורטים"
    },
    {
      icon: Shield,
      title: "הפרדה מלאה",
      description: "כל לקוח נהנה מסביבה מבודדת ומאובטחת לחלוטין"
    }
  ];

  const testimonials = [
    {
      name: "יעל כהן",
      role: "מנהלת סוכנות דיגיטל",
      company: "Digital Growth",
      text: "AfterLead שינתה את הדרך שבה אנחנו נותנים שירות ללקוחות שלנו. עכשיו אנחנו יכולים לנהל 50+ לקוחות בקלות ולתת להם CRM מקצועי.",
      rating: 5
    },
    {
      name: "דוד לוי",
      role: "מייסד",
      company: "LeadMasters",
      text: "המערכת הזאת לא רק עזרה לנו לנהל את הלקוחות שלנו טוב יותר, היא גם הפכה להיות מקור הכנסה נוסף משמעותי לסוכנות.",
      rating: 5
    },
    {
      name: "שרה אברהם",
      role: "מנהלת מכירות",
      company: "SalesBoost",
      text: "הפיצ'רים של ניהול צוותים וקמפיינרים מושלמים. הצוות שלי עובד בצורה הרבה יותר מסונכרנת והלקוחות שלנו מאוד מרוצים.",
      rating: 5
    }
  ];

  const benefits = [
    "הצע שירות CRM מתקדם ללקוחות שלך והרווח יותר",
    "נהל עשרות לקוחות ממקום אחד בקלות",
    "פתח חשבונות חדשים ללקוחות תוך דקות",
    "עזור ללקוחות שלך להגדיל את המכירות שלהם",
    "הפרדה מלאה בין הלקוחות - כל אחד בסביבה מבודדת",
    "תמיכה ושירות מקצועי בעברית"
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-primary" />
            <span className="text-xl font-bold">AfterLead</span>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => navigate("/auth")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            התחבר למערכת
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 md:py-32">
        <div className="absolute inset-0 gradient-primary opacity-5" />
        <div className="container mx-auto px-4 relative">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
              <Sparkles className="h-4 w-4" />
              הפתרון המושלם לסוכנויות דיגיטל
            </div>
            <h1 className="text-4xl md:text-6xl font-bold">
              צמח יותר, הרווח יותר
              <span className="block gradient-primary bg-clip-text text-transparent mt-2">
                תן ללקוחות שלך להצליח
              </span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              AfterLead היא מערכת ניהול מכירות שמאפשרת לך כסוכנות דיגיטל לנהל את הלקוחות שלך,
              לפתוח להם חשבונות ולעזור להם לצמוח - ובדרך גם להרוויח יותר
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button 
                size="lg" 
                className="text-lg px-8"
                onClick={() => navigate("/signup")}
              >
                התחל בחינם
                <ArrowLeft className="mr-2 h-5 w-5" />
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                className="text-lg px-8"
                onClick={() => navigate("/auth")}
              >
                התחבר למערכת
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              כל מה שהסוכנות שלך צריכה
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              נהל את כל הלקוחות שלך ממקום אחד ותן להם שירות ברמה הבאה
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {features.map((feature, index) => (
              <Card key={index} className="border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-lg">
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg gradient-primary flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                  <CardDescription className="text-base">
                    {feature.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                למה לבחור ב-AfterLead?
              </h2>
              <p className="text-xl text-muted-foreground">
                תוצאות מוכחות שעובדות עבור סוכנויות דיגיטל
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex items-start gap-3 p-4 rounded-lg hover:bg-muted/50 transition-colors">
                  <CheckCircle2 className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                  <span className="text-lg">{benefit}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Screenshot/Demo Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                צפה במערכת בפעולה
              </h2>
              <p className="text-xl text-muted-foreground">
                ממשק נקי ואינטואיטיבי שקל לעבוד איתו
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <Card className="overflow-hidden border-2 hover:shadow-2xl hover:-translate-y-2 transition-all duration-300">
                <img 
                  src={analyticsDashboard} 
                  alt="דשבורד אנליטיקה עם KPIs" 
                  className="w-full h-auto object-cover"
                />
                <CardContent className="p-6">
                  <h3 className="text-xl font-semibold mb-2">דשבורד אנליטיקה</h3>
                  <p className="text-muted-foreground">מעקב אחר לידים, הצעות מחיר, סגירות וגרפי צמיחה</p>
                </CardContent>
              </Card>

              <Card className="overflow-hidden border-2 hover:shadow-2xl hover:-translate-y-2 transition-all duration-300">
                <img 
                  src={leadsScreenshot} 
                  alt="ניהול לידים חכם" 
                  className="w-full h-auto object-cover"
                />
                <CardContent className="p-6">
                  <h3 className="text-xl font-semibold mb-2">מעקב אחר לידים</h3>
                  <p className="text-muted-foreground">טבלה מתקדמת עם כל המידע הדרוש למעקב אחר לידים</p>
                </CardContent>
              </Card>

              <Card className="overflow-hidden border-2 hover:shadow-2xl hover:-translate-y-2 transition-all duration-300">
                <img 
                  src={clientsScreenshot} 
                  alt="ניהול לקוחות" 
                  className="w-full h-auto object-cover"
                />
                <CardContent className="p-6">
                  <h3 className="text-xl font-semibold mb-2">ניהול לקוחות</h3>
                  <p className="text-muted-foreground">כרטיסי לקוחות עם כל המידע החשוב במקום אחד</p>
                </CardContent>
              </Card>

              <Card className="overflow-hidden border-2 hover:shadow-2xl hover:-translate-y-2 transition-all duration-300">
                <img 
                  src={tasksScreenshot} 
                  alt="ניהול משימות" 
                  className="w-full h-auto object-cover"
                />
                <CardContent className="p-6">
                  <h3 className="text-xl font-semibold mb-2">ניהול משימות</h3>
                  <p className="text-muted-foreground">לוח קאנבאן לניהול משימות ופרויקטים</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              מה אומרים הלקוחות שלנו
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              סוכנויות דיגיטל שכבר משתמשות ב-AfterLead ורואות תוצאות
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="border-2 hover:shadow-lg transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-5 w-5 fill-primary text-primary" />
                    ))}
                  </div>
                  <p className="text-muted-foreground mb-6 italic">
                    "{testimonial.text}"
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center text-white font-bold">
                      {testimonial.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-semibold">{testimonial.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {testimonial.role}, {testimonial.company}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              המספרים מדברים בעד עצמם
            </h2>
          </div>
          <div className="grid md:grid-cols-4 gap-8 max-w-5xl mx-auto">
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-bold gradient-primary bg-clip-text text-transparent mb-2">
                +35%
              </div>
              <p className="text-muted-foreground">הכנסות נוספות לסוכנות</p>
            </div>
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-bold gradient-primary bg-clip-text text-transparent mb-2">
                5 דק'
              </div>
              <p className="text-muted-foreground">לפתוח חשבון לקוח חדש</p>
            </div>
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-bold gradient-primary bg-clip-text text-transparent mb-2">
                100%
              </div>
              <p className="text-muted-foreground">הפרדה בין לקוחות</p>
            </div>
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-bold gradient-primary bg-clip-text text-transparent mb-2">
                24/7
              </div>
              <p className="text-muted-foreground">תמיכה בעברית</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              איך זה עובד?
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              4 שלבים פשוטים להתחיל לצמוח
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-8 max-w-6xl mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full gradient-primary text-white text-2xl font-bold flex items-center justify-center mx-auto mb-4">
                1
              </div>
              <h3 className="text-xl font-semibold mb-2">הרשמה</h3>
              <p className="text-muted-foreground">
                הירשם למערכת תוך 2 דקות והתחל להגדיר את הסוכנות שלך
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full gradient-primary text-white text-2xl font-bold flex items-center justify-center mx-auto mb-4">
                2
              </div>
              <h3 className="text-xl font-semibold mb-2">הוספת לקוחות</h3>
              <p className="text-muted-foreground">
                צור חשבונות ללקוחות שלך והגדר להם גישה לסביבה שלהם
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full gradient-primary text-white text-2xl font-bold flex items-center justify-center mx-auto mb-4">
                3
              </div>
              <h3 className="text-xl font-semibold mb-2">ניהול מכירות</h3>
              <p className="text-muted-foreground">
                עקוב אחרי לידים, משימות ועסקאות של כל הלקוחות שלך
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full gradient-primary text-white text-2xl font-bold flex items-center justify-center mx-auto mb-4">
                4
              </div>
              <h3 className="text-xl font-semibold mb-2">צמיחה</h3>
              <p className="text-muted-foreground">
                צפה בלקוחות שלך צומחים ובהכנסות שלך עולות
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <Card className="max-w-4xl mx-auto border-2 border-primary/20 shadow-lg gradient-primary">
            <CardContent className="p-8 md:p-12 text-center text-white">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                מוכן להצמיח את הסוכנות שלך?
              </h2>
              <p className="text-xl mb-8 text-white/90 max-w-2xl mx-auto">
                הצטרף לסוכנויות דיגיטל שכבר משתמשות ב-AfterLead כדי לתת ללקוחות שלהן שירות ברמה הבאה
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  size="lg" 
                  variant="secondary"
                  className="text-lg px-8"
                  onClick={() => navigate("/signup")}
                >
                  התחל בחינם עכשיו
                  <ArrowLeft className="mr-2 h-5 w-5" />
                </Button>
                <Button 
                  size="lg" 
                  variant="outline"
                  className="text-lg px-8 bg-white/10 border-white/20 text-white hover:bg-white/20"
                  onClick={() => navigate("/auth")}
                >
                  יש לך כבר חשבון? התחבר
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 bg-card/50">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2025 AfterLead. כל הזכויות שמורות.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
