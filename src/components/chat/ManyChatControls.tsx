import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Pencil, Check, X, Tag } from "lucide-react";

interface ManyChatControlsProps {
  contactId: string;
  contactType: "client" | "lead";
  subscriberId: string | null;
  tenantId: string;
}

export function ManyChatControls({ contactId, contactType, subscriberId, tenantId }: ManyChatControlsProps) {
  const [isEditingId, setIsEditingId] = useState(false);
  const [editedId, setEditedId] = useState(subscriberId || "");
  const queryClient = useQueryClient();

  // Fetch ManyChat tags
  const { data: tags, isError: tagsError } = useQuery({
    queryKey: ["manychat-tags", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("get-manychat-tags", {
        body: { tenantId },
      });
      if (error) throw error;
      return data?.tags || [];
    },
    enabled: !!tenantId,
  });

  // Update subscriber ID mutation
  const updateIdMutation = useMutation({
    mutationFn: async (newId: string) => {
      const table = contactType === "client" ? "clients" : "leads";
      const { error } = await supabase
        .from(table)
        .update({ manychat_subscriber_id: newId })
        .eq("id", contactId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Subscriber ID עודכן בהצלחה");
      setIsEditingId(false);
      queryClient.invalidateQueries({ queryKey: ["contact", contactId] });
    },
    onError: (error) => {
      toast.error("שגיאה בעדכון Subscriber ID");
      console.error(error);
    },
  });

  // Add tag mutation
  const addTagMutation = useMutation({
    mutationFn: async (tagId: number) => {
      const { error } = await supabase.functions.invoke("add-manychat-tag", {
        body: {
          subscriberId,
          tagId,
          tenantId,
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("הטאג נוסף בהצלחה");
      queryClient.invalidateQueries({ queryKey: ["manychat-tags", tenantId] });
    },
    onError: (error) => {
      toast.error("שגיאה בהוספת טאג");
      console.error(error);
    },
  });

  return (
    <div className="space-y-3 p-3 bg-muted/30 rounded-lg border">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400">
          ManyChat
        </Badge>
      </div>

      {/* Subscriber ID */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Subscriber ID</Label>
        {isEditingId ? (
          <div className="flex gap-2">
            <Input
              value={editedId}
              onChange={(e) => setEditedId(e.target.value)}
              placeholder="הזן Subscriber ID"
              className="h-8 text-sm"
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => updateIdMutation.mutate(editedId)}
              disabled={updateIdMutation.isPending}
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setIsEditingId(false);
                setEditedId(subscriberId || "");
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm">{subscriberId || "לא מוגדר"}</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsEditingId(true)}
            >
              <Pencil className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {/* Tags */}
      {subscriberId && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <Tag className="h-3 w-3" />
            הוסף טאג
          </Label>
          {tagsError ? (
            <p className="text-xs text-destructive">לא ניתן לטעון תגיות. בדוק שהאינטגרציה פעילה בהגדרות ManyChat.</p>
          ) : tags && tags.length > 0 ? (
            <Select
              onValueChange={(value) => addTagMutation.mutate(parseInt(value))}
              disabled={addTagMutation.isPending}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="בחר טאג..." />
              </SelectTrigger>
              <SelectContent>
                {tags.map((tag: any) => (
                  <SelectItem key={tag.id} value={tag.id.toString()}>
                    {tag.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-xs text-muted-foreground">אין תגיות זמינות</p>
          )}
        </div>
      )}
    </div>
  );
}
