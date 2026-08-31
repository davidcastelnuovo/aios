import { AudioLines, Loader2, Square } from "lucide-react";
import { useCarmenComposerDictation } from "@/hooks/useCarmenComposerDictation";
import { mergeTranscriptionIntoComposer } from "@/lib/carmenComposerDictation";
import { useToast } from "@/hooks/use-toast";
import { useCallback } from "react";

type CarmenComposerMicButtonProps = {
  value: string;
  onChange: (next: string) => void;
  onFocus?: () => void;
  disabled?: boolean;
  className?: string;
  title?: string;
};

/** Mic button: transcribe into composer via existing transcribe-voice — no auto-send. */
export function CarmenComposerMicButton({
  value,
  onChange,
  onFocus,
  disabled = false,
  className = "",
  title = "הקלטה לתיבת ההודעה",
}: CarmenComposerMicButtonProps) {
  const { toast } = useToast();

  const handleTranscribed = useCallback((text: string) => {
    onChange(mergeTranscriptionIntoComposer(value, text));
    onFocus?.();
  }, [onChange, onFocus, value]);

  const { isRecording, isTranscribing, toggleRecording } = useCarmenComposerDictation({
    onTranscribed: handleTranscribed,
    onError: (msg) => toast({ title: "שגיאה בתמלול", description: msg, variant: "destructive" }),
    disabled,
  });

  return (
    <button
      type="button"
      onClick={toggleRecording}
      disabled={disabled || isTranscribing}
      title={isRecording ? "עצור הקלטה" : title}
      aria-label={isRecording ? "עצור הקלטה" : title}
      className={className}
    >
      {isTranscribing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isRecording ? (
        <Square className="h-4 w-4" />
      ) : (
        <AudioLines className="h-4 w-4" />
      )}
    </button>
  );
}

export { mergeTranscriptionIntoComposer };
