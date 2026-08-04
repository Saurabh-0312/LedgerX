/** MTF per-position chart (spec §9) — Projected Interest.
 *  Forecast area for the next 30 days: projected TOTAL interest at day D+n via
 *  forecastPosition (never re-derived). Amber gradient fill with the accent
 *  (forecast violet) stroke; no dashed strokes. */

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
import { addDays } from "date-fns";
import { CalendarRange } from "lucide-react";
import type { ComputedPosition } from "@/lib/mtf/types";
import { forecastPosition } from "@/lib/mtf/calc";
import { MTF_COLORS } from "@/lib/mtf/palette";
import { formatDateShort, formatMoney } from "@/lib/format";
import { GRID, axisDefaults, gridDefaults } from "@/components/charts/chartTheme";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

interface ProjPoint {
  label: string;
  interest: number;
}

const HORIZON_DAYS = 30;

/** D+1..D+30 from today (purchaseDate + holdingDays + n keeps this pure on cp). */
function buildSeries(cp: ComputedPosition): ProjPoint[] {
  const purchase = new Date(cp.pos.purchaseDate);
  return Array.from({ length: HORIZON_DAYS }, (_, k) => {
    const n = k + 1;
    return {
      label: formatDateShort(addDays(purchase, cp.holdingDays + n).toISOString()),
      interest: forecastPosition(cp, n).futureTotalInterest,
    };
  });
}

export function ProjectedInterestChart({ cp }: { cp: ComputedPosition }) {
  const points = useMemo(() => buildSeries(cp), [cp]);

  if (cp.isClosed) {
    return (
      <Card title="Projected Interest" subtitle="Next 30 days if you keep holding">
        <EmptyState
          icon={CalendarRange}
          title="Position is closed"
          hint="This position was sold — no further interest accrues, so there is nothing to project."
        />
      </Card>
    );
  }

  if (cp.pos.quantity <= 0) {
    return (
      <Card title="Projected Interest" subtitle="Next 30 days if you keep holding">
        <EmptyState
          icon={CalendarRange}
          title="Nothing to project"
          hint="This position has no quantity, so no future interest accrues."
        />
      </Card>
    );
  }

  return (
    <Card title="Projected Interest" subtitle="Next 30 days if you keep holding">
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="mtfProjectedInterestFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={MTF_COLORS.interest} stopOpacity={0.25} />
              <stop offset="100%" stopColor={MTF_COLORS.interest} stopOpacity={0} />
            </linearGradient>
          </defs>
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
          <Area
            type="monotone"
            dataKey="interest"
            name="Projected total interest"
            stroke={MTF_COLORS.forecast}
            strokeWidth={2}
            fill="url(#mtfProjectedInterestFill)"
            dot={false}
            activeDot={{ r: 4, stroke: "#141619", strokeWidth: 2, fill: MTF_COLORS.forecast }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
}
