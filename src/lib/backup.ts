/** Lossless backup — PURE, node-testable serialize/parse/validate logic.
 *  Imports ONLY types (so tsc type-stripping lets it run in isolation).
 *  Takes store state as parameters; never touches the stores, React, or
 *  localStorage. src/pages/settings/DataCard.tsx is the only wiring layer. */

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

/* ── envelope constants ─────────────────────────────────────────────── */

export const BACKUP_FORMAT = "ledgerx-backup" as const;
export const BACKUP_FORMAT_VERSION = 2 as const;
/** Persisted store versions the envelope records (mirrors the store `version`). */
export const LEDGERX_STORE_VERSION = 7 as const;
export const MTF_STORE_VERSION = 2 as const;

/* ── envelope types ─────────────────────────────────────────────────── */

/** The subset of ledgerx-store state that round-trips (transient `filters`
 *  is deliberately excluded). */
export interface LedgerxSnapshot {
  trades: Trade[];
  accounts: Account[];
  cashTransactions: CashTransaction[];
  journal: JournalEntry[];
  goals: Goals;
  portfolioTargets: PortfolioTargets;
  watchlist: WatchlistItem[];
  settings: AppSettings;
}

/** The full mtf-store state. */
export interface MtfSnapshot {
  positions: MtfPosition[];
  brokers: MtfBroker[];
  accountValue: number;
}

export interface LedgerxBackup extends LedgerxSnapshot {
  storeVersion: number;
}

export interface MtfBackup extends MtfSnapshot {
  storeVersion: number;
}

export interface BackupEnvelope {
  format: typeof BACKUP_FORMAT;
  formatVersion: typeof BACKUP_FORMAT_VERSION;
  exportedAt: string;
  ledgerx: LedgerxBackup;
  mtf: MtfBackup;
}

/* ── build (export) ─────────────────────────────────────────────────── */

/** Pure serialize. `exportedAt` is a param so the result is deterministic/testable. */
export function buildBackup(
  ledgerx: LedgerxSnapshot,
  mtf: MtfSnapshot,
  exportedAt: string,
): BackupEnvelope {
  return {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt,
    ledgerx: {
      storeVersion: LEDGERX_STORE_VERSION,
      trades: ledgerx.trades,
      accounts: ledgerx.accounts,
      cashTransactions: ledgerx.cashTransactions,
      journal: ledgerx.journal,
      goals: ledgerx.goals,
      portfolioTargets: ledgerx.portfolioTargets,
      watchlist: ledgerx.watchlist,
      settings: ledgerx.settings,
    },
    mtf: {
      storeVersion: MTF_STORE_VERSION,
      positions: mtf.positions,
      brokers: mtf.brokers,
      accountValue: mtf.accountValue,
    },
  };
}

/* ── per-collection structural guards ───────────────────────────────── */

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

/** Loose structural check — enough to keep the strict Trade shape honest on
 *  import. (Kept byte-for-byte identical to the original DataCard guard.) */
export function isTradeLike(x: unknown): x is Trade {
  if (typeof x !== "object" || x === null) return false;
  const t = x as Record<string, unknown>;
  return (
    typeof t.id === "string" &&
    typeof t.accountId === "string" &&
    typeof t.symbol === "string" &&
    typeof t.status === "string" &&
    typeof t.quantity === "number" &&
    typeof t.entryPrice === "number" &&
    typeof t.openedAt === "string" &&
    typeof t.grossPnl === "number" &&
    typeof t.netPnl === "number" &&
    typeof t.charges === "object" &&
    t.charges !== null &&
    Array.isArray(t.tags)
  );
}

export function isAccountLike(x: unknown): x is Account {
  if (!isObject(x)) return false;
  return (
    typeof x.id === "string" &&
    typeof x.name === "string" &&
    typeof x.broker === "string" &&
    typeof x.currency === "string" &&
    typeof x.startingCapital === "number" &&
    typeof x.createdAt === "string"
  );
}

export function isCashTxnLike(x: unknown): x is CashTransaction {
  if (!isObject(x)) return false;
  return (
    typeof x.id === "string" &&
    typeof x.accountId === "string" &&
    typeof x.type === "string" &&
    typeof x.amount === "number" &&
    typeof x.date === "string"
  );
}

