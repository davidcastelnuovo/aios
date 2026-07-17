import { lazy, Suspense } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  PenLine,
  Palette,
  Search,
  Megaphone,
  BarChart3,
  Sparkles,
} from "lucide-react";
import { ClientSelector } from "@/components/marketing/ClientSelector";

const CopyDepartment = lazy(() =>
  import("@/components/marketing/departments/CopyDepartment").then((module) => ({ default: module.CopyDepartment })),
);

type DepartmentId = "copy" | "creative" | "seo" | "campaigns" | "analytics";

const DEPARTMENTS: Array<{
  id: DepartmentId;
  label: string;
  description: string;
  icon: typeof PenLine;
  gradient: string;
  status: "active" | "next" | "existing";
}> = [
  {
    id: "copy",
    label: "מחלקת קופי",
    description: "בריף נכנס, פוסטים, תסריטי מודעות, גרסאות ואישור",
    icon: PenLine,
    gradient: "from-violet-500 to-purple-700",
    status: "active",
  },
  {
    id: "creative",
    label: "מחלקת קריאייטיב",
    description: "קונספטים, storyboard, גרפיקה וסרטונים במקום אחד",
    icon: Palette,
    gradient: "from-pink-500 to-rose-700",
    status: "next",
  },
  {
    id: "seo",
    label: "מחלקת SEO / GEO",
    description: "מחקר ביטויים, תוכנית תוכן, מאמרים ונראות במנועי AI",
    icon: Search,
    gradient: "from-emerald-500 to-teal-700",
    status: "next",
  },
  {
    id: "campaigns",
    label: "מחלקת קמפיינים",
    description: "מבנה קמפיין, קהלים, מודעות, תקציב והכנה לפרסום",
    icon: Megaphone,
    gradient: "from-blue-500 to-indigo-700",
    status: "next",
  },
  {
    id: "analytics",
    label: "מחלקת אנליטיקה",
    description: "כניסה לדשבורדים ולדוחות שכבר מחוברים למערכת",
    icon: BarChart3,
    gradient: "from-amber-500 to-orange-700",
    status: "existing",
  },
];

export default function MarketingDepartment() {
  const { tenantSlug, clientId, department } = useParams<{
    tenantSlug: string;
    clientId?: string;
    department?: DepartmentId;
  }>();
  const navigate = useNavigate();
  const { tenant } = useCurrentTenant();
  const tenantId = tenant?.id;

  const selectClient = (id: string) => navigate(`/t/${tenantSlug}/marketing/${id}`);
  const selectDepartment = (id: DepartmentId) => {
    if (id === "analytics") {
      navigate(`/t/${tenantSlug}/dynamic-tables`);
      return;
    }
    navigate(`/t/${tenantSlug}/marketing/${clientId}/${id}`);
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-background" dir="rtl">
      <header className="flex shrink-0 items-center gap-3 border-b bg-card/70 px-4 py-2 backdrop-blur">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/t/${tenantSlug}`)}>
          <ArrowRight className="ml-1 h-4 w-4" />
          חזרה
        </Button>
        <h1 className="text-base font-semibold">מחלקת שיווק</h1>
        <div className="mx-2 h-5 w-px bg-border" />
        {tenantId && (
          <ClientSelector tenantId={tenantId} value={clientId ?? null} onChange={selectClient} />
        )}
        {clientId && department && (
          <Button
            variant="ghost"
            size="sm"
            className="mr-auto text-xs text-muted-foreground"
            onClick={() => navigate(`/t/${tenantSlug}/marketing/${clientId}`)}
          >
            כל המחלקות
          </Button>
        )}
      </header>

      {!clientId ? (
        <div className="flex flex-1 items-center justify-center p-8 text-center">
          <div>
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-500 to-blue-600 shadow-xl">
              <Sparkles className="h-10 w-10 text-white" />
            </div>
            <h2 className="text-3xl font-black">בחר לקוח כדי להתחיל</h2>
            <p className="mt-2 text-sm text-muted-foreground">כל מחלקה מקבלת את הידע, הבריפים והתוצרים של הלקוח.</p>
          </div>
        </div>
      ) : !department ? (
        <DepartmentLanding onSelect={selectDepartment} />
      ) : department === "copy" && tenantId ? (
        <Suspense fallback={<div className="flex flex-1 items-center justify-center"><Sparkles className="h-7 w-7 animate-pulse text-violet-500" /></div>}>
          <CopyDepartment clientId={clientId} tenantId={tenantId} />
        </Suspense>
      ) : (
        <ComingSoon department={department} onBack={() => navigate(`/t/${tenantSlug}/marketing/${clientId}`)} />
      )}
    </div>
  );
}

function DepartmentLanding({ onSelect }: { onSelect: (id: DepartmentId) => void }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center overflow-auto p-6 md:p-10">
      <div className="mb-8 text-center">
        <Badge variant="outline" className="mb-3 gap-1.5"><Sparkles className="h-3.5 w-3.5" />Carmen Marketing Studio</Badge>
        <h2 className="text-4xl font-black tracking-tight">איזו מחלקה עובדת עכשיו?</h2>
        <p className="mt-2 text-sm text-muted-foreground">לא פס ייצור. סביבת עבודה מקצועית לכל תחום.</p>
      </div>
      <div className="grid w-full max-w-5xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {DEPARTMENTS.map((department) => {
          const Icon = department.icon;
          return (
            <Card
              key={department.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(department.id)}
              onKeyDown={(event) => event.key === "Enter" && onSelect(department.id)}
              className={cn(
                "group relative min-h-48 cursor-pointer overflow-hidden border-0 p-0 text-white shadow-lg transition-all hover:-translate-y-1 hover:shadow-2xl",
                `bg-gradient-to-br ${department.gradient}`,
              )}
            >
              <div className="absolute -left-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
              <div className="relative flex h-full flex-col p-6">
                <div className="mb-6 flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
                    <Icon className="h-6 w-6" />
                  </div>
                  {department.status === "active" && <Badge className="bg-white/20 text-white hover:bg-white/20">פעיל</Badge>}
                  {department.status === "next" && <Badge className="bg-black/15 text-white hover:bg-black/15">הבא בתור</Badge>}
                  {department.status === "existing" && <Badge className="bg-white/20 text-white hover:bg-white/20">דוחות קיימים</Badge>}
                </div>
                <h3 className="text-xl font-black">{department.label}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/80">{department.description}</p>
                <span className="mt-auto pt-5 text-xs font-semibold opacity-0 transition-opacity group-hover:opacity-100">כניסה למחלקה ←</span>
              </div>
            </Card>
          );
        })}
      </div>
    </main>
  );
}

function ComingSoon({ department, onBack }: { department: DepartmentId; onBack: () => void }) {
  const config = DEPARTMENTS.find((item) => item.id === department);
  const Icon = config?.icon ?? Sparkles;
  return (
    <div className="flex flex-1 items-center justify-center text-center">
      <div>
        <Icon className="mx-auto mb-3 h-12 w-12 text-muted-foreground/40" />
        <h2 className="text-xl font-bold">{config?.label}</h2>
        <p className="mt-2 text-sm text-muted-foreground">המחלקה הבאה שנבנה כמערכת עצמאית.</p>
        <Button className="mt-5" variant="outline" onClick={onBack}>חזרה למחלקות</Button>
      </div>
    </div>
  );
}
