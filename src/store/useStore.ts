/** Global app store — zustand + localStorage persistence.
 *  Pages read state with selectors and mutate ONLY through these actions. */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Account,
  AppSettings,
  CashTransaction,
  ChargesBreakdown,
  GlobalFilters,
  Goals,
  JournalEntry,
  PortfolioTargets,
  TaxCategory,
  TaxRates,
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

const DEFAULT_PORTFOLIO_TARGETS: PortfolioTargets = { percents: [3, 4, 6, 7.2], capitalByMonth: {} };

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      ...freshSample(),
      settings: DEFAULT_SETTINGS,
      filters: DEFAULT_FILTERS,

      addTrade: (trade) => set((s) => ({ trades: [...s.trades, trade] })),
      updateTrade: (id, patch) =>
        set((s) => ({ trades: s.trades.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
      deleteTrade: (id) => set((s) => ({ trades: s.trades.filter((t) => t.id !== id) })),
      deleteTrades: (ids) =>
        set((s) => ({ trades: s.trades.filter((t) => !ids.includes(t.id)) })),

      closeTrade: (id, exitPrice, closedAt, manualTotal, manualMtfInterest) => {
        const { settings } = get();
        const isManual = manualTotal !== undefined;
        set((s) => ({
          trades: s.trades.map((t) => {
            if (t.id !== id || t.status !== "Open") return t;
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
            return {
              ...t,
              status: "Closed" as const,
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
          }),
        }));
      },

      importTrades: (trades) => set((s) => ({ trades: [...s.trades, ...trades] })),

      addJournalEntry: (entry) => set((s) => ({ journal: [entry, ...s.journal] })),
      updateJournalEntry: (id, patch) =>
        set((s) => ({ journal: s.journal.map((e) => (e.id === id ? { ...e, ...patch } : e)) })),
      deleteJournalEntry: (id) => set((s) => ({ journal: s.journal.filter((e) => e.id !== id) })),

      addAccount: (account) => set((s) => ({ accounts: [...s.accounts, account] })),
      updateAccount: (id, patch) =>
        set((s) => ({ accounts: s.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)) })),
      deleteAccount: (id) =>
        set((s) => ({
          accounts: s.accounts.filter((a) => a.id !== id),
          trades: s.trades.filter((t) => t.accountId !== id),
          cashTransactions: s.cashTransactions.filter((c) => c.accountId !== id),
          filters: s.filters.accountId === id ? { ...s.filters, accountId: "all" } : s.filters,
        })),

      addCashTransaction: (txn) => set((s) => ({ cashTransactions: [txn, ...s.cashTransactions] })),
      deleteCashTransaction: (id) =>
        set((s) => ({ cashTransactions: s.cashTransactions.filter((c) => c.id !== id) })),

      addWatchItem: (item) => set((s) => ({ watchlist: [item, ...s.watchlist] })),
      updateWatchItem: (id, patch) =>
        set((s) => ({ watchlist: s.watchlist.map((w) => (w.id === id ? { ...w, ...patch } : w)) })),
      removeWatchItem: (id) => set((s) => ({ watchlist: s.watchlist.filter((w) => w.id !== id) })),

      setGoals: (goals) => set({ goals }),
      setTargetPercents: (percents) =>
        set((s) => ({ portfolioTargets: { ...s.portfolioTargets, percents } })),
      setMonthCapital: (yearMonth, value) =>
        set((s) => {
          const capitalByMonth = { ...s.portfolioTargets.capitalByMonth };
          if (value > 0) capitalByMonth[yearMonth] = value;
          else delete capitalByMonth[yearMonth];
          return { portfolioTargets: { ...s.portfolioTargets, capitalByMonth } };
        }),
      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      setFilters: (patch) => set((s) => ({ filters: { ...s.filters, ...patch } })),

      resetSampleData: () => set({ ...freshSample(), filters: DEFAULT_FILTERS }),
      clearAllData: () =>
        set({
          trades: [],
          cashTransactions: [],
          journal: [],
          watchlist: [],
          accounts: SAMPLE_ACCOUNTS,
          portfolioTargets: DEFAULT_PORTFOLIO_TARGETS,
          filters: DEFAULT_FILTERS,
        }),
    }),
    {
      name: "ledgerx-store",
      version: 7,
      // v1 → v2: backfill charges.manual (manual/MTF charge entry).
      // v2 → v3: backfill new-regime tax-rate params + seed the new top-level keys
      // (cashTransactions, portfolioTargets) EMPTY for existing users, so the
      // shallow-merge with the default store doesn't inject sample data into them.
      // v3 → v4: split manual charges — backfill charges.mtfInterest (0 for existing
      // trades; the whole manual figure stays under charges.manual until re-edited).
      // v4 → v5: product segments + correct tax base. Backfill trade.segment and
      // trade.taxablePnl (recomputing per-trade tax on the deductible-only base),
      // add the Groww MTF-interest / min-brokerage rate-card fields.
      // v5 → v6: NSE/BSE exchange toggle. Backfill trade.exchange = "NSE" and the
      // BSE equity exchange-txn rate (existing charges unchanged, all were NSE).
      // v6 → v7: MTF pledge/unpledge charges. Backfill charges.pledgeCharges = 0
      // (existing trades never recorded it) + the pledge rate-card field.
      migrate: (persisted: unknown) => {
        const s = persisted as
          | {
              trades?: unknown[];
              settings?: {
                taxRates?: Record<string, number>;
                chargeRates?: Record<string, number>;
              };
              cashTransactions?: unknown[];
              portfolioTargets?: unknown;
            }
          | undefined;
        if (s && !("cashTransactions" in s)) s.cashTransactions = [];
        if (s && !("portfolioTargets" in s)) {
          s.portfolioTargets = { percents: [3, 4, 6, 7.2], capitalByMonth: {} };
        }
        if (s && s.settings && s.settings.taxRates) {
          s.settings.taxRates = {
            basicExemption: 400000,
            ltcgExemption: 125000,
            rebate87ALimit: 1200000,
            rebate87AMax: 60000,
            cessPct: 4,
            ...s.settings.taxRates, // keep any user-customised values
          };
        }
        // charge rate card: add new keys; adopt Groww values where still on old defaults
        if (s && s.settings && s.settings.chargeRates) {
          const cr = s.settings.chargeRates;
          if (cr.minBrokeragePerOrder === undefined) cr.minBrokeragePerOrder = 5;
          if (cr.mtfInterestAnnualPct === undefined) cr.mtfInterestAnnualPct = 14.95;
          if (cr.brokeragePctPerOrder === 0.03) cr.brokeragePctPerOrder = 0.1;
          if (cr.dpChargePerSell === 15.93) cr.dpChargePerSell = 20;
          if (cr.exchangeEquityBsePct === undefined) cr.exchangeEquityBsePct = 0.00375;
          if (cr.pledgeChargePerRequest === undefined) cr.pledgeChargePerRequest = 20;
        }
        const taxRates = (s?.settings?.taxRates ?? DEFAULT_TAX_RATES) as unknown as TaxRates;
        if (s && Array.isArray(s.trades)) {
          s.trades = s.trades.map((t) => {
            const trade = t as {
              assetClass?: string;
              segment?: string;
              exchange?: string;
              status?: string;
              grossPnl?: number;
              charges?: ChargesBreakdown & Record<string, number>;
              tax?: { category?: TaxCategory };
              taxablePnl?: number;
            };
            if (trade.exchange === undefined) trade.exchange = "NSE";
            if (trade.charges && trade.charges.manual === undefined) {
              trade.charges = { ...trade.charges, manual: 0 };
            }
            if (trade.charges && trade.charges.mtfInterest === undefined) {
              trade.charges = { ...trade.charges, mtfInterest: 0 };
            }
            if (trade.charges && trade.charges.pledgeCharges === undefined) {
              trade.charges = { ...trade.charges, pledgeCharges: 0 };
            }
            const category: TaxCategory = trade.tax?.category ?? "Intraday";
            if (trade.segment === undefined) {
              const isEquity = trade.assetClass === "Equity";
              const isIntradayCat = category === "Intraday";
              trade.segment = isEquity
                ? (trade.charges?.mtfInterest ?? 0) > 0
                  ? "MTF"
                  : isIntradayCat
                    ? "Intraday"
                    : "Delivery"
                : defaultSegmentFor((trade.assetClass ?? "Equity") as never, isIntradayCat);
            }
            if (trade.taxablePnl === undefined) {
              if (trade.status === "Closed" && trade.charges) {
                trade.taxablePnl = computeTaxablePnl(trade.grossPnl ?? 0, trade.charges, category);
                (trade as { tax?: unknown }).tax = computeTax(trade.taxablePnl, category, taxRates);
              } else {
                trade.taxablePnl = 0;
              }
            }
            return trade;
          });
        }
        return s as unknown as StoreState;
      },
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
