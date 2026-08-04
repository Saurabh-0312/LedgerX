/** Phase 6 — exercises every entity route against a running Worker.
 *  Needs a valid Supabase access token in LEDGERX_TOKEN (see worker/README.md).
 *  Base URL from LEDGERX_API (default http://localhost:8787).
 *  Self-cleaning: deletes every collection row it creates, even on failure.
 *  Prints PASS/FAIL per check; exits non-zero on any failure. */

const API = process.env.LEDGERX_API ?? "http://localhost:8787";
const TOKEN = process.env.LEDGERX_TOKEN;
if (!TOKEN) {
  console.error("Set LEDGERX_TOKEN to a valid Supabase access token (see worker/README.md).");
  process.exit(2);
}
const FAKE_UID = "00000000-0000-0000-0000-000000000000";
const STAMP = Date.now();

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

const first = (j) => (Array.isArray(j) ? j[0] : j);

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

// created rows to clean up, keyed by API path
const created = new Map();
const track = (path, id) => {
  if (!created.has(path)) created.set(path, new Set());
  created.get(path).add(id);
};
const untrack = (path, id) => created.get(path)?.delete(id);

// ── row factories (every NOT NULL column of the matching table) ──────────────
const makeTrade = (id, o = {}) => ({
  id, accountId: "acc-test", symbol: "TEST", assetClass: "Equity", segment: "Delivery",
  exchange: "NSE", direction: "Long", status: "Closed", quantity: 10, entryPrice: 100.5,
  exitPrice: 110.25, openedAt: "2025-01-01T16:17", closedAt: "2025-01-02T15:30", holdingMinutes: 1400,
  grossPnl: 97.5,
  charges: { brokerage: 5, exchangeTxn: 0.3, stt: 1, sebi: 0.01, stampDuty: 0.15, gst: 1.2, dpCharges: 20, pledgeCharges: 0, manual: 0, mtfInterest: 0, total: 27.66 },
  manualCharges: false, netPnl: 69.84, taxablePnl: 76.5,
  tax: { category: "STCG", taxableAmount: 76.5, rate: 20, estimatedTax: 15.3 },
  riskAmount: 200, positionValue: 1005, pctOfCapital: 5, strategy: "test",
  marketCondition: "Trending", timeframe: "Daily", tags: ["a", "b"], emotionRating: 3,
  confidenceRating: 4, notes: "test trade", ...o,
});
const makeAccount = (id, o = {}) => ({ id, name: "Test Acct", broker: "TestBroker", currency: "INR", startingCapital: 100000, createdAt: "2026-07-03", ...o });
const makeCash = (id, o = {}) => ({ id, accountId: "acc-test", type: "deposit", amount: 5000, date: "2026-07-25", note: "test", ...o });
const makeJournal = (id, o = {}) => ({ id, date: "2026-07-20", title: "Test", content: "content", mood: "good", linkedTradeIds: ["T-0001", "T-0002"], ...o });
const makeWatch = (id, o = {}) => ({ id, symbol: "TEST", assetClass: "Equity", note: "n", plannedSetup: "s", alertPrice: 100, addedAt: "2026-07-15", ...o });
const makeMtfPos = (id, o = {}) => ({
  id, stockName: "Test Stock", symbol: "TEST", brokerId: "MTF-BRK-1", purchaseDate: "2026-07-08",
  quantity: 25, avgBuyPrice: 1153.297619047619, totalInvestment: 28832.44, status: "Open",
  dailyRatePct: 0.041, interestBasis: "total", fundedPercent: 100,
  charges: { brokerage: 5, gst: 0.9 },
  lots: [{ id: "L1", date: "2026-07-08", quantity: 25, price: 1153.5 }], ...o,
});
const makeMtfBroker = (id, o = {}) => ({ id, name: "Test Broker", dailyRatePct: 0.041, ...o });

