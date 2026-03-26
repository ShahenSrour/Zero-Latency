-- ============================================================
-- Zero-Latency — Fix Migration
-- Run this in the Supabase SQL Editor to fix the policy conflict
-- and enable real-time for the notes table
-- ============================================================

-- 1. Drop the old policy if it exists
DROP POLICY IF EXISTS "Authenticated users can read all notes" ON public.notes;
DROP POLICY IF EXISTS "Anyone can read all notes" ON public.notes;

-- 2. Recreate with public read access (guests can view, authenticated can write)
CREATE POLICY "Anyone can read all notes"
  ON public.notes
  FOR SELECT
  USING (true);

-- 3. Ensure realtime is enabled for notes
-- (If you get "already member" that's fine, it means it's already active)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notes;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 4. Enable replica identity so DELETE events include the row ID
ALTER TABLE public.notes REPLICA IDENTITY FULL;
