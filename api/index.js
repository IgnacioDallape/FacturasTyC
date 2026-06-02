import { handleOptions, sendJson } from "./_lib/state.js";

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;

  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  sendJson(res, 200, {
    name: "FacturasTyC API",
    realtime: "/api/realtime",
    endpoints: {
      state: "/api/state",
      clients: "/api/clients",
      invoices: "/api/invoices?clientId=CLIENT_ID&month=YYYY-MM&paid=false",
      trips: "/api/trips?clientId=CLIENT_ID&billed=false",
      fiscalCredits: "/api/fiscal-credits?month=YYYY-MM",
      iva: "/api/iva?month=YYYY-MM",
      summary: "/api/summary?month=YYYY-MM",
    },
  });
}
