import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  Clock,
  Calendar,
  Sparkles,
  RefreshCw,
  DollarSign,
  Building2,
  TrendingUp,
  Rocket
} from "lucide-react";
import logo from "@/assets/logo.png";
import dashboardImg from "@/assets/dashboard-screenshot.png";
import leadsImg from "@/assets/leads-screenshot.png";
import tasksImg from "@/assets/tasks-screenshot.png";
import clientsImg from "@/assets/clients-screenshot.png";

const Landing = () => {
  const navigate = useNavigate();

  const modules = [
    {
      icon: Target,
      title: "ניהול לידים",
      description: "פייפליין מכירות מתקדם, סטטוסים דינמיים, יבוא אוטומטי מפייסבוק וסינון חכם",
      color: "from-blue-500 to-cyan-500",
      image: leadsImg
    },
    {
      icon: CheckCircle2,
      title: "ניהול משימות",
      description: "תצוגת קנבן, טבלה ולוח שנה. משימות ללקוחות ולידים עם תזכורות חכמות",
      color: "from-green-500 to-emerald-500",
      image: tasksImg
    },
    {
      icon: Zap,
      title: "אוטומציות",
      description: "טריגרים אוטומטיים לפי סטטוס ליד, פולואפים והתראות WhatsApp",
      color: "from-yellow-500 to-orange-500",
      badge: "חדש!"
    },
    {
      icon: Users,
      title: "ניהול לקוחות",
      description: "כרטיס לקוח מפורט, היסטוריית עדכונים, צוותי עבודה ומעקב מצב רוח",
      color: "from-purple-500 to-pink-500",
      image: clientsImg
    },
    {
      icon: DollarSign,
      title: "ניהול כספים",
      description: "מעקב תשלומים, דוחות כספיים ואינטגרציות עם הנהלת חשבונות",
      color: "from-emerald-500 to-teal-500"
    },
    {
      icon: MessageSquare,
      title: "אינטגרציית WhatsApp",
      description: "Green API, ManyChat וצ'אט מובנה. שליחת הודעות ישירות מהמערכת",
      color: "from-green-600 to-green-400"
    },
    {
      icon: Sparkles,
      title: "בינה מלאכותית (AI)",
      description: "עוזר AI חכם לתמיכה טכנית, ניתוח נתונים והמלצות אוטומטיות",
      color: "from-violet-500 to-purple-500",
      badge: "AI"
    },
    {
      icon: RefreshCw,
      title: "פולואפים אוטומטיים",
      description: "מעקב אוטומטי אחרי לידים, תזכורות חכמות וטריגרים לפי סטטוס",
      color: "from-rose-500 to-pink-500"
    },
    {
      icon: Calendar,
      title: "אינטגרציית יומן",
      description: "סנכרון עם Google Calendar, קביעת פגישות ושליחת הזמנות אוטומטית",
      color: "from-blue-600 to-indigo-500"
    }
  ];

  const benefits = [
    {
      icon: Shield,
      title: "אבטחה מתקדמת",
      description: "הנתונים שלך מוגנים עם הצפנה ברמה הגבוהה ביותר ובידוד מלא בין ארגונים"
    },
    {
      icon: Clock,
      title: "חיסכון בזמן",
      description: "ממשק אינטואיטיבי ואוטומציות חכמות שחוסכות שעות עבודה בכל שבוע"
    },
    {
      icon: TrendingUp,
      title: "צמיחה עסקית",
      description: "כלים מתקדמים לניהול לידים ולקוחות שמובילים ליותר סגירות"
    }
  ];

  const stats = [
    { value: "1,000+", label: "סוכנויות פעילות" },
    { value: "50,000+", label: "לידים מנוהלים" },
    { value: "95%", label: "שביעות רצון" },
    { value: "24/7", label: "תמיכה זמינה" }
  ];

  const screenshots = [
    { src: dashboardImg, alt: "דשבורד ראשי" },
    { src: leadsImg, alt: "ניהול לידים" },
    { src: tasksImg, alt: "ניהול משימות" },
    { src: clientsImg, alt: "ניהול לקוחות" }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 overflow-hidden" dir="rtl">
      {/* Header */}
      <header className="container mx-auto px-4 py-6 relative z-10">
        <nav className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="AfterLead" className="h-10 w-auto" />
            <span className="text-xl font-bold text-foreground">AfterLead</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden md:block">
              מדיניות פרטיות
            </Link>
            <Link to="/terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden md:block">
              תנאי שימוש
            </Link>
            <Button variant="outline" onClick={() => navigate("/auth")}>
              התחברות
            </Button>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-12 md:py-20 relative">
        {/* Background decoration */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-20 right-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-20 left-10 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="text-center lg:text-right space-y-6">
            <Badge variant="secondary" className="text-sm px-4 py-1.5 bg-primary/10 text-primary border-0">
              <Rocket className="h-4 w-4 ml-2" />
              מערכת CRM לסוכנויות שיווק
            </Badge>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight">
              לצמוח
              <span className="block bg-gradient-to-l from-primary to-primary/70 bg-clip-text text-transparent">
                בלי להשתעבד
              </span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground max-w-xl">
              ניהול לידים, לקוחות, משימות, אוטומציות ואינטגרציות - הכל במקום אחד. 
              המערכת שתשחרר אותך לעסוק במה שחשוב באמת.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Button size="lg" className="text-lg px-8 py-6 shadow-lg hover:shadow-xl transition-all" onClick={() => navigate("/signup")}>
                התחל בחינם
                <ArrowLeft className="mr-2 h-5 w-5" />
              </Button>
              <Button size="lg" variant="outline" className="text-lg px-8 py-6" onClick={() => navigate("/auth")}>
                כניסה למערכת
              </Button>
            </div>
          </div>

          {/* Hero Image */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-transparent rounded-2xl -z-10 blur-2xl" />
            <img 
              src={dashboardImg} 
              alt="AfterLead Dashboard" 
              className="rounded-2xl shadow-2xl border border-border/50 animate-fade-in"
            />
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
            <div key={index} className="text-center p-6 rounded-xl bg-card/50 backdrop-blur border border-border/50">
              <div className="text-3xl md:text-4xl font-bold text-primary mb-1">{stat.value}</div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Multi-Tenant Feature */}
      <section className="container mx-auto px-4 py-16">
        <Card className="bg-gradient-to-br from-primary/5 via-background to-primary/10 border-primary/20 overflow-hidden relative">
          <div className="absolute top-0 left-0 w-40 h-40 bg-primary/10 rounded-full blur-3xl" />
          <CardContent className="p-8 md:p-12">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div className="space-y-6">
                <Badge className="bg-primary text-primary-foreground">
                  <Building2 className="h-4 w-4 ml-2" />
                  חדש!
                </Badge>
                <h2 className="text-3xl md:text-4xl font-bold text-foreground">
                  פתח חשבונות ללקוחות שלך
                </h2>
                <p className="text-lg text-muted-foreground">
                  כסוכנות שיווק, אתה יכול לפתוח לכל לקוח חשבון משלו עם גישה מלאה לנתונים שלו - בעוד שאתה רואה הכל ממקום אחד.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-center gap-3 text-foreground">
                    <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    </div>
                    כל לקוח רואה רק את הנתונים שלו
                  </li>
                  <li className="flex items-center gap-3 text-foreground">
                    <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center">
                      <Shield className="h-4 w-4 text-primary" />
                    </div>
                    בידוד מלא בין ארגונים
                  </li>
                  <li className="flex items-center gap-3 text-foreground">
                    <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center">
                      <BarChart3 className="h-4 w-4 text-primary" />
                    </div>
                    אתה רואה את כולם ממקום אחד
                  </li>
                </ul>
              </div>
              <div className="relative">
                <div className="grid grid-cols-2 gap-4">
                  <Card className="p-4 bg-card/80 backdrop-blur border-border/50">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="h-10 w-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-blue-500" />
                      </div>
                      <div className="font-semibold text-foreground">לקוח A</div>
                    </div>
                    <div className="text-xs text-muted-foreground">12 לידים • 5 משימות</div>
                  </Card>
                  <Card className="p-4 bg-card/80 backdrop-blur border-border/50">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="h-10 w-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-green-500" />
                      </div>
                      <div className="font-semibold text-foreground">לקוח B</div>
                    </div>
                    <div className="text-xs text-muted-foreground">8 לידים • 3 משימות</div>
                  </Card>
                  <Card className="p-4 bg-card/80 backdrop-blur border-border/50">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="h-10 w-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-purple-500" />
                      </div>
                      <div className="font-semibold text-foreground">לקוח C</div>
                    </div>
                    <div className="text-xs text-muted-foreground">20 לידים • 8 משימות</div>
                  </Card>
                  <Card className="p-4 bg-primary text-primary-foreground">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center">
                        <Users className="h-5 w-5" />
                      </div>
                      <div className="font-semibold">הסוכנות שלך</div>
                    </div>
                    <div className="text-xs opacity-80">רואה הכל!</div>
                  </Card>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Modules Section */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="text-center mb-16">
          <Badge variant="outline" className="mb-4">המודולים שלנו</Badge>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            כל מה שצריך לניהול הסוכנות
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            מערכת מקיפה עם 9 מודולים שמאחדים את כל הכלים שאתה צריך
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((module, index) => (
            <Card 
              key={index} 
              className="group border-border/50 hover:border-primary/50 hover:shadow-xl transition-all duration-300 overflow-hidden"
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${module.color} shadow-lg`}>
                    <module.icon className="h-6 w-6 text-white" />
                  </div>
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                        {module.title}
                      </h3>
                      {module.badge && (
                        <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-0">
                          {module.badge}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {module.description}
                    </p>
                  </div>
                </div>
                {module.image && (
                  <div className="mt-4 -mx-6 -mb-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <img 
                      src={module.image} 
                      alt={module.title}
                      className="w-full h-32 object-cover object-top border-t border-border/50"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Screenshots Gallery */}
      <section className="bg-muted/30 py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4">צילומי מסך</Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              הצצה למערכת
            </h2>
            <p className="text-lg text-muted-foreground">
              ממשק נקי, אינטואיטיבי ומותאם לעברית
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {screenshots.map((screenshot, index) => (
              <div 
                key={index} 
                className="relative group overflow-hidden rounded-xl shadow-lg border border-border/50"
              >
                <img 
                  src={screenshot.src} 
                  alt={screenshot.alt}
                  className="w-full h-auto transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end">
                  <span className="p-4 text-white font-medium">{screenshot.alt}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="text-center mb-12">
          <Badge variant="outline" className="mb-4">היתרונות שלנו</Badge>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            למה לבחור ב-AfterLead?
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {benefits.map((benefit, index) => (
            <div key={index} className="text-center space-y-4 p-6 rounded-2xl bg-card/50 border border-border/50 hover:border-primary/30 transition-colors">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                <benefit.icon className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground">{benefit.title}</h3>
              <p className="text-muted-foreground">{benefit.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <Card className="bg-gradient-to-br from-primary via-primary to-primary/80 text-primary-foreground overflow-hidden relative">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-2xl translate-x-1/2 translate-y-1/2" />
          <CardContent className="p-8 md:p-16 text-center relative z-10">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              מוכן לצמוח בלי להשתעבד?
            </h2>
            <p className="text-lg md:text-xl opacity-90 mb-8 max-w-xl mx-auto">
              הצטרף לאלפי סוכנויות שכבר מנהלות את העסק שלהן בצורה חכמה יותר
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                variant="secondary" 
                className="text-lg px-8 py-6 shadow-lg hover:shadow-xl transition-all"
                onClick={() => navigate("/signup")}
              >
                התחל עכשיו בחינם
                <ArrowLeft className="mr-2 h-5 w-5" />
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="text-lg px-8 py-6 bg-transparent border-white/30 hover:bg-white/10"
                onClick={() => navigate("/auth")}
              >
                יש לי כבר חשבון
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-muted/20">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src={logo} alt="AfterLead" className="h-8 w-auto" />
              <div>
                <span className="font-semibold text-foreground block">AfterLead</span>
                <span className="text-xs text-muted-foreground">לצמוח בלי להשתעבד</span>
              </div>
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
