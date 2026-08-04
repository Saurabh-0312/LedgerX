/** Right-hand drawer with the full anatomy of a single trade:
 *  P&L header, fact grid, itemised charges, tax box, context notes, actions. */

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { CircleCheck, Pencil, Trash2, X } from "lucide-react";
import type { Rating, TaxCategory, Trade } from "@/types";
import { useStore } from "@/store/useStore";
import { toast } from "@/store/toast";
import { computeCharges, computeGrossPnl } from "@/lib/tradeMath";
import { useScreenshotUrl } from "@/lib/images";
import {
  formatDateTime,
  formatDuration,
  formatMoney,
  formatNumber,
  formatPct,
  formatR,
  pnlClass,
} from "@/lib/format";
import { Drawer, Modal } from "@/components/ui/Modal";
import { Badge, DirectionBadge, StatusBadge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";

const TAX_TONE: Record<TaxCategory, BadgeTone> = {
  Intraday: "info",
  STCG: "accent",
  LTCG: "profit",
  Crypto: "warning",
};

function Fact({ label, value, valueClass = "" }: { label: string; value: ReactNode; valueClass?: string }) {
  return (
    <div className="min-w-0">
      <dt className="label-caps">{label}</dt>
      <dd className={`mt-0.5 truncate text-[13px] text-ink ${valueClass}`}>{value}</dd>
    </div>
  );
}

function RatingDots({ value, label }: { value: Rating; label: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${label} rating: ${value} of 5`}>
      {([1, 2, 3, 4, 5] as const).map((n) => (
        <span key={n} aria-hidden className={n <= value ? "text-accent" : "text-faint"}>
          {n <= value ? "●" : "○"}
        </span>
      ))}
    </span>
  );
}

function NoteBlock({ label, text, borderClass }: { label: string; text: string; borderClass: string }) {
  return (
    <div className={`border-l-2 pl-3 ${borderClass}`}>
      <p className="label-caps">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-ink/90">{text}</p>
    </div>
  );
}

interface TradeDetailDrawerProps {
  trade: Trade | null;
  onClose: () => void;
}

export function TradeDetailDrawer({ trade, onClose }: TradeDetailDrawerProps) {
  const navigate = useNavigate();
  const accounts = useStore((s) => s.accounts);
  const chargeRates = useStore((s) => s.settings.chargeRates);
  const closeTradeAction = useStore((s) => s.closeTrade);
  const deleteTradeAction = useStore((s) => s.deleteTrade);
  const shot = useScreenshotUrl(trade?.screenshotUrl);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxOpen]);

  const [closeOpen, setCloseOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [exitPriceInput, setExitPriceInput] = useState("");
  const [closedAtInput, setClosedAtInput] = useState("");
  const [chargesInput, setChargesInput] = useState("");
  const [mtfInput, setMtfInput] = useState("");

  if (!trade) return null;

  const closed = trade.status === "Closed";
  const account = accounts.find((a) => a.id === trade.accountId);
  const c = trade.charges;
  const isCrypto = trade.assetClass === "Crypto";

  const chargeRows: [string, number][] = [
    ["Brokerage", c.brokerage],
    [isCrypto ? "Exchange fee" : "Exchange txn", c.exchangeTxn],
    [isCrypto ? "TDS (1%)" : "STT / CTT", c.stt],
    ["SEBI fees", c.sebi],
    ["Stamp duty", c.stampDuty],
    ["GST", c.gst],
    ["DP charges", c.dpCharges],
    ...((c.pledgeCharges ?? 0) > 0 ? ([["MTF pledge", c.pledgeCharges]] as [string, number][]) : []),
    ...((c.mtfInterest ?? 0) > 0 ? ([["MTF interest", c.mtfInterest]] as [string, number][]) : []),
  ];

  const openCloseModal = () => {
    setExitPriceInput(String(trade.entryPrice));
    setClosedAtInput(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
    setChargesInput(trade.manualCharges && trade.charges.manual > 0 ? String(trade.charges.manual) : "");
    setMtfInput(
      trade.manualCharges && (trade.charges.mtfInterest ?? 0) > 0 ? String(trade.charges.mtfInterest) : "",
    );
    setCloseOpen(true);
  };

  const previewPrice = Number(exitPriceInput);
  const validPrice = Number.isFinite(previewPrice) && previewPrice > 0;
  const previewGross = validPrice
    ? computeGrossPnl(trade.direction, trade.entryPrice, previewPrice, trade.quantity)
    : undefined;
  // Preview charges EXACTLY as the store will save them: manual path (manual
  // trade, or a Charges figure typed) = charge + MTF interest; auto path =
  // recompute the full itemized charges from the rate card + fold in MTF interest.
  const chargeStr = chargesInput.trim();
  const previewMtf = trade.segment === "MTF" ? Number(mtfInput || 0) || 0 : 0;
  let previewCharge: number | undefined;
  if (trade.manualCharges || chargeStr !== "") {
    previewCharge = (Number(chargeStr || 0) || 0) + previewMtf;
  } else if (validPrice) {
    previewCharge = computeCharges({
      assetClass: trade.assetClass,
      segment: trade.segment,
      exchange: trade.exchange,
      quantity: trade.quantity,
      entryPrice: trade.entryPrice,
      exitPrice: previewPrice,
      direction: trade.direction,
      rates: chargeRates,
      mtfInterest: previewMtf,
    }).total;
  }
  const previewNet =
    previewGross !== undefined && previewCharge !== undefined && Number.isFinite(previewCharge)
      ? Math.round((previewGross - previewCharge) * 100) / 100
      : undefined;

  const submitClose = () => {
    const price = Number(exitPriceInput);
    if (!Number.isFinite(price) || price <= 0) {
      toast("Enter a valid exit price", "error");
      return;
    }
    const when = new Date(closedAtInput);
    if (Number.isNaN(when.getTime())) {
      toast("Enter a valid close date & time", "error");
      return;
    }
    if (when.getTime() < new Date(trade.openedAt).getTime()) {
      toast("Close time can't be before the trade was opened", "error");
      return;
    }
    const chargeStr = chargesInput.trim();
    const mtfStr = mtfInput.trim();
    const isMtf = trade.segment === "MTF";
    // MTF interest is manual; it folds into auto charges (auto trade) or the manual lump
    let manualMtf: number | undefined;
    if (isMtf && (mtfStr !== "" || trade.manualCharges)) {
      const mt = Number(mtfStr === "" ? 0 : mtfStr);
      if (!Number.isFinite(mt) || mt < 0) {
        toast("Enter valid MTF interest", "error");
        return;
      }
      manualMtf = mt;
    }
    // charges take the manual path only for a manual trade, or if a figure was typed;
    // an auto trade with just MTF interest keeps auto-computed charges
    let manualCharge: number | undefined;
    if (trade.manualCharges || chargeStr !== "") {
      const ct = Number(chargeStr === "" ? 0 : chargeStr);
      if (!Number.isFinite(ct) || ct < 0) {
        toast("Enter valid charges", "error");
        return;
      }
      manualCharge = ct;
    }
    closeTradeAction(trade.id, price, when.toISOString(), manualCharge, manualMtf);
    setCloseOpen(false);
    toast(`${trade.symbol} closed at ${formatMoney(price, { decimals: true })}`);
  };

  const submitDelete = () => {
    deleteTradeAction(trade.id);
    setDeleteOpen(false);
    toast(`${trade.symbol} (${trade.id}) deleted`);
    onClose();
  };

  return (
    <Drawer open onClose={onClose} title={`Trade ${trade.id}`} widthClass="w-full max-w-[560px]">
      {/* ── header: symbol + badges + big net P&L ─────────────────── */}
      <div className="mb-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[18px] font-semibold tracking-tight text-ink">{trade.symbol}</span>
          <Badge tone="neutral">{trade.assetClass}</Badge>
          {trade.segment && trade.segment !== "Other" && (
            <Badge tone={trade.segment === "MTF" ? "warning" : trade.segment === "Intraday" ? "info" : "neutral"}>
              {trade.segment}
            </Badge>
          )}
          {trade.assetClass === "Equity" && trade.exchange && (
            <Badge tone="neutral">{trade.exchange}</Badge>
          )}
          <DirectionBadge direction={trade.direction} />
          <StatusBadge status={trade.status} />
        </div>
        {closed ? (
          <>
            <p className={`mt-2.5 text-[30px] font-semibold leading-none tracking-tight ${pnlClass(trade.netPnl)}`}>
              {formatMoney(trade.netPnl, { sign: true })}
            </p>
            <p className="mt-2 text-[12px] text-muted">
              Gross <span className={`tnum ${pnlClass(trade.grossPnl)}`}>{formatMoney(trade.grossPnl, { sign: true })}</span>
              {" · "}Charges <span className="tnum text-warning">−{formatMoney(c.total)}</span>
              {" · "}net of all costs
            </p>
          </>
        ) : (
          <p className="mt-2.5 text-[13px] text-muted">
            {trade.status === "Open" ? "Position is still open — P&L is unrealised." : "Trade was cancelled — no P&L booked."}
          </p>
        )}
      </div>

      {/* ── fact grid ─────────────────────────────────────────────── */}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3.5 rounded-xl border border-edge bg-raised/40 p-4 sm:grid-cols-3">
        <Fact label="Account" value={account?.name ?? trade.accountId} />
        <Fact label="Opened" value={formatDateTime(trade.openedAt)} />
        <Fact label="Closed" value={trade.closedAt ? formatDateTime(trade.closedAt) : "—"} />
        <Fact label="Duration" value={formatDuration(trade.holdingMinutes)} />
        <Fact label="Quantity" value={<span className="tnum">{formatNumber(trade.quantity, trade.quantity % 1 !== 0 ? 4 : 0)}</span>} />
        <Fact
          label="Entry → Exit"
          value={
            <span className="tnum">
              {formatMoney(trade.entryPrice, { decimals: true })} →{" "}
              {trade.exitPrice !== undefined ? formatMoney(trade.exitPrice, { decimals: true }) : "—"}
            </span>
          }
        />
        <Fact
          label="Stop loss"
          value={<span className="tnum">{trade.stopLoss !== undefined ? formatMoney(trade.stopLoss, { decimals: true }) : "—"}</span>}
        />
        <Fact
          label="Target"
          value={<span className="tnum">{trade.target !== undefined ? formatMoney(trade.target, { decimals: true }) : "—"}</span>}
        />
        <Fact label="Position value" value={<span className="tnum">{formatMoney(trade.positionValue)}</span>} />
        <Fact label="% of capital" value={<span className="tnum">{formatPct(trade.pctOfCapital)}</span>} />
        <Fact label="Risk" value={<span className="tnum">{formatMoney(trade.riskAmount)}</span>} />
        <Fact
          label="R multiple"
          value={<span className="tnum">{formatR(trade.rMultiple)}</span>}
          valueClass={trade.rMultiple !== undefined ? pnlClass(trade.rMultiple) : ""}
        />
        <Fact label="Strategy" value={trade.strategy} />
        <Fact label="Market" value={trade.marketCondition} />
        <Fact label="Timeframe" value={trade.timeframe} />
        <Fact label="Emotion" value={<RatingDots value={trade.emotionRating} label="Emotion" />} />
        <Fact label="Confidence" value={<RatingDots value={trade.confidenceRating} label="Confidence" />} />
      </dl>

      {/* ── charges ───────────────────────────────────────────────── */}
      <section className="mt-5" aria-label="Charges">
        <h3 className="label-caps mb-2">Charges</h3>
        {trade.manualCharges ? (
          <div className="overflow-hidden rounded-xl border border-edge">
            <table className="w-full text-[12.5px]">
              <tbody>
                <tr className="border-b border-edge-soft">
                  <td className="px-3.5 py-2 text-muted">
                    Charges
                    <span className="ml-1.5 text-[11px] text-faint">brokerage + statutory</span>
                  </td>
                  <td className="tnum px-3.5 py-2 text-right text-ink">
                    {formatMoney(c.manual, { decimals: true })}
                  </td>
                </tr>
                <tr className="border-b border-edge-soft">
                  <td className="px-3.5 py-2 text-muted">
                    MTF interest
                    <span className="ml-1.5 text-[11px] text-faint">margin interest</span>
                  </td>
                  <td
                    className={`tnum px-3.5 py-2 text-right ${(c.mtfInterest ?? 0) > 0 ? "text-warning" : "text-ink"}`}
                  >
                    {formatMoney(c.mtfInterest ?? 0, { decimals: true })}
                  </td>
                </tr>
                <tr className="bg-warning-soft/60">
                  <td className="px-3.5 py-2 font-semibold text-warning">
                    Total charges
                    <span className="ml-1.5 text-[11px] font-normal text-warning/70">entered manually</span>
                  </td>
                  <td className="tnum px-3.5 py-2 text-right font-semibold text-warning">
                    {formatMoney(c.total, { decimals: true })}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-edge">
            <table className="w-full text-[12.5px]">
              <tbody>
                {chargeRows.map(([label, value]) => (
                  <tr key={label} className="border-b border-edge-soft last:border-b-0">
                    <td className="px-3.5 py-2 text-muted">{label}</td>
                    <td className="tnum px-3.5 py-2 text-right text-ink">{formatMoney(value, { decimals: true })}</td>
                  </tr>
                ))}
                <tr className="bg-warning-soft/60">
                  <td className="px-3.5 py-2 font-semibold text-warning">Total charges</td>
                  <td className="tnum px-3.5 py-2 text-right font-semibold text-warning">
                    {formatMoney(c.total, { decimals: true })}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── tax box ───────────────────────────────────────────────── */}
      <section className="mt-5" aria-label="Tax estimate">
        <h3 className="label-caps mb-2">Tax estimate</h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-edge bg-raised/40 p-4 sm:grid-cols-4">
          <div>
            <p className="label-caps">Category</p>
            <p className="mt-1">
              <Badge tone={TAX_TONE[trade.tax.category]}>{trade.tax.category}</Badge>
            </p>
          </div>
          <div>
            <p className="label-caps">Taxable</p>
            <p className="tnum mt-1 text-[13px] text-ink">{formatMoney(trade.tax.taxableAmount)}</p>
          </div>
          <div>
            <p className="label-caps">Rate</p>
            <p className="tnum mt-1 text-[13px] text-ink">{formatPct(trade.tax.rate)}</p>
          </div>
          <div>
            <p className="label-caps">Est. tax</p>
            <p className="tnum mt-1 text-[13px] font-semibold text-warning">{formatMoney(trade.tax.estimatedTax)}</p>
          </div>
        </div>
        {closed && Math.round((trade.taxablePnl - trade.netPnl) * 100) / 100 > 0.005 && (
          <p className="mt-2 text-[11px] leading-relaxed text-faint">
            Taxable base is {formatMoney(trade.taxablePnl, { sign: true, decimals: true })} — higher than net
            because {trade.tax.category === "Crypto" ? "no costs are" : "STT/CTT, DP, MTF pledge & interest are not"}{" "}
            deductible for {trade.tax.category}.{" "}
            {formatMoney(Math.round((trade.taxablePnl - trade.netPnl) * 100) / 100, { decimals: true })} added back.
          </p>
        )}
      </section>

      {/* ── tags ──────────────────────────────────────────────────── */}
      {trade.tags.length > 0 && (
        <section className="mt-5" aria-label="Tags">
          <h3 className="label-caps mb-2">Tags</h3>
          <div className="flex flex-wrap gap-1.5">
            {trade.tags.map((tag) => (
              <Badge key={tag} tone="neutral">
                {tag}
              </Badge>
            ))}
          </div>
        </section>
      )}

      {/* ── notes / mistakes / lessons ────────────────────────────── */}
      {(trade.notes || trade.mistakes || trade.lessons) && (
        <section className="mt-5 space-y-4" aria-label="Journal notes">
          {trade.notes && <NoteBlock label="Notes" text={trade.notes} borderClass="border-edge" />}
          {trade.mistakes && <NoteBlock label="Mistakes" text={trade.mistakes} borderClass="border-loss/50" />}
          {trade.lessons && <NoteBlock label="Lessons" text={trade.lessons} borderClass="border-accent/60" />}
        </section>
      )}

      {/* ── screenshot ────────────────────────────────────────────── */}
      {trade.screenshotUrl && (
        <section className="mt-5" aria-label="Chart screenshot">
          <h3 className="label-caps mb-2">Screenshot</h3>
          {shot.loading ? (
            <div className="flex h-40 items-center justify-center rounded-xl border border-edge text-[12px] text-faint">
              Loading…
            </div>
          ) : shot.src ? (
            <button
              type="button"
              onClick={() => setLightboxOpen(true)}
              className="block w-full cursor-zoom-in overflow-hidden rounded-xl border border-edge transition hover:border-accent/50"
              aria-label="Enlarge screenshot"
            >
              <img src={shot.src} alt={`${trade.symbol} chart screenshot`} className="w-full" />
            </button>
          ) : (
            <div className="flex h-40 items-center justify-center rounded-xl border border-edge text-[12px] text-faint">
              Couldn’t load image
            </div>
          )}
        </section>
      )}

      {lightboxOpen &&
        shot.src &&
        createPortal(
          <div
            className="animate-in fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm"
            onClick={() => setLightboxOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label="Screenshot enlarged"
          >
            <img
              src={shot.src}
              alt={`${trade.symbol} chart screenshot, enlarged`}
              className="max-h-[88vh] max-w-[92vw] rounded-xl object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              type="button"
              onClick={() => setLightboxOpen(false)}
              aria-label="Close"
              className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-surface/80 text-muted ring-1 ring-edge transition hover:text-ink"
            >
              <X size={18} aria-hidden />
            </button>
          </div>,
          document.body,
        )}

      {/* ── actions ───────────────────────────────────────────────── */}
      <div className="sticky bottom-0 -mx-5 -mb-5 mt-6 flex items-center gap-2 border-t border-edge bg-surface/95 px-5 py-3 backdrop-blur">
        <Button variant="outline" size="sm" icon={Pencil} onClick={() => navigate(`/trades/${trade.id}/edit`)}>
          Edit
        </Button>
        {trade.status === "Open" && (
          <Button variant="primary" size="sm" icon={CircleCheck} onClick={openCloseModal}>
            Close trade
          </Button>
        )}
        <Button variant="danger" size="sm" icon={Trash2} className="ml-auto" onClick={() => setDeleteOpen(true)}>
          Delete
        </Button>
      </div>

      {/* ── close-trade modal ─────────────────────────────────────── */}
      <Modal open={closeOpen} onClose={() => setCloseOpen(false)} title={`Close ${trade.symbol}`} widthClass="max-w-sm">
        <div className="space-y-4">
          <Field label="Exit price" required hint={`Entry was ${formatMoney(trade.entryPrice, { decimals: true })} × ${formatNumber(trade.quantity, trade.quantity % 1 !== 0 ? 4 : 0)}`}>
            {(id) => (
              <Input
                id={id}
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                value={exitPriceInput}
                onChange={(e) => setExitPriceInput(e.target.value)}
                autoFocus
              />
            )}
          </Field>
          <Field label="Closed at" required>
            {(id) => (
              <Input
                id={id}
                type="datetime-local"
                value={closedAtInput}
                onChange={(e) => setClosedAtInput(e.target.value)}
              />
            )}
          </Field>
          <div className={`grid gap-4 ${trade.segment === "MTF" ? "sm:grid-cols-2" : ""}`}>
            <Field
              label={trade.manualCharges ? "Charges" : "Charges (optional)"}
              hint={
                trade.manualCharges
                  ? "Brokerage + statutory"
                  : `Blank → auto-computed (${trade.segment})`
              }
            >
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0"
                  placeholder="0.00"
                  value={chargesInput}
                  onChange={(e) => setChargesInput(e.target.value)}
                />
              )}
            </Field>
            {trade.segment === "MTF" && (
              <Field label="MTF interest" hint="From your Groww statement">
                {(id) => (
                  <Input
                    id={id}
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0"
                    placeholder="0.00"
                    value={mtfInput}
                    onChange={(e) => setMtfInput(e.target.value)}
                  />
                )}
              </Field>
            )}
          </div>
          {previewGross !== undefined && (
            <p className="text-[12px] text-muted">
              Gross P&L at this exit:{" "}
              <span className={`tnum font-medium ${pnlClass(previewGross)}`}>{formatMoney(previewGross, { sign: true })}</span>
              {previewNet !== undefined ? (
                <>
                  {" · "}Net after charges:{" "}
                  <span className={`tnum font-medium ${pnlClass(previewNet)}`}>{formatMoney(previewNet, { sign: true })}</span>
                </>
              ) : (
                <span className="text-faint"> (before charges &amp; tax)</span>
              )}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setCloseOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" icon={CircleCheck} onClick={submitClose}>
              Close trade
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── delete confirm modal ──────────────────────────────────── */}
      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete trade" widthClass="max-w-sm">
        <p className="text-[13px] leading-relaxed text-muted">
          This permanently removes <span className="font-medium text-ink">{trade.symbol}</span>{" "}
          <span className="text-faint">({trade.id})</span> from your journal. This can't be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" icon={Trash2} onClick={submitDelete}>
            Delete trade
          </Button>
        </div>
      </Modal>
    </Drawer>
  );
}
