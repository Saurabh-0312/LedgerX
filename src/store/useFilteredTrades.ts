/** Global date-range + account filtering — every page derives its data from this
 *  so the topbar filters drive the entire app consistently. */

import { useMemo } from "react";
import type { RangePreset, Trade } from "@/types";
import { useStore } from "./useStore";

/** Anchor "today" = latest activity in the dataset, so sample data always looks alive. */
export function datasetToday(trades: Trade[]): Date {
  let max = 0;
  for (const t of trades) {
    max = Math.max(max, new Date(t.closedAt ?? t.openedAt).getTime());
  }
  return max ? new Date(max) : new Date();
}

export function rangeForPreset(
  preset: RangePreset,
  today: Date,
  custom: { from: string | null; to: string | null },
): { from: Date | null; to: Date | null } {
  const endOfToday = new Date(today);
  endOfToday.setHours(23, 59, 59, 999);
  const daysAgo = (n: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() - n);
    d.setHours(0, 0, 0, 0);
    return d;
  };
  switch (preset) {
    case "7d":
      return { from: daysAgo(6), to: endOfToday }; // today + prior 6 days = 7
    case "30d":
      return { from: daysAgo(29), to: endOfToday };
    case "90d":
      return { from: daysAgo(89), to: endOfToday };
    case "ytd":
      return { from: new Date(today.getFullYear(), 0, 1), to: endOfToday };
    case "thisMonth":
      return { from: new Date(today.getFullYear(), today.getMonth(), 1), to: endOfToday };
    case "lastMonth": {
      const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const to = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);
      return { from, to };
    }
    case "custom":
      return {
        // parse both boundaries in local time so the from-date isn't shifted by TZ
        from: custom.from ? new Date(`${custom.from}T00:00:00`) : null,
        to: custom.to ? new Date(`${custom.to}T23:59:59`) : null,
      };
    case "all":
    default:
      return { from: null, to: null };
  }
}

export const PRESET_LABELS: Record<RangePreset, string> = {
  all: "All time",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  ytd: "Year to date",
  thisMonth: "This month",
  lastMonth: "Last month",
  custom: "Custom range",
};

/** Trades filtered by the global topbar filters (date range on close-or-open date + account). */
export function useFilteredTrades(): Trade[] {
  const trades = useStore((s) => s.trades);
  const filters = useStore((s) => s.filters);

  return useMemo(() => {
    const today = datasetToday(trades);
    const { from, to } = rangeForPreset(filters.preset, today, {
      from: filters.from,
      to: filters.to,
    });
    return trades.filter((t) => {
      if (filters.accountId !== "all" && t.accountId !== filters.accountId) return false;
      const when = new Date(t.closedAt ?? t.openedAt);
      if (from && when < from) return false;
      if (to && when > to) return false;
      return true;
    });
  }, [trades, filters]);
}

/** Cash-flow deltas (+deposit / −withdrawal) scoped by the same global account +
 *  date-range filters, for the equity curve. */
export function useFilteredCashFlows(): { date: string; amount: number }[] {
  const cashTransactions = useStore((s) => s.cashTransactions);
  const trades = useStore((s) => s.trades);
  const filters = useStore((s) => s.filters);

  return useMemo(() => {
    const today = datasetToday(trades);
    const { from, to } = rangeForPreset(filters.preset, today, { from: filters.from, to: filters.to });
    return cashTransactions
      .filter((c) => filters.accountId === "all" || c.accountId === filters.accountId)
      .filter((c) => {
        const when = new Date(c.date);
        if (from && when < from) return false;
        if (to && when > to) return false;
        return true;
      })
      .map((c) => ({ date: c.date.slice(0, 10), amount: c.type === "deposit" ? c.amount : -c.amount }));
  }, [cashTransactions, trades, filters]);
}

/** Convenience: currency of the current scope (account currency or base). */
export function useScopeCurrency(): "INR" | "USD" {
  const filters = useStore((s) => s.filters);
  const accounts = useStore((s) => s.accounts);
  const base = useStore((s) => s.settings.baseCurrency);
  if (filters.accountId === "all") return base;
  return accounts.find((a) => a.id === filters.accountId)?.currency ?? base;
}
