import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Phone, Users, MessageSquare, Shield, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import {
  fetchCarmenManusGroups,
  fetchManusGroupsSyncInfo,
  syncCarmenManusGroups,
} from "@/lib/carmenManusGroups";
import {
  buildPolicyFromAutomation,
  fetchCarmenAutomationConfig,
  mergePrivatePhoneAllowlist,
  type PrivatePhoneRow,
} from "@/lib/carmenAccessAutomation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  const autoSyncedRef = useRef(false);
  const autoManusSyncRef = useRef(false);
  const [phones, setPhones] = useState<PrivatePhoneRow[]>([]);
  const [phonesDirty, setPhonesDirty] = useState(false);
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

  const { data: manusGroups, isLoading: groupsLoading } = useQuery({
    queryKey: ["carmen-manus-groups", tenantId],
    enabled: !!tenantId,
    queryFn: () => fetchCarmenManusGroups(tenantId!),
  });

  const { data: manusSyncInfo } = useQuery({
    queryKey: ["carmen-manus-sync-info", tenantId],
    enabled: !!tenantId,
    queryFn: () => fetchManusGroupsSyncInfo(tenantId!),
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

  const { data: automationCfg, isLoading: automationLoading } = useQuery({
    queryKey: ["carmen-automation-cfg", tenantId, agent.id],
    enabled: !!tenantId && !!agent.id,
    queryFn: () => fetchCarmenAutomationConfig(tenantId!, agent.id),
  });

  const mergedPhones = useMemo(
    () => mergePrivatePhoneAllowlist({
      policyPhones: Array.isArray(policy?.private_phones) ? policy.private_phones : [],
      identities: identities as Array<{
        phone: string;
        display_name?: string | null;
        status?: string;
        surfaces?: string[] | null;
        dev_escalation_tier?: string | null;
      }>,
      automationPhones: automationCfg?.carmen_allowed_phones,
    }),
    [policy?.private_phones, identities, automationCfg?.carmen_allowed_phones],
  );

  const persistPolicy = async (draft: {
    phones: PrivatePhoneRow[];
    groupIds: string[];
    requireDirect: boolean;
    openMemberGroups: boolean;
    denyMessage: string;
  }) => {
    if (!tenantId) throw new Error("חסר tenant");
    const allowedManusGroups = draft.groupIds.filter((id) => manusGroupIdSet.has(id));
    const payload = {
      tenant_id: tenantId,
      agent_id: agent.id,
      private_phones: draft.phones,
      allowed_group_ids: allowedManusGroups,
      require_direct_address: draft.requireDirect,
      open_member_groups: draft.openMemberGroups,
      deny_message_he: draft.denyMessage || null,
      updated_at: new Date().toISOString(),
    };
    const { error: pErr } = await supabase
      .from("carmen_access_policies" as any)
      .upsert(payload, { onConflict: "tenant_id,agent_id" });
    if (pErr) throw pErr;

    for (const entry of draft.phones) {
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
  };

  useEffect(() => {
    if (policyLoading || automationLoading) return;
    if (!phonesDirty) setPhones(mergedPhones);
  }, [mergedPhones, policyLoading, automationLoading, phonesDirty]);

  useEffect(() => {
    if (!policy) return;
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

  const autoSyncFromAutomation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !automationCfg) return;
      const built = buildPolicyFromAutomation(automationCfg, manusGroups || []);
      const draft = {
        phones: built.phones,
        groupIds: built.groupIds,
        requireDirect: built.requireDirectAddress,
        openMemberGroups: built.openMemberGroups,
        denyMessage,
      };
      await persistPolicy(draft);
      setPhonesDirty(false);
      setPhones(draft.phones);
      setGroupIds(draft.groupIds);
      setOpenMemberGroups(draft.openMemberGroups);
      setRequireDirect(draft.requireDirect);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: policyKey });
      qc.invalidateQueries({ queryKey: ["carmen-identities", tenantId] });
      qc.invalidateQueries({ queryKey: ["carmen-manus-groups", tenantId] });
      toast.success("הרשאות סונכרנו אוטומטית מהאוטומציה");
    },
    onError: (e: Error) => toast.error(e.message || "סנכרון אוטומטי נכשל"),
  });

  useEffect(() => {
    if (autoSyncedRef.current || policyLoading || groupsLoading || automationLoading) return;
    if (!tenantId || !automationCfg) return;
    const needsSeed = !policy
      || (automationCfg.carmen_open_member_groups === true && !policy?.open_member_groups)
      || (
        Array.isArray(policy?.private_phones) && policy.private_phones.length === 0
        && (automationCfg.carmen_allowed_phones?.length ?? 0) > 0
      );
    if (!needsSeed) return;
    autoSyncedRef.current = true;
    autoSyncFromAutomation.mutate();
  }, [
    policy,
    policyLoading,
    groupsLoading,
    automationLoading,
    automationCfg,
    tenantId,
  ]);

  const syncManusGroups = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("חסר tenant");
      return syncCarmenManusGroups(tenantId);
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["carmen-manus-groups", tenantId] });
      qc.invalidateQueries({ queryKey: ["carmen-manus-sync-info", tenantId] });
      if (data.warning) {
        toast.warning(`${data.syncedCount ?? 0} קבוצות נטענו — ${data.warning}`);
      } else {
        toast.success(`סונכרנו ${data.syncedCount ?? 0} קבוצות מ-Manus`);
      }
    },
    onError: (e: Error) => toast.error(e.message || "סנכרון קבוצות נכשל"),
  });

  const groupsCountMismatch = !!manusSyncInfo?.hasSync
    && (manusSyncInfo.count || 0) > (manusGroups?.length || 0);

  useEffect(() => {
    if (autoManusSyncRef.current || !tenantId || groupsLoading) return;
    if (syncManusGroups.isPending) return;
    const needsSync = !manusSyncInfo?.hasSync
      || groupsCountMismatch
      || (manusGroups?.length || 0) === 0;
    if (!needsSync) return;
    autoManusSyncRef.current = true;
    syncManusGroups.mutate();
  }, [
    tenantId,
    groupsLoading,
    manusSyncInfo?.hasSync,
    manusSyncInfo?.count,
    manusGroups?.length,
    groupsCountMismatch,
    syncManusGroups.isPending,
  ]);

  const importFromAutomation = useMutation({
    mutationFn: async () => {
      if (!automationCfg) throw new Error("לא נמצאה אוטומציית כרמן לייבוא");
      const built = buildPolicyFromAutomation(automationCfg, manusGroups || []);
      setPhonesDirty(true);
      setPhones(built.phones);
      setGroupIds(built.groupIds);
      setOpenMemberGroups(built.openMemberGroups);
      toast.success("עודכן מהאוטומציה — לחץ שמור להחיל");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const save = useMutation({
    mutationFn: async () => {
      await persistPolicy({ phones, groupIds, requireDirect, openMemberGroups, denyMessage });

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
    },
    onSuccess: () => {
      setPhonesDirty(false);
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
    setPhonesDirty(true);
    setPhones([...phones, { phone: p, surfaces: ["whatsapp_private"], dev_escalation_tier: null, source: "policy" }]);
    setNewPhone("");
  };

  const privateStatusLabel = (row: PrivatePhoneRow) => {
    if (row.status === "approved") return "מאושר";
    if (row.status === "pending") return "ממתין";
    if (row.source === "automation") return "אוטומציה";
    if (row.source === "policy") return "מדיניות";
    return "מאושר";
  };

  const toggleGroup = (id: string) => {
    if (openMemberGroups) return;
    setGroupIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const selectAllGroups = () => {
    if (openMemberGroups) return;
    setGroupIds((manusGroups || []).map((g: { id: string }) => g.id));
  };

  const clearAllGroups = () => {
    if (openMemberGroups) return;
    setGroupIds([]);
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

  if (policyLoading || groupsLoading || automationLoading || autoSyncFromAutomation.isPending) {
    return (
      <div className="flex justify-center py-12" dir="rtl">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-6" dir="rtl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1 text-right flex-1">
          <h2 className="text-lg font-semibold flex items-center gap-2 justify-end">
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
        <div className="flex flex-wrap gap-2 justify-end shrink-0">
          <Button variant="outline" size="sm" onClick={() => syncManusGroups.mutate()}
            disabled={syncManusGroups.isPending} className="gap-1">
            {syncManusGroups.isPending
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <RefreshCw className="h-4 w-4" />}
            סנכרן קבוצות מ-Manus
          </Button>
          <Button variant="outline" size="sm" onClick={() => importFromAutomation.mutate()}
            disabled={importFromAutomation.isPending || !automationCfg} className="gap-1">
            <RefreshCw className="h-4 w-4" /> סנכרן מאוטומציה
          </Button>
          <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending} className="gap-1">
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            שמור הרשאות
          </Button>
        </div>
      </div>

      <Card className="p-4 space-y-4 w-full">
        <h3 className="font-medium flex items-center gap-2 justify-end">
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
                <TableHead className="text-right">שם</TableHead>
                <TableHead className="text-right">טלפון</TableHead>
                <TableHead className="text-right w-20">סטטוס</TableHead>
                <TableHead className="text-right w-16">פרטי</TableHead>
                <TableHead className="text-right w-16">קבוצה</TableHead>
                <TableHead className="text-right">Escalation</TableHead>
                <TableHead className="text-right w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {phones.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">
                    אין עדיין מורשים לשיחה פרטית — הוסף מספר או סנכרן מאוטומציה.
                  </TableCell>
                </TableRow>
              )}
              {phones.map((row, idx) => (
                <TableRow key={row.phone}>
                  <TableCell className="text-right">{row.label || "—"}</TableCell>
                  <TableCell className="font-mono text-left" dir="ltr">{row.phone}</TableCell>
                  <TableCell>
                    <Badge variant={row.status === "approved" || row.source === "policy" ? "default" : "secondary"} className="text-[10px]">
                      {privateStatusLabel(row)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Checkbox checked={row.surfaces?.includes("whatsapp_private") ?? true} disabled />
                  </TableCell>
                  <TableCell>
                    <Checkbox
                      checked={row.surfaces?.includes("whatsapp_group") ?? false}
                      onCheckedChange={(c) => {
                        setPhonesDirty(true);
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
                        setPhonesDirty(true);
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
                      onClick={() => { setPhonesDirty(true); setPhones(phones.filter((_, i) => i !== idx)); }}>×</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>

      <Card className="p-4 space-y-4 w-full">
        <h3 className="font-medium flex items-center gap-2 justify-end">
          <Users className="h-4 w-4 shrink-0" />
          באילו קבוצות כרמן מורשית להגיב?
        </h3>

        <Alert className="text-right" dir="rtl">
          <AlertDescription className="text-xs space-y-1">
            <p><strong>איך זה עובד:</strong> כרמן מגיבה בקבוצה רק אם (א) הקבוצה מורשית כאן, (ב) מישהו פונה לה ישירות («כרמן…» אם המתג למטה פעיל), ו-(ג) השולח מזוהה ומורשה.</p>
            <p><strong>רשימה ידנית:</strong> סמן קבוצות Manus — רק בהן כרמן תענה.</p>
            <p><strong>כל קבוצות Manus:</strong> כל קבוצה שכרמן חברה בה ב-Manus — בלי לסמן אחת־אחת.</p>
            <p className="text-muted-foreground">לא מוצגות קבוצות Green API (הטלפון שלך לצ׳אט/דיוור) — רק Manus של כרמן.</p>
          </AlertDescription>
        </Alert>

        {groupsCountMismatch && (
          <Alert variant="destructive" className="text-right" dir="rtl">
            <AlertDescription className="text-xs">
              מ-Manus ידוע על {manusSyncInfo?.count} קבוצות, אבל מוצגות רק {(manusGroups || []).length}.
              לחץ «סנכרן קבוצות מ-Manus» לרענון מלא מה-Gateway.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            {syncManusGroups.isPending
              ? "מסנכרן קבוצות מ-Manus…"
              : manusSyncInfo?.hasSync
                ? `${(manusGroups || []).length} קבוצות מ-Manus · סונכרון אחרון: ${manusSyncInfo.syncedAt ? new Date(manusSyncInfo.syncedAt).toLocaleString("he-IL") : "—"}`
                : "טרם בוצע סנכרון מ-Manus — מסנכרן אוטומטית…"}
          </span>
          {!openMemberGroups && (manusGroups || []).length > 0 && (
            <span>{groupIds.length} / {(manusGroups || []).length} מסומנות להגיבה</span>
          )}
        </div>

        <div className="space-y-2 w-full">
          <div className="flex w-full flex-row-reverse items-center justify-between gap-3 rounded-md border px-3 py-2">
            <Label htmlFor="require-direct" className="cursor-pointer text-right flex-1">
              חובה לפנות «כרמן» ישירות (לא מגיבה לשיחה עליה בגוף שלישי)
            </Label>
            <Switch checked={requireDirect} onCheckedChange={setRequireDirect} id="require-direct" />
          </div>
          <div className="flex w-full flex-row-reverse items-center justify-between gap-3 rounded-md border px-3 py-2 bg-muted/30">
            <Label htmlFor="open-member" className="cursor-pointer text-right flex-1">
              <span className="font-medium">כל קבוצות Manus</span>
              <span className="block text-[11px] text-muted-foreground font-normal">
                כרמן מורשית בכל קבוצה שבה היא חברה — הרשימה למטה להצגה בלבד
              </span>
            </Label>
            <Switch
              checked={openMemberGroups}
              onCheckedChange={(v) => {
                setOpenMemberGroups(v);
                if (v) setGroupIds((manusGroups || []).map((g: { id: string }) => g.id));
              }}
              id="open-member"
            />
          </div>
        </div>

        {!openMemberGroups && (manusGroups || []).length > 0 && (
          <div className="flex flex-wrap gap-2 justify-end">
            <Button type="button" variant="outline" size="sm" onClick={selectAllGroups}>סמן את כולן</Button>
            <Button type="button" variant="ghost" size="sm" onClick={clearAllGroups}>נקה בחירה</Button>
          </div>
        )}

        <ScrollArea className="h-64 w-full border rounded-md p-2">
          {(manusGroups || []).length === 0 ? (
            <div className="text-xs text-muted-foreground text-right space-y-2 py-4 px-2">
              <p className="font-medium text-foreground">אין עדיין קבוצות Manus לרשימה</p>
              <p>לחץ <strong>סנכרן קבוצות מ-Manus</strong> למשוך את כל הקבוצות שבהן כרמן חברה.</p>
            </div>
          ) : (
            (manusGroups || []).map((g: any) => {
              const allowed = openMemberGroups || groupIds.includes(g.id);
              return (
                <label
                  key={g.id}
                  className={`flex w-full items-center gap-2 py-1.5 px-1 ${openMemberGroups ? "opacity-80" : "cursor-pointer"}`}
                  dir="rtl"
                >
                  <Checkbox
                    className="shrink-0"
                    checked={allowed}
                    disabled={openMemberGroups}
                    onCheckedChange={() => toggleGroup(g.id)}
                  />
                  <span className="min-w-0 flex-1 text-sm text-right truncate">{g.group_name}</span>
                  {allowed && (
                    <Badge variant="outline" className="text-[10px] shrink-0">מורשה להגיב</Badge>
                  )}
                </label>
              );
            })
          )}
        </ScrollArea>
        {!openMemberGroups && groupIds.length > 0 && (
          <p className="text-[11px] text-muted-foreground text-right">
            נשמרו {groupIds.length} קבוצות מורשות — כרמן תענה בהן בלבד (בנוסף לבדיקת זהות שולח).
          </p>
        )}
      </Card>

      <Card className="p-4 space-y-4 w-full">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" size="sm" variant="outline" onClick={addClientGroupRow} className="self-end">
            + לקוח ↔ קבוצה
          </Button>
          <h3 className="font-medium flex items-center gap-2 justify-end">
            <MessageSquare className="h-4 w-4 shrink-0" />
            לקוח ↔ קבוצה (scope)
          </h3>
        </div>
        <p className="text-xs text-muted-foreground text-right">
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

      <Card className="p-4 w-full">
        <Label className="block mb-2 text-right">הודעת deny (אופציונלי)</Label>
        <Input value={denyMessage} onChange={(e) => setDenyMessage(e.target.value)}
          placeholder="אני לא מזהה אותך…" className="text-right" />
      </Card>
    </div>
  );
}
