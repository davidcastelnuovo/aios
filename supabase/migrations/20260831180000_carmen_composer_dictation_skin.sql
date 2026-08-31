-- Update Carmen skin: transcribe → composer (edit before send), system-wide
INSERT INTO public.ai_skills (
  tenant_id, scope, is_active, created_by_agent, slug, name, description, system_prompt, triggers
)
VALUES (
  '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019',
  'tenant',
  true,
  true,
  'carmen_transcribe_only_mic',
  'תמלול לקומפוזר — כרמן',
  'Record → existing transcribe-voice → text in composer for edit before send. All Carmen chats.',
  $$Voice dictation in any Carmen chat (Command Center, sidecar, internal dialog):

1. User taps mic (הקלטה לתיבת ההודעה) → record → transcribe-voice (Whisper, unchanged).
2. Transcribed text is inserted into the composer — NOT auto-sent.
3. User edits the draft, then sends manually.
4. transcribe_only mode: text-only Carmen replies (no TTS). realtime_voice stays in Command Center only.
5. Sidecar always has composer dictation mic via CarmenComposerMicButton.$$,
  ARRAY[
    'תמלול לקומפוזר',
    'הקלטה לתיבת ההודעה',
    'composer dictation',
    'תמלול בלבד',
    'transcribe to composer'
  ]::text[]
)
ON CONFLICT (tenant_id, slug) WHERE scope = 'tenant'
DO UPDATE SET
  is_active = EXCLUDED.is_active,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  system_prompt = EXCLUDED.system_prompt,
  triggers = EXCLUDED.triggers,
  updated_at = now();
