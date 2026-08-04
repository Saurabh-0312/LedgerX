/** Global app store — zustand backed by the Worker API (Phase 7).
 *  Pages read state with selectors and mutate ONLY through these actions.
 *  Actions stay SYNCHRONOUS and optimistic: they update state immediately, then
 *  fire the API call in the background (failures toast, no rollback — see D2).
 *  Only `filters` (transient UI) is persisted locally, under the NEW key
 *  "ledgerx-ui". The old "ledgerx-store" key is never read or written here. */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Account,
  AppSettings,
  CashTransaction,
  GlobalFilters,
  Goals,
  JournalEntry,
  PortfolioTargets,
  Trade,
  WatchlistItem,
} from "@/types";
import {
  DEFAULT_CHARGE_RATES,
  DEFAULT_TAX_RATES,
  computeCharges,
  computeGrossPnl,
  computeRMultiple,
  computeTax,
  computeTaxablePnl,
  defaultSegmentFor,
  holdingMinutesBetween,
  isIntraday,
  manualChargesBreakdown,
  taxCategoryFor,
} from "@/lib/tradeMath";
import {
  SAMPLE_ACCOUNTS,
  SAMPLE_GOALS,
  SAMPLE_PORTFOLIO_TARGETS,
  TOTAL_CAPITAL,
  generateCashTransactions,
  generateJournal,
  generateTrades,
  generateWatchlist,
} from "@/lib/sampleData";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { toast } from "@/store/toast";
import { scheduleSettingsSync, putCompleteSettings } from "@/store/settingsSync";
import { useMtfStore } from "@/store/useMtfStore";

const DEFAULT_SETTINGS: AppSettings = {
  userName: "Aarav Sharma",
  email: "aarav@ledgerx.app",
  baseCurrency: "INR",
  timezone: "Asia/Kolkata",
  startingCapital: TOTAL_CAPITAL,
  chargeRates: DEFAULT_CHARGE_RATES,
  taxRates: DEFAULT_TAX_RATES,
  theme: "dark",
};

const DEFAULT_FILTERS: GlobalFilters = { preset: "all", from: null, to: null, accountId: "all" };
const DEFAULT_PORTFOLIO_TARGETS: PortfolioTargets = { percents: [3, 4, 6, 7.2], capitalByMonth: {} };

/** REST paths keyed to the store collections. */
const P = {
  trades: "/api/trades",
  accounts: "/api/accounts",
  cash: "/api/cash-transactions",
  journal: "/api/journal",
  watchlist: "/api/watchlist",
} as const;

interface StoreState {
  trades: Trade[];
  accounts: Account[];
  cashTransactions: CashTransaction[];
  journal: JournalEntry[];
  goals: Goals;
  portfolioTargets: PortfolioTargets;
  watchlist: WatchlistItem[];
  settings: AppSettings;
  filters: GlobalFilters;

  /** false until the initial API hydrate resolves; gates the app shell. */
  hydrated: boolean;
  hydrateError: string | null;
  hydrate: () => Promise<void>;

  addTrade: (trade: Trade) => void;
  updateTrade: (id: string, patch: Partial<Trade>) => void;
  deleteTrade: (id: string) => void;
  deleteTrades: (ids: string[]) => void;
  /** Close an open trade: recomputes gross/charges/net/tax/R from the exit. */
  closeTrade: (
    id: string,
    exitPrice: number,
    closedAt: string,
    manualTotal?: number,
    manualMtfInterest?: number,
  ) => void;
  importTrades: (trades: Trade[]) => void;

  addJournalEntry: (entry: JournalEntry) => void;
  updateJournalEntry: (id: string, patch: Partial<JournalEntry>) => void;
  deleteJournalEntry: (id: string) => void;

  addAccount: (account: Account) => void;
  updateAccount: (id: string, patch: Partial<Account>) => void;
  deleteAccount: (id: string) => void;

  addCashTransaction: (txn: CashTransaction) => void;
  deleteCashTransaction: (id: string) => void;

  addWatchItem: (item: WatchlistItem) => void;
  updateWatchItem: (id: string, patch: Partial<WatchlistItem>) => void;
  removeWatchItem: (id: string) => void;

  setGoals: (goals: Goals) => void;
  setTargetPercents: (percents: number[]) => void;
  setMonthCapital: (yearMonth: string, value: number) => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
  setFilters: (patch: Partial<GlobalFilters>) => void;

  resetSampleData: () => void;
  clearAllData: () => void;
}

/** A full sample dataset — used only by resetSampleData() now. */
function freshSample() {
  const trades = generateTrades();
  return {
    trades,
    accounts: SAMPLE_ACCOUNTS,
    cashTransactions: generateCashTransactions(),
    journal: generateJournal(trades),
    goals: SAMPLE_GOALS,
    portfolioTargets: SAMPLE_PORTFOLIO_TARGETS,
    watchlist: generateWatchlist(),
  };
}

