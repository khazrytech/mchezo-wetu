ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sms_reminders_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_reminders_consent_at timestamptz;

CREATE TABLE IF NOT EXISTS public.payment_reminder_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contribution_id uuid NOT NULL REFERENCES public.contributions(id) ON DELETE CASCADE,
  reminder_type text NOT NULL CHECK (reminder_type IN ('due_soon', 'due_today', 'overdue')),
  scheduled_for date NOT NULL,
  status text NOT NULL DEFAULT 'sending'
    CHECK (status IN ('sending', 'sent', 'failed')),
  attempts integer NOT NULL DEFAULT 1 CHECK (attempts > 0),
  provider_message_id text,
  error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contribution_id, reminder_type, scheduled_for)
);

CREATE INDEX IF NOT EXISTS payment_reminder_logs_status_updated_idx
  ON public.payment_reminder_logs (status, updated_at);

ALTER TABLE public.payment_reminder_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.payment_reminder_logs FROM anon, authenticated, PUBLIC;
GRANT ALL ON TABLE public.payment_reminder_logs TO service_role;
