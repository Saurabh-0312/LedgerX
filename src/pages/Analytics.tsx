/** ANALYTICS / PERFORMANCE — the deep-dive page: edge quality, risk shape,
 *  and behavioural breakdowns over the globally filtered trade set. */

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, BarChart3, Clock, Coins, Divide, Flame, Scale } from "lucide-react";
import type { GroupPerf } from "@/lib/metrics";
import {
  closedOf,
  computeKpis,
  dayOfWeekPerf,
  drawdownSeries,
  hourOfDayPerf,
  longShortSplit,
  pnlBy,
  rHistogram,
  winRateOverTime,
} from "@/lib/metrics";
import {
  formatDate,
  formatDateShort,
  formatDuration,
  formatMoney,
  formatNumber,
  formatPct,
  formatR,
  pnlClass,
  pnlMarkColor,
} from "@/lib/format";
import { useFilteredTrades, useScopeCurrency } from "@/store/useFilteredTrades";
import { useStore } from "@/store/useStore";
import {
  axisDefaults,
  BAR_MAX,
  BAR_RADIUS,
  BAR_RADIUS_H,
  CAT,
  CURSOR_FILL,
  GRID,
  gridDefaults,
  PNL,
} from "@/components/charts/chartTheme";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { DirectionBadge } from "@/components/ui/Badge";
import { GroupPnlCard } from "./analytics/GroupPnlCard";
import { PnlColumnCard } from "./analytics/PnlColumnCard";

const DIRECTIONS = ["Long", "Short"] as const;

const zeroGroup = (name: string): GroupPerf => ({
  name,
  pnl: 0,
  gross: 0,
  charges: 0,
  trades: 0,
  wins: 0,
  winRate: 0,
  avgR: 0,
});

/** Active-dot spec shared by every line/area (contract: r≥4, card-surface ring). */
const ACTIVE_DOT = { r: 4, stroke: "#141619", strokeWidth: 2 } as const;

const topSub = (n: number, unit: string, extra?: string): string => {
  const base = n > 10 ? `Top 10 of ${n} ${unit} by absolute net P&L` : `All ${n} ${unit}, ranked by net P&L`;
  return extra ? `${base} · ${extra}` : base;
};

