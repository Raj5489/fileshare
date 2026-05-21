ALTER TABLE public.files
  ADD COLUMN IF NOT EXISTS is_confirmed BOOLEAN NOT NULL DEFAULT FALSE;

-- Existing files (already uploaded) should be treated as confirmed
UPDATE public.files SET is_confirmed = TRUE WHERE is_confirmed = FALSE;

-- Update the public read policy to also require is_confirmed
DROP POLICY IF EXISTS "Public read by token" ON public.files;
CREATE POLICY "Public read by token" ON public.files
  FOR SELECT USING (
    is_deleted = FALSE
    AND is_confirmed = TRUE
    AND (expires_at IS NULL OR expires_at > NOW())
    AND scan_status != 'infected'
  );
