import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Headphones, Loader2, Mic, MicOff, Paperclip, Play, Send, Square, Volume2, VolumeX, AudioLines, X, File as FileIcon, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import type { CarmenFaceState } from "./CarmenFace";
import { startRealtimeVoice, RealtimeHandle } from "./realtimeVoice";
import { ChatMessageRow } from "./ChatMessageRow";
import { ChatTopicRail } from "./ChatTopicRail";
import { ThinkingGalaxy } from "./ThinkingGalaxy";
import type { BrainChannel } from "./useBrainChannel";
import { AGENT_SPRITES, filterMessagesForRoute, seatKeyFromRoute } from "@/lib/agentSeats";
import { hudStage, routeForRestoredChat } from "@/lib/agentChannelRouting";
import { composerLockedForChat, lastConversationStorageKey, streamAppliesToActive, topicIsLive, type TopicChat } from "@/lib/chatTopics";
import type { ConversationChannelStatus, HudStage } from "@/lib/agentChannelRouting";
import {
  CarmenInputMode,
  onRealtimeUnavailable,
  shouldLogRealtimeTranscript,
  shouldResumeLegacyListen,
  shouldSpeakWithLegacyTts,
  tagChatTurn,
  volumeControlsLiveSession,
} from "./carmenCommandInput";
import {
  loadMicCaptureMode,
  logTranscribeOnlyEvent,
  MIC_CAPTURE_MODE_LABELS,
  saveMicCaptureMode,
  transcribeAudioBlob,
  type MicCaptureMode,
} from "@/lib/carmenTranscribeOnly";
import type { SystemFixContextMetadata } from "@/lib/systemFixContext";
import { systemFixPromptAddon } from "@/lib/systemFixContext";
import {
  COMMAND_CENTER_FILE_ACCEPT,
  COMMAND_CENTER_MAX_FILES,
  formatAttachmentsForPrompt,
  uploadCommandCenterAttachments,
  type CommandCenterAttachment,
} from "@/lib/commandCenterAttachments";

interface ChatMessage {
  id?: string;
  role: "user" | "assistant" | "tool_call";
  content?: string;
  attachments?: CommandCenterAttachment[];
  tool?: string;
  speaker?: string;
  channel?: string;
  input_mode?: CarmenInputMode;
  delivery_mode?: "text" | "realtime";
}

export interface CarmenChatBarHandle {
  /** Put text in the input (e.g. quick commands) and focus it */
  prefill: (text: string) => void;
  /** Send a message programmatically */
  send: (text: string) => void;
  /** Start voice capture */
  startVoice: () => void;
  toggleHistory: () => void;
}

interface CarmenChatBarProps {
  tenantId: string | null;
  brain: BrainChannel;
  onConversationIdChange?: (id: string | null) => void;
  onFaceState: (state: CarmenFaceState) => void;
  audioLevelRef: React.MutableRefObject<number>;
  historyOpen?: boolean;
  onHistoryOpenChange?: (open: boolean) => void;
  onHudModeChange?: (mode: HudStage) => void;
  /** sidecar = system-fix panel with screen context (text + attachments + transcribe) */
  mode?: "default" | "sidecar";
  contextMetadata?: SystemFixContextMetadata | null;
  sidecarPlaceholder?: string;
}

const CARMEN_VOICES = [
  { id: "marin", label: "Marin — טבעי וחם" },
  { id: "cedar", label: "Cedar — עמוק ובטוח" },
  { id: "coral", label: "Coral — בהיר וידידותי" },
  { id: "sage", label: "Sage — רגוע ומאוזן" },
  { id: "shimmer", label: "Shimmer — רך ונעים" },
  { id: "alloy", label: "Alloy — ניטרלי ומדויק" },
  { id: "ash", label: "Ash — יציב וישיר" },
  { id: "ballad", label: "Ballad — עשיר והבעתי" },
  { id: "echo", label: "Echo — חד ואנרגטי" },
  { id: "verse", label: "Verse — דינמי ושיחתי" },
] as const;

type CarmenVoice = typeof CARMEN_VOICES[number]["id"];
const VOICE_STORAGE_KEY = "aios:carmen-voice";

/**
 * The "talk to Carmen" bar: typed text stays text; the mic opens OpenAI Realtime.
 * Command Center never auto-plays carmen-speak and never falls back to transcribe-voice.
 */
