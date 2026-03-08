import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Mail, Send, ArrowRight, RefreshCw, Loader2, Ban, Tag, Settings, ChevronLeft, ChevronRight, CalendarIcon, Reply, Trash2, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useTenantPath } from "@/hooks/useTenantPath";
import { format, addDays, startOfDay, startOfWeek, subDays } from "date-fns";
import { he } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { ProcessInvoicesDialog } from "@/components/gmail/ProcessInvoicesDialog";

interface EmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  labelIds: string[];
  from: string;
  to: string;
  subject: string;
  date: string;
  isUnread: boolean;
  body?: string;
}

export default function Gmail() {
  const { tenantId } = useCurrentTenant();
  const { userId } = useCurrentUser();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { buildPath } = useTenantPath();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [selectedMessage, setSelectedMessage] = useState<EmailMessage | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [replyMode, setReplyMode] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [processInvoicesOpen, setProcessInvoicesOpen] = useState(false);
  // Date & pagination state
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange | undefined>({
    from: new Date(),
    to: new Date(),
  });
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageTokenHistory, setPageTokenHistory] = useState<string[]>([]);
  const [currentPageToken, setCurrentPageToken] = useState<string | undefined>();

  // Build date query
  const buildDateQuery = () => {
    const from = selectedDateRange?.from ?? new Date();
    const to = selectedDateRange?.to ?? from;
    const toExclusive = addDays(to, 1);

    const fy = from.getFullYear();
    const fm = from.getMonth() + 1;
    const fd = from.getDate();

    const ty = toExclusive.getFullYear();
    const tm = toExclusive.getMonth() + 1;
    const td = toExclusive.getDate();

    return `after:${fy}/${fm}/${fd} before:${ty}/${tm}/${td}`;
  };

  const fullQueryBase = useMemo(() => {
    const dateQ = buildDateQuery();
    return activeSearch ? `${dateQ} ${activeSearch}` : dateQ;
  }, [selectedDateRange, activeSearch]);

  // Check connection
  const { data: connectionStatus } = useQuery({
    queryKey: ['gmail-status', userId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('gmail-auth', {
        body: { action: 'status' },
      });
      if (error) throw error;
      return data as { connected: boolean; google_email: string | null };
    },
    enabled: !!userId,
  });

  // Categories
  const { data: categories = [] } = useQuery({
    queryKey: ['gmail-categories', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gmail_categories')
        .select('*')
        .eq('tenant_id', tenantId!)
        .order('sort_order');
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  // Blocked senders
  const { data: blockedSenders = [] } = useQuery({
    queryKey: ['gmail-blocked-senders', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gmail_blocked_senders')
        .select('email_address')
        .eq('user_id', userId!);
      if (error) throw error;
      return data.map((b: any) => b.email_address.toLowerCase());
    },
    enabled: !!userId,
  });

  // Allowed labels
  const { data: allowedLabels = [] } = useQuery({
    queryKey: ['gmail-allowed-labels', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gmail_allowed_labels')
        .select('label_id')
        .eq('user_id', userId!);
      if (error) throw error;
      return data.map((l: any) => l.label_id as string);
    },
    enabled: !!userId,
  });

  // Category rules (subject -> category mapping)
  const { data: categoryRules = [] } = useQuery({
    queryKey: ['gmail-category-rules', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gmail_category_rules')
        .select('subject_pattern, category_id')
        .eq('user_id', userId!);
      if (error) throw error;
      return data as { subject_pattern: string; category_id: string }[];
    },
    enabled: !!userId,
  });

  // Get the selected category's gmail_label_id (if any)
  const selectedCategoryLabelId = useMemo(() => {
    if (!selectedCategory) return null;
    const cat = categories.find((c: any) => c.id === selectedCategory);
    return cat?.gmail_label_id || null;
  }, [selectedCategory, categories]);

  // Build subject query from category rules when a category is selected
  const categorySubjectQuery = useMemo(() => {
    // If category has a gmail_label_id, we filter via labelIds instead of subject query
    if (selectedCategoryLabelId) return null;
    if (!selectedCategory || categoryRules.length === 0) return null;
    const rulesForCategory = categoryRules.filter(r => r.category_id === selectedCategory);
    if (rulesForCategory.length === 0) return null;
    return rulesForCategory.map(r => `subject:"${r.subject_pattern}"`).join(' OR ');
  }, [selectedCategory, categoryRules, selectedCategoryLabelId]);

  const fullQuery = useMemo(() => {
    if (categorySubjectQuery) {
      return activeSearch ? `(${categorySubjectQuery}) ${activeSearch}` : categorySubjectQuery;
    }
    return fullQueryBase;
  }, [fullQueryBase, activeSearch, categorySubjectQuery]);

  // Message categories mapping
  const { data: messageCategoryMap = {} } = useQuery({
    queryKey: ['gmail-message-categories', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gmail_message_categories')
        .select('message_id, category_id')
        .eq('user_id', userId!);
      if (error) throw error;
      const map: Record<string, string[]> = {};
      data.forEach((d: any) => {
        if (!map[d.message_id]) map[d.message_id] = [];
        map[d.message_id].push(d.category_id);
      });
      return map;
    },
    enabled: !!userId,
  });

  // Determine effective labelIds for the API call
  const effectiveLabelIds = useMemo(() => {
    if (selectedCategoryLabelId) return [selectedCategoryLabelId];
    if (allowedLabels.length > 0) return allowedLabels;
    return undefined;
  }, [selectedCategoryLabelId, allowedLabels]);

  // Fetch messages with date query + allowed labels
  const { data: messagesData, isLoading, refetch } = useQuery({
    queryKey: ['gmail-messages', fullQuery, currentPageToken, effectiveLabelIds],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('gmail-api', {
        body: {
          action: 'list',
          query: fullQuery,
          maxResults: 25,
          pageToken: currentPageToken,
          labelIds: effectiveLabelIds,
        },
      });
      if (error) throw error;
      return data as { messages: EmailMessage[]; nextPageToken?: string; resultSizeEstimate?: number };
    },
    enabled: !!connectionStatus?.connected,
  });

  // Build effective category map: DB entries + rule-based auto-matching
  const effectiveCategoryMap = useMemo(() => {
    const map: Record<string, string[]> = { ...(messageCategoryMap as Record<string, string[]>) };
    if (messagesData?.messages && categoryRules.length > 0) {
      for (const msg of messagesData.messages) {
        if (!map[msg.id]) {
          const subjectLower = (msg.subject || '').toLowerCase().trim();
          const matchingRule = categoryRules.find(r => r.subject_pattern === subjectLower);
          if (matchingRule) {
            map[msg.id] = [matchingRule.category_id];
          }
        }
      }
    }
    return map;
  }, [messageCategoryMap, messagesData?.messages, categoryRules]);

  // Filter blocked senders and by category
  const filteredMessages = useMemo(() => {
    if (!messagesData?.messages) return [];
    let msgs = messagesData.messages.filter((m) => {
      const fromEmail = m.from.match(/<(.+?)>/)?.[1]?.toLowerCase() || m.from.toLowerCase();
      if ((blockedSenders as string[]).includes(fromEmail)) return false;
      return true;
    });

    if (selectedCategory) {
      // When category is selected, the Gmail API query already filters by subject patterns
      // No additional local filtering needed — show all results from API
      return msgs;
    }

    // "All" view: hide only explicitly DB-categorized emails (not auto-matched by rules)
    // This prevents page 2+ from being empty due to rule-based auto-matching
    if (allowedLabels.length === 0) {
      msgs = msgs.filter((m) => {
        const dbCategories = (messageCategoryMap as Record<string, string[]>)[m.id];
        return !dbCategories || dbCategories.length === 0;
      });
    }

    return msgs;
  }, [messagesData?.messages, blockedSenders, selectedCategory, messageCategoryMap, allowedLabels.length]);

  // Get single message
  const fetchMessage = useMutation({
    mutationFn: async (messageId: string) => {
      const { data, error } = await supabase.functions.invoke('gmail-api', {
        body: { action: 'get', messageId },
      });
      if (error) throw error;
      return data as EmailMessage;
    },
    onSuccess: (msg) => setSelectedMessage(msg),
  });

  // Send message
  const sendMutation = useMutation({
    mutationFn: async () => {
      const body: any = { action: 'send', to: composeTo, subject: composeSubject, body: composeBody };
      if (replyMode && selectedMessage) {
        body.inReplyTo = selectedMessage.id;
        body.threadId = selectedMessage.threadId;
      }
      const { data, error } = await supabase.functions.invoke('gmail-api', { body });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('המייל נשלח בהצלחה!');
      setComposeOpen(false);
      setComposeTo('');
      setComposeSubject('');
      setComposeBody('');
      setReplyMode(false);
      refetch();
    },
    onError: () => toast.error('שגיאה בשליחת המייל'),
  });

  // Block sender + all senders with same subject
  const blockSender = useMutation({
    mutationFn: async ({ email, subject }: { email: string; subject?: string }) => {
      // Block the original sender
      await supabase.from('gmail_blocked_senders').insert({
        tenant_id: tenantId!,
        user_id: userId!,
        email_address: email.toLowerCase(),
      });

      // Search for all messages with the same subject and block their senders too
      if (subject) {
        try {
          const searchRes = await supabase.functions.invoke('gmail-api', {
            body: { action: 'list', query: `subject:"${subject}"`, maxResults: 500 },
          });
          const allMatching = searchRes.data?.messages || [];
          const uniqueEmails = new Set<string>([email.toLowerCase()]);

          for (const m of allMatching) {
            if (m.from) {
              const senderEmail = m.from.match(/<([^>]+)>/)?.[1] || m.from.split(/\s/).pop() || '';
              if (senderEmail && !uniqueEmails.has(senderEmail.toLowerCase())) {
                uniqueEmails.add(senderEmail.toLowerCase());
                await supabase.from('gmail_blocked_senders').insert({
                  tenant_id: tenantId!,
                  user_id: userId!,
                  email_address: senderEmail.toLowerCase(),
                }).then(() => {}); // ignore duplicates
              }
            }
          }
        } catch (e) {
          console.error('Error searching related senders:', e);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gmail-blocked-senders'] });
      toast.success('השולח וכל השולחים עם אותו נושא נחסמו');
    },
    onError: () => toast.error('שגיאה בחסימת שולח'),
  });

  // Trash message
  const trashMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const { data, error } = await supabase.functions.invoke('gmail-api', {
        body: { action: 'trash', messageId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('ההודעה נמחקה');
      refetch();
    },
    onError: () => toast.error('שגיאה במחיקת ההודעה'),
  });

  // Bulk trash
  const bulkTrashMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) {
        const { error } = await supabase.functions.invoke('gmail-api', {
          body: { action: 'trash', messageId: id },
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(`${selectedIds.size} הודעות נמחקו`);
      setSelectedIds(new Set());
      refetch();
    },
    onError: () => toast.error('שגיאה במחיקת הודעות'),
  });

  // Bulk block
  const bulkBlockMutation = useMutation({
    mutationFn: async (emails: string[]) => {
      const unique = [...new Set(emails)];
      for (const email of unique) {
        await supabase.from('gmail_blocked_senders').insert({
          tenant_id: tenantId!,
          user_id: userId!,
          email_address: email.toLowerCase(),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gmail-blocked-senders'] });
      setSelectedIds(new Set());
      toast.success('שולחים נחסמו');
    },
  });

  // Bulk assign category
  const bulkAssignCategory = useMutation({
    mutationFn: async ({ ids, categoryId }: { ids: string[]; categoryId: string }) => {
      for (const messageId of ids) {
        await supabase.from('gmail_message_categories').upsert({
          tenant_id: tenantId!,
          user_id: userId!,
          message_id: messageId,
          category_id: categoryId,
        }, { onConflict: 'user_id,message_id,category_id' });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gmail-message-categories'] });
      setSelectedIds(new Set());
      toast.success('קטגוריה עודכנה');
    },
  });

  // Assign category (single) — also saves a subject rule and applies to all matching messages
  const assignCategory = useMutation({
    mutationFn: async ({ messageId, categoryId }: { messageId: string; categoryId: string }) => {
      // Find the message to get its subject
      const msg = messagesData?.messages?.find(m => m.id === messageId);
      const subjectLower = (msg?.subject || '').toLowerCase().trim();

      // 1. Assign category to this message
      await supabase.from('gmail_message_categories').upsert({
        tenant_id: tenantId!,
        user_id: userId!,
        message_id: messageId,
        category_id: categoryId,
      }, { onConflict: 'user_id,message_id,category_id' });

      // 2. Save subject rule for future auto-categorization
      if (subjectLower) {
        const { error: ruleError } = await supabase.from('gmail_category_rules').upsert({
          tenant_id: tenantId!,
          user_id: userId!,
          subject_pattern: subjectLower,
          category_id: categoryId,
        }, { onConflict: 'user_id,subject_pattern' });
        if (ruleError) {
          console.error('Error upserting category rule:', ruleError);
        }
      }

      // 3. Search Gmail for ALL messages with same subject and categorize them
      if (subjectLower) {
        try {
          const searchRes = await supabase.functions.invoke('gmail-api', {
            body: { action: 'list', query: `subject:"${msg?.subject || ''}"`, maxResults: 500 }
          });
          const allMatching = searchRes.data?.messages || [];
          for (const m of allMatching) {
            if (m.id !== messageId) {
              await supabase.from('gmail_message_categories').upsert({
                tenant_id: tenantId!,
                user_id: userId!,
                message_id: m.id,
                category_id: categoryId,
              }, { onConflict: 'user_id,message_id,category_id' });
            }
          }
        } catch (err) {
          console.error('Failed to search for matching emails:', err);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gmail-message-categories'] });
      queryClient.invalidateQueries({ queryKey: ['gmail-category-rules'] });
      toast.success('קטגוריה עודכנה לכל האימיילים עם אותו נושא');
    },
  });

  const handleReply = (msg: EmailMessage) => {
    setReplyMode(true);
    setComposeTo(msg.from.match(/<(.+?)>/)?.[1] || msg.from);
    setComposeSubject(`Re: ${msg.subject}`);
    setComposeBody('');
    setComposeOpen(true);
  };

  const extractEmail = (str: string) => str.match(/<(.+?)>/)?.[1] || str;
  const extractName = (str: string) => str.replace(/<.+?>/, '').trim().replace(/"/g, '') || str;

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const day = d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
    const time = d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    return `${day} ${time}`;
  };

  // Multi-select helpers
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredMessages.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredMessages.map(m => m.id)));
    }
  };

  const handleBulkDelete = () => {
    bulkTrashMutation.mutate([...selectedIds]);
  };

  const handleBulkBlock = () => {
    const emails = filteredMessages
      .filter(m => selectedIds.has(m.id))
      .map(m => extractEmail(m.from));
    bulkBlockMutation.mutate(emails);
  };

  // Date navigation
  const shiftDateRangeByDays = (days: number) => {
    setSelectedDateRange((prev) => {
      const from = prev?.from ?? new Date();
      const to = prev?.to ?? from;
      return {
        from: addDays(from, days),
        to: addDays(to, days),
      };
    });
    resetPagination();
  };

  const goToPrevDay = () => shiftDateRangeByDays(-1);
  const goToNextDay = () => shiftDateRangeByDays(1);
  const resetPagination = () => {
    setCurrentPage(1);
    setCurrentPageToken(undefined);
    setPageTokenHistory([]);
    setSelectedIds(new Set());
  };

  // Pagination
  const goToNextPage = () => {
    if (messagesData?.nextPageToken) {
      setPageTokenHistory(prev => [...prev, currentPageToken || '']);
      setCurrentPageToken(messagesData.nextPageToken);
      setCurrentPage(prev => prev + 1);
      setSelectedIds(new Set());
    }
  };
  const goToPrevPage = () => {
    if (currentPage > 1) {
      const newHistory = [...pageTokenHistory];
      const prevToken = newHistory.pop();
      setPageTokenHistory(newHistory);
      setCurrentPageToken(prevToken === '' ? undefined : prevToken);
      setCurrentPage(prev => prev - 1);
      setSelectedIds(new Set());
    }
  };

  if (!connectionStatus?.connected) {
    return (
      <div className="container mx-auto p-6 flex flex-col items-center justify-center min-h-[60vh]" dir="rtl">
        <Mail className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Gmail לא מחובר</h2>
        <p className="text-muted-foreground mb-4">חבר את חשבון הגוגל שלך כדי להתחיל</p>
        <Button onClick={() => navigate(buildPath('gmail-settings'))}>
          <Settings className="h-4 w-4 ml-2" />
          הגדרות Gmail
        </Button>
      </div>
    );
  }

  const hasSelection = selectedIds.size > 0;

  return (
    <div className="container mx-auto p-4 space-y-3" dir="rtl">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Mail className="h-5 w-5" />
            תיבת דואר
          </h1>
          <Badge variant="outline" className="text-xs hidden sm:inline-flex">{connectionStatus?.google_email}</Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => navigate(buildPath('gmail-settings'))}>
            <Settings className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={() => { setReplyMode(false); setComposeTo(''); setComposeSubject(''); setComposeBody(''); setComposeOpen(true); }}>
            <Send className="h-4 w-4 me-2" />
            מייל חדש
          </Button>
        </div>
      </div>

      {/* Toolbar: Search + Date Navigation + Categories */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="חיפוש..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { setActiveSearch(searchQuery); resetPagination(); } }}
            className="pr-9 h-9"
          />
        </div>

        {/* Date navigation */}
        <div className="flex items-center gap-1 border rounded-md bg-background px-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToNextDay}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-sm font-medium px-2">
                <CalendarIcon className="h-3.5 w-3.5" />
                {selectedDateRange?.from
                  ? selectedDateRange.to
                    ? `${format(selectedDateRange.from, 'd בMMMM yyyy', { locale: he })} - ${format(selectedDateRange.to, 'd בMMMM yyyy', { locale: he })}`
                    : format(selectedDateRange.from, 'd בMMMM yyyy', { locale: he })
                  : 'בחר טווח תאריכים'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="center">
              <Calendar
                mode="range"
                selected={selectedDateRange}
                onSelect={(range) => {
                  setSelectedDateRange(range);
                  resetPagination();
                  if (range?.from && range?.to) setDatePickerOpen(false);
                }}
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToPrevDay}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>

        {/* Quick date filters */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => {
              const today = startOfDay(new Date());
              setSearchQuery('');
              setActiveSearch('');
              setSelectedDateRange({ from: today, to: today });
              resetPagination();
            }}
          >
            היום
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => {
              const today = startOfDay(new Date());
              const weekStart = startOfWeek(today, { weekStartsOn: 0 });
              setSearchQuery('');
              setActiveSearch('');
              setSelectedDateRange({ from: weekStart, to: today });
              resetPagination();
            }}
          >
            השבוע
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => {
              const today = startOfDay(new Date());
              const thirtyDaysAgo = subDays(today, 30);
              setSearchQuery('');
              setActiveSearch('');
              setSelectedDateRange({ from: thirtyDaysAgo, to: today });
              resetPagination();
            }}
          >
            30 יום
          </Button>
        </div>

        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>

        {/* Category filters */}
        <div className="flex gap-1 flex-wrap">
          <Button
            variant={selectedCategory === null ? 'default' : 'outline'}
            size="sm"
            className="h-8 text-xs"
            onClick={() => setSelectedCategory(null)}
          >
            הכל
          </Button>
          {categories.map((cat: any) => (
            <Button
              key={cat.id}
              variant={selectedCategory === cat.id ? 'default' : 'outline'}
              size="sm"
              className="h-8 text-xs gap-1"
              onClick={() => setSelectedCategory(cat.id === selectedCategory ? null : cat.id)}
            >
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
              {cat.name}
            </Button>
          ))}
        </div>
      </div>

      {/* Bulk action toolbar */}
      {hasSelection && (
        <div className="flex items-center gap-2 bg-primary/10 rounded-md px-3 py-2 border border-primary/20">
          <span className="text-sm font-medium">{selectedIds.size} נבחרו</span>
          <div className="flex gap-1 ms-auto">
            {categories.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 gap-1">
                    <Tag className="h-3.5 w-3.5" />
                    קטגוריה
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {categories.map((cat: any) => (
                    <DropdownMenuItem key={cat.id} onClick={() => bulkAssignCategory.mutate({ ids: [...selectedIds], categoryId: cat.id })}>
                      <div className="w-3 h-3 rounded-full me-2" style={{ backgroundColor: cat.color }} />
                      {cat.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button variant="outline" size="sm" className="h-8 gap-1" onClick={handleBulkBlock}>
              <Ban className="h-3.5 w-3.5" />
              חסום
            </Button>
            <Button variant="secondary" size="sm" className="h-8 gap-1" onClick={() => setProcessInvoicesOpen(true)}>
              <FileText className="h-3.5 w-3.5" />
              עבד חשבוניות
            </Button>
            <Button variant="destructive" size="sm" className="h-8 gap-1" onClick={handleBulkDelete} disabled={bulkTrashMutation.isPending}>
              {bulkTrashMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              מחק
            </Button>
          </div>
        </div>
      )}

      {/* Message detail view */}
      {selectedMessage ? (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => setSelectedMessage(null)}>
                <ArrowRight className="h-4 w-4 me-1" />
                חזור
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => handleReply(selectedMessage)}>
                  <Reply className="h-4 w-4 me-1" />
                  השב
                </Button>
                <Button variant="outline" size="sm" onClick={() => { trashMutation.mutate(selectedMessage.id); setSelectedMessage(null); }}>
                  <Trash2 className="h-4 w-4 me-1" />
                  מחק
                </Button>
                <Button variant="outline" size="sm" onClick={() => blockSender.mutate({ email: extractEmail(selectedMessage.from), subject: selectedMessage.subject })}>
                  <Ban className="h-4 w-4 me-1" />
                  חסום
                </Button>
              </div>
            </div>
            <div>
              <h2 className="text-xl font-semibold">{selectedMessage.subject || '(ללא נושא)'}</h2>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                <span>מאת: {extractName(selectedMessage.from)}</span>
                <span dir="ltr" className="text-xs">&lt;{extractEmail(selectedMessage.from)}&gt;</span>
              </div>
              <div className="text-xs text-muted-foreground">{selectedMessage.date}</div>
            </div>
            <div
              className="border rounded p-4 bg-muted/30 prose prose-sm max-w-none overflow-auto"
              dir="auto"
              dangerouslySetInnerHTML={{ __html: selectedMessage.body || selectedMessage.snippet }}
            />
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center p-12">
                <Loader2 className="animate-spin h-8 w-8 text-muted-foreground" />
              </div>
            ) : filteredMessages.length === 0 ? (
              <div className="text-center p-12 text-muted-foreground">
                <Mail className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>אין הודעות לתאריך זה</p>
              </div>
            ) : (
              <ScrollArea className="max-h-[calc(100vh-260px)]" dir="rtl">
                {/* Header row with select all */}
                <div dir="rtl" className="flex items-center h-9 px-3 border-b bg-muted/30 text-xs text-muted-foreground">
                  <div className="w-8 flex-shrink-0 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={filteredMessages.length > 0 && selectedIds.size === filteredMessages.length}
                      onCheckedChange={toggleSelectAll}
                    />
                  </div>
                  <div className="w-5 flex-shrink-0" />
                  <div className="w-[180px] flex-shrink-0 text-right pe-3">שולח</div>
                  <div className="w-[110px] flex-shrink-0 text-right pe-2">תאריך</div>
                  <div className="flex-1 min-w-0 text-right">נושא</div>
                </div>
                <div className="divide-y divide-border">
                  {filteredMessages.map((msg) => {
                    const msgCategories = effectiveCategoryMap[msg.id] || [];
                    const fromName = extractName(msg.from);
                    const isSelected = selectedIds.has(msg.id);
                    return (
                      <div
                        key={msg.id}
                        dir="rtl"
                        className={cn(
                          "flex items-center h-10 px-3 hover:bg-muted/50 cursor-pointer transition-colors group border-b border-border last:border-b-0",
                          msg.isUnread && "bg-primary/5",
                          isSelected && "bg-primary/10"
                        )}
                        onClick={() => fetchMessage.mutate(msg.id)}
                      >
                        {/* Checkbox */}
                        <div className="w-8 flex-shrink-0 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelect(msg.id)}
                          />
                        </div>

                        {/* Unread indicator */}
                        <div className="w-5 flex-shrink-0 flex items-center justify-center">
                          {msg.isUnread && <div className="w-2 h-2 rounded-full bg-primary" />}
                        </div>

                        {/* Sender name - fixed width */}
                        <div className={cn(
                          "w-[180px] flex-shrink-0 text-sm truncate text-right pe-3",
                          msg.isUnread ? "font-bold text-foreground" : "text-foreground/80"
                        )}>
                          {fromName}
                        </div>

                        {/* Time/date - fixed width, placed before subject so it's always visible */}
                        <div className="w-[110px] flex-shrink-0 text-xs text-muted-foreground text-right pe-2">
                          {formatTime(msg.date)}
                        </div>

                        {/* Subject + snippet */}
                        <div className="flex-1 min-w-0 flex items-center gap-2 text-sm truncate overflow-hidden">
                          <span className={cn(
                            "truncate",
                            msg.isUnread ? "font-semibold text-foreground" : "text-foreground/80"
                          )}>
                            {msg.subject || '(ללא נושא)'}
                          </span>
                          <span className="text-muted-foreground truncate hidden sm:inline">
                            — {msg.snippet}
                          </span>
                          {/* Category badges inline */}
                          {msgCategories.length > 0 && msgCategories.map((cId) => {
                            const cat = categories.find((c: any) => c.id === cId);
                            return cat ? (
                              <span key={cId} className="text-[10px] px-1.5 py-0.5 rounded-full text-white flex-shrink-0" style={{ backgroundColor: cat.color }}>
                                {cat.name}
                              </span>
                            ) : null;
                          })}
                        </div>

                        {/* Actions (visible on hover) */}
                        <div className="flex gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                          {categories.length > 0 && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                  <Tag className="h-3 w-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {categories.map((cat: any) => (
                                  <DropdownMenuItem key={cat.id} onClick={() => assignCategory.mutate({ messageId: msg.id, categoryId: cat.id })}>
                                    <div className="w-3 h-3 rounded-full me-2" style={{ backgroundColor: cat.color }} />
                                    {cat.name}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => trashMutation.mutate(msg.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => blockSender.mutate({ email: extractEmail(msg.from), subject: msg.subject })}>
                            <Ban className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}

            {/* Pagination footer */}
            {(() => {
              const totalEstimate = messagesData?.resultSizeEstimate || 0;
              const totalPages = Math.max(1, Math.ceil(totalEstimate / 25));
              return (
                <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/20">
                  <Button variant="ghost" size="sm" className="h-8" onClick={goToPrevPage} disabled={currentPage <= 1}>
                    <ChevronRight className="h-4 w-4 me-1" />
                    הקודם
                  </Button>
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-xs text-muted-foreground">עמוד {currentPage} מתוך {totalPages}</span>
                    {totalEstimate > 0 && (
                      <span className="text-[10px] text-muted-foreground/70">נמצאו כ-{totalEstimate} אימיילים</span>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" className="h-8" onClick={goToNextPage} disabled={!messagesData?.nextPageToken}>
                    הבא
                    <ChevronLeft className="h-4 w-4 ms-1" />
                  </Button>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* Compose Dialog */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>{replyMode ? 'השב למייל' : 'מייל חדש'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="אל:" dir="ltr" value={composeTo} onChange={(e) => setComposeTo(e.target.value)} />
            <Input placeholder="נושא:" value={composeSubject} onChange={(e) => setComposeSubject(e.target.value)} />
            <Textarea placeholder="תוכן ההודעה..." value={composeBody} onChange={(e) => setComposeBody(e.target.value)} rows={8} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setComposeOpen(false)}>ביטול</Button>
            <Button onClick={() => sendMutation.mutate()} disabled={sendMutation.isPending}>
              {sendMutation.isPending ? <Loader2 className="animate-spin h-4 w-4 me-2" /> : <Send className="h-4 w-4 me-2" />}
              שלח
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Process Invoices Dialog */}
      <ProcessInvoicesDialog
        open={processInvoicesOpen}
        onOpenChange={setProcessInvoicesOpen}
        messageIds={selectedIds.size > 0 ? [...selectedIds] : filteredMessages.map(m => m.id)}
      />
    </div>
  );
}
