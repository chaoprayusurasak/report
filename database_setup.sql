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

-- 9. Create department_officers table
CREATE TABLE IF NOT EXISTS public.department_officers (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  department_name TEXT NOT NULL,
  officer_name TEXT NOT NULL,
  line_user_id TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT department_officers_pkey PRIMARY KEY (id)
);

-- RLS policies for department_officers
ALTER TABLE public.department_officers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to department_officers for everyone" ON public.department_officers;
CREATE POLICY "Allow all access to department_officers for everyone" ON public.department_officers FOR ALL USING (true) WITH CHECK (true);

-- Seed test officers (using active LINE User IDs from reports)
INSERT INTO public.department_officers (department_name, officer_name, line_user_id)
VALUES 
  ('กองช่าง', 'นายช่างจิรายุ', 'U8e9335fa31ac0fca8fce249c6b399da8'),
  ('กองสาธารณสุข', 'เจ้าหน้าที่ภาคิไนย', 'U0aab1fa5ecc50aef944bb1500f8d088b')
ON CONFLICT DO NOTHING;

