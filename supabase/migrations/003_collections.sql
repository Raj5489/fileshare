-- ============================================================
-- Collections (Folders) feature
-- ============================================================

-- 1. Collections table
CREATE TABLE IF NOT EXISTS public.collections (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  share_token  TEXT UNIQUE NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_collections_user  ON public.collections(user_id);
CREATE INDEX IF NOT EXISTS idx_collections_token ON public.collections(share_token);

-- 2. Add folder reference to files
ALTER TABLE public.files
  ADD COLUMN IF NOT EXISTS collection_id UUID REFERENCES public.collections(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_files_collection ON public.files(collection_id);

-- 3. RLS for collections
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own collections" ON public.collections;
CREATE POLICY "Users manage own collections" ON public.collections
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Public read collections by token" ON public.collections;
CREATE POLICY "Public read collections by token" ON public.collections
  FOR SELECT USING (true);
