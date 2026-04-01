import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, ArrowRight, ExternalLink, ChevronRight } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface UnifiedProvider {
  name: string;
  type: string;
  icon_url: string | null;
  categories: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCategory: { key: string; label: string } | null;
  tenantId: string;
}

export default function UnifiedProviderPicker({ open, onOpenChange, selectedCategory, tenantId }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<"providers" | "connecting" | "save">("providers");
  const [providers, setProviders] = useState<UnifiedProvider[]>([]);
  const [isLoadingProviders, setIsLoadingProviders] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<UnifiedProvider | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [newConnectionId, setNewConnectionId] = useState("");
  const [searchFilter, setSearchFilter] = useState("");

  const resetState = () => {
    setStep("providers");
    setProviders([]);
    setSelectedProvider(null);
    setNewConnectionId("");
    setSearchFilter("");
  };

  const handleOpenChange = (val: boolean) => {
    if (!val) resetState();
    onOpenChange(val);
  };

  // Fetch providers when dialog opens
  const fetchProviders = async () => {
    if (!selectedCategory) return;
    setIsLoadingProviders(true);
    try {
      const { data, error } = await supabase.functions.invoke("unified-connections", {
        body: { action: "list_integrations", tenant_id: tenantId, category: selectedCategory.key },
      });
      if (error) throw error;
      setProviders(data?.integrations || []);
    } catch (err: any) {
      toast({ title: "שגיאה בטעינת ספקים", description: err.message, variant: "destructive" });
    } finally {
      setIsLoadingProviders(false);
    }
  };

  // Called when dialog first opens
  const onDialogOpen = () => {
    if (selectedCategory) {
      fetchProviders();
    }
  };

  const handleSelectProvider = async (provider: UnifiedProvider) => {
    setSelectedProvider(provider);
    setIsConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("unified-connections", {
        body: {
          action: "get_embed_url",
          tenant_id: tenantId,
          category: selectedCategory!.key,
          integration_type: provider.type,
          success_redirect: window.location.href,
          failure_redirect: window.location.href,
        },
      });
      if (error) throw error;
      if (data?.embed_url) {
        window.open(data.embed_url, "_blank", "width=600,height=700");
        setStep("save");
      }
    } catch (err: any) {
      toast({ title: "שגיאה בפתיחת חלון חיבור", description: err.message, variant: "destructive" });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSaveConnection = async () => {
    if (!newConnectionId.trim()) {
      toast({ title: "נא להזין Connection ID", variant: "destructive" });
      return;
    }
    try {
      const { error } = await supabase.functions.invoke("unified-connections", {
        body: {
          action: "save_connection",
          tenant_id: tenantId,
          connection_id: newConnectionId.trim(),
          category: selectedCategory!.key,
          integration_type: selectedProvider?.type,
        },
      });
      if (error) throw error;
      toast({ title: "החיבור נשמר בהצלחה!" });
      queryClient.invalidateQueries({ queryKey: ["unified-connections"] });
      handleOpenChange(false);
    } catch (err: any) {
      toast({ title: "שגיאה בשמירת החיבור", description: err.message, variant: "destructive" });
    }
  };

  const filteredProviders = providers.filter((p) =>
    p.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
    p.type.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent dir="rtl" className="max-w-lg" onOpenAutoFocus={() => onDialogOpen()}>
        {step === "providers" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedCategory && (
                  <>
                    <span>{selectedCategory.label}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground text-base font-normal">בחר ספק</span>
                  </>
                )}
              </DialogTitle>
              <DialogDescription>בחר את השירות הספציפי שברצונך לחבר</DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <Input
                placeholder="חפש ספק..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
              />

              {isLoadingProviders ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredProviders.length === 0 ? (
                <p className="text-center text-muted-foreground py-6">לא נמצאו ספקים בקטגוריה זו</p>
              ) : (
                <ScrollArea className="max-h-[360px]">
                  <div className="space-y-1">
                    {filteredProviders.map((provider) => (
                      <button
                        key={provider.type}
                        onClick={() => handleSelectProvider(provider)}
                        disabled={isConnecting && selectedProvider?.type === provider.type}
                        className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-right disabled:opacity-50"
                      >
                        {provider.icon_url ? (
                          <img src={provider.icon_url} alt={provider.name} className="h-8 w-8 rounded object-contain" />
                        ) : (
                          <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                            {provider.name.charAt(0)}
                          </div>
                        )}
                        <span className="font-medium flex-1">{provider.name}</span>
                        {isConnecting && selectedProvider?.type === provider.type ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </>
        )}

        {step === "save" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedProvider?.icon_url && (
                  <img src={selectedProvider.icon_url} alt="" className="h-6 w-6 rounded" />
                )}
                שמור חיבור — {selectedProvider?.name}
              </DialogTitle>
              <DialogDescription>
                לאחר שהחיבור הצליח בחלון Unified.to, הזן את ה-Connection ID שהתקבל
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Connection ID</Label>
                <Input
                  value={newConnectionId}
                  onChange={(e) => setNewConnectionId(e.target.value)}
                  placeholder="הזן Connection ID..."
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveConnection} className="flex-1">שמור חיבור</Button>
                <Button variant="outline" onClick={() => setStep("providers")}>חזור</Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
