/** MTF positions table (spec §7.3) — open & closed variants. Row click
 *  navigates to /mtf/:id (action buttons stop propagation). The table OWNS its
 *  delete-confirm Modal and only then calls onDelete(id). Desktop = full
 *  TableShell inside overflow-x-auto; mobile = stacked card list. All math
 *  comes precomputed on ComputedPosition — nothing is re-derived here. */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Archive, CircleCheck, Copy, Eye, PackageOpen, Pencil, Trash2 } from "lucide-react";
import type { ComputedPosition, MtfStatus } from "@/lib/mtf/types";
import { MTF_COLORS } from "@/lib/mtf/palette";
import {
  formatDate,
  formatMoney,
  formatNumber,
  formatPct,
  pnlClass,
} from "@/lib/format";
import { TableShell, TH, TD, rowClass } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { HealthBadge } from "./HealthBadge";

/** MtfStatus ≠ the journal's TradeStatus, so the shared StatusBadge does not
 *  apply — tiny local mapping instead (Open → info, Closed → neutral). */
function MtfStatusBadge({ status }: { status: MtfStatus }) {
  return <Badge tone={status === "Open" ? "info" : "neutral"}>{status}</Badge>;
}

/** Break-even figure with the module's yellow dot (palette hex, inline style). */
function BreakEvenCell({ price }: { price: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: MTF_COLORS.breakEven }}
      />
      {formatMoney(price, { decimals: true })}
    </span>
  );
}

