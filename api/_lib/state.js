const FALLBACK_SUPABASE_URL = "https://fwggggazdqdrwfkbzgti.supabase.co";
const FALLBACK_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3Z2dnZ2F6ZHFkcndma2J6Z3RpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwNDEzODEsImV4cCI6MjA5NjYxNzM4MX0.rgOKACZjv2xpyBcuUTMVmtzt-iX43qeb9XKurjAFQvU";

const APP_STATE_ID = "facturastyc";
const IVA_RATE = 0.21;
const IVA_TOTAL_RATE = 1 + IVA_RATE;
const ARS_PER_USD = 1100;
const RELATIONAL_TABLES = {
  clients: "facturas_clients",
  invoices: "facturas_invoices",
  trips: "facturas_unbilled_trips",
  fiscalCredits: "facturas_fiscal_credits",
};

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
  const relationalState = await loadRelationalAppState(supabaseUrl, supabaseKey);

  if (relationalState) {
    const legacyState = await loadLegacyAppState(supabaseUrl, supabaseKey);
    return {
      ...relationalState,
      state: mergeInvoicePartialFields(relationalState.state, legacyState?.state),
    };
  }

  return loadLegacyAppState(supabaseUrl, supabaseKey);
}

async function loadLegacyAppState(supabaseUrl, supabaseKey) {
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

function mergeInvoicePartialFields(baseState, overlayState) {
  if (!baseState || !overlayState?.invoices?.length) return baseState;

  const overlayInvoicesById = new Map(overlayState.invoices.map((invoice) => [invoice.id, invoice]));

  return {
    ...baseState,
    invoices: (baseState.invoices || []).map((invoice) => {
      const overlayInvoice = overlayInvoicesById.get(invoice.id);
      if (!overlayInvoice) return invoice;
      const overlayPartialPaidAmount = Number(overlayInvoice.partialPaidAmount || 0);
      if (overlayPartialPaidAmount <= 0) return invoice;

      return {
        ...invoice,
        partialPaid: true,
        partialPaidAmount: overlayPartialPaidAmount,
      };
    }),
  };
}

async function loadRelationalAppState(supabaseUrl, supabaseKey) {
  const [clientsResponse, invoicesResponse, tripsResponse, fiscalCreditsResponse] = await Promise.all([
    fetchRest(supabaseUrl, supabaseKey, `${RELATIONAL_TABLES.clients}?select=*&order=name.asc`),
    fetchRest(supabaseUrl, supabaseKey, `${RELATIONAL_TABLES.invoices}?select=*&order=date.desc`),
    fetchRest(supabaseUrl, supabaseKey, `${RELATIONAL_TABLES.trips}?select=*&order=date.desc`),
    fetchRest(supabaseUrl, supabaseKey, `${RELATIONAL_TABLES.fiscalCredits}?select=*&order=month.desc`),
  ]);

  const responses = [clientsResponse, invoicesResponse, tripsResponse, fiscalCreditsResponse];
  const missingTable = responses.some((response) => response.status === 404);
  if (missingTable) return null;

  const failedResponse = responses.find((response) => !response.ok);
  if (failedResponse) {
    const details = await failedResponse.text();
    throw new Error(`Supabase relational read failed: ${failedResponse.status} ${details}`);
  }

  const [clients, invoices, unbilledTrips, fiscalCredits] = await Promise.all(
    responses.map((response) => response.json()),
  );

  if (!clients.length && !invoices.length && !unbilledTrips.length && !fiscalCredits.length) {
    return null;
  }

  const updatedAt = [
    ...clients,
    ...invoices,
    ...unbilledTrips,
    ...fiscalCredits,
  ].reduce((latest, item) => {
    if (!item.updated_at) return latest;
    if (!latest || item.updated_at > latest) return item.updated_at;
    return latest;
  }, null);

  return {
    state: normalizeState({
      profile: { appName: "Facturas" },
      clients: clients.map(fromClientRow),
      invoices: invoices.map(fromInvoiceRow),
      unbilledTrips: unbilledTrips.map(fromTripRow),
      fiscalCredits: fiscalCredits.map(fromFiscalCreditRow),
    }),
    updatedAt,
  };
}

function fetchRest(supabaseUrl, supabaseKey, path) {
  return fetch(`${supabaseUrl}/rest/v1/${path}`, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
  });
}

function fromClientRow(row) {
  return {
    id: row.id,
    name: row.name,
    isMisc: Boolean(row.is_misc),
    tripRates: row.trip_rates || {},
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
    partialPaid: Boolean(row.partial_paid),
    partialPaidAmount: Number(row.partial_paid_amount || 0),
    customerName: row.customer_name || "",
    cargoNumber: row.cargo_number || "",
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

function fromFiscalCreditRow(row) {
  return {
    id: row.id,
    month: row.month,
    amount: Number(row.amount || 0),
    percentage: Number(row.percentage || 100),
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
      totalDue: sumInvoiceBalances(unpaidInvoices),
      overdueTotal: sumInvoiceBalances(overdueInvoices),
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

function sumInvoiceBalances(invoices) {
  return invoices.reduce((sum, invoice) => sum + getInvoiceBalance(invoice), 0);
}

function getInvoiceBalance(invoice) {
  if (invoice?.paid) return 0;

  const amount = Number(invoice?.amount || 0);
  const partialPaidAmount = Number(invoice?.partialPaidAmount || 0);
  return Math.max(amount - partialPaidAmount, 0);
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
