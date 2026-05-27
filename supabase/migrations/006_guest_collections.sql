-- ============================================================
-- Allow guest (unauthenticated) collections
-- ============================================================

-- Make user_id nullable so anonymous users can create collections
ALTER TABLE public.collections
  ALTER COLUMN user_id DROP NOT NULL;

-- Drop old catch-all policy
DROP POLICY IF EXISTS "Users manage own collections" ON public.collections;

-- Authenticated users manage their own collections
DROP POLICY IF EXISTS "Authenticated users manage own collections" ON public.collections;
CREATE POLICY "Authenticated users manage own collections" ON public.collections
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow anyone to read collections by token (already existed in 003, kept for safety)
DROP POLICY IF EXISTS "Public read collections by token" ON public.collections;
CREATE POLICY "Public read collections by token" ON public.collections
  FOR SELECT USING (true);
