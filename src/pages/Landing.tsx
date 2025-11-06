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
  Activity
} from "lucide-react";

const Landing = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: Users,
      title: "ניהול לידים מתקדם",
      description: "עקוב אחרי כל ליד מהרגע הראשון ועד לסגירת העסקה"
    },
    {
      icon: BarChart3,
      title: "דשבורד מכירות",
      description: "תובנות בזמן אמת על ביצועי המכירות וההמרות שלך"
    },
    {
      icon: Zap,
      title: "אוטומציות חכמות",
      description: "חסוך זמן יקר עם אוטומציות שמטפלות בתהליכים החוזרים"
    },
    {
      icon: Target,
      title: "ניהול סוכנויות",
      description: "נהל מספר סוכנויות ממקום אחד עם הרשאות מתקדמות"
    },
    {
      icon: Activity,
      title: "מעקב משימות",
      description: "עקוב אחר המשימות של הצוות ותזמן פגישות בקלות"
    },
    {
      icon: Shield,
      title: "אבטחה מתקדמת",
      description: "הגנה מלאה על המידע שלך עם RLS ואימות דו-שלבי"
    }
  ];

  const benefits = [
    "הגדל את שיעור ההמרות שלך ב-40%",
    "חסוך עד 20 שעות עבודה בשבוע",
    "נהל את כל צוות המכירות ממקום אחד",
    "קבל תובנות בזמן אמת על הביצועים",
    "התאם אישית את המערכת לצרכים שלך",
    "תמיכה מקצועית בעברית"
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-primary" />
            <span className="text-xl font-bold">CRM Pro</span>
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
              המערכת המתקדמת לניהול מכירות
            </div>
            <h1 className="text-4xl md:text-6xl font-bold">
              נהל את עסק המכירות שלך
              <span className="block gradient-primary bg-clip-text text-transparent mt-2">
                בצורה החכמה ביותר
              </span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              מערכת CRM מתקדמת שמאפשרת לך לעקוב אחר לידים, לנהל צוותי מכירות, 
              ולהגדיל את ההכנסות שלך - הכל במקום אחד
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
              כל מה שאתה צריך במקום אחד
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              מערכת מקיפה עם כל הכלים שצוות המכירות שלך צריך כדי להצליח
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
                למה לבחור ב-CRM Pro?
              </h2>
              <p className="text-xl text-muted-foreground">
                תוצאות מוכחות שעובדות עבור עסקים כמוך
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

      {/* Stats Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-bold gradient-primary bg-clip-text text-transparent mb-2">
                +40%
              </div>
              <p className="text-muted-foreground">עלייה בשיעור ההמרות</p>
            </div>
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-bold gradient-primary bg-clip-text text-transparent mb-2">
                20
              </div>
              <p className="text-muted-foreground">שעות חיסכון בשבוע</p>
            </div>
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-bold gradient-primary bg-clip-text text-transparent mb-2">
                100%
              </div>
              <p className="text-muted-foreground">שביעות רצון לקוחות</p>
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
                מוכן להתחיל את המסע?
              </h2>
              <p className="text-xl mb-8 text-white/90 max-w-2xl mx-auto">
                הצטרף לאלפי עסקים שכבר משתמשים ב-CRM Pro כדי לנהל את המכירות שלהם בצורה חכמה יותר
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
          <p>© 2025 CRM Pro. כל הזכויות שמורות.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
