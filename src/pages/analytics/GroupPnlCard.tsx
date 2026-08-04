/** Horizontal "P&L by <dimension>" bar card — symbol / strategy / tag breakdowns.
 *  Ranks groups by |net P&L|, keeps the top N, and orders bars best → worst. */

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3 } from "lucide-react";
import type { GroupPerf } from "@/lib/metrics";
import type { Currency } from "@/lib/format";
import { formatMoney, formatNumber, formatPct, pnlMarkColor } from "@/lib/format";
import {
  axisDefaults,
  BAR_MAX,
  BAR_RADIUS_H,
  CURSOR_FILL,
  GRID,
  gridDefaults,
} from "@/components/charts/chartTheme";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

const ROW_HEIGHT = 28;

interface GroupPnlCardProps {
  title: string;
  subtitle: string;
  groups: GroupPerf[];
  currency: Currency;
  /** keep the N biggest movers by absolute net P&L (default 10) */
  top?: number;
  emptyTitle?: string;
  emptyHint?: string;
}

export function GroupPnlCard({
  title,
  subtitle,
  groups,
  currency,
  top = 10,
  emptyTitle = "Nothing to chart",
  emptyHint = "No closed trades in the selected range.",
}: GroupPnlCardProps) {
  const rows = useMemo(
    () =>
      [...groups]
        .sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl))
        .slice(0, top)
        .sort((a, b) => b.pnl - a.pnl),
    [groups, top],
  );

  return (
    <Card title={title} subtitle={subtitle}>
      {rows.length === 0 ? (
        <EmptyState icon={BarChart3} title={emptyTitle} hint={emptyHint} className="py-8" />
      ) : (
        <ResponsiveContainer width="100%" height={rows.length * ROW_HEIGHT + 40}>
          <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid {...gridDefaults} horizontal={false} vertical />
            <XAxis
              type="number"
              {...axisDefaults}
              tickFormatter={(v: number) => formatMoney(v, { currency, compact: true })}
            />
            <YAxis type="category" dataKey="name" width={90} interval={0} {...axisDefaults} />
            <ReferenceLine x={0} stroke={GRID} />
            <Tooltip
              content={
                <ChartTooltip
                  valueFormatter={(v, entry) => {
                    const row = entry.payload as unknown as GroupPerf | undefined;
                    const base = formatMoney(v, { currency, sign: true });
                    return row
                      ? `${base} · ${formatNumber(row.trades)} trades · ${formatPct(row.winRate, 0)} win`
                      : base;
                  }}
                />
              }
              cursor={{ fill: CURSOR_FILL }}
            />
            <Bar dataKey="pnl" name="Net P&L" maxBarSize={BAR_MAX} radius={BAR_RADIUS_H}>
              {rows.map((r) => (
                <Cell key={r.name} fill={pnlMarkColor(r.pnl)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
