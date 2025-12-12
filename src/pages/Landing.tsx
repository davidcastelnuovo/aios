import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { 
  Users, 
  Target, 
  BarChart3, 
  MessageSquare, 
  CheckCircle2, 
  ArrowLeft,
  Zap,
  Shield,
  Clock
} from "lucide-react";
import logo from "@/assets/logo.png";

const Landing = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: Users,
      title: "ניהול לקוחות וסוכנויות",
      description: "מעקב מלא אחר כל הלקוחות והסוכנויות שלך במקום אחד"
    },
    {
      icon: Target,
      title: "ניהול לידים",
      description: "מעקב אחר לידים, סטטוסים, ופייפליין מכירות מתקדם"
    },
    {
      icon: BarChart3,
      title: "דוחות ואנליטיקה",
      description: "תובנות עסקיות ודוחות מפורטים לקבלת החלטות חכמות"
    },
    {
      icon: MessageSquare,
      title: "אינטגרציות צ'אט",
      description: "חיבור לוואטסאפ, ManyChat ופייסבוק לתקשורת ישירה עם לקוחות"
    },
    {
      icon: CheckCircle2,
      title: "ניהול משימות",
      description: "מערכת משימות מתקדמת עם תזכורות ומעקב ביצוע"
    },
    {
      icon: Zap,
      title: "אוטומציות",
      description: "הפעלת אוטומציות חכמות לחיסכון בזמן ומשאבים"
    }
  ];

  const benefits = [
    {
      icon: Shield,
      title: "אבטחה מתקדמת",
      description: "הנתונים שלך מוגנים עם הצפנה ברמה הגבוהה ביותר"
    },
    {
      icon: Clock,
      title: "חיסכון בזמן",
      description: "ממשק אינטואיטיבי שחוסך שעות עבודה בכל שבוע"
    },
    {
      icon: Users,
      title: "עבודה צוותית",
      description: "שיתוף פעולה קל בין חברי הצוות והארגון"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30" dir="rtl">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <nav className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="AfterLead" className="h-10 w-auto" />
            <span className="text-xl font-bold text-foreground">AfterLead</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              מדיניות פרטיות
            </Link>
            <Link to="/terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              תנאי שימוש
            </Link>
            <Button variant="outline" onClick={() => navigate("/auth")}>
              התחברות
            </Button>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="text-center max-w-4xl mx-auto space-y-8">
          <h1 className="text-4xl md:text-6xl font-bold text-foreground leading-tight">
            מערכת ניהול סוכנויות
            <span className="block text-primary mt-2">המתקדמת בישראל</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            נהל את הסוכנות שלך בצורה חכמה יותר. מעקב אחר לקוחות, לידים, משימות ואינטגרציות - הכל במקום אחד.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button size="lg" className="text-lg px-8 py-6" onClick={() => navigate("/signup")}>
              התחל בחינם
              <ArrowLeft className="mr-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8 py-6" onClick={() => navigate("/auth")}>
              כניסה למערכת
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            כל מה שצריך לניהול הסוכנות
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            מערכת מקיפה שמאחדת את כל הכלים שאתה צריך
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <Card key={index} className="border-border/50 hover:border-primary/50 transition-colors">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-semibold text-foreground">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Benefits Section */}
      <section className="bg-muted/30 py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              למה לבחור בנו?
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {benefits.map((benefit, index) => (
              <div key={index} className="text-center space-y-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <benefit.icon className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground">{benefit.title}</h3>
                <p className="text-muted-foreground">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <Card className="bg-primary text-primary-foreground">
          <CardContent className="p-8 md:p-12 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              מוכן להתחיל?
            </h2>
            <p className="text-lg opacity-90 mb-8 max-w-xl mx-auto">
              הצטרף לאלפי סוכנויות שכבר משתמשות במערכת שלנו
            </p>
            <Button 
              size="lg" 
              variant="secondary" 
              className="text-lg px-8 py-6"
              onClick={() => navigate("/signup")}
            >
              התחל עכשיו בחינם
              <ArrowLeft className="mr-2 h-5 w-5" />
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-muted/20">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src={logo} alt="AfterLead" className="h-8 w-auto" />
              <span className="font-semibold text-foreground">AfterLead</span>
            </div>
            <div className="flex items-center gap-6">
              <Link to="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                מדיניות פרטיות
              </Link>
              <Link to="/terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                תנאי שימוש
              </Link>
              <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                התחברות
              </Link>
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} AfterLead. כל הזכויות שמורות.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
