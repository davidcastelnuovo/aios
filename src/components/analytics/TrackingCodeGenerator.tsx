import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Code, Copy, Check, Plus, Globe, Settings } from "lucide-react";

interface Client {
  id: string;
  name: string;
  website?: string;
}

interface TrackingConfig {
  id: string;
  client_id: string;
  tracking_id: string;
  website_domain: string | null;
  is_active: boolean;
  settings: Record<string, boolean>;
  clients?: { id: string; name: string } | null;
}

interface TrackingCodeGeneratorProps {
  clients: Client[];
  trackingConfigs: TrackingConfig[];
  onCreateConfig: (data: { clientId: string; domain: string }) => void;
  isCreating: boolean;
}

export function TrackingCodeGenerator({
  clients,
  trackingConfigs,
  onCreateConfig,
  isCreating,
}: TrackingCodeGeneratorProps) {
  const [selectedClient, setSelectedClient] = useState("");
  const [newDomain, setNewDomain] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const supabaseUrl = "https://jnzguisakdtcollxmgzd.supabase.co";

  const generateEmbedCode = (trackingId: string) => {
    return `<!-- Marketing Captain Analytics -->
<script>
(function(w,d,s,c) {
  w.MCAnalytics = w.MCAnalytics || [];
  var js = d.createElement(s);
  js.async = true;
  js.src = '${supabaseUrl}/functions/v1/analytics-script?id=' + c;
  d.head.appendChild(js);
})(window, document, 'script', '${trackingId}');
</script>`;
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      toast.success("הקוד הועתק!");
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      toast.error("שגיאה בהעתקה");
    }
  };

  const handleCreate = () => {
    if (!selectedClient) {
      toast.error("נא לבחור לקוח");
      return;
    }
    onCreateConfig({ clientId: selectedClient, domain: newDomain });
    setDialogOpen(false);
    setSelectedClient("");
    setNewDomain("");
  };

  // Get clients that don't have tracking yet
  const availableClients = clients.filter(
    (c) => !trackingConfigs.some((tc) => tc.client_id === c.id)
  );

  return (
    <div className="space-y-6">
      {/* Create New */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">קודי מעקב</CardTitle>
            <CardDescription>
              צור קוד מעקב ייחודי לכל לקוח והטמע אותו באתר שלו
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button disabled={availableClients.length === 0}>
                <Plus className="h-4 w-4 ml-2" />
                קוד מעקב חדש
              </Button>
            </DialogTrigger>
            <DialogContent dir="rtl">
              <DialogHeader>
                <DialogTitle>יצירת קוד מעקב חדש</DialogTitle>
                <DialogDescription>
                  בחר לקוח והזן את הדומיין של האתר שלו
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>לקוח</Label>
                  <Select value={selectedClient} onValueChange={setSelectedClient}>
                    <SelectTrigger>
                      <SelectValue placeholder="בחר לקוח" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableClients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>דומיין האתר (אופציונלי)</Label>
                  <Input
                    placeholder="example.com"
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    dir="ltr"
                  />
                </div>
                <Button 
                  className="w-full" 
                  onClick={handleCreate}
                  disabled={!selectedClient || isCreating}
                >
                  {isCreating ? "יוצר..." : "צור קוד מעקב"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
      </Card>

      {/* Existing Configs */}
      {trackingConfigs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Code className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">אין קודי מעקב עדיין</h3>
            <p className="text-muted-foreground mb-4">
              צור קוד מעקב ללקוח הראשון שלך
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {trackingConfigs.map((config) => (
            <Card key={config.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Globe className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <CardTitle className="text-base">
                        {config.clients?.name || "לקוח לא ידוע"}
                      </CardTitle>
                      {config.website_domain && (
                        <CardDescription>{config.website_domain}</CardDescription>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={config.is_active ? "default" : "secondary"}>
                      {config.is_active ? "פעיל" : "מושבת"}
                    </Badge>
                    <Badge variant="outline" className="font-mono">
                      {config.tracking_id}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Label className="text-sm font-medium">קוד להטמעה</Label>
                  <div className="relative">
                    <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto" dir="ltr">
                      {generateEmbedCode(config.tracking_id)}
                    </pre>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="absolute top-2 left-2"
                      onClick={() => copyToClipboard(generateEmbedCode(config.tracking_id), config.id)}
                    >
                      {copiedId === config.id ? (
                        <>
                          <Check className="h-4 w-4 ml-1" />
                          הועתק
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 ml-1" />
                          העתק
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    הדבק את הקוד הזה ב-head או לפני סגירת body באתר של הלקוח
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">הוראות התקנה</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium">1. העתק את הקוד</h4>
            <p className="text-sm text-muted-foreground">
              לחץ על כפתור ההעתקה ליד קוד המעקב של הלקוח הרלוונטי
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium">2. הדבק באתר</h4>
            <p className="text-sm text-muted-foreground">
              הדבק את הקוד בתוך תג &lt;head&gt; או לפני סגירת &lt;/body&gt; בכל דפי האתר
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium">3. בדוק שהכל עובד</h4>
            <p className="text-sm text-muted-foreground">
              גלוש לאתר ובדוק שאתה רואה נתונים מתחילים להגיע לדשבורד
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium">מעקב אירועים מותאם אישית (אופציונלי)</h4>
            <pre className="bg-muted p-3 rounded text-xs" dir="ltr">
              {`// שלח אירוע מותאם אישית
MCAnalytics.track('button_click', { 
  button_name: 'signup',
  page: 'homepage' 
});

// זהה מבקר (מקשר להיסטוריה)
MCAnalytics.identify({ 
  email: 'user@example.com',
  phone: '0501234567',
  name: 'ישראל ישראלי'
});`}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
