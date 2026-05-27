-- ============================================================
-- Atomic download count increment to prevent race conditions
-- when multiple simultaneous downloads hit the same file.
-- ============================================================

CREATE OR REPLACE FUNCTION increment_download_count(file_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.files
  SET download_count = download_count + 1,
      updated_at = NOW()
  WHERE id = file_id;
$$;
