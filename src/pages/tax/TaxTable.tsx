/** Per-trade tax table — paginated, sorted by estimated tax, row click opens the trade drawer. */

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Receipt } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { TableShell, TH, TD, rowClass } from "@/components/ui/Table";
import type { Currency } from "@/lib/format";
import { formatDate, formatMoney, formatNumber, pnlClass } from "@/lib/format";
import type { ClosedTrade } from "./taxMeta";
import { CATEGORY_META, ratePctLabel } from "./taxMeta";

const PAGE_SIZE = 12;

interface TaxTableProps {
  trades: ClosedTrade[];
  currency: Currency;
  fy: string;
}

export function TaxTable({ trades, currency, fy }: TaxTableProps) {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);

  const sorted = useMemo(
    () =>
      [...trades].sort(
        (a, b) => b.tax.estimatedTax - a.tax.estimatedTax || b.closedAt.localeCompare(a.closedAt),
      ),
    [trades],
  );

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const start = safePage * PAGE_SIZE;
  const pageRows = sorted.slice(start, start + PAGE_SIZE);

  const openTrade = (id: string) => navigate(`/trades?highlight=${id}`);

  return (
    <Card
      title="Per-trade tax detail"
      subtitle={`Gross per-trade tax before exemptions & §87A — your actual liability is the total above · ${formatNumber(sorted.length)} trade${sorted.length === 1 ? "" : "s"} in ${fy}`}
    >
      {sorted.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No closed trades in this financial year"
          hint="Pick another FY, or close a trade to see its estimated tax here."
        />
      ) : (
        <>
          <TableShell>
            <thead>
              <tr>
                <TH>Closed</TH>
                <TH>Symbol</TH>
                <TH>Category</TH>
                <TH className="tnum text-right">Net P&L</TH>
                <TH className="tnum text-right">Taxable</TH>
                <TH className="tnum text-right">Rate</TH>
                <TH className="tnum text-right">Gross tax</TH>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((t) => (
                <tr
                  key={t.id}
                  className={`${rowClass} outline-none focus-visible:bg-raised/60`}
                  tabIndex={0}
                  aria-label={`Open trade ${t.id} ${t.symbol}`}
                  onClick={() => openTrade(t.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openTrade(t.id);
                    }
                  }}
                >
                  <TD className="text-muted">{formatDate(t.closedAt)}</TD>
                  <TD>
                    <div className="font-medium text-ink">{t.symbol}</div>
                    <div className="text-[11px] text-muted">{t.assetClass}</div>
                  </TD>
                  <TD>
                    <Badge tone={CATEGORY_META[t.tax.category].tone}>{t.tax.category}</Badge>
                  </TD>
                  <TD className={`tnum text-right ${pnlClass(t.netPnl)}`}>
                    {formatMoney(t.netPnl, { currency, sign: true })}
                  </TD>
                  <TD className="tnum text-right text-ink">
                    {formatMoney(t.tax.taxableAmount, { currency })}
                  </TD>
                  <TD className="tnum text-right text-muted">{ratePctLabel(t.tax.rate)}</TD>
                  <TD
                    className={`tnum text-right ${t.tax.estimatedTax > 0 ? "font-semibold text-warning" : "text-muted"}`}
                  >
                    {formatMoney(t.tax.estimatedTax, { currency })}
                  </TD>
                </tr>
              ))}
            </tbody>
          </TableShell>

          {pageCount > 1 && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[12px] text-muted">
                Showing {formatNumber(start + 1)}–{formatNumber(Math.min(start + PAGE_SIZE, sorted.length))} of{" "}
                {formatNumber(sorted.length)}
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="ghost"
                  icon={ChevronLeft}
                  aria-label="Previous page"
                  disabled={safePage === 0}
                  onClick={() => setPage(safePage - 1)}
                />
                <span className="tnum text-[12px] text-muted">
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
          )}
        </>
      )}
    </Card>
  );
}
