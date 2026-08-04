/** Monthly performance — TWO charts scoped by one local YEAR filter:
 *  (1) line chart of cumulative profit through the year,
 *  (2) bar chart of net profit per month.
 *  The year select replaces the global date range here; the global account
 *  filter still applies. */

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CalendarRange } from "lucide-react";
import { useStore } from "@/store/useStore";
import { closedOf } from "@/lib/metrics";
import { formatMoney, pnlMarkColor } from "@/lib/format";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import {
  CAT,
  BAR_RADIUS,
  CURSOR_FILL,
  GRID,
  axisDefaults,
  gridDefaults,
} from "@/components/charts/chartTheme";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function MonthlyPerformanceCard() {
  const allTrades = useStore((s) => s.trades);
  const accountId = useStore((s) => s.filters.accountId);

  // account-scoped closed trades — the year select below replaces the date range
  const closed = useMemo(
    () => closedOf(accountId === "all" ? allTrades : allTrades.filter((t) => t.accountId === accountId)),
    [allTrades, accountId],
  );

  const years = useMemo(() => {
    const ys = [...new Set(closed.map((t) => Number(t.closedAt!.slice(0, 4))))];
    return ys.sort((a, b) => b - a);
  }, [closed]);

  const [year, setYear] = useState<number | null>(null);
  const activeYear = year ?? years[0];

  const data = useMemo(() => {
    if (!activeYear) return [];
    const byMonth = new Array(12).fill(0);
    for (const t of closed) {
      if (Number(t.closedAt!.slice(0, 4)) !== activeYear) continue;
      byMonth[Number(t.closedAt!.slice(5, 7)) - 1] += t.netPnl;
    }
    // trim trailing empty months so the current year doesn't show a flat tail
    let last = 11;
    while (last > 0 && byMonth[last] === 0) last--;
    let cum = 0;
    return byMonth.slice(0, last + 1).map((pnl, i) => {
      cum += pnl;
      return { month: MONTH_LABELS[i], pnl: Math.round(pnl), cumulative: Math.round(cum) };
    });
  }, [closed, activeYear]);

  const hasData = data.some((d) => d.pnl !== 0);
  const money = (v: number) => formatMoney(v, { sign: true, compact: true });

  return (
    <section aria-label="Monthly performance">
      {/* filter row — scopes BOTH charts below */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="label-caps">Monthly performance</span>
        {years.length > 0 && (
          <select
            value={activeYear}
            onChange={(e) => setYear(Number(e.target.value))}
            aria-label="Select year for the monthly performance charts"
            className="input-base !w-auto !py-1.5 !px-2.5 text-[13px] font-medium cursor-pointer"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        )}
      </div>

      {!hasData ? (
        <Card>
          <EmptyState
            icon={CalendarRange}
            title={`No closed trades in ${activeYear ?? "this range"}`}
            hint="Pick another year or log some trades — the charts fill in as months close."
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {/* 1 — cumulative profit line */}
          <Card
            title="Cumulative profit"
            subtitle={`Running net P&L through ${activeYear}`}
          >
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 8 }}>
                <CartesianGrid {...gridDefaults} />
                <XAxis {...axisDefaults} dataKey="month" />
                <YAxis
                  {...axisDefaults}
                  tickFormatter={(v: number) => formatMoney(v, { compact: true })}
                  width={64}
                />
                <Tooltip cursor={{ stroke: GRID }} content={<ChartTooltip valueFormatter={money} />} />
                <Line
                  name="Cumulative profit"
                  dataKey="cumulative"
                  type="monotone"
                  stroke={CAT[0]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, stroke: "#141619", strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          {/* 2 — profit per month bars */}
          <Card
            title="Profit per month"
            subtitle={`Net result of each month in ${activeYear}`}
          >
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 8 }}>
                <CartesianGrid {...gridDefaults} />
                <XAxis {...axisDefaults} dataKey="month" />
                <YAxis
                  {...axisDefaults}
                  tickFormatter={(v: number) => formatMoney(v, { compact: true })}
                  width={64}
                />
                <Tooltip cursor={{ fill: CURSOR_FILL }} content={<ChartTooltip valueFormatter={money} />} />
                <Bar name="Profit per month" dataKey="pnl" maxBarSize={24} radius={BAR_RADIUS}>
                  {data.map((d) => (
                    <Cell key={d.month} fill={pnlMarkColor(d.pnl)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}
    </section>
  );
}
