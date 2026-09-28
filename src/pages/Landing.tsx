import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { resolveAppHomePath } from "@/lib/appHomePath";
import { Button } from "@/components/ui/button";
import OptionsSelector from "@/components/OptionsSelector";
import AnimatedJoinButton from "@/components/AnimatedJoinButton";
import DemoRequestDialog from "@/components/DemoRequestDialog";
import { CarmenWorkingScene } from "@/components/shared/CarmenLoadingScreen";
import {
  Sparkles,
  Download,
  ArrowLeft,
  Handshake,
  Layers,
  TrendingUp,
  UserCircle2,
  Briefcase,
  Cpu,
} from "lucide-react";
import logoImage from "@/assets/logo.png";

const WAITLIST_CTA = "הרשמה לבטא של כרמן";

const howItWorksSteps = [
  {
    icon: Handshake,
    title: "שותפות עם הבעלים",
    description:
      "כרמן עובדת איתך ובעלות המקצוע — לא במקומכם. יחד מגדירים יעדי צמיחה, סדר עדיפויות ומה success נראה אצלכם.",
  },
  {
    icon: Briefcase,
    title: "ניהול מלא + אנשי מקצוע",
    description:
      "כרמן מתזמרת קמפיינים, תוכן, SEO, קריאייטיב ועוד — עם צוות מומחים שמבצע, והיא שומרת על קו אחיד ודיווח שקוף.",
  },
  {
    icon: Cpu,
    title: "מערכת AIOS ברקע",
    description:
      "לידים, משימות, אוטומציות, דוחות ו-WhatsApp — לא עוד כלים מפוזרים. הכל רץ על מערכת ההפעלה שכרמן מפעילה עבור העסק.",
  },
];