function makeSettingsBlob() {
  return {
    userName: "Test", email: "test@test.com", baseCurrency: "INR", timezone: "Asia/Kolkata",
    startingCapital: 100000, theme: "dark",
    chargeRates: { brokerageFlatPerOrder: 20, brokeragePctPerOrder: 0.1, minBrokeragePerOrder: 5, mtfInterestAnnualPct: 14.95, sttIntradayPct: 0.025, sttDeliveryPct: 0.1, sttOptionsPct: 0.1, sttFuturesPct: 0.02, exchangeEquityPct: 0.00297, exchangeEquityBsePct: 0.00375, exchangeOptionsPct: 0.03503, exchangeFuturesPct: 0.00173, exchangeCommodityPct: 0.0026, exchangeForexPct: 0.0009, cryptoFeePct: 0.2, sebiPct: 0.0001, stampDeliveryPct: 0.015, stampIntradayPct: 0.003, stampOptionsPct: 0.003, stampFuturesPct: 0.002, gstPct: 18, dpChargePerSell: 20, pledgeChargePerRequest: 20 },
    taxRates: { intradayPct: 30, stcgPct: 20, ltcgPct: 12.5, cryptoPct: 30, basicExemption: 400000, ltcgExemption: 125000, rebate87ALimit: 1200000, rebate87AMax: 60000, cessPct: 4 },
  };
}

const COLLECTIONS = [
  { label: "trades", path: "trades", make: makeTrade, stable: ["symbol", "TEST"], patch: { notes: "patched" }, patched: ["notes", "patched"] },
  { label: "accounts", path: "accounts", make: makeAccount, stable: ["broker", "TestBroker"], patch: { name: "Renamed" }, patched: ["name", "Renamed"] },
  { label: "cash-transactions", path: "cash-transactions", make: makeCash, stable: ["amount", 5000], patch: { note: "updated" }, patched: ["note", "updated"] },
  { label: "journal", path: "journal", make: makeJournal, stable: ["mood", "good"], patch: { title: "Updated" }, patched: ["title", "Updated"] },
  { label: "watchlist", path: "watchlist", make: makeWatch, stable: ["symbol", "TEST"], patch: { note: "updated" }, patched: ["note", "updated"] },
  { label: "mtf-positions", path: "mtf/positions", make: makeMtfPos, stable: ["symbol", "TEST"], patch: { notes: "updated" }, patched: ["notes", "updated"] },
  { label: "mtf-brokers", path: "mtf/brokers", make: makeMtfBroker, stable: ["dailyRatePct", 0.041], patch: { name: "Updated" }, patched: ["name", "Updated"] },
];

let MY_UID;

async function testCollection(cfg) {
  const { label, path, make, stable, patch, patched } = cfg;
  const T = `TEST-${label}-${STAMP}`;

  const g0 = await api("GET", `/api/${path}`);
  const start = Array.isArray(g0.json) ? g0.json.length : NaN;
  ok(g0.status === 200 && Array.isArray(g0.json), `[${label}] 5. GET → 200 array`, `status ${g0.status}`);

  const A = `${T}-A`;
  const p1 = await api("POST", `/api/${path}`, make(A));
  if (first(p1.json)?.id === A) track(path, A);
  ok((p1.status === 201 || p1.status === 200) && first(p1.json)?.id === A, `[${label}] 6. POST one → row returned`, `status ${p1.status}`);

  const B = `${T}-B`;
  const C = `${T}-C`;
  const p2 = await api("POST", `/api/${path}`, [make(B), make(C)]);
  if (Array.isArray(p2.json)) p2.json.forEach((r) => r?.id && track(path, r.id));
  ok((p2.status === 201 || p2.status === 200) && Array.isArray(p2.json) && p2.json.length === 2, `[${label}] 7. POST array of 2 → both inserted`, `status ${p2.status}`);

  const pa = await api("PATCH", `/api/${path}/${A}`, patch);
  const pr = first(pa.json);
  ok(pa.status === 200 && pr?.[patched[0]] === patched[1] && pr?.[stable[0]] === stable[1], `[${label}] 8. PATCH → field updated, others intact`, `status ${pa.status}`);

  const d1 = await api("DELETE", `/api/${path}/${A}`);
  untrack(path, A);
  const g2 = await api("GET", `/api/${path}`);
  ok(d1.status === 200 && Array.isArray(g2.json) && !g2.json.some((r) => r.id === A), `[${label}] 9. DELETE one → gone`, `status ${d1.status}`);

  const d2 = await api("DELETE", `/api/${path}`, { ids: [B, C] });
  untrack(path, B);
  untrack(path, C);
  const g3 = await api("GET", `/api/${path}`);
  ok(d2.status === 200 && Array.isArray(g3.json) && !g3.json.some((r) => r.id === B || r.id === C), `[${label}] 10. bulk DELETE → both gone`, `status ${d2.status}`);

  // 11. 🔴 empty bulk delete — no-op PROVEN with a real row present (not vacuous
  //     on an empty table): seed a sentinel, empty-delete, assert it survives.
  const S = `${T}-S`;
  await api("POST", `/api/${path}`, make(S));
  track(path, S);
  const before = (await api("GET", `/api/${path}`)).json;
  const de = await api("DELETE", `/api/${path}`, { ids: [] });
  const after = (await api("GET", `/api/${path}`)).json;
  const survived = Array.isArray(after) && after.some((r) => r.id === S);
  ok(de.status === 200 && Array.isArray(before) && Array.isArray(after) && before.length >= 1 && after.length === before.length && survived,
    `[${label}] 11. 🔴 empty ids → NO-OP (sentinel survives, count unchanged)`, `${before?.length} → ${after?.length}, survived=${survived}`);
  await api("DELETE", `/api/${path}/${S}`);
  untrack(path, S);

  // 12. forged user_id ignored
  const F = `${T}-F`;
  const forged = await api("POST", `/api/${path}`, make(F, { user_id: FAKE_UID }));
  const rowF = first(forged.json);
  if (rowF?.id === F) track(path, F);
  ok((forged.status === 201 || forged.status === 200) && !!MY_UID && rowF?.user_id === MY_UID, `[${label}] 12. forged user_id ignored → belongs to token user`, `${rowF?.user_id} vs ${MY_UID}`);
  await api("DELETE", `/api/${path}/${F}`);
  untrack(path, F);

  const gEnd = (await api("GET", `/api/${path}`)).json;
  ok(Array.isArray(gEnd) && gEnd.length === start, `[${label}] → back to original count`, `${gEnd?.length} vs ${start}`);
}

