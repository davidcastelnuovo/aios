import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tag, X, CheckCheck, MinusCircle, CheckSquare } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

interface Contact {
  id: string;
  contact_type: 'client' | 'lead' | 'group' | 'unknown';
  sender_phone?: string;
}

interface ChatMultiSelectToolbarProps {
  selectedContacts: Contact[];
  onClearSelection: () => void;
  onSelectAll?: () => void;
  tenantId: string;
  totalCount?: number;
}

export function ChatMultiSelectToolbar({ 
  selectedContacts, 
  onClearSelection,
  onSelectAll,
  tenantId,
  totalCount = 0,
}: ChatMultiSelectToolbarProps) {
  const queryClient = useQueryClient();
  const [removeTagOpen, setRemoveTagOpen] = useState(false);

  // Fetch available tags
  const { data: allTags = [] } = useQuery({
    queryKey: ['chat-tags', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('chat_tags')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  // Add tag to selected
  const addTagToSelectedMutation = useMutation({
    mutationFn: async (tagId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !tenantId) throw new Error('No user or tenant');

      const inserts = selectedContacts.map(contact => {
        const base: any = {
          tag_id: tagId,
          user_id: user.id,
          tenant_id: tenantId,
        };

        if (contact.contact_type === 'client') {
          base.client_id = contact.id;
        } else if (contact.contact_type === 'lead') {
          base.lead_id = contact.id;
        } else if (contact.contact_type === 'group') {
          base.group_id = contact.id;
        } else if (contact.contact_type === 'unknown' && contact.sender_phone) {
          base.sender_phone = contact.sender_phone;
        }

        return base;
      }).filter(item => item.client_id || item.lead_id || item.group_id || item.sender_phone);

      // Insert with upsert to handle existing tags
      for (const insert of inserts) {
        await supabase
          .from('chat_contact_tags')
          .upsert(insert, { onConflict: 'tag_id,client_id' })
          .select();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-contact-tags'] });
      queryClient.invalidateQueries({ queryKey: ['contact-tags-for-list'] });
      toast.success(`התג נוסף ל-${selectedContacts.length} צ'אטים`);
    },
    onError: () => {
      toast.error('שגיאה בהוספת התג');
    },
  });

  // Remove tag from selected
  const removeTagFromSelectedMutation = useMutation({
    mutationFn: async (tagId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !tenantId) throw new Error('No user or tenant');

      for (const contact of selectedContacts) {
        let query = supabase
          .from('chat_contact_tags')
          .delete()
          .eq('tag_id', tagId)
          .eq('user_id', user.id)
          .eq('tenant_id', tenantId);

        if (contact.contact_type === 'client') {
          query = query.eq('client_id', contact.id);
        } else if (contact.contact_type === 'lead') {
          query = query.eq('lead_id', contact.id);
        } else if (contact.contact_type === 'group') {
          query = query.eq('group_id', contact.id);
        } else if (contact.contact_type === 'unknown' && contact.sender_phone) {
          query = query.eq('sender_phone', contact.sender_phone);
        }

        await query;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-contact-tags'] });
      queryClient.invalidateQueries({ queryKey: ['contact-tags-for-list'] });
      setRemoveTagOpen(false);
      toast.success(`התג הוסר מ-${selectedContacts.length} צ'אטים`);
    },
    onError: () => {
      toast.error('שגיאה בהסרת התג');
    },
  });

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !tenantId) throw new Error('No user or tenant');

      const now = new Date().toISOString();

      for (const contact of selectedContacts) {
        let query = supabase
          .from('chat_messages')
          .update({ read_at: now })
          .eq('tenant_id', tenantId)
          .eq('direction', 'inbound')
          .is('read_at', null);

        if (contact.contact_type === 'client') {
          query = query.eq('client_id', contact.id);
        } else if (contact.contact_type === 'lead') {
          query = query.eq('lead_id', contact.id);
        } else if (contact.contact_type === 'group') {
          query = query.eq('group_id', contact.id);
        } else if (contact.contact_type === 'unknown' && contact.sender_phone) {
          query = query.eq('sender_phone', contact.sender_phone);
        }

        await query;
      }

      // Also upsert to manually_read_contacts
      for (const contact of selectedContacts) {
        const base: any = {
          user_id: user.id,
          tenant_id: tenantId,
          marked_at: now,
        };

        if (contact.contact_type === 'client') {
          base.client_id = contact.id;
        } else if (contact.contact_type === 'lead') {
          base.lead_id = contact.id;
        } else if (contact.contact_type === 'group') {
          base.group_id = contact.id;
        } else if (contact.contact_type === 'unknown' && contact.sender_phone) {
          base.sender_phone = contact.sender_phone;
        }

        await supabase
          .from('manually_read_contacts')
          .upsert(base, { onConflict: 'user_id,client_id' });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-chats'] });
      queryClient.invalidateQueries({ queryKey: ['unknown-contacts'] });
      toast.success(`${selectedContacts.length} צ'אטים סומנו כנקראו`);
      onClearSelection();
    },
    onError: () => {
      toast.error('שגיאה בסימון כנקרא');
    },
  });

  return (
    <div className="flex items-center gap-2 p-2 bg-primary/10 rounded-lg flex-wrap">
      <span className="text-sm font-medium">
        {selectedContacts.length} נבחרו{totalCount > 0 && ` מתוך ${totalCount}`}
      </span>
      
      <div className="flex items-center gap-1 flex-wrap">
        {/* Select All button */}
        {onSelectAll && (
          <Button size="sm" variant="ghost" onClick={onSelectAll}>
            <CheckSquare className="h-4 w-4 ml-1" />
            בחר הכל
          </Button>
        )}

        {/* Mark as read button */}
        <Button 
          size="sm" 
          variant="ghost"
          onClick={() => markAsReadMutation.mutate()}
          disabled={markAsReadMutation.isPending}
        >
          <CheckCheck className="h-4 w-4 ml-1" />
          נקרא
        </Button>

        {/* Add tag popover */}
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="ghost">
              <Tag className="h-4 w-4 ml-1" />
              תייג
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2" align="start" dir="rtl">
            {allTags.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-2">
                אין תגיות זמינות
              </div>
            ) : (
              <div className="space-y-1">
                {allTags.map((tag: any) => (
                  <div
                    key={tag.id}
                    className="flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer"
                    onClick={() => addTagToSelectedMutation.mutate(tag.id)}
                  >
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="text-sm">{tag.name}</span>
                  </div>
                ))}
              </div>
            )}
          </PopoverContent>
        </Popover>

        {/* Remove tag popover */}
        <Popover open={removeTagOpen} onOpenChange={setRemoveTagOpen}>
          <PopoverTrigger asChild>
            <Button size="sm" variant="ghost">
              <MinusCircle className="h-4 w-4 ml-1" />
              הסר תג
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2" align="start" dir="rtl">
            {allTags.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-2">
                אין תגיות זמינות
              </div>
            ) : (
              <div className="space-y-1">
                {allTags.map((tag: any) => (
                  <div
                    key={tag.id}
                    className="flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer"
                    onClick={() => removeTagFromSelectedMutation.mutate(tag.id)}
                  >
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="text-sm">{tag.name}</span>
                  </div>
                ))}
              </div>
            )}
          </PopoverContent>
        </Popover>

        <Button
          size="sm"
          variant="ghost"
          onClick={onClearSelection}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
