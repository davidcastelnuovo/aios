import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Bot, Send, Plus, Loader2, Wrench, Menu, Trash2 } from "lucide-react";
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

export default function AISupport() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [input, setInput] = useState("");
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteConvId, setDeleteConvId] = useState<string | null>(null);
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
    enabled: !!userId,
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

  const deleteConversation = async (convId: string) => {
    try {
      const { error } = await supabase
        .from('ai_conversations')
        .delete()
        .eq('id', convId);
      if (error) throw error;

      if (currentConversationId === convId) {
        startNewConversation();
      }
      queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
      toast({ title: "השיחה נמחקה" });
    } catch (err: any) {
      toast({ title: "שגיאה", description: err.message, variant: "destructive" });
    }
    setDeleteConvId(null);
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
      let newConversationId = currentConversationId;
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
              newConversationId = parsed.id;
              setCurrentConversationId(parsed.id);
            } else if (parsed.type === 'title_update') {
              // Title was auto-generated, refresh conversation list
              queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
            } else if (parsed.type === 'invalidate') {
              // Auto-refresh UI when agent modifies data
              const entity = parsed.entity;
              if (entity) {
                queryClient.invalidateQueries({ queryKey: [entity] });
                // Also invalidate related query keys
                if (entity === 'tasks') {
                  queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
                }
              }
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

  // Sidebar content component for reuse
  const SidebarContentComponent = () => (
    <>
      <div className="p-4 border-b border-border">
        <Button 
          onClick={startNewConversation}
          className="w-full"
          variant="default"
        >
          <Plus className="ml-2 h-4 w-4" />
          שיחה חדשה
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {conversationsLoading ? (
          <div className="p-4 text-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            אין שיחות קודמות
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={`group relative flex items-center rounded-md transition-colors ${
                  currentConversationId === conv.id
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-muted'
                }`}
              >
                <button
                  onClick={() => loadConversation(conv)}
                  className="flex-1 text-right p-3 min-w-0"
                >
                  <div className="font-medium text-sm truncate">
                    {conv.title || 'שיחה חדשה'}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {new Date(conv.created_at).toLocaleDateString('he-IL')}
                  </div>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 ml-1 mr-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteConvId(conv.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </>
  );

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-background" dir="rtl">
      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteConvId} onOpenChange={(open) => !open && setDeleteConvId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת שיחה</AlertDialogTitle>
            <AlertDialogDescription>
              האם אתה בטוח שברצונך למחוק את השיחה? פעולה זו לא ניתנת לביטול.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConvId && deleteConversation(deleteConvId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              מחק
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Desktop Sidebar */}
      {!isMobile && (
        <div className="w-64 border-l border-border bg-card flex flex-col">
          <SidebarContentComponent />
        </div>
      )}

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="border-b border-border p-3 md:p-4 bg-card">
          <div className="flex items-center gap-3">
            {isMobile && (
              <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-10 w-10">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[280px] p-0">
                  <SheetHeader className="p-4 border-b">
                    <SheetTitle>שיחות</SheetTitle>
                  </SheetHeader>
                  <div className="flex flex-col h-[calc(100vh-80px)]">
                    <SidebarContentComponent />
                  </div>
                </SheetContent>
              </Sheet>
            )}
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Bot className="h-6 w-6 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-base md:text-lg font-semibold truncate">עוזר AI תמיכה טכנית</h1>
              <p className="text-xs md:text-sm text-muted-foreground truncate">
                אני כאן לעזור לך עם המערכת
              </p>
            </div>
            {isMobile && (
              <Button variant="outline" size="icon" className="h-10 w-10 flex-shrink-0" onClick={startNewConversation}>
                <Plus className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-2 md:p-4">
          {messages.length === 0 && !streamingMessage ? (
            <div className="h-full flex items-center justify-center px-4">
              <Card className="p-4 md:p-8 max-w-md text-center">
                <Bot className="h-10 w-10 md:h-12 md:w-12 mx-auto mb-3 md:mb-4 text-primary" />
                <h2 className="text-lg md:text-xl font-semibold mb-2">ברוכים הבאים!</h2>
                <p className="text-sm md:text-base text-muted-foreground mb-3 md:mb-4">
                  אני עוזר AI שיכול לעזור לך עם:
                </p>
                <ul className="text-right text-xs md:text-sm space-y-2 text-muted-foreground">
                  <li>✅ יצירת משימות חדשות</li>
                  <li>✅ עדכון סטטוס משימות</li>
                  <li>✅ חיפוש לקוחות וסוכנויות</li>
                  <li>✅ הצגת רשימות משימות</li>
                  <li>✅ קבלת מידע על לקוחות</li>
                </ul>
                <p className="text-xs md:text-sm text-muted-foreground mt-3 md:mt-4">
                  פשוט שאל אותי או בקש ממני לבצע פעולה!
                </p>
              </Card>
            </div>
          ) : (
            <div className="space-y-3 md:space-y-4 max-w-3xl mx-auto">
              {messages.map((msg, idx) => (
                <div key={idx}>
                  {msg.role === 'user' ? (
                    <div className="flex justify-end">
                      <Card className="p-2 md:p-3 max-w-[85%] md:max-w-[80%] bg-primary text-primary-foreground">
                        <p className="whitespace-pre-wrap text-sm md:text-base">{msg.content}</p>
                      </Card>
                    </div>
                  ) : msg.role === 'tool_call' ? (
                    <div className="flex justify-start">
                      <Card className="p-2 md:p-3 max-w-[85%] md:max-w-[80%] bg-muted">
                        <div className="flex items-center gap-2 text-xs md:text-sm">
                          <Wrench className="h-3 w-3 md:h-4 md:w-4 text-primary animate-pulse" />
                          <span className="text-muted-foreground">
                            מבצע: <strong>{msg.tool}</strong>
                          </span>
                        </div>
                      </Card>
                    </div>
                  ) : (
                    <div className="flex justify-start">
                      <Card className="p-2 md:p-3 max-w-[85%] md:max-w-[80%] bg-card border">
                        <div className="prose prose-sm dark:prose-invert max-w-none text-sm md:text-base">
                          <ReactMarkdown>{msg.content || ''}</ReactMarkdown>
                        </div>
                      </Card>
                    </div>
                  )}
                </div>
              ))}

              {streamingMessage && (
                <div className="flex justify-start">
                  <Card className="p-2 md:p-3 max-w-[85%] md:max-w-[80%] bg-card border">
                    <div className="prose prose-sm dark:prose-invert max-w-none text-sm md:text-base">
                      <ReactMarkdown>{streamingMessage}</ReactMarkdown>
                    </div>
                    <Loader2 className="h-3 w-3 animate-spin inline-block mr-1" />
                  </Card>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        {/* Input */}
        <div className="border-t border-border p-2 md:p-4 bg-card">
          <div className="max-w-3xl mx-auto">
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder={isMobile ? "שאל משהו..." : "שאל משהו או בקש לבצע פעולה... (Enter לשליחה, Shift+Enter לשורה חדשה)"}
                className="min-h-[50px] md:min-h-[60px] max-h-[150px] md:max-h-[200px] resize-none text-sm md:text-base"
                disabled={isStreaming}
              />
              <Button
                onClick={sendMessage}
                disabled={!input.trim() || isStreaming}
                size="icon"
                className="h-[50px] w-[50px] md:h-[60px] md:w-[60px] flex-shrink-0"
              >
                {isStreaming ? (
                  <Loader2 className="h-4 w-4 md:h-5 md:w-5 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 md:h-5 md:w-5" />
                )}
              </Button>
            </div>
            <p className="text-[10px] md:text-xs text-muted-foreground mt-1 md:mt-2 text-center px-2">
              הבוט יכול לעזור בניהול המערכת אבל עלול לעשות טעויות. תמיד בדוק מידע חשוב.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
