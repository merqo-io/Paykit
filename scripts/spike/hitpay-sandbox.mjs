#!/usr/bin/env node
// Throwaway probe for the HitPay sandbox (bank auto detect spec, P6.1). Not
// part of the app; see README.md beside it. Reads HITPAY_SANDBOX_API_KEY and
// HITPAY_WEBHOOK_SALT from the shell and refuses any host but a sandbox.
import { createHmac, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";

const API_BASE =
  process.env.HITPAY_API_BASE ?? "https://api.sandbox.hit-pay.com/v1";

function requireSandbox() {
  const host = new URL(API_BASE).hostname;
  if (!host.includes("sandbox"))
    throw new Error(`Refusing ${host}: this probe only talks to a sandbox.`);
}

function apiKey() {
  const key = process.env.HITPAY_SANDBOX_API_KEY;
  if (!key) throw new Error("Set HITPAY_SANDBOX_API_KEY in your shell first.");
  return key;
}

async function api(method, path, body) {
  requireSandbox();
  const started = Date.now();
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "X-BUSINESS-API-KEY": apiKey(),
      "X-Requested-With": "XMLHttpRequest",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // Left as text: an HTML error page is itself a finding.
  }
  return { status: res.status, ms: Date.now() - started, json, text };
}

/** Splits an EMVCo string into its top-level and nested id/value pairs. */
export function parseTlv(payload) {
  const out = {};
  let i = 0;
  while (i + 4 <= payload.length) {
    const id = payload.slice(i, i + 2);
    const len = Number(payload.slice(i + 2, i + 4));
    if (!Number.isInteger(len)) break;
    out[id] = payload.slice(i + 4, i + 4 + len);
    i += 4 + len;
  }
  return out;
}

function describeQr(qr) {
  if (!qr || !qr.startsWith("0002")) {
    console.log("  qr_code is not an EMVCo payload:", qr);
    return;
  }
  const top = parseTlv(qr);
  const merchant = parseTlv(top["26"] ?? "");
  const extra = parseTlv(top["62"] ?? "");
  console.log("  payee name the QR carries (59):", top["59"]);
  console.log("  PayNow proxy (26/02):", merchant["02"]);
  console.log("  amount editable flag (26/03):", merchant["03"]);
  console.log(
    "  expiry inside the QR (26/04, yyyymmddhhmmss):",
    merchant["04"],
  );
  console.log("  bill reference the QR carries (62/01):", extra["01"]);
}

/** HMAC-SHA256 of the raw body with the endpoint's salt, constant-time. */
export function signatureMatches(rawBody, salt, signature) {
  const expected = createHmac("sha256", salt).update(rawBody).digest("hex");
  const given = Buffer.from(String(signature ?? ""), "utf8");
  const want = Buffer.from(expected, "utf8");
  return given.length === want.length && timingSafeEqual(given, want);
}

function salt() {
  const value = process.env.HITPAY_WEBHOOK_SALT;
  if (!value) throw new Error("Set HITPAY_WEBHOOK_SALT in your shell first.");
  return value;
}

async function create(amount, minutes) {
  const reference = `pk-spike-${Date.now()}`;
  const body = {
    amount,
    currency: "sgd",
    payment_methods: ["paynow_online"],
    generate_qr: true,
    reference_number: reference,
  };
  // Undocumented for QR requests; sent to learn whether it is honoured.
  if (minutes) {
    body.expiry_date = new Date(Date.now() + Number(minutes) * 60_000)
      .toISOString()
      .slice(0, 19)
      .replace("T", " ");
  }
  const res = await api("POST", "/payment-requests", body);
  console.log(`POST /payment-requests -> ${res.status} in ${res.ms} ms`);
  if (!res.json) return console.log(res.text.slice(0, 500));
  const r = res.json;
  console.log("  id:", r.id);
  console.log("  status:", r.status);
  console.log(
    "  reference_number sent / returned:",
    reference,
    "/",
    r.reference_number,
  );
  console.log(
    "  expiry_date sent / returned:",
    body.expiry_date ?? "(none)",
    "/",
    r.expiry_date,
  );
  console.log("  qr_code_expiry:", r.qr_code_data?.qr_code_expiry);
  console.log("  created_at:", r.created_at);
  describeQr(r.qr_code_data?.qr_code);
  console.log("  checkout url (pay it here in sandbox):", r.url);
  console.log(
    "\nNext: pay it, then run `status",
    r.id + "` and watch `listen`.",
  );
}

