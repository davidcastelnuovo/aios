import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Bot, Send, Plus, Loader2, Wrench, Menu, Sparkles, Zap, MessageSquare, Users, Target, Mic, MicOff, Square, PlayCircle, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import ReactMarkdown from "react-markdown";
import { invalidateAIEntityQueries } from "@/lib/aiInvalidation";

interface BackgroundTask {
  id: string;
  title: string;
  status: string;
  run_count: number | null;
  result: any;
  created_at: string;
  completed_at: string | null;
}

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
  onWorkingChange?: (working: boolean) => void;
}

export function AIOSDialog({ open, onOpenChange, onWorkingChange }: AIOSDialogProps) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [input, setInput] = useState("");
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { toast } = useToast();
  const { userId } = useCurrentUser();
  const { tenantId } = useCurrentTenant();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [backgroundTasks, setBackgroundTasks] = useState<BackgroundTask[]>([]);

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

  useEffect(() => {
    onWorkingChange?.(isStreaming);
  }, [isStreaming, onWorkingChange]);

  // Load and subscribe to background tasks
  useEffect(() => {
    if (!open || !tenantId) return;

    // Initial load of recent background tasks
    const loadTasks = async () => {
      const { data } = await supabase
        .from('agent_tasks')
        .select('id, title, status, run_count, result, created_at, completed_at')
        .eq('tenant_id', tenantId)
        .eq('task_mode', 'background')
        .in('status', ['pending', 'running', 'completed', 'failed'])
        .order('created_at', { ascending: false })
        .limit(5);
      if (data) setBackgroundTasks(data as BackgroundTask[]);
    };
    loadTasks();

    // Realtime subscription
    const channel = supabase
      .channel('bg-tasks')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'agent_tasks',
        filter: `tenant_id=eq.${tenantId}`,
      }, (payload) => {
        const task = payload.new as any;
        if (task?.task_mode !== 'background') return;
        
        setBackgroundTasks(prev => {
          const idx = prev.findIndex(t => t.id === task.id);
          const updated: BackgroundTask = {
            id: task.id,
            title: task.title,
            status: task.status,
            run_count: task.run_count,
            result: task.result,
            created_at: task.created_at,
            completed_at: task.completed_at,
          };
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = updated;
            return copy;
          }
          return [updated, ...prev].slice(0, 5);
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [open, tenantId]);

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

      // Build conversation_history from prior text/tool messages
      const conversationHistory = messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role, content: m.content || '' }));

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/run-ai-agent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            command_text: input,
            tenant_id: tenantId,
            surface: 'aios',
            stream: true,
            conversation_history: conversationHistory,
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

      let receivedDone = false;

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
            } else if (parsed.type === 'invalidate') {
              invalidateAIEntityQueries(queryClient, parsed.entity);
            } else if (parsed.type === 'done') {
              receivedDone = true;
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

      // Stream ended without 'done' signal — timeout or disconnect
      if (!receivedDone) {
        if (assistantContent) {
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: assistantContent + "\n\n⚠️ _החיבור נותק — ייתכן שהפעולה הופסקה באמצע._",
            timestamp: new Date().toISOString(),
          }]);
          setStreamingMessage("");
        } else {
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: "⚠️ הפעולה הופסקה — ייתכן שהמשימה ארוכה מדי. נסה לפרק אותה לחלקים קטנים יותר.",
            timestamp: new Date().toISOString(),
          }]);
          setStreamingMessage("");
        }
        setIsStreaming(false);
        queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
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

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        setRecordingDuration(0);

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (audioBlob.size < 1000) return; // too short

        setIsTranscribing(true);
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) throw new Error('Not authenticated');

          const formData = new FormData();
          formData.append('audio', audioBlob, 'voice.webm');

          const res = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-voice`,
            {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${session.access_token}` },
              body: formData,
            }
          );

          if (!res.ok) throw new Error('Transcription failed');
          const { text } = await res.json();

          if (text && text.trim()) {
            // Auto-send the transcribed text to Carmen
            setInput(text.trim());
            // Use a slight delay to let state update, then trigger send
            setTimeout(() => {
              const fakeInput = text.trim();
              setInput("");
              // Directly invoke the send logic with the transcribed text
              sendMessageWithText(fakeInput);
            }, 100);
          }
        } catch (err: any) {
          console.error('Transcription error:', err);
          toast({
            title: "שגיאה בתמלול",
            description: "לא הצלחנו לתמלל את ההקלטה. נסה שוב.",
            variant: "destructive",
          });
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      toast({
        title: "אין גישה למיקרופון",
        description: "יש לאפשר גישה למיקרופון בדפדפן",
        variant: "destructive",
      });
    }
  }, [toast]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, []);

  const sendMessageWithText = async (text: string) => {
    if (!text.trim() || isStreaming) return;

    const userMessage: Message = {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsStreaming(true);
    setStreamingMessage("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-support-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            message: text,
            conversation_id: currentConversationId,
            tenant_slug: tenantSlug,
          }),
        }
      );

      if (!response.ok) {
        if (response.status === 429) throw new Error('חריגה ממגבלת הקצב. אנא נסה שוב מאוחר יותר.');
        if (response.status === 402) throw new Error('נדרש תשלום. אנא הוסף יתרה ל-workspace שלך.');
        throw new Error('שגיאה בתקשורת עם השרת');
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let assistantContent = '';

      let receivedDone = false;

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
              setMessages(prev => [...prev, {
                role: 'tool_call', tool: parsed.tool, args: parsed.args, timestamp: new Date().toISOString(),
              }]);
            } else if (parsed.type === 'conversation_id') {
              setCurrentConversationId(parsed.id);
            } else if (parsed.type === 'invalidate') {
              invalidateAIEntityQueries(queryClient, parsed.entity);
            } else if (parsed.type === 'done') {
              receivedDone = true;
              if (assistantContent) {
                setMessages(prev => [...prev, { role: 'assistant', content: assistantContent, timestamp: new Date().toISOString() }]);
                setStreamingMessage("");
              }
              setIsStreaming(false);
              queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
            }
          } catch (e) { console.error('Parse error:', e); }
        }
      }

      if (!receivedDone) {
        if (assistantContent) {
          setMessages(prev => [...prev, { role: 'assistant', content: assistantContent + "\n\n⚠️ _החיבור נותק — ייתכן שהפעולה הופסקה באמצע._", timestamp: new Date().toISOString() }]);
        } else {
          setMessages(prev => [...prev, { role: 'assistant', content: "⚠️ הפעולה הופסקה — ייתכן שהמשימה ארוכה מדי. נסה לפרק אותה לחלקים קטנים יותר.", timestamp: new Date().toISOString() }]);
        }
        setStreamingMessage("");
        setIsStreaming(false);
        queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast({ title: "שגיאה", description: error.message || "שגיאה בשליחת ההודעה", variant: "destructive" });
      setIsStreaming(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const toolLabelMap: Record<string, string> = {
    create_task: "יוצר משימה",
    update_task: "מעדכן משימה",
    update_task_status: "מעדכן סטטוס משימה",
    search_tasks: "מחפש משימות",
    delete_task: "מוחק משימה",
    add_task_update: "מוסיף עדכון למשימה",
    manage_task_collaborators: "מנהל שותפים במשימה",
    list_tasks: "שולף משימות",
    search_entities: "מחפש",
    get_client_info: "שולף מידע על לקוח",
    create_automation: "יוצר אוטומציה",
    send_message: "שולח הודעת WhatsApp",
    get_chat_history: "שולף היסטוריית שיחות",
    create_lead: "יוצר ליד",
    update_lead_status: "מעדכן סטטוס ליד",
    list_leads: "שולף לידים",
    list_clients: "שולף לקוחות",
    create_client: "יוצר לקוח",
    list_emails: "שולף אימיילים",
    get_email: "קורא אימייל",
    send_email: "שולח אימייל",
    delete_email: "מוחק אימייל",
    save_memory: "שומר לזיכרון",
    recall_memory: "שולף זיכרון",
    delete_memory: "מוחק זיכרון",
    delegate_to_background: "מעביר לריצה ברקע",
    batch_update_client_health: "מעדכן בריאות לקוחות",
    analyze_campaign_performance: "מנתח ביצועי קמפיינים",
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
        <DialogTitle className="sr-only">כרמן — עוזרת AI</DialogTitle>
        
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

          <div className="relative flex-shrink-0">
            {isStreaming && (
              <>
                <span aria-hidden="true" className="absolute -inset-2 rounded-full bg-success/20 animate-pulse" />
                <span aria-hidden="true" className="absolute -inset-1 rounded-full ring-2 ring-success/60 animate-carmen-glow" />
              </>
            )}
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/310419663030948028/XGJWpzb5zh76ZdoV37Q3K8/carmen-icon-CyF3DNNJ8Z9Uhfz7EpYJcQ.webp"
              alt="כרמן"
              className={`relative z-10 h-9 w-9 rounded-full object-cover border-2 ${isStreaming ? 'border-success/70' : 'border-border'}`}
            />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold">כרמן</h2>
            <p className="text-[11px] text-muted-foreground">עוזרת AI חכמה — ניהול, אוטומציות, הודעות ועוד</p>
          </div>
        </div>

        {/* Background Tasks Progress */}
        {backgroundTasks.filter(t => t.status === 'pending' || t.status === 'running').length > 0 && (
          <div className="border-b border-border px-3 py-2 bg-muted/30 flex-shrink-0 space-y-1.5">
            {backgroundTasks
              .filter(t => t.status === 'pending' || t.status === 'running')
              .map(task => (
                <div key={task.id} className="flex items-center gap-2 text-xs">
                  {task.status === 'pending' ? (
                    <Clock className="h-3.5 w-3.5 text-muted-foreground animate-pulse" />
                  ) : (
                    <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
                  )}
                  <span className="font-medium truncate flex-1">{task.title}</span>
                  {task.run_count && task.run_count > 1 && (
                    <span className="text-muted-foreground">סבב {task.run_count}</span>
                  )}
                  <span className="text-muted-foreground">
                    {task.status === 'pending' ? 'ממתין...' : 'רץ ברקע...'}
                  </span>
                </div>
              ))}
          </div>
        )}

        {/* Completed Background Tasks (show briefly) */}
        {backgroundTasks.filter(t => t.status === 'completed' && t.completed_at && 
          (Date.now() - new Date(t.completed_at).getTime()) < 60000
        ).length > 0 && (
          <div className="border-b border-border px-3 py-2 bg-success/5 flex-shrink-0 space-y-1.5">
            {backgroundTasks
              .filter(t => t.status === 'completed' && t.completed_at && 
                (Date.now() - new Date(t.completed_at).getTime()) < 60000)
              .map(task => (
                <div key={task.id} className="flex items-center gap-2 text-xs">
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                  <span className="font-medium truncate flex-1">{task.title}</span>
                  <span className="text-success">הושלם ✓</span>
                </div>
              ))}
          </div>
        )}

        {/* Messages */}
        <ScrollArea className="flex-1 p-3">
          {messages.length === 0 && !streamingMessage ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-sm">
                <img
                  src="https://d2xsxph8kpxj0f.cloudfront.net/310419663030948028/XGJWpzb5zh76ZdoV37Q3K8/carmen-icon-CyF3DNNJ8Z9Uhfz7EpYJcQ.webp"
                  alt="כרמן"
                  className="h-20 w-20 rounded-full object-cover mx-auto mb-4 border-2 border-red-600/40 shadow-lg"
                />
                <h3 className="text-lg font-bold mb-1">שלום! אני כרמן 👋</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  העוזרת האישית שלך. אני יכולה לבצע פעולות במערכת בשבילך:
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
                        <p dir="rtl" className="whitespace-pre-wrap text-sm text-right">{msg.content}</p>
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
                        <div dir="rtl" className="prose prose-sm dark:prose-invert max-w-none text-sm text-right [&>p]:mb-1 [&>ul]:my-1 [&>ol]:my-1">
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
                    <div dir="rtl" className="prose prose-sm dark:prose-invert max-w-none text-sm text-right [&>p]:mb-1">
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
            {isRecording ? (
              <div className="flex-1 flex items-center gap-3 bg-destructive/10 border border-destructive/30 rounded-md px-4 py-2">
                <div className="h-3 w-3 rounded-full bg-destructive animate-pulse" />
                <span className="text-sm font-medium text-destructive">מקליט... {formatDuration(recordingDuration)}</span>
                <div className="flex-1" />
                <Button
                  onClick={stopRecording}
                  size="icon"
                  variant="destructive"
                  className="h-[36px] w-[36px]"
                >
                  <Square className="h-4 w-4" />
                </Button>
              </div>
            ) : isTranscribing ? (
              <div className="flex-1 flex items-center gap-3 bg-muted rounded-md px-4 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">ממלל את ההקלטה...</span>
              </div>
            ) : (
              <>
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="בקש ממני לבצע פעולה... (Enter לשליחה)"
                  className="min-h-[44px] max-h-[120px] resize-none text-sm"
                  disabled={isStreaming}
                />
                <div className="flex flex-col gap-1">
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
                <Button
                  onClick={startRecording}
                  disabled={isStreaming}
                  size="icon"
                  variant="outline"
                  className="h-[44px] w-[44px] flex-shrink-0 hover:bg-primary/10 hover:text-primary hover:border-primary"
                  title="הקלט הודעה קולית"
                >
                  <Mic className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
