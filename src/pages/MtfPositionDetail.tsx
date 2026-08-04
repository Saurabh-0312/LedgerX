/** MTF Position Detail (route /mtf/:id) — spec §7.4, §7.5, §8.
 *  Everything is derived from the frozen calc core (computePosition); this page
 *  never re-derives interest math. Closed positions read their final* snapshot. */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Pencil,
  RotateCcw,
  Save,
  SearchX,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatDate, formatMoney, formatNumber, formatPct, pnlClass, pnlMarkColor } from "@/lib/format";
import { annualizedPct, computePosition } from "@/lib/mtf/calc";
import { MTF_COLORS } from "@/lib/mtf/palette";
import { toast } from "@/store/toast";
import { useAsOfToday, useMtfStore } from "@/store/useMtfStore";
import { ClosePositionModal } from "./mtf/ClosePositionModal";
import { ForecastCalculator } from "./mtf/ForecastCalculator";
import { HealthBadge } from "./mtf/HealthBadge";
import { PositionFormModal } from "./mtf/PositionFormModal";
import { ProfitConsumptionBar } from "./mtf/ProfitConsumptionBar";
import { BreakEvenGrowthChart } from "./mtf/charts/BreakEvenGrowthChart";
import { FutureBreakEvenChart } from "./mtf/charts/FutureBreakEvenChart";
import { CumulativeInterestChart } from "./mtf/charts/CumulativeInterestChart";
import { DailyInterestGrowthChart } from "./mtf/charts/DailyInterestGrowthChart";
import { InterestVsHoldingDaysChart } from "./mtf/charts/InterestVsHoldingDaysChart";
import { InterestVsProfitChart } from "./mtf/charts/InterestVsProfitChart";
import { ProjectedInterestChart } from "./mtf/charts/ProjectedInterestChart";

/** Label/value row used inside the summary cards. */
function Row({
  label,
  value,
  valueClass = "text-ink",
  strong = false,
}: {
  label: string;
  value: ReactNode;
  valueClass?: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-[12px] text-muted">{label}</span>
      <span className={`tnum text-right text-[13px] ${strong ? "font-semibold" : "font-medium"} ${valueClass}`}>
        {value}
      </span>
    </div>
  );
}

/** Money value with the break-even yellow dot beside it (text stays tokenized). */
function BreakEvenValue({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: MTF_COLORS.breakEven }} aria-hidden />
      {children}
    </span>
  );
}

