import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Bot, Send, Plus, Loader2, Wrench, Menu, Sparkles, Zap, MessageSquare, Users, Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useIsMobile } from "@/hooks/use-mobile";
import ReactMarkdown from "react-markdown";

interface Message {
  role: 'user' | 'assistant' | 'tool_call';
  content?: string;
  tool?: string;
  args?: any;
  result?: any;
  timestamp: string;
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  messages: Message[];
}

interface AIOSDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AIOSDialog({ open, onOpenChange }: AIOSDialogProps) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [input, setInput] = useState("");
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { userId } = useCurrentUser();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const { data: conversations = [], isLoading: conversationsLoading } = useQuery({
    queryKey: ['ai-conversations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_conversations')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      
      return (data || []).map(conv => ({
        id: conv.id,
        title: conv.title || '',
        created_at: conv.created_at,
        messages: (Array.isArray(conv.messages) ? conv.messages : []) as unknown as Message[]
      }));
    },
    enabled: !!userId && open,
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage]);

  const loadConversation = (conversation: Conversation) => {
    setCurrentConversationId(conversation.id);
    setMessages(conversation.messages || []);
    setStreamingMessage("");
    setSheetOpen(false);
  };

  const startNewConversation = () => {
    setCurrentConversationId(null);
    setMessages([]);
    setStreamingMessage("");
    setInput("");
    setSheetOpen(false);
  };

  const sendMessage = async () => {
    if (!input.trim() || isStreaming) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsStreaming(true);
    setStreamingMessage("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-support-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            message: input,
            conversation_id: currentConversationId,
            tenant_slug: tenantSlug,
          }),
        }
      );

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('חריגה ממגבלת הקצב. אנא נסה שוב מאוחר יותר.');
        }
        if (response.status === 402) {
          throw new Error('נדרש תשלום. אנא הוסף יתרה ל-workspace שלך.');
        }
        throw new Error('שגיאה בתקשורת עם השרת');
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let assistantContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim() || line.startsWith(':')) continue;
          if (!line.startsWith('data: ')) continue;

          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);

            if (parsed.type === 'token') {
              assistantContent += parsed.content;
              setStreamingMessage(prev => prev + parsed.content);
            } else if (parsed.type === 'tool_call') {
              const toolMessage: Message = {
                role: 'tool_call',
                tool: parsed.tool,
                args: parsed.args,
                timestamp: new Date().toISOString(),
              };
              setMessages(prev => [...prev, toolMessage]);
            } else if (parsed.type === 'conversation_id') {
              setCurrentConversationId(parsed.id);
            } else if (parsed.type === 'done') {
              if (assistantContent) {
                setMessages(prev => [...prev, {
                  role: 'assistant',
                  content: assistantContent,
                  timestamp: new Date().toISOString(),
                }]);
                setStreamingMessage("");
              }
              setIsStreaming(false);
              queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
            }
          } catch (e) {
            console.error('Parse error:', e);
          }
        }
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast({
        title: "שגיאה",
        description: error.message || "שגיאה בשליחת ההודעה",
        variant: "destructive",
      });
      setIsStreaming(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const toolLabelMap: Record<string, string> = {
    create_task: "יוצר משימה",
    update_task_status: "מעדכן סטטוס משימה",
    list_tasks: "שולף משימות",
    search_entities: "מחפש",
    get_client_info: "שולף מידע על לקוח",
    create_automation: "יוצר אוטומציה",
    send_message: "שולח הודעה",
    create_lead: "יוצר ליד",
    update_lead_status: "מעדכן סטטוס ליד",
    list_leads: "שולף לידים",
    list_clients: "שולף לקוחות",
    create_client: "יוצר לקוח",
  };

  const SidebarContent = () => (
    <>
      <div className="p-3 border-b border-border">
        <Button onClick={startNewConversation} className="w-full" size="sm">
          <Plus className="ml-2 h-4 w-4" />
          שיחה חדשה
        </Button>
      </div>
      <ScrollArea className="flex-1">
        {conversationsLoading ? (
          <div className="p-4 text-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mx-auto" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-xs">
            אין שיחות קודמות
          </div>
        ) : (
          <div className="p-2 space-y-0.5">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => loadConversation(conv)}
                className={`w-full text-right p-2.5 rounded-md transition-colors text-xs ${
                  currentConversationId === conv.id
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-muted'
                }`}
              >
                <div className="font-medium truncate max-w-[160px]">
                  {(conv.title || 'שיחה חדשה').split(' ').slice(0, 4).join(' ')}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {new Date(conv.created_at).toLocaleDateString('he-IL')}
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[95vw] h-[80vh] p-0 gap-0 overflow-hidden flex flex-col" dir="rtl">
        <DialogTitle className="sr-only">AIOS - עוזר AI</DialogTitle>
        
        {/* Header */}
        <div className="border-b border-border p-3 bg-card flex items-center gap-3 flex-shrink-0">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[260px] p-0">
              <SheetHeader className="p-3 border-b">
                <SheetTitle className="text-sm">שיחות</SheetTitle>
              </SheetHeader>
              <div className="flex flex-col h-[calc(100vh-60px)]">
                <SidebarContent />
              </div>
            </SheetContent>
          </Sheet>

          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center flex-shrink-0">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold">AIOS</h2>
            <p className="text-[11px] text-muted-foreground">עוזר AI חכם - ניהול, אוטומציות, הודעות ועוד</p>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-3">
          {messages.length === 0 && !streamingMessage ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-sm">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="h-8 w-8 text-primary-foreground" />
                </div>
                <h3 className="text-lg font-bold mb-2">AIOS</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  העוזר האישי שלך. אני יכול לבצע פעולות במערכת בשבילך:
                </p>
                <div className="grid grid-cols-2 gap-2 text-right">
                  {[
                    { icon: Target, label: "ניהול לידים ולקוחות" },
                    { icon: Zap, label: "יצירת אוטומציות" },
                    { icon: MessageSquare, label: "שליחת הודעות" },
                    { icon: Users, label: "משימות וצוותים" },
                  ].map(({ icon: Icon, label }) => (
                    <Card key={label} className="p-2.5 flex items-center gap-2 border-dashed">
                      <Icon className="h-4 w-4 text-primary flex-shrink-0" />
                      <span className="text-xs">{label}</span>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3 max-w-2xl mx-auto">
              {messages.map((msg, idx) => (
                <div key={idx}>
                  {msg.role === 'user' ? (
                    <div className="flex justify-end">
                      <Card className="p-2.5 max-w-[80%] bg-primary text-primary-foreground border-0">
                        <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                      </Card>
                    </div>
                  ) : msg.role === 'tool_call' ? (
                    <div className="flex justify-start">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-full px-3 py-1.5">
                        <Wrench className="h-3 w-3 text-primary animate-pulse" />
                        <span>{toolLabelMap[msg.tool || ''] || msg.tool}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-start">
                      <Card className="p-2.5 max-w-[85%] bg-card border">
                        <div className="prose prose-sm dark:prose-invert max-w-none text-sm [&>p]:mb-1 [&>ul]:my-1 [&>ol]:my-1">
                          <ReactMarkdown>{msg.content || ''}</ReactMarkdown>
                        </div>
                      </Card>
                    </div>
                  )}
                </div>
              ))}

              {streamingMessage && (
                <div className="flex justify-start">
                  <Card className="p-2.5 max-w-[85%] bg-card border">
                    <div className="prose prose-sm dark:prose-invert max-w-none text-sm [&>p]:mb-1">
                      <ReactMarkdown>{streamingMessage}</ReactMarkdown>
                    </div>
                    <Loader2 className="h-3 w-3 animate-spin inline-block mr-1 mt-1" />
                  </Card>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        {/* Input */}
        <div className="border-t border-border p-3 bg-card flex-shrink-0">
          <div className="max-w-2xl mx-auto flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="בקש ממני לבצע פעולה... (Enter לשליחה)"
              className="min-h-[44px] max-h-[120px] resize-none text-sm"
              disabled={isStreaming}
            />
            <Button
              onClick={sendMessage}
              disabled={!input.trim() || isStreaming}
              size="icon"
              className="h-[44px] w-[44px] flex-shrink-0"
            >
              {isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
