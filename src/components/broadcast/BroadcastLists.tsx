import { useState } from "react";
import { useBroadcastLists, type BroadcastList } from "@/hooks/useBroadcastLists";
import { useLeadStatuses } from "@/hooks/useLeadStatuses";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Users, FileSpreadsheet, Upload, Zap, Loader2, RefreshCw } from "lucide-react";

const LEAD_SOURCES = [
  { key: "website", label: "אתר" }, { key: "facebook", label: "פייסבוק" },
  { key: "referral", label: "הפניה" }, { key: "paid_ads", label: "מודעות" },
  { key: "whatsapp", label: "וואטסאפ" }, { key: "other", label: "אחר" },
];

export function BroadcastLists() {
  const { lists, createList, deleteList } = useBroadcastLists();
  const [openList, setOpenList] = useState<BroadcastList | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    const name = newName.trim() || "רשימה חדשה";
    const l = await createList.mutateAsync({ name });
    setNewName("");
    setCreating(false);
    setOpenList(l);
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center gap-2">
        {creating ? (
          <>
            <Input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)}
              placeholder="שם הרשימה" className="max-w-xs"
              onKeyDown={(e) => e.key === "Enter" && handleCreate()} />
            <Button onClick={handleCreate}>צור</Button>
            <Button variant="ghost" onClick={() => setCreating(false)}>ביטול</Button>
          </>
        ) : (
          <Button onClick={() => setCreating(true)}><Plus className="ml-1 h-4 w-4" /> רשימה חדשה</Button>
        )}
      </div>

      {lists.isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (lists.data || []).length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <Users className="mx-auto mb-2 h-8 w-8 opacity-50" /> אין רשימות עדיין.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(lists.data || []).map((l) => (
            <Card key={l.id} className="cursor-pointer hover:border-primary" onClick={() => setOpenList(l)}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="font-medium">{l.name}</div>
                  <Button variant="ghost" size="icon" onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("למחוק את הרשימה?")) deleteList.mutate(l.id);
                  }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" /> {l.member_count} נמענים
                </div>
                <div className="flex gap-1">
                  {l.kind === "dynamic" && <Badge variant="secondary" className="text-xs"><RefreshCw className="ml-1 h-3 w-3" />מסונכרן</Badge>}
                  {l.source === "google_sheet" && <Badge variant="outline" className="text-xs">Google Sheet</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {openList && <ListDetailDialog list={openList} onClose={() => setOpenList(null)} />}
    </div>
  );
}

