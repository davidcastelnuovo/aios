import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Plus, Trash2, Eye, EyeOff, Copy, ExternalLink, Pencil } from "lucide-react";
import { toast } from "sonner";

interface ClientCredentialsTabProps {
  clientId: string;
  tenantId: string;
}

const emptyCred = { service_name: "", username: "", password: "", url: "", notes: "" };

export function ClientCredentialsTab({ clientId, tenantId }: ClientCredentialsTabProps) {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newCred, setNewCred] = useState(emptyCred);
  const [editCred, setEditCred] = useState(emptyCred);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  const { data: credentials = [] } = useQuery({
    queryKey: ["client-credentials", clientId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("client_credentials")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId && !!tenantId,
  });

  const togglePassword = (id: string) => {
    setVisiblePasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} הועתק`);
  };

  const handleAdd = async () => {
    if (!newCred.service_name.trim()) return;
    try {
      const { error } = await (supabase as any).from("client_credentials").insert({
        client_id: clientId,
        tenant_id: tenantId,
        service_name: newCred.service_name.trim(),
        username: newCred.username.trim() || null,
        password: newCred.password.trim() || null,
        url: newCred.url.trim() || null,
        notes: newCred.notes.trim() || null,
      });
      if (error) throw error;
      toast.success("פרטי גישה נוספו");
      setAdding(false);
      setNewCred(emptyCred);
      queryClient.invalidateQueries({ queryKey: ["client-credentials", clientId] });
    } catch {
      toast.error("שגיאה בשמירה");
    }
  };

  const handleEdit = (cred: any) => {
    setEditingId(cred.id);
    setEditCred({
      service_name: cred.service_name || "",
      username: cred.username || "",
      password: cred.password || "",
      url: cred.url || "",
      notes: cred.notes || "",
    });
  };

  const handleUpdate = async () => {
    if (!editingId || !editCred.service_name.trim()) return;
    try {
      const { error } = await (supabase as any).from("client_credentials").update({
        service_name: editCred.service_name.trim(),
        username: editCred.username.trim() || null,
        password: editCred.password.trim() || null,
        url: editCred.url.trim() || null,
        notes: editCred.notes.trim() || null,
      }).eq("id", editingId);
      if (error) throw error;
      toast.success("פרטי גישה עודכנו");
      setEditingId(null);
      setEditCred(emptyCred);
      queryClient.invalidateQueries({ queryKey: ["client-credentials", clientId] });
    } catch {
      toast.error("שגיאה בעדכון");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await (supabase as any).from("client_credentials").delete().eq("id", id);
      if (error) throw error;
      toast.success("נמחק");
      queryClient.invalidateQueries({ queryKey: ["client-credentials", clientId] });
    } catch {
      toast.error("שגיאה במחיקה");
    }
  };

  const CredForm = ({ values, onChange, onSave, onCancel, saveLabel }: {
    values: typeof emptyCred;
    onChange: (v: typeof emptyCred) => void;
    onSave: () => void;
    onCancel: () => void;
    saveLabel: string;
  }) => (
    <Card className="p-3 space-y-2 bg-muted/30">
      <Input placeholder="שם שירות *" value={values.service_name} onChange={e => onChange({ ...values, service_name: e.target.value })} className="text-sm h-8 text-right" dir="rtl" />
      <div className="grid grid-cols-2 gap-2">
        <Input placeholder="שם משתמש" value={values.username} onChange={e => onChange({ ...values, username: e.target.value })} className="text-sm h-8 text-right" dir="rtl" />
        <Input placeholder="סיסמה" value={values.password} onChange={e => onChange({ ...values, password: e.target.value })} className="text-sm h-8 text-right" dir="rtl" type="text" />
      </div>
      <Input placeholder="כתובת URL" value={values.url} onChange={e => onChange({ ...values, url: e.target.value })} className="text-sm h-8 text-right" dir="rtl" />
      <Input placeholder="הערות" value={values.notes} onChange={e => onChange({ ...values, notes: e.target.value })} className="text-sm h-8 text-right" dir="rtl" />
      <div className="flex gap-2 justify-start">
        <Button size="sm" className="h-7 text-xs" disabled={!values.service_name.trim()} onClick={onSave}>{saveLabel}</Button>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onCancel}>ביטול</Button>
      </div>
    </Card>
  );

  return (
    <div className="space-y-3" dir="rtl">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => { setAdding(true); setEditingId(null); }}>
          <Plus className="h-3.5 w-3.5" />
          הוסף פרטי גישה
        </Button>
        <h3 className="font-semibold text-sm">פרטי גישה</h3>
      </div>

      {adding && (
        <CredForm
          values={newCred}
          onChange={setNewCred}
          onSave={handleAdd}
          onCancel={() => { setAdding(false); setNewCred(emptyCred); }}
          saveLabel="שמור"
        />
      )}

      {credentials.length > 0 ? (
        <div className="space-y-2">
          {credentials.map((cred: any) => (
            editingId === cred.id ? (
              <CredForm
                key={cred.id}
                values={editCred}
                onChange={setEditCred}
                onSave={handleUpdate}
                onCancel={() => { setEditingId(null); setEditCred(emptyCred); }}
                saveLabel="עדכן"
              />
            ) : (
              <Card key={cred.id} className="p-3 space-y-1.5 group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => handleDelete(cred.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => handleEdit(cred)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </div>
                  <span className="font-medium text-sm">{cred.service_name}</span>
                </div>
                {cred.url && (
                  <div className="flex items-center gap-1 justify-end text-xs">
                    <a href={cred.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate max-w-[250px]">{cred.url}</a>
                    <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                  </div>
                )}
                {cred.username && (
                  <div className="flex items-center gap-1 justify-end text-xs">
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => copyToClipboard(cred.username, "שם משתמש")}>
                      <Copy className="h-2.5 w-2.5" />
                    </Button>
                    <span className="text-muted-foreground">{cred.username}</span>
                    <span className="text-muted-foreground">:משתמש</span>
                  </div>
                )}
                {cred.password && (
                  <div className="flex items-center gap-1 justify-end text-xs">
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => copyToClipboard(cred.password, "סיסמה")}>
                      <Copy className="h-2.5 w-2.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => togglePassword(cred.id)}>
                      {visiblePasswords[cred.id] ? <EyeOff className="h-2.5 w-2.5" /> : <Eye className="h-2.5 w-2.5" />}
                    </Button>
                    <span className="text-muted-foreground font-mono">
                      {visiblePasswords[cred.id] ? cred.password : "••••••••"}
                    </span>
                    <span className="text-muted-foreground">:סיסמה</span>
                  </div>
                )}
                {cred.notes && (
                  <p className="text-xs text-muted-foreground text-right">{cred.notes}</p>
                )}
              </Card>
            )
          ))}
        </div>
      ) : !adding && (
        <p className="text-sm text-muted-foreground text-center py-4">אין פרטי גישה שמורים</p>
      )}
    </div>
  );
}
