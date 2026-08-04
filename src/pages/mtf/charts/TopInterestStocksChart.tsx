/** Portfolio chart — the stocks that have paid the most financing so far.
 *  Horizontal ranking bars, single series → amber (interest identity), no legend. */

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Flame } from "lucide-react";
import type { ComputedPosition } from "@/lib/mtf/types";
import { MTF_COLORS } from "@/lib/mtf/palette";
import { formatMoney } from "@/lib/format";
import {
  BAR_MAX,
  BAR_RADIUS_H,
  CURSOR_FILL,
  axisDefaults,
  gridDefaults,
} from "@/components/charts/chartTheme";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

const r2 = (n: number) => Math.round(n * 100) / 100;
const TOP_N = 8;

export function TopInterestStocksChart({ computed }: { computed: ComputedPosition[] }) {
  const data = useMemo(() => {
    const bySymbol = new Map<string, number>();
    for (const cp of computed) {
      bySymbol.set(cp.pos.symbol, (bySymbol.get(cp.pos.symbol) ?? 0) + cp.accumulatedInterest);
    }
    return [...bySymbol.entries()]
      .map(([symbol, interest]) => ({ symbol, interest: r2(interest) }))
      .sort((a, b) => b.interest - a.interest)
      .slice(0, TOP_N);
  }, [computed]);

  return (
    <Card title="Top interest paying stocks" subtitle="Accumulated interest by stock — costliest first">
      {data.length === 0 ? (
        <EmptyState
          icon={Flame}
          title="No positions yet"
          hint="Your costliest financed stocks rank here once positions accrue interest."
        />
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid {...gridDefaults} horizontal={false} vertical />
            <XAxis
              {...axisDefaults}
              type="number"
              tickFormatter={(v: number) => formatMoney(v, { compact: true })}
            />
            <YAxis {...axisDefaults} type="category" dataKey="symbol" width={90} />
            <Tooltip
              content={<ChartTooltip valueFormatter={(v) => formatMoney(v, { decimals: true })} />}
              cursor={{ fill: CURSOR_FILL }}
            />
            <Bar
              dataKey="interest"
              name="Accumulated interest"
              fill={MTF_COLORS.interest}
              radius={BAR_RADIUS_H}
              maxBarSize={BAR_MAX}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