export const CarmenChatBar = forwardRef<CarmenChatBarHandle, CarmenChatBarProps>(
  function CarmenChatBar({
    tenantId,
    brain,
    onConversationIdChange,
    onFaceState,
    audioLevelRef,
    historyOpen,
    onHistoryOpenChange,
    onHudModeChange,
    mode = "default",
    contextMetadata = null,
    sidecarPlaceholder,
  }, ref) {
    const isSidecar = mode === "sidecar";
    useEffect(() => {
      if (!isSidecar) return;
      setMicCaptureMode("transcribe_only");
    }, [isSidecar]);
    const [input, setInput] = useState("");
    const [attachments, setAttachments] = useState<CommandCenterAttachment[]>([]);
    const [uploadingAttachments, setUploadingAttachments] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [streamingText, setStreamingText] = useState("");
    const [isStreaming, setIsStreaming] = useState(false);
    const [liveStreamIds, setLiveStreamIds] = useState<string[]>([]);
    const liveStreamIdsRef = useRef<string[]>([]);
    liveStreamIdsRef.current = liveStreamIds;
    const streamBufRef = useRef<Record<string, string>>({});
    const [inputMode, setInputMode] = useState<CarmenInputMode>("typed");
    const [micCaptureMode, setMicCaptureMode] = useState<MicCaptureMode>(() => loadMicCaptureMode());
    const [isTranscribeRecording, setIsTranscribeRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [isConvMode, setIsConvMode] = useState(false);
    const [isRealtime, setIsRealtime] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isOutputMuted, setIsOutputMuted] = useState(false);
    const [isPreviewingVoice, setIsPreviewingVoice] = useState(false);
    const [selectedVoice, setSelectedVoice] = useState<CarmenVoice>(() => {
      const saved = localStorage.getItem(VOICE_STORAGE_KEY);
      return CARMEN_VOICES.some(voice => voice.id === saved) ? saved as CarmenVoice : "marin";
    });
    const [showHistory, setShowHistory] = useState(false);
    const historyVisible = historyOpen ?? showHistory;
    const setHistory = (open: boolean) => {
      setShowHistory(open);
      onHistoryOpenChange?.(open);
    };
    const muteRef = useRef(false);
    const outputMutedRef = useRef(false);
    const conversationIdRef = useRef<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const playingRef = useRef<HTMLAudioElement | null>(null);
    // Sentence-streaming TTS: queue of segments + generation counter for cancellation
    const ttsQueueRef = useRef<string[]>([]);
    const ttsPumpingRef = useRef(false);
    const ttsGenRef = useRef(0);
    // Continuous conversation mode (VAD): refs so async loops see fresh state
    const convModeRef = useRef(false);
    const inputModeRef = useRef<CarmenInputMode>("typed");
    const micStreamRef = useRef<MediaStream | null>(null);
    const transcribeRecorderRef = useRef<MediaRecorder | null>(null);
    const transcribeChunksRef = useRef<Blob[]>([]);
    // OpenAI Realtime session — the only Command Center voice path
    const realtimeRef = useRef<RealtimeHandle | null>(null);
    const { toast } = useToast();
    const { userId } = useCurrentUser();
    const queryClient = useQueryClient();
    const [conversationId, setConversationId] = useState<string | null>(null);
    const hud = hudStage({
      routeType: brain.selected.route_type,
      debating: brain.status === "debating",
    });
    useEffect(() => { onHudModeChange?.(hud); }, [hud, onHudModeChange]);

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
          body: JSON.stringify({ text, voice: selectedVoice }),
        });
        return res.ok ? await res.blob() : null;
      } catch { return null; }
    }, [selectedVoice]);

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
            // Live speech is Realtime — never reopen the old transcribe loop.
            if (!shouldResumeLegacyListen({ inputMode: inputModeRef.current, realtimeActive: !!realtimeRef.current })) {
              onFaceState("idle");
            }
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

    const rememberConv = (id: string | null | undefined) => {
      if (!id) return;
      conversationIdRef.current = id;
      setConversationId(id);
      onConversationIdChange?.(id);
      if (tenantId) localStorage.setItem(lastConversationStorageKey(tenantId), id);
    };

    const streamInternal = useCallback(async (
      trimmed: string,
      history: Array<{ role: string; content: string }>,
      boundConvId: string,
      ctxMeta: SystemFixContextMetadata | null,
    ) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("לא מחוברת");
      const promptAddon = ctxMeta ? systemFixPromptAddon(ctxMeta) : undefined;
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/run-ai-agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          command_text: trimmed,
          tenant_id: tenantId,
          surface: "internal_chat",
          stream: true,
          conversation_id: boundConvId || conversationIdRef.current,
          conversation_history: history,
          system_prompt_addon: promptAddon || undefined,
          context_metadata: ctxMeta ?? undefined,
        }),
      });
      if (!res.ok) throw new Error(res.status === 429 ? "חריגה ממגבלת הקצב — נסי שוב עוד רגע" : "שגיאה בתקשורת עם כרמן");

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let answer = "";
      let gotDone = false;
      let speechBuf = "";
      let firstSegmentSent = false;
      let boundId = boundConvId;

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
              if (boundId) streamBufRef.current[boundId] = (streamBufRef.current[boundId] || "") + parsed.content;
              if (streamAppliesToActive(boundId, conversationIdRef.current)) {
                setStreamingText(boundId ? streamBufRef.current[boundId] : answer);
                scrollDown();
              }
              if (shouldSpeakWithLegacyTts(inputModeRef.current) && streamAppliesToActive(boundId, conversationIdRef.current)) {
                speechBuf += parsed.content;
                let cut = extractSentence(speechBuf, firstSegmentSent ? 90 : 25);
                while (cut) {
                  enqueueSpeech(cut[0]);
                  speechBuf = cut[1];
                  firstSegmentSent = true;
                  cut = extractSentence(speechBuf, 90);
                }
              }
            } else if (parsed.type === "tool_call") {
              if (streamAppliesToActive(boundId, conversationIdRef.current)) {
                setMessages(prev => [...prev, { role: "tool_call", tool: parsed.tool }]);
                scrollDown();
              }
            } else if (parsed.type === "conversation_id" && parsed.id) {
              boundId = parsed.id;
              if (streamAppliesToActive(boundConvId, conversationIdRef.current) || !conversationIdRef.current) {
                rememberConv(parsed.id);
              }
            } else if (parsed.type === "done") {
              gotDone = true;
            }
          } catch { /* partial line */ }
        }
      }

      if (shouldSpeakWithLegacyTts(inputModeRef.current) && speechBuf.trim()) enqueueSpeech(speechBuf);
      const finalText = answer || (gotDone ? "" : "⚠️ החיבור נותק באמצע — נסי שוב.");
      if (finalText) {
        if (streamAppliesToActive(boundId, conversationIdRef.current)) {
          setMessages(prev => [...prev, { role: "assistant", content: finalText, speaker: "carmen", channel: "internal", ...tagChatTurn("typed") }]);
          setStreamingText("");
        }
        if (boundId) {
          brain.persistAssistant(boundId, finalText, crypto.randomUUID());
          delete streamBufRef.current[boundId];
        }
      } else if (streamAppliesToActive(boundId, conversationIdRef.current)) {
        setStreamingText("");
      }
      if (streamAppliesToActive(boundId, conversationIdRef.current)) scrollDown();
      return finalText;
    }, [tenantId, enqueueSpeech, brain]);

    const sendText = useCallback(async (text: string, opts?: { inputMode?: CarmenInputMode; attachments?: CommandCenterAttachment[] }) => {
      const trimmed = text.trim();
      const pendingAttachments = opts?.attachments ?? attachments;
      if ((!trimmed && pendingAttachments.length === 0) || !tenantId) return;
      const activeId = conversationIdRef.current;
      if (composerLockedForChat({ conversationId: activeId, liveStreamIds, status: brain.status })) {
        toast({ title: "השיחה נעולה", description: "ממתינים לתשובת הערוץ או לסיום הפרלמנט.", variant: "destructive" });
        return;
      }
      stopSpeech();
      const mode: CarmenInputMode = opts?.inputMode ?? (convModeRef.current ? inputModeRef.current : "typed");
      const turn = tagChatTurn(mode);
      setInputMode(mode);
      inputModeRef.current = mode;
      if (mode === "transcribe_only") {
        logTranscribeOnlyEvent("send_text", { chars: trimmed.length });
      }
      const sendRoute = brain.selected;
      const displayText = trimmed || (pendingAttachments.length ? "📎 קבצים מצורפים" : "");
      const agentText = pendingAttachments.length
        ? formatAttachmentsForPrompt(pendingAttachments, trimmed)
        : trimmed;
      setMessages(prev => [...prev, {
        role: "user",
        content: displayText,
        attachments: pendingAttachments.length ? pendingAttachments : undefined,
        speaker: "user",
        channel: sendRoute.slug,
        ...turn,
      }]);
      setInput("");
      setAttachments([]);
      setIsStreaming(true);
      setStreamingText("");
      scrollDown();

      let boundId = activeId;
      try {
        const history = messages
          .filter(m => m.role === "user" || m.role === "assistant")
          .map(m => ({ role: m.role, content: m.content ?? "" }));
        const route = sendRoute;
        const ctxMeta = isSidecar ? contextMetadata : null;
        const routed = await brain.send({
          content: trimmed || displayText,
          conversationId: conversationIdRef.current,
          inputMode: mode,
          history,
          idempotencyKey: crypto.randomUUID(),
          route,
          contextMetadata: ctxMeta,
          attachments: pendingAttachments.length ? pendingAttachments : undefined,
        });
        rememberConv(routed.conversation_id);
        boundId = routed.conversation_id || conversationIdRef.current;
        if (boundId) setLiveStreamIds((prev) => (prev.includes(boundId!) ? prev : [...prev, boundId!]));
        if (routed.stream) {
          await streamInternal(agentText, history, boundId || "", ctxMeta);
          if (mode === "transcribe_only") logTranscribeOnlyEvent("text_response", { stream: true });
        } else if (streamAppliesToActive(boundId, conversationIdRef.current)) {
          setMessages(prev => [...prev, {
            role: "tool_call",
            tool: routed.accepted_message,
            channel: routed.kind,
            ...tagChatTurn("external_channel_callback"),
          }]);
          scrollDown();
        }
      } catch (err: any) {
        toast({ title: "שגיאה", description: err.message ?? "שגיאה בשליחה", variant: "destructive" });
      } finally {
        setIsStreaming(false);
        if (boundId) setLiveStreamIds((prev) => prev.filter((id) => id !== boundId));
        queryClient.invalidateQueries({ queryKey: ["cc-conversations", tenantId] });
      }
    }, [tenantId, messages, attachments, stopSpeech, toast, brain, streamInternal, queryClient, liveStreamIds, isSidecar, contextMetadata]);

    const handleAttachmentPick = useCallback(async (files: FileList | null) => {
      if (!files?.length || !userId) {
        if (!userId) toast({ title: "לא מחובר", description: "רענן את הדף ונסה שוב.", variant: "destructive" });
        return;
      }
      if (attachments.length >= COMMAND_CENTER_MAX_FILES) {
        toast({ title: "מגבלה", description: `עד ${COMMAND_CENTER_MAX_FILES} קבצים בהודעה.`, variant: "destructive" });
        return;
      }
      setUploadingAttachments(true);
      try {
        const uploaded = await uploadCommandCenterAttachments(files, userId);
        setAttachments((prev) => [...prev, ...uploaded].slice(0, COMMAND_CENTER_MAX_FILES));
      } catch (err: unknown) {
        toast({
          title: "שגיאה בהעלאה",
          description: err instanceof Error ? err.message : "לא הצלחנו להעלות את הקובץ",
          variant: "destructive",
        });
      } finally {
        setUploadingAttachments(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    }, [attachments.length, toast, userId]);

    const removePendingAttachment = useCallback((idx: number) => {
      setAttachments((prev) => prev.filter((_, i) => i !== idx));
    }, []);

    const endConversation = useCallback(() => {
      convModeRef.current = false;
      setIsConvMode(false);
      setInputMode("typed");
      inputModeRef.current = "typed";
      realtimeRef.current?.stop();
      realtimeRef.current = null;
      setIsRealtime(false);
      micStreamRef.current?.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
      if (transcribeRecorderRef.current?.state === "recording") {
        transcribeRecorderRef.current.stop();
      }
      transcribeRecorderRef.current = null;
      transcribeChunksRef.current = [];
      setIsTranscribeRecording(false);
      setIsTranscribing(false);
      muteRef.current = false;
      setIsMuted(false);
      stopSpeech();
    }, [stopSpeech]);

    /**
     * Carmen's full brain, exposed to the realtime model as the ask_carmen tool.
     * Streams (SSE) so long tool runs keep the connection alive — a non-streaming
     * call hits the edge gateway's ~150s cutoff and kills the live conversation.
     */
    const askCarmenBrain = useCallback(async (question: string): Promise<string> => {
      if (!question.trim() || !tenantId) return "לא התקבלה שאלה.";
      setMessages(prev => [...prev, { role: "tool_call", tool: `מוח: ${brain.selected.label} · ${question.slice(0, 60)}` }]);
      try {
        const history = messages
          .filter(m => m.role === "user" || m.role === "assistant")
          .map(m => ({ role: m.role, content: m.content ?? "" }))
          .slice(-24);
        const routed = await brain.send({
          content: question,
          conversationId: conversationIdRef.current,
          inputMode: "realtime_voice",
          history,
          idempotencyKey: crypto.randomUUID(),
        });
        rememberConv(routed.conversation_id);
        if (!routed.stream) {
          return routed.accepted_message || "נשלח לערוץ. התשובה תופיע בשיחה כשתחזור.";
        }
      } catch (e: any) {
        if (brain.sendPath !== "internal_stream") {
          return `לא הצלחתי לשלוח לערוץ: ${e?.message ?? e}`;
        }
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 180000);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return "שגיאת התחברות למערכת.";
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/run-ai-agent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({
            command_text: question,
            tenant_id: tenantId,
            surface: "internal_chat",
            stream: true,
            conversation_id: conversationIdRef.current,
            conversation_history: messages
              .filter(m => m.role === "user" || m.role === "assistant")
              .map(m => ({ role: m.role, content: m.content ?? "" }))
              .slice(-24),
          }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) return "לא הצלחתי לגשת למערכת כרגע.";
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let answer = "";
        let streamError: string | null = null;
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
              if (parsed.type === "token") answer += parsed.content;
              else if (parsed.type === "conversation_id" && parsed.id) conversationIdRef.current = parsed.id;
              // the wrapper returns 200 and reports failures inside the stream
              else if (parsed.type === "error") streamError = String(parsed.message ?? parsed.error ?? "שגיאה במערכת");
              else if (parsed.type === "done" && parsed.success === false && !streamError) streamError = "הפעולה נכשלה";
            } catch { /* partial line */ }
          }
        }
        if (streamError) {
          return answer.trim()
            ? `${answer.trim()}\n(שים לב: הפעולה נקטעה בשגיאה: ${streamError.slice(0, 200)})`
            : `נתקלתי בשגיאה במערכת: ${streamError.slice(0, 200)}`;
        }
        const brainAnswer = answer.trim() || "לא נמצאה תשובה.";
        // Realtime may verbally summarize a tool result instead of rendering
        // it. Pulse reports are operational tables, so put the brain's exact
        // answer in the transcript as soon as it returns.
        if (/\bדופק\b|\bpulse\s*check\b/i.test(question) && answer.trim()) {
          setMessages(prev => [...prev, { role: "assistant", content: answer.trim() }]);
          setStreamingText("");
          scrollDown();
        }
        return brainAnswer;
      } catch (e) {
        return e instanceof DOMException && e.name === "AbortError"
          ? "הפעולה לקחה יותר מדי זמן — נסי לפרק אותה לשאלות קטנות יותר."
          : "שגיאה בגישה למערכת.";
      } finally {
        clearTimeout(timeout);
      }
    }, [tenantId, messages, brain]);

    /** Ship realtime failures to error_logs so they can be diagnosed server-side. */
    const reportRealtimeError = useCallback(async (message: string) => {
      console.error("[realtime]", message);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/report-error`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ source: "command-center-realtime", error_message: message.slice(0, 500), url: window.location.pathname }),
        });
      } catch { /* diagnostics are best-effort */ }
    }, []);

    /** Try to open an OpenAI Realtime session. Returns false on failure — caller must NOT fall back to transcribe-voice. */
    const beginRealtime = useCallback(async (voice: CarmenVoice = selectedVoice): Promise<boolean> => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { reportRealtimeError("no auth session"); return false; }
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/carmen-realtime-session`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ voice }),
        });
        if (!res.ok) {
          reportRealtimeError(`session mint failed: HTTP ${res.status} ${(await res.text().catch(() => "")).slice(0, 200)}`);
          return false;
        }
        const { client_secret, model } = await res.json();
        if (!client_secret) { reportRealtimeError("no client_secret in mint response"); return false; }

        const handle = await startRealtimeVoice(client_secret, model, {
          onUserTranscript: (text) => {
            if (!shouldLogRealtimeTranscript()) return;
            setMessages(prev => [...prev, { role: "user", content: text, ...tagChatTurn("realtime_voice") }]);
            scrollDown();
          },
          onAssistantDelta: (delta) => {
            if (!shouldLogRealtimeTranscript()) return;
            setStreamingText(prev => prev + delta);
            scrollDown();
          },
          onAssistantDone: (text) => {
            if (!shouldLogRealtimeTranscript()) return;
            setStreamingText("");
            setMessages(prev => [...prev, { role: "assistant", content: text, ...tagChatTurn("realtime_voice") }]);
            scrollDown();
          },
          onToolCall: askCarmenBrain,
          onStateChange: (state) => { if (convModeRef.current) onFaceState(state); },
          onError: (msg) => reportRealtimeError(msg),
          audioLevelRef,
        });
        handle.setOutputMuted(outputMutedRef.current);
        realtimeRef.current = handle;
        setIsRealtime(true);
        onFaceState("listening");
        return true;
      } catch (e) {
        reportRealtimeError(e instanceof Error ? e.message : String(e));
        return false;
      }
    }, [askCarmenBrain, audioLevelRef, onFaceState, reportRealtimeError, selectedVoice]);

    /**
     * Mic button: OpenAI Realtime only. A failed session shows an error —
     * it does not fall back to transcribe-voice.
     */
    const startVoice = useCallback(async () => {
      if (convModeRef.current) { endConversation(); onFaceState("idle"); return; }
      stopSpeech();
      convModeRef.current = true;
      setIsConvMode(true);
      setInputMode("realtime_voice");
      inputModeRef.current = "realtime_voice";
      const realtimeOk = await beginRealtime();
      if (!realtimeOk && convModeRef.current) {
        const fail = onRealtimeUnavailable();
        toast({ title: fail.title, description: fail.description, variant: "destructive" });
        endConversation();
        onFaceState("idle");
      }
    }, [beginRealtime, endConversation, onFaceState, stopSpeech, toast]);

    const stopTranscribeRecording = useCallback(() => {
      if (transcribeRecorderRef.current?.state === "recording") {
        transcribeRecorderRef.current.stop();
      }
    }, []);

    const startTranscribeRecording = useCallback(async () => {
      if (isTranscribeRecording || isTranscribing || isConvMode) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStreamRef.current = stream;
        const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
        const recorder = new MediaRecorder(stream, { mimeType });
        transcribeRecorderRef.current = recorder;
        transcribeChunksRef.current = [];
        logTranscribeOnlyEvent("record_start");

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) transcribeChunksRef.current.push(e.data);
        };

        recorder.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop());
          micStreamRef.current = null;
          transcribeRecorderRef.current = null;
          setIsTranscribeRecording(false);
          logTranscribeOnlyEvent("record_stop");

          const audioBlob = new Blob(transcribeChunksRef.current, { type: mimeType });
          transcribeChunksRef.current = [];
          if (audioBlob.size < 1000) return;

          setIsTranscribing(true);
          onFaceState("listening");
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("לא מחוברת");
            const text = await transcribeAudioBlob(audioBlob, session.access_token, {
              inputMode: "transcribe_only",
              filename: "voice.webm",
            });
            if (!text) throw new Error("תמלול ריק");
            logTranscribeOnlyEvent("transcribe_ok", { chars: text.length });
            await sendText(text, { inputMode: "transcribe_only" });
          } catch (err: unknown) {
            logTranscribeOnlyEvent("transcribe_fail", {
              error: err instanceof Error ? err.message : String(err),
            });
            toast({
              title: "שגיאה בתמלול",
              description: "לא הצלחנו לתמלל את ההקלטה. נסי שוב או כתבי במקלדת.",
              variant: "destructive",
            });
          } finally {
            setIsTranscribing(false);
            onFaceState("idle");
          }
        };

        recorder.start();
        setIsTranscribeRecording(true);
        onFaceState("listening");
      } catch {
        toast({
          title: "אין גישה למיקרופון",
          description: "יש לאפשר גישה למיקרופון בדפדפן",
          variant: "destructive",
        });
      }
    }, [isConvMode, isTranscribeRecording, isTranscribing, onFaceState, sendText, toast]);

    const handleMicClick = useCallback(() => {
      if (micCaptureMode === "transcribe_only") {
        if (isTranscribeRecording) stopTranscribeRecording();
        else startTranscribeRecording();
        return;
      }
      void startVoice();
    }, [isTranscribeRecording, micCaptureMode, startTranscribeRecording, startVoice, stopTranscribeRecording]);

    const selectMicCaptureMode = useCallback((mode: MicCaptureMode) => {
      if (mode === micCaptureMode) return;
      if (isConvMode) endConversation();
      if (isTranscribeRecording) stopTranscribeRecording();
      setMicCaptureMode(mode);
      saveMicCaptureMode(mode);
    }, [endConversation, isConvMode, isTranscribeRecording, micCaptureMode, stopTranscribeRecording]);

    /* ---------- Conversation persistence + Carmen's memory ---------- */

    // Save the thread to ai_conversations after every completed exchange, so
    // it survives refreshes and appears in the history drawer.
    const persistConversation = useCallback(async (msgs: ChatMessage[]) => {
      const textMsgs = msgs.filter(m => m.role !== "tool_call").map(m => ({
        role: m.role,
        content: m.content ?? "",
        input_mode: m.input_mode ?? "typed",
        delivery_mode: m.delivery_mode ?? "text",
      }));
      if (textMsgs.length < 2 || !tenantId) return;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const sbAny = supabase as any;
        if (!conversationIdRef.current) {
          const { data } = await sbAny.from("ai_conversations")
            .insert({ user_id: user.id, tenant_id: tenantId, title: (textMsgs[0].content || "שיחה").slice(0, 60), messages: textMsgs })
            .select("id").single();
          conversationIdRef.current = data?.id ?? null;
          if (data?.id) setConversationId(data.id);
        } else {
          await sbAny.from("ai_conversations")
            .update({ messages: textMsgs, updated_at: new Date().toISOString() })
            .eq("id", conversationIdRef.current);
        }
      } catch { /* persistence is best-effort */ }
    }, [tenantId]);

    const persistRef = useRef(persistConversation);
    persistRef.current = persistConversation;
    useEffect(() => {
      const last = messages[messages.length - 1];
      if (last?.role === "assistant") persistRef.current(messages);
    }, [messages]);

    useEffect(() => {
      if (!conversationId) return;
      const channel = (supabase as any)
        .channel(`cc-channel-${conversationId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "ai_conversation_messages", filter: `conversation_id=eq.${conversationId}` },
          (payload: { new: any }) => {
            const row = payload.new;
            if (!row?.content) return;
            if (row.role === "user") return;
            setMessages((prev) => {
              if (row.id && prev.some((m) => m.id === row.id)) return prev;
              if (row.role === "assistant" && prev.some((m) => m.role === "assistant" && m.content === row.content)) return prev;
              return [...prev, {
                id: row.id,
                role: row.role === "assistant" ? "assistant" : row.event_type === "progress" ? "tool_call" : "assistant",
                content: row.content,
                tool: row.event_type === "progress" || row.event_type === "system" ? row.content : undefined,
                speaker: row.speaker,
                channel: row.channel,
                ...tagChatTurn(row.channel && row.channel !== "internal" ? "external_channel_callback" : "typed"),
              }];
            });
            if (row.role === "assistant" && row.channel && row.channel !== "internal") {
              realtimeRef.current?.speakText(row.content);
              scrollDown();
            }
          },
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "ai_conversations", filter: `id=eq.${conversationId}` },
          (payload: { new: any }) => {
            if (payload.new?.status) brain.setStatus(payload.new.status);
          },
        )
        .subscribe();
      return () => { (supabase as any).removeChannel(channel); };
    }, [conversationId, brain]);

    /** Send a finished conversation to Carmen's memory (importance-graded extraction). */
    const learnFromConversation = useCallback(async () => {
      const convId = conversationIdRef.current;
      const meaningful = messages.filter(m => m.role !== "tool_call").length >= 4;
      if (!convId || !meaningful) return;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/carmen-learn-from-session`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ ai_conversation_id: convId }),
          keepalive: true,
        }).catch(() => {});
      } catch { /* learning is best-effort */ }
    }, [messages]);

    const startNewConversation = useCallback(() => {
      learnFromConversation();
      conversationIdRef.current = null;
      setConversationId(null);
      onConversationIdChange?.(null);
      setMessages([]);
      setStreamingText("");
      setHistory(false);
      brain.setStatus("idle");
      if (tenantId) localStorage.removeItem(lastConversationStorageKey(tenantId));
    }, [learnFromConversation, tenantId, brain]);

    const loadConversation = useCallback(async (conv: TopicChat) => {
      learnFromConversation();
      rememberConv(conv.id);
      const nextRoute = routeForRestoredChat(brain.routes, conv);
      brain.selectRoute(nextRoute, conv.id);
      brain.setStatus((topicIsLive(conv.status) ? conv.status : "idle") as ConversationChannelStatus);
      setStreamingText(streamBufRef.current[conv.id] || "");
      setIsStreaming(liveStreamIdsRef.current.includes(conv.id));
      let msgs: Array<{ id?: string; role: string; content?: string; speaker?: string; channel?: string }> = [];
      try {
        const { data } = await (supabase as any)
          .from("ai_conversation_messages")
          .select("id, role, content, speaker, channel, metadata, created_at")
          .eq("conversation_id", conv.id)
          .order("created_at", { ascending: true });
        if (Array.isArray(data) && data.length) msgs = data;
      } catch { /* empty until messages arrive */ }
      if (conversationIdRef.current !== conv.id) return;
      setMessages(msgs
        .filter(m => m.role === "user" || m.role === "assistant" || m.role === "system")
        .map(m => ({
          id: (m as any).id,
          role: (m.role === "system" ? "assistant" : m.role) as "user" | "assistant",
          content: m.content ?? "",
          speaker: m.speaker,
          channel: m.channel,
          attachments: Array.isArray((m as any).metadata?.attachments)
            ? (m as any).metadata.attachments
            : undefined,
        })));
      setHistory(false);
      scrollDown();
    }, [learnFromConversation, brain]);

    const { data: pastConversations } = useQuery({
      queryKey: ["cc-conversations", tenantId],
      enabled: !!tenantId,
      queryFn: async () => {
        const { data } = await (supabase as any)
          .from("ai_conversations")
          .select("id, title, updated_at, status, routing_mode, brain_route_id")
          .order("updated_at", { ascending: false })
          .limit(40);
        return (data ?? []) as TopicChat[];
      },
    });

    const restoredRef = useRef(false);
    useEffect(() => {
      if (!tenantId || restoredRef.current || conversationIdRef.current) return;
      const last = localStorage.getItem(lastConversationStorageKey(tenantId));
      const hit = pastConversations?.find((c) => c.id === last);
      if (hit) {
        restoredRef.current = true;
        loadConversation(hit);
      } else if (pastConversations) {
        restoredRef.current = true;
      }
    }, [tenantId, pastConversations, loadConversation]);

    /* ---------- Mute (keep the conversation, stop listening) ---------- */

    const toggleMute = useCallback(() => {
      if (!volumeControlsLiveSession(inputModeRef.current) && !realtimeRef.current) return;
      const next = !muteRef.current;
      muteRef.current = next;
      setIsMuted(next);
      realtimeRef.current?.setMicMuted(next);
    }, []);

    const toggleOutputMute = useCallback(() => {
      if (!volumeControlsLiveSession(inputModeRef.current) && !realtimeRef.current) return;
      const next = !outputMutedRef.current;
      outputMutedRef.current = next;
      setIsOutputMuted(next);
      realtimeRef.current?.setOutputMuted(next);
      if (next) stopSpeech();
    }, [stopSpeech]);

    const selectVoice = useCallback(async (voice: CarmenVoice) => {
      setSelectedVoice(voice);
      localStorage.setItem(VOICE_STORAGE_KEY, voice);
      if (!convModeRef.current || !realtimeRef.current) return;

      realtimeRef.current.stop();
      realtimeRef.current = null;
      setIsRealtime(false);
      onFaceState("idle");
      const restarted = await beginRealtime(voice);
      if (!restarted && convModeRef.current) {
        const fail = onRealtimeUnavailable();
        toast({ title: fail.title, description: fail.description, variant: "destructive" });
        endConversation();
        onFaceState("idle");
      }
    }, [beginRealtime, endConversation, onFaceState, toast]);

    const previewVoice = useCallback(async () => {
      if (isPreviewingVoice) return;
      setIsPreviewingVoice(true);
      stopSpeech();
      try {
        const blob = await fetchTts("היי, אני כרמן. זה הקול שבחרת עבורי.");
        if (blob) {
          const gen = ttsGenRef.current;
          await playBlob(blob, gen);
        }
      } finally {
        setIsPreviewingVoice(false);
      }
    }, [fetchTts, isPreviewingVoice, playBlob, stopSpeech]);

    // Release the mic and stop audio when the page unmounts
    useEffect(() => () => endConversation(), [endConversation]);

    useImperativeHandle(ref, () => ({
      prefill: (text: string) => { setInput(text); inputRef.current?.focus(); },
      send: sendText,
      startVoice,
      toggleHistory: () => setHistory(!historyVisible),
    }), [sendText, startVoice, historyVisible]);

    const visibleMessages = filterMessagesForRoute(messages, brain.selected);
    const streamSeatKey = seatKeyFromRoute(brain.selected);
    const streamSprite = AGENT_SPRITES[streamSeatKey === "shared" ? "carmen" : streamSeatKey];
    const isShared = brain.selected.route_type === "parliament";
    const activeTopic = pastConversations?.find((c) => c.id === conversationId);
    const thisChatBusy = composerLockedForChat({
      conversationId,
      liveStreamIds,
      status: activeTopic?.status ?? (conversationId && liveStreamIds.includes(conversationId) ? "streaming" : brain.status),
    });
    const canSend = !!input.trim() || attachments.length > 0;
    const composerBusy = thisChatBusy || isTranscribeRecording || isTranscribing || isConvMode || uploadingAttachments;

    const composerPlaceholder = isSidecar
      ? (sidecarPlaceholder ?? "תיאור תיקון / בקשה למסך הנוכחי…")
      : isTranscribing
        ? "ממללת…"
        : isTranscribeRecording
          ? "מקליטה לתמלול…"
          : isConvMode
            ? (isRealtime ? "שיחה חיה" : "פותחת…")
            : isShared
              ? "הודעה למרחב המשותף…"
              : "הודעה…";

    return (
      <div className="cc-panel cc-talkbar flex h-full min-h-0 flex-col overflow-hidden">
        <div className="cc-talkbar-shell min-h-0 flex-1">
        {historyVisible && (
          <ChatTopicRail
            className="is-overlay"
            items={pastConversations ?? []}
            activeId={conversationId}
            onSelect={(conv) => { loadConversation(conv); }}
            onNew={startNewConversation}
          />
        )}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div ref={listRef} className="cc-chat-scroll cc-scroll min-h-0 flex-1 space-y-3 p-3">
            {visibleMessages.length === 0 && !streamingText && (
              <p className="py-8 text-center text-sm text-[var(--cc-text-dim)]">
                {isSidecar
                  ? "תיאורי מה לתקן במסך שאתה רואה. כרמן מקבלת את הנתיב וההקשר. 'שלחי לפיתוח' / 'תריצי דרך קרסר' → Cursor."
                  : isShared
                    ? "מרחב משותף — כולם שומעים, ורואים גם תקשורת בין האייג׳נטים."
                    : "שיחה ישירה — רק אתה והאייג׳נט שנבחר."}
              </p>
            )}
            {visibleMessages.map((m, i) => (
              <ChatMessageRow
                key={m.id || i}
                role={m.role as "user" | "assistant" | "tool_call"}
                content={m.content}
                attachments={m.attachments}
                speaker={m.speaker}
                channel={m.channel}
                tool={m.tool}
              />
            ))}
            {streamingText && (
              <div className="cc-msg-row is-agent">
                <span className="cc-msg-avatar" style={{ backgroundImage: `url(${streamSprite})` }} aria-hidden />
                <div className="cc-msg-bubble">
                  <div className="cc-md prose prose-invert prose-sm max-w-none [&_p]:my-1">
                    {streamingText}
                  </div>
                </div>
              </div>
            )}
            {thisChatBusy && !streamingText && (
              <div className="flex justify-center py-2">
                <ThinkingGalaxy />
              </div>
            )}
          </div>
        </div>
        </div>
        {brain.healthBanner && (
          <p className="cc-channel-health" role="status">
            {brain.healthBanner}
          </p>
        )}
        {(attachments.length > 0 || uploadingAttachments) && (
          <div className="cc-attach-preview flex shrink-0 flex-wrap gap-2 border-t border-[var(--cc-line)] px-3 py-2">
            {attachments.map((att, idx) => (
              <div key={`${att.url}-${idx}`} className="inline-flex max-w-full items-center gap-1 rounded-md border border-[var(--cc-line)] bg-[rgba(5,10,22,0.5)] px-2 py-1 text-xs text-[var(--cc-text)]">
                {att.type === "image" ? <ImageIcon className="h-3.5 w-3.5 shrink-0" /> : <FileIcon className="h-3.5 w-3.5 shrink-0" />}
                <span className="max-w-[140px] truncate">{att.name}</span>
                <button type="button" onClick={() => removePendingAttachment(idx)} className="text-[var(--cc-text-dim)] hover:text-[var(--cc-crit)]" title="הסר">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {uploadingAttachments && (
              <span className="inline-flex items-center gap-1 text-xs text-[var(--cc-text-dim)]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                מעלה…
              </span>
            )}
          </div>
        )}
        <div className="cc-talkbar-row relative z-[60] mt-auto flex shrink-0 items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={COMMAND_CENTER_FILE_ACCEPT}
            className="hidden"
            onChange={(e) => { void handleAttachmentPick(e.target.files); }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={composerBusy || attachments.length >= COMMAND_CENTER_MAX_FILES}
            title="צרף קובץ או תמונה"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[var(--cc-line)] text-[var(--cc-text-dim)] transition-colors hover:border-[var(--cc-line-strong)] hover:text-[var(--cc-accent)] disabled:opacity-40"
          >
            {uploadingAttachments ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
          </button>
          {isSidecar ? (
            <button
              onClick={handleMicClick}
              disabled={isTranscribing}
              title={isTranscribeRecording ? "עצור הקלטה" : "מיקרופון לתמלול"}
              className={`cc-mic flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-all ${
                isTranscribeRecording
                  ? "border-[var(--cc-crit)] bg-[rgba(248,113,113,0.15)] text-[var(--cc-crit)]"
                  : isTranscribing
                    ? "border-[var(--cc-line)] opacity-60"
                    : "border-[var(--cc-line-strong)] text-[var(--cc-accent)] hover:bg-[rgba(76,195,255,0.15)]"
              }`}
            >
              {isTranscribing ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : isTranscribeRecording ? (
                <Square className="h-4 w-4" />
              ) : (
                <AudioLines className="h-5 w-5" />
              )}
            </button>
          ) : (
            <>
          <div className="flex h-11 shrink-0 items-center gap-1 rounded-lg border border-[var(--cc-line)] bg-[rgba(5,10,22,0.6)] px-2 sm:hidden">
            <select
              value={micCaptureMode}
              onChange={(e) => selectMicCaptureMode(e.target.value as MicCaptureMode)}
              title="מצב מיקרופון"
              className="max-w-[96px] bg-transparent text-[11px] text-[var(--cc-text)] outline-none"
              disabled={isConvMode || isTranscribeRecording || isTranscribing}
            >
              {(Object.keys(MIC_CAPTURE_MODE_LABELS) as MicCaptureMode[]).map((mode) => (
                <option key={mode} value={mode}>{MIC_CAPTURE_MODE_LABELS[mode]}</option>
              ))}
            </select>
          </div>
          <div className="hidden h-11 shrink-0 items-center gap-1 rounded-lg border border-[var(--cc-line)] bg-[rgba(5,10,22,0.6)] px-2 sm:flex">
            <select
              value={micCaptureMode}
              onChange={(e) => selectMicCaptureMode(e.target.value as MicCaptureMode)}
              title="מצב מיקרופון"
              className="max-w-[120px] bg-transparent text-xs text-[var(--cc-text)] outline-none"
              disabled={isConvMode || isTranscribeRecording || isTranscribing}
            >
              {(Object.keys(MIC_CAPTURE_MODE_LABELS) as MicCaptureMode[]).map((mode) => (
                <option key={mode} value={mode}>{MIC_CAPTURE_MODE_LABELS[mode]}</option>
              ))}
            </select>
          </div>
          <div className="hidden h-11 shrink-0 items-center gap-1 rounded-lg border border-[var(--cc-line)] bg-[rgba(5,10,22,0.6)] px-2 sm:flex">
            <Headphones className="h-4 w-4 text-[var(--cc-accent)]" />
            <select
              value={selectedVoice}
              onChange={e => selectVoice(e.target.value as CarmenVoice)}
              title="קול"
              className="max-w-[130px] bg-transparent text-xs text-[var(--cc-text)] outline-none"
            >
              {CARMEN_VOICES.map(voice => <option key={voice.id} value={voice.id}>{voice.label}</option>)}
            </select>
            <button onClick={previewVoice} disabled={isPreviewingVoice} title="דוגמה" className="text-[var(--cc-text-dim)] hover:text-[var(--cc-accent)] disabled:opacity-50">
              {isPreviewingVoice ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            </button>
          </div>
          <button
            onClick={handleMicClick}
            disabled={isTranscribing}
            title={
              micCaptureMode === "transcribe_only"
                ? (isTranscribeRecording ? "עצור הקלטה" : "מיקרופון לתמלול בלבד")
                : (isConvMode ? "סיים שיחה חיה" : "שיחה חיה")
            }
            className={`cc-mic flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-all ${
              isConvMode || isTranscribeRecording
                ? "border-[var(--cc-crit)] bg-[rgba(248,113,113,0.15)] text-[var(--cc-crit)]"
                : isTranscribing
                  ? "border-[var(--cc-line)] opacity-60"
                  : "border-[var(--cc-line-strong)] text-[var(--cc-accent)] hover:bg-[rgba(76,195,255,0.15)]"
            }`}
          >
            {isTranscribing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : isConvMode || isTranscribeRecording ? (
              <Square className="h-4 w-4" />
            ) : micCaptureMode === "transcribe_only" ? (
              <AudioLines className="h-5 w-5" />
            ) : (
              <Mic className="h-5 w-5" />
            )}
          </button>
          {isConvMode && (
            <>
              <button
                onClick={toggleMute}
                title={isMuted ? "מיקרופון" : "השתק מיקרופון"}
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-all ${
                  isMuted
                    ? "border-[var(--cc-warn)] bg-[rgba(251,191,36,0.15)] text-[var(--cc-warn)]"
                    : "border-[var(--cc-line)] text-[var(--cc-text-dim)] hover:text-[var(--cc-accent)]"
                }`}
              >
                {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
              <button
                onClick={toggleOutputMute}
                title={isOutputMuted ? "השמע" : "השתק כרמן"}
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-all ${
                  isOutputMuted
                    ? "border-[var(--cc-warn)] bg-[rgba(251,191,36,0.15)] text-[var(--cc-warn)]"
                    : "border-[var(--cc-line)] text-[var(--cc-text-dim)] hover:text-[var(--cc-accent)]"
                }`}
              >
                {isOutputMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
            </>
          )}
            </>
          )}
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") sendText(input); }}
            placeholder={composerPlaceholder}
            disabled={isTranscribeRecording || isTranscribing || (!isSidecar && isConvMode)}
            className="h-11 min-w-0 flex-1 rounded-lg border border-[var(--cc-line)] bg-[rgba(5,10,22,0.6)] px-3 text-sm outline-none placeholder:text-[var(--cc-text-dim)] focus:border-[var(--cc-line-strong)]"
          />
          <button
            onClick={() => sendText(input)}
            disabled={!canSend || composerBusy}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[var(--cc-accent-dim)] text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            title="שליחה"
          >
            {thisChatBusy ? <ThinkingGalaxy size="sm" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    );
  }
);
