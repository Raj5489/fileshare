-- Drop and fully recreate the trigger function so PostgreSQL recompiles it
-- with the new is_confirmed column. CREATE OR REPLACE alone may use a cached plan.

DROP TRIGGER IF EXISTS on_file_change ON public.files;
DROP FUNCTION IF EXISTS update_profile_stats();

CREATE OR REPLACE FUNCTION update_profile_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Count the file when it gets confirmed (is_confirmed: false -> true)
  IF TG_OP = 'UPDATE'
     AND OLD.is_confirmed = FALSE
     AND NEW.is_confirmed = TRUE
     AND NEW.is_deleted = FALSE THEN
    UPDATE public.profiles
    SET storage_used = storage_used + NEW.file_size,
        file_count   = file_count + 1
    WHERE id = NEW.user_id;

  -- Uncount when soft-deleted (only if it was confirmed)
  ELSIF TG_OP = 'UPDATE'
     AND OLD.is_deleted = FALSE
     AND NEW.is_deleted = TRUE
     AND OLD.is_confirmed = TRUE THEN
    UPDATE public.profiles
    SET storage_used = GREATEST(storage_used - OLD.file_size, 0),
        file_count   = GREATEST(file_count - 1, 0)
    WHERE id = OLD.user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_file_change
  AFTER INSERT OR UPDATE ON public.files
  FOR EACH ROW EXECUTE FUNCTION update_profile_stats();
