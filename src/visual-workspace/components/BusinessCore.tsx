import { GlassPanel } from "./GlassPanel";
import { Sparkles, Users, ListTodo, Bot, AlertCircle, TrendingUp, ShieldAlert, Flame } from "lucide-react";

interface Props {
  data: {
    businessName: string;
    clientsActive: number;
    clientsAtRisk: number;
    tasksOpen: number;
    tasksUrgent: number;
    agentsActive: number;
    alerts: number;
    incomeMonth: number;
  };
  width: number;
  height: number;
}

export function BusinessCore({ data, width, height }: Props) {
  return (
    <GlassPanel
      className="overflow-hidden flex flex-col"
      style={{ width, height }}
    >
      {/* breathing aura */}
      <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-indigo-100/60 via-white to-violet-100/40 animate-[corepulse_4s_ease-in-out_infinite]" />
      <div className="pointer-events-none absolute -inset-8 rounded-full bg-indigo-300/20 blur-3xl animate-[corepulse_4s_ease-in-out_infinite]" />

      <div className="relative flex flex-col h-full p-6">
        <div className="flex items-center gap-2 text-indigo-600">
          <Sparkles className="h-4 w-4" />
          <span className="text-xs font-medium tracking-wide uppercase">Business Core</span>
        </div>
        <h2 className="mt-1 text-2xl font-bold text-slate-900 truncate">{data.businessName}</h2>

        <div className="mt-4 grid grid-cols-2 gap-3 flex-1 text-sm">
          <CoreStat icon={Users} label="לקוחות פעילים" value={data.clientsActive} />
          <CoreStat icon={ListTodo} label="משימות פתוחות" value={data.tasksOpen} />
          <CoreStat icon={Bot} label="אייג׳נטים פעילים" value={data.agentsActive} />
          <CoreStat icon={AlertCircle} label="התראות" value={data.alerts} tone={data.alerts ? "warn" : undefined} />
          <CoreStat icon={ShieldAlert} label="לקוחות בסיכון" value={data.clientsAtRisk} tone={data.clientsAtRisk ? "danger" : undefined} />
          <CoreStat icon={Flame} label="משימות דחופות" value={data.tasksUrgent} tone={data.tasksUrgent ? "warn" : undefined} />
        </div>

        {data.incomeMonth > 0 && (
          <div className="mt-3 flex items-center justify-between rounded-xl bg-emerald-50/70 border border-emerald-200/60 px-3 py-2">
            <div className="flex items-center gap-2 text-emerald-700">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs font-medium">הכנסות החודש</span>
            </div>
            <span className="text-sm font-bold text-emerald-800">₪{Math.round(data.incomeMonth).toLocaleString()}</span>
          </div>
        )}
      </div>
    </GlassPanel>
  );
}

function CoreStat({ icon: Icon, label, value, tone }: { icon: any; label: string; value: number; tone?: "warn" | "danger" }) {
  const toneClass =
    tone === "danger" ? "text-rose-600" : tone === "warn" ? "text-amber-600" : "text-slate-700";
  return (
    <div className="flex items-center gap-2 rounded-xl bg-white/70 border border-white/80 px-3 py-2">
      <Icon className={`h-4 w-4 ${toneClass}`} />
      <div className="flex flex-col leading-tight min-w-0">
        <span className="text-[10px] text-slate-500 truncate">{label}</span>
        <span className={`text-base font-bold ${toneClass}`}>{value}</span>
      </div>
    </div>
  );
}
