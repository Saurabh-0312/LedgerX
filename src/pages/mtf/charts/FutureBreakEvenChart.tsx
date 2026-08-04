/** MTF per-position chart — Future Break-even (forward projection).
 *  Projects the break-even price 90 days FORWARD from today as interest keeps
 *  accruing: futureBE(n) = (I + accumulatedInterest + dailyInterest × n + charges) / qty.
 *  n = 0 is today's break-even (continuous with the historical chart); each day
 *  ahead the sell price you need climbs by dailyInterest / qty. A flat current-price
 *  line shows the widening gap — the essence of "should I keep holding?". */

import { useMemo } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { addDays } from "date-fns";
import { TrendingUp } from "lucide-react";
import type { ComputedPosition } from "@/lib/mtf/types";
import { MTF_COLORS } from "@/lib/mtf/palette";
import { formatDateShort, formatMoney } from "@/lib/format";
import { AXIS_TEXT, GRID, axisDefaults, gridDefaults } from "@/components/charts/chartTheme";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

const HORIZON = 90; // days projected forward
const r2 = (n: number) => Math.round(n * 100) / 100;

interface FbePoint {
  label: string;
  breakEven: number;
  price?: number;
}

function buildSeries(cp: ComputedPosition): FbePoint[] {
  const qty = cp.pos.quantity;
  const price = cp.pos.currentPrice;
  // today = purchase date + elapsed holding days (keeps the component pure from cp)
  const today = addDays(new Date(cp.pos.purchaseDate), cp.holdingDays);
  const step = Math.max(1, Math.ceil((HORIZON + 1) / 60));

  const indices: number[] = [];
  for (let n = 0; n <= HORIZON; n += step) indices.push(n);
  if (indices[indices.length - 1] !== HORIZON) indices.push(HORIZON);

  return indices.map((n) => ({
    label: formatDateShort(addDays(today, n).toISOString()),
    // add n days of forward interest to what has ALREADY accrued (today's break-even at n=0)
    breakEven: r2((cp.totalInvestment + cp.accumulatedInterest + cp.dailyInterest * n + cp.totalCharges) / qty),
    ...(price != null ? { price } : {}),
  }));
}

export function FutureBreakEvenChart({ cp }: { cp: ComputedPosition }) {
  const points = useMemo(() => buildSeries(cp), [cp]);
  const hasPrice = cp.pos.currentPrice != null;
  const last = points[points.length - 1];

  if (cp.pos.quantity <= 0 || cp.isClosed) {
    return (
      <Card title="Future break-even" subtitle="Projected sell price needed, 90 days ahead">
        <EmptyState
          icon={TrendingUp}
          title={cp.isClosed ? "Position is closed" : "Nothing to project"}
          hint={
            cp.isClosed
              ? "A closed position has no forward interest to project."
              : "This position has no quantity, so break-even cannot be computed."
          }
        />
      </Card>
    );
  }

  return (
    <Card
      title="Future break-even"
      subtitle={`Sell price you'll need, day by day ahead — in 90 days: ${formatMoney(last.breakEven, { decimals: true })}`}
    >
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="mtf-fbe-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={MTF_COLORS.breakEven} stopOpacity={0.22} />
              <stop offset="100%" stopColor={MTF_COLORS.breakEven} stopOpacity={0} />
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
          {hasPrice && <Legend wrapperStyle={{ fontSize: 12, color: AXIS_TEXT }} />}
          <Area
            type="monotone"
            dataKey="breakEven"
            name="Future break-even"
            stroke={MTF_COLORS.breakEven}
            strokeWidth={2}
            fill="url(#mtf-fbe-fill)"
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
        </ComposedChart>
      </ResponsiveContainer>
    </Card>
  );
}
