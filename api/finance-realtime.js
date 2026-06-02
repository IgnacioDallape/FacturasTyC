import { streamFinanceRealtime } from "./_lib/finance.js";

export default async function handler(req, res) {
  return streamFinanceRealtime(req, res);
}
