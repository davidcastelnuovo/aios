import {
  forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState,
} from "react";
import { ChevronDown, ChevronUp, Loader2, Mic, Send, Square, Volume2, VolumeX, Wrench } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { CarmenFaceState } from "./CarmenFace";
import { startRealtimeVoice, RealtimeHandle } from "./realtimeVoice";

interface ChatMessage {
  role: "user" | "assistant" | "tool_call";
  content?: string;
  tool?: string;
}

export interface CarmenChatBarHandle {
  /** Put text in the input (e.g. quick commands) and focus it */
  prefill: (text: string) => void;
  /** Send a message programmatically */
  send: (text: string) => void;
  /** Start voice capture */
  startVoice: () => void;
}

interface CarmenChatBarProps {
  tenantId: string | null;
  onFaceState: (state: CarmenFaceState) => void;
  audioLevelRef: React.MutableRefObject<number>;
}

/**
 * The "talk to Carmen" bar: text + voice in, streamed text + spoken voice out.
 * Uses the existing run-ai-agent (SSE), transcribe-voice and carmen-speak
 * edge functions — no new backend.
 */
export const CarmenChatBar = forwardRef<CarmenChatBarHandle, CarmenChatBarProps>(
  function CarmenChatBar({ tenantId, onFaceState, audioLevelRef }, ref) {
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [streamingText, setStreamingText] = useState("");
    const [isStreaming, setIsStreaming] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [voiceOn, setVoiceOn] = useState(true);
    const [expanded, setExpanded] = useState(false);
    const [isConvMode, setIsConvMode] = useState(false);
    const [isRealtime, setIsRealtime] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const playingRef = useRef<HTMLAudioElement | null>(null);
    // Sentence-streaming TTS: queue of segments + generation counter for cancellation
    const ttsQueueRef = useRef<string[]>([]);
    const ttsPumpingRef = useRef(false);
    const ttsGenRef = useRef(0);
    // Continuous conversation mode (VAD): refs so async loops see fresh state
    const convModeRef = useRef(false);
    const micStreamRef = useRef<MediaStream | null>(null);
    const vadRafRef = useRef(0);
    const sendTextRef = useRef<(t: string) => void>(() => {});
    const listenTurnRef = useRef<() => void>(() => {});
    // OpenAI Realtime session (preferred voice mode; VAD loop is the fallback)
    const realtimeRef = useRef<RealtimeHandle | null>(null);
    const { toast } = useToast();

    const scrollDown = () => {
      requestAnimationFrame(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight }));
    };

    const stopSpeech = useCallback(() => {
      ttsGenRef.current++;
      ttsQueueRef.current = [];
      playingRef.current?.pause();
      playingRef.current = null;
      audioLevelRef.current = 0;
      onFaceState("idle");
    }, [audioLevelRef, onFaceState]);

    const fetchTts = useCallback(async (text: string): Promise<Blob | null> => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return null;
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/carmen-speak`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ text }),
        });
        return res.ok ? await res.blob() : null;
      } catch { return null; }
    }, []);

    /** Play one audio blob through an analyser so the face moves with it. Resolves on end. */
    const playBlob = useCallback(async (blob: Blob, gen: number) => {
      if (ttsGenRef.current !== gen) return;
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      playingRef.current = audio;
      try {
        const ctx = audioCtxRef.current ?? new AudioContext();
        audioCtxRef.current = ctx;
        if (ctx.state === "suspended") await ctx.resume();
        const src = ctx.createMediaElementSource(audio);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        src.connect(analyser);
        analyser.connect(ctx.destination);
        const buf = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          if (playingRef.current !== audio) return;
          analyser.getByteTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
          audioLevelRef.current = Math.min(1, Math.sqrt(sum / buf.length) * 4);
          requestAnimationFrame(tick);
        };
        await new Promise<void>((resolve) => {
          const done = () => { URL.revokeObjectURL(url); resolve(); };
          audio.onended = done;
          audio.onerror = done;
          audio.play().then(tick).catch(done);
        });
      } finally {
        if (playingRef.current === audio) { playingRef.current = null; audioLevelRef.current = 0; }
      }
    }, [audioLevelRef]);

    /**
     * Drain the sentence queue: fetch TTS for the next segment while the
     * current one is playing, so speech flows continuously as text streams in.
     */
    const pumpTts = useCallback(async () => {
      if (ttsPumpingRef.current) return;
      ttsPumpingRef.current = true;
      const gen = ttsGenRef.current;
      onFaceState("speaking");
      try {
        let prefetch: Promise<Blob | null> | null = null;
        while (ttsGenRef.current === gen) {
          const next = prefetch ?? (ttsQueueRef.current.length ? fetchTts(ttsQueueRef.current.shift()!) : null);
          prefetch = null;
          if (!next) break;
          const blob = await next;
          if (ttsGenRef.current !== gen) break;
          if (ttsQueueRef.current.length) prefetch = fetchTts(ttsQueueRef.current.shift()!);
          if (blob) await playBlob(blob, gen);
        }
      } finally {
        ttsPumpingRef.current = false;
        if (ttsGenRef.current === gen) {
          // More sentences may have arrived while the last one was playing
          if (ttsQueueRef.current.length) pumpTts();
          else {
            audioLevelRef.current = 0;
            // Natural conversation: when Carmen finishes speaking, listen again
            if (convModeRef.current) listenTurnRef.current();
            else onFaceState("idle");
          }
        }
      }
    }, [audioLevelRef, fetchTts, onFaceState, playBlob]);

    const enqueueSpeech = useCallback((segment: string) => {
      const clean = segment.trim();
      if (!clean) return;
      ttsQueueRef.current.push(clean);
      pumpTts();
    }, [pumpTts]);

    /** Cut the next speakable sentence off the front of the buffer, if one is complete. */
    const extractSentence = (buf: string, minLen: number): [string, string] | null => {
      if (buf.length < minLen) return null;
      const re = /[.!?…]["']?(?=\s|$)|\n/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(buf))) {
        const end = m.index + m[0].length;
        if (end >= minLen) return [buf.slice(0, end), buf.slice(end)];
      }
      return null;
    };

    const sendText = useCallback(async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming || !tenantId) return;
      stopSpeech();
      setMessages(prev => [...prev, { role: "user", content: trimmed }]);
      setInput("");
      setExpanded(true);
      setIsStreaming(true);
      setStreamingText("");
      scrollDown();

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("לא מחוברת");

        const history = messages
          .filter(m => m.role === "user" || m.role === "assistant")
          .map(m => ({ role: m.role, content: m.content ?? "" }));

        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/run-ai-agent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({
            command_text: trimmed,
            tenant_id: tenantId,
            surface: "internal_chat",
            stream: true,
            conversation_history: history,
          }),
        });
        if (!res.ok) throw new Error(res.status === 429 ? "חריגה ממגבלת הקצב — נסי שוב עוד רגע" : "שגיאה בתקשורת עם כרמן");

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let answer = "";
        let gotDone = false;
        // Sentence-streaming TTS: speak each sentence as soon as it completes,
        // while the rest of the answer is still being generated.
        let speechBuf = "";
        let firstSegmentSent = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6);
            if (payload === "[DONE]") continue;
            try {
              const parsed = JSON.parse(payload);
              if (parsed.type === "token") {
                answer += parsed.content;
                setStreamingText(prev => prev + parsed.content);
                if (voiceOn) {
                  speechBuf += parsed.content;
                  // Short first segment so speech starts fast, longer afterwards
                  let cut = extractSentence(speechBuf, firstSegmentSent ? 90 : 25);
                  while (cut) {
                    enqueueSpeech(cut[0]);
                    speechBuf = cut[1];
                    firstSegmentSent = true;
                    cut = extractSentence(speechBuf, 90);
                  }
                }
                scrollDown();
              } else if (parsed.type === "tool_call") {
                setMessages(prev => [...prev, { role: "tool_call", tool: parsed.tool }]);
                scrollDown();
              } else if (parsed.type === "done") {
                gotDone = true;
              }
            } catch { /* partial line */ }
          }
        }

        if (voiceOn && speechBuf.trim()) enqueueSpeech(speechBuf);

        const finalText = answer || (gotDone ? "" : "⚠️ החיבור נותק באמצע — נסי שוב.");
        if (finalText) {
          setMessages(prev => [...prev, { role: "assistant", content: finalText }]);
        }
        setStreamingText("");
        scrollDown();
      } catch (err: any) {
        toast({ title: "שגיאה", description: err.message ?? "שגיאה בשליחה", variant: "destructive" });
      } finally {
        setIsStreaming(false);
        // Hands-free mode with the voice muted (or an empty reply): reopen the mic
        if (convModeRef.current && !ttsPumpingRef.current && ttsQueueRef.current.length === 0) {
          listenTurnRef.current();
        }
      }
    }, [isStreaming, tenantId, messages, voiceOn, enqueueSpeech, stopSpeech, toast]);

    const endConversation = useCallback(() => {
      convModeRef.current = false;
      setIsConvMode(false);
      realtimeRef.current?.stop();
      realtimeRef.current = null;
      setIsRealtime(false);
      cancelAnimationFrame(vadRafRef.current);
      if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
      micStreamRef.current?.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
      setIsRecording(false);
      stopSpeech();
    }, [stopSpeech]);

    /** Carmen's full brain, exposed to the realtime model as the ask_carmen tool. */
    const askCarmenBrain = useCallback(async (question: string): Promise<string> => {
      if (!question.trim() || !tenantId) return "לא התקבלה שאלה.";
      setMessages(prev => [...prev, { role: "tool_call", tool: `ask_carmen: ${question.slice(0, 80)}` }]);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return "שגיאת התחברות למערכת.";
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/run-ai-agent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ command_text: question, tenant_id: tenantId, surface: "internal_chat", stream: false }),
        });
        if (!res.ok) return "לא הצלחתי לגשת למערכת כרגע.";
        const data = await res.json();
        return typeof data.output === "string" && data.output ? data.output : "לא נמצאה תשובה.";
      } catch {
        return "שגיאה בגישה למערכת.";
      }
    }, [tenantId]);

    /** Try to open an OpenAI Realtime session. Returns false to fall back to the VAD loop. */
    const beginRealtime = useCallback(async (): Promise<boolean> => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return false;
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/carmen-realtime-session`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({}),
        });
        if (!res.ok) return false;
        const { client_secret, model } = await res.json();
        if (!client_secret) return false;

        const handle = await startRealtimeVoice(client_secret, model, {
          onUserTranscript: (text) => {
            setMessages(prev => [...prev, { role: "user", content: text }]);
            setExpanded(true);
            scrollDown();
          },
          onAssistantDelta: (delta) => { setStreamingText(prev => prev + delta); scrollDown(); },
          onAssistantDone: (text) => {
            setStreamingText("");
            setMessages(prev => [...prev, { role: "assistant", content: text }]);
            scrollDown();
          },
          onToolCall: askCarmenBrain,
          onStateChange: (state) => { if (convModeRef.current) onFaceState(state); },
          onError: (msg) => console.error("[realtime]", msg),
          audioLevelRef,
        });
        realtimeRef.current = handle;
        setIsRealtime(true);
        onFaceState("listening");
        return true;
      } catch {
        return false;
      }
    }, [askCarmenBrain, audioLevelRef, onFaceState]);

    /**
     * One listening turn in continuous-conversation mode: open the mic with a
     * voice-activity detector — recording ends automatically after ~1.2s of
     * silence following speech, is transcribed and sent; Carmen's spoken reply
     * hands the mic back (see pumpTts). No clicks between turns.
     */
    const beginListenTurn = useCallback(async () => {
      if (!convModeRef.current) return;
      if (mediaRecorderRef.current?.state === "recording") return; // already listening
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        if (!convModeRef.current) { stream.getTracks().forEach(t => t.stop()); return; }
        micStreamRef.current = stream;
        const rec = new MediaRecorder(stream, { mimeType: "audio/webm" });
        mediaRecorderRef.current = rec;
        chunksRef.current = [];
        rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };

        // Voice-activity detection on the mic stream
        const ctx = audioCtxRef.current ?? new AudioContext();
        audioCtxRef.current = ctx;
        if (ctx.state === "suspended") await ctx.resume();
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        src.connect(analyser);
        const buf = new Uint8Array(analyser.frequencyBinCount);
        const startedAt = performance.now();
        let speechStarted = false;
        let lastSpeechAt = startedAt;

        const SPEECH_RMS = 0.045;      // above → counts as speech
        const SILENCE_MS = 1200;       // this much quiet after speech → turn over
        const NO_SPEECH_TIMEOUT = 12000; // nothing said → end the conversation
        const MAX_TURN_MS = 60000;

        const vad = () => {
          if (!convModeRef.current || mediaRecorderRef.current !== rec) return;
          analyser.getByteTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
          const rms = Math.sqrt(sum / buf.length);
          audioLevelRef.current = Math.min(1, rms * 5); // face pulses while you talk
          const now = performance.now();
          if (rms > SPEECH_RMS) { speechStarted = true; lastSpeechAt = now; }
          const turnOver = speechStarted && now - lastSpeechAt > SILENCE_MS;
          const gaveUp = !speechStarted && now - startedAt > NO_SPEECH_TIMEOUT;
          const tooLong = now - startedAt > MAX_TURN_MS;
          if (turnOver || tooLong) { rec.stop(); return; }
          if (gaveUp) { endConversation(); onFaceState("idle"); return; }
          vadRafRef.current = requestAnimationFrame(vad);
        };

        rec.onstop = async () => {
          cancelAnimationFrame(vadRafRef.current);
          src.disconnect();
          stream.getTracks().forEach(t => t.stop());
          if (micStreamRef.current === stream) micStreamRef.current = null;
          setIsRecording(false);
          audioLevelRef.current = 0;
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          if (!speechStarted || blob.size < 1000) {
            if (convModeRef.current) beginListenTurn();
            return;
          }
          setIsTranscribing(true);
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("לא מחוברת");
            const form = new FormData();
            form.append("audio", blob, "voice.webm");
            const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-voice`, {
              method: "POST",
              headers: { Authorization: `Bearer ${session.access_token}` },
              body: form,
            });
            if (!res.ok) throw new Error("התמלול נכשל");
            const { text } = await res.json();
            const clean = (text ?? "").trim();
            if (clean.length >= 2) sendTextRef.current(clean);
            else if (convModeRef.current) beginListenTurn();
          } catch {
            toast({ title: "שגיאה בתמלול", description: "לא הצלחנו לתמלל — נסי שוב", variant: "destructive" });
            if (convModeRef.current) beginListenTurn();
          } finally {
            setIsTranscribing(false);
          }
        };

        rec.start();
        setIsRecording(true);
        onFaceState("listening");
        vadRafRef.current = requestAnimationFrame(vad);
      } catch {
        endConversation();
        toast({ title: "אין גישה למיקרופון", description: "יש לאפשר גישה למיקרופון בדפדפן", variant: "destructive" });
      }
    }, [audioLevelRef, endConversation, onFaceState, toast]);

    /**
     * Mic button: toggles a natural hands-free conversation with Carmen.
     * Prefers OpenAI Realtime (ChatGPT-voice-grade latency + barge-in); falls
     * back to the local VAD loop when the realtime session can't be opened.
     */
    const startVoice = useCallback(async () => {
      if (convModeRef.current) { endConversation(); onFaceState("idle"); return; }
      stopSpeech();
      convModeRef.current = true;
      setIsConvMode(true);
      const realtimeOk = await beginRealtime();
      if (!realtimeOk && convModeRef.current) beginListenTurn();
    }, [beginListenTurn, beginRealtime, endConversation, onFaceState, stopSpeech]);

    // Keep async loops (VAD, TTS pump) pointed at the freshest callbacks
    sendTextRef.current = sendText;
    listenTurnRef.current = beginListenTurn;

    // Release the mic and stop audio when the page unmounts
    useEffect(() => () => endConversation(), [endConversation]);

    useImperativeHandle(ref, () => ({
      prefill: (text: string) => { setInput(text); inputRef.current?.focus(); },
      send: sendText,
      startVoice,
    }), [sendText, startVoice]);

    const hasThread = messages.length > 0 || !!streamingText;

    return (
      <div className="cc-panel cc-talkbar flex flex-col overflow-hidden">
        {hasThread && (
          <>
            <button
              onClick={() => setExpanded(e => !e)}
              className="flex items-center justify-center gap-1 border-b border-[var(--cc-line)] py-1 text-xs text-[var(--cc-text-dim)] hover:text-[var(--cc-accent)]"
            >
              {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
              {expanded ? "כווץ שיחה" : `הצג שיחה (${messages.filter(m => m.role !== "tool_call").length})`}
            </button>
            {expanded && (
              <div ref={listRef} className="cc-scroll max-h-[38vh] space-y-2 overflow-y-auto p-3">
                {messages.map((m, i) => m.role === "tool_call" ? (
                  <p key={i} className="flex items-center gap-1.5 text-xs text-[var(--cc-text-dim)]">
                    <Wrench className="h-3 w-3" /> מפעילה כלי: {m.tool}
                  </p>
                ) : (
                  <div key={i} className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "mr-auto bg-[rgba(46,230,166,0.18)]"
                      : "ml-auto border border-[var(--cc-line)] bg-[rgba(14,20,40,0.8)]"
                  }`}>
                    <div className="prose prose-invert prose-sm max-w-none [&_p]:my-1">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content ?? ""}</ReactMarkdown>
                    </div>
                  </div>
                ))}
                {streamingText && (
                  <div className="ml-auto max-w-[85%] rounded-lg border border-[var(--cc-line)] bg-[rgba(14,20,40,0.8)] px-3 py-2 text-sm">
                    <div className="prose prose-invert prose-sm max-w-none [&_p]:my-1">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingText}</ReactMarkdown>
                    </div>
                  </div>
                )}
                {isStreaming && !streamingText && (
                  <p className="flex items-center gap-2 text-xs text-[var(--cc-text-dim)]">
                    <Loader2 className="h-3 w-3 animate-spin" /> כרמן חושבת…
                  </p>
                )}
              </div>
            )}
          </>
        )}

        <div className="flex items-center gap-2 p-2.5">
          <button
            onClick={startVoice}
            title={isConvMode ? "סיימי את השיחה הקולית" : "התחילי שיחה קולית רציפה"}
            className={`cc-mic flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-all ${
              isConvMode
                ? "border-[var(--cc-crit)] bg-[rgba(248,113,113,0.15)] text-[var(--cc-crit)]"
                : "border-[var(--cc-line-strong)] text-[var(--cc-accent)] hover:bg-[rgba(46,230,166,0.15)]"
            }`}
          >
            {isTranscribing ? <Loader2 className="h-5 w-5 animate-spin" /> : isConvMode ? <Square className="h-4 w-4" /> : <Mic className="h-5 w-5" />}
          </button>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") sendText(input); }}
            placeholder={
              isConvMode
                ? isRealtime
                  ? "שיחה חיה פעילה — דברי חופשי, אפשר גם לקטוע אותי באמצע…"
                  : isRecording ? "שיחה פעילה — דברי חופשי, אני מקשיבה…" : "שיחה פעילה — כרמן עונה…"
                : "דברי עם כרמן — כתבי, או לחצי על המיקרופון לשיחה רציפה"
            }
            disabled={isStreaming}
            className="h-10 min-w-0 flex-1 rounded-lg border border-[var(--cc-line)] bg-[rgba(5,11,9,0.6)] px-3 text-sm outline-none placeholder:text-[var(--cc-text-dim)] focus:border-[var(--cc-line-strong)] disabled:opacity-50"
          />
          <button
            onClick={() => { if (playingRef.current) stopSpeech(); else setVoiceOn(v => !v); }}
            title={playingRef.current ? "השתקה" : voiceOn ? "קול פעיל — כבי הקראה" : "קול כבוי — הפעילי הקראה"}
            className={`shrink-0 ${voiceOn ? "text-[var(--cc-accent)]" : "text-[var(--cc-text-dim)]"}`}
          >
            {voiceOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </button>
          <button
            onClick={() => sendText(input)}
            disabled={!input.trim() || isStreaming}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--cc-accent-dim)] text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            title="שליחה"
          >
            {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    );
  }
);
