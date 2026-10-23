import {
  assertTenantPath,
  finalError,
  loadRunItem,
  loadRunScene,
  safeSegment,
} from "../guard.mjs";
import { joinNarration } from "../narration.mjs";
import {
  MUSIC_MODEL,
  SPEECH_MODEL,
  composeMusic,
  synthesizeSpeech,
} from "../providers/elevenlabsSound.mjs";

const BUCKET = "creative-video";
/** ElevenLabs multilingual TTS list price; matches the studio's estimate. */
const VOICE_USD_PER_1000_CHARS = 0.12;

/** <item folder>/<scene or music>/<kind>-<run>.mp3: one file per run, stable across retries. */
const assetPath = (run, folder, kind, fallback = "music") =>
  assertTenantPath(
    run.tenant_id,
    `${folder}/${safeSegment(run.scene_id, fallback)}/${kind}-${safeSegment(run.id)}.mp3`,
  );

/** Scenes this voice run speaks, in storyboard order. */
async function narrationLines(db, run) {
  const rows =
    (await db.select(
      "marketing_video_scenes",
      `item_id=eq.${run.item_id}&tenant_id=eq.${run.tenant_id}&select=id,voiceover_text&order=position.asc`,
    )) ?? [];
  const wanted = new Set(
    Array.isArray(run.input?.scene_ids) ? run.input.scene_ids : [],
  );
  const lines = {};
  for (const row of rows) {
    if (wanted.size && !wanted.has(row.id)) continue;
    const text = String(row.voiceover_text ?? "").trim();
    if (text) lines[row.id] = text;
  }
  return { text: joinNarration(Object.values(lines)), lines };
}

/**
 * Pays the provider at most once per run. The audio is stored and its path recorded on the
 * run before anything else can fail, so a retry reuses it. A failure after the provider
 * charged but before the upload is final rather than retried.
 */
async function generateOnce({ db, run, path, generate }) {
  if (run.output?.audio_path === path) return run.output.audio_meta ?? {};
  const result = await generate();
  try {
    await db.upload(BUCKET, path, result.bytes, "audio/mpeg");
  } catch (error) {
    throw finalError(
      `audio was generated but could not be stored (${error instanceof Error ? error.message : error}); not retried to avoid paying again`,
    );
  }
  const meta = result.meta ?? {};
  try {
    await db.update("marketing_runs", `id=eq.${run.id}`, {
      output: { ...(run.output ?? {}), audio_path: path, audio_meta: meta },
    });
  } catch (error) {
    throw finalError(
      `audio was stored at ${path} but the run could not record it (${error instanceof Error ? error.message : error}); not retried to avoid paying again`,
    );
  }
  return meta;
}

/** Speaks the storyboard as one continuous narration, or one scene for an older voice run. */
export async function generateVoice({ db, run, apiKey, log = console.log }) {
  const continuous = run.input?.continuous === true || !run.scene_id;
  const item = await loadRunItem(db, run);
  // The text comes from the scene rows, so the voice matches what the storyboard shows.
  const spoken = continuous ? await narrationLines(db, run) : null;
  const scene = continuous
    ? null
    : await loadRunScene(db, run, "id,voiceover_text");
  const text = continuous
    ? spoken.text
    : String(scene.voiceover_text ?? "").trim();
  if (!text) throw finalError("voice run: voiceover_text is required");
  const path = assetPath(
    run,
    item.folder,
    "voice",
    continuous ? "narration" : "music",
  );
  const meta = await generateOnce({
    db,
    run,
    path,
    generate: async () => {
      const speech = await synthesizeSpeech({
        apiKey,
        voiceId: run.input?.voice_id || null,
        text,
      });
      return {
        bytes: speech.bytes,
        meta: { voice_id: speech.voiceId, alignment: speech.alignment },
      };
    },
  });
  if (continuous) {
    await db.rpc("attach_video_narration", {
      p_item_id: run.item_id,
      p_url: path,
      p_meta: {
        bucket: BUCKET,
        path,
        provider: "elevenlabs",
        model: SPEECH_MODEL(),
        voice_id: meta.voice_id ?? null,
        alignment: meta.alignment ?? null,
        continuous: true,
        // The whole script, so a later produce does not pay for the same narration again.
        text,
        lines: spoken.lines,
      },
      p_run_id: run.id,
      p_lines: spoken.lines,
    });
  } else {
    await db.rpc("attach_video_scene_asset", {
      p_scene_id: run.scene_id,
      p_kind: "voice",
      p_url: path,
      p_meta: {
        bucket: BUCKET,
        path,
        provider: "elevenlabs",
        model: SPEECH_MODEL(),
        voice_id: meta.voice_id ?? null,
        alignment: meta.alignment ?? null,
        // The storyboard compares this with the scene text to skip unchanged voiceovers.
        text,
      },
      p_run_id: run.id,
    });
  }
  log(`[voice] ${run.id} stored ${path}`);
  return {
    output: { path, provider: "elevenlabs", voice_id: meta.voice_id ?? null },
    provider: "elevenlabs",
    credits: 0,
    // ElevenLabs bills characters and returns no price: this scene's share, not the batch total.
    costUsd:
      Math.round((text.length / 1000) * VOICE_USD_PER_1000_CHARS * 10000) /
      10000,
  };
}

/** One music bed for the whole storyboard. */
export async function generateMusic({ db, run, apiKey, log = console.log }) {
  const item = await loadRunItem(db, run);
  const prompt = String(run.input?.prompt ?? "").trim();
  const musicLengthMs = Math.min(
    300_000,
    Math.max(3_000, Number(run.input?.music_length_ms) || 0),
  );
  if (!prompt || !Number(run.input?.music_length_ms))
    throw finalError("music run: prompt and music_length_ms are required");
  const path = assetPath(run, item.folder, "music");
  await generateOnce({
    db,
    run,
    path,
    generate: async () => ({
      bytes: await composeMusic({ apiKey, prompt, musicLengthMs }),
    }),
  });
  const existing = await db.select(
    "marketing_assets",
    `run_id=eq.${run.id}&type=eq.music&select=id`,
  );
  if (!existing?.length)
    await db.insert("marketing_assets", {
      tenant_id: run.tenant_id,
      item_id: run.item_id,
      run_id: run.id,
      stage_id: run.stage_id,
      type: "music",
      url: path,
      meta: {
        bucket: BUCKET,
        path,
        provider: "elevenlabs",
        model: MUSIC_MODEL(),
        music_length_ms: musicLengthMs,
      },
    });
  log(`[music] ${run.id} stored ${path}`);
  return {
    output: { path, provider: "elevenlabs" },
    provider: "elevenlabs",
    credits: 0,
    costUsd: Number(run.input?.estimate?.usd) || 0,
  };
}
