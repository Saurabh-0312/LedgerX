/** Vertical P&L column card — asset-class / day-of-week / hour-of-day breakdowns.
 *  Bars are colored by sign; tooltip carries trade count and win rate. */

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
  BAR_RADIUS,
  CURSOR_FILL,
  GRID,
  gridDefaults,
} from "@/components/charts/chartTheme";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

interface PnlColumnCardProps {
  title: string;
  subtitle: string;
  data: GroupPerf[];
  /** category-axis key — "name" (default) or "label" for hour-of-day rows */
  xKey?: string;
  currency: Currency;
  height?: number;
  emptyHint?: string;
}

export function PnlColumnCard({
  title,
  subtitle,
  data,
  xKey = "name",
  currency,
  height = 240,
  emptyHint = "No closed trades in the selected range.",
}: PnlColumnCardProps) {
  return (
    <Card title={title} subtitle={subtitle}>
      {data.length === 0 ? (
        <EmptyState icon={BarChart3} title="Nothing to chart" hint={emptyHint} className="py-8" />
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid {...gridDefaults} />
            <XAxis dataKey={xKey} {...axisDefaults} minTickGap={8} />
            <YAxis
              {...axisDefaults}
              width={52}
              tickFormatter={(v: number) => formatMoney(v, { currency, compact: true })}
            />
            <ReferenceLine y={0} stroke={GRID} />
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
            <Bar dataKey="pnl" name="Net P&L" maxBarSize={BAR_MAX} radius={BAR_RADIUS}>
              {data.map((g) => (
                <Cell key={g.name} fill={pnlMarkColor(g.pnl)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
