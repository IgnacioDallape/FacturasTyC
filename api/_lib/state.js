const FALLBACK_SUPABASE_URL = "https://zsjlzymxpnogghipjlaw.supabase.co";
const FALLBACK_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpzamx6eW14cG5vZ2doaXBqbGF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2NTE1MDAsImV4cCI6MjA5NTIyNzUwMH0.zeYWujxI8nFIB4mBWDCie6EP4ktR8SbhKWJB5fNBhCU";

const APP_STATE_ID = "facturastyc";
const IVA_RATE = 0.21;
const IVA_TOTAL_RATE = 1 + IVA_RATE;
const ARS_PER_USD = 1100;

export function handleOptions(req, res) {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }

  return false;
}

export function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export function sendJson(res, status, data) {
  setCorsHeaders(res);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(status).json(data);
}

export function getQuery(req) {
  const baseUrl = `http://${req.headers.host || "localhost"}`;
  return new URL(req.url, baseUrl).searchParams;
}

export async function loadAppState() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || FALLBACK_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY;

  const response = await fetch(
    `${supabaseUrl}/rest/v1/app_state?id=eq.${encodeURIComponent(APP_STATE_ID)}&select=data,updated_at`,
    {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    },
  );

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Supabase read failed: ${response.status} ${details}`);
  }

  const rows = await response.json();
  const row = rows[0];

  return {
    state: normalizeState(row?.data),
    updatedAt: row?.updated_at || null,
  };
}

export function normalizeState(state = {}) {
  return {
    profile: state.profile || { appName: "Facturas" },
    clients: Array.isArray(state.clients) ? state.clients : [],
    invoices: Array.isArray(state.invoices) ? state.invoices : [],
    unbilledTrips: Array.isArray(state.unbilledTrips) ? state.unbilledTrips : [],
    fiscalCredits: Array.isArray(state.fiscalCredits) ? state.fiscalCredits : [],
  };
}

export function buildApiPayload(state, updatedAt, month = getCurrentMonth()) {
  return {
    updatedAt,
    month,
    state,
    summary: buildSummary(state, month),
  };
}

export function buildSummary(state, month = getCurrentMonth()) {
  const clients = state.clients || [];
  const invoices = state.invoices || [];
  const unbilledTrips = state.unbilledTrips || [];
  const clientsById = Object.fromEntries(clients.map((client) => [client.id, client]));

  const clientsSummary = clients.map((client) => {
    const clientInvoices = invoices.filter((invoice) => invoice.clientId === client.id);
    const monthlyInvoices = clientInvoices.filter((invoice) => invoice.date?.startsWith(month));
    const unpaidInvoices = clientInvoices.filter((invoice) => !invoice.paid);
    const overdueInvoices = unpaidInvoices.filter(isOverdueInvoice);
    const clientTrips = unbilledTrips.filter((trip) => trip.clientId === client.id && !trip.billed);

    return {
      id: client.id,
      name: client.name,
      isMisc: isMiscClient(client),
      totalDue: sumAmounts(unpaidInvoices),
      overdueTotal: sumAmounts(overdueInvoices),
      monthTotal: sumAmounts(monthlyInvoices),
      monthVat: calculateIncludedVat(sumAmounts(monthlyInvoices)),
      pendingCount: overdueInvoices.length,
      totalInvoices: clientInvoices.length,
      unbilledTripsCount: clientTrips.length,
      unbilledTripsTotal: sumTripBillableAmounts(clientTrips, { [client.id]: client }),
    };
  });

  const pendingTrips = unbilledTrips.filter((trip) => !trip.billed);
  const totalMonthlyBilled = clientsSummary.reduce((sum, client) => sum + client.monthTotal, 0);
  const totalMonthlyVat = clientsSummary.reduce((sum, client) => sum + client.monthVat, 0);
  const totalUnpaid = clientsSummary.reduce((sum, client) => sum + client.totalDue, 0);
  const totalUnbilledTrips = sumTripBillableAmounts(pendingTrips, clientsById);

  return {
    totals: {
      totalUnpaid,
      totalUnpaidUsd: totalUnpaid / ARS_PER_USD,
      totalMonthlyBilled,
      totalMonthlyVat,
      totalUnbilledTrips,
      pendingTripsCount: pendingTrips.length,
    },
    clients: clientsSummary,
    unbilledClients: clientsSummary.filter((client) => client.unbilledTripsTotal > 0),
  };
}

export function filterByQuery(items, query) {
  let filteredItems = [...items];
  const clientId = query.get("clientId");
  const month = query.get("month");
  const paid = query.get("paid");
  const billed = query.get("billed");

  if (clientId) {
    filteredItems = filteredItems.filter((item) => item.clientId === clientId);
  }

  if (month) {
    filteredItems = filteredItems.filter((item) => item.date?.startsWith(month));
  }

  if (paid === "true" || paid === "false") {
    filteredItems = filteredItems.filter((item) => Boolean(item.paid) === (paid === "true"));
  }

  if (billed === "true" || billed === "false") {
    filteredItems = filteredItems.filter((item) => Boolean(item.billed) === (billed === "true"));
  }

  return filteredItems;
}

export function getCurrentMonth() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

function sumAmounts(items) {
  return items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
}

function getTripBillableAmount(trip, client) {
  const amount = Number(trip.amount || 0);
  return isMiscClient(client) ? amount : amount * IVA_TOTAL_RATE;
}

function sumTripBillableAmounts(trips, clientsById) {
  return trips.reduce((sum, trip) => sum + getTripBillableAmount(trip, clientsById[trip.clientId]), 0);
}

function calculateIncludedVat(totalWithVat) {
  return (Number(totalWithVat || 0) * IVA_RATE) / IVA_TOTAL_RATE;
}

function isOverdueInvoice(invoice) {
  if (invoice.paid || !invoice.date) return false;

  const invoiceDate = new Date(`${invoice.date}T00:00:00`);
  if (Number.isNaN(invoiceDate.getTime())) return false;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const elapsedDays = Math.floor((todayStart - invoiceDate) / 86400000);

  return elapsedDays >= 30;
}

function isMiscClient(client) {
  return Boolean(client?.isMisc) || slugify(client?.name || "") === "varios";
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
