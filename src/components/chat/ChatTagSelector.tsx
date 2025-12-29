import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tag, Settings } from "lucide-react";
import { toast } from "sonner";
import { ChatTagsManager } from "./ChatTagsManager";

interface ChatTag {
  id: string;
  name: string;
  color: string;
}

interface ChatTagSelectorProps {
  contactId: string;
  contactType: 'client' | 'lead' | 'group' | 'unknown';
  senderPhone?: string;
}

export function ChatTagSelector({ contactId, contactType, senderPhone }: ChatTagSelectorProps) {
  const { tenantId } = useCurrentTenant();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [isManagerOpen, setIsManagerOpen] = useState(false);

  // Fetch all available tags
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
      return data as ChatTag[];
    },
    enabled: !!tenantId,
  });

  // Fetch tags assigned to this contact
  const { data: contactTags = [] } = useQuery({
    queryKey: ['chat-contact-tags', contactId, contactType, senderPhone],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !tenantId) return [];

      let query = supabase
        .from('chat_contact_tags')
        .select('tag_id')
        .eq('user_id', user.id)
        .eq('tenant_id', tenantId);

      if (contactType === 'client') {
        query = query.eq('client_id', contactId);
      } else if (contactType === 'lead') {
        query = query.eq('lead_id', contactId);
      } else if (contactType === 'group') {
        query = query.eq('group_id', contactId);
      } else if (contactType === 'unknown' && senderPhone) {
        query = query.eq('sender_phone', senderPhone);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data.map(ct => ct.tag_id);
    },
    enabled: !!tenantId,
  });

  const toggleTagMutation = useMutation({
    mutationFn: async ({ tagId, isAssigned }: { tagId: string; isAssigned: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !tenantId) throw new Error('No user or tenant');

      if (isAssigned) {
        // Remove tag
        let query = supabase
          .from('chat_contact_tags')
          .delete()
          .eq('tag_id', tagId)
          .eq('user_id', user.id);

        if (contactType === 'client') {
          query = query.eq('client_id', contactId);
        } else if (contactType === 'lead') {
          query = query.eq('lead_id', contactId);
        } else if (contactType === 'group') {
          query = query.eq('group_id', contactId);
        } else if (contactType === 'unknown' && senderPhone) {
          query = query.eq('sender_phone', senderPhone);
        }

        const { error } = await query;
        if (error) throw error;
      } else {
        // Add tag
        const insertData: any = {
          tag_id: tagId,
          user_id: user.id,
          tenant_id: tenantId,
        };

        if (contactType === 'client') {
          insertData.client_id = contactId;
        } else if (contactType === 'lead') {
          insertData.lead_id = contactId;
        } else if (contactType === 'group') {
          insertData.group_id = contactId;
        } else if (contactType === 'unknown' && senderPhone) {
          insertData.sender_phone = senderPhone;
        }

        const { error } = await supabase
          .from('chat_contact_tags')
          .insert(insertData);

        if (error) throw error;
      }
    },
    // Optimistic update - update UI immediately before server response
    onMutate: async ({ tagId, isAssigned }) => {
      // Cancel any outgoing refetches to prevent overwrites
      await queryClient.cancelQueries({ queryKey: ['chat-contact-tags', contactId, contactType, senderPhone] });
      await queryClient.cancelQueries({ queryKey: ['contact-tags-for-list', tenantId] });

      // Snapshot previous values for rollback
      const previousContactTags = queryClient.getQueryData<string[]>(['chat-contact-tags', contactId, contactType, senderPhone]);
      const previousListTags = queryClient.getQueryData(['contact-tags-for-list', tenantId]);

      // Optimistically update contact tags
      queryClient.setQueryData<string[]>(['chat-contact-tags', contactId, contactType, senderPhone], (old = []) => {
        if (isAssigned) {
          return old.filter(id => id !== tagId);
        } else {
          return [...old, tagId];
        }
      });

      return { previousContactTags, previousListTags };
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousContactTags !== undefined) {
        queryClient.setQueryData(
          ['chat-contact-tags', contactId, contactType, senderPhone],
          context.previousContactTags
        );
      }
      if (context?.previousListTags !== undefined) {
        queryClient.setQueryData(
          ['contact-tags-for-list', tenantId],
          context.previousListTags
        );
      }
      toast.error('שגיאה בעדכון התגיות');
    },
    onSettled: () => {
      // Sync with server after mutation completes
      queryClient.invalidateQueries({ queryKey: ['chat-contact-tags', contactId, contactType, senderPhone] });
      queryClient.invalidateQueries({ queryKey: ['contact-tags-for-list', tenantId] });
    },
  });

  const handleOpenManager = () => {
    setIsOpen(false);
    setIsManagerOpen(true);
  };

  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-6 w-6 p-0">
            <Tag className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2" align="start" dir="rtl">
          <div className="space-y-1">
            {allTags.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-2">
                אין תגיות זמינות
              </div>
            ) : (
              allTags.map((tag) => {
                const isAssigned = contactTags.includes(tag.id);
                return (
                  <div
                    key={tag.id}
                    className="flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer"
                    onClick={() => toggleTagMutation.mutate({ tagId: tag.id, isAssigned })}
                  >
                    <Checkbox checked={isAssigned} />
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="text-sm flex-1">{tag.name}</span>
                  </div>
                );
              })
            )}
          </div>

          <div className="border-t border-border mt-2 pt-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-muted-foreground hover:text-foreground"
              onClick={handleOpenManager}
            >
              <Settings className="h-4 w-4 ml-2" />
              ניהול תגיות
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <ChatTagsManager
        open={isManagerOpen}
        onOpenChange={setIsManagerOpen}
        showTrigger={false}
      />
    </>
  );
}

interface ContactTagBadgesProps {
  contactId: string;
  contactType: 'client' | 'lead' | 'group' | 'unknown';
  senderPhone?: string;
  allTags: ChatTag[];
  contactTagIds: string[];
}

export function ContactTagBadges({ allTags, contactTagIds }: ContactTagBadgesProps) {
  const assignedTags = allTags.filter(tag => contactTagIds.includes(tag.id));
  
  if (assignedTags.length === 0) return null;
  
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {assignedTags.map((tag) => (
        <Badge
          key={tag.id}
          variant="outline"
          className="text-[10px] px-1.5 py-0 h-4"
          style={{ 
            backgroundColor: `${tag.color}20`,
            borderColor: tag.color,
            color: tag.color 
          }}
        >
          {tag.name}
        </Badge>
      ))}
    </div>
  );
}