export function PositionsTable({
  rows,
  variant,
  onEdit,
  onClosePosition,
  onDuplicate,
  onDelete,
}: {
  rows: ComputedPosition[];
  variant: "open" | "closed";
  onEdit: (id: string) => void;
  onClosePosition: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const navigate = useNavigate();
  const [pendingDelete, setPendingDelete] = useState<ComputedPosition | null>(null);
  const isOpen = variant === "open";

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={isOpen ? PackageOpen : Archive}
        title={isOpen ? "No open positions" : "No closed positions yet"}
        hint={
          isOpen
            ? "Add a margin position to start tracking daily interest and break-even."
            : "When you close a position its final interest snapshot lands here."
        }
      />
    );
  }

  const goToDetail = (id: string) => navigate(`/mtf/${id}`);

  return (
    <>
      {/* ── Desktop table ─────────────────────────────────────────────── */}
      <div className="hidden md:block">
        <TableShell className="overflow-x-auto">
          <thead>
            <tr>
              <TH>Stock</TH>
              <TH>Bought</TH>
              {!isOpen && <TH>Exit date</TH>}
              <TH className="tnum text-right">Days</TH>
              <TH className="tnum text-right">Qty</TH>
              <TH className="tnum text-right">Buy ₹</TH>
              <TH className="tnum text-right">{isOpen ? "Current ₹" : "Exit ₹"}</TH>
              <TH className="tnum text-right">Investment</TH>
              <TH className="tnum text-right">Value</TH>
              <TH className="tnum text-right">Gross P&L</TH>
              <TH className="tnum text-right">P&L %</TH>
              <TH className="tnum text-right">Daily Int.</TH>
              <TH className="tnum text-right">Total Int.</TH>
              <TH className="tnum text-right">Charges</TH>
              <TH className="tnum text-right">Net Profit</TH>
              <TH className="tnum text-right">Break-even</TH>
              <TH className="tnum text-right">BE %</TH>
              {isOpen && <TH className="tnum text-right">Extra ₹ needed</TH>}
              <TH className="tnum text-right">Rate</TH>
              <TH>Health</TH>
              <TH>Status</TH>
              <TH className="text-right">
                <span className="sr-only">Actions</span>
              </TH>
            </tr>
          </thead>
          <tbody>
            {rows.map((cp) => {
              const { pos } = cp;
              return (
                <tr
                  key={pos.id}
                  className={rowClass}
                  tabIndex={0}
                  onClick={() => goToDetail(pos.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") goToDetail(pos.id);
                  }}
                >
                  <TD>
                    <div className="leading-tight">
                      <p className="font-semibold text-ink">{pos.stockName}</p>
                      <p className="text-[11px] text-muted">{pos.symbol}</p>
                    </div>
                  </TD>
                  <TD className="text-muted">
                    {formatDate(pos.purchaseDate)}
                    {cp.isMultiLot && (
                      <div className="mt-0.5">
                        <Badge tone="neutral">×{cp.lots.length} lots</Badge>
                      </div>
                    )}
                  </TD>
                  {!isOpen && (
                    <TD className="text-muted">
                      {pos.exitDate ? formatDate(pos.exitDate) : "—"}
                    </TD>
                  )}
                  <TD className="tnum text-right">{cp.holdingDays}</TD>
                  <TD className="tnum text-right">{formatNumber(pos.quantity)}</TD>
                  <TD className="tnum text-right">
                    {formatMoney(pos.avgBuyPrice, { decimals: true })}
                  </TD>
                  <TD className="tnum text-right">
                    {isOpen
                      ? pos.currentPrice != null
                        ? formatMoney(pos.currentPrice, { decimals: true })
                        : "—"
                      : pos.exitPrice != null
                        ? formatMoney(pos.exitPrice, { decimals: true })
                        : "—"}
                  </TD>
                  <TD className="tnum text-right">
                    {formatMoney(cp.totalInvestment, { compact: true })}
                  </TD>
                  <TD className="tnum text-right">
                    {formatMoney(cp.currentValue, { compact: true })}
                  </TD>
                  <TD className={`tnum text-right ${pnlClass(cp.grossProfit)}`}>
                    {formatMoney(cp.grossProfit, { sign: true })}
                  </TD>
                  <TD className={`tnum text-right ${pnlClass(cp.grossProfit)}`}>
                    {formatPct(cp.profitPct, 1, true)}
                  </TD>
                  <TD className="tnum text-right text-warning">
                    {formatMoney(cp.dailyInterest, { decimals: true })}
                  </TD>
                  <TD className="tnum text-right text-warning">
                    {formatMoney(cp.accumulatedInterest, { decimals: true })}
                  </TD>
                  <TD className="tnum text-right text-muted">
                    {formatMoney(cp.totalCharges, { decimals: true })}
                  </TD>
                  <TD className={`tnum text-right font-semibold ${pnlClass(cp.netProfit)}`}>
                    {formatMoney(cp.netProfit, { sign: true })}
                  </TD>
                  <TD className="tnum text-right">
                    <BreakEvenCell price={cp.breakEvenPrice} />
                  </TD>
                  <TD className="tnum text-right text-muted">
                    {formatPct(cp.breakEvenPct, 1, true)}
                  </TD>
                  {isOpen && (
                    <TD
                      className={`tnum text-right ${cp.extraPriceNeeded > 0 ? "" : "text-muted"}`}
                    >
                      {cp.extraPriceNeeded > 0
                        ? formatMoney(cp.extraPriceNeeded, { decimals: true })
                        : "—"}
                    </TD>
                  )}
                  <TD className="tnum text-right text-muted">
                    {formatNumber(pos.dailyRatePct, 3)}%/d
                  </TD>
                  <TD>
                    <HealthBadge cp={cp} />
                  </TD>
                  <TD>
                    <MtfStatusBadge status={pos.status} />
                  </TD>
                  <TD className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Eye}
                        aria-label={`View ${pos.symbol} details`}
                        title="View details"
                        onClick={() => goToDetail(pos.id)}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Pencil}
                        aria-label={`Edit ${pos.symbol}`}
                        title="Edit"
                        onClick={() => onEdit(pos.id)}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Copy}
                        aria-label={`Duplicate ${pos.symbol}`}
                        title="Duplicate"
                        onClick={() => onDuplicate(pos.id)}
                      />
                      {isOpen && (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={CircleCheck}
                          aria-label={`Close ${pos.symbol} position`}
                          title="Close position"
                          onClick={() => onClosePosition(pos.id)}
                        />
                      )}
                      <Button
                        variant="danger"
                        size="sm"
                        icon={Trash2}
                        aria-label={`Delete ${pos.symbol}`}
                        title="Delete"
                        onClick={() => setPendingDelete(cp)}
                      />
                    </div>
                  </TD>
                </tr>
              );
            })}
          </tbody>
        </TableShell>
      </div>

      {/* ── Mobile stacked cards ──────────────────────────────────────── */}
      <div className="block space-y-2 md:hidden">
        {rows.map((cp) => (
          <button
            key={cp.pos.id}
            type="button"
            onClick={() => goToDetail(cp.pos.id)}
            className="card w-full p-3 text-left"
            aria-label={`Open ${cp.pos.symbol} details`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="leading-tight">
                <p className="text-[13px] font-semibold text-ink">{cp.pos.stockName}</p>
                <p className="text-[11px] text-muted">{cp.pos.symbol}</p>
              </div>
              <HealthBadge cp={cp} />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div>
                <p className="label-caps">Net profit</p>
                <p className={`tnum text-[13px] font-semibold ${pnlClass(cp.netProfit)}`}>
                  {formatMoney(cp.netProfit, { sign: true })}
                </p>
              </div>
              <div>
                <p className="label-caps">Daily int.</p>
                <p className="tnum text-[13px] font-medium text-warning">
                  {formatMoney(cp.dailyInterest, { decimals: true })}
                </p>
              </div>
              <div>
                <p className="label-caps">Break-even</p>
                <p className="tnum inline-flex items-center gap-1.5 text-[13px] font-medium text-ink">
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: MTF_COLORS.breakEven }}
                  />
                  {formatMoney(cp.breakEvenPrice, { decimals: true })}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* ── Delete confirmation (owned by the table) ──────────────────── */}
      <Modal
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="Delete position?"
      >
        {pendingDelete && (
          <div className="space-y-4">
            <p className="text-[13px] leading-relaxed text-muted">
              This permanently removes{" "}
              <span className="font-semibold text-ink">{pendingDelete.pos.symbol}</span>{" "}
              ({pendingDelete.pos.id}) and its interest history. This action cannot be
              undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setPendingDelete(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                icon={Trash2}
                onClick={() => {
                  onDelete(pendingDelete.pos.id);
                  setPendingDelete(null);
                }}
              >
                Delete position
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
