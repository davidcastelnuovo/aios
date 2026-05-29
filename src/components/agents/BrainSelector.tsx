import { useAiModels, type AiModel } from "@/hooks/useAiModels";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Brain, Sparkles, Zap } from "lucide-react";

interface BrainSelectorProps {
  value: string | null;
  onChange: (engineAlias: string) => void;
  disabled?: boolean;
}

export function BrainSelector({ value, onChange, disabled }: BrainSelectorProps) {
  const { data: models = [], isLoading } = useAiModels();

  const byFamily = models.reduce<Record<string, AiModel[]>>((acc, m) => {
    (acc[m.family] ||= []).push(m);
    return acc;
  }, {});

  // Try to match by alias or full id
  const current = models.find(m => m.alias === value || m.id === value);
  const selectedValue = current ? (current.alias || current.id) : value || "";

  return (
    <div className="flex items-center gap-2 rounded-lg border bg-card p-2">
      <Brain className="h-4 w-4 text-primary shrink-0" />
      <span className="text-xs text-muted-foreground shrink-0">מוח:</span>
      <Select value={selectedValue} onValueChange={onChange} disabled={disabled || isLoading}>
        <SelectTrigger className="h-8 border-0 focus:ring-0 focus:ring-offset-0 shadow-none">
          <SelectValue placeholder={isLoading ? "טוען מודלים..." : "בחר מוח"} />
        </SelectTrigger>
        <SelectContent className="max-h-[400px]">
          {Object.entries(byFamily).map(([family, list]) => (
            <SelectGroup key={family}>
              <SelectLabel className="text-xs uppercase">
                {family === "google" ? "🔵 Google" : family === "openai" ? "🟢 OpenAI" : "🟠 Anthropic"}
              </SelectLabel>
              {list.map(m => (
                <SelectItem key={m.id} value={m.alias || m.id}>
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
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
