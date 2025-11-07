import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
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
  Palette,
  Rocket,
  ArrowRight,
  Smartphone,
  DollarSign,
  type LucideIcon
} from "lucide-react";
import logoM from "@/assets/logo.png";
import heroCards from "@/assets/hero-cards-updated.png";
import mobileLeads from "@/assets/mobile-leads.jpg";
import mobilePipeline from "@/assets/mobile-pipeline.jpg";
import mobileFinance from "@/assets/mobile-finance.jpg";
import mobileTasks from "@/assets/mobile-tasks.jpg";

const Landing = () => {
  const navigate = useNavigate();

  const features: Array<{
    icon?: LucideIcon;
    customIcon?: string;
    title: string;
    description: string;
  }> = [
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
      customIcon: logoM,
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
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <img src={logoM} alt="AfterLead" className="w-10 h-10" />
              <span className="text-xl font-bold">AfterLead</span>
            </div>

            {/* Navigation Menu */}
            <NavigationMenu className="hidden lg:flex">
              <NavigationMenuList>
                <NavigationMenuItem>
                  <NavigationMenuTrigger>המוצר</NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <div className="grid gap-3 p-6 w-[500px]">
                      <div className="grid grid-cols-2 gap-4">
                        <NavigationMenuLink asChild>
                          <a
                            className="group grid h-auto w-full items-center gap-3 rounded-md p-4 hover:bg-accent"
                            href="#features"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Target className="h-4 w-4 text-primary" />
                              </div>
                              <div>
                                <div className="text-sm font-medium">ניהול לידים</div>
                                <p className="text-xs text-muted-foreground">מעקב אחר כל ליד</p>
                              </div>
                            </div>
                          </a>
                        </NavigationMenuLink>
                        <NavigationMenuLink asChild>
                          <a
                            className="group grid h-auto w-full items-center gap-3 rounded-md p-4 hover:bg-accent"
                            href="#features"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Users className="h-4 w-4 text-primary" />
                              </div>
                              <div>
                                <div className="text-sm font-medium">ניהול צוותים</div>
                                <p className="text-xs text-muted-foreground">צוותי מכירות מסונכרנים</p>
                              </div>
                            </div>
                          </a>
                        </NavigationMenuLink>
                        <NavigationMenuLink asChild>
                          <a
                            className="group grid h-auto w-full items-center gap-3 rounded-md p-4 hover:bg-accent"
                            href="#features"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                <BarChart3 className="h-4 w-4 text-primary" />
                              </div>
                              <div>
                                <div className="text-sm font-medium">אנליטיקס</div>
                                <p className="text-xs text-muted-foreground">דוחות ותובנות בזמן אמת</p>
                              </div>
                            </div>
                          </a>
                        </NavigationMenuLink>
                        <NavigationMenuLink asChild>
                          <a
                            className="group grid h-auto w-full items-center gap-3 rounded-md p-4 hover:bg-accent"
                            href="#features"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                <CheckSquare className="h-4 w-4 text-primary" />
                              </div>
                              <div>
                                <div className="text-sm font-medium">ניהול משימות</div>
                                <p className="text-xs text-muted-foreground">ארגון פרויקטים ועבודות</p>
                              </div>
                            </div>
                          </a>
                        </NavigationMenuLink>
                      </div>
                    </div>
                  </NavigationMenuContent>
                </NavigationMenuItem>

                <NavigationMenuItem>
                  <NavigationMenuTrigger>פתרונות</NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <div className="grid gap-3 p-6 w-[400px]">
                      <NavigationMenuLink asChild>
                        <a
                          className="group grid h-auto w-full items-center gap-3 rounded-md p-4 hover:bg-accent"
                          href="#features"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Building2 className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <div className="text-sm font-medium">לסוכנויות דיגיטל</div>
                              <p className="text-xs text-muted-foreground">נהל מאות לקוחות בקלות</p>
                            </div>
                          </div>
                        </a>
                      </NavigationMenuLink>
                      <NavigationMenuLink asChild>
                        <a
                          className="group grid h-auto w-full items-center gap-3 rounded-md p-4 hover:bg-accent"
                          href="#features"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                              <TrendingUp className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <div className="text-sm font-medium">לצוותי מכירות</div>
                              <p className="text-xs text-muted-foreground">הגדל את המכירות שלך</p>
                            </div>
                          </div>
                        </a>
                      </NavigationMenuLink>
                      <NavigationMenuLink asChild>
                        <a
                          className="group grid h-auto w-full items-center gap-3 rounded-md p-4 hover:bg-accent"
                          href="#features"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Sparkles className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <div className="text-sm font-medium">לעסקים קטנים</div>
                              <p className="text-xs text-muted-foreground">התחל בחינם ללא מחויבות</p>
                            </div>
                          </div>
                        </a>
                      </NavigationMenuLink>
                    </div>
                  </NavigationMenuContent>
                </NavigationMenuItem>

                <NavigationMenuItem>
                  <NavigationMenuLink asChild>
                    <a
                      className="group inline-flex h-10 w-max items-center justify-center rounded-md bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none disabled:pointer-events-none disabled:opacity-50"
                      href="#pricing"
                    >
                      מחירים
                    </a>
                  </NavigationMenuLink>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>

            {/* CTA Buttons */}
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate("/auth")}
                className="hidden md:flex"
              >
                התחבר
              </Button>
              <Button 
                size="sm"
                onClick={() => navigate("/signup")}
                className="shadow-lg"
              >
                התחל בחינם
                <Rocket className="mr-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-16 md:py-24 bg-gradient-to-b from-background to-muted/20">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(168,85,247,0.1),transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_60%,rgba(59,130,246,0.1),transparent_50%)]" />
        </div>
        
        <div className="container mx-auto px-4 relative">
          {/* Top Section - Title */}
          <div className="text-center mb-12 md:mb-16">
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold leading-tight mb-4 md:mb-6">
              AfterLead
            </h1>
            <p className="text-2xl md:text-3xl font-semibold text-primary mb-4">
              יצירה • צמיחה • התרחבות
            </p>
            <p className="text-lg md:text-xl text-muted-foreground max-w-4xl mx-auto">
              מערכת שעוזרת לסוכניות דיגיטל לצמוח
            </p>
          </div>

          {/* Main Content - Two Columns */}
          <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left Side - Text Content */}
            <div className="space-y-6 order-2 lg:order-1">
              <h2 className="text-3xl md:text-5xl lg:text-6xl font-bold leading-tight">
                ניהול לקוחות,
                <br />
                <span className="bg-primary text-primary-foreground px-3 py-1 rounded-lg">חכם ופשוט</span>
              </h2>
              <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
                פלטפורמה מקיפה לניהול סוכנויות דיגיטל. נהל לקוחות, לידים, משימות וצוותים - הכל במקום אחד.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Button 
                  size="lg" 
                  className="text-lg px-8 py-6 shadow-lg hover:shadow-xl transition-all"
                  onClick={() => navigate("/signup")}
                >
                  התחל בחינם עכשיו
                  <Rocket className="mr-2 h-5 w-5" />
                </Button>
                <Button 
                  size="lg" 
                  variant="outline"
                  className="text-lg px-8 py-6 border-2"
                  onClick={() => navigate("/auth")}
                >
                  ראה את המערכת בפעולה
                </Button>
              </div>
            </div>

            {/* Right Side - Image */}
            <div className="relative order-1 lg:order-2">
              <div className="relative w-full aspect-video scale-110">
                <img 
                  src={heroCards} 
                  alt="AfterLead Platform Cards" 
                  className="w-full h-full object-contain drop-shadow-2xl"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Screenshots Section */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16 space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4">
                <Smartphone className="h-4 w-4" />
                התאמה מלאה למובייל
              </div>
              <h2 className="text-4xl md:text-5xl font-bold">
                צפה במערכת בפעולה
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                ממשק נקי, מודרני ואינטואיטיבי שעובד מצוין במובייל, טאבלט ומחשב
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="group overflow-hidden border-2 hover:border-primary/50 hover:shadow-2xl hover:-translate-y-2 transition-all duration-500">
                <div className="overflow-hidden bg-gradient-to-br from-muted/50 to-background">
                  <img 
                    src={mobileLeads} 
                    alt="ניהול לידים במובייל" 
                    className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <CardContent className="p-6">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Target className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold mb-2">ניהול לידים</h3>
                      <p className="text-sm text-muted-foreground">מעקב אחר כל ליד עם פילטרים חכמים ומשפך מכירות</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="group overflow-hidden border-2 hover:border-primary/50 hover:shadow-2xl hover:-translate-y-2 transition-all duration-500">
                <div className="overflow-hidden bg-gradient-to-br from-muted/50 to-background">
                  <img 
                    src={mobilePipeline} 
                    alt="משפך מכירות במובייל" 
                    className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <CardContent className="p-6">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <TrendingUp className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold mb-2">משפך מכירות</h3>
                      <p className="text-sm text-muted-foreground">ניתוח שלבי המכירה בצורה ויזואלית וברורה</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="group overflow-hidden border-2 hover:border-primary/50 hover:shadow-2xl hover:-translate-y-2 transition-all duration-500">
                <div className="overflow-hidden bg-gradient-to-br from-muted/50 to-background">
                  <img 
                    src={mobileFinance} 
                    alt="ניהול כספים במובייל" 
                    className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <CardContent className="p-6">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <BarChart3 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold mb-2">ניהול כספים</h3>
                      <p className="text-sm text-muted-foreground">מעקב אחר הכנסות, הוצאות ורווחים בזמן אמת</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="group overflow-hidden border-2 hover:border-primary/50 hover:shadow-2xl hover:-translate-y-2 transition-all duration-500">
                <div className="overflow-hidden bg-gradient-to-br from-muted/50 to-background">
                  <img 
                    src={mobileTasks} 
                    alt="ניהול משימות במובייל" 
                    className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <CardContent className="p-6">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <CheckSquare className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold mb-2">ניהול משימות</h3>
                      <p className="text-sm text-muted-foreground">ארגון משימות ופרויקטים עם שעון נוכחות מובנה</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl md:text-5xl font-bold">
              פיצ'רים מתקדמים למקסימום צמיחה
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              כלים חכמים שעוזרים לך לנהל לקוחות בצורה יעילה יותר ולהגדיל מכירות
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {features.map((feature, index) => (
              <Card key={index} className="group border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
                <CardHeader>
                  <div className="w-14 h-14 rounded-xl gradient-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg">
                    {feature.customIcon ? (
                      <img src={feature.customIcon} alt="" className="h-8 w-8 object-contain drop-shadow-lg" />
                    ) : feature.icon ? (
                      <feature.icon className="h-7 w-7 text-white drop-shadow-lg" />
                    ) : null}
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

      {/* Value Proposition Section */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-2 gap-16 items-center">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-semibold">
                  <Sparkles className="h-4 w-4" />
                  מופעל על ידי בינה מלאכותית
                </div>
                <h2 className="text-4xl md:text-5xl font-bold leading-tight">
                  הצמחת עסק זה קשה.
                  <span className="block gradient-primary bg-clip-text text-transparent mt-2">
                    AfterLead הופכת את זה לקל יותר.
                  </span>
                </h2>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  כלים מנותקים ונתונים מפוזרים מאטים אותך. AfterLead מחברת הכל — וכולם — במקום אחד כדי להפוך את הצמיחה לקלה יותר ממה שחשבת.
                </p>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  כשאתה מוכן ליותר, שדרג כדי לקבל פונקציונליות CRM משופרת שבנויה על מה שכבר יש לך. אין התחלות מחדש, אין כאבי ראש של העברת נתונים.
                </p>
                <div className="flex gap-4 pt-4">
                  <Button size="lg" onClick={() => navigate("/signup")}>
                    התחל בחינם
                  </Button>
                  <Button size="lg" variant="outline">
                    למד עוד על AfterLead Premium
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <Card className="p-6 border-2 hover:border-primary/50 transition-all">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <Target className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">ניהול קשרים</h3>
                  <p className="text-sm text-muted-foreground">
                    צור קשרים, שמור על עדכניות, תעד פעילויות מכירה, וצפה בהיסטוריית התקשורת - הכל במקום אחד.
                  </p>
                </Card>
                <Card className="p-6 border-2 hover:border-primary/50 transition-all">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <TrendingUp className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">ניהול עסקאות</h3>
                  <p className="text-sm text-muted-foreground">
                    אחסן, עקוב, נהל ודווח על העסקאות או "ההזדמנויות" שהצוות שלך עובד עליהן.
                  </p>
                </Card>
                <Card className="p-6 border-2 hover:border-primary/50 transition-all">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <CheckSquare className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">משימות ופעילויות</h3>
                  <p className="text-sm text-muted-foreground">
                    עקוב אחר כל המשימות והפעילויות שעוזרות לך לבנות קשרי לקוחות חזקים, ממש בתוך ה-CRM שלך.
                  </p>
                </Card>
                <Card className="p-6 border-2 hover:border-primary/50 transition-all">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <BarChart3 className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">דשבורד דיווחים</h3>
                  <p className="text-sm text-muted-foreground">
                    צור מקור אמת יחיד לכל נתוני השיווק, המכירות והשירות שלך, נגיש לכל הצוות שלך.
                  </p>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16 space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4">
              <DollarSign className="h-4 w-4" />
              מחירים שקופים
            </div>
            <h2 className="text-4xl md:text-5xl font-bold">
              תמחור פשוט. מחירים הוגנים.
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              התחל בחינם ללא מחויבות. שדרג רק כשאתה מוכן
            </p>
          </div>

          <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-8">
            {/* Free Plan */}
            <Card className="border-2 hover:border-primary/50 transition-all">
              <CardHeader>
                <CardTitle className="text-2xl">חינם</CardTitle>
                <div className="text-4xl font-bold mt-4">₪0</div>
                <p className="text-muted-foreground">לנצח</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <span className="text-sm">עד 100 לידים בחודש</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <span className="text-sm">משתמש אחד</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <span className="text-sm">כל התכונות הבסיסיות</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <span className="text-sm">תמיכה בצ׳ט בעברית</span>
                  </div>
                </div>
                <Button className="w-full" onClick={() => navigate("/signup")}>
                  התחל בחינם
                </Button>
              </CardContent>
            </Card>

            {/* Pro Plan */}
            <Card className="border-2 border-primary relative shadow-2xl scale-105">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-primary-foreground rounded-full text-sm font-semibold">
                הכי פופולרי
              </div>
              <CardHeader>
                <CardTitle className="text-2xl">סוכנות</CardTitle>
                <div className="text-4xl font-bold mt-4">₪299</div>
                <p className="text-muted-foreground">לחודש</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <span className="text-sm">לידים ללא הגבלה</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <span className="text-sm">משתמשים ללא הגבלה</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <span className="text-sm">עד 5 תת חשבונות ללקוחות שלך</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <span className="text-sm">כל תת חשבון נוסף 50 ש״ח לחודש</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <span className="text-sm">אוטומציות</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <span className="text-sm">תמיכה מועדפת</span>
                  </div>
                </div>
                <Button className="w-full" onClick={() => navigate("/signup")}>
                  התחל ניסיון חינם
                </Button>
              </CardContent>
            </Card>

            {/* Enterprise Plan */}
            <Card className="border-2 hover:border-primary/50 transition-all">
              <CardHeader>
                <CardTitle className="text-2xl">ארגוני</CardTitle>
                <div className="text-4xl font-bold mt-4">₪497</div>
                <p className="text-muted-foreground">לחודש</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <span className="text-sm">כל מה שיש בחבילות הקודמות</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <span className="text-sm">אפשרות SaaS וריסלינג</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <span className="text-sm">עד 50 תת חשבונות כלול במחיר</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <span className="text-sm">25 ש״ח לתת חשבון נוסף מעל 50</span>
                  </div>
                </div>
                <Button variant="outline" className="w-full" onClick={() => navigate("/auth")}>
                  צור קשר
                </Button>
              </CardContent>
            </Card>
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
                  תן ללקוחות שלך את השירות שמגיע להם
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
              <img src={logoM} alt="AfterLead" className="w-10 h-10" />
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
