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
  Layers,
  Palette,
  Rocket,
  ArrowRight
} from "lucide-react";
import logoM from "@/assets/logo.png";
import dashboardScreenshot from "@/assets/dashboard-screenshot.png";
import analyticsDashboard from "@/assets/analytics-dashboard.png";
import leadsScreenshot from "@/assets/leads-screenshot.png";
import clientsScreenshot from "@/assets/clients-screenshot.png";
import tasksScreenshot from "@/assets/tasks-screenshot.png";

const Landing = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: Sparkles,
      title: "ניהול לקוחות מרובים",
      description: "פתח חשבונות ללקוחות שלך ונהל אותם כולם ממקום אחד"
    },
    {
      icon: Zap,
      title: "ניהול משימות",
      description: "מערכת משימות מתקדמת לניהול פרויקטים ועבודות עבור כל הלקוחות"
    },
    {
      icon: Rocket,
      title: "קליטת לקוחות חכמה",
      description: "תהליך אונבורדינג מסודר שעוזר ללקוחות החדשים שלך להתחיל מהר"
    },
    {
      icon: Layers,
      title: "ניהול סוכנויות מרובות",
      description: "נהל עשרות סוכנויות ומאות לקוחות במערכת אחת"
    },
    {
      icon: Users,
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
            <img src={logoM} alt="AfterLead" className="w-10 h-10" />
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
      <section className="relative overflow-hidden py-24 md:py-40 bg-gradient-to-b from-background to-muted/20">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(168,85,247,0.1),transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_60%,rgba(59,130,246,0.1),transparent_50%)]" />
        </div>
        
        <div className="container mx-auto px-4 relative">
          <div className="max-w-5xl mx-auto text-center space-y-10">
            <div className="mb-8">
              <span className="text-4xl md:text-5xl font-bold font-heebo">AfterLead</span>
            </div>
            
            <div className="space-y-6">
              <h1 className="text-5xl md:text-7xl font-bold leading-tight font-heebo">
                <span className="block">יצירה, צמיחה והתרחבות</span>
              </h1>
              
              <p className="text-2xl md:text-3xl font-semibold gradient-primary bg-clip-text text-transparent">
                AfterLead עוזרת לעסקים לצמוח
              </p>
              
              <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                פלטפורמת CRM מתקדמת שמאפשרת לסוכנויות דיגיטל לנהל מאות לקוחות,
                <br className="hidden md:block" />
                לפתוח להם חשבונות ולהפוך את השירות שלהם למקור הכנסה נוסף
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
              <Button 
                size="lg" 
                className="text-lg px-10 py-6 shadow-lg hover:shadow-xl transition-all"
                onClick={() => navigate("/signup")}
              >
                התחל בחינם עכשיו
                <Rocket className="mr-2 h-5 w-5" />
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                className="text-lg px-10 py-6 border-2"
                onClick={() => navigate("/auth")}
              >
                התחבר למערכת
                <ArrowLeft className="mr-2 h-5 w-5" />
              </Button>
            </div>

            {/* Growth Chart */}
            <div className="flex items-end justify-center gap-3 h-32 pt-12">
              <div className="w-16 bg-primary/40 rounded-t-xl" style={{height: '40%'}} />
              <div className="w-16 bg-primary/60 rounded-t-xl" style={{height: '60%'}} />
              <div className="w-16 bg-primary/80 rounded-t-xl" style={{height: '80%'}} />
              <div className="w-16 bg-primary rounded-t-xl relative overflow-hidden" style={{height: '100%'}}>
                <div className="absolute inset-0 bg-gradient-to-t from-primary to-accent animate-pulse" />
              </div>
            </div>

            <div className="flex items-center justify-center gap-8 pt-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span>ללא כרטיס אשראי</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span>התקנה ב-5 דקות</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span>תמיכה בעברית</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Screenshot/Demo Section */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16 space-y-4">
              <h2 className="text-4xl md:text-5xl font-bold">
                צפה במערכת בפעולה
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                ממשק נקי, מודרני ואינטואיטיבי שנבנה במיוחד לסוכנויות דיגיטל
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <Card className="group overflow-hidden border-2 hover:border-primary/50 hover:shadow-2xl hover:-translate-y-2 transition-all duration-500">
                <div className="overflow-hidden">
                  <img 
                    src={analyticsDashboard} 
                    alt="דשבורד אנליטיקה עם KPIs" 
                    className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <CardContent className="p-6">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <BarChart3 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold mb-2">דשבורד אנליטיקה</h3>
                      <p className="text-muted-foreground">מעקב בזמן אמת אחר לידים, הצעות מחיר, סגירות וגרפי צמיחה</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="group overflow-hidden border-2 hover:border-primary/50 hover:shadow-2xl hover:-translate-y-2 transition-all duration-500">
                <div className="overflow-hidden">
                  <img 
                    src={leadsScreenshot} 
                    alt="ניהול לידים חכם" 
                    className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <CardContent className="p-6">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Target className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold mb-2">מעקב אחר לידים</h3>
                      <p className="text-muted-foreground">טבלה מתקדמת עם פילטרים וחיפוש למעקב יעיל אחר כל ליד</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="group overflow-hidden border-2 hover:border-primary/50 hover:shadow-2xl hover:-translate-y-2 transition-all duration-500">
                <div className="overflow-hidden">
                  <img 
                    src={clientsScreenshot} 
                    alt="ניהול לקוחות" 
                    className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <CardContent className="p-6">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold mb-2">ניהול לקוחות</h3>
                      <p className="text-muted-foreground">כרטיסי לקוחות מסודרים עם כל המידע החשוב במקום אחד</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="group overflow-hidden border-2 hover:border-primary/50 hover:shadow-2xl hover:-translate-y-2 transition-all duration-500">
                <div className="overflow-hidden">
                  <img 
                    src={tasksScreenshot} 
                    alt="ניהול משימות" 
                    className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <CardContent className="p-6">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <CheckSquare className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold mb-2">ניהול משימות</h3>
                      <p className="text-muted-foreground">לוח קאנבאן דינמי לניהול משימות ופרויקטים בצורה ויזואלית</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl md:text-5xl font-bold">
              כל מה שהסוכנות שלך צריכה
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              פלטפורמה מקיפה שמכסה את כל צרכי הניהול של סוכנות דיגיטל מודרנית
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {features.map((feature, index) => (
              <Card key={index} className="group border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
                <CardHeader>
                  <div className="w-14 h-14 rounded-xl gradient-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg">
                    <feature.icon className="h-7 w-7 text-white drop-shadow-lg" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                  <CardDescription className="text-base leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Brand Customization Section */}
      <section className="py-24 bg-gradient-to-br from-primary/5 via-background to-primary/5">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-semibold">
                  <Palette className="h-4 w-4" />
                  התאמה אישית מלאה
                </div>
                <h2 className="text-4xl md:text-5xl font-bold">
                  התאם את המערכת
                  <span className="block gradient-primary bg-clip-text text-transparent mt-2">
                    לברנד שלך
                  </span>
                </h2>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  כל לקוח יכול להתאים את העיצוב של הממשק שלו - צבעים, לוגו, גופנים ועוד.
                  תן ללקוחות שלך חוויה מותאמת אישית שמשקפת את המותג שלהם.
                </p>
                <div className="space-y-3 pt-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                    <span className="text-base">התאמת צבעים וגרדיאנטים לפי המותג</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                    <span className="text-base">העלאת לוגו והתאמת פביקון</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                    <span className="text-base">בחירת גופנים מותאמים</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                    <span className="text-base">דומיין מותאם אישית לכל לקוח</span>
                  </div>
                </div>
              </div>
              <div className="relative">
                <div className="aspect-square rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 p-8 backdrop-blur-sm border-2 border-primary/20">
                  <div className="h-full flex flex-col gap-4">
                    <div className="flex gap-3">
                      <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500" />
                      <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500" />
                      <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-pink-500 to-purple-500" />
                    </div>
                    <div className="flex-1 rounded-xl bg-card/50 backdrop-blur-sm p-6 border-2 border-primary/20">
                      <div className="space-y-3">
                        <div className="h-4 bg-primary/20 rounded w-3/4" />
                        <div className="h-4 bg-primary/20 rounded w-1/2" />
                        <div className="h-20 bg-primary/10 rounded mt-6" />
                      </div>
                    </div>
                  </div>
                </div>
                <Sparkles className="absolute -top-4 -right-4 h-8 w-8 text-primary animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12 space-y-4">
            <h2 className="text-4xl md:text-5xl font-bold">
              המספרים מדברים בעד עצמם
            </h2>
            <p className="text-xl text-muted-foreground">
              תוצאות אמיתיות מסוכנויות שמשתמשות ב-AfterLead
            </p>
          </div>
          <div className="grid md:grid-cols-4 gap-8 max-w-5xl mx-auto">
            <Card className="text-center p-6 border-2 hover:border-primary/50 transition-all">
              <div className="text-5xl md:text-6xl font-bold gradient-primary bg-clip-text text-transparent mb-3">
                +35%
              </div>
              <p className="text-muted-foreground font-medium">הכנסות נוספות לסוכנות</p>
            </Card>
            <Card className="text-center p-6 border-2 hover:border-primary/50 transition-all">
              <div className="text-5xl md:text-6xl font-bold gradient-primary bg-clip-text text-transparent mb-3">
                5 דק'
              </div>
              <p className="text-muted-foreground font-medium">לפתוח חשבון לקוח חדש</p>
            </Card>
            <Card className="text-center p-6 border-2 hover:border-primary/50 transition-all">
              <div className="text-5xl md:text-6xl font-bold gradient-primary bg-clip-text text-transparent mb-3">
                100%
              </div>
              <p className="text-muted-foreground font-medium">הפרדה בין לקוחות</p>
            </Card>
            <Card className="text-center p-6 border-2 hover:border-primary/50 transition-all">
              <div className="text-5xl md:text-6xl font-bold gradient-primary bg-clip-text text-transparent mb-3">
                24/7
              </div>
              <p className="text-muted-foreground font-medium">תמיכה בעברית</p>
            </Card>
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
      <section className="py-24">
        <div className="container mx-auto px-4">
          <Card className="max-w-5xl mx-auto border-0 shadow-2xl overflow-hidden relative">
            <div className="absolute inset-0 gradient-primary opacity-95" />
            <CardContent className="relative p-12 md:p-16 text-center text-white space-y-8">
              <div className="space-y-4">
                <h2 className="text-4xl md:text-5xl font-bold leading-tight">
                  מוכן להתחיל את המסע לצמיחה?
                </h2>
                <p className="text-xl md:text-2xl text-white/90 max-w-3xl mx-auto leading-relaxed">
                  הצטרף לסוכנויות דיגיטל שכבר משתמשות ב-AfterLead 
                  <br className="hidden md:block" />
                  ותן ללקוחות שלך את השירות שהם מגיעים להם
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                <Button 
                  size="lg" 
                  variant="secondary"
                  className="text-lg px-10 py-6 shadow-xl hover:shadow-2xl transition-all"
                  onClick={() => navigate("/signup")}
                >
                  התחל בחינם עכשיו
                  <Rocket className="mr-2 h-5 w-5" />
                </Button>
                <Button 
                  size="lg" 
                  variant="outline"
                  className="text-lg px-10 py-6 bg-white/10 border-white/30 text-white hover:bg-white/20 backdrop-blur-sm"
                  onClick={() => navigate("/auth")}
                >
                  יש לך כבר חשבון? התחבר
                  <ArrowLeft className="mr-2 h-5 w-5" />
                </Button>
              </div>
              <div className="flex items-center justify-center gap-8 pt-6 text-sm text-white/80">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>ללא התחייבות</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>ביטול בכל עת</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>תמיכה מלאה</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12 bg-card/50">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg gradient-primary" />
              <span className="text-2xl font-bold">AfterLead</span>
            </div>
            <p className="text-muted-foreground max-w-md">
              הפלטפורמה המובילה לניהול מכירות עבור סוכנויות דיגיטל בישראל
            </p>
            <p className="text-sm text-muted-foreground">
              © 2025 AfterLead. כל הזכויות שמורות.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
