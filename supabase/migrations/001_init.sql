-- ============================================================
-- FileShare Database Schema
-- Run this in Supabase SQL Editor (safe to re-run)
-- ============================================================

-- 1. Profiles table (extends Supabase Auth users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT,
  username    TEXT UNIQUE,
  storage_used BIGINT DEFAULT 0,
  file_count  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 2. Files table
CREATE TABLE IF NOT EXISTS public.files (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  share_token     TEXT UNIQUE NOT NULL,
  original_name   TEXT NOT NULL,
  storage_key     TEXT NOT NULL,
  mime_type       TEXT NOT NULL,
  file_size       BIGINT NOT NULL,
  download_count  INTEGER DEFAULT 0,
  max_downloads   INTEGER,
  password_hash   TEXT,
  expires_at      TIMESTAMPTZ,
  is_deleted      BOOLEAN DEFAULT FALSE,
  scan_status     TEXT DEFAULT 'pending',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_files_token ON public.files(share_token);
CREATE INDEX IF NOT EXISTS idx_files_user  ON public.files(user_id);
CREATE INDEX IF NOT EXISTS idx_files_expires ON public.files(expires_at) WHERE expires_at IS NOT NULL;

-- 3. Auto-update profile stats trigger
CREATE OR REPLACE FUNCTION update_profile_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.is_deleted = FALSE THEN
    UPDATE public.profiles
    SET storage_used = storage_used + NEW.file_size,
        file_count = file_count + 1
    WHERE id = NEW.user_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.is_deleted = FALSE AND NEW.is_deleted = TRUE THEN
    UPDATE public.profiles
    SET storage_used = GREATEST(storage_used - OLD.file_size, 0),
        file_count = GREATEST(file_count - 1, 0)
    WHERE id = OLD.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_file_change ON public.files;
CREATE TRIGGER on_file_change
  AFTER INSERT OR UPDATE ON public.files
  FOR EACH ROW EXECUTE FUNCTION update_profile_stats();

-- 4. Row Level Security (RLS)
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read by token" ON public.files;
CREATE POLICY "Public read by token" ON public.files
  FOR SELECT USING (
    is_deleted = FALSE
    AND (expires_at IS NULL OR expires_at > NOW())
    AND scan_status != 'infected'
  );

DROP POLICY IF EXISTS "Users manage own files" ON public.files;
CREATE POLICY "Users manage own files" ON public.files
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Profiles RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable" ON public.profiles;
CREATE POLICY "Public profiles are viewable" ON public.profiles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);
