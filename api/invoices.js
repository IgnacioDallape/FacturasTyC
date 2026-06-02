import { filterByQuery, getQuery, handleOptions, loadAppState, sendJson } from "./_lib/state.js";

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;

  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  try {
    const query = getQuery(req);
    const { state, updatedAt } = await loadAppState();

    sendJson(res, 200, {
      updatedAt,
      invoices: filterByQuery(state.invoices, query),
    });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}
