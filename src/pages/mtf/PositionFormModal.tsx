/** MTF Add / Edit Position modal (spec §7.2). SELF-CONTAINED: reads/writes
 *  useMtfStore itself, toasts, then closes. String-backed drafts; live summary
 *  strip computed via computePosition on a draft position (never re-derives math).
 *  Positions are entered as BUY LOTS (tranches) — each purchase accrues interest
 *  from its own date. Flat fields (purchaseDate/quantity/avgBuyPrice/totalInvestment)
 *  are derived from the lots and written in sync on save. */

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Plus, Trash2 } from "lucide-react";
import type {
  InterestBasis,
  MtfCharges,
  MtfLot,
  MtfPosition,
  MtfStatus,
} from "@/lib/mtf/types";
import { annualizedPct, buildCloseSnapshot, chargesTotal, computePosition, normalizeLots } from "@/lib/mtf/calc";
import { MTF_COLORS } from "@/lib/mtf/palette";
import { computeCharges } from "@/lib/tradeMath";
import { nextMtfId, useAsOfToday, useMtfStore } from "@/store/useMtfStore";
import { useStore } from "@/store/useStore";
import { toast } from "@/store/toast";
import { formatMoney, formatNumber, formatPct, pnlClass } from "@/lib/format";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";

/* ── local helpers ─────────────────────────────────────────────────────── */

const num = (s: string): number => {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
};
const r2 = (n: number) => Math.round(n * 100) / 100;
const todayISO = () => format(new Date(), "yyyy-MM-dd");

type ChargesMethod = "itemized" | "total" | "auto";

/** One editable buy-tranche row (string-backed like the rest of the draft). */
interface LotDraft {
  key: string; // stable React key — survives removes/reorders
  date: string;
  quantity: string;
  price: string;
}

let lotKeySeq = 0;
const newLotKey = () => `lot-${++lotKeySeq}`;

const emptyLotRow = (): LotDraft => ({
  key: newLotKey(),
  date: todayISO(),
  quantity: "",
  price: "",
});

interface Draft {
  stockName: string;
  symbol: string;
  brokerId: string;
  /** Buy tranches — replaces the old flat purchaseDate/quantity/avgBuyPrice/investment. */
  lots: LotDraft[];
  currentPrice: string;
  status: MtfStatus;
  notes: string;
  dailyRatePct: string;
  interestBasis: InterestBasis;
  fundedPercent: string;
  manualInterestAdj: string;
  chargesMethod: ChargesMethod;
  brokerage: string;
  stt: string;
  exchangeTxn: string;
  gst: string;
  sebi: string;
  stampDuty: string;
  dp: string;
  other: string;
  manualTotal: string;
}

const numStr = (v: number | undefined | null): string => (v != null ? String(v) : "");

function makeDraft(initial: MtfPosition | null, fallbackBrokerId: string, fallbackRate: number): Draft {
  if (initial) {
    const isTotal = initial.charges.manualTotal !== undefined;
    return {
      stockName: initial.stockName,
      symbol: initial.symbol,
      brokerId: initial.brokerId,
      // normalizeLots gives legacy single-date positions one synthetic row
      // (a manual investment override is folded into the lot price for us)
      lots: normalizeLots(initial).map((l) => ({
        key: newLotKey(),
        date: l.date,
        quantity: String(l.quantity),
        price: String(l.price),
      })),
      currentPrice: numStr(initial.currentPrice),
      status: initial.status,
      notes: initial.notes ?? "",
      dailyRatePct: String(initial.dailyRatePct),
      interestBasis: initial.interestBasis,
      fundedPercent: String(initial.fundedPercent),
      manualInterestAdj: numStr(initial.manualInterestAdj),
      chargesMethod: isTotal ? "total" : "itemized",
      brokerage: numStr(initial.charges.brokerage),
      stt: numStr(initial.charges.stt),
      exchangeTxn: numStr(initial.charges.exchangeTxn),
      gst: numStr(initial.charges.gst),
      sebi: numStr(initial.charges.sebi),
      stampDuty: numStr(initial.charges.stampDuty),
      dp: numStr(initial.charges.dp),
      other: numStr(initial.charges.other),
      manualTotal: isTotal ? String(initial.charges.manualTotal) : "",
    };
  }
  return {
    stockName: "",
    symbol: "",
    brokerId: fallbackBrokerId,
    lots: [emptyLotRow()],
    currentPrice: "",
    status: "Open",
    notes: "",
    dailyRatePct: String(fallbackRate),
    interestBasis: "total",
    fundedPercent: "100",
    manualInterestAdj: "",
    chargesMethod: "auto",
    brokerage: "",
    stt: "",
    exchangeTxn: "",
    gst: "",
    sebi: "",
    stampDuty: "",
    dp: "",
    other: "",
    manualTotal: "",
  };
}

