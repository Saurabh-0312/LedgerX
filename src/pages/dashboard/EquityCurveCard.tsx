/** Dashboard hero chart — cumulative account equity as a violet gradient area. */

import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity } from "lucide-react";
import type { Trade } from "@/types";
import { equityCurve } from "@/lib/metrics";
import { formatDate, formatDateShort, formatMoney } from "@/lib/format";
import { ACCENT, GRID, axisDefaults, gridDefaults } from "@/components/charts/chartTheme";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

export function EquityCurveCard({
  trades,
  capital,
  cashFlows = [],
}: {
  trades: Trade[];
  capital: number;
  cashFlows?: { date: string; amount: number }[];
}) {
  const points = useMemo(() => equityCurve(trades, capital, cashFlows), [trades, capital, cashFlows]);

  return (
    <Card title="Equity curve" subtitle="Account value — trading P&L plus deposits & withdrawals">
      {points.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No closed trades in range"
          hint="Close a trade or widen the global date range to see your equity curve."
        />
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="dashEquityFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={ACCENT} stopOpacity={0.25} />
                <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid {...gridDefaults} />
            <XAxis
              {...axisDefaults}
              dataKey="date"
              tickFormatter={(v: string) => formatDateShort(v)}
              minTickGap={28}
              tickMargin={8}
            />
            <YAxis
              {...axisDefaults}
              tickFormatter={(v: number) => formatMoney(v, { compact: true })}
              domain={["auto", "auto"]}
              width={64}
            />
            <Tooltip
              content={
                <ChartTooltip
                  valueFormatter={(v) => formatMoney(v, { compact: true })}
                  labelFormatter={(l) => formatDate(String(l))}
                />
              }
              cursor={{ stroke: GRID }}
            />
            <Area
              type="monotone"
              dataKey="equity"
              name="Equity"
              stroke={ACCENT}
              strokeWidth={2}
              fill="url(#dashEquityFill)"
              dot={false}
              activeDot={{ r: 4, stroke: "#141619", strokeWidth: 2, fill: ACCENT }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
