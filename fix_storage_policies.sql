-- Fix Storage Policies for Gallery Bucket
-- Run this in your Supabase SQL Editor

-- Note: Storage policies must be created via SQL
-- The storage.objects table is a view, not a regular table

-- Policy 1: Allow users to upload files to their own folder
CREATE POLICY "Users can upload to their folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'gallery' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 2: Allow users to read their own files
CREATE POLICY "Users can read their files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'gallery' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 3: Allow public read access (for displaying thumbnails)
CREATE POLICY "Public can view gallery images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'gallery');

-- Policy 4: Allow users to update their files
CREATE POLICY "Users can update their files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'gallery' AND 
  (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'gallery' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 5: Allow users to delete their files
CREATE POLICY "Users can delete their files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'gallery' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

