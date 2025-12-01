-- Create tags table
CREATE TABLE IF NOT EXISTS public.tags (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    name text not null,
    created_at timestamptz not null default timezone('utc', now()),
    UNIQUE(user_id, name)
);

-- Create bookmark_tags junction table for N:N relationship
CREATE TABLE IF NOT EXISTS public.bookmark_tags (
    bookmark_id uuid not null references public.bookmarks (id) on delete cascade,
    tag_id uuid not null references public.tags (id) on delete cascade,
    created_at timestamptz not null default timezone('utc', now()),
    PRIMARY KEY (bookmark_id, tag_id)
);

-- Enable RLS on tags
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tags
CREATE POLICY "Users can read own tags" 
  ON public.tags 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tags" 
  ON public.tags 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tags" 
  ON public.tags 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tags" 
  ON public.tags 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Enable RLS on bookmark_tags
ALTER TABLE public.bookmark_tags ENABLE ROW LEVEL SECURITY;

-- RLS Policies for bookmark_tags
CREATE POLICY "Users can read own bookmark_tags" 
  ON public.bookmark_tags 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.bookmarks 
      WHERE bookmarks.id = bookmark_tags.bookmark_id 
      AND bookmarks.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own bookmark_tags" 
  ON public.bookmark_tags 
  FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bookmarks 
      WHERE bookmarks.id = bookmark_tags.bookmark_id 
      AND bookmarks.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own bookmark_tags" 
  ON public.bookmark_tags 
  FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM public.bookmarks 
      WHERE bookmarks.id = bookmark_tags.bookmark_id 
      AND bookmarks.user_id = auth.uid()
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS tags_user_id_idx ON public.tags (user_id);
CREATE INDEX IF NOT EXISTS tags_name_idx ON public.tags (name);
CREATE INDEX IF NOT EXISTS bookmark_tags_bookmark_id_idx ON public.bookmark_tags (bookmark_id);
CREATE INDEX IF NOT EXISTS bookmark_tags_tag_id_idx ON public.bookmark_tags (tag_id);

-- Migrate existing tags from bookmarks.tags array to new structure
DO $$
DECLARE
    bookmark_record RECORD;
    tag_name TEXT;
    tag_record RECORD;
BEGIN
    -- Loop through all bookmarks that have tags
    FOR bookmark_record IN 
        SELECT id, user_id, tags 
        FROM public.bookmarks 
        WHERE tags IS NOT NULL AND array_length(tags, 1) > 0
    LOOP
        -- Loop through each tag in the array
        FOREACH tag_name IN ARRAY bookmark_record.tags
        LOOP
            -- Insert tag if it doesn't exist (or get existing)
            INSERT INTO public.tags (user_id, name)
            VALUES (bookmark_record.user_id, tag_name)
            ON CONFLICT (user_id, name) DO NOTHING;
            
            -- Get the tag_id
            SELECT id INTO tag_record FROM public.tags 
            WHERE user_id = bookmark_record.user_id AND name = tag_name;
            
            -- Create the bookmark-tag relationship
            INSERT INTO public.bookmark_tags (bookmark_id, tag_id)
            VALUES (bookmark_record.id, tag_record.id)
            ON CONFLICT (bookmark_id, tag_id) DO NOTHING;
        END LOOP;
    END LOOP;
END $$;

-- Drop the old tags column from bookmarks
ALTER TABLE public.bookmarks DROP COLUMN IF EXISTS tags;
