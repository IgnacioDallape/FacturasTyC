import { buildApiPayload, getCurrentMonth, getQuery, handleOptions, loadAppState, setCorsHeaders } from "./_lib/state.js";

const DEFAULT_INTERVAL_MS = 2500;
const HEARTBEAT_MS = 15000;
const MAX_STREAM_MS = 55000;

export const config = {
  maxDuration: 60,
};

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;

  if (req.method !== "GET") {
    setCorsHeaders(res);
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const query = getQuery(req);
  const month = query.get("month") || getCurrentMonth();
  const intervalMs = clamp(Number(query.get("interval") || DEFAULT_INTERVAL_MS), 1000, 10000);
  let lastUpdatedAt = query.get("since") || "";
  let isClosed = false;
  let lastHeartbeat = Date.now();
  const startedAt = Date.now();

  setCorsHeaders(res);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  req.on("close", () => {
    isClosed = true;
  });

  res.write("retry: 3000\n\n");

  try {
    while (!isClosed && Date.now() - startedAt < MAX_STREAM_MS) {
      const { state, updatedAt } = await loadAppState();
      const shouldSendSnapshot = !lastUpdatedAt || updatedAt !== lastUpdatedAt;

      if (shouldSendSnapshot) {
        lastUpdatedAt = updatedAt || new Date().toISOString();
        writeEvent(res, "state", buildApiPayload(state, updatedAt, month));
      } else if (Date.now() - lastHeartbeat >= HEARTBEAT_MS) {
        lastHeartbeat = Date.now();
        res.write(`: heartbeat ${new Date().toISOString()}\n\n`);
      }

      await wait(intervalMs);
    }

    if (!isClosed) {
      writeEvent(res, "end", { reconnect: true, updatedAt: lastUpdatedAt });
      res.end();
    }
  } catch (error) {
    if (!isClosed) {
      writeEvent(res, "error", { error: error.message });
      res.end();
    }
  }
}

function writeEvent(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}
