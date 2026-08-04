/** Portfolio chart — where every position stands after interest & charges.
 *  One bar per position sorted best → worst, P&L colored by sign.
 *  Single series → no legend (the title carries it). */

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3 } from "lucide-react";
import type { ComputedPosition } from "@/lib/mtf/types";
import { formatMoney, pnlMarkColor } from "@/lib/format";
import {
  BAR_MAX,
  BAR_RADIUS,
  CURSOR_FILL,
  axisDefaults,
  gridDefaults,
} from "@/components/charts/chartTheme";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

export function NetProfitTrendChart({ computed }: { computed: ComputedPosition[] }) {
  const data = useMemo(
    () =>
      computed
        .map((cp) => ({
          id: cp.pos.id,
          symbol: cp.pos.symbol,
          net: cp.netProfit,
        }))
        .sort((a, b) => b.net - a.net),
    [computed],
  );

  return (
    <Card title="Net profit by position" subtitle="After interest & charges — best to worst">
      {data.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No positions yet"
          hint="Each position's true bottom line lands here once you add one."
        />
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid {...gridDefaults} />
            <XAxis {...axisDefaults} dataKey="symbol" />
            <YAxis
              {...axisDefaults}
              width={56}
              tickFormatter={(v: number) => formatMoney(v, { compact: true })}
            />
            <Tooltip
              content={<ChartTooltip valueFormatter={(v) => formatMoney(v, { sign: true })} />}
              cursor={{ fill: CURSOR_FILL }}
            />
            <Bar dataKey="net" name="Net profit" radius={BAR_RADIUS} maxBarSize={BAR_MAX}>
              {data.map((d) => (
                <Cell key={d.id} fill={pnlMarkColor(d.net)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