// ── background-sync helpers ──────────────────────────────────────────────────

/** Fire-and-forget: surface any failure via the existing toast (no rollback, D2). */
const bg = (label: string, p: Promise<unknown>): void => {
  p.catch((e: unknown) => toast(`Couldn't save ${label}: ${e instanceof Error ? e.message : String(e)}`, "error"));
};

const eid = (id: string) => encodeURIComponent(id);
const idsOf = (rows: Array<{ id: string }>) => rows.map((r) => r.id);
const bulkDelete = (path: string, rows: Array<{ id: string }>): Promise<unknown> =>
  rows.length ? api.del(path, { ids: idsOf(rows) }) : Promise.resolve(null);
const bulkInsert = (path: string, rows: unknown[]): Promise<unknown> =>
  rows.length ? api.post(path, rows) : Promise.resolve(null);

/** Strip the API's `user_id` from hydrated rows (D2). */
const stripUserId = <T,>(rows: Array<T & { user_id?: string }>): T[] =>
  rows.map((r) => {
    const copy = { ...r };
    delete (copy as { user_id?: string }).user_id;
    return copy as T;
  });

/** Deep-merge API settings over defaults so no chargeRates/taxRates key is ever
 *  missing (D5 — a missing key crashes the Settings page). */
function mergeSettings(raw: Partial<AppSettings> | undefined): AppSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...(raw ?? {}),
    chargeRates: { ...DEFAULT_CHARGE_RATES, ...(raw?.chargeRates ?? {}) },
    taxRates: { ...DEFAULT_TAX_RATES, ...(raw?.taxRates ?? {}) },
  };
}

interface UserSettingsRow {
  goals?: Goals;
  portfolioTargets?: PortfolioTargets;
  settings?: Partial<AppSettings>;
  mtfAccountValue?: number;
  user_id?: string;
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      // Empty initial state — real data arrives via hydrate() (D3). No sample flash.
      trades: [],
      accounts: [],
      cashTransactions: [],
      journal: [],
      goals: SAMPLE_GOALS,
      portfolioTargets: DEFAULT_PORTFOLIO_TARGETS,
      watchlist: [],
      settings: DEFAULT_SETTINGS,
      filters: DEFAULT_FILTERS,

      hydrated: false,
      hydrateError: null,

      hydrate: async () => {
        set({ hydrateError: null });
        try {
          const [trades, accounts, cash, journal, watchlist, settingsRows] = await Promise.all([
            api.get<Array<Trade & { user_id?: string }>>(P.trades),
            api.get<Array<Account & { user_id?: string }>>(P.accounts),
            api.get<Array<CashTransaction & { user_id?: string }>>(P.cash),
            api.get<Array<JournalEntry & { user_id?: string }>>(P.journal),
            api.get<Array<WatchlistItem & { user_id?: string }>>(P.watchlist),
            api.get<UserSettingsRow[]>("/api/settings"),
          ]);

          let goals: Goals;
          let portfolioTargets: PortfolioTargets;
          let settings: AppSettings;
          let mtfAccountValue: number;

          if (settingsRows.length > 0) {
            const row = settingsRows[0];
            settings = mergeSettings(row.settings);
            goals = { ...SAMPLE_GOALS, ...(row.goals ?? {}) };
            portfolioTargets = {
              percents: row.portfolioTargets?.percents ?? DEFAULT_PORTFOLIO_TARGETS.percents,
              capitalByMonth: row.portfolioTargets?.capitalByMonth ?? {},
            };
            mtfAccountValue = row.mtfAccountValue ?? 0;
          } else {
            // D8 — first run: seed the row with identity from the auth user.
            const { data } = await supabase.auth.getSession();
            const email = data.session?.user?.email ?? "";
            const userName = email.split("@")[0] || "Trader";
            settings = mergeSettings({ userName, email });
            goals = SAMPLE_GOALS;
            portfolioTargets = DEFAULT_PORTFOLIO_TARGETS;
            mtfAccountValue = 0;
            // Create the complete four-column row via the single shared writer (D3).
            await putCompleteSettings({ goals, portfolioTargets, settings, mtfAccountValue });
          }

          set({
            trades: stripUserId(trades),
            accounts: stripUserId(accounts),
            cashTransactions: stripUserId(cash),
            journal: stripUserId(journal),
            watchlist: stripUserId(watchlist),
            goals,
            portfolioTargets,
            settings,
            hydrated: true,
            hydrateError: null,
          });
          // accountValue lives in the same settings row — hand it to the MTF store
          // rather than issuing a second GET /api/settings (D4).
          useMtfStore.setState({ accountValue: mtfAccountValue });
        } catch (e) {
          set({ hydrateError: e instanceof Error ? e.message : "Failed to load your data", hydrated: false });
        }
      },

