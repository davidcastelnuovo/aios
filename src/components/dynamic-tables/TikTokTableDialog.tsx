import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useTenantPath } from "@/hooks/useTenantPath";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { Loader2, AlertCircle, Music2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignedClientIds?: string[];
}

const MAX_VIDEOS_OPTIONS = [
  { value: '20', label: '20 סרטונים אחרונים' },
  { value: '50', label: '50 סרטונים אחרונים (מומלץ)' },
  { value: '100', label: '100 סרטונים אחרונים' },
  { value: '200', label: '200 סרטונים אחרונים' },
];

export function TikTokTableDialog({ open, onOpenChange, assignedClientIds }: Props) {
  const navigate = useNavigate();
  const { buildPath } = useTenantPath();
  const queryClient = useQueryClient();
  const { tenantId } = useCurrentTenant();

  const [tableName, setTableName] = useState("");
  const [maxVideos, setMaxVideos] = useState("50");
  const [agencyId, setAgencyId] = useState<string>("");
  const [clientId, setClientId] = useState<string>("");
  const [clientSearch, setClientSearch] = useState("");

  const { data: integration, isLoading: checking } = useQuery({
    queryKey: ['tiktok-integration-status', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const { data } = await supabase
        .from('tenant_integrations')
        .select('id, is_active, settings')
        .eq('tenant_id', tenantId)
        .eq('integration_type', 'tiktok')
        .eq('is_active', true)
        .maybeSingle();
      return data;
    },
    enabled: open && !!tenantId,
  });

  const { data: agencies = [] } = useQuery({
    queryKey: ['agencies', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase.from('agencies').select('id, name').eq('tenant_id', tenantId).order('name');
      return data || [];
    },
    enabled: open && !!tenantId,
  });

  const { data: rawClients = [] } = useQuery({
    queryKey: ['clients-for-tt', agencyId],
    queryFn: async () => {
      if (!agencyId) return [];
      const { data } = await supabase.from('clients').select('id, name').eq('agency_id', agencyId).order('name');
      return data || [];
    },
    enabled: open && !!agencyId,
  });
  const clients = assignedClientIds
    ? rawClients.filter(c => assignedClientIds.includes(c.id))
    : rawClients;

  useEffect(() => { setClientId(""); setClientSearch(""); }, [agencyId]);

  const connected = !!integration?.is_active;
  const account = (integration?.settings as any) || {};

  const createMutation = useMutation({
    mutationFn: async () => {
      const slug = tableName.toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9\u0590-\u05FF-]/g, '')
        + '-' + Date.now().toString(36);

      const res = await supabase.functions.invoke('crm-tables', {
        method: 'POST',
        body: {
          name: tableName,
          slug,
          category: 'TikTok',
          integration_type: 'tiktok_content',
          integration_settings: {
            account_open_id: account.open_id,
            account_display_name: account.display_name,
            max_videos: parseInt(maxVideos),
            sync_frequency: 'daily',
          },
          agency_id: agencyId || null,
          client_id: clientId || null,
        },
      });
      if (res.error) throw res.error;
      return res.data;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['crm-tables'] });
      toast.success('טבלת TikTok נוצרה');
      try {
        toast.info('מסנכרן סרטונים מ-TikTok...');
        await supabase.functions.invoke('sync-tiktok-content', {
          method: 'POST',
          body: { table_id: data.id },
        });
        toast.success('הסנכרון הראשון הושלם');
      } catch (e) {
        console.error('initial tiktok sync failed', e);
        toast.error('הטבלה נוצרה אך הסנכרון נכשל — נסה לסנכרן ידנית');
      }
      handleClose();
      navigate(buildPath(`/table/${data.slug}`));
    },
    onError: (e: any) => toast.error('שגיאה ביצירת הטבלה: ' + e?.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableName.trim()) { toast.error('יש להזין שם לטבלה'); return; }
    if (assignedClientIds && !clientId) { toast.error('יש לבחור לקוח'); return; }
    createMutation.mutate();
  };

  const handleClose = () => {
    setTableName(""); setMaxVideos("50"); setAgencyId(""); setClientId("");
    setClientSearch(""); onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent dir="rtl" className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Music2 className="h-5 w-5 text-fuchsia-500" />
            יצירת דוח TikTok Content
          </DialogTitle>
          <DialogDescription>
            דוח ביצועי סרטונים אורגניים מחשבון TikTok — צפיות, לייקים, תגובות, שיתופים ושיעור מעורבות.
          </DialogDescription>
        </DialogHeader>

        {checking ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : !connected ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              חשבון TikTok אינו מחובר. עבור{' '}
              <Button variant="link" className="p-0 h-auto" onClick={() => { handleClose(); navigate(buildPath('/tiktok-settings')); }}>
                להגדרות TikTok
              </Button>{' '}לחיבור.
            </AlertDescription>
          </Alert>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Alert>
              <AlertDescription>
                החשבון המחובר: <strong>{account.display_name}</strong>
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="tt-name">שם הטבלה</Label>
              <Input id="tt-name" value={tableName} onChange={(e) => setTableName(e.target.value)}
                placeholder="למשל: ביצועי סרטונים TikTok" autoFocus />
            </div>

            <div className="space-y-2">
              <Label>כמות סרטונים לסנכרון</Label>
              <Select value={maxVideos} onValueChange={setMaxVideos}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MAX_VIDEOS_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>שיוך לסוכנות (אופציונלי)</Label>
              <Select value={agencyId || "__none__"} onValueChange={(v) => setAgencyId(v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="ללא שיוך" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">ללא שיוך</SelectItem>
                  {agencies.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {agencyId && (
              <div className="space-y-2">
                <Label>שיוך ללקוח (אופציונלי)</Label>
                <Input placeholder="חפש לקוח..." value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} className="mb-2" />
                <Select value={clientId || "__none__"} onValueChange={(v) => setClientId(v === "__none__" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="ללא שיוך" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">ללא שיוך</SelectItem>
                    {clients
                      .filter(c => c.name?.toLowerCase().includes(clientSearch.toLowerCase()))
                      .map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>ביטול</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? (<><Loader2 className="ml-2 h-4 w-4 animate-spin" />יוצר...</>) : 'צור טבלה'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
