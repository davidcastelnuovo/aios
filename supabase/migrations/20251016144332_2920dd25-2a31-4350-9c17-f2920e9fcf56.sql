-- Create enum types
CREATE TYPE agency_status AS ENUM ('active', 'paused', 'former');
CREATE TYPE client_status AS ENUM ('active', 'paused', 'ended');
CREATE TYPE finance_type AS ENUM ('income', 'expense');
CREATE TYPE payment_method AS ENUM ('cash', 'card', 'wire', 'check');
CREATE TYPE supplier_type AS ENUM ('campaigner', 'media', 'design', 'creative', 'dev', 'other');
CREATE TYPE task_status AS ENUM ('open', 'in_progress', 'done');
CREATE TYPE task_type AS ENUM ('campaign', 'collection', 'creative', 'other');
CREATE TYPE priority_level AS ENUM ('high', 'medium', 'low');

-- Agencies table
CREATE TABLE public.agencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  status agency_status NOT NULL DEFAULT 'active',
  start_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Clients table
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  industry TEXT,
  monthly_budget DECIMAL(12,2),
  start_date DATE,
  status client_status NOT NULL DEFAULT 'active',
  website TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Campaigners table
CREATE TABLE public.campaigners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  role TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Client Team (N:N between clients and campaigners)
CREATE TABLE public.client_team (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  campaigner_id UUID NOT NULL REFERENCES public.campaigners(id) ON DELETE CASCADE,
  role_on_account TEXT,
  allocation_percent INTEGER DEFAULT 100 CHECK (allocation_percent >= 0 AND allocation_percent <= 100),
  start_date DATE,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id, campaigner_id, start_date)
);

-- Suppliers table
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type supplier_type NOT NULL,
  related_campaigner_id UUID REFERENCES public.campaigners(id) ON DELETE SET NULL,
  phone TEXT,
  email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Finance table
CREATE TABLE public.finance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type finance_type NOT NULL,
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  payment_method payment_method,
  category TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tasks table
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  task_type task_type DEFAULT 'other',
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  campaigner_id UUID NOT NULL REFERENCES public.campaigners(id) ON DELETE CASCADE,
  due_date DATE,
  status task_status NOT NULL DEFAULT 'open',
  priority priority_level NOT NULL DEFAULT 'medium',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_finance_date ON public.finance(date);
CREATE INDEX idx_finance_agency_date ON public.finance(agency_id, date);
CREATE INDEX idx_finance_client_date ON public.finance(client_id, date);
CREATE INDEX idx_finance_supplier_date ON public.finance(supplier_id, date);
CREATE INDEX idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_campaigner ON public.tasks(campaigner_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_agencies_updated_at
  BEFORE UPDATE ON public.agencies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_campaigners_updated_at
  BEFORE UPDATE ON public.campaigners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_finance_updated_at
  BEFORE UPDATE ON public.finance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies (all tables accessible to authenticated users)
ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_team ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Policies for agencies
CREATE POLICY "Authenticated users can view agencies"
  ON public.agencies FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert agencies"
  ON public.agencies FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update agencies"
  ON public.agencies FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete agencies"
  ON public.agencies FOR DELETE
  TO authenticated
  USING (true);

-- Policies for clients
CREATE POLICY "Authenticated users can view clients"
  ON public.clients FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert clients"
  ON public.clients FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update clients"
  ON public.clients FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete clients"
  ON public.clients FOR DELETE
  TO authenticated
  USING (true);

-- Policies for campaigners
CREATE POLICY "Authenticated users can view campaigners"
  ON public.campaigners FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert campaigners"
  ON public.campaigners FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update campaigners"
  ON public.campaigners FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete campaigners"
  ON public.campaigners FOR DELETE
  TO authenticated
  USING (true);

-- Policies for client_team
CREATE POLICY "Authenticated users can view client_team"
  ON public.client_team FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert client_team"
  ON public.client_team FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update client_team"
  ON public.client_team FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete client_team"
  ON public.client_team FOR DELETE
  TO authenticated
  USING (true);

-- Policies for suppliers
CREATE POLICY "Authenticated users can view suppliers"
  ON public.suppliers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert suppliers"
  ON public.suppliers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update suppliers"
  ON public.suppliers FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete suppliers"
  ON public.suppliers FOR DELETE
  TO authenticated
  USING (true);

-- Policies for finance
CREATE POLICY "Authenticated users can view finance"
  ON public.finance FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert finance"
  ON public.finance FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update finance"
  ON public.finance FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete finance"
  ON public.finance FOR DELETE
  TO authenticated
  USING (true);

-- Policies for tasks
CREATE POLICY "Authenticated users can view tasks"
  ON public.tasks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert tasks"
  ON public.tasks FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update tasks"
  ON public.tasks FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete tasks"
  ON public.tasks FOR DELETE
  TO authenticated
  USING (true);