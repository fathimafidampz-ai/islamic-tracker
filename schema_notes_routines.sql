-- SQL script to create notes and routines tables in Supabase.
-- Copy and paste this script into your Supabase Dashboard SQL Editor and click Run.

-- 1. Notes Table
CREATE TABLE IF NOT EXISTS public.notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT,
    content TEXT,
    color TEXT,
    is_pinned BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Enable RLS on Notes
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- Notes RLS Policies
CREATE POLICY "Users can view their own notes" 
ON public.notes FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own notes" 
ON public.notes FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notes" 
ON public.notes FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notes" 
ON public.notes FOR DELETE 
USING (auth.uid() = user_id);


-- 2. Routines Table
CREATE TABLE IF NOT EXISTS public.routines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    category TEXT,
    start_time TEXT,
    end_time TEXT,
    color TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Enable RLS on Routines
ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;

-- Routines RLS Policies
CREATE POLICY "Users can view their own routines" 
ON public.routines FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own routines" 
ON public.routines FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own routines" 
ON public.routines FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own routines" 
ON public.routines FOR DELETE 
USING (auth.uid() = user_id);


-- Create indexes for performance
CREATE INDEX IF NOT EXISTS notes_user_id_idx ON public.notes(user_id);
CREATE INDEX IF NOT EXISTS routines_user_id_idx ON public.routines(user_id);
