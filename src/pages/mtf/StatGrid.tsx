/** MTF KPI grid (spec §7.1.2) — every portfolio stat as an animated KpiCard.
 *  VALUES stay ink (KpiCard owns P&L tones via toneBySign); interest tiles get
 *  an amber-ish SUB line via a scoped variant — text never wears chart hues. */

import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Archive,
  Calendar,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  CalendarRange,
  Crown,
  Flame,
  History,
  Hourglass,
  Landmark,
  Layers,
  Percent,
  Receipt,
  Scale,
  Sunrise,
  Telescope,
  Timer,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react";
import { KpiCard } from "@/components/ui/KpiCard";
import { formatMoney, formatNumber } from "@/lib/format";
import type { PortfolioStats } from "@/lib/mtf/types";

const compact = (n: number) => formatMoney(n, { compact: true });
const compactSigned = (n: number) => formatMoney(n, { compact: true, sign: true });
const paisa = (n: number) => formatMoney(n, { decimals: true });
const count = (n: number) => formatNumber(n);

/** Tints only the KpiCard sub line amber (token color, no raw hex). */
const AMBER_SUB = "[&_.text-muted]:text-warning/80";

interface Tile {
  label: string;
  value: number;
  format: (n: number) => string;
  icon: LucideIcon;
  sub: string;
  toneBySign?: boolean;
  amberSub?: boolean;
}

export function StatGrid({ stats }: { stats: PortfolioStats }) {
  const tiles: Tile[] = [
    { label: "Active Positions", value: stats.activeCount, format: count, icon: Layers, sub: "open on margin" },
    { label: "Closed Positions", value: stats.closedCount, format: count, icon: Archive, sub: "history retained" },
    { label: "Total Capital Invested", value: stats.totalCapitalInvested, format: compact, icon: Wallet, sub: "across open positions" },
    { label: "Current Portfolio Value", value: stats.currentPortfolioValue, format: compact, icon: Landmark, sub: "marked at current price" },
    { label: "Gross Unrealized P&L", value: stats.grossUnrealized, format: compactSigned, icon: TrendingUp, sub: "before interest & charges", toneBySign: true },
    { label: "Total Interest Paid", value: stats.totalInterestPaid, format: paisa, icon: Percent, sub: "lifetime financing cost", amberSub: true },
    { label: "Today's Interest", value: stats.todaysInterest, format: paisa, icon: Flame, sub: "accruing today", amberSub: true },
    { label: "Yesterday's Interest", value: stats.yesterdaysInterest, format: paisa, icon: History, sub: "previous day's burn", amberSub: true },
    { label: "Weekly Interest", value: stats.weeklyInterest, format: paisa, icon: CalendarDays, sub: "last 7 days", amberSub: true },
    { label: "Monthly Interest", value: stats.monthlyInterest, format: paisa, icon: CalendarRange, sub: "last 30 days", amberSub: true },
    { label: "Lifetime Interest", value: stats.lifetimeInterest, format: paisa, icon: Hourglass, sub: "all positions, all time", amberSub: true },
    { label: "Total Trading Charges", value: stats.totalCharges, format: paisa, icon: Receipt, sub: "round-trip estimate" },
    { label: "Net Portfolio Profit", value: stats.netPortfolioProfit, format: compactSigned, icon: Scale, sub: "after interest & charges", toneBySign: true },
    { label: "Avg Daily Interest", value: stats.avgDailyInterest, format: paisa, icon: Activity, sub: "per open position", amberSub: true },
    {
      label: "Highest Interest Position",
      value: stats.highestInterestPosition?.accumulatedInterest ?? 0,
      format: paisa,
      icon: Crown,
      sub: stats.highestInterestPosition?.pos.symbol ?? "—",
      amberSub: true,
    },
    {
      label: "Longest Holding",
      value: stats.longestHolding?.holdingDays ?? 0,
      format: (n) => `${formatNumber(n)} days`,
      icon: Timer,
      sub: stats.longestHolding?.pos.symbol ?? "—",
    },
    { label: "Avg Holding Days", value: stats.avgHoldingDays, format: (n) => `${formatNumber(n, 1)} days`, icon: CalendarClock, sub: "across open positions" },
    { label: "Avg Daily Cost", value: stats.avgDailyCost, format: (n) => `${paisa(n)}/day`, icon: Zap, sub: "portfolio burn", amberSub: true },
    { label: "Est. Tomorrow", value: stats.estTomorrow, format: paisa, icon: Sunrise, sub: "+1 day at today's burn", amberSub: true },
    { label: "Est. 7 Days", value: stats.est7d, format: paisa, icon: CalendarPlus, sub: "at today's burn rate", amberSub: true },
    { label: "Est. 30 Days", value: stats.est30d, format: paisa, icon: Calendar, sub: "at today's burn rate", amberSub: true },
    { label: "Est. 90 Days", value: stats.est90d, format: paisa, icon: Telescope, sub: "at today's burn rate", amberSub: true },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {tiles.map((t) => (
        <KpiCard
          key={t.label}
          label={t.label}
          value={t.value}
          format={t.format}
          icon={t.icon}
          sub={t.sub}
          toneBySign={t.toneBySign ?? false}
          className={t.amberSub ? AMBER_SUB : ""}
        />
      ))}
    </div>
  );
}
