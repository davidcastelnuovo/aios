import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Link2, Loader2, Search } from "lucide-react";

interface LinkTableToClientDialogProps {
  tableId: string;
  tenantId: string;
  currentClientId: string | null;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function LinkTableToClientDialog({
  tableId,
  tenantId,
  currentClientId,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: LinkTableToClientDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;

  const [selectedClientId, setSelectedClientId] = useState<string>(currentClientId || "");
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients-for-table-link", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, agency_id, agencies(name)")
        .eq("tenant_id", tenantId)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!tenantId,
  });

  const filteredClients = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const linkMutation = useMutation({
    mutationFn: async (clientId: string | null) => {
      const { error } = await supabase
        .from("crm_tables")
        .update({ client_id: clientId })
        .eq("id", tableId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("הטבלה שויכה ללקוח בהצלחה");
      queryClient.invalidateQueries({ queryKey: ["crm-table"] });
      queryClient.invalidateQueries({ queryKey: ["crm-tables"] });
      queryClient.invalidateQueries({ queryKey: ["client-dashboard-tables"] });
      setOpen(false);
    },
    onError: (e: Error) => {
      toast.error("שגיאה בשיוך: " + e.message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger}
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            שיוך טבלה ללקוח
          </DialogTitle>
          <DialogDescription>
            בחר את הלקוח שאליו ברצונך לשייך את הטבלה. הנתונים יופיעו בדשבורד של אותו לקוח.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>חיפוש לקוח</Label>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="הקלד שם לקוח..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-9"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>בחר לקוח</Label>
            <Select value={selectedClientId} onValueChange={setSelectedClientId}>
              <SelectTrigger>
                <SelectValue placeholder={isLoading ? "טוען..." : "בחר לקוח"} />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {filteredClients.length === 0 && (
                  <div className="py-4 text-center text-sm text-muted-foreground">
                    לא נמצאו לקוחות
                  </div>
                )}
                {filteredClients.map((client: any) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                    {client.agencies?.name && (
                      <span className="text-muted-foreground text-xs mr-2">
                        ({client.agencies.name})
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {currentClientId && (
            <Button
              variant="outline"
              onClick={() => linkMutation.mutate(null)}
              disabled={linkMutation.isPending}
            >
              בטל שיוך
            </Button>
          )}
          <Button variant="outline" onClick={() => setOpen(false)}>
            ביטול
          </Button>
          <Button
            onClick={() => linkMutation.mutate(selectedClientId)}
            disabled={!selectedClientId || linkMutation.isPending}
          >
            {linkMutation.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
            שייך ללקוח
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
