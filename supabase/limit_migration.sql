-- ============================================================
-- Zero-Latency — Note Limit Trigger
-- Run this in the Supabase SQL Editor
-- Enforces a maximum of 3 notes per user at the database level
-- ============================================================

CREATE OR REPLACE FUNCTION check_note_limit()
RETURNS TRIGGER AS $$
DECLARE
  note_count INT;
  admin_email TEXT;
BEGIN
  -- Get the admin email from the environment/JWT (if applicable) or hardcode if needed
  -- Since triggers don't easily read NEXT_PUBLIC environment variables, we do a basic check
  
  -- Count how many notes this exact user already has
  SELECT count(*) INTO note_count FROM public.notes WHERE created_by = NEW.created_by;

  -- If they have 3 or more notes, and they aren't the admin, reject the insert
  -- Replace 'shahenmohdturki@gmail.com' with your actual admin email if you want the admin exempt
  IF note_count >= 3 AND (auth.jwt() ->> 'email') != 'shahenmohdturki@gmail.com' THEN
    RAISE EXCEPTION 'User has reached the maximum limit of 3 active notes.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the trigger if it already exists so we can recreate it cleanly
DROP TRIGGER IF EXISTS enforce_note_limit ON public.notes;

-- Create the trigger to run BEFORE INSERT
CREATE TRIGGER enforce_note_limit
  BEFORE INSERT ON public.notes
  FOR EACH ROW
  EXECUTE FUNCTION check_note_limit();
