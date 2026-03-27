-- ============================================================
-- Zero-Latency — Admin Role Migration
-- Run this in the Supabase SQL Editor
-- Grants shahenmohdturki@gmail.com full control over all notes
-- ============================================================

-- 1. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can update own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can delete own notes" ON public.notes;

-- 2. Create Admin-Aware UPDATE policy
-- Allows owner OR admin (by email in JWT)
CREATE POLICY "Users can update own notes"
  ON public.notes
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = created_by
    OR (auth.jwt() ->> 'email') = 'shahenmohdturki@gmail.com'
  )
  WITH CHECK (
    auth.uid() = created_by
    OR (auth.jwt() ->> 'email') = 'shahenmohdturki@gmail.com'
  );

-- 3. Create Admin-Aware DELETE policy
-- Allows owner OR admin (by email in JWT)
CREATE POLICY "Users can delete own notes"
  ON public.notes
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = created_by
    OR (auth.jwt() ->> 'email') = 'shahenmohdturki@gmail.com'
  );

-- 4. Set replica identity so realtime DELETEs show the ID
ALTER TABLE public.notes REPLICA IDENTITY FULL;
