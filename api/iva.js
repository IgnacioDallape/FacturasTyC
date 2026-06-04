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
    const summary = buildSummary(state, month);
    const fiscalCredits = state.fiscalCredits.filter((credit) => credit.month === month);
    const fiscalCredit = fiscalCredits.reduce((sum, credit) => {
      const percentage = Number(credit.percentage) === 40 ? 40 : 100;
      return sum + Number(credit.amount || 0) * (percentage / 100);
    }, 0);
    const fiscalDebit = summary.totals.totalMonthlyVat;

    sendJson(res, 200, {
      updatedAt,
      month,
      iva: {
        fiscalDebit,
        fiscalCredit,
        payable: fiscalDebit - fiscalCredit,
      },
      fiscalCredits,
    });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}
