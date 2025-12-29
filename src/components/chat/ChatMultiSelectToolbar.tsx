import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tag, X } from "lucide-react";
import { toast } from "sonner";

interface Contact {
  id: string;
  contact_type: 'client' | 'lead' | 'group' | 'unknown';
  sender_phone?: string;
}

interface ChatMultiSelectToolbarProps {
  selectedContacts: Contact[];
  onClearSelection: () => void;
  tenantId: string;
}

export function ChatMultiSelectToolbar({ 
  selectedContacts, 
  onClearSelection,
  tenantId 
}: ChatMultiSelectToolbarProps) {
  const queryClient = useQueryClient();

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

  return (
    <div className="flex items-center gap-2 p-2 bg-primary/10 rounded-lg">
      <span className="text-sm font-medium">
        {selectedContacts.length} נבחרו
      </span>
      
      <div className="flex items-center gap-1">
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
