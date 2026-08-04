/** Category summary cards — Intraday / STCG / LTCG / Crypto tiles for the Tax Report. */

import type { TaxCategory, TaxRates } from "@/types";
import type { Currency } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { formatMoney, formatNumber, pnlClass } from "@/lib/format";
import type { CategoryAgg } from "./taxMeta";
import { CATEGORY_META, TAX_CATEGORIES, ratePctLabel } from "./taxMeta";

interface CategoryCardsProps {
  aggs: Record<TaxCategory, CategoryAgg>;
  rates: TaxRates;
  currency: Currency;
}

export function CategoryCards({ aggs, rates, currency }: CategoryCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
      {TAX_CATEGORIES.map((cat) => {
        const meta = CATEGORY_META[cat];
        const agg = aggs[cat];
        const rate = meta.rateOf(rates);
        const hasTrades = agg.trades > 0;
        return (
          <div key={cat} className="card p-4" title={meta.blurb}>
            <div className="flex items-center justify-between gap-2">
              <Badge tone={meta.tone}>{cat}</Badge>
              <span className="tnum rounded-md border border-edge bg-raised px-1.5 py-0.5 text-[11px] text-muted">
                @ {ratePctLabel(rate)}
              </span>
            </div>

            <div
              className={`mt-3 text-[20px] font-semibold leading-tight tracking-tight ${pnlClass(agg.netPnl)}`}
            >
              {hasTrades ? formatMoney(agg.netPnl, { currency, sign: true }) : "—"}
            </div>
            <div className="mt-0.5 text-[11px] text-muted">
              {hasTrades
                ? `Realized net P&L · ${formatNumber(agg.trades)} trade${agg.trades === 1 ? "" : "s"}`
                : "No trades this FY"}
            </div>

            <dl className="mt-3 space-y-1.5 border-t border-edge-soft pt-3 text-[12px]">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted">Taxable</dt>
                <dd className="tnum text-ink">{formatMoney(agg.taxable, { currency })}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted">Est. tax</dt>
                <dd className={`tnum ${agg.tax > 0 ? "font-semibold text-warning" : "text-muted"}`}>
                  {formatMoney(agg.tax, { currency })}
                </dd>
              </div>
            </dl>

            <p className="mt-2 text-[11px] leading-snug text-faint">{meta.rateLabel} · configurable in Settings</p>
          </div>
        );
      })}
    </div>
  );
}
