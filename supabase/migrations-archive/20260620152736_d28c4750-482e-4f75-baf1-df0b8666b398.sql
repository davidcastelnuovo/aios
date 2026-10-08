CREATE TABLE public.user_workspace_layout (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  module_id text NOT NULL,
  x_position int NOT NULL DEFAULT 0,
  y_position int NOT NULL DEFAULT 0,
  width int NOT NULL DEFAULT 320,
  height int NOT NULL DEFAULT 220,
  is_open boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tenant_id, module_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_workspace_layout TO authenticated;
GRANT ALL ON public.user_workspace_layout TO service_role;

ALTER TABLE public.user_workspace_layout ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own layout"
  ON public.user_workspace_layout
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER set_user_workspace_layout_updated_at
  BEFORE UPDATE ON public.user_workspace_layout
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();