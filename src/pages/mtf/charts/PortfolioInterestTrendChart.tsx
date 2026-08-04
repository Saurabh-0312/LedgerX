/** Portfolio chart — cumulative interest paid across every position over
 *  calendar time. Open positions accrue to today; closed ones stop at exit
 *  (their frozen interestDays cap). Amber area = interest identity. */

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
import { TrendingUp } from "lucide-react";
import type { ComputedPosition } from "@/lib/mtf/types";
import { portfolioInterestTrendSeries } from "@/lib/mtf/calc";
import { MTF_COLORS } from "@/lib/mtf/palette";
import { formatDate, formatDateShort, formatMoney } from "@/lib/format";
import { GRID, axisDefaults, gridDefaults } from "@/components/charts/chartTheme";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

/** Card surface hex — documented active-dot ring color (see CONTRACT chart rules). */
const SURFACE = "#141619";

export function PortfolioInterestTrendChart({ computed }: { computed: ComputedPosition[] }) {
  // per-lot accurate + centralized in calc.ts (matches the stat cards exactly)
  const series = useMemo(() => portfolioInterestTrendSeries(computed, new Date()), [computed]);

  return (
    <Card title="Portfolio interest trend" subtitle="Cumulative interest paid across all positions">
      {series.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="No positions yet"
          hint="The interest trend appears once you add your first MTF position."
        />
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={series} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="mtfPortfolioInterestFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={MTF_COLORS.interest} stopOpacity={0.25} />
                <stop offset="100%" stopColor={MTF_COLORS.interest} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid {...gridDefaults} />
            <XAxis
              {...axisDefaults}
              dataKey="date"
              minTickGap={28}
              tickFormatter={(v: string) => formatDateShort(v)}
            />
            <YAxis
              {...axisDefaults}
              width={56}
              tickFormatter={(v: number) => formatMoney(v, { compact: true })}
            />
            <Tooltip
              content={
                <ChartTooltip
                  valueFormatter={(v) => formatMoney(v, { decimals: true })}
                  labelFormatter={(l) => formatDate(String(l))}
                />
              }
              cursor={{ stroke: GRID }}
            />
            <Area
              type="monotone"
              dataKey="interest"
              name="Interest paid"
              stroke={MTF_COLORS.interest}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, stroke: SURFACE, strokeWidth: 2 }}
              fill="url(#mtfPortfolioInterestFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
