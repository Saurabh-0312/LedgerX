/** Live open-interest chart — interest carried by positions that are STILL OPEN,
 *  as a time series. Unlike the cumulative trend, a position's accrued interest
 *  DROPS out of the line on its exit date (it's no longer live), so the curve
 *  rises with daily accrual + new buys and falls when you sell. The headline
 *  also shows today's carried interest as a % of your account value. */

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity } from "lucide-react";
import type { ComputedPosition } from "@/lib/mtf/types";
import { liveOpenInterestSeries } from "@/lib/mtf/calc";
import { MTF_COLORS } from "@/lib/mtf/palette";
import { formatDate, formatDateShort, formatMoney, formatPct } from "@/lib/format";
import { GRID, axisDefaults, gridDefaults } from "@/components/charts/chartTheme";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";

const SURFACE = "#141619";
const LIVE = MTF_COLORS.forecast; // accent violet — distinct from the amber cumulative trend

interface Props {
  computed: ComputedPosition[];
  accountValue: number;
  onAccountValueChange: (v: number) => void;
}

export function LiveOpenInterestChart({ computed, accountValue, onAccountValueChange }: Props) {
  const [avInput, setAvInput] = useState(accountValue > 0 ? String(accountValue) : "");

  const series = useMemo(() => liveOpenInterestSeries(computed, new Date()), [computed]);

  const current = series.length ? series[series.length - 1].interest : 0;
  const pct = accountValue > 0 ? (current / accountValue) * 100 : undefined;

  const commitAccountValue = (raw: string) => {
    setAvInput(raw);
    const n = parseFloat(raw);
    onAccountValueChange(Number.isFinite(n) && n > 0 ? n : 0);
  };

  return (
    <Card
      title="Live interest on open positions"
      subtitle="Interest carried by positions you still hold — falls when you close one"
    >
      {series.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No positions yet"
          hint="Add an MTF position and its live interest will show here."
        />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="label-caps">Carried on open positions now</div>
              <div className="tnum mt-0.5 text-[24px] font-semibold leading-none" style={{ color: LIVE }}>
                {formatMoney(current, { decimals: true })}
              </div>
              <div className="mt-1 text-[12px] text-muted">
                {pct !== undefined ? (
                  <>
                    <span className="tnum font-medium" style={{ color: LIVE }}>
                      {formatPct(pct, 1)}
                    </span>{" "}
                    of account value
                  </>
                ) : (
                  <span className="text-faint">Set your account value to see the % →</span>
                )}
              </div>
            </div>
            <div className="shrink-0">
              <label htmlFor="mtf-account-value" className="label-caps mb-1 block">
                Account value
              </label>
              <Input
                id="mtf-account-value"
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                placeholder="e.g. 400000"
                value={avInput}
                onChange={(e) => commitAccountValue(e.target.value)}
                className="w-[150px]"
              />
            </div>
          </div>

          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={series} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="mtfLiveOpenInterestFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={LIVE} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={LIVE} stopOpacity={0} />
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
                name="Live open interest"
                stroke={LIVE}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, stroke: SURFACE, strokeWidth: 2 }}
                fill="url(#mtfLiveOpenInterestFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </>
      )}
    </Card>
  );
}
