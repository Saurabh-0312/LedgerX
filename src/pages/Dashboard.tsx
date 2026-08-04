/** Dashboard / Overview — the app's hero view: KPI grid, equity curve, monthly
 *  breakdowns, mini P&L calendar and the latest trades. All data flows from the
 *  global topbar filters via useFilteredTrades(). */

import { useMemo } from "react";
import type { ComponentProps } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowDownRight,
  Flame,
  Landmark,
  Layers,
  Percent,
  Plus,
  Scale,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  Wallet,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import { useFilteredCashFlows, useFilteredTrades } from "@/store/useFilteredTrades";
import { averageMonthlyReturn, computeKpis, equityCurve } from "@/lib/metrics";
import { formatDateShort, formatMoney, formatNumber, formatPct } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard } from "@/components/ui/KpiCard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { EquityCurveCard } from "@/pages/dashboard/EquityCurveCard";
import { OverallCumulativeCard } from "@/pages/dashboard/OverallCumulativeCard";
import { MonthlyPerformanceCard } from "@/pages/dashboard/MonthlyPerformanceCard";
import { QuarterlyComparisonCard } from "@/pages/dashboard/QuarterlyComparisonCard";
import { MonthlyPnlCard } from "@/pages/dashboard/MonthlyPnlCard";
import { WinRateDonutCard } from "@/pages/dashboard/WinRateDonutCard";
import { MonthCompareCard } from "@/pages/dashboard/MonthCompareCard";
import { PnlCalendarCard } from "@/pages/dashboard/PnlCalendarCard";
import { RecentTradesCard } from "@/pages/dashboard/RecentTradesCard";

type KpiProps = ComponentProps<typeof KpiCard>;

const streakFormat = (n: number): string => {
  const v = Math.round(n);
  if (v > 0) return `+${v} win${v === 1 ? "" : "s"}`;
  if (v < 0) return `−${Math.abs(v)} loss${Math.abs(v) === 1 ? "" : "es"}`;
  return "0";
};

