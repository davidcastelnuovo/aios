import { useState } from "react";
import { Settings2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLeadPipelineStages } from "@/hooks/useLeadPipelineStages";
import { ManagePipelineStagesDialog } from "@/components/forms/ManagePipelineStagesDialog";

interface LeadStageSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  /** 'id' uses stage.id (UUID), 'stage_key' uses stage.stage_key (string key) */
  valueType?: 'id' | 'stage_key';
  /** Show "ניהול שלבי משפך" button inside dropdown */
  showManageButton?: boolean;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  placeholder?: string;
}

/**
 * Unified component for selecting lead pipeline stages.
 * Supports both stage.id (UUID) and stage.stage_key as value types.
 */
export function LeadStageSelector({
  value,
  onValueChange,
  valueType = 'stage_key',
  showManageButton = true,
  disabled = false,
  className,
  triggerClassName,
  placeholder = "בחר שלב",
}: LeadStageSelectorProps) {
  const [selectOpen, setSelectOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const { activeStages } = useLeadPipelineStages();

  // Find selected stage based on value type
  const selectedStage = valueType === 'id' 
    ? activeStages.find(s => s.id === value)
    : activeStages.find(s => s.stage_key === value);

  // Get value for each stage based on value type
  const getStageValue = (stage: typeof activeStages[0]) => 
    valueType === 'id' ? stage.id : stage.stage_key;

  return (
    <div className={className}>
      <Select
        value={value}
        onValueChange={onValueChange}
        open={selectOpen}
        onOpenChange={setSelectOpen}
        disabled={disabled}
      >
        <SelectTrigger
          className={triggerClassName}
          style={{
            backgroundColor: selectedStage?.color || undefined,
            color: value && selectedStage?.color ? '#fff' : undefined,
          }}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="bg-background z-[100]">
          {activeStages.map((stage) => (
            <SelectItem
              key={stage.id}
              value={getStageValue(stage)}
              style={{ backgroundColor: stage.color, color: '#fff' }}
            >
              {stage.label}
            </SelectItem>
          ))}
          {showManageButton && (
            <div className="border-t mt-1 pt-1">
              <button
                type="button"
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-muted rounded cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectOpen(false);
                  setManageOpen(true);
                }}
              >
                <Settings2 className="h-4 w-4" />
                ניהול שלבי משפך
              </button>
            </div>
          )}
        </SelectContent>
      </Select>

      <ManagePipelineStagesDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        showTrigger={false}
      />
    </div>
  );
}