export function isJournalLike(x: unknown): x is JournalEntry {
  if (!isObject(x)) return false;
  return (
    typeof x.id === "string" &&
    typeof x.date === "string" &&
    typeof x.title === "string" &&
    typeof x.content === "string" &&
    typeof x.mood === "string" &&
    Array.isArray(x.linkedTradeIds)
  );
}

export function isWatchLike(x: unknown): x is WatchlistItem {
  if (!isObject(x)) return false;
  return (
    typeof x.id === "string" &&
    typeof x.symbol === "string" &&
    typeof x.assetClass === "string" &&
    typeof x.note === "string" &&
    typeof x.plannedSetup === "string" &&
    typeof x.addedAt === "string"
  );
}

export function isMtfPositionLike(x: unknown): x is MtfPosition {
  if (!isObject(x)) return false;
  return (
    typeof x.id === "string" &&
    typeof x.stockName === "string" &&
    typeof x.symbol === "string" &&
    typeof x.brokerId === "string" &&
    typeof x.purchaseDate === "string" &&
    typeof x.quantity === "number" &&
    typeof x.avgBuyPrice === "number" &&
    typeof x.totalInvestment === "number" &&
    typeof x.status === "string" &&
    typeof x.dailyRatePct === "number" &&
    typeof x.interestBasis === "string" &&
    typeof x.fundedPercent === "number" &&
    isObject(x.charges)
  );
}

export function isMtfBrokerLike(x: unknown): x is MtfBroker {
  if (!isObject(x)) return false;
  return (
    typeof x.id === "string" &&
    typeof x.name === "string" &&
    typeof x.dailyRatePct === "number"
  );
}

function isGoalsLike(x: unknown): x is Goals {
  if (!isObject(x)) return false;
  return (
    typeof x.monthlyProfitTarget === "number" &&
    typeof x.winRateTarget === "number" &&
    typeof x.maxDailyLoss === "number" &&
    typeof x.maxTradesPerDay === "number"
  );
}

function isPortfolioTargetsLike(x: unknown): x is PortfolioTargets {
  if (!isObject(x)) return false;
  return (
    Array.isArray(x.percents) &&
    x.percents.every((p) => typeof p === "number") &&
    isObject(x.capitalByMonth)
  );
}

function isSettingsLike(x: unknown): x is AppSettings {
  // updateSettings merges, so a partial object is safe to apply; we only
  // guard against non-objects / arrays sneaking in.
  return isObject(x);
}

/* ── de-dup helper (pure) ───────────────────────────────────────────── */

/** Split `items` into rows whose id is new vs. already present. Also dedupes
 *  within the incoming batch so a corrupt file can never inject a duplicate id.
 *  Does NOT mutate `existingIds`. */
export function dedupeById<T extends { id: string }>(
  items: readonly T[],
  existingIds: ReadonlySet<string>,
): { fresh: T[]; dupes: T[] } {
  const seen = new Set(existingIds);
  const fresh: T[] = [];
  const dupes: T[] = [];
  for (const item of items) {
    if (seen.has(item.id)) {
      dupes.push(item);
    } else {
      seen.add(item.id);
      fresh.push(item);
    }
  }
  return { fresh, dupes };
}

/* ── parse (import) ─────────────────────────────────────────────────── */

/** Per-collection count of records dropped by the structural guards. */
export interface InvalidCounts {
  trades: number;
  accounts: number;
  cashTransactions: number;
  journal: number;
  watchlist: number;
  mtfPositions: number;
  mtfBrokers: number;
}

/** Validated, ready-to-restore collections. Scalar/singleton pieces are `null`
 *  when absent or malformed (so the caller simply skips restoring them). */
export interface ParsedBackup {
  legacy: boolean;
  ledgerx: {
    trades: Trade[];
    accounts: Account[];
    cashTransactions: CashTransaction[];
    journal: JournalEntry[];
    watchlist: WatchlistItem[];
    goals: Goals | null;
    portfolioTargets: PortfolioTargets | null;
    settings: AppSettings | null;
  };
  mtf: {
    positions: MtfPosition[];
    brokers: MtfBroker[];
    accountValue: number | null;
  };
  invalid: InvalidCounts;
}

