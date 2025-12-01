-- Remove note column from bookmarks as notes are now a separate entity
ALTER TABLE public.bookmarks DROP COLUMN IF EXISTS note;

-- Create notes table
CREATE TABLE IF NOT EXISTS public.notes (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    title text not null,
    body text not null,
    bookmark_ids uuid[] not null default '{}',
    status text not null default 'draft', -- 'draft', 'exporting', 'exported', 'failed'
    export_url text,
    drive_file_id text,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

-- Add updated_at trigger for notes
DROP TRIGGER IF EXISTS set_notes_updated_at ON public.notes;
CREATE TRIGGER set_notes_updated_at
BEFORE UPDATE ON public.notes
FOR EACH ROW
EXECUTE PROCEDURE public.handle_updated_at();

-- Enable RLS
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can read own notes" 
  ON public.notes 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notes" 
  ON public.notes 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notes" 
  ON public.notes 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notes" 
  ON public.notes 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS notes_user_created_at_idx ON public.notes (user_id, created_at desc);
