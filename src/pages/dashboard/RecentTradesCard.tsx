/** Dashboard tile — the last 10 open/closed trades; row click opens the trade drawer on /trades. */

import { useMemo } from "react";
import type { KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Receipt } from "lucide-react";
import type { Trade } from "@/types";
import { formatDate, formatMoney, formatNumber, formatR, pnlClass } from "@/lib/format";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { DirectionBadge, StatusBadge } from "@/components/ui/Badge";
import { TableShell, TH, TD, rowClass } from "@/components/ui/Table";

export function RecentTradesCard({ trades }: { trades: Trade[] }) {
  const navigate = useNavigate();

  const recent = useMemo(
    () =>
      trades
        .filter((t) => t.status !== "Cancelled")
        .sort(
          (a, b) =>
            new Date(b.closedAt ?? b.openedAt).getTime() - new Date(a.closedAt ?? a.openedAt).getTime(),
        )
        .slice(0, 10),
    [trades],
  );

  const openTrade = (id: string) => navigate(`/trades?highlight=${id}`);
  const onRowKey = (e: KeyboardEvent<HTMLTableRowElement>, id: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openTrade(id);
    }
  };

  return (
    <Card
      className="h-full overflow-hidden"
      bodyClassName="p-0 pt-1"
      title="Recent trades"
      subtitle="Latest activity in the selected scope"
      action={
        <Button variant="ghost" size="sm" onClick={() => navigate("/trades")}>
          View all →
        </Button>
      }
    >
      {recent.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No trades yet"
          hint="Log your first trade to see it show up here."
          action={
            <Button variant="primary" size="sm" icon={Plus} onClick={() => navigate("/trades/new")}>
              Log a trade
            </Button>
          }
        />
      ) : (
        <TableShell className="[&_tbody_tr:last-child_td]:border-b-0">
          <thead>
            <tr>
              <TH className="pl-5">Date</TH>
              <TH>Symbol</TH>
              <TH>Side</TH>
              <TH className="tnum text-right">Qty</TH>
              <TH className="tnum text-right">Entry → Exit</TH>
              <TH className="tnum text-right">Net P&L</TH>
              <TH className="tnum text-right">R</TH>
              <TH>Strategy</TH>
              <TH className="pr-5">Status</TH>
            </tr>
          </thead>
          <tbody>
            {recent.map((t) => (
              <tr
                key={t.id}
                tabIndex={0}
                aria-label={`Open trade ${t.id} — ${t.symbol}`}
                className={`${rowClass} focus:outline-none focus-visible:bg-raised/60`}
                onClick={() => openTrade(t.id)}
                onKeyDown={(e) => onRowKey(e, t.id)}
              >
                <TD className="pl-5 text-muted">{formatDate(t.closedAt ?? t.openedAt)}</TD>
                <TD>
                  <span className="font-medium text-ink">{t.symbol}</span>
                  <span className="ml-2 text-[11px] text-faint">{t.assetClass}</span>
                </TD>
                <TD>
                  <DirectionBadge direction={t.direction} />
                </TD>
                <TD className="tnum text-right">{formatNumber(t.quantity, t.quantity % 1 !== 0 ? 4 : 0)}</TD>
                <TD className="tnum text-right text-muted">
                  {formatNumber(t.entryPrice, 2)} <span className="text-faint">→</span>{" "}
                  {t.exitPrice !== undefined ? formatNumber(t.exitPrice, 2) : "—"}
                </TD>
                <TD
                  className={`tnum text-right font-medium ${
                    t.status === "Closed" ? pnlClass(t.netPnl) : "text-muted"
                  }`}
                >
                  {t.status === "Closed" ? formatMoney(t.netPnl, { sign: true }) : "—"}
                </TD>
                <TD className={`tnum text-right ${t.rMultiple !== undefined ? pnlClass(t.rMultiple) : "text-muted"}`}>
                  {formatR(t.rMultiple)}
                </TD>
                <TD className="max-w-[160px] truncate text-muted">{t.strategy}</TD>
                <TD className="pr-5">
                  <StatusBadge status={t.status} />
                </TD>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}
    </Card>
  );
}
