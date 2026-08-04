/** Phase 9 — one-time migration of the legacy localStorage stores to the cloud.
 *  PURE + testable: reads localStorage ONLY via getItem (never setItem/removeItem/
 *  clear), imports no Zustand store, and takes the API client as a parameter.
 *  The legacy keys "ledgerx-store" / "mtf-store" are treated as strictly READ-ONLY
 *  — the user's only live copy until they choose to delete them. */

import type {
  Account,
  AppSettings,
  CashTransaction,
  Goals,
  JournalEntry,
  PortfolioTargets,
  Trade,
  WatchlistItem,
} from "@/types";
import type { MtfBroker, MtfPosition } from "@/lib/mtf/types";

export const LEDGERX_KEY = "ledgerx-store";
export const MTF_KEY = "mtf-store";
/** Written ONLY on a verified success, under this NEW key. Never the legacy keys. */
export const MIGRATED_FLAG = "ledgerx-migrated-at";
export const LEDGERX_VERSION = 7;
export const MTF_VERSION = 2;

export interface LegacySnapshot {
  trades: Trade[];
  accounts: Account[];
  cashTransactions: CashTransaction[];
  journal: JournalEntry[];
  watchlist: WatchlistItem[];
  goals: Goals;
  portfolioTargets: PortfolioTargets;
  settings: AppSettings;
}
export interface LegacyMtfSnapshot {
  positions: MtfPosition[];
  brokers: MtfBroker[];
  accountValue: number;
}

export interface DetectResult {
  ledgerx: { version: number; state: LegacySnapshot } | null;
  mtf: { version: number; state: LegacyMtfSnapshot } | null;
  counts: {
    trades: number;
    accounts: number;
    cashTransactions: number;
    journal: number;
    watchlist: number;
    monthlyTargets: number;
    mtfPositions: number;
    mtfBrokers: number;
  };
}

export interface ApiClient {
  get: <T>(path: string) => Promise<T>;
  post: <T = unknown>(path: string, body: unknown) => Promise<T>;
  put: <T = unknown>(path: string, body: unknown) => Promise<T>;
}

type Getter = (key: string) => string | null;

/** Parse a persisted zustand envelope { state, version }. Read-only, never throws. */
function readEnvelope<S>(getItem: Getter, key: string): { version: number; state: S } | null {
  const raw = getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { state?: S; version?: number } | null;
    if (!parsed || typeof parsed !== "object" || !parsed.state) return null;
    return { version: typeof parsed.version === "number" ? parsed.version : -1, state: parsed.state };
  } catch {
    return null;
  }
}

/** Detect legacy data on this origin. Returns null when NEITHER key exists (so
 *  the card renders nothing on cloud-only origins). READ-ONLY. */
export function detectLegacy(getItem: Getter = (k) => localStorage.getItem(k)): DetectResult | null {
  const ledgerx = readEnvelope<LegacySnapshot>(getItem, LEDGERX_KEY);
  const mtf = readEnvelope<LegacyMtfSnapshot>(getItem, MTF_KEY);
  if (!ledgerx && !mtf) return null;
  const l = ledgerx?.state;
  const m = mtf?.state;
  return {
    ledgerx,
    mtf,
    counts: {
      trades: l?.trades?.length ?? 0,
      accounts: l?.accounts?.length ?? 0,
      cashTransactions: l?.cashTransactions?.length ?? 0,
      journal: l?.journal?.length ?? 0,
      watchlist: l?.watchlist?.length ?? 0,
      monthlyTargets: l?.portfolioTargets?.capitalByMonth
        ? Object.keys(l.portfolioTargets.capitalByMonth).length
        : 0,
      mtfPositions: m?.positions?.length ?? 0,
      mtfBrokers: m?.brokers?.length ?? 0,
    },
  };
}

/** D1 — assert store versions match exactly; never upload an unknown version. */
export function validateVersions(d: DetectResult): { ok: true } | { ok: false; reason: string } {
  if (d.ledgerx && d.ledgerx.version !== LEDGERX_VERSION) {
    return {
      ok: false,
      reason: `Legacy trades store is version ${d.ledgerx.version}, but this build expects ${LEDGERX_VERSION}. Open the old Netlify build first (it upgrades the data), export a fresh backup, and migrate that — uploading an older version could omit backfilled fields.`,
    };
  }
  if (d.mtf && d.mtf.version !== MTF_VERSION) {
    return {
      ok: false,
      reason: `Legacy MTF store is version ${d.mtf.version}, but this build expects ${MTF_VERSION}. Open the old Netlify build first to upgrade it, then retry.`,
    };
  }
  return { ok: true };
}