function ListDetailDialog({ list, onClose }: { list: BroadcastList; onClose: () => void }) {
  const { useMembers, addMembers, removeMember, sheetHeaders, sheetImport, useRules, addRule, deleteRule } = useBroadcastLists();
  const { statuses: leadStatuses } = useLeadStatuses();
  const members = useMembers(list.id);
  const rules = useRules(list.id);

  // manual add
  const [m, setM] = useState({ name: "", phone: "", email: "" });
  // csv paste
  const [csv, setCsv] = useState("");
  // sheet
  const [sheetUrl, setSheetUrl] = useState("");
  const [headers, setHeaders] = useState<string[] | null>(null);
  const [map, setMap] = useState<Record<string, string>>({});
  const [autoSync, setAutoSync] = useState(false);
  const [loadingHeaders, setLoadingHeaders] = useState(false);
  // rule
  const [ruleStatuses, setRuleStatuses] = useState<string[]>([]);
  const [ruleSources, setRuleSources] = useState<string[]>([]);

  const toggle = (arr: string[], v: string, set: (x: string[]) => void) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const addManual = async () => {
    if (!m.phone && !m.email) { toast.error("צריך טלפון או אימייל"); return; }
    await addMembers.mutateAsync({ listId: list.id, rows: [m], via: "manual" });
    setM({ name: "", phone: "", email: "" });
  };

  const importCsv = async () => {
    const rows = csv.split("\n").map((line) => {
      const [name, phone, email] = line.split(",").map((c) => c?.trim());
      return { name, phone, email };
    }).filter((r) => r.phone || r.email);
    if (!rows.length) { toast.error("לא נמצאו שורות תקינות"); return; }
    const n = await addMembers.mutateAsync({ listId: list.id, rows, via: "csv" });
    setCsv("");
    toast.success(`יובאו ${n} אנשי קשר`);
  };

  const loadHeaders = async () => {
    if (!sheetUrl.trim()) return;
    setLoadingHeaders(true);
    try {
      const res = await sheetHeaders(sheetUrl.trim());
      setHeaders(res.headers);
      setMap(res.suggestedMap || {});
    } catch (e: any) {
      toast.error("שגיאה בטעינת הגיליון: " + (e?.message || "ודא שהגיליון משותף לצפייה"));
    } finally {
      setLoadingHeaders(false);
    }
  };

  const runSheetImport = async () => {
    try {
      const res = await sheetImport.mutateAsync({ listId: list.id, sheetId: sheetUrl.trim(), fieldMap: map, autoSync });
      toast.success(`סונכרנו ${res.total} אנשי קשר מהגיליון`);
      setHeaders(null); setSheetUrl("");
    } catch (e: any) {
      toast.error("שגיאת ייבוא: " + (e?.message || ""));
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader><DialogTitle>{list.name}</DialogTitle></DialogHeader>
        <Tabs defaultValue="members">
          <TabsList className="w-full">
            <TabsTrigger value="members" className="flex-1"><Users className="ml-1 h-4 w-4" />חברים</TabsTrigger>
            <TabsTrigger value="import" className="flex-1"><Upload className="ml-1 h-4 w-4" />ייבוא</TabsTrigger>
            <TabsTrigger value="rules" className="flex-1"><Zap className="ml-1 h-4 w-4" />אוטומציה</TabsTrigger>
          </TabsList>

          {/* MEMBERS */}
          <TabsContent value="members" className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Input placeholder="שם" value={m.name} onChange={(e) => setM({ ...m, name: e.target.value })} className="w-28" />
              <Input placeholder="טלפון" value={m.phone} onChange={(e) => setM({ ...m, phone: e.target.value })} className="w-32" />
              <Input placeholder="אימייל" value={m.email} onChange={(e) => setM({ ...m, email: e.target.value })} className="w-40" />
              <Button onClick={addManual} disabled={addMembers.isPending}><Plus className="h-4 w-4" /></Button>
            </div>
            <div className="max-h-72 overflow-y-auto rounded border">
              <Table>
                <TableHeader>
                  <TableRow><TableHead className="text-right">שם</TableHead><TableHead className="text-right">טלפון</TableHead><TableHead className="text-right">אימייל</TableHead><TableHead></TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {(members.data || []).map((mem) => (
                    <TableRow key={mem.id}>
                      <TableCell>{mem.name || "—"}</TableCell>
                      <TableCell dir="ltr" className="text-right">{mem.phone || "—"}</TableCell>
                      <TableCell dir="ltr" className="text-right">{mem.email || "—"}</TableCell>
                      <TableCell><Button variant="ghost" size="icon" onClick={() => removeMember.mutate({ id: mem.id, listId: list.id })}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                    </TableRow>
                  ))}
                  {(members.data || []).length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">אין חברים ברשימה</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* IMPORT */}
          <TabsContent value="import" className="space-y-5">
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><Upload className="h-4 w-4" />הדבקת רשימה (CSV)</Label>
              <p className="text-xs text-muted-foreground">שורה לכל איש קשר: <code>שם, טלפון, אימייל</code></p>
              <Textarea rows={4} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder="ישראל ישראלי, 0501234567, israel@mail.com" dir="ltr" />
              <Button onClick={importCsv} disabled={addMembers.isPending} variant="secondary">ייבא מהטקסט</Button>
            </div>

            <div className="space-y-2 rounded-lg border p-3">
              <Label className="flex items-center gap-1"><FileSpreadsheet className="h-4 w-4" />ייבוא מ-Google Sheets</Label>
              <p className="text-xs text-muted-foreground">הדבק קישור לגיליון (משותף לצפייה לכל מי שיש לו קישור).</p>
              <div className="flex gap-2">
                <Input value={sheetUrl} onChange={(e) => setSheetUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." dir="ltr" className="flex-1" />
                <Button onClick={loadHeaders} disabled={loadingHeaders} variant="secondary">
                  {loadingHeaders ? <Loader2 className="h-4 w-4 animate-spin" /> : "טען עמודות"}
                </Button>
              </div>
              {headers && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">מיפוי עמודות:</p>
                  {headers.map((h) => (
                    <div key={h} className="flex items-center gap-2 text-sm">
                      <span className="w-40 truncate">{h}</span>
                      <Select value={map[h] || "ignore"} onValueChange={(v) => setMap({ ...map, [h]: v === "ignore" ? "" : v })}>
                        <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-background z-[100]">
                          <SelectItem value="ignore">— התעלם —</SelectItem>
                          <SelectItem value="name">שם</SelectItem>
                          <SelectItem value="phone">טלפון</SelectItem>
                          <SelectItem value="email">אימייל</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={autoSync} onCheckedChange={setAutoSync} /> סנכרון אוטומטי (הגיליון = מקור אמת)
                  </label>
                  <Button onClick={runSheetImport} disabled={sheetImport.isPending}>
                    {sheetImport.isPending ? <Loader2 className="ml-1 h-4 w-4 animate-spin" /> : null} ייבא מהגיליון
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          {/* RULES */}
          <TabsContent value="rules" className="space-y-4">
            <p className="text-sm text-muted-foreground">הוסף אוטומטית לרשימה כל ליד חדש שעונה לתנאים:</p>
            <div className="rounded-lg border p-3 space-y-3">
              <div>
                <Label className="mb-1 block text-xs">סטטוס ליד (ריק = כל הסטטוסים)</Label>
                <div className="flex flex-wrap gap-2">
                  {(leadStatuses || []).map((s: any) => (
                    <button key={s.status_key} type="button" onClick={() => toggle(ruleStatuses, s.status_key, setRuleStatuses)}
                      className={`rounded-full border px-2 py-0.5 text-xs ${ruleStatuses.includes(s.status_key) ? "bg-primary text-primary-foreground" : ""}`}>
                      {s.label || s.status_key}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="mb-1 block text-xs">מקור (ריק = כל המקורות)</Label>
                <div className="flex flex-wrap gap-2">
                  {LEAD_SOURCES.map((s) => (
                    <button key={s.key} type="button" onClick={() => toggle(ruleSources, s.key, setRuleSources)}
                      className={`rounded-full border px-2 py-0.5 text-xs ${ruleSources.includes(s.key) ? "bg-primary text-primary-foreground" : ""}`}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <Button size="sm" onClick={async () => {
                await addRule.mutateAsync({ listId: list.id, filter: { statusKeys: ruleStatuses, sources: ruleSources } });
                setRuleStatuses([]); setRuleSources([]);
                toast.success("כלל נוסף");
              }}><Plus className="ml-1 h-4 w-4" />הוסף כלל</Button>
            </div>
            <div className="space-y-2">
              {(rules.data || []).map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded border p-2 text-sm">
                  <span>
                    ליד חדש
                    {r.filter?.statusKeys?.length ? ` · סטטוס: ${r.filter.statusKeys.join(", ")}` : ""}
                    {r.filter?.sources?.length ? ` · מקור: ${r.filter.sources.join(", ")}` : " · כל הלידים"}
                  </span>
                  <Button variant="ghost" size="icon" onClick={() => deleteRule.mutate({ id: r.id, listId: list.id })}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              ))}
              {(rules.data || []).length === 0 && <p className="text-xs text-muted-foreground">אין כללים פעילים.</p>}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
