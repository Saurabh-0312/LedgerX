/** MTF per-position chart (spec §9) — Cumulative Interest.
 *  Amber gradient AREA of total interest paid so far (the area twin of the
 *  Daily Interest Growth line), from the frozen buildDaySeries helper —
 *  piecewise across lots, so multi-lot positions kink where each tranche lands. */

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
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

export function CumulativeInterestChart({ cp }: { cp: ComputedPosition }) {
  const points = useMemo(() => buildPoints(cp), [cp]);

  if (cp.pos.quantity <= 0) {
    return (
      <Card title="Cumulative Interest" subtitle="Total financing cost paid so far">
        <EmptyState
          icon={Coins}
          title="Nothing to chart"
          hint="This position has no quantity, so no interest accrues."
        />
      </Card>
    );
  }

  return (
    <Card title="Cumulative Interest" subtitle="Total financing cost paid so far">
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="mtfCumulativeInterestFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={MTF_COLORS.interest} stopOpacity={0.25} />
              <stop offset="100%" stopColor={MTF_COLORS.interest} stopOpacity={0} />
            </linearGradient>
          </defs>
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
          <Area
            type="monotone"
            dataKey="interest"
            name="Total interest"
            stroke={MTF_COLORS.interest}
            strokeWidth={2}
            fill="url(#mtfCumulativeInterestFill)"
            dot={false}
            activeDot={{ r: 4, stroke: "#141619", strokeWidth: 2, fill: MTF_COLORS.interest }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
}
