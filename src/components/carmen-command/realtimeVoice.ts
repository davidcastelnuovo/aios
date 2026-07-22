// WebRTC client for OpenAI Realtime — Carmen's live voice conversation.
// The ephemeral client secret comes from the carmen-realtime-session edge
// function; audio flows browser<->OpenAI directly, events over a data channel.

export interface RealtimeCallbacks {
  /** Final transcript of what the user said (one turn) */
  onUserTranscript: (text: string) => void;
  /** Streaming delta of Carmen's spoken answer */
  onAssistantDelta: (delta: string) => void;
  /** Full text of Carmen's finished answer */
  onAssistantDone: (text: string) => void;
  /** The model delegated a question to Carmen's full brain; return the answer */
  onToolCall: (question: string) => Promise<string>;
  onStateChange: (state: "listening" | "speaking") => void;
  onError: (message: string) => void;
  /** Written every frame with Carmen's output level (drives the face) */
  audioLevelRef: React.MutableRefObject<number>;
}

export interface RealtimeHandle {
  stop: () => void;
}

export async function startRealtimeVoice(
  clientSecret: string,
  model: string,
  cb: RealtimeCallbacks,
): Promise<RealtimeHandle> {
  const pc = new RTCPeerConnection();
  const mic = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  mic.getTracks().forEach((t) => pc.addTrack(t, mic));

  const audioEl = new Audio();
  audioEl.autoplay = true;
  let stopped = false;
  let raf = 0;
  let audioCtx: AudioContext | null = null;

  pc.ontrack = (e) => {
    audioEl.srcObject = e.streams[0];
    // Analyser on Carmen's audio: drives the face + speaking/listening state
    audioCtx = new AudioContext();
    const src = audioCtx.createMediaStreamSource(e.streams[0]);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    src.connect(analyser);
    const buf = new Uint8Array(analyser.frequencyBinCount);
    let speaking = false;
    const tick = () => {
      if (stopped) return;
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
      const rms = Math.sqrt(sum / buf.length);
      cb.audioLevelRef.current = Math.min(1, rms * 4);
      const nowSpeaking = rms > 0.015;
      if (nowSpeaking !== speaking) {
        speaking = nowSpeaking;
        cb.onStateChange(speaking ? "speaking" : "listening");
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
  };

  const dc = pc.createDataChannel("oai-events");
  let assistantBuf = "";
  // OpenAI rejects response.create while a response is still streaming
  // ("Conversation already has an active response in progress") — so tool
  // answers queue their response.create until the active one finishes.
  let responseActive = false;
  let pendingResponseCreate = false;
  dc.onmessage = async (e) => {
    let ev: any;
    try { ev = JSON.parse(e.data); } catch { return; }
    switch (ev.type) {
      case "response.created":
        responseActive = true;
        break;
      // GA and beta event names for the spoken-answer transcript
      case "response.output_audio_transcript.delta":
      case "response.audio_transcript.delta":
        if (typeof ev.delta === "string") { assistantBuf += ev.delta; cb.onAssistantDelta(ev.delta); }
        break;
      case "response.done":
        responseActive = false;
        if (assistantBuf.trim()) cb.onAssistantDone(assistantBuf.trim());
        assistantBuf = "";
        if (pendingResponseCreate && !stopped) {
          pendingResponseCreate = false;
          dc.send(JSON.stringify({ type: "response.create" }));
        }
        break;
      case "conversation.item.input_audio_transcription.completed":
        if (typeof ev.transcript === "string" && ev.transcript.trim()) cb.onUserTranscript(ev.transcript.trim());
        break;
      case "response.output_item.done": {
        const item = ev.item;
        if (item?.type === "function_call" && item.name === "ask_carmen" && !stopped) {
          let question = "";
          try { question = JSON.parse(item.arguments)?.question ?? ""; } catch { /* malformed args */ }
          const answer = await cb.onToolCall(question);
          if (stopped) break;
          dc.send(JSON.stringify({
            type: "conversation.item.create",
            item: { type: "function_call_output", call_id: item.call_id, output: answer.slice(0, 8000) },
          }));
          if (responseActive) pendingResponseCreate = true;
          else dc.send(JSON.stringify({ type: "response.create" }));
        }
        break;
      }
      case "error":
        cb.onError(ev.error?.message ?? "Realtime error");
        break;
    }
  };

  // Surface transport failures (network blocks WebRTC/UDP, ICE failure) —
  // otherwise the session looks alive while no audio ever flows
  pc.onconnectionstatechange = () => {
    if (stopped) return;
    if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
      cb.onError(`WebRTC connection ${pc.connectionState}`);
    }
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  const resp = await fetch(`https://api.openai.com/v1/realtime/calls?model=${encodeURIComponent(model)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${clientSecret}`, "Content-Type": "application/sdp" },
    body: offer.sdp,
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    mic.getTracks().forEach((t) => t.stop());
    pc.close();
    throw new Error(`Realtime handshake failed (${resp.status}): ${detail.slice(0, 300)}`);
  }
  await pc.setRemoteDescription({ type: "answer", sdp: await resp.text() });

  return {
    stop: () => {
      stopped = true;
      cancelAnimationFrame(raf);
      try { dc.close(); } catch { /* already closed */ }
      try { pc.close(); } catch { /* already closed */ }
      mic.getTracks().forEach((t) => t.stop());
      audioEl.srcObject = null;
      audioCtx?.close().catch(() => {});
      cb.audioLevelRef.current = 0;
    },
  };
}
