/** MTF per-position chart (spec §9) — Break-even Growth.
 *  Yellow (#eab308 via palette) line of the break-even price rising by day,
 *  from the frozen buildDaySeries helper — piecewise across lots, so multi-lot
 *  positions kink where each tranche lands. When a current price exists, a
 *  flat info-blue line shows where the market stands vs the climb. */

import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Target } from "lucide-react";
import type { ComputedPosition } from "@/lib/mtf/types";
import { buildDaySeries } from "@/lib/mtf/calc";
import { MTF_COLORS } from "@/lib/mtf/palette";
import { formatDateShort, formatMoney } from "@/lib/format";
import { AXIS_TEXT, GRID, axisDefaults, gridDefaults } from "@/components/charts/chartTheme";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

interface BePoint {
  label: string;
  breakEven: number;
  price?: number;
}

/** Core day series (≤60 points, lot-kink days pre-kept) → labelled points. */
function buildPoints(cp: ComputedPosition): BePoint[] {
  const useDates = cp.holdingDays >= 10;
  const price = cp.pos.currentPrice;
  return buildDaySeries(cp).map((p) => ({
    label: useDates ? formatDateShort(p.date) : `Day ${p.dayIndex}`,
    breakEven: p.breakEven,
    ...(price != null ? { price } : {}),
  }));
}

export function BreakEvenGrowthChart({ cp }: { cp: ComputedPosition }) {
  const points = useMemo(() => buildPoints(cp), [cp]);
  const hasPrice = cp.pos.currentPrice != null;

  if (cp.pos.quantity <= 0) {
    return (
      <Card title="Break-even Growth" subtitle="The sell price you need rises every day">
        <EmptyState
          icon={Target}
          title="Nothing to chart"
          hint="This position has no quantity, so break-even cannot be computed."
        />
      </Card>
    );
  }

  return (
    <Card title="Break-even Growth" subtitle="The sell price you need rises every day">
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid {...gridDefaults} />
          <XAxis {...axisDefaults} dataKey="label" minTickGap={24} tickMargin={8} />
          <YAxis
            {...axisDefaults}
            width={64}
            domain={["auto", "auto"]}
            tickFormatter={(v: number) => formatMoney(v, { decimals: false })}
          />
          <Tooltip
            content={<ChartTooltip valueFormatter={(v) => formatMoney(v, { decimals: true })} />}
            cursor={{ stroke: GRID }}
          />
          {hasPrice && <Legend wrapperStyle={{ fontSize: 12, color: AXIS_TEXT }} />}
          <Line
            type="monotone"
            dataKey="breakEven"
            name="Break-even price"
            stroke={MTF_COLORS.breakEven}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, stroke: "#141619", strokeWidth: 2, fill: MTF_COLORS.breakEven }}
          />
          {hasPrice && (
            <Line
              type="monotone"
              dataKey="price"
              name="Current price"
              stroke={MTF_COLORS.holding}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, stroke: "#141619", strokeWidth: 2, fill: MTF_COLORS.holding }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}
