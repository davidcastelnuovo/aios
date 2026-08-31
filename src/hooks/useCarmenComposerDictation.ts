import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { transcribeAudioBlob } from "@/lib/carmenTranscribeOnly";
import { logComposerDictationEvent } from "@/lib/carmenComposerDictation";

type UseCarmenComposerDictationOptions = {
  onTranscribed: (text: string) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
};

/**
 * Shared mic → transcribe-voice → callback (typically inserts into composer).
 * Does not send messages — caller decides what to do with the text.
 */
export function useCarmenComposerDictation({
  onTranscribed,
  onError,
  disabled = false,
}: UseCarmenComposerDictationOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const stopRecording = useCallback(() => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (disabled || isRecording || isTranscribing) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;
      chunksRef.current = [];
      logComposerDictationEvent("record_start");

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stopTracks();
        recorderRef.current = null;
        setIsRecording(false);
        logComposerDictationEvent("record_stop");

        const audioBlob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];
        if (audioBlob.size < 1000) return;

        setIsTranscribing(true);
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) throw new Error("לא מחובר");

          const text = await transcribeAudioBlob(audioBlob, session.access_token, {
            filename: "voice.webm",
          });
          if (text) {
            logComposerDictationEvent("transcribe_ok", { chars: text.length });
            logComposerDictationEvent("inserted_composer", { chars: text.length });
            onTranscribed(text);
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          logComposerDictationEvent("transcribe_fail", { error: msg });
          onError?.(msg);
        } finally {
          setIsTranscribing(false);
        }
      };

      recorder.start();
      setIsRecording(true);
    } catch {
      onError?.("אין גישה למיקרופון — יש לאפשר גישה בדפדפן");
    }
  }, [disabled, isRecording, isTranscribing, onError, onTranscribed, stopTracks]);

  const toggleRecording = useCallback(() => {
    if (isRecording) stopRecording();
    else void startRecording();
  }, [isRecording, startRecording, stopRecording]);

  return {
    isRecording,
    isTranscribing,
    isBusy: isRecording || isTranscribing,
    startRecording,
    stopRecording,
    toggleRecording,
  };
}
