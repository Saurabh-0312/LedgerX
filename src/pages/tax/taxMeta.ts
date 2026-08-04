/** Tax Report page helpers — category metadata, FY scoping and aggregation.
 *  Owned by the Tax Report page; not shared with other pages. */

import type { TaxCategory, TaxRates, Trade } from "@/types";
import type { BadgeTone } from "@/components/ui/Badge";
import { CAT } from "@/components/charts/chartTheme";
import { monthLabel } from "@/lib/metrics";

/** Closed trade with a guaranteed close date (the page filter narrows to this). */
export type ClosedTrade = Trade & { closedAt: string };

export const isClosedWithDate = (t: Trade): t is ClosedTrade =>
  t.status === "Closed" && typeof t.closedAt === "string";

/** Fixed display + stacking order for the four Indian tax buckets. */
export const TAX_CATEGORIES: readonly TaxCategory[] = ["Intraday", "STCG", "LTCG", "Crypto"];

export interface CategoryMeta {
  tone: BadgeTone;
  /** Chart identity color — fixed CAT slot, shared by the stacked chart. */
  color: string;
  blurb: string;
  rateLabel: string;
  rateOf: (r: TaxRates) => number;
}

export const CATEGORY_META: Record<TaxCategory, CategoryMeta> = {
  Intraday: {
    tone: "info",
    color: CAT[0],
    blurb: "Speculative business income, taxed at your assumed slab rate.",
    rateLabel: "slab assumption",
    rateOf: (r) => r.intradayPct,
  },
  STCG: {
    tone: "accent",
    color: CAT[1],
    blurb: "Short-term capital gains on positions held under 12 months.",
    rateLabel: "short-term gains",
    rateOf: (r) => r.stcgPct,
  },
  LTCG: {
    tone: "neutral",
    color: CAT[4],
    blurb: "Long-term capital gains on positions held 12 months or more.",
    rateLabel: "long-term gains",
    rateOf: (r) => r.ltcgPct,
  },
  Crypto: {
    tone: "warning",
    color: CAT[2],
    blurb: "Virtual digital assets — flat rate, no loss set-off allowed.",
    rateLabel: "flat VDA rate",
    rateOf: (r) => r.cryptoPct,
  },
};

/** "12.5" → "12.5%", "30" → "30%" */
export const ratePctLabel = (rate: number): string =>
  `${Number.isInteger(rate) ? rate.toFixed(0) : rate.toFixed(1)}%`;

export interface CategoryAgg {
  category: TaxCategory;
  netPnl: number;
  taxable: number;
  tax: number;
  trades: number;
}

const emptyAgg = (category: TaxCategory): CategoryAgg => ({
  category,
  netPnl: 0,
  taxable: 0,
  tax: 0,
  trades: 0,
});

export function buildCategoryAggs(trades: ClosedTrade[]): Record<TaxCategory, CategoryAgg> {
  const aggs: Record<TaxCategory, CategoryAgg> = {
    Intraday: emptyAgg("Intraday"),
    STCG: emptyAgg("STCG"),
    LTCG: emptyAgg("LTCG"),
    Crypto: emptyAgg("Crypto"),
  };
  for (const t of trades) {
    const a = aggs[t.tax.category];
    a.netPnl += t.netPnl;
    a.taxable += t.tax.taxableAmount;
    a.tax += t.tax.estimatedTax;
    a.trades += 1;
  }
  return aggs;
}

export interface TaxMonthRow {
  month: string; // yyyy-MM
  label: string; // "Apr 25"
  Intraday: number;
  STCG: number;
  LTCG: number;
  Crypto: number;
  netPnl: number;
  tax: number;
}

/** Per-month rows for the two charts: taxable amount per category + net P&L + est. tax. */
export function buildMonthRows(trades: ClosedTrade[]): TaxMonthRow[] {
  const map = new Map<string, TaxMonthRow>();
  for (const t of trades) {
    const key = t.closedAt.slice(0, 7);
    let row = map.get(key);
    if (!row) {
      row = { month: key, label: monthLabel(key), Intraday: 0, STCG: 0, LTCG: 0, Crypto: 0, netPnl: 0, tax: 0 };
      map.set(key, row);
    }
    row[t.tax.category] += t.tax.taxableAmount;
    row.netPnl += t.netPnl;
    row.tax += t.tax.estimatedTax;
  }
  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
}
