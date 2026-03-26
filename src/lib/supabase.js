import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Validate that the URL looks like a real Supabase URL
const isConfigured =
  supabaseUrl.startsWith('http') && supabaseAnonKey.length > 10;

// Create client — if not configured, use a dummy URL that will fail gracefully on API calls
export const supabase = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export function isSupabaseConfigured() {
  return isConfigured;
}
