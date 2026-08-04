/** MTF per-position chart (spec §9) — Interest vs Profit.
 *  Grouped bars on a single category ("This position"): accumulated interest
 *  (amber) beside gross profit (profit/loss mark by sign). Two series → Legend. */

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Scale } from "lucide-react";
import type { ComputedPosition } from "@/lib/mtf/types";
import { MTF_COLORS } from "@/lib/mtf/palette";
import { formatMoney } from "@/lib/format";
import {
  AXIS_TEXT,
  BAR_RADIUS,
  CURSOR_FILL,
  axisDefaults,
  gridDefaults,
} from "@/components/charts/chartTheme";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

export function InterestVsProfitChart({ cp }: { cp: ComputedPosition }) {
  const data = useMemo(
    () => [
      {
        name: "This position",
        interest: cp.accumulatedInterest,
        profit: cp.grossProfit,
      },
    ],
    [cp],
  );

  if (cp.pos.quantity <= 0) {
    return (
      <Card title="Interest vs Profit" subtitle="Is the financing cost eating the gains?">
        <EmptyState
          icon={Scale}
          title="Nothing to compare"
          hint="This position has no quantity, so there is no interest or profit yet."
        />
      </Card>
    );
  }

  const profitColor = cp.grossProfit < 0 ? MTF_COLORS.loss : MTF_COLORS.profit;

  return (
    <Card title="Interest vs Profit" subtitle="Is the financing cost eating the gains?">
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid {...gridDefaults} />
          <XAxis {...axisDefaults} dataKey="name" tickMargin={8} />
          <YAxis
            {...axisDefaults}
            width={64}
            tickFormatter={(v: number) => formatMoney(v, { compact: true })}
            domain={[(dataMin: number) => Math.min(0, dataMin), (dataMax: number) => Math.max(0, dataMax)]}
          />
          <Tooltip
            content={<ChartTooltip valueFormatter={(v) => formatMoney(v, { decimals: true })} />}
            cursor={{ fill: CURSOR_FILL }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: AXIS_TEXT }} />
          <Bar
            dataKey="interest"
            name="Accumulated interest"
            fill={MTF_COLORS.interest}
            maxBarSize={24}
            radius={BAR_RADIUS}
          />
          <Bar
            dataKey="profit"
            name="Gross profit"
            fill={profitColor}
            maxBarSize={24}
            radius={BAR_RADIUS}
          >
            <Cell fill={profitColor} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
