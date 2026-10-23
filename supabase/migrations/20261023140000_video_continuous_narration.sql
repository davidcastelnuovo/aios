-- One narration for the whole storyboard. Several scenes are spoken as a single take,
-- then the film is assembled with that track. A scene that still has unspoken text
-- blocks a silent assembly.

create unique index if not exists marketing_runs_one_active_narration
  on public.marketing_runs (item_id)
  where scene_id is null and status in ('queued', 'running') and kind = 'voice';

-- True when there is nothing to say, the current script already has one narration,
-- or every spoken scene still has a voice asset of its own line.
create or replace function public.video_narration_ready(p_item_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(v.script, '') = ''
    or exists (
      select 1 from public.marketing_assets
       where item_id = p_item_id
         and type = 'narration'
         and coalesce(url, '') <> ''
         and coalesce(meta->>'text', '') = v.script
    )
    or not exists (
      select 1
        from public.marketing_video_scenes as scene
        left join public.marketing_assets as voice on voice.id = scene.voice_asset_id
       where scene.item_id = p_item_id
         and btrim(scene.voiceover_text) <> ''
         and coalesce(voice.meta->'lines'->> (scene.id::text), voice.meta->>'text', '')
             <> btrim(scene.voiceover_text)
    )
  from (
    select string_agg(btrim(voiceover_text), ' ' order by position) as script
      from public.marketing_video_scenes
     where item_id = p_item_id
       and btrim(voiceover_text) <> ''
  ) as v;
$$;

grant execute on function public.video_narration_ready(uuid) to authenticated, service_role;

create or replace function public.attach_video_narration(
  p_item_id uuid,
  p_url text,
  p_meta jsonb default '{}'::jsonb,
  p_run_id uuid default null,
  p_lines jsonb default '{}'::jsonb
)
returns public.marketing_assets
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_item public.marketing_work_items;
  v_asset public.marketing_assets;
begin
  if coalesce(p_url, '') = '' then
    raise exception 'attach_video_narration: url is required' using errcode = '22023';
  end if;
  select * into v_item from public.marketing_work_items where id = p_item_id;
  if not found then
    raise exception 'attach_video_narration: work item % not found', p_item_id using errcode = 'P0002';
  end if;

  if p_run_id is not null then
    select * into v_asset
      from public.marketing_assets
     where run_id = p_run_id and type = 'narration'
     limit 1;
  end if;
  if v_asset.id is null then
    insert into public.marketing_assets (tenant_id, item_id, run_id, stage_id, type, url, meta)
    values (
      v_item.tenant_id,
      p_item_id,
      p_run_id,
      v_item.current_stage_id,
      'narration',
      p_url,
      coalesce(p_meta, '{}'::jsonb) || jsonb_build_object(
        'lines', coalesce(p_lines, '{}'::jsonb),
        'continuous', true
      )
    )
    returning * into v_asset;
  end if;

  update public.marketing_video_scenes as scene
     set voice_asset_id = v_asset.id
   where scene.item_id = p_item_id
     and scene.tenant_id = v_item.tenant_id
     and coalesce(p_lines, '{}'::jsonb) ? (scene.id::text);

  return v_asset;
end;
$$;

grant execute on function public.attach_video_narration(uuid, text, jsonb, uuid, jsonb)
  to authenticated, service_role;

create or replace function public.queue_video_sound(
  p_item_id uuid,
  p_kind text,
  p_scene_ids uuid[] default '{}'::uuid[],
  p_provider text default 'elevenlabs',
  p_estimate jsonb default '{}'::jsonb,
  p_stage_id uuid default null,
  p_prompt text default null,
  p_voice_id text default null
)
returns setof public.marketing_runs
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_item public.marketing_work_items;
  v_stage uuid;
  v_seconds numeric;
  v_ids uuid[];
  v_script text;
begin
  if p_kind not in ('voice', 'music') then
    raise exception 'queue_video_sound: kind must be voice or music' using errcode = '22023';
  end if;
  if p_provider <> 'elevenlabs' then
    raise exception 'queue_video_sound: sound provider must be elevenlabs' using errcode = '22023';
  end if;
  select * into v_item from public.marketing_work_items where id = p_item_id;
  if not found then
    raise exception 'queue_video_sound: work item % not found', p_item_id using errcode = 'P0002';
  end if;
  v_stage := coalesce(p_stage_id, v_item.current_stage_id);
  if v_stage is null then
    raise exception 'queue_video_sound: work item % has no stage' using errcode = '22023';
  end if;

  if p_kind = 'music' then
    if exists (
      select 1 from public.marketing_runs
       where item_id = p_item_id and kind = 'music' and status in ('queued', 'running')
    ) then
      return;
    end if;
    select coalesce(sum(duration_s), 0) into v_seconds
      from public.marketing_video_scenes where item_id = p_item_id;
    if v_seconds <= 0 then
      raise exception 'queue_video_sound: the storyboard has no duration' using errcode = '22023';
    end if;
    return query
    insert into public.marketing_runs (tenant_id, item_id, stage_id, kind, status, provider, input)
    values (
      v_item.tenant_id,
      p_item_id,
      v_stage,
      'music',
      'queued',
      p_provider,
      jsonb_build_object(
        'client_id', v_item.client_id,
        'prompt', coalesce(nullif(btrim(p_prompt), ''), 'Instrumental commercial bed, no vocals, no lyrics.'),
        'music_length_ms', least(greatest(round(v_seconds * 1000), 3000), 300000),
        'estimate', coalesce(p_estimate, '{}'::jsonb)
      )
    )
    on conflict (item_id, kind)
      where scene_id is null and status in ('queued', 'running') and kind in ('music', 'render')
    do nothing
    returning *;
    return;
  end if;

  select coalesce(array_agg(scene.id order by scene.position), '{}'::uuid[]),
         string_agg(btrim(scene.voiceover_text), ' ' order by scene.position)
    into v_ids, v_script
    from public.marketing_video_scenes as scene
   where scene.item_id = p_item_id
     and scene.id = any(p_scene_ids)
     and btrim(scene.voiceover_text) <> '';
  if coalesce(v_script, '') = '' then
    return;
  end if;
  if exists (
    select 1 from public.marketing_runs
     where item_id = p_item_id
       and kind = 'voice'
       and scene_id is null
       and status in ('queued', 'running')
  ) then
    return;
  end if;

  begin
    return query
    insert into public.marketing_runs (tenant_id, item_id, stage_id, kind, status, provider, input)
    values (
      v_item.tenant_id,
      p_item_id,
      v_stage,
      'voice',
      'queued',
      p_provider,
      jsonb_build_object(
        'continuous', true,
        'scene_ids', to_jsonb(v_ids),
        'client_id', v_item.client_id,
        'voiceover_text', v_script,
        'voice_id', nullif(btrim(coalesce(p_voice_id, '')), ''),
        'estimate', coalesce(p_estimate, '{}'::jsonb)
      )
    )
    returning *;
  exception when unique_violation then
    return;
  end;
end;
$$;

create or replace function public.advance_video_production(p_item_id uuid)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_item public.marketing_work_items;
  v_prod jsonb;
  v_render uuid;
  v_render_status text;
  v_render_error text;
  v_voice_error text;
  v_run uuid;
begin
  select * into v_item from public.marketing_work_items where id = p_item_id for update;
  if not found then
    return 'missing';
  end if;
  v_prod := v_item.payload->'video'->'production';
  if coalesce(v_prod->>'status', '') <> 'running' then
    return coalesce(v_prod->>'status', 'idle');
  end if;

  if exists (
    select 1 from public.marketing_runs
     where item_id = p_item_id
       and kind in ('clip', 'voice', 'music')
       and status in ('queued', 'running')
  ) then
    return 'working';
  end if;

  v_render := nullif(v_prod->>'render_run_id', '')::uuid;
  if v_render is not null then
    select status, error into v_render_status, v_render_error
      from public.marketing_runs where id = v_render;
    if v_render_status in ('queued', 'running') then
      return 'rendering';
    end if;
    perform public.set_video_production(p_item_id, jsonb_build_object(
      'status', case when v_render_status = 'completed' then 'done' else 'failed' end,
      'finished_at', now(),
      'error', case when v_render_status = 'completed' then null else coalesce(v_render_error, 'assembly failed') end
    ));
    return case when v_render_status = 'completed' then 'done' else 'failed' end;
  end if;

  if coalesce((v_prod->>'with_voice')::boolean, false)
     and not public.video_narration_ready(p_item_id) then
    select error into v_voice_error
      from public.marketing_runs
     where item_id = p_item_id and kind = 'voice'
     order by created_at desc
     limit 1;
    perform public.set_video_production(p_item_id, jsonb_build_object(
      'status', 'failed',
      'finished_at', now(),
      'error', coalesce(nullif(v_voice_error, ''), 'narration missing')
    ));
    return 'failed';
  end if;

  begin
    select id into v_run
      from public.queue_video_render(p_item_id, coalesce(v_prod->>'aspect', '9:16'), null)
     limit 1;
  exception when others then
    perform public.set_video_production(p_item_id, jsonb_build_object(
      'status', 'failed',
      'finished_at', now(),
      'error', case when sqlerrm like '%no approved clips%' then 'no clips to assemble' else sqlerrm end
    ));
    return 'failed';
  end;
  if v_run is null then
    select id into v_run
      from public.marketing_runs
     where item_id = p_item_id and kind = 'render' and status in ('queued', 'running')
     order by created_at desc
     limit 1;
  end if;
  perform public.set_video_production(p_item_id, jsonb_build_object('render_run_id', v_run));
  return 'rendering';
end;
$$;

create or replace function public.produce_video(
  p_item_id uuid,
  p_aspect text default '9:16',
  p_provider text default 'mock',
  p_estimate jsonb default '{}'::jsonb,
  p_stage_id uuid default null,
  p_with_voice boolean default true,
  p_with_music boolean default true,
  p_voice_id text default null,
  p_music_prompt text default null,
  p_generate_audio boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_item public.marketing_work_items;
  v_clip_ids uuid[];
  v_voice_ids uuid[];
  v_clips integer := 0;
  v_voices integer := 0;
  v_music integer := 0;
  v_state text;
begin
  select * into v_item from public.marketing_work_items where id = p_item_id;
  if not found then
    raise exception 'produce_video: work item % not found', p_item_id using errcode = 'P0002';
  end if;
  if coalesce(v_item.payload->'video'->'production'->>'status', '') = 'running'
     and coalesce((v_item.payload->'video'->'production'->>'started_at')::timestamptz, now()) > now() - interval '1 hour' then
    return jsonb_build_object('status', 'running', 'clips', 0, 'voices', 0, 'music', 0);
  end if;

  select coalesce(array_agg(scene.id), '{}'::uuid[]) into v_clip_ids
    from public.marketing_video_scenes as scene
   where scene.item_id = p_item_id
     and scene.still_asset_id is not null
     and (scene.clip_asset_id is null or scene.clip_stale or scene.status = 'failed');

  perform public.set_video_production(p_item_id, jsonb_build_object(
    'status', 'running',
    'aspect', p_aspect,
    'provider', p_provider,
    'with_voice', p_with_voice,
    'started_at', now(),
    'finished_at', null,
    'render_run_id', null,
    'error', null,
    'estimate', coalesce(p_estimate, '{}'::jsonb)
  ));

  if cardinality(v_clip_ids) > 0 then
    select count(*) into v_clips
      from public.queue_video_clips(
        p_item_id, v_clip_ids, p_aspect, coalesce(p_estimate->'clips', '{}'::jsonb),
        p_stage_id, p_provider, p_generate_audio
      );
  end if;

  if p_with_voice and not public.video_narration_ready(p_item_id) then
    select coalesce(array_agg(scene.id order by scene.position), '{}'::uuid[])
      into v_voice_ids
      from public.marketing_video_scenes as scene
     where scene.item_id = p_item_id
       and btrim(scene.voiceover_text) <> '';
    select count(*) into v_voices
      from public.queue_video_sound(
        p_item_id, 'voice', v_voice_ids, 'elevenlabs',
        coalesce(p_estimate->'voice', '{}'::jsonb), p_stage_id, null, p_voice_id
      );
  end if;

  if p_with_music and not exists (
    select 1 from public.marketing_assets
     where item_id = p_item_id and type = 'music' and coalesce(url, '') <> ''
  ) then
    select count(*) into v_music
      from public.queue_video_sound(
        p_item_id, 'music', '{}'::uuid[], 'elevenlabs',
        coalesce(p_estimate->'music', '{}'::jsonb), p_stage_id, p_music_prompt, null
      );
  end if;

  v_state := public.advance_video_production(p_item_id);
  return jsonb_build_object('status', v_state, 'clips', v_clips, 'voices', v_voices, 'music', v_music);
end;
$$;
