/** Dashboard tile — wins / losses / break-evens donut with the total win rate in the center. */

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { PieChart as PieChartIcon } from "lucide-react";
import type { Kpis } from "@/lib/metrics";
import { formatNumber, formatPct } from "@/lib/format";
import { PNL } from "@/components/charts/chartTheme";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

const LEGEND_HEIGHT = 28;

export function WinRateDonutCard({ kpis }: { kpis: Kpis }) {
  const slices = [
    { name: "Wins", value: kpis.wins, color: PNL.profit },
    { name: "Losses", value: kpis.losses, color: PNL.loss },
    { name: "Break-even", value: kpis.breakevens, color: PNL.neutral },
  ].filter((s) => s.value > 0);

  return (
    <Card className="h-full" title="Win rate" subtitle="Closed-trade outcomes in range">
      {kpis.closedTrades === 0 || slices.length === 0 ? (
        <EmptyState
          icon={PieChartIcon}
          title="No closed trades"
          hint="Outcomes will appear once trades are closed in this range."
        />
      ) : (
        <div className="relative h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius="58%"
                outerRadius="84%"
                paddingAngle={2}
                stroke="none"
              >
                {slices.map((s) => (
                  <Cell key={s.name} fill={s.color} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip valueFormatter={(v) => `${formatNumber(v)} trades`} />} />
              <Legend
                verticalAlign="bottom"
                height={LEGEND_HEIGHT}
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 12, color: "#8b929d" }}
                formatter={(value: string) => <span style={{ color: "#8b929d" }}>{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* donut-hole readout: centered on the pie (legend shifts the pie up by half its height) */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 flex flex-col items-center"
            style={{ top: `calc(50% - ${LEGEND_HEIGHT / 2}px)`, transform: "translateY(-50%)" }}
          >
            <span className="text-[24px] font-semibold leading-tight tracking-tight text-ink">
              {formatPct(kpis.winRate, 1)}
            </span>
            <span className="text-[11px] text-muted">win rate</span>
          </div>
        </div>
      )}
    </Card>
  );
}