export default function Analytics() {
  const trades = useFilteredTrades();
  const currency = useScopeCurrency();
  const startingCapital = useStore((s) => s.settings.startingCapital);

  const kpis = useMemo(() => computeKpis(trades, startingCapital), [trades, startingCapital]);
  const closed = useMemo(() => closedOf(trades), [trades]);

  const bySymbol = useMemo(() => pnlBy(trades, (t) => t.symbol), [trades]);
  const byStrategy = useMemo(() => pnlBy(trades, (t) => t.strategy), [trades]);
  const byTag = useMemo(() => pnlBy(trades, (t) => t.tags), [trades]);
  const byAsset = useMemo(() => pnlBy(trades, (t) => t.assetClass), [trades]);
  const drawdown = useMemo(() => drawdownSeries(trades, startingCapital), [trades, startingCapital]);
  const histogram = useMemo(() => rHistogram(trades, 0.5), [trades]);
  const trend = useMemo(() => winRateOverTime(trades), [trades]);
  const longShort = useMemo(() => {
    const split = longShortSplit(trades);
    return DIRECTIONS.map((d) => split.find((g) => g.name === d) ?? zeroGroup(d));
  }, [trades]);
  const byDay = useMemo(() => dayOfWeekPerf(trades), [trades]);
  const byHour = useMemo(() => hourOfDayPerf(trades), [trades]);

  const pfInfinite = !Number.isFinite(kpis.profitFactor);
  const moneyTick = (v: number) => formatMoney(v, { currency, compact: true });
  const moneySigned = (v: number) => formatMoney(v, { currency, sign: true });

  if (closed.length === 0) {
    return (
      <div className="animate-in">
        <PageHeader
          title="Analytics"
          description="Edge, risk and behavioural breakdowns of your trading."
        />
        <Card>
          <EmptyState
            icon={BarChart3}
            title={trades.length === 0 ? "No trades in this range" : "No closed trades to analyse"}
            hint="Analytics is computed from closed trades. Widen the date range or switch accounts in the topbar."
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="animate-in">
      <PageHeader
        title="Analytics"
        description={`Edge, risk and behaviour across ${formatNumber(kpis.closedTrades)} closed trades in the selected range.`}
      />

      <div className="space-y-4">
        {/* ——— Stat panel row ——— */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <KpiCard
            label="Profit factor"
            value={pfInfinite ? 0 : kpis.profitFactor}
            format={(n) => (pfInfinite ? "∞" : formatNumber(n, 2))}
            icon={Scale}
            sub="gross wins ÷ gross losses"
          />
          <KpiCard
            label="Expectancy"
            value={kpis.expectancy}
            format={(n) => formatMoney(n, { currency, sign: true })}
            icon={Coins}
            sub="net P&L per closed trade"
            toneBySign
          />
          <KpiCard
            label="Sharpe ratio"
            value={kpis.sharpe}
            format={(n) => formatNumber(n, 2)}
            icon={Activity}
            sub="daily returns · annualised"
          />
          <KpiCard
            label="Avg holding"
            value={kpis.avgHoldingMinutes}
            format={(n) => formatDuration(n)}
            icon={Clock}
            sub={`${formatNumber(kpis.closedTrades)} closed trades`}
          />
          <KpiCard
            label="Payoff ratio"
            value={kpis.payoffRatio}
            format={(n) => formatNumber(n, 2)}
            icon={Divide}
            sub={`avg win ${formatMoney(kpis.avgWin, { currency, compact: true })} vs ${formatMoney(kpis.avgLoss, { currency, compact: true })}`}
          />
          <KpiCard
            label="Longest streaks"
            value={kpis.maxWinStreak}
            format={(n) => `${Math.round(n)} wins`}
            icon={Flame}
            sub={`worst −${kpis.maxLossStreak} losses`}
          />
        </div>

        {/* ——— Charts grid ——— */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* a. P&L by symbol */}
          <GroupPnlCard
            title="P&L by symbol"
            subtitle={topSub(bySymbol.length, "symbols", "net of charges")}
            groups={bySymbol}
            currency={currency}
            emptyHint="No closed trades carry a symbol in this range."
          />

          {/* b. P&L by strategy */}
          <GroupPnlCard
            title="P&L by strategy"
            subtitle={topSub(byStrategy.length, "strategies", "which playbooks pay for themselves")}
            groups={byStrategy}
            currency={currency}
            emptyHint="No closed trades carry a strategy in this range."
          />

          {/* c. P&L by tag */}
          <GroupPnlCard
            title="P&L by tag"
            subtitle={topSub(byTag.length, "tags", "a trade counts once per tag, so groups overlap")}
            groups={byTag}
            currency={currency}
            emptyHint="None of the closed trades in this range are tagged."
          />

          {/* d. P&L by asset class */}
          <PnlColumnCard
            title="P&L by asset class"
            subtitle="Net P&L contribution of each instrument type"
            data={byAsset}
            currency={currency}
            height={300}
          />

          {/* e. Drawdown */}
          <Card
            title="Drawdown"
            subtitle={`Depth below the running equity peak · max ${formatMoney(kpis.maxDrawdown, { currency, compact: true })} (${formatPct(kpis.maxDrawdownPct, 1)})`}
          >
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={drawdown} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="analytics-dd-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={PNL.loss} stopOpacity={0.2} />
                    <stop offset="100%" stopColor={PNL.loss} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...gridDefaults} />
                <XAxis
                  dataKey="date"
                  {...axisDefaults}
                  tickFormatter={(v: string) => formatDateShort(v)}
                  minTickGap={28}
                />
                <YAxis {...axisDefaults} width={56} tickFormatter={moneyTick} />
                <Tooltip
                  content={
                    <ChartTooltip
                      valueFormatter={(v, entry) =>
                        `${moneySigned(v)} · ${formatPct(Number(entry.payload?.drawdownPct ?? 0), 1)}`
                      }
                      labelFormatter={(l) => formatDate(String(l))}
                    />
                  }
                  cursor={{ stroke: GRID }}
                />
                <Area
                  type="monotone"
                  dataKey="drawdown"
                  name="Drawdown"
                  stroke={PNL.loss}
                  strokeWidth={2}
                  fill="url(#analytics-dd-fill)"
                  dot={drawdown.length <= 2 ? ACTIVE_DOT : false}
                  activeDot={ACTIVE_DOT}
                />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          {/* f. Return distribution */}
          <Card
            title="Return distribution"
            subtitle="How closed trades distribute across R multiples · 0.5R buckets"
          >
            {histogram.length === 0 ? (
              <EmptyState
                icon={BarChart3}
                title="No R multiples to bucket"
                hint="Closed trades in this range have no recorded risk, so R multiples can't be computed."
                className="py-8"
              />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={histogram} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid {...gridDefaults} />
                  <XAxis dataKey="label" {...axisDefaults} minTickGap={16} />
                  <YAxis {...axisDefaults} width={32} allowDecimals={false} />
                  <Tooltip
                    content={
                      <ChartTooltip
                        valueFormatter={(v) => `${formatNumber(v)} trades`}
                        labelFormatter={(l) => `${String(l)} bucket`}
                      />
                    }
                    cursor={{ fill: CURSOR_FILL }}
                  />
                  <Bar dataKey="count" name="Trades" maxBarSize={BAR_MAX} radius={BAR_RADIUS}>
                    {histogram.map((b) => (
                      <Cell key={b.label} fill={b.from < 0 ? PNL.loss : PNL.profit} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* g. Long vs short */}
          <Card
            title="Long vs short"
            subtitle="Net P&L on each side of the book, with hit rate and average R per side"
          >
            <ResponsiveContainer width="100%" height={108}>
              <BarChart
                data={longShort}
                layout="vertical"
                margin={{ top: 0, right: 16, bottom: 0, left: 0 }}
              >
                <CartesianGrid {...gridDefaults} horizontal={false} vertical />
                <XAxis type="number" {...axisDefaults} tickFormatter={moneyTick} />
                <YAxis type="category" dataKey="name" width={56} interval={0} {...axisDefaults} />
                <ReferenceLine x={0} stroke={GRID} />
                <Tooltip
                  content={<ChartTooltip valueFormatter={(v) => moneySigned(v)} />}
                  cursor={{ fill: CURSOR_FILL }}
                />
                <Bar dataKey="pnl" name="Net P&L" maxBarSize={BAR_MAX} radius={BAR_RADIUS_H}>
                  {longShort.map((g) => (
                    <Cell key={g.name} fill={pnlMarkColor(g.pnl)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 grid grid-cols-1 gap-3 border-t border-edge-soft pt-4 sm:grid-cols-2">
              {DIRECTIONS.map((dir, i) => {
                const g = longShort[i];
                return (
                  <div key={dir} className="rounded-xl border border-edge-soft px-3.5 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <DirectionBadge direction={dir} />
                      <span className={`tnum text-[13px] font-semibold ${pnlClass(g.pnl)}`}>
                        {moneySigned(g.pnl)}
                      </span>
                    </div>
                    <dl className="mt-2.5 grid grid-cols-3 gap-2">
                      <div>
                        <dt className="label-caps">Trades</dt>
                        <dd className="tnum mt-0.5 text-[13px] font-medium text-ink">
                          {formatNumber(g.trades)}
                        </dd>
                      </div>
                      <div>
                        <dt className="label-caps">Win rate</dt>
                        <dd className="tnum mt-0.5 text-[13px] font-medium text-ink">
                          {formatPct(g.winRate, 0)}
                        </dd>
                      </div>
                      <div>
                        <dt className="label-caps">Avg R</dt>
                        <dd className={`tnum mt-0.5 text-[13px] font-medium ${pnlClass(g.avgR)}`}>
                          {formatR(g.avgR)}
                        </dd>
                      </div>
                    </dl>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* h. Win rate & avg R trend — small multiples, one shared time axis */}
          <Card
            title="Win rate & avg R trend"
            subtitle="Month-by-month small multiples — read for consistency, not single months"
          >
            {trend.length === 0 ? (
              <EmptyState
                icon={BarChart3}
                title="Not enough history"
                hint="Close trades across at least one month to see the trend."
                className="py-8"
              />
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <p className="label-caps mb-2">Win rate %</p>
                  <ResponsiveContainer width="100%" height={190}>
                    <LineChart data={trend} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid {...gridDefaults} />
                      <XAxis dataKey="label" {...axisDefaults} minTickGap={16} />
                      <YAxis
                        {...axisDefaults}
                        width={40}
                        domain={[0, 100]}
                        ticks={[0, 25, 50, 75, 100]}
                        tickFormatter={(v: number) => formatPct(v, 0)}
                      />
                      <Tooltip
                        content={<ChartTooltip valueFormatter={(v) => formatPct(v, 1)} />}
                        cursor={{ stroke: GRID }}
                      />
                      <Line
                        type="monotone"
                        dataKey="winRate"
                        name="Win rate"
                        stroke={CAT[0]}
                        strokeWidth={2}
                        dot={trend.length <= 2 ? ACTIVE_DOT : false}
                        activeDot={ACTIVE_DOT}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <p className="label-caps mb-2">Avg R multiple</p>
                  <ResponsiveContainer width="100%" height={190}>
                    <LineChart data={trend} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid {...gridDefaults} />
                      <XAxis dataKey="label" {...axisDefaults} minTickGap={16} />
                      <YAxis
                        {...axisDefaults}
                        width={36}
                        tickFormatter={(v: number) => formatNumber(v, 1)}
                      />
                      <ReferenceLine y={0} stroke={GRID} />
                      <Tooltip
                        content={<ChartTooltip valueFormatter={(v) => formatR(v)} />}
                        cursor={{ stroke: GRID }}
                      />
                      <Line
                        type="monotone"
                        dataKey="avgR"
                        name="Avg R"
                        stroke={CAT[5]}
                        strokeWidth={2}
                        dot={trend.length <= 2 ? ACTIVE_DOT : false}
                        activeDot={ACTIVE_DOT}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </Card>

          {/* i. Day-of-week performance */}
          <PnlColumnCard
            title="Day-of-week performance"
            subtitle="Net P&L by exit day — hover a bar for trade count and win rate"
            data={byDay}
            currency={currency}
          />

          {/* j. Time-of-day performance */}
          <PnlColumnCard
            title="Time-of-day performance"
            subtitle="Net P&L by entry hour — where in the session your edge lives"
            data={byHour}
            xKey="label"
            currency={currency}
          />
        </div>
      </div>
    </div>
  );
}