/** Rows that are complete enough to compute with (date + qty>0 + price>0),
 *  sorted by date and given contract ids "L1","L2"… */
function parseLots(rows: LotDraft[]): MtfLot[] {
  return rows
    .map((r) => ({ date: r.date, quantity: num(r.quantity), price: num(r.price) }))
    .filter((l) => l.date !== "" && l.quantity > 0 && l.price > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((l, i) => ({ id: `L${i + 1}`, ...l }));
}

/** Build the MtfCharges object for the active method. In itemized mode
 *  manualTotal is omitted ENTIRELY so the component sum wins. */
function buildCharges(d: Draft): MtfCharges {
  if (d.chargesMethod === "total") return { manualTotal: r2(num(d.manualTotal)) };
  const entries: [keyof Omit<MtfCharges, "manualTotal">, string][] = [
    ["brokerage", d.brokerage],
    ["stt", d.stt],
    ["exchangeTxn", d.exchangeTxn],
    ["gst", d.gst],
    ["sebi", d.sebi],
    ["stampDuty", d.stampDuty],
    ["dp", d.dp],
    ["other", d.other],
  ];
  const charges: MtfCharges = {};
  for (const [key, raw] of entries) {
    const n = num(raw);
    if (n !== 0) charges[key] = n;
  }
  return charges;
}

type ErrKey = "stockName" | "symbol" | "lots" | "dailyRatePct" | "fundedPercent";
type Errors = Partial<Record<ErrKey, string>>;

function validate(d: Draft): Errors {
  const errs: Errors = {};
  if (!d.stockName.trim()) errs.stockName = "Stock name is required";
  if (!d.symbol.trim()) errs.symbol = "Symbol is required";
  if (d.lots.length === 0) {
    errs.lots = "Add at least one purchase";
  } else if (d.lots.some((l) => !l.date || !(num(l.quantity) > 0) || !(num(l.price) > 0))) {
    errs.lots = "Every purchase needs a date, a quantity above 0 and a buy price above 0";
  }
  if (!(num(d.dailyRatePct) > 0)) errs.dailyRatePct = "Rate must be greater than 0";
  if (d.interestBasis === "funded") {
    const fp = num(d.fundedPercent);
    if (!(fp >= 1 && fp <= 100)) errs.fundedPercent = "Funded % must be between 1 and 100";
  }
  return errs;
}

/* ── tiny lucide-free segmented pill ───────────────────────────────────── */

function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className = "",
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`flex gap-1 rounded-[10px] border border-edge bg-raised p-1 ${className}`}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={`h-8 min-w-0 flex-1 cursor-pointer rounded-lg px-3 text-[13px] font-medium transition-colors duration-150 ${
              active ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface/60 hover:text-ink"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

const CHARGE_FIELDS: { key: "brokerage" | "stt" | "exchangeTxn" | "gst" | "sebi" | "stampDuty" | "dp" | "other"; label: string }[] = [
  { key: "brokerage", label: "Brokerage" },
  { key: "stt", label: "STT" },
  { key: "exchangeTxn", label: "Exchange" },
  { key: "gst", label: "GST" },
  { key: "sebi", label: "SEBI" },
  { key: "stampDuty", label: "Stamp Duty" },
  { key: "dp", label: "DP" },
  { key: "other", label: "Other" },
];

/** Shared column template so the header row and every lot row line up. */
const LOT_GRID =
  "grid grid-cols-[minmax(0,1.15fr)_minmax(0,0.7fr)_minmax(0,0.9fr)_minmax(76px,0.8fr)_2.25rem] items-center gap-2";

/* ── the modal ─────────────────────────────────────────────────────────── */

export function PositionFormModal({
  open,
  initial,
  onClose,
}: {
  open: boolean;
  initial: MtfPosition | null;
  onClose: () => void;
}) {
  const positions = useMtfStore((s) => s.positions);
  const brokers = useMtfStore((s) => s.brokers);
  const addPosition = useMtfStore((s) => s.addPosition);
  const updatePosition = useMtfStore((s) => s.updatePosition);
  const asOf = useAsOfToday();
  const chargeRates = useStore((s) => s.settings.chargeRates);

  const [draft, setDraft] = useState<Draft>(() =>
    makeDraft(initial, brokers[0]?.id ?? "", brokers[0]?.dailyRatePct ?? 0.041),
  );
  const [errors, setErrors] = useState<Errors>({});
  /** once the user edits the rate by hand, changing broker no longer re-defaults it */
  const [rateTouched, setRateTouched] = useState(false);

  // re-seed whenever the modal opens or targets a different position
  useEffect(() => {
    if (!open) return;
    const s = useMtfStore.getState();
    setDraft(makeDraft(initial, s.brokers[0]?.id ?? "", s.brokers[0]?.dailyRatePct ?? 0.041));
    setErrors({});
    const b = initial ? s.brokers.find((x) => x.id === initial.brokerId) : undefined;
    setRateTouched(initial != null && b != null && initial.dailyRatePct !== b.dailyRatePct);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial?.id]);

  const patch = (p: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...p }));
    setErrors((e) => {
      const touched = Object.keys(p).filter((k) => k in e) as ErrKey[];
      if (touched.length === 0) return e;
      const next = { ...e };
      for (const k of touched) delete next[k];
      return next;
    });
  };

  const onBrokerChange = (brokerId: string) => {
    const b = brokers.find((x) => x.id === brokerId);
    setDraft((d) => ({
      ...d,
      brokerId,
      dailyRatePct: !rateTouched && b ? String(b.dailyRatePct) : d.dailyRatePct,
    }));
  };

  /* ── lot row actions (route through patch so errors.lots clears) ──────── */

  const patchLot = (key: string, p: Partial<Omit<LotDraft, "key">>) =>
    patch({ lots: draft.lots.map((l) => (l.key === key ? { ...l, ...p } : l)) });

  const addLot = () => patch({ lots: [...draft.lots, emptyLotRow()] });

  const removeLot = (key: string) => {
    if (draft.lots.length <= 1) return;
    patch({ lots: draft.lots.filter((l) => l.key !== key) });
  };

  /* ── derived (valid rows only — partial rows are simply ignored live) ─── */

  const validLots = useMemo(() => parseLots(draft.lots), [draft.lots]);
  const totalQty = validLots.reduce((s, l) => s + l.quantity, 0);
  const totalInvestment = r2(validLots.reduce((s, l) => s + l.quantity * l.price, 0));
  const avgPrice = totalQty > 0 ? totalInvestment / totalQty : 0;

  // Auto-calculate — full round-trip Groww charges (both buy & sell legs) from the
  // rate card, exactly like the Add Trade form. MTF interest is tracked separately in
  // this form, so it is NOT folded in here (mtfInterest: 0). The sell leg is valued at
  // the CMP, falling back to the avg buy price when no CMP is given (round-trip at cost).
  const autoBreakdown = useMemo(() => {
    if (totalQty <= 0 || avgPrice <= 0) return null;
    const cp = num(draft.currentPrice);
    return computeCharges({
      assetClass: "Equity",
      segment: "MTF",
      exchange: "NSE",
      quantity: totalQty,
      entryPrice: avgPrice,
      exitPrice: cp > 0 ? cp : avgPrice,
      direction: "Long",
      rates: chargeRates,
      mtfInterest: 0,
    });
  }, [totalQty, avgPrice, draft.currentPrice, chargeRates]);

  /** Auto charges mapped to the MtfCharges shape (pledge → "other" — MtfCharges has no
   *  pledge field; the pledge's GST is already inside `gst`). */
  const autoCharges = useMemo<MtfCharges>(() => {
    const b = autoBreakdown;
    if (!b) return {};
    const c: MtfCharges = {};
    if (b.brokerage) c.brokerage = b.brokerage;
    if (b.stt) c.stt = b.stt;
    if (b.exchangeTxn) c.exchangeTxn = b.exchangeTxn;
    if (b.gst) c.gst = b.gst;
    if (b.sebi) c.sebi = b.sebi;
    if (b.stampDuty) c.stampDuty = b.stampDuty;
    if (b.dpCharges) c.dp = b.dpCharges;
    if (b.pledgeCharges) c.other = b.pledgeCharges;
    return c;
  }, [autoBreakdown]);

  const draftCharges = useMemo(
    () => (draft.chargesMethod === "auto" ? autoCharges : buildCharges(draft)),
    [draft, autoCharges],
  );
  const itemizedSum = chargesTotal(draftCharges);

  /** Live summary — a full draft MtfPosition run through the frozen calc core. */
  const preview = useMemo(() => {
    if (validLots.length === 0) return null;
    const cp = num(draft.currentPrice);
    const adj = num(draft.manualInterestAdj);
    const draftPos: MtfPosition = {
      id: initial?.id ?? "MTF-DRAFT",
      stockName: draft.stockName,
      symbol: draft.symbol,
      brokerId: draft.brokerId,
      lots: validLots,
      purchaseDate: validLots[0].date, // earliest — parseLots sorts by date
      quantity: totalQty,
      avgBuyPrice: avgPrice,
      totalInvestment,
      currentPrice: cp > 0 ? cp : undefined,
      status: "Open", // preview always uses live math
      dailyRatePct: num(draft.dailyRatePct),
      interestBasis: draft.interestBasis,
      fundedPercent: (() => {
        const fp = num(draft.fundedPercent);
        return fp >= 1 && fp <= 100 ? fp : 100;
      })(),
      manualInterestAdj: adj !== 0 ? adj : undefined,
      charges: draftCharges,
    };
    return computePosition(draftPos, brokers, asOf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, draftCharges, brokers, asOf, validLots, totalQty, totalInvestment, avgPrice, initial?.id]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const errs = validate(draft);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      toast("Please fix the highlighted fields", "error");
      return;
    }
    // every row is valid here, so parseLots keeps them all
    const lots = parseLots(draft.lots);
    const qty = lots.reduce((s, l) => s + l.quantity, 0);
    const investment = r2(lots.reduce((s, l) => s + l.quantity * l.price, 0));
    const cp = num(draft.currentPrice);
    const adj = num(draft.manualInterestAdj);
    const fp = num(draft.fundedPercent);
    const stayClosed = initial != null && initial.status === "Closed" && draft.status === "Closed";
    const basePos: MtfPosition = {
      id: initial?.id ?? nextMtfId(positions),
      stockName: draft.stockName.trim(),
      symbol: draft.symbol.trim().toUpperCase(),
      brokerId: draft.brokerId,
      lots,
      // flat fields DERIVED from the lots — kept in sync per the contract
      purchaseDate: lots[0].date,
      quantity: qty,
      avgBuyPrice: qty > 0 ? investment / qty : 0,
      totalInvestment: investment,
      currentPrice: cp > 0 ? cp : undefined,
      status: draft.status,
      notes: draft.notes.trim() ? draft.notes.trim() : undefined,
      dailyRatePct: num(draft.dailyRatePct),
      interestBasis: draft.interestBasis,
      fundedPercent: fp >= 1 && fp <= 100 ? fp : 100,
      manualInterestAdj: adj !== 0 ? adj : undefined,
      charges: draftCharges,
    };
    // Editing a position that STAYS closed: recompute the frozen snapshot from the
    // edited lots/rate/charges + the original exit price & date, so the snapshot can
    // never contradict the (possibly changed) quantity/lots. Falls back to the stored
    // snapshot only if the exit price/date are somehow missing.
    const pos: MtfPosition =
      stayClosed && initial.exitPrice != null && initial.exitDate
        ? { ...basePos, ...buildCloseSnapshot(basePos, initial.exitPrice, initial.exitDate) }
        : stayClosed
          ? {
              ...basePos,
              status: "Closed",
              exitDate: initial.exitDate,
              exitPrice: initial.exitPrice,
              finalHoldingDays: initial.finalHoldingDays,
              finalInterest: initial.finalInterest,
              finalCharges: initial.finalCharges,
              finalGrossProfit: initial.finalGrossProfit,
              finalNetProfit: initial.finalNetProfit,
              finalBreakEvenPrice: initial.finalBreakEvenPrice,
            }
          : basePos;
    if (initial) {
      updatePosition(initial.id, pos);
      toast("Position updated", "success");
    } else {
      addPosition(pos);
      toast("Position added", "success");
    }
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={initial ? "Edit Position" : "Add Position"} widthClass="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {/* ── Basic details ─────────────────────────────────────────────── */}
        <section className="space-y-3">
          <h3 className="label-caps">Basic details</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Stock Name" required error={errors.stockName}>
              {(id) => (
                <Input
                  id={id}
                  value={draft.stockName}
                  onChange={(e) => patch({ stockName: e.target.value })}
                  placeholder="Reliance Industries"
                  autoFocus
                />
              )}
            </Field>
            <Field label="Symbol" required error={errors.symbol}>
              {(id) => (
                <Input
                  id={id}
                  value={draft.symbol}
                  onChange={(e) => patch({ symbol: e.target.value.toUpperCase() })}
                  placeholder="RELIANCE"
                />
              )}
            </Field>
            <Field label="Broker">
              {(id) => (
                <Select id={id} value={draft.brokerId} onChange={(e) => onBrokerChange(e.target.value)}>
                  {brokers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Current Market Price" hint="optional — leave blank if unknown">
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.currentPrice}
                  onChange={(e) => patch({ currentPrice: e.target.value })}
                  placeholder="0.00"
                />
              )}
            </Field>
          </div>

          {/* ── Purchases (buy lots) ────────────────────────────────────── */}
          <div>
            <span className="mb-1.5 block text-[12px] font-medium text-muted">
              Purchases
              <span className="ml-0.5 text-loss">*</span>
            </span>
            <div className="space-y-2">
              <div className={LOT_GRID} aria-hidden>
                <span className="text-[11px] font-medium text-faint">Date</span>
                <span className="text-[11px] font-medium text-faint">Qty</span>
                <span className="text-[11px] font-medium text-faint">Buy Price ₹</span>
                <span className="text-right text-[11px] font-medium text-faint">Invested</span>
                <span />
              </div>
              {draft.lots.map((lot, i) => {
                const q = num(lot.quantity);
                const p = num(lot.price);
                const invested = q > 0 && p > 0 ? r2(q * p) : 0;
                const onlyRow = draft.lots.length === 1;
                return (
                  <div key={lot.key} className={LOT_GRID}>
                    <Input
                      type="date"
                      aria-label={`Purchase ${i + 1} date`}
                      value={lot.date}
                      onChange={(e) => patchLot(lot.key, { date: e.target.value })}
                    />
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      aria-label={`Purchase ${i + 1} quantity`}
                      value={lot.quantity}
                      onChange={(e) => patchLot(lot.key, { quantity: e.target.value })}
                      placeholder="0"
                    />
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      aria-label={`Purchase ${i + 1} buy price`}
                      value={lot.price}
                      onChange={(e) => patchLot(lot.key, { price: e.target.value })}
                      placeholder="0.00"
                    />
                    <span className="tnum truncate text-right text-[12px] text-muted">
                      {invested > 0 ? `= ${formatMoney(invested)}` : "—"}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      icon={Trash2}
                      aria-label={`Remove purchase ${i + 1}`}
                      className={`h-8 w-8 shrink-0 px-0 hover:text-loss ${onlyRow ? "invisible" : ""}`}
                      disabled={onlyRow}
                      onClick={() => removeLot(lot.key)}
                    />
                  </div>
                );
              })}
            </div>
            {errors.lots && <p className="mt-1 text-[11px] text-loss">{errors.lots}</p>}
            <div className="mt-2">
              <Button type="button" variant="ghost" size="sm" icon={Plus} onClick={addLot}>
                Add purchase
              </Button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 rounded-[10px] border border-edge-soft bg-raised/60 px-3 py-2">
              <p className="text-[12px] text-muted">
                Total qty{" "}
                <span className="tnum font-semibold text-ink">
                  {totalQty > 0 ? formatNumber(totalQty) : "—"}
                </span>
              </p>
              <p className="text-[12px] text-muted">
                Avg price{" "}
                <span className="tnum font-semibold text-ink">
                  {totalQty > 0 ? formatMoney(avgPrice, { decimals: true }) : "—"}
                </span>
              </p>
              <p className="text-[12px] text-muted">
                Total investment{" "}
                <span className="tnum font-semibold text-ink">
                  {totalQty > 0 ? formatMoney(totalInvestment) : "—"}
                </span>
              </p>
            </div>
            {draft.lots.length >= 2 && (
              <p className="mt-1.5 text-[11px] text-faint">
                Each purchase accrues interest from its own date.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <span className="mb-1.5 block text-[12px] font-medium text-muted">Status</span>
              <Segmented<MtfStatus>
                options={[
                  { value: "Open", label: "Open" },
                  { value: "Closed", label: "Closed" },
                ]}
                value={draft.status}
                onChange={(v) => patch({ status: v })}
                ariaLabel="Position status"
              />
            </div>
            <Field label="Notes" className="sm:col-span-2">
              {(id) => (
                <Textarea
                  id={id}
                  value={draft.notes}
                  onChange={(e) => patch({ notes: e.target.value })}
                  placeholder="Why did you take this position?"
                />
              )}
            </Field>
          </div>
        </section>

        {/* ── Interest settings ─────────────────────────────────────────── */}
        <section className="space-y-3">
          <h3 className="label-caps">Interest settings</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              label="Daily Interest Rate %"
              required
              error={errors.dailyRatePct}
              hint={`≈ ${formatPct(annualizedPct(num(draft.dailyRatePct)), 2)} p.a.`}
            >
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  min="0"
                  step="0.001"
                  value={draft.dailyRatePct}
                  onChange={(e) => {
                    setRateTouched(true);
                    patch({ dailyRatePct: e.target.value });
                  }}
                  placeholder="0.041"
                />
              )}
            </Field>
            <div>
              <span className="mb-1.5 block text-[12px] font-medium text-muted">Interest Basis</span>
              <Segmented<InterestBasis>
                options={[
                  { value: "total", label: "Total value" },
                  { value: "funded", label: "Funded amount" },
                ]}
                value={draft.interestBasis}
                onChange={(v) => patch({ interestBasis: v })}
                ariaLabel="Interest basis"
              />
            </div>
            {draft.interestBasis === "funded" && (
              <Field
                label="Funded %"
                required
                error={errors.fundedPercent}
                hint="share of the position funded by the broker"
              >
                {(id) => (
                  <Input
                    id={id}
                    type="number"
                    min="1"
                    max="100"
                    step="1"
                    value={draft.fundedPercent}
                    onChange={(e) => patch({ fundedPercent: e.target.value })}
                    placeholder="100"
                  />
                )}
              </Field>
            )}
            <Field label="Manual Interest Adjustment (±₹)" hint="optional — added to accumulated interest">
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  step="0.01"
                  value={draft.manualInterestAdj}
                  onChange={(e) => patch({ manualInterestAdj: e.target.value })}
                  placeholder="0.00"
                />
              )}
            </Field>
          </div>
        </section>

        {/* ── Charges ───────────────────────────────────────────────────── */}
        <section className="space-y-3">
          <h3 className="label-caps">Charges</h3>
          <Segmented<ChargesMethod>
            options={[
              { value: "auto", label: "Auto-calculate" },
              { value: "itemized", label: "Itemized" },
              { value: "total", label: "Total" },
            ]}
            value={draft.chargesMethod}
            onChange={(v) => patch({ chargesMethod: v })}
            ariaLabel="Charges method"
            className="sm:max-w-md"
          />
          {draft.chargesMethod === "itemized" ? (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {CHARGE_FIELDS.map((f) => (
                  <Field key={f.key} label={f.label}>
                    {(id) => (
                      <Input
                        id={id}
                        type="number"
                        min="0"
                        step="0.01"
                        value={draft[f.key]}
                        onChange={(e) => patch({ [f.key]: e.target.value } as Partial<Draft>)}
                        placeholder="0.00"
                      />
                    )}
                  </Field>
                ))}
              </div>
              <p className="text-[12px] text-muted">
                Total charges{" "}
                <span className="tnum font-semibold text-ink">
                  {formatMoney(itemizedSum, { decimals: true })}
                </span>
              </p>
            </>
          ) : draft.chargesMethod === "total" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Total Charges (₹)" hint="all-in round-trip estimate">
                {(id) => (
                  <Input
                    id={id}
                    type="number"
                    min="0"
                    step="0.01"
                    value={draft.manualTotal}
                    onChange={(e) => patch({ manualTotal: e.target.value })}
                    placeholder="186.45"
                  />
                )}
              </Field>
            </div>
          ) : autoBreakdown ? (
            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-[10px] border border-edge-soft bg-raised/60 p-3 text-[12px] sm:grid-cols-4">
                {(
                  [
                    ["Brokerage", autoBreakdown.brokerage],
                    ["Exchange", autoBreakdown.exchangeTxn],
                    ["STT", autoBreakdown.stt],
                    ["SEBI", autoBreakdown.sebi],
                    ["Stamp duty", autoBreakdown.stampDuty],
                    ["GST", autoBreakdown.gst],
                    ["DP charges", autoBreakdown.dpCharges],
                    ["MTF pledge", autoBreakdown.pledgeCharges],
                  ] as [string, number][]
                ).map(([label, val]) => (
                  <div key={label} className="flex items-baseline justify-between gap-2">
                    <span className="text-muted">{label}</span>
                    <span className="tnum text-ink">{formatMoney(val, { decimals: true })}</span>
                  </div>
                ))}
              </div>
              <p className="text-[12px] text-muted">
                Total charges{" "}
                <span className="tnum font-semibold text-ink">
                  {formatMoney(autoBreakdown.total, { decimals: true })}
                </span>
              </p>
              <p className="text-[11px] leading-relaxed text-faint">
                Auto-computed from your Groww rate card (Settings) for a full round-trip — both the buy
                and sell legs. MTF interest is tracked separately above, so it isn&apos;t included here.
              </p>
            </div>
          ) : (
            <p className="text-[12px] text-faint">
              Add a purchase (quantity &amp; buy price) above to auto-compute charges.
            </p>
          )}
        </section>

        {/* ── Live summary strip ────────────────────────────────────────── */}
        <div className="rounded-xl border border-edge-soft bg-raised/40 p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <p className="label-caps">Daily Interest</p>
              <p className="tnum mt-1 text-[15px] font-semibold text-warning">
                {preview ? formatMoney(preview.dailyInterest, { decimals: true }) : "—"}
              </p>
            </div>
            <div>
              <p className="label-caps">Interest So Far</p>
              <p className="tnum mt-1 text-[15px] font-semibold text-warning">
                {preview ? formatMoney(preview.accumulatedInterest, { decimals: true }) : "—"}
              </p>
            </div>
            <div>
              <p className="label-caps">Break-even Price</p>
              <p className="tnum mt-1 flex items-center gap-1.5 text-[15px] font-semibold text-ink">
                <span
                  aria-hidden
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: MTF_COLORS.breakEven }}
                />
                {preview ? formatMoney(preview.breakEvenPrice, { decimals: true }) : "—"}
              </p>
            </div>
            <div>
              <p className="label-caps">Net Profit</p>
              <p
                className={`tnum mt-1 text-[15px] font-semibold ${
                  preview ? pnlClass(preview.netProfit) : "text-muted"
                }`}
              >
                {preview ? formatMoney(preview.netProfit, { sign: true }) : "—"}
              </p>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-faint">
            {preview
              ? `Assumes round-trip charges ≈ ${formatMoney(preview.totalCharges, { decimals: true })}`
              : "Add at least one purchase (date, quantity & price) to preview interest & break-even."}
          </p>
        </div>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <footer className="flex items-center justify-end gap-2 border-t border-edge-soft pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            Save Position
          </Button>
        </footer>
      </form>
    </Modal>
  );
}
