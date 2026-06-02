import { getQuery, handleOptions, loadAppState, sendJson } from "./_lib/state.js";

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;

  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  try {
    const query = getQuery(req);
    const month = query.get("month");
    const { state, updatedAt } = await loadAppState();
    const fiscalCredits = month
      ? state.fiscalCredits.filter((credit) => credit.month === month)
      : state.fiscalCredits;

    sendJson(res, 200, {
      updatedAt,
      fiscalCredits,
    });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}
