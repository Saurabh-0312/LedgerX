/** MTF hero strip (spec §7.1.1 / §7.5) — four inline "running" interest stats.
 *  All figures are interest → amber text-warning; the live number pulses. */

import type { LucideIcon } from "lucide-react";
import { CalendarClock, Flame, Wallet, Zap } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { formatMoney } from "@/lib/format";
import type { PortfolioStats } from "@/lib/mtf/types";

const money = (v: number) => formatMoney(v, { decimals: true });

interface MeterStatProps {
  icon: LucideIcon;
  label: string;
  value: string;
  suffix?: string;
  sub?: string;
  /** subtle 2s opacity pulse on the figure — the "running" feel */
  pulse?: boolean;
  /** small pulsing live-dot beside the label */
  live?: boolean;
}

function MeterStat({ icon: Icon, label, value, suffix, sub, pulse, live }: MeterStatProps) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-warning-soft">
        <Icon size={16} className="text-warning" aria-hidden />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="label-caps">{label}</span>
          {live && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-warning animate-pulse" aria-hidden />}
        </div>
        <div
          className={`mt-1 whitespace-nowrap text-[22px] font-semibold leading-tight tracking-tight text-warning ${
            pulse ? "animate-pulse" : ""
          }`}
        >
          {value}
          {suffix && <span className="ml-0.5 text-[13px] font-medium text-muted">{suffix}</span>}
        </div>
        {sub && <div className="mt-0.5 truncate text-[11px] text-muted">{sub}</div>}
      </div>
    </div>
  );
}

export function LiveInterestMeter({ stats }: { stats: PortfolioStats }) {
  const openLabel = `${stats.activeCount} open position${stats.activeCount === 1 ? "" : "s"}`;
  return (
    <Card>
      <div className="grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-4">
        <MeterStat
          icon={Flame}
          label="Today's Interest Running"
          value={money(stats.todaysInterest)}
          sub={`accruing on ${openLabel}`}
          pulse
          live
        />
        <MeterStat
          icon={Zap}
          label="Current Daily Burn"
          value={money(stats.avgDailyCost)}
          suffix="/day"
          sub="portfolio-wide financing cost"
        />
        <MeterStat
          icon={Wallet}
          label="Total Interest Paid"
          value={money(stats.lifetimeInterest)}
          sub="lifetime · open + closed"
        />
        <MeterStat
          icon={CalendarClock}
          label="Estimated Tomorrow"
          value={money(stats.estTomorrow)}
          sub="at today's burn rate"
        />
      </div>
    </Card>
  );
}
