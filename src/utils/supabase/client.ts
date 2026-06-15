import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    `Supabase env vars missing. URL="${supabaseUrl}" KEY="${supabaseAnonKey ? '[set]' : '[empty]'}"`
  );
}

export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
