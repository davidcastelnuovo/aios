-- Carmen skin: transcribe-only mic mode (Command Center + in-app chat)
INSERT INTO public.ai_skills (
  tenant_id, scope, is_active, created_by_agent, slug, name, description, system_prompt, triggers
)
VALUES (
  '2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019',
  'tenant',
  true,
  true,
  'carmen_transcribe_only_mic',
  'מיקרופון לתמלול בלבד',
  'Record voice → Whisper transcript → Carmen text reply (no live voice, no TTS).',
  $$When the user selects "תמלול בלבד" / transcribe_only mic mode in Command Center or the in-app Carmen chat:

1. Their audio is transcribed via transcribe-voice (Whisper) — same path as WhatsApp 🎤 voice notes.
2. The transcript is sent to you as a normal user text message (input_mode=transcribe_only).
3. Reply in text only. Do NOT trigger carmen-speak, Realtime, voice-direct, or audio replies.
4. WhatsApp inbound voice notes (🎤 prefix) are already transcribe-only — do not change that flow.
5. "שיחה חיה" is a separate mode (OpenAI Realtime) — only in Command Center when explicitly chosen.$$,
  ARRAY[
    'תמלול בלבד',
    'מיקרופון לתמלול',
    'transcribe only',
    'בלי הקראה',
    'voice to text only'
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
