-- ============================================================
-- FileShare AI Assistant — Database Schema
-- Migration 009
--
-- Creates five tables for the AI customer-support system.
-- All tables use the "assistant_" prefix to avoid collisions
-- with the existing schema.
--
-- Safe to run multiple times (IF NOT EXISTS / OR REPLACE).
-- Does NOT modify any existing table or policy.
-- ============================================================

-- ── 1. assistant_conversations ───────────────────────────────
-- One row per chat session. Anonymous visitors are identified
-- by a server-generated session_id stored in an HttpOnly cookie.
-- Authenticated users are linked by user_id as well.

CREATE TABLE IF NOT EXISTS public.assistant_conversations (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       TEXT        NOT NULL,
  channel          TEXT        NOT NULL DEFAULT 'web'
                                CHECK (channel IN ('web', 'telegram')),
  telegram_chat_id BIGINT,
  user_id          UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asst_conv_session
  ON public.assistant_conversations(session_id);

CREATE INDEX IF NOT EXISTS idx_asst_conv_telegram
  ON public.assistant_conversations(telegram_chat_id)
  WHERE telegram_chat_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_asst_conv_user
  ON public.assistant_conversations(user_id)
  WHERE user_id IS NOT NULL;

-- ── 2. assistant_messages ────────────────────────────────────
-- Individual turns in a conversation.

CREATE TABLE IF NOT EXISTS public.assistant_messages (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID        NOT NULL
                                REFERENCES public.assistant_conversations(id)
                                ON DELETE CASCADE,
  role             TEXT        NOT NULL
                                CHECK (role IN ('user', 'assistant', 'system')),
  content          TEXT        NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asst_msg_conv
  ON public.assistant_messages(conversation_id, created_at);

-- ── 3. assistant_knowledge ──────────────────────────────────
-- Knowledge-base entries used for retrieval before AI calls.
-- Administrators manage these via the admin dashboard.

CREATE TABLE IF NOT EXISTS public.assistant_knowledge (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  category    TEXT        NOT NULL,
  title       TEXT        NOT NULL,
  content     TEXT        NOT NULL,
  keywords    TEXT[]      NOT NULL DEFAULT '{}',
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asst_kb_category
  ON public.assistant_knowledge(category)
  WHERE is_active = TRUE;

-- GIN index for fast keyword array searches
CREATE INDEX IF NOT EXISTS idx_asst_kb_keywords
  ON public.assistant_knowledge USING GIN(keywords)
  WHERE is_active = TRUE;

-- Full-text search index on title + content
CREATE INDEX IF NOT EXISTS idx_asst_kb_fts
  ON public.assistant_knowledge
  USING GIN(to_tsvector('english', title || ' ' || content))
  WHERE is_active = TRUE;

-- ── 4. assistant_tickets ─────────────────────────────────────
-- Support tickets created when AI cannot resolve an issue.

CREATE TABLE IF NOT EXISTS public.assistant_tickets (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id        TEXT        UNIQUE NOT NULL,
  conversation_id  UUID        REFERENCES public.assistant_conversations(id)
                                ON DELETE SET NULL,
  channel          TEXT        NOT NULL
                                CHECK (channel IN ('web', 'telegram')),
  customer_name    TEXT,
  customer_email   TEXT,
  category         TEXT        NOT NULL,
  description      TEXT        NOT NULL,
  status           TEXT        NOT NULL DEFAULT 'open'
                                CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority         TEXT        NOT NULL DEFAULT 'medium'
                                CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  admin_notes      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asst_ticket_status
  ON public.assistant_tickets(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_asst_ticket_id
  ON public.assistant_tickets(ticket_id);

-- ── 5. assistant_feedback ────────────────────────────────────
-- Optional thumbs-up / thumbs-down or 1-5 star rating per message.

CREATE TABLE IF NOT EXISTS public.assistant_feedback (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID        NOT NULL
                                REFERENCES public.assistant_conversations(id)
                                ON DELETE CASCADE,
  message_id       UUID        REFERENCES public.assistant_messages(id)
                                ON DELETE SET NULL,
  rating           SMALLINT    NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment          TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asst_feedback_conv
  ON public.assistant_feedback(conversation_id);

-- ── 6. Auto-update updated_at ────────────────────────────────
-- Reuse/create a generic trigger function for updated_at columns.

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_asst_conv_updated_at
  ON public.assistant_conversations;
CREATE TRIGGER trg_asst_conv_updated_at
  BEFORE UPDATE ON public.assistant_conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_asst_kb_updated_at
  ON public.assistant_knowledge;
CREATE TRIGGER trg_asst_kb_updated_at
  BEFORE UPDATE ON public.assistant_knowledge
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_asst_ticket_updated_at
  ON public.assistant_tickets;
CREATE TRIGGER trg_asst_ticket_updated_at
  BEFORE UPDATE ON public.assistant_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 7. Ticket ID generator ───────────────────────────────────
-- Generates human-readable IDs like TKT-20250601-0042.
-- Called from the application layer via RPC.

CREATE OR REPLACE FUNCTION public.generate_ticket_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  today      TEXT;
  seq        BIGINT;
  ticket_id  TEXT;
BEGIN
  today := TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYYMMDD');

  -- Count tickets created today to build a zero-padded sequence.
  SELECT COUNT(*) + 1
    INTO seq
    FROM public.assistant_tickets
   WHERE created_at >= (NOW() AT TIME ZONE 'UTC')::DATE;

  ticket_id := 'TKT-' || today || '-' || LPAD(seq::TEXT, 4, '0');
  RETURN ticket_id;
END;
$$;

-- ── 8. Row Level Security ────────────────────────────────────
-- Philosophy:
--   • Anonymous visitors access only their own conversation via session_id.
--   • session_id is a server-generated UUID stored in an HttpOnly cookie;
--     the browser never sets it directly.
--   • All admin mutations use the service-role key (bypasses RLS); admin
--     authorization is enforced at the application layer.
--   • The anon key is used only for the operations explicitly allowed below.

ALTER TABLE public.assistant_conversations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_messages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_knowledge      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_tickets        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_feedback       ENABLE ROW LEVEL SECURITY;

-- ── assistant_conversations ──────────────────────────────────

-- Visitors can read/create their own conversation only.
-- session_id is passed as a Postgres config parameter from the app:
--   SET LOCAL app.session_id = '<value>';
-- We use a request header approach instead (simpler with Supabase):
-- The application always uses the service-role key for conversation ops
-- so these anon policies are a defence-in-depth backstop only.

DROP POLICY IF EXISTS "Anon reads own conversation" ON public.assistant_conversations;
CREATE POLICY "Anon reads own conversation"
  ON public.assistant_conversations
  FOR SELECT
  TO anon
  USING (FALSE); -- anon key cannot read; service-role key is used instead

DROP POLICY IF EXISTS "Auth reads own conversation" ON public.assistant_conversations;
CREATE POLICY "Auth reads own conversation"
  ON public.assistant_conversations
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- ── assistant_messages ───────────────────────────────────────

DROP POLICY IF EXISTS "No direct anon access to messages" ON public.assistant_messages;
CREATE POLICY "No direct anon access to messages"
  ON public.assistant_messages
  FOR ALL
  TO anon
  USING (FALSE);

DROP POLICY IF EXISTS "Auth reads own messages" ON public.assistant_messages;
CREATE POLICY "Auth reads own messages"
  ON public.assistant_messages
  FOR SELECT
  TO authenticated
  USING (
    conversation_id IN (
      SELECT id FROM public.assistant_conversations
      WHERE user_id = auth.uid()
    )
  );

-- ── assistant_knowledge ──────────────────────────────────────
-- Public SELECT so the chat API (using service-role) can query it.
-- Mutations are admin-only, enforced at application layer.

DROP POLICY IF EXISTS "Public read active knowledge" ON public.assistant_knowledge;
CREATE POLICY "Public read active knowledge"
  ON public.assistant_knowledge
  FOR SELECT
  USING (is_active = TRUE);

-- ── assistant_tickets ────────────────────────────────────────
-- Visitors may INSERT a ticket (create a support request).
-- They cannot read, update, or delete.

DROP POLICY IF EXISTS "Anyone can create ticket" ON public.assistant_tickets;
CREATE POLICY "Anyone can create ticket"
  ON public.assistant_tickets
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS "No anon read on tickets" ON public.assistant_tickets;
CREATE POLICY "No anon read on tickets"
  ON public.assistant_tickets
  FOR SELECT
  TO anon
  USING (FALSE);

-- ── assistant_feedback ───────────────────────────────────────

DROP POLICY IF EXISTS "Anyone can submit feedback" ON public.assistant_feedback;
CREATE POLICY "Anyone can submit feedback"
  ON public.assistant_feedback
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS "No anon read on feedback" ON public.assistant_feedback;
CREATE POLICY "No anon read on feedback"
  ON public.assistant_feedback
  FOR SELECT
  TO anon
  USING (FALSE);

-- ── 9. Initial knowledge-base seed ──────────────────────────
-- Only facts that are directly verifiable from the codebase.
-- Does NOT invent limits, pricing, or capabilities.

INSERT INTO public.assistant_knowledge
  (category, title, content, keywords)
VALUES

('general', 'What is FileShare?',
'FileShare is a free file-sharing service. You can upload any file and get a shareable link instantly. No account is required to upload or download files.',
ARRAY['what is fileshare', 'about', 'overview', 'free', 'no signup']),

('general', 'Do I need an account?',
'No. You can upload and share files without creating an account. Creating an account gives you a personal dashboard to manage your files, higher storage limits, and the ability to set longer expiry times.',
ARRAY['account', 'signup', 'register', 'login', 'guest', 'no account']),

('uploading', 'How do I upload a file?',
'On the homepage, drag and drop your file onto the upload area, or click the area to browse your device. The upload starts immediately. When it finishes you will receive a share link and QR code.',
ARRAY['upload', 'how to upload', 'drag drop', 'browse', 'share link']),

('uploading', 'What file types are supported?',
'FileShare accepts images (JPEG, PNG, GIF, WebP, SVG, BMP, TIFF), documents (PDF, Word, Excel, PowerPoint), text files, archives (ZIP, 7z, RAR, TAR), video (MP4, WebM, MKV, MOV), audio (MP3, WAV, AAC, FLAC), executables, and many other formats. The maximum file size is 10 GB per file.',
ARRAY['file types', 'supported', 'format', 'extension', 'max size', '10gb', 'limit']),

('uploading', 'What is the maximum file size?',
'The maximum file size is 10 GB per file. Guest users have a combined daily upload quota of 5 GB per IP address. Authenticated users have a larger storage quota.',
ARRAY['max size', 'file size', 'limit', '10gb', 'large file', 'quota']),

('uploading', 'Upload is slow or stuck',
'Slow uploads are usually caused by your internet connection speed. Very large files are uploaded in multiple parts automatically. If your upload appears stuck for more than a few minutes, try refreshing the page and uploading again. Make sure you are not on a metered or throttled connection.',
ARRAY['slow upload', 'stuck', 'upload not working', 'upload failed', 'retry']),

('downloading', 'How do I download a file?',
'Open the share link you received. If the file has no password, click the Download button. If it is password-protected, enter the password first. The file will download directly to your device.',
ARRAY['download', 'how to download', 'get file', 'receive file']),

('downloading', 'Download is not working',
'If the download button does nothing, try a different browser or disable any download-blocking extensions. If you get a "file not found" error, the link may have expired or been deleted. Contact the person who shared the file for a new link.',
ARRAY['download not working', 'download failed', 'error', 'not found', 'broken link']),

('sharing', 'How do I share a file?',
'After uploading, you will see a share link and a QR code. Copy the link and send it to anyone. You can also scan the QR code. No account is needed to download the file.',
ARRAY['share', 'share link', 'qr code', 'send file', 'how to share']),

('sharing', 'How do I protect a shared file with a password?',
'Before uploading, expand the options and enter a password in the Password field. The recipient will need to enter the password before downloading.',
ARRAY['password', 'protect', 'password protect', 'secure link', 'private']),

('sharing', 'How do I limit the number of downloads?',
'In the upload options, you can set a maximum number of downloads. Once that limit is reached, the link stops working.',
ARRAY['download limit', 'max downloads', 'one-time', 'limit downloads']),

('folders', 'What is folder sharing?',
'You can group multiple files into a collection (folder) and share them with a single link. The recipient sees all files in the collection and can download them individually or as a ZIP.',
ARRAY['folder', 'collection', 'multiple files', 'zip', 'folder sharing']),

('expiry', 'How does file expiry work?',
'When you upload, you can choose how long the link stays active: 1 hour, 24 hours, 7 days, 30 days, or never. Guest users can set up to 7 days. After expiry, the link stops working and the file is deleted automatically.',
ARRAY['expiry', 'expire', 'how long', 'delete', 'link lifetime', '7 days', '30 days', 'never']),

('expiry', 'Can I make a link that never expires?',
'Yes. When uploading, select "Never" as the expiry option. This option is only available to logged-in users. Guest uploads are limited to a maximum of 7 days.',
ARRAY['never expire', 'permanent link', 'no expiry', 'forever']),

('account', 'How do I create an account?',
'Click "Login / Sign Up" in the top navigation bar. You can sign up with an email and password or continue with Google.',
ARRAY['create account', 'sign up', 'register', 'google login', 'oauth']),

('account', 'I forgot my password',
'On the login dialog, use the password reset option. If you signed up with Google, use Google Sign-In instead.',
ARRAY['forgot password', 'reset password', 'lost password']),

('security', 'Is my file private?',
'Files are stored securely on Cloudflare R2. Anyone with the share link can download the file. If you want to restrict access, use the password-protection option when uploading. Files are not publicly listed or searchable.',
ARRAY['private', 'security', 'who can see', 'privacy', 'secure']),

('security', 'How do I delete a file?',
'Log in to your dashboard and find the file. Click the delete option. The file and its share link are removed immediately. Guest uploads cannot be deleted manually — they expire according to the expiry setting you chose.',
ARRAY['delete', 'remove file', 'how to delete']),

('troubleshooting', 'I got a "Guest storage quota exceeded" error',
'Guest users have a 5 GB daily upload limit per IP address. This resets every 24 hours. To upload more, create a free account which has a higher storage quota.',
ARRAY['quota exceeded', 'storage limit', 'guest quota', '5gb', 'too much']),

('troubleshooting', 'The share link says "File not found"',
'This happens when the file has been deleted, the link has expired, or the file was never fully uploaded. Ask the sender to share a new link.',
ARRAY['file not found', '404', 'link broken', 'expired link']),

('support', 'How do I contact support?',
'You can create a support ticket using the button in this chat. Describe your issue and include your email address if you need a reply. We will respond as soon as possible.',
ARRAY['contact', 'support', 'help', 'ticket', 'report problem', 'email support'])

ON CONFLICT DO NOTHING;