interface Coll {
  key: string;
  label: string;
  path: string;
  rows: (d: DetectResult) => Array<{ id: string }>;
}

const COLLECTIONS: Coll[] = [
  { key: "trades", label: "Trades", path: "/api/trades", rows: (d) => d.ledgerx?.state.trades ?? [] },
  { key: "accounts", label: "Accounts", path: "/api/accounts", rows: (d) => d.ledgerx?.state.accounts ?? [] },
  { key: "cashTransactions", label: "Cash transactions", path: "/api/cash-transactions", rows: (d) => d.ledgerx?.state.cashTransactions ?? [] },
  { key: "journal", label: "Journal", path: "/api/journal", rows: (d) => d.ledgerx?.state.journal ?? [] },
  { key: "watchlist", label: "Watchlist", path: "/api/watchlist", rows: (d) => d.ledgerx?.state.watchlist ?? [] },
  { key: "mtfPositions", label: "MTF positions", path: "/api/mtf/positions", rows: (d) => d.mtf?.state.positions ?? [] },
  { key: "mtfBrokers", label: "MTF brokers", path: "/api/mtf/brokers", rows: (d) => d.mtf?.state.brokers ?? [] },
];

/** D8 — how many rows the cloud already holds (to warn before writing). */
export async function getCloudCounts(api: ApiClient): Promise<{ total: number; byKey: Record<string, number> }> {
  const byKey: Record<string, number> = {};
  let total = 0;
  for (const c of COLLECTIONS) {
    const rows = await api.get<Array<{ id: string }>>(c.path);
    byKey[c.key] = rows.length;
    total += rows.length;
  }
  return { total, byKey };
}

export interface UploadReport {
  collections: Array<{ key: string; label: string; uploaded: number; skipped: number; total: number }>;
  settingsUploaded: boolean;
}

/** D2/D3/D5/D6 — bulk upload (one POST per collection), skipping ids already in
 *  the cloud (idempotent). Settings keeps the cloud identity, uploads legacy
 *  rates/goals/targets/mtf value. Screenshots go up as-is. */
export async function uploadAll(d: DetectResult, api: ApiClient): Promise<UploadReport> {
  const collections: UploadReport["collections"] = [];
  for (const c of COLLECTIONS) {
    const source = c.rows(d);
    if (source.length === 0) {
      collections.push({ key: c.key, label: c.label, uploaded: 0, skipped: 0, total: 0 });
      continue;
    }
    const existing = await api.get<Array<{ id: string }>>(c.path);
    const existingIds = new Set(existing.map((r) => r.id));
    const fresh = source.filter((r) => !existingIds.has(r.id));
    if (fresh.length) await api.post(c.path, uniformKeys(fresh)); // one bulk POST; keys normalized (PGRST102)
    collections.push({
      key: c.key,
      label: c.label,
      uploaded: fresh.length,
      skipped: source.length - fresh.length,
      total: source.length,
    });
  }

  let settingsUploaded = false;
  if (d.ledgerx || d.mtf) {
    const cloudRows = await api.get<
      Array<{ goals?: unknown; portfolioTargets?: unknown; settings?: Partial<AppSettings>; mtfAccountValue?: number }>
    >("/api/settings");
    const cloud = cloudRows[0];
    const legacy = d.ledgerx?.state;
    // D5 — preserve the authenticated identity; take rates/prefs from legacy when
    // present, else keep the cloud's existing settings (MTF-only origin).
    const settings: Partial<AppSettings> = legacy
      ? {
          ...legacy.settings,
          userName: cloud?.settings?.userName ?? legacy.settings.userName,
          email: cloud?.settings?.email ?? legacy.settings.email,
        }
      : cloud?.settings ?? {};
    await api.put("/api/settings", {
      goals: legacy?.goals ?? cloud?.goals ?? {},
      portfolioTargets: legacy?.portfolioTargets ?? cloud?.portfolioTargets ?? {},
      settings,
      mtfAccountValue: d.mtf?.state.accountValue ?? cloud?.mtfAccountValue ?? 0,
    });
    settingsUploaded = true;
  }

  return { collections, settingsUploaded };
}

/** PostgREST bulk insert requires every object in the array to share the same
 *  key set (error PGRST102). Real records are heterogeneous (optional fields on
 *  some rows only), so pad every row to the union of keys, filling missing ones
 *  with null — "absent" for the nullable columns. Verify only checks SOURCE keys,
 *  so the added nulls do not affect fidelity. */
