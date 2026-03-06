import { useState, useMemo, useCallback, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useTenantPath } from "@/hooks/useTenantPath";
import { useUserAgencies } from "@/hooks/useUserAgencies";
import { useAgency } from "@/contexts/AgencyContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { MessageCircle, Search, Settings, Pencil, Trash2, Tags, SquareCheck, CheckCheck } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import ChatView from "@/components/chat/ChatView";
import { EditClientDialog } from "@/components/forms/EditClientDialog";
import { EditLeadDialog } from "@/components/forms/EditLeadDialog";
import { ChatTagsManager } from "@/components/chat/ChatTagsManager";
import { ChatTagSelector, ContactTagBadges } from "@/components/chat/ChatTagSelector";
import { ChatMultiSelectToolbar } from "@/components/chat/ChatMultiSelectToolbar";

interface Contact {
  id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  agency_id: string | null;
  agency_name: string | null;
  manychat_subscriber_id: string | null;
  active_chat_provider: string | null;
  unread_count: number;
  contact_type: 'client' | 'lead' | 'group' | 'unknown';
  last_message_at: string | null;
  sender_phone?: string;
  is_blocked?: boolean;
  has_messages?: boolean;
  whatsapp_avatar_url?: string | null;
}

const normalizePhone = (phone?: string | null) => {
  if (!phone) return '';
  const digits = (phone.match(/\d+/g) || []).join('');
  let p = digits.replace(/^00/, '');
  if (p.startsWith('972')) p = p.slice(3);
  if (p.startsWith('0')) p = p.slice(1);
  return p.slice(-9);
};