      addTrade: (trade) => {
        set((s) => ({ trades: [...s.trades, trade] }));
        bg("trade", api.post(P.trades, trade));
      },
      updateTrade: (id, patch) => {
        set((s) => ({ trades: s.trades.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
        bg("trade", api.patch(`${P.trades}/${eid(id)}`, patch));
      },
      deleteTrade: (id) => {
        set((s) => ({ trades: s.trades.filter((t) => t.id !== id) }));
        bg("trade", api.del(`${P.trades}/${eid(id)}`));
      },
      deleteTrades: (ids) => {
        set((s) => ({ trades: s.trades.filter((t) => !ids.includes(t.id)) }));
        if (ids.length) bg("trades", api.del(P.trades, { ids }));
      },

      closeTrade: (id, exitPrice, closedAt, manualTotal, manualMtfInterest) => {
        const { settings, trades } = get();
        const t = trades.find((x) => x.id === id);
        if (!t || t.status !== "Open") return;
        const isManual = manualTotal !== undefined;
        const segment = t.segment ?? defaultSegmentFor(t.assetClass, isIntraday(t.openedAt, closedAt));
        const intraday = segment === "Intraday";
        const grossPnl = computeGrossPnl(t.direction, t.entryPrice, exitPrice, t.quantity);
        const charges = isManual
          ? manualChargesBreakdown(manualTotal, manualMtfInterest ?? 0)
          : computeCharges({
              assetClass: t.assetClass,
              segment,
              exchange: t.exchange ?? "NSE",
              quantity: t.quantity,
              entryPrice: t.entryPrice,
              exitPrice,
              direction: t.direction,
              rates: settings.chargeRates,
              mtfInterest: manualMtfInterest ?? 0,
            });
        const netPnl = Math.round((grossPnl - charges.total) * 100) / 100;
        const holdingMinutes = holdingMinutesBetween(t.openedAt, closedAt);
        const category = taxCategoryFor(t.assetClass, holdingMinutes, intraday);
        const taxablePnl = computeTaxablePnl(grossPnl, charges, category);
        const tax = computeTax(taxablePnl, category, settings.taxRates);
        const closed: Trade = {
          ...t,
          status: "Closed",
          segment,
          exitPrice,
          closedAt,
          holdingMinutes,
          grossPnl,
          charges,
          manualCharges: isManual,
          netPnl,
          taxablePnl,
          tax,
          rMultiple: computeRMultiple(netPnl, t.riskAmount),
        };
        set((s) => ({ trades: s.trades.map((x) => (x.id === id ? closed : x)) }));
        bg("trade", api.patch(`${P.trades}/${eid(id)}`, closed));
      },

      importTrades: (trades) => {
        set((s) => ({ trades: [...s.trades, ...trades] }));
        if (trades.length) bg("trades", api.post(P.trades, trades));
      },

      addJournalEntry: (entry) => {
        set((s) => ({ journal: [entry, ...s.journal] }));
        bg("journal entry", api.post(P.journal, entry));
      },
      updateJournalEntry: (id, patch) => {
        set((s) => ({ journal: s.journal.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
        bg("journal entry", api.patch(`${P.journal}/${eid(id)}`, patch));
      },
      deleteJournalEntry: (id) => {
        set((s) => ({ journal: s.journal.filter((e) => e.id !== id) }));
        bg("journal entry", api.del(`${P.journal}/${eid(id)}`));
      },

      addAccount: (account) => {
        set((s) => ({ accounts: [...s.accounts, account] }));
        bg("account", api.post(P.accounts, account));
      },
      updateAccount: (id, patch) => {
        set((s) => ({ accounts: s.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)) }));
        bg("account", api.patch(`${P.accounts}/${eid(id)}`, patch));
      },
      deleteAccount: (id) => {
        // Client-side cascade — the API deliberately does NOT cascade on accountId.
        const { trades, cashTransactions } = get();
        const tradeIds = trades.filter((t) => t.accountId === id).map((t) => t.id);
        const cashIds = cashTransactions.filter((c) => c.accountId === id).map((c) => c.id);
        set((s) => ({
          accounts: s.accounts.filter((a) => a.id !== id),
          trades: s.trades.filter((t) => t.accountId !== id),
          cashTransactions: s.cashTransactions.filter((c) => c.accountId !== id),
          filters: s.filters.accountId === id ? { ...s.filters, accountId: "all" } : s.filters,
        }));
        bg("account", api.del(`${P.accounts}/${eid(id)}`));
        if (tradeIds.length) bg("account trades", api.del(P.trades, { ids: tradeIds }));
        if (cashIds.length) bg("account cash", api.del(P.cash, { ids: cashIds }));
      },

      addCashTransaction: (txn) => {
        set((s) => ({ cashTransactions: [txn, ...s.cashTransactions] }));
        bg("cash transaction", api.post(P.cash, txn));
      },
      deleteCashTransaction: (id) => {
        set((s) => ({ cashTransactions: s.cashTransactions.filter((c) => c.id !== id) }));
        bg("cash transaction", api.del(`${P.cash}/${eid(id)}`));
      },

      addWatchItem: (item) => {
        set((s) => ({ watchlist: [item, ...s.watchlist] }));
        bg("watchlist item", api.post(P.watchlist, item));
      },
      updateWatchItem: (id, patch) => {
        set((s) => ({ watchlist: s.watchlist.map((w) => (w.id === id ? { ...w, ...patch } : w)) }));
        bg("watchlist item", api.patch(`${P.watchlist}/${eid(id)}`, patch));
      },
      removeWatchItem: (id) => {
        set((s) => ({ watchlist: s.watchlist.filter((w) => w.id !== id) }));
        bg("watchlist item", api.del(`${P.watchlist}/${eid(id)}`));
      },

      setGoals: (goals) => {
        set({ goals });
        scheduleSettingsSync();
      },
      setTargetPercents: (percents) => {
        set((s) => ({ portfolioTargets: { ...s.portfolioTargets, percents } }));
        scheduleSettingsSync();
      },
      setMonthCapital: (yearMonth, value) => {
        set((s) => {
          const capitalByMonth = { ...s.portfolioTargets.capitalByMonth };
          if (value > 0) capitalByMonth[yearMonth] = value;
          else delete capitalByMonth[yearMonth];
          return { portfolioTargets: { ...s.portfolioTargets, capitalByMonth } };
        });
        scheduleSettingsSync();
      },
      updateSettings: (patch) => {
        set((s) => ({ settings: { ...s.settings, ...patch } }));
        scheduleSettingsSync();
      },
      setFilters: (patch) => set((s) => ({ filters: { ...s.filters, ...patch } })),

      resetSampleData: () => {
        const prev = get();
        const sample = freshSample();
        set({ ...sample, filters: DEFAULT_FILTERS });
        scheduleSettingsSync(); // push reset goals/portfolioTargets (+ MTF value) via the single writer
        bg(
          "reset",
          (async () => {
            await Promise.all([
              bulkDelete(P.trades, prev.trades),
              bulkDelete(P.accounts, prev.accounts),
              bulkDelete(P.cash, prev.cashTransactions),
              bulkDelete(P.journal, prev.journal),
              bulkDelete(P.watchlist, prev.watchlist),
            ]);
            await Promise.all([
              bulkInsert(P.trades, sample.trades),
              bulkInsert(P.accounts, sample.accounts),
              bulkInsert(P.cash, sample.cashTransactions),
              bulkInsert(P.journal, sample.journal),
              bulkInsert(P.watchlist, sample.watchlist),
            ]);
          })(),
        );
      },
      clearAllData: () => {
        const prev = get();
        set({
          trades: [],
          cashTransactions: [],
          journal: [],
          watchlist: [],
          accounts: SAMPLE_ACCOUNTS,
          portfolioTargets: DEFAULT_PORTFOLIO_TARGETS,
          filters: DEFAULT_FILTERS,
        });
        scheduleSettingsSync(); // push reset portfolioTargets (+ MTF value) via the single writer
        bg(
          "clear",
          (async () => {
            await Promise.all([
              bulkDelete(P.trades, prev.trades),
              bulkDelete(P.cash, prev.cashTransactions),
              bulkDelete(P.journal, prev.journal),
              bulkDelete(P.watchlist, prev.watchlist),
              bulkDelete(P.accounts, prev.accounts),
            ]);
            await bulkInsert(P.accounts, SAMPLE_ACCOUNTS);
          })(),
        );
      },
    }),
    {
      // NEW key — persists ONLY filters. The old "ledgerx-store" is left untouched.
      name: "ledgerx-ui",
      partialize: (s) => ({ filters: s.filters }),
    },
  ),
);

/** Next sequential trade id, e.g. "T-0241". */
export function nextTradeId(trades: Trade[]): string {
  const max = trades.reduce((m, t) => {
    const n = Number(t.id.replace(/\D/g, ""));
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 0);
  return `T-${String(max + 1).padStart(4, "0")}`;
}

/** Next sequential cash-transaction id, e.g. "CF-06". */
export function nextCashId(txns: CashTransaction[]): string {
  const max = txns.reduce((m, t) => {
    const n = Number(t.id.replace(/\D/g, ""));
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 0);
  return `CF-${String(max + 1).padStart(2, "0")}`;
}
