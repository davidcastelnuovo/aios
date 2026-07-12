-- agent_batch_reports — single-send guard for delegate_parallel WhatsApp delivery.
-- When a delegate_parallel batch finishes, exactly ONE aggregated report must be
-- pushed to WhatsApp — not one message per subtask. run-agent-task claims the
-- send by inserting the batch_id here; the PK makes the claim atomic, so if two
-- subtasks finish concurrently only the first insert wins and sends the report.

create table if not exists public.agent_batch_reports (
  batch_id uuid primary key,
  sent_at timestamptz not null default now()
);

comment on table public.agent_batch_reports is
  'One row per delegate_parallel batch whose aggregated WhatsApp report was sent. PK batch_id = atomic single-send claim (run-agent-task).';

alter table public.agent_batch_reports enable row level security;
-- Writes/reads go through the service role (run-agent-task edge function), which
-- bypasses RLS. No broad policy by default.