export default function MtfPositionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const positions = useMtfStore((s) => s.positions);
  const brokers = useMtfStore((s) => s.brokers);
  const duplicatePosition = useMtfStore((s) => s.duplicatePosition);
  const deletePosition = useMtfStore((s) => s.deletePosition);
  const reopenPosition = useMtfStore((s) => s.reopenPosition);
  const updatePosition = useMtfStore((s) => s.updatePosition);
  const asOf = useAsOfToday();

  const position = positions.find((p) => p.id === id);
  const cp = useMemo(
    () => (position ? computePosition(position, brokers, asOf) : null),
    [position, brokers, asOf],
  );

  const [editOpen, setEditOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [notesDraft, setNotesDraft] = useState(position?.notes ?? "");

  // Keep the local draft in sync when notes change elsewhere (e.g. edit modal).
  useEffect(() => {
    setNotesDraft(position?.notes ?? "");
  }, [position?.id, position?.notes]);

  if (!position || !cp) {
    return (
      <>
        <PageHeader title="MTF Position" description="Margin position detail" />
        <Card>
          <EmptyState
            icon={SearchX}
            title="Position not found"
            hint="It may have been deleted, or the link is out of date."
            action={
              <Button variant="outline" icon={ArrowLeft} onClick={() => navigate("/mtf")}>
                Back to MTF Tracker
              </Button>
            }
          />
        </Card>
      </>
    );
  }

  const isOpen = !cp.isClosed;
  const notesDirty = notesDraft !== (position.notes ?? "");

  const handleDuplicate = () => {
    duplicatePosition(position.id);
    toast("Position duplicated");
  };

  const handleDelete = () => {
    setConfirmDelete(false);
    deletePosition(position.id);
    toast("Position deleted");
    navigate("/mtf");
  };

  const handleReopen = () => {
    reopenPosition(position.id);
    toast("Position reopened");
  };

  const saveNotes = () => {
    updatePosition(position.id, { notes: notesDraft });
    toast("Notes saved");
  };

  // Charges card: itemized rows only when no manual override and components exist.
  const c = position.charges;
  const chargeRows: Array<[string, number]> = [];
  if (c.manualTotal == null) {
    const items: Array<[string, number | undefined]> = [
      ["Brokerage", c.brokerage],
      ["STT", c.stt],
      ["Exchange charges", c.exchangeTxn],
      ["GST", c.gst],
      ["SEBI charges", c.sebi],
      ["Stamp duty", c.stampDuty],
      ["DP charges", c.dp],
      ["Other", c.other],
    ];
    for (const [label, v] of items) if (v != null && v !== 0) chargeRows.push([label, v]);
  }

  const holdingLine =
    cp.holdingDays === 0
      ? "bought today"
      : `over ${cp.holdingDays} day${cp.holdingDays === 1 ? "" : "s"}`;

  // Purchases card footer: Σ per-lot accrual (excludes any manual adjustment).
  const lotsInterestTotal = cp.lots.reduce((s, l) => s + l.accumulatedInterest, 0);

  return (
    <div className="animate-in space-y-4">
      {/* 1 — Header block */}
      <div>
        <Button variant="ghost" size="sm" icon={ArrowLeft} className="-ml-2" onClick={() => navigate("/mtf")}>
          MTF Tracker
        </Button>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[20px] font-semibold tracking-tight text-ink">{position.stockName}</h1>
              <span className="font-mono text-[13px] text-muted">{position.symbol}</span>
              <Badge tone={isOpen ? "info" : "neutral"}>{position.status}</Badge>
              <HealthBadge cp={cp} />
            </div>
            <p className={`mt-2 text-[28px] font-semibold leading-none ${pnlClass(cp.netProfit)}`}>
              {formatMoney(cp.netProfit, { sign: true, decimals: true })}
            </p>
            <p className="mt-1.5 text-[13px] text-muted">
              <span className={pnlClass(cp.grossProfit)}>
                Gross {formatMoney(cp.grossProfit, { sign: true, decimals: true })}
              </span>
              <span className="mx-1.5 text-faint">·</span>
              <span className="text-warning">
                Interest {formatMoney(-cp.accumulatedInterest, { sign: true, decimals: true })}
              </span>
              <span className="mx-1.5 text-faint">·</span>
              Charges {formatMoney(-cp.totalCharges, { sign: true, decimals: true })}
              <span className="mx-1.5 text-faint">·</span>
              {holdingLine}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" icon={Pencil} onClick={() => setEditOpen(true)}>
              Edit
            </Button>
            <Button variant="outline" size="sm" icon={Copy} onClick={handleDuplicate}>
              Duplicate
            </Button>
            {isOpen && (
              <Button variant="primary" size="sm" icon={CheckCircle2} onClick={() => setCloseOpen(true)}>
                Close Position
              </Button>
            )}
            <Button variant="danger" size="sm" icon={Trash2} onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          </div>
        </div>
      </div>

      {/* 2 — Summary cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card title="Investment">
          <Row label="Quantity" value={formatNumber(position.quantity)} />
          <Row label="Avg buy price" value={formatMoney(position.avgBuyPrice, { decimals: true })} />
          <Row label="Investment" value={formatMoney(cp.totalInvestment)} />
          <Row
            label={cp.isClosed ? "Exit price" : "Current price"}
            value={
              cp.isClosed
                ? position.exitPrice != null
                  ? formatMoney(position.exitPrice, { decimals: true })
                  : "—"
                : position.currentPrice != null
                  ? formatMoney(position.currentPrice, { decimals: true })
                  : "—"
            }
          />
          <Row label="Current value" value={formatMoney(cp.currentValue)} />
        </Card>

        <Card title="Holding">
          <Row
            label={cp.isMultiLot ? "First purchase" : "Purchase date"}
            value={formatDate(position.purchaseDate)}
          />
          <Row label="Holding days" value={`${cp.holdingDays} days`} valueClass="text-info" />
          {cp.holdingDays === 0 && (
            <p className="-mt-0.5 pb-1 text-right text-[11px] text-faint">
              Bought today — interest still counts day 1.
            </p>
          )}
          <Row
            label="Daily interest"
            value={formatMoney(cp.dailyInterest, { decimals: true })}
            valueClass="text-warning"
          />
          <Row label="Interest days" value={`${cp.interestDays}`} />
          <Row
            label="Accumulated interest"
            value={formatMoney(cp.accumulatedInterest, { decimals: true })}
            valueClass="text-warning"
          />
          <Row
            label="Rate"
            value={`${formatPct(position.dailyRatePct, 3)}/day · ≈ ${formatPct(annualizedPct(position.dailyRatePct), 2)} p.a.`}
          />
        </Card>

        <Card title="Break-even">
          <Row
            label="Break-even price"
            value={<BreakEvenValue>{formatMoney(cp.breakEvenPrice, { decimals: true })}</BreakEvenValue>}
          />
          <Row label="Break-even %" value={formatPct(cp.breakEvenPct, 2, true)} />
          <Row
            label="Extra price needed"
            value={formatMoney(cp.extraPriceNeeded, { decimals: true })}
          />
          <Row
            label="Extra profit needed"
            value={formatMoney(cp.extraProfitNeeded, { decimals: true })}
          />
          <p className="mt-2 text-[11px] text-faint">
            Assumes round-trip charges ≈ {formatMoney(cp.totalCharges, { decimals: true })}.
          </p>
        </Card>

        <Card title="Charges">
          {chargeRows.length > 0 ? (
            <>
              {chargeRows.map(([label, v]) => (
                <Row key={label} label={label} value={formatMoney(v, { decimals: true })} />
              ))}
              <div className="mt-1 border-t border-edge-soft pt-1">
                <Row label="Total charges" value={formatMoney(cp.totalCharges, { decimals: true })} strong />
              </div>
            </>
          ) : (
            <Row
              label={c.manualTotal != null ? "Total charges (manual)" : "Total charges"}
              value={formatMoney(cp.totalCharges, { decimals: true })}
              strong
            />
          )}
        </Card>
      </div>

      {/* 3 — Purchases (buy tranches — each lot accrues from its own date) */}
      <Card
        title="Purchases"
        subtitle={cp.isMultiLot ? "Each tranche accrues interest from its own purchase date" : undefined}
      >
        <div className="overflow-x-auto">
          <div className="min-w-[560px]">
            {cp.lots.map((lot) => (
              <div
                key={lot.id}
                className="grid grid-cols-[1.1fr_1.3fr_1fr_1.1fr_1.2fr] items-baseline gap-3 border-b border-edge-soft py-1.5"
              >
                <span className="text-[13px] font-medium text-ink">{formatDate(lot.date)}</span>
                <span className="tnum text-right text-[13px] text-ink">
                  {formatNumber(lot.quantity)} @ {formatMoney(lot.price, { decimals: true })}
                </span>
                <span className="tnum text-right text-[13px] font-medium text-ink">
                  {formatMoney(lot.invested)}
                </span>
                <span className="tnum text-right text-[12px] text-info">
                  {lot.interestDays} interest day{lot.interestDays === 1 ? "" : "s"}
                </span>
                <span className="tnum text-right text-[13px] font-medium text-warning">
                  {formatMoney(lot.accumulatedInterest, { decimals: true })}
                </span>
              </div>
            ))}
            <div className="grid grid-cols-[1.1fr_1.3fr_1fr_1.1fr_1.2fr] items-baseline gap-3 pt-1.5">
              <span className="text-[12px] font-medium text-muted">Total</span>
              <span className="tnum text-right text-[13px] text-muted">
                {formatNumber(position.quantity)} shares
              </span>
              <span className="tnum text-right text-[13px] font-semibold text-ink">
                {formatMoney(cp.totalInvestment)}
              </span>
              <span aria-hidden />
              <span className="tnum text-right text-[13px] font-semibold text-warning">
                {formatMoney(lotsInterestTotal, { decimals: true })}
              </span>
            </div>
          </div>
        </div>
        {position.manualInterestAdj != null && position.manualInterestAdj !== 0 && (
          <p className="mt-2 text-[11px] text-faint">
            Excludes the manual interest adjustment of{" "}
            {formatMoney(position.manualInterestAdj, { sign: true, decimals: true })}.
          </p>
        )}
      </Card>

      {/* 4 — Profit consumption meter */}
      <ProfitConsumptionBar cp={cp} />

      {/* 5 — Timeline strip */}
      <Card>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: MTF_COLORS.holding }}
              aria-hidden
            />
            <div>
              <p className="text-[13px] font-medium text-ink">{formatDate(position.purchaseDate)}</p>
              <p className="text-[11px] text-faint">Purchased</p>
            </div>
          </div>
          <div className="h-px min-w-[40px] flex-1 bg-edge" aria-hidden />
          <div className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: cp.isClosed ? pnlMarkColor(0) : MTF_COLORS.interest }}
              aria-hidden
            />
            <div>
              <p className="text-[13px] font-medium text-ink">
                {cp.isClosed && position.exitDate
                  ? formatDate(position.exitDate)
                  : formatDate(asOf.toISOString())}
              </p>
              <p className="text-[11px] text-faint">{cp.isClosed ? "Closed" : "Today"}</p>
            </div>
          </div>
        </div>
        <p className="mt-3 text-[12px] text-muted">
          <span className="font-medium text-info">{cp.holdingDays} days on margin</span> · interest accrues
          from day 1 (purchase day inclusive) — {cp.interestDays} interest day
          {cp.interestDays === 1 ? "" : "s"} charged so far.
        </p>
      </Card>

      {/* 6 — Per-position charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <DailyInterestGrowthChart cp={cp} />
        <CumulativeInterestChart cp={cp} />
        <InterestVsProfitChart cp={cp} />
        <InterestVsHoldingDaysChart cp={cp} />
        <BreakEvenGrowthChart cp={cp} />
        <FutureBreakEvenChart cp={cp} />
        <ProjectedInterestChart cp={cp} />
      </div>

      {/* 7 — Forecast (open positions only — "if I hold longer") */}
      {isOpen && <ForecastCalculator cp={cp} />}

      {/* 8 — Notes */}
      <Card
        title="Notes"
        subtitle={!position.notes ? "No notes yet" : undefined}
        action={
          <Button variant="outline" size="sm" icon={Save} onClick={saveNotes} disabled={!notesDirty}>
            Save
          </Button>
        }
      >
        <Textarea
          value={notesDraft}
          onChange={(e) => setNotesDraft(e.target.value)}
          placeholder="Why did you take this position? Exit plan, targets, stop…"
          aria-label="Position notes"
          rows={4}
        />
      </Card>

      {/* 9 — Close snapshot (closed positions) */}
      {cp.isClosed && (
        <Card
          title="Close snapshot"
          subtitle="Values frozen when the position was closed"
          action={
            <Button variant="outline" size="sm" icon={RotateCcw} onClick={handleReopen}>
              Reopen
            </Button>
          }
        >
          <div className="grid gap-x-8 sm:grid-cols-2">
            <Row label="Exit date" value={position.exitDate ? formatDate(position.exitDate) : "—"} />
            <Row
              label="Exit price"
              value={position.exitPrice != null ? formatMoney(position.exitPrice, { decimals: true }) : "—"}
            />
            <Row
              label="Final holding days"
              value={`${position.finalHoldingDays ?? cp.holdingDays} days`}
              valueClass="text-info"
            />
            <Row
              label="Final interest"
              value={formatMoney(position.finalInterest ?? cp.accumulatedInterest, { decimals: true })}
              valueClass="text-warning"
            />
            <Row
              label="Final charges"
              value={formatMoney(position.finalCharges ?? cp.totalCharges, { decimals: true })}
            />
            <Row
              label="Final gross profit"
              value={formatMoney(position.finalGrossProfit ?? cp.grossProfit, { sign: true, decimals: true })}
              valueClass={pnlClass(position.finalGrossProfit ?? cp.grossProfit)}
            />
            <Row
              label="Final net profit"
              value={formatMoney(position.finalNetProfit ?? cp.netProfit, { sign: true, decimals: true })}
              valueClass={pnlClass(position.finalNetProfit ?? cp.netProfit)}
              strong
            />
            <Row
              label="Final break-even"
              value={
                <BreakEvenValue>
                  {formatMoney(position.finalBreakEvenPrice ?? cp.breakEvenPrice, { decimals: true })}
                </BreakEvenValue>
              }
            />
          </div>
        </Card>
      )}

      {/* Modals */}
      <PositionFormModal open={editOpen} initial={position} onClose={() => setEditOpen(false)} />
      <ClosePositionModal open={closeOpen} position={position} onClose={() => setCloseOpen(false)} />
      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete position">
        <p className="text-[13px] text-muted">
          Delete <span className="font-medium text-ink">{position.stockName}</span> ({position.symbol})?
          This removes the position and its history permanently.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
            Cancel
          </Button>
          <Button variant="danger" icon={Trash2} onClick={handleDelete}>
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
