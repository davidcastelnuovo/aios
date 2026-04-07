import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, ArrowRight, ChevronRight } from "lucide-react";
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
  directIntegrationType?: string; // If set, skip provider list and connect directly
}

export default function UnifiedProviderPicker({ open, onOpenChange, selectedCategory, tenantId, directIntegrationType }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [providers, setProviders] = useState<UnifiedProvider[]>([]);
  const [isLoadingProviders, setIsLoadingProviders] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<UnifiedProvider | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");

  const resetState = () => {
    setProviders([]);
    setSelectedProvider(null);
    setSearchFilter("");
  };

  const handleOpenChange = (val: boolean) => {
    if (!val) resetState();
    onOpenChange(val);
  };

  // Listen for postMessage from callback page
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "unified-connected") {
        toast({ title: "החיבור נשמר בהצלחה!" });
        queryClient.invalidateQueries({ queryKey: ["unified-connections"] });
        handleOpenChange(false);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

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

  const onDialogOpen = () => {
    if (selectedCategory) fetchProviders();
  };

  const handleSelectProvider = async (provider: UnifiedProvider) => {
    setSelectedProvider(provider);
    setIsConnecting(true);
    try {
      // Save pending connection context to sessionStorage (backup for callback page)
      sessionStorage.setItem("unified_pending_connection", JSON.stringify({
        category: selectedCategory!.key,
        integration_type: provider.type,
        tenant_id: tenantId,
      }));

      // Build callback URL with params
      const callbackUrl = new URL("/unified-callback", window.location.origin);
      callbackUrl.searchParams.set("category", selectedCategory!.key);
      callbackUrl.searchParams.set("integration_type", provider.type);
      callbackUrl.searchParams.set("tenant_id", tenantId);

      const { data, error } = await supabase.functions.invoke("unified-connections", {
        body: {
          action: "get_embed_url",
          tenant_id: tenantId,
          category: selectedCategory!.key,
          integration_type: provider.type,
          success_redirect: callbackUrl.toString(),
          failure_redirect: window.location.href,
        },
      });
      if (error) throw error;
      if (data?.embed_url) {
        window.open(data.embed_url, "_blank", "width=600,height=700");
      }
    } catch (err: any) {
      toast({ title: "שגיאה בפתיחת חלון חיבור", description: err.message, variant: "destructive" });
    } finally {
      setIsConnecting(false);
    }
  };

  const filteredProviders = providers.filter((p) =>
    p.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
    p.type.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent dir="rtl" className="max-w-lg" onOpenAutoFocus={() => onDialogOpen()}>
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
      </DialogContent>
    </Dialog>
  );
}
