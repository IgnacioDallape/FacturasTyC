import { createClient } from "@supabase/supabase-js";

const FALLBACK_SUPABASE_URL = "https://zsjlzymxpnogghipjlaw.supabase.co";
const FALLBACK_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpzamx6eW14cG5vZ2doaXBqbGF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2NTE1MDAsImV4cCI6MjA5NTIyNzUwMH0.zeYWujxI8nFIB4mBWDCie6EP4ktR8SbhKWJB5fNBhCU";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || FALLBACK_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

const APP_STATE_ID = "facturastyc";

export async function loadRemoteState() {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("app_state")
    .select("data")
    .eq("id", APP_STATE_ID)
    .maybeSingle();

  if (error) throw error;
  return data?.data || null;
}

export async function saveRemoteState(state) {
  if (!supabase) return;

  const { error } = await supabase.from("app_state").upsert({
    id: APP_STATE_ID,
    data: state,
    updated_at: new Date().toISOString(),
  });

  if (error) throw error;
}