const Landing = () => {
  const navigate = useNavigate();
  const [waitlistDialogOpen, setWaitlistDialogOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isAppInstalled, setIsAppInstalled] = useState(false);

  const openWaitlist = () => setWaitlistDialogOpen(true);

  useEffect(() => {
    let cancelled = false;

    const redirectIfSignedIn = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user || cancelled) return;
      const homePath = await resolveAppHomePath(session.user.id);
      if (homePath && !cancelled) {
        navigate(homePath, { replace: true });
      }
    };

    void redirectIfSignedIn();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        void resolveAppHomePath(session.user.id).then((homePath) => {
          if (homePath && !cancelled) navigate(homePath, { replace: true });
        });
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [navigate]);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsAppInstalled(true);
    }
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === "accepted") setIsAppInstalled(true);
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

  return (
    <div className="min-h-screen bg-[#0A1526] text-white overflow-x-hidden">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[#36d399]/10 rounded-full blur-[150px] -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-[#36d399]/5 rounded-full blur-[120px] translate-y-1/2 -translate-x-1/3" />
        <div className="absolute top-1/2 left-1/2 w-[400px] h-[400px] bg-[#36d399]/5 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2" />
      </div>

      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#0A1526]/80 border-b border-white/5">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <img src={logoImage} alt="AIOS" className="h-10 w-auto shrink-0" />
              <div className="min-w-0 leading-tight">
                <div className="text-lg font-bold truncate">כרמן</div>
                <div className="text-xs text-white/50 truncate hidden sm:block">
                  Marketing Agency OS
                </div>
              </div>
            </div>

            <nav className="hidden lg:flex items-center gap-6 text-sm text-white/60">
              <a href="#how-it-works" className="hover:text-white transition-colors">
                איך זה עובד
              </a>
              <a href="#capabilities" className="hover:text-white transition-colors">
                יכולות המערכת
              </a>
              <a href="#about" className="hover:text-white transition-colors">
                מי מאחורי כרמן
              </a>
            </nav>

            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {!isAppInstalled && (
                <Button
                  variant="ghost"
                  className="text-white/70 hover:text-white hover:bg-white/10 gap-2 hidden sm:flex"
                  onClick={handleInstallApp}
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden md:inline">התקן אפליקציה</span>
                </Button>
              )}
              <Link to="/auth">
                <Button
                  variant="ghost"
                  className="text-white/70 hover:text-white hover:bg-white/10"
                >
                  התחברות
                </Button>
              </Link>
              <Button
                onClick={openWaitlist}
                className="bg-[#36d399] hover:bg-[#36d399]/90 text-[#0A1526] font-semibold hidden sm:inline-flex"
              >
                {WAITLIST_CTA}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <section className="relative pt-16 pb-20 md:pt-20 md:pb-28">
        <div className="container mx-auto px-6">
          <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div className="text-center lg:text-right order-2 lg:order-1">
              <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-[#36d399]/10 border border-[#36d399]/30 mb-8">
                <Sparkles className="h-5 w-5 text-[#36d399]" />
                <span className="text-sm md:text-base font-medium text-[#36d399]">
                  Marketing Agency OS · מערכת AIOS
                </span>
              </div>

              <h1 className="text-4xl md:text-5xl xl:text-6xl font-bold mb-6 leading-tight">
                <span className="text-white">מנהלת השיווק שלך </span>
                <span className="text-[#36d399]">לצמיחה אמיתית</span>
              </h1>

              <p className="text-lg md:text-xl text-white/60 mb-8 leading-relaxed max-w-xl mx-auto lg:mx-0 lg:mr-0">
                כרמן נותנת מענה מלא לעסקים שרוצים לשגשג — שותפות מלאה עם הבעלים,
                ניהול שוטף עם אנשי מקצוע, ומערכת הפעלה חכמה שמחברת הכל.
              </p>

              <div className="max-w-xl mx-auto lg:mx-0 mb-10 px-5 py-4 rounded-2xl bg-white/5 border border-white/10 text-right">
                <p className="text-white/70 text-base leading-relaxed">
                  <span className="text-[#36d399] font-semibold">היעד:</span> לעזור לעסקים
                  לצמוח עד{" "}
                  <span className="text-white font-medium">פי 10</span> תוך שנה עד שלוש —
                  לפי בשלות לסקייל ומורכבות השירות או המוצר.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
                <AnimatedJoinButton
                  text={WAITLIST_CTA}
                  hoverText="נתראה בבטא!"
                  width={300}
                  onClick={openWaitlist}
                />
                <Link to="/auth">
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-white/40 bg-white/10 text-white font-semibold hover:bg-white/20 text-base px-6 py-6 rounded-xl backdrop-blur-sm gap-2"
                  >
                    יש לי חשבון
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>

            <div className="order-1 lg:order-2 flex justify-center">
              <div className="w-full max-w-md">
                <CarmenWorkingScene size="lg" />
                <p className="text-center text-sm text-white/40 mt-4">
                  כרמן — מנהלת שיווק שמתזמרת מומחים ו-AIOS
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="relative py-20 md:py-28 scroll-mt-24">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 mb-4">
              <Layers className="h-4 w-4 text-[#36d399]" />
              <span className="text-sm text-white/70">שילוב אחד</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              סגנון סוכנות. כוח של מערכת. כרמן במרכז.
            </h2>
            <p className="text-white/50 text-lg leading-relaxed">
              לא עוד CRM נפרד מסוכנות נפרדת. מוצר אחד: כרמן מנהלת את השיווק,
              הצוות מבצע, ו-AIOS מחזיק את התשתית.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {howItWorksSteps.map((step) => (
              <div
                key={step.title}
                className="p-8 rounded-3xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10"
              >
                <div className="w-12 h-12 rounded-xl bg-[#36d399]/15 flex items-center justify-center mb-5">
                  <step.icon className="h-6 w-6 text-[#36d399]" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{step.title}</h3>
                <p className="text-white/55 text-sm leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="capabilities" className="relative scroll-mt-24">
        <div className="container mx-auto px-6 pt-8 pb-4">
          <div className="max-w-3xl mx-auto text-center mb-2">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#36d399]/10 border border-[#36d399]/20 mb-4">
              <TrendingUp className="h-4 w-4 text-[#36d399]" />
              <span className="text-sm text-[#36d399]">מה כרמן מפעילה</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
              יכולות המערכת שמניעות את הצמיחה
            </h2>
            <p className="text-white/50 text-lg">
              אותה תשתית AIOS — מוצגת דרך ניהול השיווק של כרמן. מחירים וחבילות — בהמשך.
            </p>
          </div>
        </div>
        <OptionsSelector />
      </section>

      <section id="about" className="relative py-20 md:py-28 scroll-mt-24">
        <div className="container mx-auto px-6">
          <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12 items-center">
            <div className="relative rounded-3xl overflow-hidden border border-white/10 aspect-[4/3] bg-white/5">
              <img
                src="/command-center/ghost-carmen.png"
                alt=""
                className="absolute inset-0 w-full h-full object-cover opacity-90"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0A1526] via-transparent to-transparent" />
            </div>
            <div className="text-right">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 mb-4">
                <UserCircle2 className="h-4 w-4 text-[#36d399]" />
                <span className="text-sm text-white/70">אודות</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                מי מאחורי כרמן · מי בנה אותה
              </h2>
              <p className="text-white/55 text-lg leading-relaxed mb-4">
                כאן יעלו הסרטונים, הסיפור המקצועי וכל מה שעד היום הופיע תחת Marketing
                Captain ותחת הבונים — כדי שתדעו מי עומד מאחורי המוצר ומי מפעיל את רשת
                המומחים.
              </p>
              <p className="text-white/40 text-sm">
                (תוכן מלא — בשלב ההעברה הבא; המבנה והניווט כבר מוכנים.)
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="relative py-24">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center p-12 rounded-3xl bg-gradient-to-br from-[#36d399]/20 to-[#36d399]/5 border border-[#36d399]/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-[#36d399]/20 rounded-full blur-[60px]" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#36d399]/10 rounded-full blur-[40px]" />

            <div className="relative">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                רוצים גישה מוקדמת?
              </h2>
              <p className="text-white/60 text-lg mb-8">
                הירשמו לרשימת המתנה לבטא של כרמן — נעדכן כשהדלת נפתחת.
              </p>
              <AnimatedJoinButton
                text={WAITLIST_CTA}
                hoverText="נתראה בבטא!"
                width={300}
                onClick={openWaitlist}
              />
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/5 py-12">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <img src={logoImage} alt="AIOS" className="h-8 w-auto" />
              <div>
                <div className="text-lg font-semibold text-white">כרמן · AIOS</div>
                <div className="text-xs text-white/40">Marketing Agency OS</div>
              </div>
            </div>

            <div className="flex items-center gap-6 text-sm">
              <a href="#about" className="text-white/50 hover:text-white transition-colors">
                אודות
              </a>
              <Link to="/privacy" className="text-white/50 hover:text-white transition-colors">
                מדיניות פרטיות
              </Link>
              <Link to="/terms" className="text-white/50 hover:text-white transition-colors">
                תנאי שימוש
              </Link>
              <a
                href="mailto:support@aios.co.il"
                className="text-white/50 hover:text-white transition-colors"
              >
                צור קשר
              </a>
            </div>

            <div className="text-white/30 text-sm text-center md:text-left">
              © {new Date().getFullYear()} AIOS. כל הזכויות שמורות.
            </div>
          </div>
        </div>
      </footer>

      <DemoRequestDialog open={waitlistDialogOpen} onOpenChange={setWaitlistDialogOpen} />
    </div>
  );
};

export default Landing;
