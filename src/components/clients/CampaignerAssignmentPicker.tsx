import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Check, Search, UserPlus } from "lucide-react";
import { useAssignableCampaigners } from "@/hooks/useAssignableCampaigners";

interface CampaignerAssignmentPickerProps {
  assignedCampaignerIds?: string[];
  onAssign: (campaignerId: string) => void | Promise<void>;
  disabled?: boolean;
  triggerLabel?: string;
  triggerClassName?: string;
}

export function CampaignerAssignmentPicker({
  assignedCampaignerIds = [],
  onAssign,
  disabled = false,
  triggerLabel = "שיוך לקמפיינרים",
  triggerClassName,
}: CampaignerAssignmentPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const { data: campaigners = [], isLoading } = useAssignableCampaigners({
    activeOnly: true,
    enabled: open,
  });

  const assignedIds = useMemo(
    () => new Set(assignedCampaignerIds),
    [assignedCampaignerIds]
  );
  const filteredCampaigners = useMemo(() => {
    const term = search.trim().toLowerCase();
    return campaigners.filter(
      (campaigner) =>
        !assignedIds.has(campaigner.id) &&
        (!term ||
          campaigner.full_name?.toLowerCase().includes(term) ||
          campaigner.email?.toLowerCase().includes(term))
    );
  }, [campaigners, assignedIds, search]);

  const handleAssign = async (campaignerId: string) => {
    setAssigningId(campaignerId);
    try {
      await onAssign(campaignerId);
      setOpen(false);
      setSearch("");
    } finally {
      setAssigningId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className={triggerClassName}
        >
          <UserPlus className="h-4 w-4 ml-1" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">שיוך לקמפיינרים</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="חיפוש לפי שם או אימייל"
            className="pr-9"
          />
        </div>
        <div className="max-h-72 overflow-y-auto rounded-md border">
          {isLoading ? (
            <p className="p-4 text-center text-sm text-muted-foreground">טוען...</p>
          ) : filteredCampaigners.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">
              לא נמצאו קמפיינרים נוספים לשיוך
            </p>
          ) : (
            filteredCampaigners.map((campaigner) => (
              <button
                key={campaigner.id}
                type="button"
                disabled={assigningId !== null}
                onClick={() => handleAssign(campaigner.id)}
                className="flex w-full items-center justify-between border-b p-3 text-right last:border-b-0 hover:bg-muted/50 disabled:opacity-50"
              >
                <span>
                  <span className="block font-medium">{campaigner.full_name}</span>
                  {campaigner.email && (
                    <span className="block text-xs text-muted-foreground">
                      {campaigner.email}
                    </span>
                  )}
                </span>
                {assigningId === campaigner.id && <Check className="h-4 w-4" />}
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
