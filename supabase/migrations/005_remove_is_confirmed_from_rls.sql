-- Remove is_confirmed from the public read policy.
-- The confirm step was causing "file not found" bugs.
-- Incomplete uploads are cleaned up by the cron job after 1 hour instead.

DROP POLICY IF EXISTS "Public read by token" ON public.files;
CREATE POLICY "Public read by token" ON public.files
  FOR SELECT USING (
    is_deleted = FALSE
    AND (expires_at IS NULL OR expires_at > NOW())
    AND scan_status != 'infected'
  );
