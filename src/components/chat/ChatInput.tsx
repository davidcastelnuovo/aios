import { useState, useRef, KeyboardEvent } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send, Paperclip, Mic, Square, X, Loader2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ChatInputProps {
  onSend: (message: string) => void;
  onSendFile?: (file: File, caption?: string) => Promise<void>;
  isLoading: boolean;
}

export default function ChatInput({ onSend, onSendFile, isLoading }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const isMobile = useIsMobile();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const handleSend = async () => {
    if (selectedFile && onSendFile) {
      try {
        await onSendFile(selectedFile, message.trim() || undefined);
        setSelectedFile(null);
        setFilePreview(null);
        setMessage("");
      } catch (error) {
        console.error('Error sending file:', error);
      }
      return;
    }
    
    if (!message.trim() || isLoading) return;
    onSend(message);
    setMessage("");
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
        
        // Transcribe the audio
        await transcribeAudio(audioBlob);
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

  return (
    <div className={`${isMobile ? 'p-2' : 'p-4'} space-y-2`}>
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

        {/* Voice recording button */}
        <Button
          variant={isRecording ? "destructive" : "ghost"}
          size="icon"
          className="shrink-0 h-10 w-10"
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isLoading || isTranscribing}
        >
          {isTranscribing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isRecording ? (
            <Square className="h-4 w-4" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
        </Button>

        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={selectedFile ? "הוסף כיתוב (אופציונלי)..." : "הקלד הודעה... (Enter לשליחה)"}
          className="resize-none flex-1 h-10 min-h-10 max-h-10"
          rows={1}
          disabled={isLoading || isRecording || isTranscribing}
        />
        
        <Button
          onClick={handleSend}
          disabled={(!message.trim() && !selectedFile) || isLoading || isRecording || isTranscribing}
          size="icon"
          className="shrink-0 h-10 w-10"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
      
      {isRecording && (
        <p className="text-xs text-destructive text-center animate-pulse">
          🔴 מקליט... לחץ על הכפתור לסיום
        </p>
      )}
    </div>
  );
}
