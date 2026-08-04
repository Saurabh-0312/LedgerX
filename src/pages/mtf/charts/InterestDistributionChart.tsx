/** Portfolio chart — how the accumulated interest splits across positions.
 *  Donut with CAT identity slots (fixed order), overflow folded into "Others",
 *  total interest in the hole. */

import { useMemo } from "react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { PieChart as PieChartIcon } from "lucide-react";
import type { ComputedPosition } from "@/lib/mtf/types";
import { formatMoney } from "@/lib/format";
import { AXIS_TEXT, CAT, PNL } from "@/components/charts/chartTheme";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

const r2 = (n: number) => Math.round(n * 100) / 100;
const LEGEND_HEIGHT = 28;
const MAX_SLICES = 8;

interface Slice {
  name: string;
  value: number;
}

export function InterestDistributionChart({ computed }: { computed: ComputedPosition[] }) {
  const { slices, total } = useMemo(() => {
    const entries: Slice[] = computed
      .map((cp) => ({ name: cp.pos.symbol, value: cp.accumulatedInterest }))
      .filter((e) => e.value > 0)
      .sort((a, b) => b.value - a.value);
    const total = r2(entries.reduce((acc, e) => acc + e.value, 0));
    if (entries.length <= MAX_SLICES) return { slices: entries, total };
    const top = entries.slice(0, MAX_SLICES - 1);
    const others = r2(entries.slice(MAX_SLICES - 1).reduce((acc, e) => acc + e.value, 0));
    return { slices: [...top, { name: "Others", value: others }], total };
  }, [computed]);

  return (
    <Card title="Interest distribution" subtitle="Share of accumulated interest per position">
      {slices.length === 0 ? (
        <EmptyState
          icon={PieChartIcon}
          title={computed.length === 0 ? "No positions yet" : "No interest accrued yet"}
          hint="Each position's share of the total financing cost appears here."
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
                innerRadius="55%"
                outerRadius="82%"
                paddingAngle={2}
                stroke="none"
              >
                {slices.map((s, i) => (
                  <Cell key={s.name} fill={s.name === "Others" ? PNL.neutral : CAT[i]} />
                ))}
              </Pie>
              <Tooltip
                content={<ChartTooltip valueFormatter={(v) => formatMoney(v, { decimals: true })} />}
              />
              <Legend
                verticalAlign="bottom"
                height={LEGEND_HEIGHT}
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 12, color: AXIS_TEXT }}
                formatter={(value) => <span style={{ color: AXIS_TEXT }}>{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* donut-hole readout: centered on the pie (legend shifts the pie up by half its height) */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 flex flex-col items-center"
            style={{ top: `calc(50% - ${LEGEND_HEIGHT / 2}px)`, transform: "translateY(-50%)" }}
          >
            <span className="text-[22px] font-semibold leading-tight tracking-tight text-ink">
              {formatMoney(total, { compact: true })}
            </span>
            <span className="text-[11px] text-muted">total interest</span>
          </div>
        </div>
      )}
    </Card>
  );
}