async function status(id) {
  const res = await api("GET", `/payment-requests/${encodeURIComponent(id)}`);
  console.log(`GET /payment-requests/{id} -> ${res.status} in ${res.ms} ms`);
  if (!res.json) return console.log(res.text.slice(0, 500));
  const r = res.json;
  console.log("  status:", r.status);
  console.log("  amount / currency:", r.amount, r.currency);
  console.log("  reference_number:", r.reference_number);
  for (const p of r.payments ?? [])
    console.log(
      "  payment:",
      p.id,
      p.status,
      p.amount,
      p.payment_type,
      "fees",
      p.fees,
    );
}

function verify(file, signature) {
  const raw = readFileSync(file);
  console.log(
    signatureMatches(raw, salt(), signature)
      ? "signature OK"
      : "signature MISMATCH",
  );
}

/** Logs every delivery: arrival time, headers, raw body, signature result.
 *  Expose the port with a tunnel of your choice and register that URL as a
 *  sandbox webhook endpoint for `payment_request.completed`. */
function listen(port) {
  const seen = new Map();
  createServer((req, res) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks);
      const sig = req.headers["hitpay-signature"];
      let id = null;
      let parsed = null;
      try {
        parsed = JSON.parse(raw.toString("utf8"));
        id = parsed.id ?? null;
      } catch {
        // A body that is not JSON is logged raw below.
      }
      const count = (seen.get(id) ?? 0) + 1;
      seen.set(id, count);
      console.log(`\n${new Date().toISOString()} ${req.method} ${req.url}`);
      console.log(
        "  event:",
        req.headers["hitpay-event-object"],
        req.headers["hitpay-event-type"],
      );
      console.log("  content-type:", req.headers["content-type"]);
      console.log(
        "  signature over the raw bytes:",
        signatureMatches(raw, salt(), sig) ? "OK" : "MISMATCH",
      );
      if (parsed)
        console.log(
          "  signature over re-serialised JSON:",
          signatureMatches(Buffer.from(JSON.stringify(parsed)), salt(), sig)
            ? "OK"
            : "MISMATCH",
        );
      console.log("  delivery number for this id:", count);
      console.log(
        "  id / status / amount / reference_number:",
        id,
        parsed?.status,
        parsed?.amount,
        parsed?.reference_number,
      );
      console.log("  raw:", raw.toString("utf8").slice(0, 2000));
      // `fail` in the query string answers 500, to observe the retry policy.
      res.statusCode = req.url?.includes("fail") ? 500 : 200;
      res.end("ok");
    });
  }).listen(port, () => console.log(`listening on http://localhost:${port}`));
}

const USAGE = `Usage:
  node scripts/spike/hitpay-sandbox.mjs create <amount> [expiry-minutes]
  node scripts/spike/hitpay-sandbox.mjs status <payment-request-id>
  node scripts/spike/hitpay-sandbox.mjs listen [port]
  node scripts/spike/hitpay-sandbox.mjs verify <raw-body-file> <signature>`;

const [command, a, b] = process.argv.slice(2);
try {
  if (command === "create" && a) await create(a, b);
  else if (command === "status" && a) await status(a);
  else if (command === "listen") listen(Number(a ?? 8787));
  else if (command === "verify" && a && b) verify(a, b);
  else console.log(USAGE);
} catch (err) {
  console.error(err instanceof Error ? err.message : "failed");
  process.exitCode = 1;
}
