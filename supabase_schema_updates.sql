-- Add sharing fields to gallery table
ALTER TABLE public.gallery
ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS is_shared BOOLEAN DEFAULT FALSE;

-- Create index for share_token lookup
CREATE INDEX IF NOT EXISTS gallery_share_token_idx ON public.gallery(share_token) WHERE share_token IS NOT NULL;

-- Update RLS policy to allow public viewing of shared designs
DROP POLICY IF EXISTS "Public can view shared gallery items" ON public.gallery;
CREATE POLICY "Public can view shared gallery items"
  ON public.gallery FOR SELECT
  USING (is_shared = TRUE);

-- Allow users to update their own designs to make them shared/unshared
DROP POLICY IF EXISTS "Users can update own gallery items" ON public.gallery;
CREATE POLICY "Users can update own gallery items"
  ON public.gallery FOR UPDATE
  USING (auth.uid() = user_id);

-- Function to generate a unique share token
CREATE OR REPLACE FUNCTION generate_share_token()
RETURNS TEXT AS $$
DECLARE
  token TEXT;
  exists_check BOOLEAN;
BEGIN
  LOOP
    -- Generate a random token (32 characters, alphanumeric)
    token := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 16));
    
    -- Check if token already exists
    SELECT EXISTS(SELECT 1 FROM public.gallery WHERE share_token = token) INTO exists_check;
    
    -- If token doesn't exist, exit loop
    EXIT WHEN NOT exists_check;
  END LOOP;
  
  RETURN token;
END;
$$ LANGUAGE plpgsql;

