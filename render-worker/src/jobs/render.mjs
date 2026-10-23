import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assembleFilm } from "../compose/assemble.mjs";
import { buildTimeline } from "../compose/timeline.mjs";
import { assertTenantPath, finalError, loadRunItem } from "../guard.mjs";
import { joinNarration } from "../narration.mjs";

const BUCKET = "creative-video";

const inList = (ids) => `(${ids.map(encodeURIComponent).join(",")})`;

async function materialize(db, tenantId, path, file) {
  await writeFile(
    file,
    await db.download(BUCKET, assertTenantPath(tenantId, path)),
  );
  return file;
}

/**
 * What the film is made of, read from the database for the run's tenant: every scene with a clip
 * in order with their current clip and voice, and the newest music bed. run.input only
 * says the aspect, so a hand-written run cannot point the worker at other files.
 */
export async function loadFilmSources(db, run) {
  const scenes =
    (await db.select(
      "marketing_video_scenes",
      `item_id=eq.${run.item_id}&tenant_id=eq.${run.tenant_id}&clip_asset_id=not.is.null&select=id,position,overlay_text,voiceover_text,duration_s,clip_asset_id,voice_asset_id&order=position`,
    )) ?? [];
  // Narration removed from the storyboard leaves its old voice asset linked; drop it.
  const voiceOf = (scene) =>
    String(scene.voiceover_text ?? "").trim() ? scene.voice_asset_id : null;
  const assetIds = scenes
    .flatMap((scene) => [scene.clip_asset_id, voiceOf(scene)])
    .filter(Boolean);
  const assets = new Map(
    (assetIds.length
      ? ((await db.select(
          "marketing_assets",
          `id=in.${inList(assetIds)}&tenant_id=eq.${run.tenant_id}&select=id,url`,
        )) ?? [])
      : []
    ).map((asset) => [asset.id, asset.url]),
  );
  const [music] =
    (await db.select(
      "marketing_assets",
      `item_id=eq.${run.item_id}&tenant_id=eq.${run.tenant_id}&type=eq.music&url=not.is.null&select=url&order=created_at.desc&limit=1`,
    )) ?? [];
  const [narration] =
    (await db.select(
      "marketing_assets",
      `item_id=eq.${run.item_id}&tenant_id=eq.${run.tenant_id}&type=eq.narration&url=not.is.null&select=url,meta&order=created_at.desc&limit=1`,
    )) ?? [];
  const scriptRows =
    (await db.select(
      "marketing_video_scenes",
      `item_id=eq.${run.item_id}&tenant_id=eq.${run.tenant_id}&select=voiceover_text&order=position`,
    )) ?? [];
  const script = joinNarration(scriptRows.map((scene) => scene.voiceover_text));
  const narrationPath =
    script && String(narration?.meta?.text ?? "") === script
      ? narration.url
      : null;
  const mapped = scenes
    .map((scene) => ({
      id: scene.id,
      position: scene.position,
      overlayText: scene.overlay_text,
      voiceoverText: scene.voiceover_text,
      durationS: scene.duration_s,
      clipPath: assets.get(scene.clip_asset_id) || null,
      voicePath: narrationPath ? null : assets.get(voiceOf(scene)) || null,
    }))
    .filter((scene) => scene.clipPath);
  const missingNarration = mapped.some(
    (scene) =>
      String(scene.voiceoverText ?? "").trim() &&
      !narrationPath &&
      !scene.voicePath,
  );
  if (missingNarration) throw finalError("render: narration missing");
  return {
    scenes: mapped,
    musicPath: music?.url || null,
    narrationPath,
  };
}

/** Builds the finished MP4 from each scene's current clip, its voiceover and the music bed. */
export async function renderFilm({ db, run, log = console.log }) {
  const item = await loadRunItem(db, run);
  const sources = await loadFilmSources(db, run);
  if (!sources.scenes.length) throw finalError("render: no approved clips");
  const dir = await mkdtemp(join(tmpdir(), "promo-"));
  try {
    const local = [];
    for (const [index, scene] of sources.scenes.entries()) {
      local.push({
        ...scene,
        clipPath: await materialize(
          db,
          run.tenant_id,
          scene.clipPath,
          join(dir, `clip-${index}.mp4`),
        ),
        voicePath: scene.voicePath
          ? await materialize(
              db,
              run.tenant_id,
              scene.voicePath,
              join(dir, `voice-${index}.audio`),
            )
          : null,
      });
    }
    const musicPath = sources.musicPath
      ? await materialize(
          db,
          run.tenant_id,
          sources.musicPath,
          join(dir, "music.audio"),
        )
      : null;
    const timeline = buildTimeline(local, {
      aspect: run.input?.aspect || "9:16",
      musicPath,
      narrationPath: sources.narrationPath,
    });
    const output = join(dir, "film.mp4");
    await assembleFilm(timeline, output);
    const bytes = await readFile(output);
    // One file per run: concurrent renders of the same item can never overwrite each other.
    const path = assertTenantPath(
      run.tenant_id,
      `${item.folder}/render/film-${run.id}.mp4`,
    );
    await db.upload(BUCKET, path, bytes, "video/mp4");
    const existing = await db.select(
      "marketing_assets",
      `run_id=eq.${run.id}&type=eq.render&select=id`,
    );
    if (!existing?.length)
      await db.insert("marketing_assets", {
        tenant_id: run.tenant_id,
        item_id: run.item_id,
        run_id: run.id,
        stage_id: run.stage_id,
        type: "render",
        url: path,
        meta: {
          bucket: BUCKET,
          path,
          provider: "compose",
          duration_s: timeline.totalS,
          scene_count: timeline.scenes.length,
          aspect: timeline.aspect,
        },
      });
    log(`[render] ${run.id} stored ${path}`);
    return {
      output: {
        path,
        duration_s: timeline.totalS,
        scene_count: timeline.scenes.length,
      },
      provider: "compose",
      credits: 0,
      costUsd: 0,
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
