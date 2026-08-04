import { useMemo } from "react";
import { CalendarOff } from "lucide-react";
import type { Trade } from "@/types";
import { Drawer } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { DirectionBadge, StatusBadge } from "@/components/ui/Badge";
import { formatDate, formatDuration, formatMoney, formatR, formatTime, pnlClass } from "@/lib/format";

interface DayPanelProps {
  /** yyyy-MM-dd of the open day, or null when closed */
  date: string | null;
  /** that day's trades (all statuses), sorted by open time */
  trades: Trade[];
  onClose: () => void;
  onOpenTrade: (id: string) => void;
}

function MiniStat({ label, value, valueClass = "text-ink" }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="rounded-lg border border-edge-soft bg-raised/40 px-3 py-2">
      <div className="label-caps">{label}</div>
      <div className={`tnum mt-0.5 text-[13px] font-semibold ${valueClass}`}>{value}</div>
    </div>
  );
}

/** Right-side drawer for a single calendar day: totals header + compact trade rows. */
export function DayPanel({ date, trades, onClose, onOpenTrade }: DayPanelProps) {
  const stats = useMemo(() => {
    const closed = trades.filter((t) => t.status === "Closed");
    const net = closed.reduce((s, t) => s + t.netPnl, 0);
    const gross = closed.reduce((s, t) => s + t.grossPnl, 0);
    const charges = closed.reduce((s, t) => s + t.charges.total, 0);
    const wins = closed.filter((t) => t.netPnl > 0).length;
    const losses = closed.filter((t) => t.netPnl < 0).length;
    const rs = closed.map((t) => t.rMultiple).filter((r): r is number => r !== undefined);
    const avgR = rs.length > 0 ? rs.reduce((s, r) => s + r, 0) / rs.length : undefined;
    const open = trades.filter((t) => t.status === "Open").length;
    const cancelled = trades.filter((t) => t.status === "Cancelled").length;
    return { closedCount: closed.length, net, gross, charges, wins, losses, avgR, open, cancelled };
  }, [trades]);

  return (
    <Drawer open={date !== null} onClose={onClose} title={date ? formatDate(date) : ""}>
      {date !== null &&
        (trades.length === 0 ? (
          <EmptyState icon={CalendarOff} title="No trades this day" hint="Sometimes the best trade is none." />
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-edge bg-raised/40 p-4">
              <div className="label-caps">Day net P&L</div>
              <div className={`mt-1 text-[26px] font-semibold tracking-tight ${pnlClass(stats.net)}`}>
                {formatMoney(stats.net, { sign: true })}
              </div>
              <div className="mt-1 text-[12px] text-muted">
                {stats.closedCount} closed · <span className="text-profit">{stats.wins}W</span> ·{" "}
                <span className="text-loss">{stats.losses}L</span>
                {stats.open > 0 && ` · ${stats.open} open`}
                {stats.cancelled > 0 && ` · ${stats.cancelled} cancelled`}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <MiniStat label="Gross" value={formatMoney(stats.gross, { sign: true })} valueClass={pnlClass(stats.gross)} />
              <MiniStat label="Charges" value={formatMoney(stats.charges)} />
              <MiniStat
                label="Avg R"
                value={formatR(stats.avgR)}
                valueClass={stats.avgR !== undefined ? pnlClass(stats.avgR) : "text-muted"}
              />
            </div>

            <div>
              <div className="label-caps mb-2">
                Trades ({trades.length})
              </div>
              <ul className="space-y-1.5">
                {trades.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => onOpenTrade(t.id)}
                      className="flex w-full items-center justify-between gap-3 rounded-lg border border-edge-soft bg-surface px-3 py-2.5 text-left transition-colors hover:border-edge hover:bg-raised/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-medium text-ink">{t.symbol}</span>
                          <DirectionBadge direction={t.direction} />
                          {t.status !== "Closed" && <StatusBadge status={t.status} />}
                        </div>
                        <div className="mt-0.5 truncate text-[11px] text-muted">
                          {t.strategy} · {formatTime(t.openedAt)}
                          {t.holdingMinutes !== undefined && ` · ${formatDuration(t.holdingMinutes)}`}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        {t.status === "Closed" ? (
                          <>
                            <div className={`tnum text-[13px] font-semibold ${pnlClass(t.netPnl)}`}>
                              {formatMoney(t.netPnl, { sign: true })}
                            </div>
                            <div className="tnum text-[11px] text-muted">{formatR(t.rMultiple)}</div>
                          </>
                        ) : (
                          <span className="text-[12px] text-muted">—</span>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
    </Drawer>
  );
}
