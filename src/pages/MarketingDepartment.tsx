import { lazy, Suspense, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { ClientSelector } from "@/components/marketing/ClientSelector";
import { ALL_CLIENTS_FILTER, clientFilterToParam, parseClientFilter } from "@/components/marketing/clientFilter";
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

const CopyDepartment = lazy(() =>
  import("@/components/marketing/departments/CopyDepartment").then((module) => ({ default: module.CopyDepartment })),
);
const CreativeDepartment = lazy(() =>
  import("@/components/marketing/departments/CreativeDepartment").then((module) => ({ default: module.CreativeDepartment })),
);
const SeoGeoDepartment = lazy(() =>
  import("@/components/marketing/departments/SeoGeoDepartment").then((module) => ({ default: module.SeoGeoDepartment })),
);

type DepartmentId = "copy" | "creative" | "seo" | "campaigns" | "analytics";

const DEPARTMENTS: Array<{
  id: DepartmentId;
  label: string;
  tab: string;
  description: string;
  icon: typeof PenLine;
  gradient: string;
  status: "active" | "next" | "existing";
}> = [
  {
    id: "copy",
    label: "מחלקת קופי",
    tab: "קופי",
    description: "פרויקטי קופי, צ'אט עם כרמן ועורך חי",
    icon: PenLine,
    gradient: "from-violet-500 to-purple-700",
    status: "active",
  },
  {
    id: "creative",
    label: "מחלקת קריאייטיב",
    tab: "קריאייטיב",
    description: "בריף, וריאציות ויזואליות, שכבות טקסט ואישור",
    icon: Palette,
    gradient: "from-pink-500 to-rose-700",
    status: "active",
  },
  {
    id: "seo",
    label: "מחלקת SEO / GEO",
    tab: "SEO / GEO",
    description: "מחקר ביטויים, תוכנית תוכן, מאמרים ונראות במנועי AI",
    icon: Search,
    gradient: "from-emerald-500 to-teal-700",
    status: "active",
  },
  {
    id: "campaigns",
    label: "מחלקת קמפיינים",
    tab: "קמפיינים",
    description: "מבנה קמפיין, קהלים, מודעות, תקציב והכנה לפרסום",
    icon: Megaphone,
    gradient: "from-blue-500 to-indigo-700",
    status: "next",
  },
  {
    id: "analytics",
    label: "מחלקת אנליטיקה",
    tab: "אנליטיקה",
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
  const [searchParams] = useSearchParams();
  const { tenant } = useCurrentTenant();
  const tenantId = tenant?.id;
  const selectedClientId = searchParams.get("client") ?? clientId;
  const clientFilter = parseClientFilter(selectedClientId === clientId ? clientId : searchParams.get("client"));

  useEffect(() => {
    if (clientId && department) navigate(`/t/${tenantSlug}/marketing/department/${department}?client=${clientId}`, { replace: true });
  }, [clientId, department, navigate, tenantSlug]);

  const selectClient = (id: string | null) => {
    const param = clientFilterToParam(id);
    const suffix = param ? `?client=${param}` : "";
    if (department) navigate(`/t/${tenantSlug}/marketing/department/${department}${suffix}`);
    else navigate(`/t/${tenantSlug}/marketing${suffix}`);
  };
  const selectDepartment = (id: DepartmentId) => {
    if (id === "analytics") {
      navigate(`/t/${tenantSlug}/dynamic-tables`);
      return;
    }
    const param = clientFilterToParam(clientFilter);
    navigate(`/t/${tenantSlug}/marketing/department/${id}${param ? `?client=${param}` : ""}`);
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-background" dir="rtl">
      <header className="flex shrink-0 items-stretch gap-2 border-b bg-card/70 px-3 backdrop-blur">
        <Button variant="ghost" size="sm" className="my-1.5 shrink-0" onClick={() => navigate(`/t/${tenantSlug}`)}>
          <ArrowRight className="ml-1 h-4 w-4" />
          חזרה
        </Button>
        <button
          type="button"
          className={cn(
            "my-1.5 shrink-0 rounded-md px-2 text-base font-semibold transition-colors",
            !department ? "text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => {
            const param = clientFilterToParam(clientFilter);
            navigate(`/t/${tenantSlug}/marketing${param ? `?client=${param}` : ""}`);
          }}
        >
          שיווק
        </button>
        <div className="mx-1 my-auto h-5 w-px shrink-0 bg-border" />
        <nav className="-mb-px flex min-w-0 flex-1 items-stretch overflow-x-auto" aria-label="מחלקות">
          {DEPARTMENTS.map((item) => {
            const Icon = item.icon;
            const active = department === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectDepartment(item.id)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 text-sm transition-colors",
                  active
                    ? "border-foreground font-semibold text-foreground"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.tab}
              </button>
            );
          })}
        </nav>
        {department && tenantId && (
          <>
            <div className="mx-1 my-auto h-5 w-px shrink-0 bg-border" />
            <div className="my-1.5 flex shrink-0 items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">תצוגה:</span>
              <ClientSelector
                tenantId={tenantId}
                value={clientFilter}
                onChange={selectClient}
                allowGeneral
                allowAllClients
                generalLabel="תוכן כללי"
                allClientsLabel="כל הלקוחות"
              />
            </div>
          </>
        )}
      </header>

      {!department ? (
        <DepartmentLanding onSelect={selectDepartment} />
      ) : department === "copy" && tenantId ? (
        <Suspense fallback={<div className="flex flex-1 items-center justify-center"><Sparkles className="h-7 w-7 animate-pulse text-violet-500" /></div>}>
          <div className="flex min-h-0 flex-1">
            <CopyDepartment clientFilter={clientFilter} tenantId={tenantId} onClientChange={selectClient} />
          </div>
        </Suspense>
      ) : department === "creative" && tenantId ? (
        <Suspense fallback={<div className="flex flex-1 items-center justify-center"><Sparkles className="h-7 w-7 animate-pulse text-pink-500" /></div>}>
          <CreativeDepartment clientFilter={clientFilter} tenantId={tenantId} onClientChange={selectClient} />
        </Suspense>
      ) : department === "seo" && tenantId ? (
        <Suspense fallback={<div className="flex flex-1 items-center justify-center"><Sparkles className="h-7 w-7 animate-pulse text-emerald-500" /></div>}>
          <SeoGeoDepartment clientFilter={clientFilter} tenantId={tenantId} />
        </Suspense>
      ) : (
        <ComingSoon department={department} onBack={() => navigate(`/t/${tenantSlug}/marketing`)} />
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
