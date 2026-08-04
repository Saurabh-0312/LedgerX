/** Quarter-vs-quarter comparison — grouped bars per calendar-year quarter,
 *  so Q1 of one year sits beside Q1 of the next. Quarters here are plain
 *  calendar quarters (Q1 = Jan–Mar … Q4 = Oct–Dec) — this is a personal ledger,
 *  not a tax view. Spans ALL years (not scoped by the monthly year filter);
 *  the global account filter still applies. */

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useStore } from "@/store/useStore";
import { closedOf } from "@/lib/metrics";
import { formatMoney } from "@/lib/format";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { CAT, CURSOR_FILL, GRID, axisDefaults, gridDefaults, BAR_RADIUS } from "@/components/charts/chartTheme";

const QUARTERS = ["Q1 · Jan–Mar", "Q2 · Apr–Jun", "Q3 · Jul–Sep", "Q4 · Oct–Dec"];

/** Calendar year + quarter index (0–3) for an ISO date, Q1 starting 1 January. */
function yearQuarterOf(iso: string): { year: number; quarter: number } {
  const d = new Date(iso);
  return { year: d.getFullYear(), quarter: Math.floor(d.getMonth() / 3) };
}

export function QuarterlyComparisonCard() {
  const allTrades = useStore((s) => s.trades);
  const accountId = useStore((s) => s.filters.accountId);

  const { data, fyKeys } = useMemo(() => {
    const closed = closedOf(
      accountId === "all" ? allTrades : allTrades.filter((t) => t.accountId === accountId),
    );
    // sums[year][quarter] — null quarters (no trades) render no bar
    const sums = new Map<string, (number | null)[]>();
    for (const t of closed) {
      const { year, quarter } = yearQuarterOf(t.closedAt!);
      const key = String(year);
      if (!sums.has(key)) sums.set(key, [null, null, null, null]);
      const row = sums.get(key)!;
      row[quarter] = (row[quarter] ?? 0) + t.netPnl;
    }
    const fyKeys = [...sums.keys()].sort();
    const data = QUARTERS.map((label, q) => {
      const point: Record<string, string | number | null> = { quarter: label };
      for (const key of fyKeys) point[key] = sums.get(key)![q] === null ? null : Math.round(sums.get(key)![q]!);
      return point;
    });
    return { data, fyKeys };
  }, [allTrades, accountId]);

  return (
    <Card
      title="Quarterly comparison"
      subtitle="Net profit per quarter, grouped by year — calendar quarters, Q1 starts 1 January"
    >
      {fyKeys.length === 0 ? (
        <EmptyState title="No closed trades yet" hint="Quarterly bars appear once trades close." />
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 8 }} barGap={4}>
            <CartesianGrid {...gridDefaults} />
            <XAxis {...axisDefaults} dataKey="quarter" />
            <YAxis
              {...axisDefaults}
              tickFormatter={(v: number) => formatMoney(v, { compact: true })}
              width={64}
            />
            <ReferenceLine y={0} stroke={GRID} />
            <Tooltip
              cursor={{ fill: CURSOR_FILL }}
              content={
                <ChartTooltip
                  hideZero={false}
                  valueFormatter={(v) => formatMoney(v, { sign: true, compact: true })}
                />
              }
            />
            <Legend wrapperStyle={{ fontSize: 12, color: "#8b929d" }} iconSize={10} />
            {fyKeys.map((key, i) => (
              <Bar
                key={key}
                name={key}
                dataKey={key}
                fill={CAT[i % CAT.length]}
                maxBarSize={24}
                radius={BAR_RADIUS}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