async function fidelity(no, label, path, row, assertFn) {
  const p = await api("POST", `/api/${path}`, row);
  if (first(p.json)?.id === row.id) track(path, row.id);
  const g = await api("GET", `/api/${path}`);
  const got = Array.isArray(g.json) ? g.json.find((r) => r.id === row.id) : null;
  ok(!!got && assertFn(got), `${no}. 🔴 [${label}] round-trip fidelity byte-exact`, got ? "value mismatch" : "row not found");
  await api("DELETE", `/api/${path}/${row.id}`);
  untrack(path, row.id);
}

async function testSettings() {
  // capture any pre-existing row so we can restore it (no DELETE route by design)
  const orig = await api("GET", "/api/settings");
  const hadRow = Array.isArray(orig.json) && orig.json.length > 0;
  const original = hadRow ? orig.json[0] : null;

  // 13. GET with no row → sane empty result, NOT a 500
  ok(orig.status === 200 && Array.isArray(orig.json), `[settings] 13. GET → 200 array, not 500`, `status ${orig.status}${hadRow ? " (a row already existed)" : " (empty)"}`);

  // 14. PUT → row created
  const v1 = {
    goals: { monthlyProfitTarget: 50000, winRateTarget: 55, maxDailyLoss: 10000, maxTradesPerDay: 5 },
    portfolioTargets: { percents: [3, 4, 6], capitalByMonth: { "2026-07": 400000 } },
    settings: makeSettingsBlob(),
    mtfAccountValue: 412345.67,
  };
  const put1 = await api("PUT", "/api/settings", v1);
  ok((put1.status === 200 || put1.status === 201) && !!first(put1.json), `[settings] 14. PUT → row created`, `status ${put1.status}`);

  // 15. GET → returns what was written
  const g1 = first((await api("GET", "/api/settings")).json);
  ok(g1 && g1.mtfAccountValue === 412345.67 && g1.goals?.monthlyProfitTarget === 50000, `[settings] 15. GET → returns written values`, `mtfAccountValue=${g1?.mtfAccountValue}`);

  // 16. PUT again with changed values → replaced, not duplicated
  const v2 = { ...v1, mtfAccountValue: 999999, goals: { ...v1.goals, monthlyProfitTarget: 77777 } };
  const put2 = await api("PUT", "/api/settings", v2);
  ok(put2.status === 200 || put2.status === 201, `[settings] 16. PUT again → upsert`, `status ${put2.status}`);

  // 17. GET → exactly ONE row, with the new values
  const g2 = (await api("GET", "/api/settings")).json;
  ok(Array.isArray(g2) && g2.length === 1 && g2[0].mtfAccountValue === 999999 && g2[0].goals?.monthlyProfitTarget === 77777, `[settings] 17. GET → exactly one row, replaced not duplicated`, `len ${g2?.length}`);

  // 23. 🔴 settings jsonb — all 23 chargeRates keys survive
  const cr = g2?.[0]?.settings?.chargeRates;
  ok(cr && Object.keys(cr).length === 23 && cr.mtfInterestAnnualPct === 14.95 && cr.exchangeEquityPct === 0.00297, `23. 🔴 [settings] all 23 chargeRates keys survive, values exact`, `${cr ? Object.keys(cr).length : "missing"} keys`);

  if (hadRow) {
    await api("PUT", "/api/settings", original).catch(() => {});
    console.log("note: restored the pre-existing user_settings row");
  } else {
    console.log("note: /api/settings has no DELETE by design — one user_settings row remains (harmless; Phase 7 owns it)");
  }
}

