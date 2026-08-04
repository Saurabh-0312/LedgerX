/** MTF portfolio analytics (spec §10) — financing totals, the blended
 *  "gross needed to break even" meter, averages, and named standout positions.
 *  Interest figures amber, holding figures info blue, P&L via pnlClass. */

import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { formatDate, formatMoney, formatNumber, formatPct, pnlClass } from "@/lib/format";
import type { ComputedPosition, PortfolioStats } from "@/lib/mtf/types";

function StatBlock({ label, value, valueClass = "text-ink" }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="rounded-xl border border-edge-soft px-3.5 py-3">
      <div className="label-caps">{label}</div>
      <div className={`tnum mt-1 text-[15px] font-semibold ${valueClass}`}>{value}</div>
    </div>
  );
}

interface NamedTileDef {
  label: string;
  cp: ComputedPosition | null;
  figure: (cp: ComputedPosition) => string;
  figureClass?: (cp: ComputedPosition) => string;
}

function NamedTile({ label, cp, figure, figureClass }: NamedTileDef) {
  return (
    <div className="rounded-xl border border-edge-soft px-3.5 py-3">
      <div className="label-caps">{label}</div>
      {cp ? (
        <>
          <div className="mt-1 truncate text-[15px] font-semibold text-ink">{cp.pos.symbol}</div>
          <div className={`tnum mt-0.5 truncate text-[11px] ${figureClass ? figureClass(cp) : "text-muted"}`}>
            {figure(cp)}
          </div>
        </>
      ) : (
        <div className="mt-1 text-[15px] font-semibold text-faint">—</div>
      )}
    </div>
  );
}

export function PortfolioAnalytics({ stats }: { stats: PortfolioStats }) {
  if (stats.activeCount === 0 && stats.closedCount === 0) {
    return (
      <Card title="Portfolio analytics">
        <EmptyState
          title="No portfolio data"
          hint="Add an MTF position to see portfolio-level financing analytics."
        />
      </Card>
    );
  }

  // Blended portfolio break-even: Σ(I+interest+charges)/Σqty is meaningless
  // across different stocks — instead show how much of the OPEN book's financing
  // cost (open interest + open charges) its gross unrealized P&L covers. Both
  // sides are open-only so the numerator and denominator are comparable.
  const costs = stats.openInterest + stats.openCharges;
  const coveredPct = costs > 0 ? Math.max(0, (stats.grossUnrealized / costs) * 100) : 100;
  const covered = stats.grossUnrealized >= costs;

  const numeric: { label: string; value: string; valueClass?: string }[] = [
    { label: "Total Portfolio Interest", value: formatMoney(stats.lifetimeInterest, { decimals: true }), valueClass: "text-warning" },
    { label: "Total Portfolio Charges", value: formatMoney(stats.totalCharges, { decimals: true }) },
    { label: "Gross Unrealized (open)", value: formatMoney(stats.grossUnrealized, { sign: true }), valueClass: pnlClass(stats.grossUnrealized) },
    { label: "Net Unrealized (open)", value: formatMoney(stats.openNetProfit, { sign: true }), valueClass: pnlClass(stats.openNetProfit) },
    { label: "Avg Daily Interest", value: formatMoney(stats.avgDailyInterest, { decimals: true }), valueClass: "text-warning" },
    { label: "Avg Holding Days", value: `${formatNumber(stats.avgHoldingDays, 1)} days`, valueClass: "text-info" },
    { label: "Avg Position Size", value: formatMoney(stats.avgPositionSize, { compact: true }) },
    { label: "Avg Interest / Position", value: formatMoney(stats.avgInterestPerPosition, { decimals: true }), valueClass: "text-warning" },
  ];

  const named: NamedTileDef[] = [
    {
      label: "Most Expensive",
      cp: stats.mostExpensiveHolding,
      figure: (cp) => formatMoney(cp.totalInvestment, { compact: true }),
    },
    {
      label: "Cheapest",
      cp: stats.cheapestHolding,
      figure: (cp) => formatMoney(cp.totalInvestment, { compact: true }),
    },
    {
      label: "Highest Interest",
      cp: stats.highestInterestPosition,
      figure: (cp) => formatMoney(cp.accumulatedInterest, { decimals: true }),
      figureClass: () => "text-warning",
    },
    {
      label: "Highest Profit",
      cp: stats.highestProfitStock,
      figure: (cp) => formatMoney(cp.netProfit, { sign: true }),
      figureClass: (cp) => pnlClass(cp.netProfit),
    },
    {
      label: "Highest Loss",
      cp: stats.highestLossStock,
      figure: (cp) => formatMoney(cp.netProfit, { sign: true }),
      figureClass: (cp) => pnlClass(cp.netProfit),
    },
    {
      label: "Longest Holding",
      cp: stats.longestHolding,
      figure: (cp) => `${formatNumber(cp.holdingDays)} days`,
      figureClass: () => "text-info",
    },
    {
      label: "Newest",
      cp: stats.newestPosition,
      figure: (cp) => formatDate(cp.pos.purchaseDate),
    },
  ];

  return (
    <Card
      title="Portfolio analytics"
      subtitle="Financing costs, blended break-even & standout positions"
      bodyClassName="space-y-5"
    >
      {/* Portfolio break-even — gross profit needed to cover interest + charges */}
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className="label-caps">Portfolio break-even · gross needed</span>
          <span className="tnum text-[12px] text-muted">
            <span className={pnlClass(stats.grossUnrealized)}>
              {formatMoney(stats.grossUnrealized, { sign: true })}
            </span>{" "}
            gross vs <span className="text-ink">{formatMoney(costs, { decimals: true })}</span> interest + charges
            {" · "}
            {formatPct(Math.min(coveredPct, 999), 0)} covered
          </span>
        </div>
        <ProgressBar
          className="mt-2"
          value={coveredPct}
          tone={covered ? "profit" : "warning"}
          label="Share of interest and charges covered by gross unrealized profit"
        />
        <p className="mt-1.5 text-[11px] text-faint">
          {covered
            ? `Gross profit fully covers financing — ${formatMoney(stats.grossUnrealized - costs, { decimals: true })} clear of break-even.`
            : `${formatMoney(costs - stats.grossUnrealized, { decimals: true })} more gross profit needed to cover interest + charges.`}{" "}
          Open positions only · financing ≈ {formatMoney(costs, { decimals: true })}.
        </p>
      </div>

      {/* Numeric portfolio stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {numeric.map((s) => (
          <StatBlock key={s.label} label={s.label} value={s.value} valueClass={s.valueClass} />
        ))}
      </div>

      {/* Named standout positions */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {named.map((n) => (
          <NamedTile key={n.label} {...n} />
        ))}
      </div>
    </Card>
  );
}
