import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import OptionsSelector from "@/components/OptionsSelector";
import AnimatedJoinButton from "@/components/AnimatedJoinButton";
import DemoRequestDialog from "@/components/DemoRequestDialog";
import { 
  Target,
  CheckCircle2, 
  Zap, 
  Users, 
  DollarSign, 
  MessageSquare,
  Sparkles,
  RefreshCw,
  Calendar,
  Building2,
  Shield,
  BarChart3,
  ArrowLeft,
  Check,
  CalendarClock,
  PieChart,
  Download,
  Smartphone,
} from "lucide-react";
import logoImage from "@/assets/logo.png";

interface ModuleCardProps {
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  isNew?: boolean;
}

const ModuleCard: React.FC<ModuleCardProps> = ({
  title,
  description,
  icon: Icon,
  color,
  isNew,
}) => {
  return (
    <div className="group relative p-8 rounded-3xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 hover:border-[#36d399]/30 transition-all duration-300 overflow-hidden">
      {/* Decorative circles */}
      <div className="absolute -top-6 -right-6 w-24 h-24 border border-[#36d399]/20 rounded-full" />
      <div className="absolute -top-3 -right-3 w-16 h-16 border border-[#36d399]/10 rounded-full" />
      <div className="absolute -bottom-4 -left-4 w-20 h-20 border border-white/5 rounded-full" />
      
      {isNew && (
        <span className="absolute top-5 left-5 px-3 py-1.5 text-sm font-medium bg-[#36d399] text-[#0A1526] rounded-full z-10">
          חדש
        </span>
      )}
      
      <div className="relative z-10 flex flex-col items-center text-center">
        <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center mb-4 group-hover:scale-105 transition-transform`}>
          <Icon className="h-8 w-8 text-white" />
        </div>
        
        <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
        <p className="text-white/60 text-sm leading-relaxed">{description}</p>
      </div>
    </div>
  );
};

const Landing = () => {
  const navigate = useNavigate();
  const [demoDialogOpen, setDemoDialogOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isAppInstalled, setIsAppInstalled] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsAppInstalled(true);
    }
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === 'accepted') setIsAppInstalled(true);
      setDeferredPrompt(null);
    } else {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) {
        alert('להתקנה באייפון:\n1. לחץ על כפתור השיתוף (⬆️)\n2. בחר "Add to Home Screen"');
      } else {
        alert('פתח את התפריט של הדפדפן ובחר "התקן אפליקציה" או "הוסף למסך הבית"');
      }
    }
  };
  const modules = [
    {
      title: "ניהול לידים",
      description: "פייפליין מכירות, סטטוסים דינמיים, יבוא מפייסבוק",
      icon: Target,
      color: "from-primary/20 to-primary/5"
    },
    {
      title: "ניהול משימות",
      description: "קנבן, טבלה, לוח שנה - תזכורות אוטומטיות",
      icon: CheckCircle2,
      color: "from-green-500/20 to-green-500/5"
    },
    {
      title: "אוטומציות",
      description: "טריגרים אוטומטיים, פולואפים, התראות",
      icon: Zap,
      color: "from-yellow-500/20 to-yellow-500/5"
    },
    {
      title: "ניהול לקוחות",
      description: "כרטיס לקוח מפורט, היסטוריה, צוותי עבודה",
      icon: Users,
      color: "from-blue-500/20 to-blue-500/5"
    },
    {
      title: "ניהול כספים",
      description: "מעקב תשלומים, דוחות, אינטגרציות",
      icon: DollarSign,
      color: "from-emerald-500/20 to-emerald-500/5"
    },
    {
      title: "אינטגרציית WhatsApp",
      description: "Green API, ManyChat, צ'אט מובנה",
      icon: MessageSquare,
      color: "from-green-400/20 to-green-400/5"
    },
    {
      title: "זימון פגישות אוטומטי",
      description: "אינטגרציה ל-Google Calendar, שליחת זימונים ללקוחות ולידים",
      icon: CalendarClock,
      color: "from-sky-500/20 to-sky-500/5",
      isNew: true
    },
    {
      title: "דוחות אוטומטיים",
      description: "אינטגרציה ישירה למערכות פרסום, דוחות ביצועים בזמן אמת",
      icon: PieChart,
      color: "from-pink-500/20 to-pink-500/5",
      isNew: true
    },
    {
      title: "בינה מלאכותית",
      description: "עוזר AI חכם לתמיכה וניהול",
      icon: Sparkles,
      color: "from-purple-500/20 to-purple-500/5",
      isNew: true
    },
    {
      title: "פולואפים אוטומטיים",
      description: "מעקב אוטומטי, תזכורות חכמות",
      icon: RefreshCw,
      color: "from-orange-500/20 to-orange-500/5"
    },
    {
      title: "אינטגרציית יומן",
      description: "Google Calendar, קביעת פגישות",
      icon: Calendar,
      color: "from-red-500/20 to-red-500/5"
    }
  ];

  const multiTenantBenefits = [
    { icon: Building2, text: "כל לקוח מקבל חשבון נפרד ומאובטח" },
    { icon: Shield, text: "בידוד מלא בין ארגונים" },
    { icon: BarChart3, text: "צפייה בכל הארגונים ממקום אחד" },
    { icon: Users, text: "ניהול הרשאות מתקדם" }
  ];

  return (
    <div className="min-h-screen bg-[#0A1526] text-white overflow-x-hidden">
      {/* Background Elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[#36d399]/10 rounded-full blur-[150px] -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-[#36d399]/5 rounded-full blur-[120px] translate-y-1/2 -translate-x-1/3" />
        <div className="absolute top-1/2 left-1/2 w-[400px] h-[400px] bg-[#36d399]/5 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2" />
      </div>

      {/* Sticky Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#0A1526]/80 border-b border-white/5">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={logoImage} alt="AfterLead" className="h-10 w-auto" />
            </div>

            <div className="flex items-center gap-3">
              {!isAppInstalled && (
                <Button 
                  variant="ghost" 
                  className="text-white/70 hover:text-white hover:bg-white/10 gap-2"
                  onClick={handleInstallApp}
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">התקן אפליקציה</span>
                </Button>
              )}
              <Link to="/auth">
                <Button variant="ghost" className="text-white/70 hover:text-white hover:bg-white/10">
                  התחברות
                </Button>
              </Link>
              <Button 
                onClick={() => setDemoDialogOpen(true)}
                className="bg-[#36d399] hover:bg-[#36d399]/90 text-[#0A1526] font-semibold"
              >
                הזמן דמו
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-20 pb-32">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center">
            {/* Logo & Brand */}
            <div className="flex items-center justify-center gap-4 mb-8">
              <img src={logoImage} alt="AfterLead" className="h-16 md:h-20 w-auto" />
              <span className="text-4xl md:text-6xl font-bold text-white">AfterLead</span>
            </div>

            {/* Badge */}
            <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-[#36d399]/10 border border-[#36d399]/30 mb-10">
              <Sparkles className="h-5 w-5 text-[#36d399]" />
              <span className="text-lg md:text-xl font-medium text-[#36d399]">מערכת AIOS — מערכת הפעלה מבוססת בינה מלאכותית</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
              <span className="text-white">השותפים שלך </span>
              <span className="text-[#36d399]">לצמיחה</span>
            </h1>

            {/* Subtitle */}
            <p className="text-xl md:text-2xl text-white/60 mb-10 max-w-2xl mx-auto leading-relaxed">
              ניהול לידים לעסק שלך וללקוחות שלך
              <br />
              <span className="text-white/40">בנוי במיוחד עבור סוכנויות שיווק.</span>
            </p>

            {/* AIOS Description */}
            <div className="max-w-2xl mx-auto mb-10 px-6 py-5 rounded-2xl bg-white/5 border border-white/10 text-right">
              <p className="text-white/70 text-base md:text-lg leading-relaxed">
                <span className="text-[#36d399] font-semibold">AIOS</span> היא לא סתם תוכנת CRM — היא מערכת הפעלה חכמה לעסק שלך.
                במקום לנהל כלים נפרדים, AfterLead מרכזת הכל במקום אחד: לידים, לקוחות, משימות, אוטומציות, ואינטגרציות —
                ומניעה אותם עם בינה מלאכותית שעובדת בשבילך ברקע, 24/7.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              <AnimatedJoinButton 
                text="הזמן דמו" 
                hoverText="עכשיו!" 
                onClick={() => setDemoDialogOpen(true)} 
              />
              <Link to="/auth">
                <Button size="lg" variant="outline" className="border-white/40 bg-white/10 text-white font-semibold hover:bg-white/20 text-lg px-8 py-6 rounded-xl backdrop-blur-sm">
                  יש לי חשבון
                </Button>
              </Link>
            </div>

            {/* Stats */}
            <div className="mt-20 grid grid-cols-3 gap-8 max-w-xl mx-auto">
              <div className="text-center">
                <div className="text-3xl font-bold text-[#36d399]">50+</div>
                <div className="text-sm text-white/40">ארגונים פעילים</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-[#36d399]">10K+</div>
                <div className="text-sm text-white/40">לידים מנוהלים</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-[#36d399]">99%</div>
                <div className="text-sm text-white/40">שביעות רצון</div>
              </div>
            </div>
          </div>

          {/* Decorative Lines */}
          <div className="absolute top-1/2 left-0 w-32 h-px bg-gradient-to-r from-transparent to-[#36d399]/30" />
          <div className="absolute top-1/2 right-0 w-32 h-px bg-gradient-to-l from-transparent to-[#36d399]/30" />
        </div>
      </section>

      {/* Multi-Tenant Section */}
      <section id="multi-tenant" className="relative py-24 overflow-hidden">
        {/* Background Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#3b82f6]/15 rounded-full blur-[150px]" />
        
        <div className="container mx-auto px-6 relative">
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              {/* Text Content */}
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#36d399]/10 border border-[#36d399]/20 mb-6">
                  <span className="text-xs font-medium text-[#36d399]">חדש!</span>
                  <span className="text-sm text-white/70">Multi-Tenant</span>
                </div>
                
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 leading-tight">
                  פתח חשבונות
                  <br />
                  <span className="text-[#36d399]">ללקוחות שלך</span>
                </h2>
                
                <p className="text-white/50 text-lg mb-8 leading-relaxed">
                  אפשר ללקוחות שלך לנהל את העסק שלהם דרך המערכת שלך. 
                  כל לקוח מקבל גישה מותאמת אישית לנתונים שלו בלבד.
                </p>

                <div className="space-y-4">
                  {multiTenantBenefits.map((benefit, index) => (
                    <div key={index} className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-[#36d399]/10 flex items-center justify-center flex-shrink-0">
                        <benefit.icon className="h-5 w-5 text-[#36d399]" />
                      </div>
                      <span className="text-white/70">{benefit.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Visual Element */}
              <div className="relative">
                <div className="relative p-8 rounded-3xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10">
                  {/* Organization Cards Stack */}
                  <div className="space-y-4">
                    {["סוכנות שיווק ראשית", "לקוח - חברת טכנולוגיה", "לקוח - מסעדה"].map((org, idx) => (
                      <div 
                        key={idx}
                        className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10"
                        style={{ transform: `translateX(${idx * 10}px)` }}
                      >
                        <div className={`w-10 h-10 rounded-lg ${idx === 0 ? 'bg-[#36d399]' : 'bg-white/10'} flex items-center justify-center`}>
                          <Building2 className={`h-5 w-5 ${idx === 0 ? 'text-[#0A1526]' : 'text-white/50'}`} />
                        </div>
                        <div>
                          <div className={`text-sm font-medium ${idx === 0 ? 'text-white' : 'text-white/70'}`}>{org}</div>
                          <div className="text-xs text-white/40">{idx === 0 ? 'מנהל' : 'לקוח'}</div>
                        </div>
                        {idx === 0 && <Check className="h-5 w-5 text-[#36d399] mr-auto" />}
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Decorative Elements */}
                <div className="absolute -top-4 -right-4 w-24 h-24 border border-[#36d399]/20 rounded-full" />
                <div className="absolute -bottom-4 -left-4 w-16 h-16 border border-[#36d399]/10 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* Options Selector Demo */}
      <section className="relative">
        <OptionsSelector />
      </section>

      {/* CTA Section */}
      <section className="relative py-24">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center p-12 rounded-3xl bg-gradient-to-br from-[#36d399]/20 to-[#36d399]/5 border border-[#36d399]/20 relative overflow-hidden">
            {/* Background Circles */}
            <div className="absolute top-0 right-0 w-40 h-40 bg-[#36d399]/20 rounded-full blur-[60px]" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#36d399]/10 rounded-full blur-[40px]" />
            
            <div className="relative">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                מוכנים להתחיל?
              </h2>
              <p className="text-white/60 text-lg mb-8">
                הצטרפו לעשרות סוכנויות שכבר משתמשות ב-AfterLead
              </p>
              <AnimatedJoinButton 
                text="הזמן דמו" 
                hoverText="חינם!" 
                onClick={() => setDemoDialogOpen(true)} 
              />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <img src={logoImage} alt="AfterLead" className="h-8 w-auto" />
              <span className="text-lg font-semibold text-white">AfterLead</span>
            </div>
            
            <div className="flex items-center gap-6 text-sm">
              <Link to="/privacy" className="text-white/50 hover:text-white transition-colors">מדיניות פרטיות</Link>
              <Link to="/terms" className="text-white/50 hover:text-white transition-colors">תנאי שימוש</Link>
              <a href="mailto:support@afterlead.co.il" className="text-white/50 hover:text-white transition-colors">צור קשר</a>
            </div>
            
            <div className="text-white/30 text-sm">
              © {new Date().getFullYear()} AfterLead. כל הזכויות שמורות.
            </div>
          </div>
        </div>
      </footer>

      {/* Demo Request Dialog */}
      <DemoRequestDialog open={demoDialogOpen} onOpenChange={setDemoDialogOpen} />
    </div>
  );
};

export default Landing;
