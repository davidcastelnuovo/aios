import { useParams, useNavigate } from "react-router-dom";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useAgency } from "@/contexts/AgencyContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  PenLine,
  Palette,
  Video,
  Search,
  Megaphone,
  BarChart2,
} from "lucide-react";
import { ClientSelector } from "@/components/marketing/ClientSelector";
import { CopywriterDepartment } from "@/components/marketing/departments/CopywriterDepartment";
import { DesignerDepartment } from "@/components/marketing/departments/DesignerDepartment";
import { VideoDepartment } from "@/components/marketing/departments/VideoDepartment";
import { SeoDepartment } from "@/components/marketing/departments/SeoDepartment";
import { CampaignsDepartment } from "@/components/marketing/departments/CampaignsDepartment";
import { AnalyticsDepartment } from "@/components/marketing/departments/AnalyticsDepartment";

// ─── Department registry ──────────────────────────────────────────────────────

interface DeptConfig {
  id: string;
  label: string;
  icon: typeof PenLine;
  color: string;
  textColor: string;
  tileGradient: string;
  description: string;
}

const DEPARTMENTS: DeptConfig[] = [
  {
    id: "copywriter",
    label: "קופירייטר",
    icon: PenLine,
    color: "bg-violet-500",
    textColor: "text-white",
    tileGradient: "from-violet-500 to-purple-600",
    description: "כתיבת תוכן שיווקי, קופי לפרסומות וטקסטים מותאמים",
  },
  {
    id: "designer",
    label: "מעצב גרפי",
    icon: Palette,
    color: "bg-pink-500",
    textColor: "text-white",
    tileGradient: "from-pink-500 to-rose-600",
    description: "עיצוב ויזואלים, פרומפטים לתמונות וזהות מותגית",
  },
  {
    id: "video",
    label: "יוצר סרטונים",
    icon: Video,
    color: "bg-orange-500",
    textColor: "text-white",
    tileGradient: "from-orange-500 to-red-500",
    description: "תכנון, יצירה ועריכת סרטונים לכל פלטפורמה",
  },
  {
    id: "seo",
    label: "SEO / GEO",
    icon: Search,
    color: "bg-emerald-500",
    textColor: "text-white",
    tileGradient: "from-emerald-500 to-teal-600",
    description: "אסטרטגיית מילות מפתח, תוכן מקודם ודירוג במנועי AI",
  },
  {
    id: "campaigns",
    label: "קמפיינר",
    icon: Megaphone,
    color: "bg-blue-500",
    textColor: "text-white",
    tileGradient: "from-blue-500 to-indigo-600",
    description: "ניהול קמפיינים ממומנים ב-Meta, Google ועוד",
  },
  {
    id: "analytics",
    label: "אנליסט",
    icon: BarChart2,
    color: "bg-amber-500",
    textColor: "text-white",
    tileGradient: "from-amber-500 to-yellow-600",
    description: "ניתוח ביצועים, תובנות נתונים והמלצות לשיפור",
  },
];

// ─── Main component ───────────────────────────────────────────────────────────

export default function MarketingDepartment() {
  const { tenantSlug, clientId, department } = useParams<{
    tenantSlug: string;
    clientId?: string;
    department?: string;
  }>();
  const navigate = useNavigate();
  const { tenant } = useCurrentTenant();
  const tenantId = tenant?.id;
  const { selectedAgency } = useAgency();

  const agencyId =
    selectedAgency && selectedAgency !== "all" ? selectedAgency : null;

  const handleSelectClient = (id: string) => {
    navigate(`/t/${tenantSlug}/marketing/${id}`);
  };

  const handleSelectDept = (deptId: string) => {
    navigate(`/t/${tenantSlug}/marketing/${clientId}/${deptId}`);
  };

  const deptProps = {
    clientId: clientId ?? "",
    tenantId: tenantId ?? "",
    agencyId,
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-background" dir="rtl">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="flex items-center gap-3 border-b bg-card/60 px-4 py-2 backdrop-blur shrink-0">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/t/${tenantSlug}`)}>
          <ArrowRight className="ml-1 h-4 w-4" />
          חזרה
        </Button>
        <h1 className="text-base font-semibold">מחלקת שיווק</h1>
        <div className="mx-2 h-5 w-px bg-border" />
        {tenantId && (
          <ClientSelector
            tenantId={tenantId}
            value={clientId ?? null}
            onChange={handleSelectClient}
            agencyId={agencyId}
          />
        )}
        {clientId && department && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={() => navigate(`/t/${tenantSlug}/marketing/${clientId}`)}
          >
            ← כל המחלקות
          </Button>
        )}
      </header>

      {/* ── Department tabs (when inside a dept) ────────────────────────────── */}
      {clientId && department && (
        <div className="flex items-end gap-1 px-4 pt-2 shrink-0 border-b border-border/40 overflow-x-auto">
          {DEPARTMENTS.map((d) => {
            const Icon = d.icon;
            const isActive = d.id === department;
            return (
              <button
                key={d.id}
                onClick={() => handleSelectDept(d.id)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-lg transition-all whitespace-nowrap border border-b-0",
                  isActive
                    ? `${d.color} ${d.textColor} border-transparent shadow-sm`
                    : "bg-card text-muted-foreground hover:text-foreground border-border/50"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {d.label}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
        {!clientId ? (
          <NoClientState agencyId={agencyId} />
        ) : !department ? (
          <LandingTiles onSelect={handleSelectDept} />
        ) : (
          <div className="flex flex-1 min-h-0">
            {department === "copywriter" && <CopywriterDepartment {...deptProps} />}
            {department === "designer" && <DesignerDepartment {...deptProps} />}
            {department === "video" && <VideoDepartment {...deptProps} />}
            {department === "seo" && <SeoDepartment {...deptProps} />}
            {department === "campaigns" && <CampaignsDepartment {...deptProps} />}
            {department === "analytics" && <AnalyticsDepartment {...deptProps} />}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── No client state ──────────────────────────────────────────────────────────

function NoClientState({ agencyId }: { agencyId: string | null }) {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-500 to-blue-600 shadow-lg">
          <Megaphone className="h-10 w-10 text-white" />
        </div>
        <h2 className="mb-2 text-3xl font-extrabold">מחלקת שיווק</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          בחר לקוח מהרשימה למעלה כדי להיכנס למחלקות השיווק
        </p>
        {agencyId && (
          <p className="text-xs text-muted-foreground/60">
            מציג לקוחות של הסוכנות הנבחרת בלבד
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Landing tiles ────────────────────────────────────────────────────────────

function LandingTiles({ onSelect }: { onSelect: (id: string) => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8 overflow-auto">
      <div className="mb-10 text-center">
        <h2 className="text-4xl font-extrabold tracking-tight">מחלקת שיווק</h2>
        <p className="mt-2 text-muted-foreground text-sm">בחר מחלקה להתחיל לעבוד</p>
      </div>

      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 max-w-3xl w-full">
        {DEPARTMENTS.map((dept) => {
          const Icon = dept.icon;
          return (
            <button
              key={dept.id}
              onClick={() => onSelect(dept.id)}
              className={cn(
                "group flex flex-col items-center justify-center rounded-2xl p-7 text-center text-white shadow-md transition-all hover:scale-[1.03] hover:shadow-xl",
                `bg-gradient-to-br ${dept.tileGradient}`
              )}
            >
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                <Icon className="h-7 w-7" />
              </div>
              <span className="text-lg font-bold">{dept.label}</span>
              <span className="mt-1.5 text-xs opacity-80 leading-snug">{dept.description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
