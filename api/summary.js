import { buildSummary, getCurrentMonth, getQuery, handleOptions, loadAppState, sendJson } from "./_lib/state.js";

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;

  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  try {
    const query = getQuery(req);
    const month = query.get("month") || getCurrentMonth();
    const { state, updatedAt } = await loadAppState();

    sendJson(res, 200, {
      updatedAt,
      month,
      summary: buildSummary(state, month),
    });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}
