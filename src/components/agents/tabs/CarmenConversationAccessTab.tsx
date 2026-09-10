import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Phone, Users, MessageSquare, Shield, Download, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { fetchCarmenManusGroups } from "@/lib/carmenManusGroups";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type PolicyPhone = {
  phone: string;
  label?: string;
  dev_escalation_tier?: "full" | "bugfix" | null;
  surfaces?: string[];
};

type ClientGroupRow = {
  id?: string;
  client_id: string;
  whatsapp_group_id: string;
  allow_client_contacts: boolean;
  allow_assigned_campaigners: boolean;
  info_boundary: "external_only" | "full";
};

function normalizePhone(p: string) {
  return (p || "").replace(/\D/g, "");
}

export function CarmenConversationAccessTab({ agent }: { agent: { id: string; name: string } }) {
  const { tenantId } = useCurrentTenant();
  const qc = useQueryClient();
  const [phones, setPhones] = useState<PolicyPhone[]>([]);
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [requireDirect, setRequireDirect] = useState(true);
  const [openMemberGroups, setOpenMemberGroups] = useState(false);
  const [denyMessage, setDenyMessage] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [clientRows, setClientRows] = useState<ClientGroupRow[]>([]);

  const policyKey = ["carmen-access-policy", tenantId, agent.id];

  const { data: policy, isLoading: policyLoading } = useQuery({
    queryKey: policyKey,
    enabled: !!tenantId && !!agent.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("carmen_access_policies" as any)
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("agent_id", agent.id)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  /** Only groups where Carmen's Manus bot has been seen — not operator Green API groups. */
  const { data: manusGroups, isLoading: groupsLoading } = useQuery({
    queryKey: ["carmen-manus-groups", tenantId],
    enabled: !!tenantId,
    queryFn: () => fetchCarmenManusGroups(tenantId!),
  });

  const manusGroupIdSet = useMemo(
    () => new Set((manusGroups || []).map((g) => g.id)),
    [manusGroups],
  );

  const { data: clients } = useQuery({
    queryKey: ["carmen-access-clients", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, name, whatsapp_group_id")
        .eq("tenant_id", tenantId!)
        .order("name");
      return data || [];
    },
  });

  const { data: clientGroupAccess } = useQuery({
    queryKey: ["carmen-client-group-access", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data } = await supabase
        .from("carmen_client_group_access" as any)
        .select("*")
        .eq("tenant_id", tenantId!);
      return (data as ClientGroupRow[]) || [];
    },
  });

  const { data: identities } = useQuery({
    queryKey: ["carmen-identities", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data } = await supabase
        .from("carmen_whatsapp_identities" as any)
        .select("id, phone, display_name, status, surfaces, dev_escalation_tier, entity_type")
        .eq("tenant_id", tenantId!)
        .order("display_name");
      return data || [];
    },
  });

  useEffect(() => {
    if (!policy) return;
    setPhones(Array.isArray(policy.private_phones) ? policy.private_phones : []);
    const savedGroups: string[] = Array.isArray(policy.allowed_group_ids) ? policy.allowed_group_ids : [];
    setGroupIds(savedGroups);
    setRequireDirect(policy.require_direct_address !== false);
    setOpenMemberGroups(!!policy.open_member_groups);
    setDenyMessage(policy.deny_message_he || "");
  }, [policy?.id, policy?.updated_at]);

  // Drop saved group selections that are not Manus-connected once the list loads.
  useEffect(() => {
    if (manusGroupIdSet.size === 0) return;
    setGroupIds((prev) => {
      const filtered = prev.filter((id) => manusGroupIdSet.has(id));
      return filtered.length === prev.length ? prev : filtered;
    });
  }, [manusGroupIdSet]);

  useEffect(() => {
    if (clientGroupAccess) setClientRows(clientGroupAccess);
  }, [clientGroupAccess]);

  const importFromAutomation = useMutation({
    mutationFn: async () => {
      const { data: steps } = await supabase
        .from("automation_flow_steps")
        .select("configuration")
        .eq("tenant_id", tenantId!)
        .eq("step_type", "trigger")
        .eq("action_type", "carmen_whatsapp_session");
      const cfg = (steps || [])
        .map((s: any) => s.configuration)
        .find((c: any) => c?.agent_id === agent.id || !c?.agent_id) || (steps?.[0] as any)?.configuration;
      if (!cfg) throw new Error("לא נמצאה אוטומציית כרמן לייבוא");
      const importedPhones: PolicyPhone[] = (cfg.carmen_allowed_phones || []).map((p: string) => ({
        phone: normalizePhone(p),
        surfaces: ["whatsapp_private"],
      }));
      setPhones(importedPhones);
      const gids: string[] = cfg.carmen_allowed_group_ids?.length
        ? cfg.carmen_allowed_group_ids
        : (cfg.carmen_allowed_group_id ? [cfg.carmen_allowed_group_id] : []);
      const resolved = (manusGroups || [])
        .filter((g: any) => gids.includes(g.group_chat_id) || gids.includes(g.id))
        .map((g: any) => g.id);
      setGroupIds(resolved);
      setOpenMemberGroups(!!cfg.carmen_open_member_groups);
      toast.success("יובא מאוטומציה — לחץ שמור להחיל");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("חסר tenant");
      const allowedManusGroups = groupIds.filter((id) => manusGroupIdSet.has(id));
      const payload = {
        tenant_id: tenantId,
        agent_id: agent.id,
        private_phones: phones,
        allowed_group_ids: allowedManusGroups,
        require_direct_address: requireDirect,
        open_member_groups: openMemberGroups,
        deny_message_he: denyMessage || null,
        updated_at: new Date().toISOString(),
      };
      const { error: pErr } = await supabase
        .from("carmen_access_policies" as any)
        .upsert(payload, { onConflict: "tenant_id,agent_id" });
      if (pErr) throw pErr;

      for (const row of clientRows) {
        if (!row.client_id || !row.whatsapp_group_id) continue;
        if (!manusGroupIdSet.has(row.whatsapp_group_id)) continue;
        const { error } = await supabase.from("carmen_client_group_access" as any).upsert({
          tenant_id: tenantId,
          client_id: row.client_id,
          whatsapp_group_id: row.whatsapp_group_id,
          allow_client_contacts: row.allow_client_contacts,
          allow_assigned_campaigners: row.allow_assigned_campaigners,
          info_boundary: row.info_boundary,
          updated_at: new Date().toISOString(),
        }, { onConflict: "tenant_id,client_id,whatsapp_group_id" });
        if (error) throw error;
      }

      for (const entry of phones) {
        const phone = normalizePhone(entry.phone);
        if (phone.length < 9) continue;
        const { data: existing } = await supabase
          .from("carmen_whatsapp_identities" as any)
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("phone", phone)
          .maybeSingle();
        if (existing?.id) {
          await supabase.from("carmen_whatsapp_identities" as any).update({
            surfaces: entry.surfaces?.length ? entry.surfaces : ["whatsapp_private"],
            dev_escalation_tier: entry.dev_escalation_tier || null,
          }).eq("id", existing.id);
        }
      }
    },
    onSuccess: () => {
      toast.success("הרשאות שיחה נשמרו");
      qc.invalidateQueries({ queryKey: policyKey });
      qc.invalidateQueries({ queryKey: ["carmen-identities", tenantId] });
    },
    onError: (e: Error) => toast.error(e.message || "שמירה נכשלה"),
  });

  const addPhone = () => {
    const p = normalizePhone(newPhone);
    if (p.length < 9) {
      toast.error("מספר לא תקין");
      return;
    }
    if (phones.some((x) => x.phone === p)) {
      toast.error("המספר כבר ברשימה");
      return;
    }
    setPhones([...phones, { phone: p, surfaces: ["whatsapp_private"], dev_escalation_tier: null }]);
    setNewPhone("");
  };

  const toggleGroup = (id: string) => {
    setGroupIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const addClientGroupRow = () => {
    const c = (clients || []).find((cl: any) => cl.whatsapp_group_id && manusGroupIdSet.has(cl.whatsapp_group_id));
    setClientRows([
      ...clientRows,
      {
        client_id: c?.id || "",
        whatsapp_group_id: c?.whatsapp_group_id || "",
        allow_client_contacts: true,
        allow_assigned_campaigners: true,
        info_boundary: "external_only",
      },
    ]);
  };

  const groupName = (id: string) =>
    (manusGroups || []).find((g: any) => g.id === id)?.group_name || id;

  const approvedCount = useMemo(
    () => (identities || []).filter((i: any) => i.status === "approved").length,
    [identities],
  );

  if (policyLoading || groupsLoading) {
    return (
      <div className="flex justify-center py-12" dir="rtl">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl text-right" dir="rtl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold flex items-center gap-2 justify-start">
            <Shield className="h-5 w-5 text-purple-500 shrink-0" />
            הרשאות שיחה — {agent.name}
          </h2>
          <p className="text-sm text-muted-foreground">
            מי מדבר עם כרמן, איפה (פרטי / קבוצה / Command Center), ומה מותר לבקש מסוכני פיתוח.
            {approvedCount > 0 && (
              <Badge variant="outline" className="mr-2">{approvedCount} זהויות מאושרות</Badge>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 justify-start sm:justify-end">
          <Button variant="outline" size="sm" onClick={() => importFromAutomation.mutate()}
            disabled={importFromAutomation.isPending} className="gap-1">
            <Download className="h-4 w-4" /> ייבא מאוטומציה
          </Button>
          <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending} className="gap-1">
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            שמור הרשאות
          </Button>
        </div>
      </div>

      <Card className="p-4 space-y-4">
        <h3 className="font-medium flex items-center gap-2 justify-start">
          <Phone className="h-4 w-4 shrink-0" />
          WhatsApp — שיחה פרטית
        </h3>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            placeholder="972501234567"
            className="text-left font-mono sm:flex-1"
            dir="ltr"
          />
          <Button type="button" size="sm" onClick={addPhone} className="shrink-0">הוסף מספר</Button>
        </div>
        <ScrollArea className="max-h-48">
          <Table dir="rtl">
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">טלפון</TableHead>
                <TableHead className="text-right w-16">פרטי</TableHead>
                <TableHead className="text-right w-16">קבוצה</TableHead>
                <TableHead className="text-right">Escalation</TableHead>
                <TableHead className="text-right w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {phones.map((row, idx) => (
                <TableRow key={row.phone}>
                  <TableCell className="font-mono text-left" dir="ltr">{row.phone}</TableCell>
                  <TableCell>
                    <Checkbox checked={row.surfaces?.includes("whatsapp_private") ?? true} disabled />
                  </TableCell>
                  <TableCell>
                    <Checkbox
                      checked={row.surfaces?.includes("whatsapp_group") ?? false}
                      onCheckedChange={(c) => {
                        const next = [...phones];
                        const s = new Set(row.surfaces || ["whatsapp_private"]);
                        if (c) s.add("whatsapp_group"); else s.delete("whatsapp_group");
                        next[idx] = { ...row, surfaces: Array.from(s) };
                        setPhones(next);
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={row.dev_escalation_tier || "none"}
                      onValueChange={(v) => {
                        const next = [...phones];
                        next[idx] = {
                          ...row,
                          dev_escalation_tier: v === "none" ? null : (v as "full" | "bugfix"),
                        };
                        setPhones(next);
                      }}
                    >
                      <SelectTrigger className="h-8 text-right"><SelectValue /></SelectTrigger>
                      <SelectContent dir="rtl">
                        <SelectItem value="none">ללא פיתוח</SelectItem>
                        <SelectItem value="bugfix">באגים → Cursor</SelectItem>
                        <SelectItem value="full">מלא (כל הסוכנים)</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Button type="button" variant="ghost" size="sm"
                      onClick={() => setPhones(phones.filter((_, i) => i !== idx))}>×</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>

      <Card className="p-4 space-y-4">
        <h3 className="font-medium flex items-center gap-2 justify-start">
          <Users className="h-4 w-4 shrink-0" />
          WhatsApp — קבוצות (Manus בלבד)
        </h3>
        <p className="text-xs text-muted-foreground">
          מוצגות רק קבוצות שבהן כרמן מחוברת דרך Manus WA — לא קבוצות שסונכרנו מ-Green API של המפעיל.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-start">
          <div className="flex items-center gap-2">
            <Switch checked={requireDirect} onCheckedChange={setRequireDirect} id="require-direct" />
            <Label htmlFor="require-direct" className="cursor-pointer">חובה לפנות «כרמן» ישירות</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={openMemberGroups} onCheckedChange={setOpenMemberGroups} id="open-member" />
            <Label htmlFor="open-member" className="cursor-pointer">כל קבוצת Manus שכרמן חבר בה</Label>
          </div>
        </div>
        <ScrollArea className="h-40 border rounded-md p-2">
          {(manusGroups || []).length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">
              אין עדיין קבוצות Manus — כרמן צריכה לקבל הודעה בקבוצה (או סשן פעיל) כדי שתופיע כאן.
            </p>
          ) : (
            (manusGroups || []).map((g: any) => (
              <label key={g.id} className="flex flex-row-reverse items-center gap-2 py-1 cursor-pointer justify-end">
                <span className="text-sm">{g.group_name}</span>
                <Checkbox checked={groupIds.includes(g.id)} onCheckedChange={() => toggleGroup(g.id)} />
              </label>
            ))
          )}
        </ScrollArea>
        {groupIds.length > 0 && (
          <div className="flex flex-wrap gap-1 justify-start">
            {groupIds.map((id) => (
              <Badge key={id} variant="secondary">{groupName(id)}</Badge>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" size="sm" variant="outline" onClick={addClientGroupRow} className="self-start">
            + לקוח ↔ קבוצה
          </Button>
          <h3 className="font-medium flex items-center gap-2 justify-start">
            <MessageSquare className="h-4 w-4 shrink-0" />
            לקוח ↔ קבוצה (scope)
          </h3>
        </div>
        <p className="text-xs text-muted-foreground">
          איש קשר לקוח מדבר רק בקבוצת הלקוח, רק על הלקוח — לפי info_boundary.
        </p>
        {clientRows.map((row, idx) => (
          <div key={idx} className="grid gap-2 md:grid-cols-4 border rounded p-2">
            <Select value={row.client_id} onValueChange={(v) => {
              const next = [...clientRows];
              const cl = (clients || []).find((c: any) => c.id === v);
              const wg = cl?.whatsapp_group_id && manusGroupIdSet.has(cl.whatsapp_group_id)
                ? cl.whatsapp_group_id
                : row.whatsapp_group_id;
              next[idx] = { ...row, client_id: v, whatsapp_group_id: wg };
              setClientRows(next);
            }}>
              <SelectTrigger className="text-right"><SelectValue placeholder="לקוח" /></SelectTrigger>
              <SelectContent dir="rtl">
                {(clients || []).map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={row.whatsapp_group_id} onValueChange={(v) => {
              const next = [...clientRows];
              next[idx] = { ...row, whatsapp_group_id: v };
              setClientRows(next);
            }}>
              <SelectTrigger className="text-right"><SelectValue placeholder="קבוצה Manus" /></SelectTrigger>
              <SelectContent dir="rtl">
                {(manusGroups || []).map((g: any) => (
                  <SelectItem key={g.id} value={g.id}>{g.group_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex flex-row-reverse items-center gap-2 justify-end">
              <span className="text-xs">אנשי קשר</span>
              <Checkbox checked={row.allow_client_contacts}
                onCheckedChange={(c) => {
                  const next = [...clientRows];
                  next[idx] = { ...row, allow_client_contacts: !!c };
                  setClientRows(next);
                }} />
            </div>
            <Select value={row.info_boundary} onValueChange={(v: "external_only" | "full") => {
              const next = [...clientRows];
              next[idx] = { ...row, info_boundary: v };
              setClientRows(next);
            }}>
              <SelectTrigger className="text-right"><SelectValue /></SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value="external_only">מידע חיצוני בלבד</SelectItem>
                <SelectItem value="full">מלא (מנהלים)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ))}
      </Card>

      <Card className="p-4">
        <Label className="block mb-2">הודעת deny (אופציונלי)</Label>
        <Input value={denyMessage} onChange={(e) => setDenyMessage(e.target.value)}
          placeholder="אני לא מזהה אותך…" className="text-right" />
      </Card>
    </div>
  );
}
