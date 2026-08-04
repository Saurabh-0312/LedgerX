/** Overall cumulative profit — running net P&L aggregated by month from the very
 *  first trade to the last, starting from ₹0 (profit accrued, not account value).
 *  Full-width hero chart. Respects the global date-range + account filters. */

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingUp } from "lucide-react";
import type { Trade } from "@/types";
import { monthlyPnl } from "@/lib/metrics";
import { formatMoney, pnlClass } from "@/lib/format";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { ACCENT, GRID, axisDefaults, gridDefaults } from "@/components/charts/chartTheme";

export function OverallCumulativeCard({ trades }: { trades: Trade[] }) {
  const data = useMemo(() => {
    let cum = 0;
    return monthlyPnl(trades).map((m) => {
      cum += m.pnl;
      return {
        label: m.label,
        cumulative: Math.round(cum),
        monthly: Math.round(m.pnl),
        trades: m.trades,
      };
    });
  }, [trades]);

  const hasData = data.length > 0;
  const total = hasData ? data[data.length - 1].cumulative : 0;

  return (
    <Card
      title="Overall cumulative profit"
      subtitle="Running net P&L from your first trade to your last — month by month, starting at ₹0"
      action={
        hasData && (
          <div className="text-right">
            <div className="label-caps">Net so far</div>
            <div className={`tnum text-[16px] font-semibold leading-tight ${pnlClass(total)}`}>
              {formatMoney(total, { sign: true })}
            </div>
          </div>
        )
      }
    >
      {!hasData ? (
        <EmptyState
          icon={TrendingUp}
          title="No closed trades in range"
          hint="The cumulative line builds as your trades close."
        />
      ) : (
        <ResponsiveContainer width="100%" height={400}>
          <AreaChart data={data} margin={{ top: 10, right: 18, bottom: 0, left: 8 }}>
            <defs>
              <linearGradient id="overall-cum-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={ACCENT} stopOpacity={0.3} />
                <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid {...gridDefaults} />
            <XAxis {...axisDefaults} dataKey="label" minTickGap={8} />
            <YAxis
              {...axisDefaults}
              tickFormatter={(v: number) => formatMoney(v, { compact: true })}
              width={64}
            />
            <ReferenceLine y={0} stroke={GRID} />
            <Tooltip
              cursor={{ stroke: GRID }}
              content={
                <ChartTooltip
                  valueFormatter={(v) => formatMoney(v, { sign: true, compact: true })}
                />
              }
            />
            <Area
              name="Cumulative profit"
              dataKey="cumulative"
              type="monotone"
              stroke={ACCENT}
              strokeWidth={2}
              fill="url(#overall-cum-fill)"
              dot={false}
              activeDot={{ r: 4, stroke: "#141619", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
