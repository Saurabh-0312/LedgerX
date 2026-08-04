/** Dashboard tile — this month vs last month on the key numbers, with signed deltas. */

import { useMemo } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { Trade } from "@/types";
import { monthLabel, monthlyPnl } from "@/lib/metrics";
import { datasetToday } from "@/store/useFilteredTrades";
import { formatMoney, formatNumber, formatPct, pnlClass } from "@/lib/format";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

interface MonthTotals {
  pnl: number;
  trades: number;
  winRate: number;
  charges: number;
}

const EMPTY_MONTH: MonthTotals = { pnl: 0, trades: 0, winRate: 0, charges: 0 };

interface RowDef {
  label: string;
  current: number;
  previous: number;
  format: (v: number) => string;
  deltaFormat: (d: number) => string;
  /** is a rising number good here? null = neutral metric (no judgement color) */
  upIsGood: boolean | null;
  /** color the current value by its sign (P&L row) */
  toneBySign?: boolean;
}

const keyOf = (year: number, month0: number) => `${year}-${String(month0 + 1).padStart(2, "0")}`;

/** shared column template so header and rows line up */
const ROW_GRID = "grid grid-cols-[minmax(0,1fr)_92px_88px] items-center gap-2";

export function MonthCompareCard({ trades }: { trades: Trade[] }) {
  const cmp = useMemo(() => {
    const today = datasetToday(trades);
    const thisKey = keyOf(today.getFullYear(), today.getMonth());
    const prevAnchor = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastKey = keyOf(prevAnchor.getFullYear(), prevAnchor.getMonth());
    const months = monthlyPnl(trades);
    const pick = (key: string): MonthTotals => {
      const m = months.find((x) => x.month === key);
      return m ? { pnl: m.pnl, trades: m.trades, winRate: m.winRate, charges: m.charges } : EMPTY_MONTH;
    };
    return {
      thisKey,
      lastKey,
      cur: pick(thisKey),
      prev: pick(lastKey),
      hasAny: months.some((m) => m.month === thisKey || m.month === lastKey),
    };
  }, [trades]);

  const rows: RowDef[] = [
    {
      label: "Net P&L",
      current: cmp.cur.pnl,
      previous: cmp.prev.pnl,
      format: (v) => formatMoney(v, { compact: true, sign: true }),
      deltaFormat: (d) => formatMoney(d, { compact: true, sign: true }),
      upIsGood: true,
      toneBySign: true,
    },
    {
      label: "Trades",
      current: cmp.cur.trades,
      previous: cmp.prev.trades,
      format: (v) => formatNumber(v),
      deltaFormat: (d) => (d > 0 ? `+${formatNumber(d)}` : d < 0 ? `−${formatNumber(Math.abs(d))}` : "±0"),
      upIsGood: null,
    },
    {
      label: "Win rate",
      current: cmp.cur.winRate,
      previous: cmp.prev.winRate,
      format: (v) => formatPct(v, 1),
      deltaFormat: (d) => formatPct(d, 1, true),
      upIsGood: true,
    },
    {
      label: "Charges",
      current: cmp.cur.charges,
      previous: cmp.prev.charges,
      format: (v) => formatMoney(v, { compact: true }),
      deltaFormat: (d) => formatMoney(d, { compact: true, sign: true }),
      upIsGood: false,
    },
  ];

  return (
    <Card
      className="h-full"
      title="This month vs last month"
      subtitle={`${monthLabel(cmp.thisKey)} compared with ${monthLabel(cmp.lastKey)}`}
    >
      {!cmp.hasAny ? (
        <EmptyState
          title="No recent activity"
          hint="No closed trades in the last two months of the selected range."
        />
      ) : (
        <div>
          <div className={`${ROW_GRID} pb-1.5`}>
            <span aria-hidden />
            <span className="label-caps text-right">This month</span>
            <span className="label-caps text-right">vs last</span>
          </div>
          {rows.map((r) => {
            const d = r.current - r.previous;
            const dir: "up" | "down" | "flat" = d > 1e-9 ? "up" : d < -1e-9 ? "down" : "flat";
            const tone =
              dir === "flat" || r.upIsGood === null
                ? "text-muted"
                : (dir === "up") === r.upIsGood
                  ? "text-profit"
                  : "text-loss";
            return (
              <div key={r.label} className={`${ROW_GRID} border-t border-edge-soft py-3`}>
                <span className="truncate text-[12px] text-muted">{r.label}</span>
                <span
                  className={`tnum text-right text-[13px] font-semibold ${r.toneBySign ? pnlClass(r.current) : "text-ink"}`}
                  title={`Last month: ${r.format(r.previous)}`}
                >
                  {r.format(r.current)}
                </span>
                <span className={`tnum flex items-center justify-end gap-1 text-[11px] font-medium ${tone}`}>
                  {dir === "up" && <ArrowUpRight size={12} aria-hidden />}
                  {dir === "down" && <ArrowDownRight size={12} aria-hidden />}
                  {dir === "flat" && <Minus size={12} aria-hidden />}
                  {r.deltaFormat(d)}
                </span>
              </div>
            );
          })}
          <p className="mt-3 text-[11px] text-faint">
            Anchored to the latest activity in the selected range.
          </p>
        </div>
      )}
    </Card>
  );
}
