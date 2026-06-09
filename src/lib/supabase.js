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

export async function saveRemoteState(state, previousState = null) {
  if (!supabase) return;

  const latestState = await loadRemoteState();
  const nextState = latestState && previousState
    ? mergeRemoteState(latestState, previousState, state)
    : state;

  await persistRemoteState(nextState);

  if (!previousState) return nextState;

  // Second pass: narrows the race window when two devices save almost together.
  await wait(350);
  const refreshedState = await loadRemoteState();
  const reconciledState = refreshedState
    ? mergeRemoteState(refreshedState, previousState, nextState)
    : nextState;

  await persistRemoteState(reconciledState);
  return reconciledState;
}

async function persistRemoteState(state) {
  const { error } = await supabase.from("app_state").upsert({
    id: APP_STATE_ID,
    data: state,
    updated_at: new Date().toISOString(),
  });

  if (error) throw error;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mergeRemoteState(remoteState, previousState, nextState) {
  return {
    ...remoteState,
    ...nextState,
    profile: nextState.profile || remoteState.profile,
    clients: mergeCollectionById(remoteState.clients, previousState.clients, nextState.clients),
    invoices: mergeCollectionById(remoteState.invoices, previousState.invoices, nextState.invoices),
    unbilledTrips: mergeCollectionById(remoteState.unbilledTrips, previousState.unbilledTrips, nextState.unbilledTrips),
    fiscalCredits: mergeCollectionById(remoteState.fiscalCredits, previousState.fiscalCredits, nextState.fiscalCredits),
  };
}

function mergeCollectionById(remoteItems = [], previousItems = [], nextItems = []) {
  const merged = new Map();
  const previousIds = new Set(previousItems.map((item) => item.id));
  const nextIds = new Set(nextItems.map((item) => item.id));
  const deletedIds = new Set([...previousIds].filter((id) => !nextIds.has(id)));

  remoteItems.forEach((item) => {
    if (item?.id && !deletedIds.has(item.id)) {
      merged.set(item.id, item);
    }
  });

  nextItems.forEach((item) => {
    if (item?.id) {
      merged.set(item.id, item);
    }
  });

  return [...merged.values()];
}
