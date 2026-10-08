
CREATE TABLE IF NOT EXISTS public.error_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp BIGINT,
    error_type VARCHAR(255),
    filename VARCHAR(255),
    lineno INTEGER,
    colno INTEGER,
    stack TEXT,
    has_blank_screen BOOLEAN,
    source VARCHAR(50),
    error_message TEXT,
    url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow insert for all" ON public.error_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "No direct read" ON public.error_logs FOR SELECT USING (false);
