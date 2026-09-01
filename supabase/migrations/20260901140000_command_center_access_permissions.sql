-- Command Center granular access tiers (stored in user_permissions.module):
--   command_center_full    — /command-center + sidecar + full dev escalation
--   command_center_sidecar — sidecar only
--   command_center_bugfix  — sidecar + Cursor bugfix escalation only
-- Only one tier row should be can_access=true per user (enforced in UI).
-- No schema change required.

COMMENT ON TABLE public.user_permissions IS
  'Per-user module access flags. Command Center tiers: command_center_full, command_center_sidecar, command_center_bugfix (mutually exclusive).';