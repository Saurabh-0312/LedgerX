/** MTF per-position chart (spec §9) — Daily Interest Growth.
 *  Amber line of CUMULATIVE interest by day, from the frozen buildDaySeries
 *  helper — piecewise across lots, so multi-lot positions kink where each
 *  tranche lands. Never re-derives rate math. */

import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Coins } from "lucide-react";
import type { ComputedPosition } from "@/lib/mtf/types";
import { buildDaySeries } from "@/lib/mtf/calc";
import { MTF_COLORS } from "@/lib/mtf/palette";
import { formatDateShort, formatMoney } from "@/lib/format";
import { GRID, axisDefaults, gridDefaults } from "@/components/charts/chartTheme";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

interface ChartPoint {
  label: string;
  interest: number;
}

/** Core day series (≤60 points, lot-kink days pre-kept) → labelled points. */
function buildPoints(cp: ComputedPosition): ChartPoint[] {
  const useDates = cp.holdingDays >= 10;
  return buildDaySeries(cp).map((p) => ({
    label: useDates ? formatDateShort(p.date) : `Day ${p.dayIndex}`,
    interest: p.cumInterest,
  }));
}

export function DailyInterestGrowthChart({ cp }: { cp: ComputedPosition }) {
  const points = useMemo(() => buildPoints(cp), [cp]);

  if (cp.pos.quantity <= 0) {
    return (
      <Card title="Daily Interest Growth" subtitle="Interest accumulated day by day">
        <EmptyState
          icon={Coins}
          title="Nothing to chart"
          hint="This position has no quantity, so no interest accrues."
        />
      </Card>
    );
  }

  return (
    <Card title="Daily Interest Growth" subtitle="Interest accumulated day by day">
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid {...gridDefaults} />
          <XAxis {...axisDefaults} dataKey="label" minTickGap={24} tickMargin={8} />
          <YAxis
            {...axisDefaults}
            width={64}
            tickFormatter={(v: number) => formatMoney(v, { decimals: false })}
          />
          <Tooltip
            content={<ChartTooltip valueFormatter={(v) => formatMoney(v, { decimals: true })} />}
            cursor={{ stroke: GRID }}
          />
          <Line
            type="monotone"
            dataKey="interest"
            name="Cumulative interest"
            stroke={MTF_COLORS.interest}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, stroke: "#141619", strokeWidth: 2, fill: MTF_COLORS.interest }}
          />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}
