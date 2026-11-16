CREATE TABLE public.ouvidoria_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  recipient_email text,
  sender_email text,
  sender_name text NOT NULL DEFAULT 'De Olho na Rua',
  password_ciphertext text,
  smtp_host text,
  smtp_port integer CHECK (smtp_port BETWEEN 1 AND 65535),
  smtp_secure boolean NOT NULL DEFAULT true,
  imap_host text,
  imap_port integer CHECK (imap_port BETWEEN 1 AND 65535),
  imap_secure boolean NOT NULL DEFAULT true,
  auto_send boolean NOT NULL DEFAULT true,
  auto_read boolean NOT NULL DEFAULT true,
  ai_provider text NOT NULL DEFAULT 'gemini' CHECK (ai_provider IN ('gemini','groq')),
  ai_key_ciphertext text,
  ai_model text,
  last_sync_at timestamptz,
  last_sync_status text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT ALL ON public.ouvidoria_settings TO service_role;
ALTER TABLE public.ouvidoria_settings ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.ouvidoria_email_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pothole_id uuid NOT NULL UNIQUE REFERENCES public.potholes(id) ON DELETE CASCADE,
  email_token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','sent','error')),
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  message_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
GRANT ALL ON public.ouvidoria_email_queue TO service_role;
ALTER TABLE public.ouvidoria_email_queue ENABLE ROW LEVEL SECURITY;
CREATE INDEX ouvidoria_email_queue_pending_idx ON public.ouvidoria_email_queue (status, available_at, created_at);

CREATE TABLE public.ouvidoria_email_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id uuid REFERENCES public.ouvidoria_email_queue(id) ON DELETE CASCADE,
  message_id text NOT NULL UNIQUE,
  sender_email text,
  subject text,
  excerpt text,
  protocol text,
  confidence numeric,
  applied boolean NOT NULL DEFAULT false,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.ouvidoria_email_replies TO service_role;
ALTER TABLE public.ouvidoria_email_replies ENABLE ROW LEVEL SECURITY;
CREATE INDEX ouvidoria_email_replies_created_idx ON public.ouvidoria_email_replies (created_at DESC);

ALTER TABLE public.potholes
  ADD COLUMN ouvidoria_email_sent_at timestamptz,
  ADD COLUMN ouvidoria_protocol_source text CHECK (ouvidoria_protocol_source IN ('email','manual'));
GRANT SELECT (ouvidoria_email_sent_at, ouvidoria_protocol_source), UPDATE (ouvidoria_email_sent_at, ouvidoria_protocol_source) ON public.potholes TO authenticated;