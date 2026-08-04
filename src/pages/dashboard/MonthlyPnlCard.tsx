/** Dashboard tile — net P&L per calendar month, bars colored by sign. */

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3 } from "lucide-react";
import type { Trade } from "@/types";
import { monthlyPnl } from "@/lib/metrics";
import { formatMoney, pnlMarkColor } from "@/lib/format";
import { BAR_RADIUS, CURSOR_FILL, axisDefaults, gridDefaults } from "@/components/charts/chartTheme";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

export function MonthlyPnlCard({ trades }: { trades: Trade[] }) {
  const months = useMemo(() => monthlyPnl(trades), [trades]);

  return (
    <Card className="h-full" title="Monthly P&L" subtitle="Net result per month in range">
      {months.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No monthly data"
          hint="Closed trades will roll up into monthly results here."
        />
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={months} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid {...gridDefaults} />
            <XAxis {...axisDefaults} dataKey="label" tickMargin={8} />
            <YAxis
              {...axisDefaults}
              tickFormatter={(v: number) => formatMoney(v, { compact: true })}
              width={56}
            />
            <Tooltip
              content={<ChartTooltip valueFormatter={(v) => formatMoney(v, { compact: true, sign: true })} />}
              cursor={{ fill: CURSOR_FILL }}
            />
            <Bar dataKey="pnl" name="Net P&L" maxBarSize={24} radius={BAR_RADIUS}>
              {months.map((m) => (
                <Cell key={m.month} fill={pnlMarkColor(m.pnl)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
