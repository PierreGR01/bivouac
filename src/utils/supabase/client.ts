import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://fdzcdmyehllqvofysgdf.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkemNkbXllaGxscXZvZnlzZ2RmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyNzYwMDksImV4cCI6MjA4NTg1MjAwOX0.8vWjNpZiWtKTOY6mmUhfsTOik69nc0iiD0FRysjoFX0';

if (supabaseAnonKey === 'placeholder-key-set-vite-supabase-anon-key') {
  console.warn(
    'Warning: VITE_SUPABASE_ANON_KEY environment variable is not set. ' +
    'Please create a .env.local file with your Supabase credentials. ' +
    'See .env.example for the format.'
  );
}

export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
