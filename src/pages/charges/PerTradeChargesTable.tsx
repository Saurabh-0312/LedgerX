/** Per-trade charges — paginated 12/page, sorted by total charges desc.
 *  Row click / Enter opens the trade drawer on the Trades page. */

import { useMemo, useState } from "react";
import type { KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Receipt } from "lucide-react";
import type { Trade } from "@/types";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { TD, TH, TableShell, rowClass } from "@/components/ui/Table";
import { formatDate, formatMoney, pnlClass } from "@/lib/format";
import { CHARGE_COMPONENTS } from "./chargeComponents";

const PAGE_SIZE = 12;

export function PerTradeChargesTable({ trades }: { trades: Trade[] }) {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);

  const sorted = useMemo(
    () => trades.filter((t) => t.charges.total > 0).sort((a, b) => b.charges.total - a.charges.total),
    [trades],
  );

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const start = safePage * PAGE_SIZE;
  const visible = sorted.slice(start, start + PAGE_SIZE);

  if (sorted.length === 0) {
    return (
      <EmptyState
        icon={Receipt}
        title="No charged trades in this range"
        hint="Trades appear here as soon as they incur brokerage or statutory fees."
      />
    );
  }

  const openTrade = (id: string) => navigate(`/trades?highlight=${id}`);
  const onRowKeyDown = (e: KeyboardEvent<HTMLTableRowElement>, id: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openTrade(id);
    }
  };

  return (
    <>
      <TableShell>
        <thead>
          <tr>
            <TH>Date</TH>
            <TH>Symbol</TH>
            <TH className="tnum text-right">Gross P&L</TH>
            {CHARGE_COMPONENTS.map((c) => (
              <TH key={c.key} className="tnum text-right">
                <span
                  aria-hidden
                  className="mr-1.5 inline-block h-2.5 w-[3px] rounded-full align-[-1px]"
                  style={{ background: c.color }}
                />
                {c.short}
              </TH>
            ))}
            <TH className="tnum text-right">Total</TH>
          </tr>
        </thead>
        <tbody>
          {visible.map((t) => (
            <tr
              key={t.id}
              className={`${rowClass} focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent`}
              tabIndex={0}
              onClick={() => openTrade(t.id)}
              onKeyDown={(e) => onRowKeyDown(e, t.id)}
              aria-label={`Open ${t.symbol} trade details`}
            >
              <TD className="text-muted">{formatDate(t.closedAt ?? t.openedAt)}</TD>
              <TD>
                <span className="font-medium text-ink">{t.symbol}</span>
                <span className="ml-1.5 text-[11px] text-faint">{t.assetClass}</span>
              </TD>
              <TD className="tnum text-right">
                {t.status === "Closed" ? (
                  <span className={pnlClass(t.grossPnl)}>{formatMoney(t.grossPnl, { sign: true })}</span>
                ) : (
                  <span className="text-faint" title={`${t.status} trade — no realised P&L yet`}>
                    —
                  </span>
                )}
              </TD>
              {CHARGE_COMPONENTS.map((c) => (
                <TD key={c.key} className="tnum text-right text-muted">
                  {t.charges[c.key] > 0 ? (
                    formatMoney(t.charges[c.key], { decimals: true })
                  ) : (
                    <span className="text-faint">—</span>
                  )}
                </TD>
              ))}
              <TD className="tnum text-right font-semibold text-warning">
                {formatMoney(t.charges.total, { decimals: true })}
              </TD>
            </tr>
          ))}
        </tbody>
      </TableShell>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12px] text-muted">
          Showing{" "}
          <span className="tnum">
            {start + 1}–{Math.min(start + PAGE_SIZE, sorted.length)}
          </span>{" "}
          of <span className="tnum">{sorted.length}</span> trades, costliest first
        </p>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            icon={ChevronLeft}
            aria-label="Previous page"
            disabled={safePage === 0}
            onClick={() => setPage(safePage - 1)}
          />
          <span className="tnum min-w-12 text-center text-[12px] text-muted">
            {safePage + 1} / {pageCount}
          </span>
          <Button
            size="sm"
            variant="ghost"
            icon={ChevronRight}
            aria-label="Next page"
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage(safePage + 1)}
          />
        </div>
      </div>
    </>
  );
}
