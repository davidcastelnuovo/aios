import { cn } from "@/lib/utils";
import type { AgentRole, AgentState } from "../types/visualWorkspaceTypes";

interface Props {
  role: AgentRole;
  state?: AgentState;
  size?: number;
  className?: string;
}

const ACCESSORY: Record<AgentRole, JSX.Element> = {
  ceo: <g><polygon points="40,12 43,20 51,20 45,25 47,33 40,28 33,33 35,25 29,20 37,20" fill="hsl(45 95% 55%)" /></g>,
  marketing: <g><rect x="50" y="40" width="14" height="8" rx="2" fill="hsl(280 70% 60%)" /><polygon points="64,40 72,36 72,52 64,48" fill="hsl(280 70% 60%)" /></g>,
  sales: <g><rect x="52" y="42" width="10" height="14" rx="2" fill="hsl(20 90% 55%)" /><circle cx="57" cy="48" r="1.5" fill="white" /></g>,
  finance: <g><rect x="50" y="42" width="14" height="14" rx="2" fill="hsl(150 50% 45%)" /><line x1="53" y1="46" x2="61" y2="46" stroke="white" strokeWidth="1" /><line x1="53" y1="50" x2="58" y2="50" stroke="white" strokeWidth="1" /></g>,
  dev: <g><rect x="48" y="48" width="18" height="6" rx="1" fill="hsl(200 60% 45%)" /><rect x="50" y="50" width="2" height="2" fill="white" /><rect x="54" y="50" width="2" height="2" fill="white" /><rect x="58" y="50" width="2" height="2" fill="white" /><rect x="62" y="50" width="2" height="2" fill="white" /></g>,
  creative: <g><rect x="50" y="42" width="12" height="16" rx="2" fill="hsl(330 70% 65%)" /><circle cx="56" cy="50" r="2" fill="white" /></g>,
  customer_success: <g><path d="M48 38 Q48 32 54 32 L58 32 Q64 32 64 38 L64 44" stroke="hsl(180 50% 45%)" strokeWidth="2" fill="none" /><circle cx="48" cy="46" r="3" fill="hsl(180 50% 45%)" /><circle cx="64" cy="46" r="3" fill="hsl(180 50% 45%)" /></g>,
  system: <g><rect x="50" y="44" width="14" height="3" rx="1" fill="hsl(220 10% 45%)" transform="rotate(45 57 45)" /><circle cx="50" cy="50" r="3" fill="hsl(220 10% 45%)" /></g>,
};

export function AgentAvatar({ role, state = "idle", size = 80, className }: Props) {
  const isWorking = state === "working";
  const isError = state === "error";
  const isCompleted = state === "completed";
  const isWaiting = state === "waiting";
  const isOverloaded = state === "overloaded";

  return (
    <div className={cn("relative inline-block", className)} style={{ width: size, height: size }}>
      {isOverloaded && (
        <>
          <div className="absolute -top-1 -left-1 h-3 w-3 rounded-full bg-amber-300/80 animate-pulse" />
          <div className="absolute top-0 right-0 h-3 w-3 rounded-full bg-amber-400/80 animate-pulse" style={{ animationDelay: "200ms" }} />
          <div className="absolute -bottom-1 left-2 h-3 w-3 rounded-full bg-amber-500/80 animate-pulse" style={{ animationDelay: "400ms" }} />
        </>
      )}

      <svg viewBox="0 0 80 100" width={size} height={size} className={cn("drop-shadow-sm", isWorking && "animate-[wiggle_1.4s_ease-in-out_infinite]")}>
        {/* body */}
        <ellipse cx="40" cy="78" rx="22" ry="14" fill="white" stroke="hsl(220 15% 80%)" strokeWidth="1.5" />
        {/* lab coat collar */}
        <path d="M22 70 L40 60 L58 70 L52 80 L28 80 Z" fill="white" stroke="hsl(220 15% 75%)" strokeWidth="1" />
        {/* head */}
        <circle cx="40" cy="42" r="20" fill="hsl(45 35% 88%)" stroke="hsl(35 30% 60%)" strokeWidth="1.2" />
        {/* goggles */}
        <circle cx="33" cy="42" r="6" fill="hsl(200 80% 70% / 0.4)" stroke="hsl(220 30% 35%)" strokeWidth="1.5" />
        <circle cx="47" cy="42" r="6" fill="hsl(200 80% 70% / 0.4)" stroke="hsl(220 30% 35%)" strokeWidth="1.5" />
        <line x1="39" y1="42" x2="41" y2="42" stroke="hsl(220 30% 35%)" strokeWidth="1.5" />
        {/* mouth */}
        {isError ? (
          <path d="M35 52 Q40 48 45 52" stroke="hsl(0 70% 50%)" strokeWidth="1.5" fill="none" />
        ) : isCompleted ? (
          <path d="M35 50 Q40 56 45 50" stroke="hsl(150 60% 40%)" strokeWidth="1.5" fill="none" />
        ) : (
          <line x1="36" y1="52" x2="44" y2="52" stroke="hsl(220 20% 40%)" strokeWidth="1.2" strokeLinecap="round" />
        )}
        {/* role accessory */}
        {ACCESSORY[role]}
      </svg>

      {/* state badge */}
      {isError && (
        <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-rose-500 text-white text-[11px] font-bold flex items-center justify-center shadow">!</div>
      )}
      {isCompleted && (
        <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-emerald-500 text-white text-[10px] flex items-center justify-center shadow">✓</div>
      )}
      {isWaiting && (
        <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-amber-400 text-white text-[10px] flex items-center justify-center shadow">⚑</div>
      )}
      {isWorking && (
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
          <span className="h-1 w-1 rounded-full bg-sky-500 animate-bounce" />
          <span className="h-1 w-1 rounded-full bg-sky-500 animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="h-1 w-1 rounded-full bg-sky-500 animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      )}
    </div>
  );
}
