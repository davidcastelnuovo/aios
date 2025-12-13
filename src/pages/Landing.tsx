import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useRef } from "react";
import { motion, useScroll, useTransform, MotionValue } from "framer-motion";
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
  PieChart
} from "lucide-react";
import logoImage from "@/assets/logo.png";

interface ModuleCardProps {
  i: number;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  isNew?: boolean;
  progress: MotionValue<number>;
  range: [number, number];
  targetScale: number;
}

const ModuleCard: React.FC<ModuleCardProps> = ({
  i,
  title,
  description,
  icon: Icon,
  color,
  isNew,
  progress,
  range,
  targetScale,
}) => {
  const container = useRef(null);
  const { scrollYProgress } = useScroll({
    target: container,
    offset: ['start end', 'start start'],
  });

  const scale = useTransform(progress, range, [1, targetScale]);

  return (
    <div
      ref={container}
      className="h-[160px] flex items-center justify-center sticky top-20"
    >
      <motion.div
        style={{
          scale,
          top: `calc(80px + ${i * 25}px)`,
        }}
        className="flex flex-col items-center text-center relative w-full max-w-4xl p-8 rounded-3xl bg-[#0d1a2d] border border-white/10 shadow-2xl origin-top"
      >
        {isNew && (
          <span className="absolute top-5 left-5 px-3 py-1.5 text-sm font-medium bg-[#36d399] text-[#0A1526] rounded-full">
            חדש
          </span>
        )}
        
        <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center mb-4`}>
          <Icon className="h-8 w-8 text-white" />
        </div>
        
        <h3 className="text-2xl font-bold text-white mb-2">{title}</h3>
        <p className="text-white/60 text-base leading-relaxed max-w-md">{description}</p>
      </motion.div>
    </div>
  );
};

const Landing = () => {
  const modulesContainerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: modulesContainerRef,
    offset: ['start start', 'end end'],
  });

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
              <span className="text-xl font-bold text-white">AfterLead</span>
            </div>
            
            <nav className="hidden md:flex items-center gap-8">
              <a href="#multi-tenant" className="text-white/70 hover:text-white transition-colors">לעסקים</a>
              <a href="#modules" className="text-white/70 hover:text-white transition-colors">מודולים</a>
              <Link to="/privacy" className="text-white/70 hover:text-white transition-colors">פרטיות</Link>
            </nav>

            <div className="flex items-center gap-3">
              <Link to="/auth">
                <Button variant="ghost" className="text-white/70 hover:text-white hover:bg-white/10">
                  התחברות
                </Button>
              </Link>
              <Link to="/signup">
                <Button className="bg-[#36d399] hover:bg-[#36d399]/90 text-[#0A1526] font-semibold">
                  התחל בחינם
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-20 pb-32">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-[#36d399]/10 border border-[#36d399]/30 mb-10">
              <Sparkles className="h-5 w-5 text-[#36d399]" />
              <span className="text-lg md:text-xl font-medium text-[#36d399]">מערכת CRM לסוכנויות שיווק</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
              <span className="text-white">לצמוח </span>
              <span className="text-[#36d399]">בלי להשתעבד</span>
            </h1>

            {/* Subtitle */}
            <p className="text-xl md:text-2xl text-white/60 mb-10 max-w-2xl mx-auto leading-relaxed">
              ניהול לידים, לקוחות, משימות ואוטומציות - הכל במקום אחד.
              <br />
              <span className="text-white/40">בנוי במיוחד עבור סוכנויות שיווק.</span>
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/signup">
                <Button size="lg" className="bg-[#36d399] hover:bg-[#36d399]/90 text-[#0A1526] font-semibold text-lg px-8 py-6 rounded-xl shadow-[0_0_40px_rgba(54,211,153,0.3)] hover:shadow-[0_0_60px_rgba(54,211,153,0.4)] transition-all">
                  התחל בחינם
                  <ArrowLeft className="mr-2 h-5 w-5" />
                </Button>
              </Link>
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
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#36d399]/10 rounded-full blur-[150px]" />
        
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

      {/* Modules Section - Stacked Cards with Framer Motion */}
      <section id="modules" className="relative pt-24 pb-96 bg-[#0d1a2d]">
        <div className="container mx-auto px-6">
          {/* Section Header */}
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              כל מה שצריך, <span className="text-[#36d399]">במקום אחד</span>
            </h2>
            <p className="text-white/50 text-lg max-w-xl mx-auto">
              מערכת מודולרית שמתאימה את עצמה לצרכים שלך
            </p>
            <div className="w-20 h-1 bg-gradient-to-r from-transparent via-[#36d399] to-transparent mx-auto mt-6" />
          </div>

          {/* Desktop: Stacked Cards with Framer Motion */}
          <div className="hidden md:block" ref={modulesContainerRef}>
            {modules.map((module, i) => {
              const targetScale = 1 - (modules.length - i) * 0.03;
              return (
                <ModuleCard
                  key={i}
                  i={i}
                  title={module.title}
                  description={module.description}
                  icon={module.icon}
                  color={module.color}
                  isNew={module.isNew}
                  progress={scrollYProgress}
                  range={[i * (1 / modules.length), 1]}
                  targetScale={targetScale}
                />
              );
            })}
          </div>

          {/* Mobile: Regular Grid */}
          <div className="md:hidden grid grid-cols-1 gap-4">
            {modules.map((module, index) => (
              <div 
                key={index}
                className="group relative p-5 rounded-2xl bg-white/5 border border-white/10 hover:border-[#36d399]/50 transition-all duration-300"
              >
                {module.isNew && (
                  <span className="absolute top-4 left-4 px-2 py-1 text-xs font-medium bg-[#36d399] text-[#0A1526] rounded-full">
                    חדש
                  </span>
                )}
                
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${module.color} flex items-center justify-center flex-shrink-0`}>
                    <module.icon className="h-6 w-6 text-white" />
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-1">{module.title}</h3>
                    <p className="text-white/50 text-xs leading-relaxed">{module.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
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
              <Link to="/signup">
                <Button size="lg" className="bg-[#36d399] hover:bg-[#36d399]/90 text-[#0A1526] font-semibold text-lg px-10 py-6 rounded-xl shadow-[0_0_40px_rgba(54,211,153,0.3)] hover:shadow-[0_0_60px_rgba(54,211,153,0.4)] transition-all">
                  התחל בחינם עכשיו
                  <ArrowLeft className="mr-2 h-5 w-5" />
                </Button>
              </Link>
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
    </div>
  );
};

export default Landing;