export default function Dashboard() {
  const navigate = useNavigate();
  const trades = useFilteredTrades();
  const cashFlows = useFilteredCashFlows();
  const accountId = useStore((s) => s.filters.accountId);
  const accounts = useStore((s) => s.accounts);
  const baseCapital = useStore((s) => s.settings.startingCapital);
  // Baseline for the equity curve/KPIs: the sum of your accounts' capital
  // ("all") or the focused account's capital — never a stale global number.
  const capital = useMemo(() => {
    if (accountId === "all") {
      const summed = accounts.reduce((sum, a) => sum + a.startingCapital, 0);
      return accounts.length > 0 ? summed : baseCapital;
    }
    return accounts.find((a) => a.id === accountId)?.startingCapital ?? baseCapital;
  }, [accountId, accounts, baseCapital]);
  // Average monthly % return — all-time, over every month with a portfolio value.
  const allTrades = useStore((s) => s.trades);
  const capitalByMonth = useStore((s) => s.portfolioTargets.capitalByMonth);
  const avgReturn = useMemo(
    () => averageMonthlyReturn(allTrades, capitalByMonth),
    [allTrades, capitalByMonth],
  );
  const userName = useStore((s) => s.settings.userName);

  const kpis = useMemo(() => computeKpis(trades, capital), [trades, capital]);
  const spark = useMemo(
    () => equityCurve(trades, capital).slice(-12).map((p) => p.equity),
    [trades, capital],
  );

  const addTradeAction = (
    <Button variant="primary" icon={Plus} onClick={() => navigate("/trades/new")}>
      Add trade
    </Button>
  );
  const firstName = userName.split(" ")[0] || "trader";
  const description = `Welcome back, ${firstName} — your performance at a glance, scoped by the global date range and account.`;

  if (trades.length === 0) {
    return (
      <>
        <PageHeader title="Dashboard" description={description} actions={addTradeAction} />
        <Card className="animate-in">
          <EmptyState
            title="No trades in this range"
            hint="Widen the global date range, switch accounts, or log your first trade to light up the dashboard."
            action={
              <Button variant="primary" icon={Plus} onClick={() => navigate("/trades/new")}>
                Add trade
              </Button>
            }
          />
        </Card>
      </>
    );
  }

  const tiles: KpiProps[] = [
    {
      label: "Total Net P&L",
      value: kpis.totalNetPnl,
      format: (n) => formatMoney(n, { compact: true, sign: true }),
      toneBySign: true,
      spark,
      sub: `${kpis.closedTrades} closed trades`,
      icon: Wallet,
    },
    {
      label: "Win Rate",
      value: kpis.winRate,
      format: (n) => formatPct(n, 1),
      sub: `${kpis.wins}W · ${kpis.losses}L · ${kpis.breakevens}BE`,
      icon: Target,
    },
    {
      label: "Profit Factor",
      value: kpis.profitFactor,
      format: (n) => (Number.isFinite(n) ? n.toFixed(2) : "∞"),
      sub: "gross wins ÷ gross losses",
      icon: Scale,
    },
    {
      label: "Total Trades",
      value: kpis.totalTrades,
      format: (n) => formatNumber(n),
      sub: `${kpis.openTrades} open · ${kpis.closedTrades} closed`,
      icon: Layers,
    },
    {
      label: "Avg Win",
      value: kpis.avgWin,
      format: (n) => formatMoney(n, { compact: true }),
      sub: "per winning trade",
      icon: TrendingUp,
    },
    {
      label: "Avg Loss",
      value: kpis.avgLoss,
      format: (n) => formatMoney(n, { compact: true }),
      sub: "per losing trade",
      icon: TrendingDown,
    },
    {
      label: "Total Charges",
      value: kpis.totalCharges,
      format: (n) => formatMoney(n, { compact: true }),
      sub: `${formatPct(kpis.chargesPctOfGross, 1)} of gross P&L`,
      icon: AlertTriangle,
    },
    {
      label: "Est. Tax (rough)",
      value: kpis.totalTax,
      format: (n) => formatMoney(n, { compact: true }),
      sub: "per-trade est. · see Tax Report",
      icon: Landmark,
    },
    {
      label: "Current Streak",
      value: kpis.currentStreak,
      format: streakFormat,
      toneBySign: true,
      sub: `best +${kpis.maxWinStreak} · worst −${kpis.maxLossStreak}`,
      icon: Flame,
    },
    {
      label: "Max Drawdown",
      value: kpis.maxDrawdown,
      format: (n) => formatMoney(n, { compact: true }),
      sub: `${formatPct(-kpis.maxDrawdownPct, 1)} from peak equity`,
      icon: ArrowDownRight,
    },
    {
      label: "Best Trade",
      value: kpis.bestTrade?.netPnl ?? 0,
      format: (n) => formatMoney(n, { compact: true, sign: true }),
      toneBySign: true,
      sub: kpis.bestTrade
        ? `${kpis.bestTrade.symbol} · ${formatDateShort(kpis.bestTrade.closedAt ?? kpis.bestTrade.openedAt)}`
        : "—",
      icon: Trophy,
    },
    {
      label: "Avg monthly return",
      value: avgReturn.avgPct,
      format: (n) => formatPct(n, 2, true),
      toneBySign: true,
      sub:
        avgReturn.months > 0
          ? `all-time avg · ${avgReturn.months} month${avgReturn.months === 1 ? "" : "s"}, every year`
          : "set portfolio values in Goals",
      icon: Percent,
    },
  ];

  return (
    <>
      <PageHeader title="Dashboard" description={description} actions={addTradeAction} />
      <div className="animate-in space-y-4">
        {/* 1 — KPI grid (two rows of six on xl) */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {tiles.map((t) => (
            <KpiCard key={t.label} {...t} />
          ))}
        </div>

        {/* 2 — hero equity curve */}
        <EquityCurveCard trades={trades} capital={capital} cashFlows={cashFlows} />

        {/* 2a — overall cumulative profit, full width, all months first→last */}
        <OverallCumulativeCard trades={trades} />

        {/* 2b — monthly bars + cumulative line with its own year filter */}
        <MonthlyPerformanceCard />

        {/* 2c — quarter-vs-quarter FY comparison */}
        <QuarterlyComparisonCard />

        {/* 3 — monthly bars · win-rate donut · month-over-month compare */}
        <div className="grid gap-4 md:grid-cols-3">
          <MonthlyPnlCard trades={trades} />
          <WinRateDonutCard kpis={kpis} />
          <MonthCompareCard trades={trades} />
        </div>

        {/* 4 + 5 — mini P&L calendar and the latest trades */}
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="min-w-0">
            <PnlCalendarCard trades={trades} />
          </div>
          <div className="min-w-0 lg:col-span-2">
            <RecentTradesCard trades={trades} />
          </div>
        </div>
      </div>
    </>
  );
}
