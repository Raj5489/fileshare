-- ============================================================
-- Fix collection deletion: ensure files are never deleted
-- when their parent collection is removed.
-- ============================================================

-- Drop and re-add the FK with explicit ON DELETE SET NULL
-- (safe to re-run — drops old constraint first)
ALTER TABLE public.files
  DROP CONSTRAINT IF EXISTS files_collection_id_fkey;

ALTER TABLE public.files
  ADD CONSTRAINT files_collection_id_fkey
  FOREIGN KEY (collection_id)
  REFERENCES public.collections(id)
  ON DELETE SET NULL;