export type ParseResult =
  | { ok: true; data: ParsedBackup; legacy: boolean }
  | { ok: false; error: string };

function validateArray<T>(
  raw: unknown,
  guard: (x: unknown) => x is T,
): { valid: T[]; invalid: number } {
  if (!Array.isArray(raw)) return { valid: [], invalid: 0 };
  const valid: T[] = [];
  let invalid = 0;
  for (const row of raw) {
    if (guard(row)) valid.push(row);
    else invalid += 1;
  }
  return { valid, invalid };
}

function emptyInvalid(): InvalidCounts {
  return {
    trades: 0,
    accounts: 0,
    cashTransactions: 0,
    journal: 0,
    watchlist: 0,
    mtfPositions: 0,
    mtfBrokers: 0,
  };
}

/** NON-throwing parse handling the v2 envelope, the legacy flat `{trades:[…]}`
 *  shape, and corrupt input. Returns validated collections plus per-collection
 *  invalid/skipped counts; never mutates anything. */
export function parseBackup(text: string): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "That file isn't valid JSON" };
  }
  if (typeof parsed !== "object" || parsed === null) {
    return { ok: false, error: "No LedgerX data found in that file" };
  }
  const root = parsed as Record<string, unknown>;

  // ── v2 envelope ──────────────────────────────────────────────────
  const looksLikeEnvelope = root.format === BACKUP_FORMAT || isObject(root.ledgerx);
  if (looksLikeEnvelope) {
    const lx = isObject(root.ledgerx) ? root.ledgerx : {};
    const mtf = isObject(root.mtf) ? root.mtf : {};

    const trades = validateArray(lx.trades, isTradeLike);
    const accounts = validateArray(lx.accounts, isAccountLike);
    const cashTransactions = validateArray(lx.cashTransactions, isCashTxnLike);
    const journal = validateArray(lx.journal, isJournalLike);
    const watchlist = validateArray(lx.watchlist, isWatchLike);
    const positions = validateArray(mtf.positions, isMtfPositionLike);
    const brokers = validateArray(mtf.brokers, isMtfBrokerLike);

    return {
      ok: true,
      legacy: false,
      data: {
        legacy: false,
        ledgerx: {
          trades: trades.valid,
          accounts: accounts.valid,
          cashTransactions: cashTransactions.valid,
          journal: journal.valid,
          watchlist: watchlist.valid,
          goals: isGoalsLike(lx.goals) ? lx.goals : null,
          portfolioTargets: isPortfolioTargetsLike(lx.portfolioTargets)
            ? lx.portfolioTargets
            : null,
          settings: isSettingsLike(lx.settings) ? lx.settings : null,
        },
        mtf: {
          positions: positions.valid,
          brokers: brokers.valid,
          accountValue: typeof mtf.accountValue === "number" ? mtf.accountValue : null,
        },
        invalid: {
          trades: trades.invalid,
          accounts: accounts.invalid,
          cashTransactions: cashTransactions.invalid,
          journal: journal.invalid,
          watchlist: watchlist.invalid,
          mtfPositions: positions.invalid,
          mtfBrokers: brokers.invalid,
        },
      },
    };
  }

  // ── legacy flat { trades:[…] } — trades only ─────────────────────
  if (Array.isArray(root.trades)) {
    const trades = validateArray(root.trades, isTradeLike);
    const invalid = emptyInvalid();
    invalid.trades = trades.invalid;
    return {
      ok: true,
      legacy: true,
      data: {
        legacy: true,
        ledgerx: {
          trades: trades.valid,
          accounts: [],
          cashTransactions: [],
          journal: [],
          watchlist: [],
          goals: null,
          portfolioTargets: null,
          settings: null,
        },
        mtf: { positions: [], brokers: [], accountValue: null },
        invalid,
      },
    };
  }

  return {
    ok: false,
    error: "No LedgerX backup found — export a backup from LedgerX first",
  };
}
