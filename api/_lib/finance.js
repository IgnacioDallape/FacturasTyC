import { createHash } from "node:crypto";
import { getCurrentMonth, getQuery, handleOptions, sendJson, setCorsHeaders } from "./state.js";

const FALLBACK_SUPABASE_URL = "https://eqenqgrqvjithlayrezv.supabase.co";
const FALLBACK_SUPABASE_ANON_KEY = "sb_publishable_Qom4VOOQvZiFqvSXmT8pmw_Y2gqm_7l";
const FINANCE_APP_NAME = "flujo_data";
const FALLBACK_FINANCE_EMAIL = "nachodallape2@gmail.com";
const FALLBACK_FINANCE_PASSWORD = "101010";

export async function loadFinanceState(email = FALLBACK_FINANCE_EMAIL) {
  const supabaseUrl = process.env.FINANCE_SUPABASE_URL || FALLBACK_SUPABASE_URL;
  const supabaseKey = process.env.FINANCE_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY;
  const userId = await resolveFinanceUserId(supabaseUrl, supabaseKey, email.toLowerCase());

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/get_user_app_state`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({
      p_user_id: userId,
      p_app_name: FINANCE_APP_NAME,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Finance read failed: ${response.status} ${details}`);
  }

  const payload = await response.json();
  const state = normalizeFinanceState(payload);

  return {
    state,
    updatedAt: state.updatedAt || new Date().toISOString(),
  };
}

async function resolveFinanceUserId(supabaseUrl, supabaseKey, email) {
  const passwordHash = hashString(FALLBACK_FINANCE_PASSWORD);

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/login_user`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        p_email: email,
        p_password_hash: passwordHash,
      }),
    });

    if (response.ok) {
      const payload = await response.json();
      const resolved = payload?.id || payload?.user_id || payload?.supabaseId || payload?.storage_id;
      if (resolved) return resolved;
    }
  } catch (error) {
    // Ignore and fallback below.
  }

  return deterministicUUID(email);
}

export function buildFinanceSummary(state, month = getCurrentMonth()) {
  const cobros = Array.isArray(state.cobros) ? state.cobros : [];
  const pendingCobros = cobros.filter((cobro) => !cobro?.cobrado);
  const pendingThisMonth = pendingCobros.filter((cobro) => getAccreditationDate(cobro).startsWith(month));

  return {
    chequesEnCartera: {
      amount: pendingCobros.reduce((sum, cobro) => sum + Number(cobro?.monto || 0), 0),
      count: pendingCobros.length,
      monthAmount: pendingThisMonth.reduce((sum, cobro) => sum + Number(cobro?.monto || 0), 0),
      monthCount: pendingThisMonth.length,
    },
  };
}

export function buildFinancePayload(state, updatedAt, month = getCurrentMonth()) {
  return {
    updatedAt,
    month,
    finance: state,
    summary: buildFinanceSummary(state, month),
  };
}

export function normalizeFinanceState(rawState) {
  let payload = rawState ?? {};

  if (
    payload &&
    typeof payload === "object" &&
    !Array.isArray(payload) &&
    "data" in payload &&
    payload.data &&
    typeof payload.data === "object" &&
    !("cobros" in payload)
  ) {
    payload = payload.data;
  }

  return {
    disponible: Number(payload?.disponible || 0),
    cobros: Array.isArray(payload?.cobros) ? payload.cobros : [],
    pagos: Array.isArray(payload?.pagos) ? payload.pagos : [],
    updatedAt: payload?.updated_at || payload?.updatedAt || null,
  };
}

export function financeRealtimeConfig() {
  return {
    defaultIntervalMs: 2500,
    heartbeatMs: 15000,
    maxStreamMs: 55000,
  };
}

export async function streamFinanceRealtime(req, res) {
  if (handleOptions(req, res)) return true;

  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Method not allowed" });
    return true;
  }

  const { defaultIntervalMs, heartbeatMs, maxStreamMs } = financeRealtimeConfig();
  const query = getQuery(req);
  const month = query.get("month") || getCurrentMonth();
  const email = query.get("email") || FALLBACK_FINANCE_EMAIL;
  const intervalMs = clamp(Number(query.get("interval") || defaultIntervalMs), 1000, 10000);
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
    while (!isClosed && Date.now() - startedAt < maxStreamMs) {
      const { state, updatedAt } = await loadFinanceState(email);
      const nextUpdatedAt = updatedAt || new Date().toISOString();

      if (!lastUpdatedAt || nextUpdatedAt !== lastUpdatedAt) {
        lastUpdatedAt = nextUpdatedAt;
        writeEvent(res, "finance", buildFinancePayload(state, nextUpdatedAt, month));
      } else if (Date.now() - lastHeartbeat >= heartbeatMs) {
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

  return true;
}

function deterministicUUID(seed) {
  const hash = hashString(`fleet_uuid_v1_${seed}`);
  return [hash.slice(0, 8), hash.slice(8, 12), `4${hash.slice(13, 16)}`, hash.slice(16, 20), hash.slice(20, 32)].join("-");
}

function hashString(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function getAccreditationDate(cobro) {
  return String(cobro?.fechaAcreditacion || cobro?.fechaColocada || cobro?.fecha || "").slice(0, 10);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

function writeEvent(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}
