/** Accounts page — one broker account card: identity, stats grid,
 *  12-point equity sparkline and focus / edit / delete actions. */

import { Crosshair, FilterX, Pencil, Trash2, Wallet } from "lucide-react";
import type { Account } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CAT, GRID } from "@/components/charts/chartTheme";
import { formatDate, formatMoney, formatNumber, formatPct, pnlClass } from "@/lib/format";

/** Per-account derived performance, computed once by the page. */
export interface AccountPerf {
  netPnl: number;
  /** capital + realised P&L + net cash flow */
  equity: number;
  /** deposits − withdrawals */
  netCashFlow: number;
  trades: number;
  closedTrades: number;
  openTrades: number;
  winRate: number;
  roiPct: number;
  /** Cumulative-P&L series downsampled to at most 12 points (starts at 0). */
  spark: number[];
}

interface AccountCardProps {
  account: Account;
  perf: AccountPerf;
  focused: boolean;
  onFocus: () => void;
  onFunds: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function initials(broker: string): string {
  const words = broker.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
  const flat = broker.trim();
  return flat ? flat.slice(0, 2).toUpperCase() : "–";
}

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="min-w-0">
      <dt className="label-caps">{label}</dt>
      <dd className={`tnum mt-0.5 truncate text-[13px] font-semibold ${className ?? "text-ink"}`}>
        {value}
      </dd>
    </div>
  );
}

/** Inline SVG equity sparkline — CAT[0] stroke, faint zero reference line.
 *  Stretches to the card width; strokes stay crisp via non-scaling-stroke, and the
 *  end dot is drawn with round line caps so it stays circular under scaling. */
function Sparkline({ points, label }: { points: number[]; label: string }) {
  const W = 240;
  const H = 48;
  const PAD = 5;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const x = (i: number) => PAD + (i * (W - PAD * 2)) / (points.length - 1);
  const y = (v: number) => H - PAD - ((v - min) / span) * (H - PAD * 2);
  const coords = points.map((p, i) => `${x(i).toFixed(2)},${y(p).toFixed(2)}`).join(" ");
  const lastX = x(points.length - 1).toFixed(2);
  const lastY = y(points[points.length - 1]).toFixed(2);
  const zeroY = min < 0 && max > 0 ? y(0).toFixed(2) : null;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="mt-2 h-12 w-full"
      role="img"
      aria-label={label}
    >
      {zeroY !== null && (
        <line
          x1={PAD}
          x2={W - PAD}
          y1={zeroY}
          y2={zeroY}
          stroke={GRID}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      )}
      <polyline
        points={coords}
        fill="none"
        stroke={CAT[0]}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={`M ${lastX} ${lastY} h 0.01`}
        fill="none"
        stroke="#141619"
        strokeWidth={10}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={`M ${lastX} ${lastY} h 0.01`}
        fill="none"
        stroke={CAT[0]}
        strokeWidth={6}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function AccountCard({ account, perf, focused, onFocus, onFunds, onEdit, onDelete }: AccountCardProps) {
  const currency = account.currency;
  const hasClosed = perf.closedTrades > 0;

  return (
    <Card
      className={`h-full transition-shadow duration-200 ${focused ? "ring-1 ring-accent/60" : ""}`}
      bodyClassName="flex h-full flex-col"
    >
      {/* identity */}
      <div className="flex items-start gap-3">
        <div
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[13px] font-semibold tracking-wide text-accent"
        >
          {initials(account.broker)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate text-[14px] font-semibold text-ink">{account.name}</h3>
            {focused && (
              <Badge tone="accent" className="shrink-0">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
                Focused
              </Badge>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge>{account.broker}</Badge>
            <Badge tone="info">{account.currency}</Badge>
            {perf.openTrades > 0 && (
              <Badge tone="warning">
                {perf.openTrades} open
              </Badge>
            )}
            <span className="text-[11px] text-faint">since {formatDate(account.createdAt)}</span>
          </div>
        </div>
      </div>

      {/* stats */}
      <dl className="mt-4 grid grid-cols-3 gap-x-3 gap-y-3">
        <Stat label="Capital" value={formatMoney(account.startingCapital, { currency, compact: true })} />
        <Stat label="Balance" value={formatMoney(perf.equity, { currency, compact: true })} />
        <Stat
          label="Net P&L"
          value={formatMoney(perf.netPnl, { currency, compact: true, sign: true })}
          className={pnlClass(perf.netPnl)}
        />
        <Stat label="Trades" value={formatNumber(perf.trades)} />
        <Stat label="Win rate" value={hasClosed ? formatPct(perf.winRate) : "—"} />
        <Stat
          label="ROI"
          value={hasClosed ? formatPct(perf.roiPct, 1, true) : "—"}
          className={hasClosed ? pnlClass(perf.roiPct) : undefined}
        />
      </dl>

      {/* net funding (deposits − withdrawals) */}
      {perf.netCashFlow !== 0 && (
        <p className="mt-2.5 flex items-center gap-1.5 text-[11px] text-muted">
          <Wallet size={12} className="text-faint" aria-hidden />
          <span>
            Net funding{" "}
            <span className={`tnum font-medium ${perf.netCashFlow >= 0 ? "text-profit" : "text-loss"}`}>
              {perf.netCashFlow >= 0 ? "+" : "−"}
              {formatMoney(Math.abs(perf.netCashFlow), { currency, compact: true })}
            </span>{" "}
            in cash movements
          </span>
        </p>
      )}

      {/* equity sparkline */}
      <div className="mt-4 pb-4">
        <div className="flex items-center justify-between gap-2">
          <span className="label-caps">Equity trend</span>
          <span className={`tnum text-[11px] font-medium ${pnlClass(perf.netPnl)}`}>
            {formatMoney(perf.netPnl, { currency, compact: true, sign: true })}
          </span>
        </div>
        {perf.spark.length >= 2 ? (
          <Sparkline points={perf.spark} label={`Equity trend for ${account.name}`} />
        ) : (
          <div className="mt-2 flex h-12 items-center justify-center rounded-lg border border-dashed border-edge-soft text-[11px] text-faint">
            No closed trades yet
          </div>
        )}
      </div>

      {/* actions */}
      <div className="mt-auto flex items-center gap-2 border-t border-edge-soft pt-3">
        <Button
          size="sm"
          variant="outline"
          icon={focused ? FilterX : Crosshair}
          onClick={onFocus}
          aria-pressed={focused}
        >
          {focused ? "Unfocus" : "Focus"}
        </Button>
        <Button size="sm" variant="outline" icon={Wallet} onClick={onFunds}>
          Funds
        </Button>
        <div className="ml-auto flex items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            icon={Pencil}
            aria-label={`Edit ${account.name}`}
            onClick={onEdit}
          />
          <Button
            size="sm"
            variant="danger"
            icon={Trash2}
            aria-label={`Delete ${account.name}`}
            onClick={onDelete}
          />
        </div>
      </div>
    </Card>
  );
}
