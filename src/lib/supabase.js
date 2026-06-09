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
const RELATIONAL_TABLES = {
  clients: "facturas_clients",
  invoices: "facturas_invoices",
  trips: "facturas_unbilled_trips",
  fiscalCredits: "facturas_fiscal_credits",
};

export async function loadRemoteState() {
  if (!supabase) return null;

  const relationalState = await loadRelationalState();
  if (relationalState) return relationalState;

  return loadLegacyState();
}

export async function saveRemoteState(state, previousState = null) {
  if (!supabase) return;

  const relationalState = await saveRelationalState(state, previousState);
  if (relationalState) return relationalState;

  return saveLegacyState(state, previousState);
}

async function loadLegacyState() {
  const { data, error } = await supabase
    .from("app_state")
    .select("data")
    .eq("id", APP_STATE_ID)
    .maybeSingle();

  if (error) throw error;
  return data?.data || null;
}

async function saveLegacyState(state, previousState = null) {
  const latestState = await loadLegacyState();
  const nextState = latestState && previousState
    ? mergeRemoteState(latestState, previousState, state)
    : state;

  await persistRemoteState(nextState);

  if (!previousState) return nextState;

  // Second pass: narrows the race window when two devices save almost together.
  await wait(350);
  const refreshedState = await loadLegacyState();
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

async function loadRelationalState() {
  const clientsResult = await supabase
    .from(RELATIONAL_TABLES.clients)
    .select("*")
    .order("name", { ascending: true });

  if (isMissingRelationError(clientsResult.error)) return null;
  if (clientsResult.error) throw clientsResult.error;

  const [invoicesResult, tripsResult, fiscalCreditsResult] = await Promise.all([
    supabase.from(RELATIONAL_TABLES.invoices).select("*").order("date", { ascending: false }),
    supabase.from(RELATIONAL_TABLES.trips).select("*").order("date", { ascending: false }),
    supabase.from(RELATIONAL_TABLES.fiscalCredits).select("*").order("month", { ascending: false }),
  ]);

  const results = [invoicesResult, tripsResult, fiscalCreditsResult];
  const missingRelation = results.find((result) => isMissingRelationError(result.error));
  if (missingRelation) return null;

  const errorResult = results.find((result) => result.error);
  if (errorResult) throw errorResult.error;

  const clients = clientsResult.data || [];
  const invoices = invoicesResult.data || [];
  const unbilledTrips = tripsResult.data || [];
  const fiscalCredits = fiscalCreditsResult.data || [];

  if (!clients.length && !invoices.length && !unbilledTrips.length && !fiscalCredits.length) {
    return null;
  }

  return {
    profile: { appName: "Facturas" },
    clients: clients.map(fromClientRow),
    invoices: invoices.map(fromInvoiceRow),
    unbilledTrips: unbilledTrips.map(fromTripRow),
    fiscalCredits: fiscalCredits.map(fromFiscalCreditRow),
  };
}

async function saveRelationalState(state, previousState = null) {
  const hasRelationalTables = await relationalTablesAreReady();
  if (!hasRelationalTables) return null;

  const normalizedState = normalizeStateShape(state);
  const normalizedPreviousState = previousState ? normalizeStateShape(previousState) : null;

  await persistRelationalCollection(
    RELATIONAL_TABLES.clients,
    normalizedState.clients,
    normalizedPreviousState?.clients,
    toClientRow,
  );

  await Promise.all([
    persistRelationalCollection(
      RELATIONAL_TABLES.invoices,
      normalizedState.invoices,
      normalizedPreviousState?.invoices,
      toInvoiceRow,
    ),
    persistRelationalCollection(
      RELATIONAL_TABLES.trips,
      normalizedState.unbilledTrips,
      normalizedPreviousState?.unbilledTrips,
      toTripRow,
    ),
    persistRelationalCollection(
      RELATIONAL_TABLES.fiscalCredits,
      normalizedState.fiscalCredits,
      normalizedPreviousState?.fiscalCredits,
      toFiscalCreditRow,
    ),
  ]);

  return loadRelationalState();
}

async function relationalTablesAreReady() {
  const results = await Promise.all(
    Object.values(RELATIONAL_TABLES).map((table) =>
      supabase
        .from(table)
        .select("id")
        .limit(1),
    ),
  );

  const missingRelation = results.find((result) => isMissingRelationError(result.error));
  if (missingRelation) return false;

  const errorResult = results.find((result) => result.error);
  if (errorResult) throw errorResult.error;

  return true;
}

async function persistRelationalCollection(table, items = [], previousItems = [], mapper) {
  const rows = items
    .filter((item) => item?.id)
    .map(mapper);

  if (rows.length) {
    const { error } = await supabase.from(table).upsert(rows, { onConflict: "id" });
    if (error) throw error;
  }

  await deleteRemovedRows(table, previousItems, items);
}

async function deleteRemovedRows(table, previousItems = [], nextItems = []) {
  if (!previousItems.length) return;

  const nextIds = new Set(nextItems.map((item) => item?.id).filter(Boolean));
  const removedIds = previousItems
    .map((item) => item?.id)
    .filter((id) => id && !nextIds.has(id));

  if (!removedIds.length) return;

  const { error } = await supabase.from(table).delete().in("id", removedIds);
  if (error) throw error;
}

function normalizeStateShape(state = {}) {
  return {
    profile: state.profile || { appName: "Facturas" },
    clients: Array.isArray(state.clients) ? state.clients : [],
    invoices: Array.isArray(state.invoices) ? state.invoices : [],
    unbilledTrips: Array.isArray(state.unbilledTrips) ? state.unbilledTrips : [],
    fiscalCredits: Array.isArray(state.fiscalCredits) ? state.fiscalCredits : [],
  };
}

function fromClientRow(row) {
  return {
    id: row.id,
    name: row.name,
    isMisc: Boolean(row.is_misc),
    tripRates: row.trip_rates || {},
  };
}

function toClientRow(client) {
  return {
    id: client.id,
    name: client.name || "Sin nombre",
    is_misc: Boolean(client.isMisc),
    trip_rates: client.tripRates || {},
  };
}

function fromInvoiceRow(row) {
  return {
    id: row.id,
    clientId: row.client_id,
    invoiceNumber: row.invoice_number || "",
    date: row.date,
    amount: Number(row.amount || 0),
    paid: Boolean(row.paid),
    customerName: row.customer_name || "",
    cargoNumber: row.cargo_number || "",
  };
}

function toInvoiceRow(invoice) {
  return {
    id: invoice.id,
    client_id: invoice.clientId,
    invoice_number: invoice.invoiceNumber || "",
    date: invoice.date,
    amount: Number(invoice.amount || 0),
    paid: Boolean(invoice.paid),
    customer_name: invoice.customerName || "",
    cargo_number: invoice.cargoNumber || "",
  };
}

function fromTripRow(row) {
  return {
    id: row.id,
    clientId: row.client_id,
    customerName: row.customer_name || "",
    date: row.date,
    route: row.route || "",
    amount: Number(row.amount || 0),
    note: row.note || "",
    billed: Boolean(row.billed),
  };
}

function toTripRow(trip) {
  return {
    id: trip.id,
    client_id: trip.clientId,
    customer_name: trip.customerName || "",
    date: trip.date,
    route: trip.route || "",
    amount: Number(trip.amount || 0),
    note: trip.note || "",
    billed: Boolean(trip.billed),
  };
}

function fromFiscalCreditRow(row) {
  return {
    id: row.id,
    month: row.month,
    amount: Number(row.amount || 0),
    percentage: Number(row.percentage || 100),
  };
}

function toFiscalCreditRow(credit) {
  return {
    id: credit.id,
    month: credit.month,
    amount: Number(credit.amount || 0),
    percentage: Number(credit.percentage || 100),
  };
}

function isMissingRelationError(error) {
  if (!error) return false;

  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /does not exist|Could not find the table|schema cache/i.test(error.message || "")
  );
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
