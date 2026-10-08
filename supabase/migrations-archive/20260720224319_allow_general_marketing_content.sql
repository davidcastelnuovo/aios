-- Tenant-wide marketing content is intentionally not assigned to a client or pipeline.
alter table public.marketing_work_items
  alter column client_id drop not null,
  alter column pipeline_id drop not null;

comment on column public.marketing_work_items.client_id is
  'Optional client assignment. NULL represents tenant-wide general content.';

comment on column public.marketing_work_items.pipeline_id is
  'Optional workflow pipeline. General content can exist before being assigned to a client workflow.';
