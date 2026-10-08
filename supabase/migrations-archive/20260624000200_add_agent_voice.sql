-- Carmen's spoken voice (OpenAI TTS) for voice-note replies.
-- Values: an OpenAI voice id (alloy|echo|fable|onyx|nova|shimmer|coral|sage) or NULL.
-- NULL = text only (no voice replies). Read by the WhatsApp send path when voice
-- replies are enabled. Tone/voice only — does not change what Carmen says.
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS voice text;

COMMENT ON COLUMN public.ai_agents.voice IS
  'OpenAI TTS voice id for spoken replies (alloy|echo|fable|onyx|nova|shimmer|coral|sage) or NULL for text-only.';