export default function Chat() {
  const { clientId } = useParams();
  const { tenantId } = useCurrentTenant();
  const { buildPath } = useTenantPath();
  const { userAgencyIds, isLoading: agenciesLoading } = useUserAgencies();
  const { selectedAgency } = useAgency();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebouncedValue(searchTerm, 300);
  const [contactFilter, setContactFilter] = useState<"all" | "clients" | "leads" | "groups" | "unknown">("all");
  const [showTodayOnly, setShowTodayOnly] = useState(false);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [selectedContact, setSelectedContact] = useState<{ id: string; type: 'client' | 'lead' | 'group' | 'unknown'; senderPhone?: string; name?: string } | null>(
    clientId ? { id: clientId, type: 'client' } : null
  );
  const [editingContact, setEditingContact] = useState<{ id: string; type: 'client' | 'lead'; data: any } | null>(null);
  const [showClearHistoryDialog, setShowClearHistoryDialog] = useState(false);
  
  // Multi-select state
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedChatIds, setSelectedChatIds] = useState<Set<string>>(new Set());
  
  // Tag filter state
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);

  // Fetch all tags for display
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

  // Fetch contact-tag associations for the list view
  const { data: allContactTags = [] } = useQuery({
    queryKey: ['contact-tags-for-list', tenantId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !tenantId) return [];

      const { data, error } = await supabase
        .from('chat_contact_tags')
        .select('*')
        .eq('user_id', user.id)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Error fetching contact tags:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!tenantId,
  });


  // Get tags for a specific contact
  const getContactTagIds = useCallback((contact: Contact): string[] => {
    return allContactTags
      .filter(ct => {
        if (contact.contact_type === 'client' && ct.client_id === contact.id) return true;
        if (contact.contact_type === 'lead' && ct.lead_id === contact.id) return true;
        if (contact.contact_type === 'group' && ct.group_id === contact.id) return true;
        if (contact.contact_type === 'unknown' && contact.sender_phone && ct.sender_phone === contact.sender_phone) return true;
        return false;
      })
      .map(ct => ct.tag_id);
  }, [allContactTags]);

  // Fetch active chats (default mode - no search)
  const { data: activeChats, isLoading: activeChatsLoading } = useQuery({
    queryKey: ['active-chats', tenantId, userAgencyIds, selectedAgency],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await supabase.rpc('get_chat_contacts', { p_tenant_id: tenantId });

      if (error) {
        console.error('Error fetching active chats:', error);
        throw error;
      }
      
      return (data || []).map((contact: any) => ({
        id: contact.contact_id,
        name: contact.name,
        contact_name: contact.contact_name,
        phone: contact.phone,
        email: contact.email,
        agency_id: contact.agency_id,
        agency_name: contact.agency_name,
        manychat_subscriber_id: contact.manychat_subscriber_id,
        active_chat_provider: contact.active_chat_provider,
        contact_type: contact.contact_type,
        unread_count: contact.unread_count || 0,
        last_message_at: contact.last_message_at,
        sender_phone: contact.sender_phone,
        is_blocked: contact.is_blocked || false,
        has_messages: true,
        whatsapp_avatar_url: contact.whatsapp_avatar_url,
      }));
    },
    enabled: !!tenantId && !agenciesLoading && !debouncedSearch,
    refetchInterval: 30000,
  });

  // Realtime subscription for whatsapp_groups updates (name changes)
  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel('whatsapp-groups-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'whatsapp_groups',
        },
        (payload) => {
          console.log('📝 Group updated:', payload);
          // Invalidate queries to refresh the list with new group name
          queryClient.invalidateQueries({ queryKey: ['active-chats'] });
          queryClient.invalidateQueries({ queryKey: ['contact'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, queryClient]);


  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ['search-contacts', tenantId, debouncedSearch],
    queryFn: async () => {
      if (!tenantId || !debouncedSearch) return [];

      const { data, error } = await supabase.rpc('search_contacts_for_chat', {
        p_search_term: debouncedSearch,
        p_tenant_id: tenantId,
      });

      if (error) throw error;

      return (data || []).map((contact: any) => ({
        id: contact.contact_id,
        name: contact.name,
        contact_name: contact.contact_name,
        phone: contact.phone,
        email: contact.email,
        agency_id: contact.agency_id,
        agency_name: contact.agency_name,
        manychat_subscriber_id: contact.manychat_subscriber_id,
        active_chat_provider: contact.active_chat_provider,
        contact_type: contact.contact_type,
        unread_count: contact.unread_count || 0,
        last_message_at: contact.last_message_at,
        sender_phone: contact.phone,
        is_blocked: contact.is_blocked || false,
        has_messages: contact.has_messages || false,
        whatsapp_avatar_url: contact.whatsapp_avatar_url,
      }));
    },
    enabled: !!tenantId && !!debouncedSearch,
  });

  const contacts = debouncedSearch ? searchResults : activeChats;
  const isLoading = debouncedSearch ? searchLoading : activeChatsLoading;

  // Fetch unknown contacts
  const { data: unknownContacts = [] } = useQuery({
    queryKey: ['unknown-contacts', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase.rpc('get_unknown_chat_contacts', { p_tenant_id: tenantId });
      if (error) return [];

      return (data || []).map((contact: any) => ({
        id: contact.id,
        name: contact.name,
        sender_phone: contact.sender_phone,
        active_chat_provider: 'green_api',
        last_message_at: contact.last_message_at,
        unread_count: contact.unread_count || 0,
        is_blocked: contact.is_blocked || false,
        contact_type: contact.contact_type as 'unknown',
        agency_id: contact.agency_id,
        agency_name: contact.agency_name,
        whatsapp_avatar_url: contact.whatsapp_avatar_url,
      }));
    },
    enabled: !!tenantId && !debouncedSearch,
    refetchInterval: 30000,
  });

  // Combine all contacts
  const allContactsBeforeTypeFilter = useMemo(() => {
    let base = contacts || [];
    
    if (!debouncedSearch && unknownContacts && unknownContacts.length > 0) {
      const normalizedUnknown = unknownContacts.map(uc => ({
        id: `unknown-${uc.sender_phone || uc.id}`,
        name: uc.name,
        contact_name: null,
        phone: uc.sender_phone,
        email: null,
        agency_id: uc.agency_id || null,
        agency_name: uc.agency_name || null,
        manychat_subscriber_id: null,
        active_chat_provider: uc.active_chat_provider,
        contact_type: 'unknown' as const,
        unread_count: uc.unread_count || 0,
        last_message_at: uc.last_message_at,
        sender_phone: uc.sender_phone,
        is_blocked: uc.is_blocked || false,
        has_messages: true,
        whatsapp_avatar_url: uc.whatsapp_avatar_url || null,
      }));
      
      const combined = [...base, ...normalizedUnknown];
      // Sort combined list by last_message_at descending (newest first)
      return combined.sort((a, b) => {
        const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
        const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
        return bTime - aTime;
      });
    }
    
    return base;
  }, [contacts, unknownContacts, debouncedSearch]);

  const todayParts = useMemo(() => {
    const t = new Date();
    return { y: t.getFullYear(), m: t.getMonth(), d: t.getDate() };
  }, []);

  const isTodayLocal = (iso?: string | null) => {
    if (!iso) return false;
    const d = new Date(iso);
    return d.getFullYear() === todayParts.y && d.getMonth() === todayParts.m && d.getDate() === todayParts.d;
  };


  // Filter contacts
  const filteredContacts = useMemo(() => {
    let allContacts = allContactsBeforeTypeFilter;

    // Filter out blocked contacts
    allContacts = allContacts.filter(contact => !contact.is_blocked);

    // Apply contact type filter
    if (contactFilter !== "all") {
      const typeToMatch = contactFilter === 'groups' ? 'group' : 
                          contactFilter === 'clients' ? 'client' : 
                          contactFilter === 'leads' ? 'lead' : 
                          contactFilter;
      allContacts = allContacts.filter(contact => contact.contact_type === typeToMatch);
    }

    // Apply today filter
    if (showTodayOnly) {
      allContacts = allContacts.filter(contact => isTodayLocal(contact.last_message_at));
    }

    // Apply unread only filter
    if (showUnreadOnly) {
      allContacts = allContacts.filter(contact => contact.unread_count > 0);
    }

    // Apply tag filter
    if (selectedTagFilter) {
      allContacts = allContacts.filter(contact => {
        const tagIds = getContactTagIds(contact);
        return tagIds.includes(selectedTagFilter);
      });
    }

    return allContacts;
  }, [allContactsBeforeTypeFilter, contactFilter, showTodayOnly, showUnreadOnly, todayParts, selectedTagFilter, getContactTagIds, debouncedSearch]);

  const clientsCount = allContactsBeforeTypeFilter.filter(c => c.contact_type === 'client').length;
  const leadsCount = allContactsBeforeTypeFilter.filter(c => c.contact_type === 'lead').length;
  const groupsCount = allContactsBeforeTypeFilter.filter(c => c.contact_type === 'group').length;
  const unknownCount = allContactsBeforeTypeFilter.filter(c => c.contact_type === 'unknown').length;


  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleEditContact = async (contact: Contact) => {
    if (contact.contact_type === 'client') {
      const { data } = await supabase
        .from('clients')
        .select('*')
        .eq('id', contact.id)
        .single();
      
      if (data) {
        setEditingContact({ id: contact.id, type: 'client', data });
      }
    } else if (contact.contact_type === 'lead') {
      const { data } = await supabase
        .from('leads')
        .select('*')
        .eq('id', contact.id)
        .single();
      
      if (data) {
        setEditingContact({ id: contact.id, type: 'lead', data });
      }
    }
  };

  const handleClearHistory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !tenantId) throw new Error('No user found');

      // Delete messages permanently
      const { error } = await supabase
        .from('chat_messages')
        .delete()
        .eq('connection_user_id', user.id);

      if (error) throw error;
      
      toast.success('ההיסטוריה נמחקה לצמיתות');
      queryClient.invalidateQueries({ queryKey: ['active-chats'] });
      queryClient.invalidateQueries({ queryKey: ['unknown-contacts'] });

      setShowClearHistoryDialog(false);
      setSelectedContact(null);
    } catch (error) {
      console.error('Error:', error);
      toast.error('שגיאה בביצוע הפעולה');
    }
  };

  // Multi-select handlers
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);

  const toggleChatSelection = (contactId: string, shiftKey?: boolean) => {
    const currentIndex = filteredContacts.findIndex(c => c.id === contactId);
    
    if (shiftKey && lastSelectedIndex !== null && currentIndex !== -1) {
      // Shift+Click: select range
      const start = Math.min(lastSelectedIndex, currentIndex);
      const end = Math.max(lastSelectedIndex, currentIndex);
      
      setSelectedChatIds(prev => {
        const newSet = new Set(prev);
        for (let i = start; i <= end; i++) {
          newSet.add(filteredContacts[i].id);
        }
        return newSet;
      });
    } else {
      // Normal click: toggle single
      setSelectedChatIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(contactId)) {
          newSet.delete(contactId);
        } else {
          newSet.add(contactId);
        }
        return newSet;
      });
      setLastSelectedIndex(currentIndex);
    }
  };

  const handleSelectAll = () => {
    if (selectedChatIds.size === filteredContacts.length) {
      // Deselect all if all are selected
      setSelectedChatIds(new Set());
    } else {
      // Select all
      setSelectedChatIds(new Set(filteredContacts.map(c => c.id)));
    }
  };

  const getSelectedContacts = () => {
    return filteredContacts.filter(c => selectedChatIds.has(c.id));
  };

  if (agenciesLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">טוען סוכנויות...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden gap-4" dir="rtl">
      {/* Contact List */}
      <Card className={`${isMobile && selectedContact ? 'hidden' : 'flex'} flex-col w-full md:w-96 h-full overflow-hidden`}>
        <div className="sticky top-0 z-10 bg-card p-4 border-b space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              <h2 className="text-lg font-semibold">צ'אט</h2>
            </div>
            <div className="flex items-center gap-1">
              <Button 
                variant="ghost"
                size="icon"
                title="סמן הכל כנקרא"
                onClick={async () => {
                  try {
                    const { data: { user } } = await supabase.auth.getUser();
                    if (!user || !tenantId) return;
                    
                    const { error } = await supabase
                      .from('chat_messages')
                      .update({ read_at: new Date().toISOString() })
                      .eq('tenant_id', tenantId)
                      .eq('direction', 'inbound')
                      .is('read_at', null);
                    
                    if (error) throw error;
                    toast.success('כל ההודעות סומנו כנקראו');
                    queryClient.invalidateQueries({ queryKey: ['active-chats'] });
                    queryClient.invalidateQueries({ queryKey: ['unknown-contacts'] });
                  } catch (err) {
                    console.error('Error marking all as read:', err);
                    toast.error('שגיאה בסימון הודעות כנקראו');
                  }
                }}
              >
                <CheckCheck className="h-4 w-4" />
              </Button>
              <Button 
                variant={isMultiSelectMode ? "secondary" : "ghost"}
                size="icon"
                onClick={() => {
                  setIsMultiSelectMode(!isMultiSelectMode);
                  setSelectedChatIds(new Set());
                }}
                title="בחירה מרובה"
              >
                <SquareCheck className="h-4 w-4" />
              </Button>
              <ChatTagsManager 
                trigger={
                  <Button variant="ghost" size="icon" title="ניהול תגיות">
                    <Tags className="h-4 w-4" />
                  </Button>
                }
              />
              <Button 
                variant="ghost" 
                size="icon" 
                title="מחק היסטוריה"
                onClick={() => {
                  setShowClearHistoryDialog(true);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Link to={buildPath('/chat-integrations')}>
                <Button variant="ghost" size="icon">
                  <Settings className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Multi-select toolbar */}
          {isMultiSelectMode && selectedChatIds.size > 0 && tenantId && (
            <ChatMultiSelectToolbar
              selectedContacts={getSelectedContacts()}
              onClearSelection={() => setSelectedChatIds(new Set())}
              onSelectAll={handleSelectAll}
              tenantId={tenantId}
              totalCount={filteredContacts.length}
            />
          )}

          <div className="relative">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="חיפוש איש קשר..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="pr-10"
            />
          </div>

          <div className="space-y-3">
            <Select value={contactFilter || "all"} onValueChange={(value: any) => setContactFilter(value)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                <SelectItem value="all">הכל ({filteredContacts.length})</SelectItem>
                <SelectItem value="clients">לקוחות ({clientsCount})</SelectItem>
                <SelectItem value="leads">לידים ({leadsCount})</SelectItem>
                <SelectItem value="groups">קבוצות ({groupsCount})</SelectItem>
                <SelectItem value="unknown">לא משויכים ({unknownCount})</SelectItem>
              </SelectContent>
            </Select>

            {/* Tag filter */}
            {allTags.length > 0 && (
              <Select value={selectedTagFilter || "all"} onValueChange={(value) => setSelectedTagFilter(value === "all" ? null : value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="סינון לפי תג" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="all">כל התגיות</SelectItem>
                  {allTags.map((tag: any) => (
                    <SelectItem key={tag.id} value={tag.id}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                        {tag.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 px-2">
                <Switch
                  id="today-filter"
                  checked={showTodayOnly}
                  onCheckedChange={setShowTodayOnly}
                />
                <Label htmlFor="today-filter" className="text-sm cursor-pointer">
                  הצג רק שיחות מהיום
                </Label>
              </div>
              <div className="flex items-center gap-2 px-2">
                <Switch
                  id="unread-filter"
                  checked={showUnreadOnly}
                  onCheckedChange={setShowUnreadOnly}
                />
                <Label htmlFor="unread-filter" className="text-sm cursor-pointer">
                  הצג רק שיחות לא נקראות
                </Label>
              </div>
            </div>
          </div>

          <div className="text-muted-foreground text-sm px-2">
            {debouncedSearch ? (
              <span>תוצאות חיפוש עבור "{debouncedSearch}"</span>
            ) : (
              <span>שיחות פעילות</span>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-2 space-y-1 overflow-hidden">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-3 rounded-lg">
                  <Skeleton className="h-12 w-full" />
                </div>
              ))
            ) : filteredContacts.length === 0 ? (
              <div className="text-center p-8 text-muted-foreground">
                {debouncedSearch ? 'לא נמצאו תוצאות' : 'אין שיחות פעילות'}
              </div>
            ) : (
              filteredContacts.map((contact) => {
                const isSelected = selectedContact?.id === contact.id;
                const isChecked = selectedChatIds.has(contact.id);
                const contactTagIds = getContactTagIds(contact);

                return (
                  <div key={contact.id} className="flex items-center gap-2">
                    {isMultiSelectMode && (
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => toggleChatSelection(contact.id)}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleChatSelection(contact.id, e.shiftKey);
                        }}
                        className="flex-shrink-0"
                      />
                    )}
                    <Button
                      variant={isSelected ? "secondary" : "ghost"}
                      className="flex-1 min-w-0 justify-start text-right h-auto py-3 px-3 overflow-hidden"
                      onClick={() => {
                        if (isMultiSelectMode) {
                          toggleChatSelection(contact.id);
                        } else {
                          setSelectedContact({
                            id: contact.id,
                            type: contact.contact_type,
                            senderPhone: contact.sender_phone,
                            name: contact.name
                          });
                        }
                      }}
                    >
                      <div className="flex flex-row-reverse items-center gap-3 w-full min-w-0 overflow-hidden">
                        <Avatar className="h-10 w-10 flex-shrink-0">
                          {contact.whatsapp_avatar_url && (
                            <AvatarImage 
                              src={contact.whatsapp_avatar_url} 
                              alt={contact.name}
                            />
                          )}
                          <AvatarFallback>
                            {(contact.contact_type === 'group' ? contact.name : (contact.contact_name || contact.name))?.charAt(0) || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0 text-right">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1">
                                <span className="block text-sm font-medium leading-tight truncate" dir="auto">
                                  {contact.contact_type === 'group' ? contact.name : (contact.contact_name || contact.name)}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {/* Tag selector */}
{!isMultiSelectMode && (
                                <ChatTagSelector
                                  contactId={contact.id}
                                  contactType={contact.contact_type}
                                  senderPhone={contact.sender_phone}
                                  initialTagIds={contactTagIds}
                                />
                              )}

                              
                              {contact.unread_count > 0 && (
                                <Badge variant="destructive" className="h-5 min-w-5 flex items-center justify-center px-1">
                                  {contact.unread_count}
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          {/* Tag badges */}
                          {contactTagIds.length > 0 && (
                            <ContactTagBadges
                              contactId={contact.id}
                              contactType={contact.contact_type}
                              senderPhone={contact.sender_phone}
                              allTags={allTags}
                              contactTagIds={contactTagIds}
                            />
                          )}
                          
                          {contact.agency_name && (
                            <div className="min-w-0">
                              <span className="text-xs text-muted-foreground truncate block" dir="auto">
                                {contact.agency_name}
                              </span>
                            </div>
                          )}
                          {!contact.phone && contact.contact_type !== 'group' && contact.contact_type !== 'unknown' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditContact(contact);
                              }}
                            >
                              <Pencil className="h-3 w-3 ml-1" />
                              עדכן פרטים
                            </Button>
                          )}
                        </div>
                      </div>
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Card>

      {/* Chat View */}
      <Card className="flex-1 h-full min-h-0 overflow-hidden flex flex-col">
        {selectedContact ? (
          <ChatView
            contactId={selectedContact.id}
            contactType={selectedContact.type}
            senderPhone={selectedContact.senderPhone}
            contactName={selectedContact.name}
            onBack={isMobile ? () => setSelectedContact(null) : undefined}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">בחר שיחה כדי להתחיל</p>
            </div>
          </div>
        )}
      </Card>

      {/* Edit Contact Dialogs */}
      {editingContact?.type === 'client' && (
        <EditClientDialog
          client={editingContact.data}
          open={true}
          onOpenChange={(open) => {
            if (!open) setEditingContact(null);
          }}
        />
      )}
      
      {editingContact?.type === 'lead' && (
        <EditLeadDialog
          lead={editingContact.data}
          open={true}
          onOpenChange={(open) => {
            if (!open) setEditingContact(null);
          }}
        />
      )}

      <AlertDialog open={showClearHistoryDialog} onOpenChange={setShowClearHistoryDialog}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>מחק היסטוריה לצמיתות?</AlertDialogTitle>
            <AlertDialogDescription>
              פעולה זו תמחק לצמיתות את כל היסטוריית הצ'אטים שלך. לא ניתן יהיה לשחזר את המידע לאחר המחיקה.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearHistory}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              מחק הכל
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
