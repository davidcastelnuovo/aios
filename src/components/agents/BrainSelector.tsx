import { useAiModels, useConnectedAiModels, type AiModel } from "@/hooks/useAiModels";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Brain, Sparkles, Zap, AlertTriangle, ExternalLink } from "lucide-react";
import { useTenantPath } from "@/hooks/useTenantPath";
import { useNavigate } from "react-router-dom";

interface BrainSelectorProps {
  value: string | null;
  onChange: (engineAlias: string) => void;
  disabled?: boolean;
  /** When true — shows all catalog models (not just connected ones). Default: false */
  showAll?: boolean;
}

const FAMILY_LABEL: Record<string, string> = {
  google: "🔵 Google (Gemini)",
  openai: "🟢 OpenAI (GPT)",
  anthropic: "🟠 Anthropic (Claude)",
  manus: "🤖 Manus AI",
};

function ModelItem({ m }: { m: AiModel }) {
  return (
    <div className="flex items-center gap-2">
      <span>{m.label}</span>
      {m.isLatest && (
        <Badge variant="secondary" className="h-4 px-1 text-[10px]">
          <Sparkles className="h-2.5 w-2.5 mr-0.5" /> חדש
        </Badge>
      )}
      {m.cheap && (
        <Badge variant="outline" className="h-4 px-1 text-[10px]">
          <Zap className="h-2.5 w-2.5 mr-0.5" /> זול
        </Badge>
      )}
      {m.recommended && (
        <Badge className="h-4 px-1 text-[10px] bg-primary/10 text-primary border-0">
          מומלץ
        </Badge>
      )}
    </div>
  );
}

export function BrainSelector({ value, onChange, disabled, showAll = false }: BrainSelectorProps) {
  const { buildPath } = useTenantPath();
  const navigate = useNavigate();

  // Connected models (filtered by configured API keys)
  const { data: connectedModels = [], isLoading: connLoading, connected } = useConnectedAiModels();
  // Full catalog (for fallback display of current value)
  const { data: allModels = [], isLoading: allLoading } = useAiModels();

  const isLoading = connLoading || allLoading;

  // Which list to show in the dropdown
  const displayModels = showAll ? allModels : connectedModels;
  const noProviders = !isLoading && connectedModels.length === 0;

  // Group by family
  const byFamily = displayModels.reduce<Record<string, AiModel[]>>((acc, m) => {
    (acc[m.family] ||= []).push(m);
    return acc;
  }, {});

  // Resolve current display value (match alias or full id from full catalog)
  const current = allModels.find((m) => m.alias === value || m.id === value);
  const selectedValue = current ? (current.alias || current.id) : value || "";

  // If the current engine's provider is not connected, show a warning
  const currentProviderConnected =
    !current ||
    (current.family === "google" && connected?.google) ||
    (current.family === "openai" && connected?.openai) ||
    (current.family === "anthropic" && connected?.anthropic) ||
    (current.family === "manus" && connected?.manus);

  return (
    <div className="space-y-1.5" dir="rtl">
      <div className="flex items-center gap-2 rounded-lg border bg-card p-2">
        <Brain className="h-4 w-4 text-primary shrink-0" />
        <span className="text-xs text-muted-foreground shrink-0">מוח:</span>
        <Select
          value={selectedValue}
          onValueChange={onChange}
          disabled={disabled || isLoading || (noProviders && !showAll)}
        >
          <SelectTrigger className="h-8 border-0 focus:ring-0 focus:ring-offset-0 shadow-none flex-1">
            <SelectValue
              placeholder={
                isLoading
                  ? "טוען מודלים..."
                  : noProviders && !showAll
                  ? "אין ספק מחובר"
                  : "בחר מוח"
              }
            />
          </SelectTrigger>
          <SelectContent className="max-h-[400px]">
            {Object.entries(byFamily).map(([family, list]) => (
              <SelectGroup key={family}>
                <SelectLabel className="text-xs">
                  {FAMILY_LABEL[family] ?? family}
                </SelectLabel>
                {list.map((m) => (
                  <SelectItem key={m.id} value={m.alias || m.id}>
                    <ModelItem m={m} />
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
            {!isLoading && displayModels.length === 0 && (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                אין מודלים זמינים
              </div>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Warning: current engine's provider not connected */}
      {!isLoading && !currentProviderConnected && current && (
        <div className="flex items-center gap-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>
            ספק {FAMILY_LABEL[current.family] ?? current.family} לא מחובר —{" "}
            <button
              type="button"
              className="underline hover:no-underline font-medium"
              onClick={() => navigate(buildPath("/llm-settings"))}
            >
              חבר מפתח API
            </button>
          </span>
        </div>
      )}

      {/* Warning: no providers at all */}
      {!isLoading && noProviders && !showAll && (
        <div className="flex items-center justify-between gap-2 rounded-md bg-muted/60 border px-3 py-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
            <span>לא מחובר אף ספק AI. חבר מפתח API כדי לבחור מוח.</span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-6 text-xs gap-1"
            onClick={() => navigate(buildPath("/llm-settings"))}
          >
            <ExternalLink className="h-3 w-3" />
            חבר
          </Button>
        </div>
      )}
    </div>
  );
}
