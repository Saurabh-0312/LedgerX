/** Portfolio chart — is the financing eating the gains? Grouped bars per
 *  position: gross profit (P&L colored by sign) next to accumulated interest
 *  (amber). Two series → legend required. */

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
import { formatMoney, pnlMarkColor } from "@/lib/format";
import {
  AXIS_TEXT,
  BAR_MAX,
  BAR_RADIUS,
  CURSOR_FILL,
  PNL,
  axisDefaults,
  gridDefaults,
} from "@/components/charts/chartTheme";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

export function ProfitVsInterestChart({ computed }: { computed: ComputedPosition[] }) {
  const data = useMemo(
    () =>
      computed
        .map((cp) => ({
          id: cp.pos.id,
          symbol: cp.pos.symbol,
          gross: cp.grossProfit,
          interest: cp.accumulatedInterest,
        }))
        .sort((a, b) => b.gross - a.gross),
    [computed],
  );

  return (
    <Card title="Profit vs interest" subtitle="Gross profit against accumulated interest, per position">
      {data.length === 0 ? (
        <EmptyState
          icon={Scale}
          title="No positions yet"
          hint="Compare each position's gross profit with the interest it has cost."
        />
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid {...gridDefaults} />
            <XAxis {...axisDefaults} dataKey="symbol" />
            <YAxis
              {...axisDefaults}
              width={56}
              tickFormatter={(v: number) => formatMoney(v, { compact: true })}
            />
            <Tooltip
              content={
                <ChartTooltip
                  valueFormatter={(v, entry) =>
                    entry.dataKey === "gross"
                      ? formatMoney(v, { sign: true })
                      : formatMoney(v, { decimals: true })
                  }
                />
              }
              cursor={{ fill: CURSOR_FILL }}
            />
            <Legend
              iconSize={9}
              wrapperStyle={{ fontSize: 12, paddingTop: 4 }}
              formatter={(value) => <span style={{ color: AXIS_TEXT }}>{value}</span>}
            />
            <Bar
              dataKey="gross"
              name="Gross profit"
              fill={PNL.profit}
              radius={BAR_RADIUS}
              maxBarSize={BAR_MAX}
            >
              {data.map((d) => (
                <Cell key={d.id} fill={pnlMarkColor(d.gross)} />
              ))}
            </Bar>
            <Bar
              dataKey="interest"
              name="Interest"
              fill={MTF_COLORS.interest}
              radius={BAR_RADIUS}
              maxBarSize={BAR_MAX}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