async function main() {
  MY_UID = (await api("GET", "/api/me")).json?.userId;

  // Per-entity CRUD (checks 5–12), trades first = Phase-5 regression (check 24)
  for (const cfg of COLLECTIONS) await testCollection(cfg);

  // Round-trip fidelity (checks 18–22) + the Phase-5 trades round-trip (part of 24)
  const trd = makeTrade(`FID-trades-${STAMP}`, { openedAt: "2025-01-01T16:17" });
  await fidelity("24", "trades", "trades", trd, (g) =>
    g.openedAt === "2025-01-01T16:17" && g.entryPrice === 100.5 && g.charges?.total === 27.66 &&
    deepEq(g.tags, trd.tags) && deepEq(g.charges, trd.charges) && deepEq(g.tax, trd.tax));
  await fidelity("18", "accounts.createdAt", "accounts", makeAccount(`FID-acc-${STAMP}`, { createdAt: "2026-07-03" }), (g) => g.createdAt === "2026-07-03");
  await fidelity("19", "cash.date", "cash-transactions", makeCash(`FID-cash-${STAMP}`, { date: "2026-07-25" }), (g) => g.date === "2026-07-25");
  await fidelity("20", "journal.linkedTradeIds", "journal", makeJournal(`FID-jrnl-${STAMP}`, { linkedTradeIds: ["T-0001", "T-0002"] }), (g) => deepEq(g.linkedTradeIds, ["T-0001", "T-0002"]));
  const lots = [{ id: "L1", date: "2026-07-08", quantity: 25, price: 1153.5 }];
  const mrow = makeMtfPos(`FID-mtf-${STAMP}`, { lots, avgBuyPrice: 1153.297619047619 });
  const mp = await api("POST", "/api/mtf/positions", mrow);
  if (first(mp.json)?.id === mrow.id) track("mtf/positions", mrow.id);
  const mg = await api("GET", "/api/mtf/positions");
  const mgot = Array.isArray(mg.json) ? mg.json.find((r) => r.id === mrow.id) : null;
  const lotsOk = !!mgot && deepEq(mgot.lots, lots);
  // jsonb (lots) must be byte-exact; top-level double precision may round at ~15
  // significant digits in Supabase's output — accepted, since the drift is far
  // below a paisa (every LedgerX value is calculated/shown to 2 decimals).
  const diff = mgot ? Math.abs(mgot.avgBuyPrice - 1153.297619047619) : Infinity;
  const priceOk = diff < 0.01; // within 1 paisa
  ok(lotsOk && priceOk, "21+22. 🔴 [mtf] lots jsonb byte-exact; avgBuyPrice float within 1 paisa",
    mgot
      ? `avgBuyPrice sent=1153.297619047619 got=${mgot.avgBuyPrice} (Δ=${diff.toExponential(1)} ₹, <1 paisa) | lots=${lotsOk ? "ok" : "MISMATCH " + JSON.stringify(mgot.lots)}`
      : "row not found");
  await api("DELETE", `/api/mtf/positions/${mrow.id}`);
  untrack("mtf/positions", mrow.id);

  // Singleton (checks 13–17, 23)
  await testSettings();
}

main()
  .catch((e) => {
    fail++;
    console.log(`FAIL  unexpected error → ${e.message}`);
  })
  .finally(async () => {
    let leftovers = 0;
    for (const [path, ids] of created) {
      if (ids.size) {
        leftovers += ids.size;
        await api("DELETE", `/api/${path}`, { ids: [...ids] }).catch(() => {});
      }
    }
    if (leftovers) console.log(`\ncleanup: removed ${leftovers} leftover collection row(s)`);
    console.log(`\n${fail === 0 ? "ALL PASS ✓" : `${fail} FAILED ✗`}  (${pass} passed, ${fail} failed)`);
    process.exit(fail === 0 ? 0 : 1);
  });
