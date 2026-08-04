/** Phase 5 — exercises every /api/trades route against a running Worker.
 *  Needs a valid Supabase access token in LEDGERX_TOKEN (see worker/README.md).
 *  Reads the base URL from LEDGERX_API (default http://localhost:8787).
 *  Deletes every row it creates. Prints PASS/FAIL per check; exits non-zero on any failure. */

const API = process.env.LEDGERX_API ?? "http://localhost:8787";
const TOKEN = process.env.LEDGERX_TOKEN;
if (!TOKEN) {
  console.error("Set LEDGERX_TOKEN to a valid Supabase access token (see worker/README.md).");
  process.exit(2);
}

let pass = 0;
let fail = 0;
const ok = (cond, msg, extra) => {
  if (cond) {
    pass++;
    console.log(`PASS  ${msg}`);
  } else {
    fail++;
    console.log(`FAIL  ${msg}${extra ? `  → ${extra}` : ""}`);
  }
};

async function api(method, path, body) {
  const headers = { Authorization: `Bearer ${TOKEN}` };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, json };
}

const TAG = `T-TEST-${Date.now()}`;
const created = new Set();

/** A complete, valid Trade (every NOT NULL column of src/types.ts Trade). */
function makeTrade(id, o = {}) {
  return {
    id,
    accountId: "acc-test",
    symbol: "TEST",
    assetClass: "Equity",
    segment: "Delivery",
    exchange: "NSE",
    direction: "Long",
    status: "Closed",
    quantity: 10,
    entryPrice: 100.5,
    exitPrice: 110.25,
    openedAt: "2025-01-01T16:17",
    closedAt: "2025-01-02T15:30",
    holdingMinutes: 1400,
    grossPnl: 97.5,
    charges: { brokerage: 5, exchangeTxn: 0.3, stt: 1, sebi: 0.01, stampDuty: 0.15, gst: 1.2, dpCharges: 20, pledgeCharges: 0, manual: 0, mtfInterest: 0, total: 27.66 },
    manualCharges: false,
    netPnl: 69.84,
    taxablePnl: 76.5,
    tax: { category: "STCG", taxableAmount: 76.5, rate: 20, estimatedTax: 15.3 },
    riskAmount: 200,
    positionValue: 1005,
    pctOfCapital: 5,
    strategy: "test",
    marketCondition: "Trending",
    timeframe: "Daily",
    tags: ["a", "b"],
    emotionRating: 3,
    confidenceRating: 4,
    notes: "test trade",
    ...o,
  };
}

/** Order-independent deep equality (jsonb may normalise object key order). */
function deepEq(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === b.length && a.every((v, i) => deepEq(v, b[i]));
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => deepEq(a[k], b[k]));
}

const first = (j) => (Array.isArray(j) ? j[0] : j);