function uniformKeys(rows: Array<{ id: string }>): Array<Record<string, unknown>> {
  const keys = new Set<string>();
  for (const r of rows) for (const k of Object.keys(r)) keys.add(k);
  const all = [...keys];
  return rows.map((r) => {
    const rec = r as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of all) out[k] = k in rec ? rec[k] : null;
    return out;
  });
}

/** Floats: Supabase returns double precision at ~15 sig-figs, so compare with a
 *  1e-9 relative tolerance (an integer/exact value still compares exactly). */
function numsClose(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
}

/** Deep field comparison: numbers within tolerance, everything else (strings —
 *  incl. dates — booleans) exact, nested objects/arrays recursive. Compares only
 *  the SOURCE's keys, so extra cloud fields (user_id) are ignored. */
export function fieldsMatch(src: unknown, cloud: unknown): boolean {
  if (typeof src === "number" && typeof cloud === "number") return numsClose(src, cloud);
  if (src === null || src === undefined) return cloud === null || cloud === undefined;
  if (typeof src !== typeof cloud) return false;
  if (typeof src === "object") {
    if (cloud === null || cloud === undefined) return false; // src is a non-null object; cloud absent → mismatch
    if (Array.isArray(src)) {
      return Array.isArray(cloud) && src.length === cloud.length && src.every((v, i) => fieldsMatch(v, cloud[i]));
    }
    if (Array.isArray(cloud)) return false;
    const c = cloud as Record<string, unknown>;
    return Object.keys(src as object).every((k) => fieldsMatch((src as Record<string, unknown>)[k], c[k]));
  }
  return src === cloud;
}

export interface VerifyCollection {
  key: string;
  label: string;
  matched: number;
  total: number;
  failures: string[];
  pass: boolean;
}
export interface VerifyReport {
  collections: VerifyCollection[];
  pass: boolean;
}

function recordFailures(src: Record<string, unknown>, cloud: Record<string, unknown> | undefined): string[] {
  if (!cloud) return ["missing in cloud"];
  return Object.keys(src).filter((k) => !fieldsMatch(src[k], cloud[k]));
}

/** D4 — GET everything back and compare field-level against the source. */
export async function verifyAll(d: DetectResult, api: ApiClient): Promise<VerifyReport> {
  const results: VerifyCollection[] = [];

  for (const c of COLLECTIONS) {
    const source = c.rows(d) as Array<Record<string, unknown>>;
    const cloud = await api.get<Array<Record<string, unknown>>>(c.path);
    const byId = new Map(cloud.map((r) => [r.id as string, r]));
    const failures: string[] = [];
    let matched = 0;
    for (const src of source) {
      const fails = recordFailures(src, byId.get(src.id as string));
      if (fails.length === 0) matched++;
      else failures.push(`${String(src.id)}: ${fails.join(", ")}`);
    }
    results.push({ key: c.key, label: c.label, matched, total: source.length, failures, pass: failures.length === 0 });
  }

  if (d.ledgerx) {
    const cloudRow = (
      await api.get<
        Array<{ goals?: unknown; portfolioTargets?: unknown; settings?: Record<string, unknown>; mtfAccountValue?: number }>
      >("/api/settings")
    )[0];
    const legacy = d.ledgerx.state;
    const failures: string[] = [];
    if (!cloudRow) {
      failures.push("settings row missing");
    } else {
      const cs = cloudRow.settings ?? {};
      // Verify the fields we uploaded — NOT userName/email (identity preserved, D5).
      for (const key of ["chargeRates", "taxRates", "baseCurrency", "timezone", "startingCapital", "theme"] as const) {
        if (!fieldsMatch((legacy.settings as unknown as Record<string, unknown>)[key], cs[key])) failures.push(`settings.${key}`);
      }
      if (!fieldsMatch(legacy.goals, cloudRow.goals)) failures.push("goals");
      if (!fieldsMatch(legacy.portfolioTargets, cloudRow.portfolioTargets)) failures.push("portfolioTargets");
      if (!fieldsMatch(d.mtf?.state.accountValue ?? 0, cloudRow.mtfAccountValue)) failures.push("mtfAccountValue");
    }
    results.push({ key: "settings", label: "Settings", matched: failures.length === 0 ? 1 : 0, total: 1, failures, pass: failures.length === 0 });
  }

  return { collections: results, pass: results.every((r) => r.pass) };
}
