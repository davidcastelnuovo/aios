import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Tag, Settings, Search, X } from "lucide-react";
import { toast } from "sonner";
import { ChatTagsManager } from "@/components/chat/ChatTagsManager";

interface ChatTag {
  id: string;
  name: string;
  color: string;
}

interface LeadTagSelectorProps {
  leadId: string;
  /** Pre-fetched tag IDs to avoid N+1 queries */
  initialTagIds?: string[];
}

export function LeadTagSelector({ leadId, initialTagIds }: LeadTagSelectorProps) {
  const { tenantId } = useCurrentTenant();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [isManagerOpen, setIsManagerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Reset search when popover closes
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) setSearchQuery("");
  };

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
    staleTime: 60000,
  });

  // Fetch lead's tags if not provided
  const { data: fetchedContactTags = [] } = useQuery({
    queryKey: ['lead-tags', leadId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !tenantId) return [];

      const { data, error } = await supabase
        .from('chat_contact_tags')
        .select('tag_id')
        .eq('lead_id', leadId)
        .eq('tenant_id', tenantId);

      if (error) throw error;
      return data.map(ct => ct.tag_id);
    },
    enabled: !!tenantId && !!leadId && initialTagIds === undefined,
    staleTime: 30000,
  });

  const contactTags = initialTagIds ?? fetchedContactTags;
  
  const filteredTags = allTags.filter(tag => 
    tag.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleTagMutation = useMutation({
    mutationFn: async ({ tagId, isAssigned }: { tagId: string; isAssigned: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !tenantId) throw new Error('No user or tenant');

      if (isAssigned) {
        const { error } = await supabase
          .from('chat_contact_tags')
          .delete()
          .eq('tag_id', tagId)
          .eq('lead_id', leadId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('chat_contact_tags')
          .insert({
            tag_id: tagId,
            user_id: user.id,
            tenant_id: tenantId,
            lead_id: leadId,
          });

        if (error) throw error;
      }
    },
    onMutate: async ({ tagId, isAssigned }) => {
      await queryClient.cancelQueries({ queryKey: ['lead-tags', leadId] });
      await queryClient.cancelQueries({ queryKey: ['leads-tags-bulk', tenantId] });

      const previousTags = queryClient.getQueryData<string[]>(['lead-tags', leadId]);

      queryClient.setQueryData<string[]>(['lead-tags', leadId], (old = []) => {
        if (isAssigned) {
          return old.filter(id => id !== tagId);
        } else {
          return [...old, tagId];
        }
      });

      return { previousTags };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousTags !== undefined) {
        queryClient.setQueryData(['lead-tags', leadId], context.previousTags);
      }
      toast.error('שגיאה בעדכון התגיות');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-tags', leadId] });
      // Invalidate all visible-leads tag queries (they use different queryKeys with lead IDs)
      queryClient.invalidateQueries({ queryKey: ['leads-tags-visible'] });
      queryClient.invalidateQueries({ queryKey: ['leads-tags-table'] });
    },
  });

  const handleOpenManager = () => {
    setIsOpen(false);
    setIsManagerOpen(true);
  };

  return (
    <>
      <Popover open={isOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="icon" className="h-8 w-8" title="תגיות">
            <Tag className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2 bg-background z-[100]" align="start" dir="rtl">
          {/* Search input */}
          {allTags.length > 3 && (
            <div className="relative mb-2">
              <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="חיפוש תגית..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-8 h-8 text-sm"
                dir="rtl"
              />
            </div>
          )}

          {/* Tags list with scroll */}
          <div className="space-y-1 max-h-[250px] overflow-y-auto">
            {allTags.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-2">
                אין תגיות זמינות
              </div>
            ) : filteredTags.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-2">
                לא נמצאו תגיות
              </div>
            ) : (
              filteredTags.map((tag) => {
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

interface LeadTagBadgesProps {
  allTags: ChatTag[];
  tagIds: string[];
}

export function LeadTagBadges({ allTags, tagIds }: LeadTagBadgesProps) {
  const assignedTags = allTags.filter(tag => tagIds.includes(tag.id));
  
  if (assignedTags.length === 0) return null;
  
  return (
    <div className="flex flex-wrap gap-1">
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

interface LeadTagBadgesEditableProps {
  leadId: string;
  allTags: ChatTag[];
  tagIds: string[];
}

export function LeadTagBadgesEditable({ leadId, allTags, tagIds }: LeadTagBadgesEditableProps) {
  const queryClient = useQueryClient();
  
  const removeTagMutation = useMutation({
    mutationFn: async (tagId: string) => {
      const { error } = await supabase
        .from('chat_contact_tags')
        .delete()
        .eq('tag_id', tagId)
        .eq('lead_id', leadId);
      if (error) throw error;
    },
    onMutate: async (tagId) => {
      await queryClient.cancelQueries({ queryKey: ['lead-tags', leadId] });
      const previousTags = queryClient.getQueryData<string[]>(['lead-tags', leadId]);
      queryClient.setQueryData<string[]>(['lead-tags', leadId], (old = []) => 
        old.filter(id => id !== tagId)
      );
      return { previousTags };
    },
    onError: (_err, _tagId, context) => {
      if (context?.previousTags) {
        queryClient.setQueryData(['lead-tags', leadId], context.previousTags);
      }
      toast.error('שגיאה בהסרת התגית');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-tags', leadId] });
      queryClient.invalidateQueries({ queryKey: ['leads-tags-visible'] });
      queryClient.invalidateQueries({ queryKey: ['leads-tags-table'] });
    },
  });

  const assignedTags = allTags.filter(tag => tagIds.includes(tag.id));
  
  if (assignedTags.length === 0) return null;
  
  return (
    <div className="flex flex-wrap gap-1">
      {assignedTags.map((tag) => (
        <Badge
          key={tag.id}
          variant="outline"
          className="text-xs px-2 py-0.5 flex items-center gap-1"
          style={{ 
            backgroundColor: `${tag.color}20`,
            borderColor: tag.color,
            color: tag.color 
          }}
        >
          {tag.name}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              removeTagMutation.mutate(tag.id);
            }}
            className="hover:bg-black/10 rounded-full p-0.5 -mr-0.5"
            disabled={removeTagMutation.isPending}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
    </div>
  );
}
