/** Portfolio chart — how long the margin has been working. Histogram of
 *  positions per holding-day bucket, info-blue (holding identity), single
 *  series → no legend. */

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
import { Clock } from "lucide-react";
import type { ComputedPosition } from "@/lib/mtf/types";
import { MTF_COLORS } from "@/lib/mtf/palette";
import { formatNumber } from "@/lib/format";
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

const BUCKETS = [
  { label: "0–7d", min: 0, max: 7 },
  { label: "8–15d", min: 8, max: 15 },
  { label: "16–30d", min: 16, max: 30 },
  { label: "31–60d", min: 31, max: 60 },
  { label: "61–90d", min: 61, max: 90 },
  { label: "90+d", min: 91, max: Infinity },
] as const;

export function HoldingDurationChart({ computed }: { computed: ComputedPosition[] }) {
  const data = useMemo(
    () =>
      BUCKETS.map((b) => ({
        label: b.label,
        count: computed.filter((cp) => cp.holdingDays >= b.min && cp.holdingDays <= b.max).length,
      })),
    [computed],
  );

  return (
    <Card title="Holding duration" subtitle="Positions per holding-day bucket">
      {computed.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="No positions yet"
          hint="See how long your margin positions typically stay open."
        />
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid {...gridDefaults} />
            <XAxis {...axisDefaults} dataKey="label" />
            <YAxis
              {...axisDefaults}
              width={32}
              allowDecimals={false}
              tickFormatter={(v: number) => formatNumber(v)}
            />
            <Tooltip
              content={
                <ChartTooltip
                  valueFormatter={(v) => `${formatNumber(v)} ${v === 1 ? "position" : "positions"}`}
                />
              }
              cursor={{ fill: CURSOR_FILL }}
            />
            <Bar
              dataKey="count"
              name="Positions"
              fill={MTF_COLORS.holding}
              radius={BAR_RADIUS}
              maxBarSize={BAR_MAX}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