async function main() {
  const me = await api("GET", "/api/me");
  const myUserId = me.json?.userId;

  // 5. GET all — array (DB is empty until Phase 7 syncs, so likely [])
  const g0 = await api("GET", "/api/trades");
  const startCount = Array.isArray(g0.json) ? g0.json.length : NaN;
  ok(g0.status === 200 && Array.isArray(g0.json), "5. GET /api/trades → 200 array", `status ${g0.status}`);

  // 6. POST one
  const A = `${TAG}-A`;
  const p1 = await api("POST", "/api/trades", makeTrade(A, { symbol: "AAA" }));
  if (first(p1.json)?.id === A) created.add(A);
  ok((p1.status === 201 || p1.status === 200) && first(p1.json)?.id === A, "6. POST one → row returned", `status ${p1.status}`);

  // 7. GET has it
  const g1 = await api("GET", "/api/trades");
  ok(Array.isArray(g1.json) && g1.json.some((t) => t.id === A), "7. GET → new trade present");

  // 8. POST array of 2
  const B = `${TAG}-B`;
  const C = `${TAG}-C`;
  const p2 = await api("POST", "/api/trades", [makeTrade(B), makeTrade(C)]);
  if (Array.isArray(p2.json)) p2.json.forEach((t) => t?.id && created.add(t.id));
  ok((p2.status === 201 || p2.status === 200) && Array.isArray(p2.json) && p2.json.length === 2, "8. POST array of 2 → both inserted", `status ${p2.status}`);

  // 9. PATCH — notes change, other fields unchanged
  const pa = await api("PATCH", `/api/trades/${A}`, { notes: "patched" });
  const patched = first(pa.json);
  ok(pa.status === 200 && patched?.notes === "patched" && patched?.symbol === "AAA" && patched?.entryPrice === 100.5,
    "9. PATCH → notes updated, other fields intact", `status ${pa.status}`);

  // 10. DELETE one
  const d1 = await api("DELETE", `/api/trades/${A}`);
  created.delete(A);
  const g2 = await api("GET", "/api/trades");
  ok(d1.status === 200 && Array.isArray(g2.json) && !g2.json.some((t) => t.id === A), "10. DELETE one → gone", `status ${d1.status}`);

  // 11. bulk DELETE
  const d2 = await api("DELETE", "/api/trades", { ids: [B, C] });
  created.delete(B);
  created.delete(C);
  const g3 = await api("GET", "/api/trades");
  ok(d2.status === 200 && Array.isArray(g3.json) && !g3.json.some((t) => t.id === B || t.id === C), "11. bulk DELETE → both gone", `status ${d2.status}`);

  // 12. back to original count
  ok(Array.isArray(g3.json) && g3.json.length === startCount, "12. GET → back to original count", `${g3.json?.length} vs ${startCount}`);

  // 13. forged user_id is ignored — row belongs to the token's user
  const F = `${TAG}-F`;
  const forged = await api("POST", "/api/trades", makeTrade(F, { user_id: "00000000-0000-0000-0000-000000000000" }));
  const fRow = first(forged.json);
  if (fRow?.id === F) created.add(F);
  ok((forged.status === 201 || forged.status === 200) && !!myUserId && fRow?.user_id === myUserId,
    "13. forged user_id ignored → row belongs to token user", `row.user_id ${fRow?.user_id} vs token ${myUserId}`);
  await api("DELETE", `/api/trades/${F}`);
  created.delete(F);

  // 14. PATCH a non-existent id — sane status, no crash
  const p404 = await api("PATCH", "/api/trades/does-not-exist-xyz", { notes: "x" });
  ok(p404.status >= 200 && p404.status < 500, "14. PATCH non-existent → sane status, no crash", `status ${p404.status}`);

  // 15. empty bulk delete — no-op, nothing removed
  const gB = await api("GET", "/api/trades");
  const e = await api("DELETE", "/api/trades", { ids: [] });
  const gA = await api("GET", "/api/trades");
  ok(e.status === 200 && Array.isArray(gA.json) && Array.isArray(gB.json) && gA.json.length === gB.json.length,
    "15. empty ids delete → no-op, nothing removed", `status ${e.status}`);

  // 16. 🔴 round-trip fidelity — date / numbers / nested jsonb exact
  const R = `${TAG}-R`;
  const sent = makeTrade(R, { openedAt: "2025-01-01T16:17", tags: ["a", "b"] });
  const pr = await api("POST", "/api/trades", sent);
  if (first(pr.json)?.id === R) created.add(R);
  const gr = await api("GET", "/api/trades");
  const got = Array.isArray(gr.json) ? gr.json.find((t) => t.id === R) : null;
  const fidelity =
    !!got &&
    got.openedAt === "2025-01-01T16:17" && // exact text — no timezone shift
    got.entryPrice === 100.5 && // top-level number — no drift
    got.charges?.total === 27.66 && // nested number — no drift
    deepEq(got.tags, ["a", "b"]) && // jsonb array order preserved
    deepEq(got.charges, sent.charges) && // nested jsonb values intact
    deepEq(got.tax, sent.tax);
  ok(fidelity, "16. round-trip fidelity: date / numbers / nested jsonb byte-exact",
    got ? `openedAt=${JSON.stringify(got.openedAt)} entryPrice=${got.entryPrice} charges.total=${got.charges?.total} tags=${JSON.stringify(got.tags)}` : "row not found");
  await api("DELETE", `/api/trades/${R}`);
  created.delete(R);
}

main()
  .catch((e) => {
    fail++;
    console.log(`FAIL  unexpected error → ${e.message}`);
  })
  .finally(async () => {
    if (created.size) {
      await api("DELETE", "/api/trades", { ids: [...created] }).catch(() => {});
      console.log(`\ncleanup: removed ${created.size} leftover test row(s)`);
    }
    console.log(`\n${fail === 0 ? "ALL PASS ✓" : `${fail} FAILED ✗`}  (${pass} passed, ${fail} failed)`);
    process.exit(fail === 0 ? 0 : 1);
  });
