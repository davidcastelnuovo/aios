import { useState, useRef, KeyboardEvent } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send, Paperclip, Mic, Square, X, Loader2, Smile, AudioLines, Type } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Simple emoji list for quick selection
const COMMON_EMOJIS = ['😊', '😂', '❤️', '👍', '🙏', '😍', '🔥', '💪', '✅', '👏', '🎉', '😁', '🤔', '💯', '⭐', '🙌', '😎', '💬', '📞', '✨'];
interface ReplyToMessage {
  id: string;
  text: string;
  senderName?: string;
}

interface ChatInputProps {
  onSend: (message: string, quotedMessageId?: string) => void;
  onSendFile?: (file: File, caption?: string) => Promise<void>;
  isLoading: boolean;
  replyToMessage?: ReplyToMessage | null;
  onClearReply?: () => void;
}

export default function ChatInput({ onSend, onSendFile, isLoading, replyToMessage, onClearReply }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSendingVoice, setIsSendingVoice] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [sendAsVoice, setSendAsVoice] = useState(true);
  const isMobile = useIsMobile();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = async () => {
    if (selectedFile && onSendFile) {
      try {
        await onSendFile(selectedFile, message.trim() || undefined);
        setSelectedFile(null);
        setFilePreview(null);
        setMessage("");
        onClearReply?.();
      } catch (error) {
        console.error('Error sending file:', error);
      }
      return;
    }
    
    if (!message.trim() || isLoading) return;
    onSend(message, replyToMessage?.id);
    setMessage("");
    onClearReply?.();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (max 16MB for WhatsApp)
    if (file.size > 16 * 1024 * 1024) {
      toast.error("הקובץ גדול מדי. מקסימום 16MB");
      return;
    }

    setSelectedFile(file);
    
    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setFilePreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        
        if (sendAsVoice && onSendFile) {
          // Send as voice message
          await sendVoiceMessage(audioBlob);
        } else {
          // Transcribe the audio
          await transcribeAudio(audioBlob);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error("לא ניתן לגשת למיקרופון");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const sendVoiceMessage = async (audioBlob: Blob) => {
    setIsSendingVoice(true);
    try {
      const file = new File([audioBlob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
      await onSendFile!(file);
      toast.success("הודעה קולית נשלחה");
    } catch (error) {
      console.error('Voice send error:', error);
      toast.error("שגיאה בשליחת הודעה קולית");
    } finally {
      setIsSendingVoice(false);
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      const { data, error } = await supabase.functions.invoke('transcribe-voice', {
        body: formData,
      });

      if (error) throw error;
      
      if (data?.text) {
        setMessage(prev => prev ? prev + ' ' + data.text : data.text);
        toast.success("הקלטה תומללה בהצלחה");
      }
    } catch (error) {
      console.error('Transcription error:', error);
      toast.error("שגיאה בתמלול ההקלטה");
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleEmojiSelect = (emoji: any) => {
    setMessage(prev => prev + emoji.native);
    setShowEmojiPicker(false);
    textareaRef.current?.focus();
  };

  return (
    <div className={`${isMobile ? 'p-2' : 'p-4'} space-y-2`}>
      {/* Reply preview */}
      {replyToMessage && (
        <div className="flex items-center gap-2 p-2 bg-muted rounded-lg border-r-4 border-blue-500">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-blue-600">
              מגיב ל{replyToMessage.senderName || 'הודעה'}
            </p>
            <p className="text-sm truncate text-muted-foreground">
              {replyToMessage.text}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClearReply} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* File preview */}
      {selectedFile && (
        <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
          {filePreview ? (
            <img src={filePreview} alt="Preview" className="h-12 w-12 object-cover rounded" />
          ) : (
            <div className="h-12 w-12 bg-primary/10 rounded flex items-center justify-center">
              <Paperclip className="h-5 w-5 text-primary" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{selectedFile.name}</p>
            <p className="text-xs text-muted-foreground">
              {(selectedFile.size / 1024).toFixed(1)} KB
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={clearSelectedFile}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="flex gap-2 items-center">
        {/* File attach button */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx"
          className="hidden"
          onChange={handleFileSelect}
        />
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 h-10 w-10"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading || isRecording}
        >
          <Paperclip className="h-4 w-4" />
        </Button>

        {/* Emoji picker button */}
        <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 h-10 w-10"
              disabled={isLoading || isRecording}
            >
              <Smile className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent 
            className="w-64 p-2 shadow-lg" 
            side="top" 
            align="start"
            sideOffset={8}
          >
            <div className="grid grid-cols-5 gap-1">
              {COMMON_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleEmojiSelect({ native: emoji })}
                  className="text-xl p-2 hover:bg-muted rounded transition-colors"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Voice mode toggle */}
        {onSendFile && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={`shrink-0 h-8 w-8 ${sendAsVoice ? 'text-primary' : 'text-muted-foreground'}`}
                onClick={() => setSendAsVoice(!sendAsVoice)}
                disabled={isLoading || isRecording || isTranscribing || isSendingVoice}
              >
                {sendAsVoice ? <AudioLines className="h-3.5 w-3.5" /> : <Type className="h-3.5 w-3.5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {sendAsVoice ? "מצב: שלח כהודעה קולית (לחץ לעבור לתמלול)" : "מצב: תמלל לטקסט (לחץ לעבור לקולי)"}
            </TooltipContent>
          </Tooltip>
        )}

        {/* Voice recording button */}
        <Button
          variant={isRecording ? "destructive" : "ghost"}
          size="icon"
          className="shrink-0 h-10 w-10"
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isLoading || isTranscribing || isSendingVoice}
        >
          {isTranscribing || isSendingVoice ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isRecording ? (
            <Square className="h-4 w-4" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
        </Button>

        <Textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={selectedFile ? "הוסף כיתוב (אופציונלי)..." : "הקלד הודעה... (Enter לשליחה)"}
          className="resize-none flex-1 h-10 min-h-10 max-h-10"
          rows={1}
          disabled={isLoading || isRecording || isTranscribing || isSendingVoice}
        />
        
        <Button
          onClick={handleSend}
          disabled={(!message.trim() && !selectedFile) || isLoading || isRecording || isTranscribing || isSendingVoice}
          size="icon"
          className="shrink-0 h-10 w-10"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
      
      {isRecording && (
        <p className="text-xs text-destructive text-center animate-pulse">
          🔴 מקליט... {sendAsVoice ? '(ישלח כהודעה קולית)' : '(יתמלל לטקסט)'}
        </p>
      )}
    </div>
  );
}
