-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create the reports table with UUID as Primary Key
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE NULL DEFAULT now(),
  reference_id TEXT NULL,
  reporter_name TEXT NULL,
  reporter_phone TEXT NULL,
  reporter_address TEXT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  location_name TEXT NULL,
  latitude DOUBLE PRECISION NULL,
  longitude DOUBLE PRECISION NULL,
  image_urls TEXT[] NULL,
  status TEXT NULL DEFAULT 'รอดำเนินการ'::TEXT,
  reporter_email TEXT NULL,
  reporter_facebook TEXT NULL,
  reporter_line_id TEXT NULL,
  responsible_department TEXT NULL,
  CONSTRAINT reports_pkey PRIMARY KEY (id)
);

-- 3. Create the user_sessions table for managing chatbot states
CREATE TABLE IF NOT EXISTS public.user_sessions (
  line_user_id TEXT NOT NULL,
  current_step TEXT NOT NULL DEFAULT 'ask_location'::TEXT,
  temp_data JSONB NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMP WITH TIME ZONE NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NULL DEFAULT now(),
  CONSTRAINT user_sessions_pkey PRIMARY KEY (line_user_id)
);

-- 4. Enable Row Level Security (RLS) on both tables
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- 5. Drop any conflicting existing policies
DROP POLICY IF EXISTS "Allow select for everyone" ON public.reports;
DROP POLICY IF EXISTS "Allow insert for everyone" ON public.reports;
DROP POLICY IF EXISTS "Allow update for authenticated users only" ON public.reports;
DROP POLICY IF EXISTS "Allow delete for authenticated users only" ON public.reports;
DROP POLICY IF EXISTS "Allow all access to user_sessions for everyone" ON public.user_sessions;

-- 6. Create RLS Policies for reports table
CREATE POLICY "Allow select for everyone" ON public.reports FOR SELECT USING (true);
CREATE POLICY "Allow insert for everyone" ON public.reports FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update for authenticated users only" ON public.reports FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete for authenticated users only" ON public.reports FOR DELETE TO authenticated USING (true);

-- 7. Create RLS Policies for user_sessions table (accessible by backend service role or webhook)
CREATE POLICY "Allow all access to user_sessions for everyone" ON public.user_sessions FOR ALL USING (true) WITH CHECK (true);

-- 8. Add rating column to reports table if it doesn't exist
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS rating INT;
