/** Add / Edit Trade — multi-section form with a live P&L / charges / tax calculator.
 *  Routes: /trades/new and /trades/:id/edit. */

import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useId, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ImagePlus, Info, Loader2, Save, SearchX, Trash2, Wand2 } from "lucide-react";
import type { AssetClass, Exchange, MarketCondition, Timeframe, Trade, TradeSegment } from "@/types";
import { nextTradeId, useStore } from "@/store/useStore";
import { toast } from "@/store/toast";
import {
  computeCharges,
  computeGrossPnl,
  computeRMultiple,
  computeTax,
  computeTaxablePnl,
  defaultSegmentFor,
  holdingMinutesBetween,
  manualChargesBreakdown,
  taxCategoryFor,
} from "@/lib/tradeMath";
import { formatDate, formatMoney, formatPct } from "@/lib/format";
import { toWebp, uploadScreenshot, useScreenshotUrl } from "@/lib/images";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import type { Draft } from "./tradeform/draft";
import {
  ASSET_CLASSES,
  MARKET_CONDITIONS,
  TIMEFRAMES,
  ZERO_CHARGES,
  makeDraft,
  num,
  r2,
  tagsByFrequency,
  toLocalInput,
  uniqueStrategies,
} from "./tradeform/draft";
import { Segmented } from "./tradeform/Segmented";
import { RatingRow } from "./tradeform/RatingRow";
import { TagInput } from "./tradeform/TagInput";
import type { LiveCalc } from "./tradeform/SummaryPanel";
import { SummaryPanel } from "./tradeform/SummaryPanel";

const CUSTOM_STRATEGY = "__custom__";

type ErrKey = "symbol" | "quantity" | "entryPrice" | "openedAt" | "exitPrice" | "closedAt";
type Errors = Partial<Record<ErrKey, string>>;

function validate(draft: Draft): Errors {
  const errs: Errors = {};
  if (!draft.symbol.trim()) errs.symbol = "Symbol is required";
  if (!(num(draft.quantity) > 0)) errs.quantity = "Quantity must be greater than 0";
  if (!(num(draft.entryPrice) > 0)) errs.entryPrice = "Entry price must be greater than 0";
  if (!draft.openedAt) errs.openedAt = "Entry time is required";
  if (draft.status === "Closed") {
    if (!(num(draft.exitPrice) > 0)) errs.exitPrice = "Exit price is required to close a trade";
    if (!draft.closedAt) errs.closedAt = "Exit time is required to close a trade";
    else if (
      draft.openedAt &&
      new Date(draft.closedAt).getTime() <= new Date(draft.openedAt).getTime()
    )
      errs.closedAt = "Exit time must be after the entry time";
  }
  return errs;
}

export default function TradeForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const trades = useStore((s) => s.trades);
  const accounts = useStore((s) => s.accounts);
  const settings = useStore((s) => s.settings);
  const addTrade = useStore((s) => s.addTrade);
  const updateTrade = useStore((s) => s.updateTrade);

  const editing = useMemo(() => (id ? trades.find((t) => t.id === id) : undefined), [id, trades]);
  const strategies = useMemo(() => uniqueStrategies(trades), [trades]);
  const tagSuggestions = useMemo(() => tagsByFrequency(trades), [trades]);
  const symbolOptions = useMemo(
    () => Array.from(new Set(trades.map((t) => t.symbol))).sort((a, b) => a.localeCompare(b)),
    [trades],
  );
  const symbolListId = useId();

  const [draft, setDraft] = useState<Draft>(() => makeDraft(editing, accounts, strategies));
  const [errors, setErrors] = useState<Errors>({});
  const [shotUploading, setShotUploading] = useState(false);
  const shot = useScreenshotUrl(draft.screenshotUrl || undefined);

  // re-seed the form when the route id changes (new ↔ edit, or a different trade)
  useEffect(() => {
    const s = useStore.getState();
    const t = id ? s.trades.find((x) => x.id === id) : undefined;
    setDraft(makeDraft(t, s.accounts, uniqueStrategies(s.trades)));
    setErrors({});
  }, [id]);

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

  const account = useMemo(
    () => accounts.find((a) => a.id === draft.accountId),
    [accounts, draft.accountId],
  );
  const currency = account?.currency ?? "INR";

  /** Everything derived — feeds both the sticky panel and the save handler. */
  const calc = useMemo<LiveCalc>(() => {
    const qty = num(draft.quantity);
    const entry = num(draft.entryPrice);
    const exit = num(draft.exitPrice);
    const stop = num(draft.stopLoss);
    const risk = num(draft.riskAmount);
    const closed = draft.status === "Closed";
    const ready = closed && qty > 0 && entry > 0 && exit > 0;
    // segment drives everything: equity uses the picker, derivatives are FnO, etc.
    const segment: TradeSegment =
      draft.assetClass === "Equity"
        ? draft.segment === "Intraday" || draft.segment === "MTF" || draft.segment === "ETF"
          ? draft.segment
          : "Delivery"
        : defaultSegmentFor(draft.assetClass);
    const isMtf = segment === "MTF";
    const intraday = segment === "Intraday";
    const holdingMinutes =
      closed && draft.openedAt && draft.closedAt
        ? holdingMinutesBetween(draft.openedAt, draft.closedAt)
        : undefined;
    const positionValue = r2(qty * entry);
    const pctOfCapital =
      account && account.startingCapital > 0 ? r2((positionValue / account.startingCapital) * 100) : 0;
    const mtf = isMtf ? num(draft.manualMtfInterest) : 0;
    const charges = draft.manualCharges
      ? manualChargesBreakdown(num(draft.manualChargeAmount), mtf)
      : qty > 0 && entry > 0
        ? computeCharges({
            assetClass: draft.assetClass,
            segment,
            exchange: draft.exchange,
            quantity: qty,
            entryPrice: entry,
            exitPrice: ready ? exit : undefined,
            direction: draft.direction,
            rates: settings.chargeRates,
            mtfInterest: mtf,
          })
        : { ...ZERO_CHARGES };
    const gross = ready ? computeGrossPnl(draft.direction, entry, exit, qty) : 0;
    const net = ready ? r2(gross - charges.total) : 0;
    const category = taxCategoryFor(draft.assetClass, holdingMinutes, intraday);
    const taxablePnl = ready ? computeTaxablePnl(gross, charges, category) : 0;
    const tax = ready
      ? computeTax(taxablePnl, category, settings.taxRates)
      : { category, taxableAmount: 0, rate: 0, estimatedTax: 0 };
    return {
      ready,
      intraday,
      segment,
      manualCharges: draft.manualCharges,
      positionValue,
      pctOfCapital,
      risk,
      gross,
      charges,
      net,
      taxablePnl,
      tax,
      rMultiple: ready ? computeRMultiple(net, risk) : undefined,
      chargesPctOfGross: ready && gross !== 0 ? r2((charges.total / Math.abs(gross)) * 100) : undefined,
      holdingMinutes,
      suggestedRisk:
        stop > 0 && entry > 0 && qty > 0 && stop !== entry ? r2(Math.abs(entry - stop) * qty) : undefined,
    };
  }, [draft, account, settings.chargeRates, settings.taxRates]);

  const isMtfSeg = calc.segment === "MTF";
  const isCryptoAsset = draft.assetClass === "Crypto";
  /** Itemised rows for the auto-mode live breakdown — zeros hidden, MTF interest
   *  always shown for MTF so the manual field's effect is visible. */
  const autoChargeRows: { label: string; value: number; warn?: boolean }[] = [
    { label: "Brokerage", value: calc.charges.brokerage },
    { label: isCryptoAsset ? "Exchange fee" : "Exchange txn", value: calc.charges.exchangeTxn },
    { label: isCryptoAsset ? "TDS (1% on sell)" : "STT / CTT", value: calc.charges.stt },
    { label: "SEBI fees", value: calc.charges.sebi },
    { label: "Stamp duty", value: calc.charges.stampDuty },
    { label: "GST", value: calc.charges.gst },
    { label: "DP charges", value: calc.charges.dpCharges },
    { label: "MTF pledge", value: calc.charges.pledgeCharges ?? 0 },
    ...(isMtfSeg ? [{ label: "MTF interest", value: calc.charges.mtfInterest, warn: true }] : []),
  ].filter((r) => r.value > 0 || r.warn);

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast("Only image files can be attached", "error");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast("That image is over 10 MB — please pick a smaller one", "error");
      return;
    }
    setShotUploading(true);
    try {
      const webp = await toWebp(file); // downscale + WebP, client-side
      const tradeId = editing ? editing.id : nextTradeId(trades);
      const key = await uploadScreenshot(tradeId, webp); // → R2, returns the object key
      setDraft((d) => ({ ...d, screenshotUrl: key }));
      toast("Screenshot uploaded", "info");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not upload that screenshot", "error");
    } finally {
      setShotUploading(false);
    }
  };

  const handleSave = () => {
    const errs = validate(draft);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      toast("Fix the highlighted fields to save this trade", "error");
      return;
    }
    const isClosed = draft.status === "Closed";
    const qty = num(draft.quantity);
    const entry = num(draft.entryPrice);
    const stop = num(draft.stopLoss);
    const tgt = num(draft.target);
    const strategy =
      (draft.useCustomStrategy ? draft.customStrategy : draft.strategy).trim() || "Unclassified";
    const tradeId = editing ? editing.id : nextTradeId(trades);

    const trade: Trade = {
      id: tradeId,
      accountId: draft.accountId,
      symbol: draft.symbol.trim().toUpperCase(),
      assetClass: draft.assetClass,
      segment: calc.segment,
      exchange: draft.assetClass === "Equity" ? draft.exchange : "NSE",
      direction: draft.direction,
      status: draft.status,
      quantity: qty,
      entryPrice: entry,
      exitPrice: isClosed ? num(draft.exitPrice) : undefined,
      stopLoss: stop > 0 ? stop : undefined,
      target: tgt > 0 ? tgt : undefined,
      openedAt: draft.openedAt,
      closedAt: isClosed ? draft.closedAt : undefined,
      holdingMinutes: calc.holdingMinutes,
      grossPnl: calc.gross,
      charges: calc.charges,
      manualCharges: draft.manualCharges,
      netPnl: calc.net,
      taxablePnl: calc.taxablePnl,
      tax: calc.tax,
      riskAmount: num(draft.riskAmount),
      rMultiple: calc.rMultiple,
      positionValue: calc.positionValue,
      pctOfCapital: calc.pctOfCapital,
      strategy,
      marketCondition: draft.marketCondition,
      timeframe: draft.timeframe,
      tags: [...draft.tags],
      emotionRating: draft.emotionRating,
      confidenceRating: draft.confidenceRating,
      screenshotUrl: draft.screenshotUrl || undefined,
      notes: draft.notes.trim(),
      mistakes: draft.mistakes.trim() || undefined,
      lessons: draft.lessons.trim() || undefined,
    };

    if (editing) {
      updateTrade(editing.id, trade);
      toast(`Trade ${editing.id} updated`);
    } else {
      addTrade(trade);
      toast(`Trade ${tradeId} added to your journal`);
    }
    navigate("/trades");
  };

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    handleSave();
  };

  // ---- edit route with an unknown id -------------------------------------
  if (id && !editing) {
    return (
      <div className="animate-in">
        <PageHeader title="Edit trade" description="This trade could not be found." />
        <Card>
          <EmptyState
            icon={SearchX}
            title={`Trade ${id} not found`}
            hint="It may have been deleted, or the link you followed is stale."
            action={
              <Button variant="outline" icon={ArrowLeft} onClick={() => navigate("/trades")}>
                Back to trades
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  const disabledWhenOpen = draft.status === "Open";
  const numberInputCls = "disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="animate-in">
      <PageHeader
        title={editing ? `Edit ${editing.id}` : "Add trade"}
        description={
          editing
            ? `${editing.symbol} · ${editing.assetClass} · opened ${formatDate(editing.openedAt)}`
            : "Log a trade — charges, tax and R multiple are computed live as you type."
        }
        actions={
          <>
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button type="button" variant="primary" icon={Save} onClick={handleSave}>
              {editing ? "Save changes" : "Save trade"}
            </Button>
          </>
        }
      />

      <form onSubmit={onSubmit} noValidate>
        <div className="grid items-start gap-4 xl:grid-cols-3">
          {/* ------------------------------- form ------------------------------ */}
          <div className="space-y-4 xl:col-span-2">
            {/* 1 · Instrument */}
            <Card title="Instrument" subtitle="What you traded and where">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Account" hint={account ? `${account.broker} · capital ${formatMoney(account.startingCapital, { currency })}` : undefined}>
                  {(fid) =>
                    accounts.length === 0 ? (
                      <Select id={fid} disabled>
                        <option>No accounts available</option>
                      </Select>
                    ) : (
                      <Select
                        id={fid}
                        value={draft.accountId}
                        onChange={(e) => patch({ accountId: e.target.value })}
                      >
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name} · {a.broker}
                          </option>
                        ))}
                      </Select>
                    )
                  }
                </Field>
                <Field label="Symbol" required error={errors.symbol}>
                  {(fid) => (
                    <>
                      <Input
                        id={fid}
                        value={draft.symbol}
                        onChange={(e) => patch({ symbol: e.target.value.toUpperCase() })}
                        placeholder="RELIANCE, NIFTY 24500 CE…"
                        list={symbolListId}
                        autoComplete="off"
                        className="font-mono uppercase"
                      />
                      <datalist id={symbolListId}>
                        {symbolOptions.map((s) => (
                          <option key={s} value={s} />
                        ))}
                      </datalist>
                    </>
                  )}
                </Field>
                <Field label="Asset class">
                  {(fid) => (
                    <Select
                      id={fid}
                      value={draft.assetClass}
                      onChange={(e) => {
                        const assetClass = e.target.value as AssetClass;
                        // keep segment coherent with asset class
                        patch({
                          assetClass,
                          segment:
                            assetClass === "Equity"
                              ? draft.segment === "Intraday" || draft.segment === "MTF" || draft.segment === "ETF"
                                ? draft.segment
                                : "Delivery"
                              : defaultSegmentFor(assetClass),
                        });
                      }}
                    >
                      {ASSET_CLASSES.map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                {draft.assetClass === "Equity" && (
                  <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
                    <Field label="Segment" hint="Groww product — drives charges & the tax base (MTF adds interest · ETF = no buy STT, 0.001% sell)">
                      {() => (
                        <Segmented
                          ariaLabel="Equity segment"
                          value={draft.segment === "Intraday" || draft.segment === "MTF" || draft.segment === "ETF" ? draft.segment : "Delivery"}
                          onChange={(segment) => patch({ segment: segment as TradeSegment })}
                          options={[
                            { value: "Delivery", label: "Delivery" },
                            { value: "Intraday", label: "Intraday", activeClass: "bg-info-soft text-info" },
                            { value: "MTF", label: "MTF", activeClass: "bg-warning-soft text-warning" },
                            { value: "ETF", label: "ETF", activeClass: "bg-accent-soft text-accent" },
                          ]}
                        />
                      )}
                    </Field>
                    <Field label="Exchange" hint="Txn charge">
                      {() => (
                        <Segmented
                          ariaLabel="Exchange"
                          value={draft.exchange}
                          onChange={(exchange) => patch({ exchange: exchange as Exchange })}
                          options={[
                            { value: "NSE", label: "NSE" },
                            { value: "BSE", label: "BSE" },
                          ]}
                        />
                      )}
                    </Field>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Direction">
                    {() => (
                      <Segmented
                        ariaLabel="Direction"
                        value={draft.direction}
                        onChange={(direction) => patch({ direction })}
                        options={[
                          { value: "Long", label: "Long", activeClass: "bg-profit-soft text-profit" },
                          { value: "Short", label: "Short", activeClass: "bg-loss-soft text-loss" },
                        ]}
                      />
                    )}
                  </Field>
                  <Field label="Status">
                    {() => (
                      <Segmented
                        ariaLabel="Status"
                        value={draft.status}
                        onChange={(status) =>
                          status === "Open"
                            ? patch({ status, exitPrice: "", closedAt: "" })
                            : patch({ status, closedAt: draft.closedAt || toLocalInput(new Date()) })
                        }
                        options={[
                          { value: "Open", label: "Open", activeClass: "bg-info-soft text-info" },
                          { value: "Closed", label: "Closed" },
                        ]}
                      />
                    )}
                  </Field>
                </div>
              </div>
            </Card>

            {/* 2 · Entry & exit */}
            <Card title="Entry & exit" subtitle="Prices, size and timing">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Quantity" required error={errors.quantity}>
                  {(fid) => (
                    <Input
                      id={fid}
                      type="number"
                      min="0"
                      step="any"
                      inputMode="decimal"
                      value={draft.quantity}
                      onChange={(e) => patch({ quantity: e.target.value })}
                      placeholder="0"
                    />
                  )}
                </Field>
                <Field label="Entry price" required error={errors.entryPrice}>
                  {(fid) => (
                    <Input
                      id={fid}
                      type="number"
                      min="0"
                      step="any"
                      inputMode="decimal"
                      value={draft.entryPrice}
                      onChange={(e) => patch({ entryPrice: e.target.value })}
                      placeholder="0.00"
                    />
                  )}
                </Field>
                <Field
                  label="Exit price"
                  required={draft.status === "Closed"}
                  error={errors.exitPrice}
                  hint={disabledWhenOpen ? "Enabled when status is Closed" : undefined}
                >
                  {(fid) => (
                    <Input
                      id={fid}
                      type="number"
                      min="0"
                      step="any"
                      inputMode="decimal"
                      value={draft.exitPrice}
                      onChange={(e) => patch({ exitPrice: e.target.value })}
                      placeholder="0.00"
                      disabled={disabledWhenOpen}
                      className={numberInputCls}
                    />
                  )}
                </Field>
                <Field label="Stop-loss" hint="Feeds the suggested risk below">
                  {(fid) => (
                    <Input
                      id={fid}
                      type="number"
                      min="0"
                      step="any"
                      inputMode="decimal"
                      value={draft.stopLoss}
                      onChange={(e) => patch({ stopLoss: e.target.value })}
                      placeholder="0.00"
                    />
                  )}
                </Field>
                <Field label="Target">
                  {(fid) => (
                    <Input
                      id={fid}
                      type="number"
                      min="0"
                      step="any"
                      inputMode="decimal"
                      value={draft.target}
                      onChange={(e) => patch({ target: e.target.value })}
                      placeholder="0.00"
                    />
                  )}
                </Field>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Opened at" required error={errors.openedAt}>
                  {(fid) => (
                    <Input
                      id={fid}
                      type="datetime-local"
                      value={draft.openedAt}
                      onChange={(e) => patch({ openedAt: e.target.value })}
                    />
                  )}
                </Field>
                <Field
                  label="Closed at"
                  required={draft.status === "Closed"}
                  error={errors.closedAt}
                  hint={disabledWhenOpen ? "Enabled when status is Closed" : undefined}
                >
                  {(fid) => (
                    <Input
                      id={fid}
                      type="datetime-local"
                      value={draft.closedAt}
                      onChange={(e) => patch({ closedAt: e.target.value })}
                      disabled={disabledWhenOpen}
                      className={numberInputCls}
                    />
                  )}
                </Field>
              </div>
            </Card>

            {/* 3 · Risk & sizing */}
            <Card title="Risk & sizing" subtitle="Planned risk drives the R multiple">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Risk amount"
                  hint="Planned rupee risk on this trade — the R multiple is net P&L ÷ this"
                >
                  {(fid) => (
                    <Input
                      id={fid}
                      type="number"
                      min="0"
                      step="any"
                      inputMode="decimal"
                      value={draft.riskAmount}
                      onChange={(e) => patch({ riskAmount: e.target.value })}
                      placeholder="0"
                    />
                  )}
                </Field>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-[10px] border border-edge bg-raised px-3 py-2.5">
                  <div className="label-caps">Position value</div>
                  <div className="tnum mt-1 text-[14px] font-medium text-ink">
                    {formatMoney(calc.positionValue, { currency })}
                  </div>
                  <div className="mt-0.5 text-[11px] text-faint">qty × entry</div>
                </div>
                <div className="rounded-[10px] border border-edge bg-raised px-3 py-2.5">
                  <div className="label-caps">% of capital</div>
                  <div className="tnum mt-1 text-[14px] font-medium text-ink">
                    {formatPct(calc.pctOfCapital)}
                  </div>
                  <div className="mt-0.5 text-[11px] text-faint">
                    vs {account ? account.name : "account"} capital
                  </div>
                </div>
                <div className="flex items-start justify-between gap-2 rounded-[10px] border border-edge bg-raised px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="label-caps">Suggested risk</div>
                    <div className="tnum mt-1 text-[14px] font-medium text-ink">
                      {calc.suggestedRisk !== undefined
                        ? formatMoney(calc.suggestedRisk, { currency })
                        : "—"}
                    </div>
                    <div className="mt-0.5 text-[11px] text-faint">|entry − stop| × qty</div>
                  </div>
                  {calc.suggestedRisk !== undefined && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      icon={Wand2}
                      aria-label="Use suggested risk amount"
                      onClick={() => patch({ riskAmount: String(calc.suggestedRisk) })}
                    >
                      Use
                    </Button>
                  )}
                </div>
              </div>
            </Card>

            {/* 3.5 · Charges */}
            <Card title="Charges" subtitle="Brokerage, statutory levies and MTF interest">
              <Field label="How charges are recorded">
                {() => (
                  <Segmented
                    ariaLabel="Charge entry mode"
                    value={draft.manualCharges ? "manual" : "auto"}
                    onChange={(v) => patch({ manualCharges: v === "manual" })}
                    options={[
                      { value: "manual", label: "Manual" },
                      { value: "auto", label: "Auto-calculate" },
                    ]}
                  />
                )}
              </Field>

              {draft.manualCharges ? (
                <>
                  <div className={`mt-4 grid gap-4 ${isMtfSeg ? "sm:grid-cols-2" : ""}`}>
                    <Field
                      label="Charges"
                      hint="Brokerage + statutory (STT, exchange, GST, stamp, DP)."
                    >
                      {(fid) => (
                        <Input
                          id={fid}
                          type="number"
                          min="0"
                          step="any"
                          inputMode="decimal"
                          value={draft.manualChargeAmount}
                          onChange={(e) => patch({ manualChargeAmount: e.target.value })}
                          placeholder="0.00"
                        />
                      )}
                    </Field>
                    {isMtfSeg && (
                      <Field
                        label="MTF interest"
                        hint="Margin interest from your Groww statement."
                      >
                        {(fid) => (
                          <div className="relative">
                            <Input
                              id={fid}
                              type="number"
                              min="0"
                              step="any"
                              inputMode="decimal"
                              value={draft.manualMtfInterest}
                              onChange={(e) => patch({ manualMtfInterest: e.target.value })}
                              placeholder="0.00"
                              className="pr-12"
                            />
                            <span
                              aria-hidden
                              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-warning/70"
                            >
                              MTF
                            </span>
                          </div>
                        )}
                      </Field>
                    )}
                  </div>
                  <p className="mt-2 text-[11px] text-faint">
                    {isMtfSeg ? (
                      <>
                        Charges {formatMoney(num(draft.manualChargeAmount), { currency, decimals: true })} +
                        MTF interest{" "}
                        <span className="text-warning">
                          {formatMoney(num(draft.manualMtfInterest), { currency, decimals: true })}
                        </span>{" "}
                        ={" "}
                        <span className="text-ink">
                          {formatMoney(calc.charges.total, { currency, decimals: true })}
                        </span>{" "}
                        deducted from gross P&L.
                      </>
                    ) : (
                      <>
                        {formatMoney(calc.charges.total, { currency, decimals: true })} deducted from gross
                        P&L.
                      </>
                    )}
                  </p>
                </>
              ) : (
                <div className="mt-4 space-y-3">
                  <div className="overflow-hidden rounded-[10px] border border-edge-soft bg-raised/40">
                    <div className="flex items-center justify-between px-3 pt-2.5">
                      <span className="label-caps">Live charge breakdown</span>
                      <span className="text-[11px] text-faint">
                        {calc.segment}
                        {draft.assetClass === "Equity" ? ` · ${draft.exchange}` : ""} · Groww rate card
                      </span>
                    </div>
                    {autoChargeRows.length > 0 ? (
                      <dl className="mt-1.5">
                        {autoChargeRows.map((r) => (
                          <div
                            key={r.label}
                            className="flex items-baseline justify-between px-3 py-1.5 text-[12.5px]"
                          >
                            <dt className="text-muted">{r.label}</dt>
                            <dd className={`tnum ${r.warn ? "text-warning" : "text-ink"}`}>
                              {formatMoney(r.value, { currency, decimals: true })}
                            </dd>
                          </div>
                        ))}
                        <div className="flex items-baseline justify-between border-t border-edge-soft bg-warning-soft/40 px-3 py-2 text-[13px]">
                          <dt className="font-semibold text-warning">Total charges</dt>
                          <dd className="tnum font-semibold text-warning">
                            {formatMoney(calc.charges.total, { currency, decimals: true })}
                          </dd>
                        </div>
                      </dl>
                    ) : (
                      <p className="px-3 py-3 text-[12px] text-faint">
                        Enter quantity and entry price to see the itemised charges.
                      </p>
                    )}
                  </div>

                  {isMtfSeg && (
                    <Field
                      label="MTF interest"
                      hint="Auto charges above are delivery-style — add the margin interest from your Groww statement."
                    >
                      {(fid) => (
                        <div className="relative">
                          <Input
                            id={fid}
                            type="number"
                            min="0"
                            step="any"
                            inputMode="decimal"
                            value={draft.manualMtfInterest}
                            onChange={(e) => patch({ manualMtfInterest: e.target.value })}
                            placeholder="0.00"
                            className="pr-12"
                          />
                          <span
                            aria-hidden
                            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-warning/70"
                          >
                            MTF
                          </span>
                        </div>
                      )}
                    </Field>
                  )}

                  <div className="flex items-start gap-2 rounded-[10px] bg-info-soft p-3 text-[12px] leading-relaxed text-info">
                    <Info size={14} className="mt-0.5 shrink-0" aria-hidden />
                    <span>
                      Auto-computed from your Groww rate card in Settings. STT/CTT, DP charges, MTF pledge
                      and interest aren’t tax-deductible for capital-gains trades — the tax box reflects that.
                    </span>
                  </div>
                </div>
              )}
            </Card>

            {/* 4 · Strategy & context */}
            <Card title="Strategy & context" subtitle="Setup, market state and tags">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Strategy">
                  {(fid) => (
                    <div className="space-y-2">
                      <Select
                        id={fid}
                        value={draft.useCustomStrategy ? CUSTOM_STRATEGY : draft.strategy}
                        onChange={(e) =>
                          e.target.value === CUSTOM_STRATEGY
                            ? patch({ useCustomStrategy: true })
                            : patch({ useCustomStrategy: false, strategy: e.target.value })
                        }
                      >
                        {strategies.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                        <option value={CUSTOM_STRATEGY}>Custom…</option>
                      </Select>
                      {draft.useCustomStrategy && (
                        <Input
                          value={draft.customStrategy}
                          onChange={(e) => patch({ customStrategy: e.target.value })}
                          placeholder="Name your setup"
                          aria-label="Custom strategy name"
                        />
                      )}
                    </div>
                  )}
                </Field>
                <Field label="Market condition">
                  {(fid) => (
                    <Select
                      id={fid}
                      value={draft.marketCondition}
                      onChange={(e) => patch({ marketCondition: e.target.value as MarketCondition })}
                    >
                      {MARKET_CONDITIONS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label="Timeframe">
                  {(fid) => (
                    <Select
                      id={fid}
                      value={draft.timeframe}
                      onChange={(e) => patch({ timeframe: e.target.value as Timeframe })}
                    >
                      {TIMEFRAMES.map((tf) => (
                        <option key={tf} value={tf}>
                          {tf}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field
                  label="Tags"
                  hint="Press Enter to add a tag"
                  className="sm:col-span-2 lg:col-span-3"
                >
                  {(fid) => (
                    <TagInput
                      id={fid}
                      tags={draft.tags}
                      suggestions={tagSuggestions}
                      onChange={(tags) => patch({ tags })}
                    />
                  )}
                </Field>
              </div>
            </Card>

            {/* 5 · Psychology */}
            <Card title="Psychology" subtitle="How you felt going in">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Emotional state" hint="1 = tilted · 5 = calm and focused">
                  {() => (
                    <RatingRow
                      label="Emotional state"
                      value={draft.emotionRating}
                      onChange={(emotionRating) => patch({ emotionRating })}
                    />
                  )}
                </Field>
                <Field label="Confidence" hint="1 = low conviction · 5 = high conviction">
                  {() => (
                    <RatingRow
                      label="Confidence"
                      value={draft.confidenceRating}
                      onChange={(confidenceRating) => patch({ confidenceRating })}
                    />
                  )}
                </Field>
              </div>
            </Card>

            {/* 6 · Notes */}
            <Card title="Notes & review" subtitle="What happened, what to fix, what to keep">
              <div className="space-y-4">
                <Field label="Trade notes">
                  {(fid) => (
                    <Textarea
                      id={fid}
                      value={draft.notes}
                      onChange={(e) => patch({ notes: e.target.value })}
                      placeholder="Setup, trigger, management — how the trade unfolded…"
                    />
                  )}
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Mistakes">
                    {(fid) => (
                      <Textarea
                        id={fid}
                        value={draft.mistakes}
                        onChange={(e) => patch({ mistakes: e.target.value })}
                        placeholder="What went wrong, if anything?"
                      />
                    )}
                  </Field>
                  <Field label="Lessons">
                    {(fid) => (
                      <Textarea
                        id={fid}
                        value={draft.lessons}
                        onChange={(e) => patch({ lessons: e.target.value })}
                        placeholder="What will you repeat or avoid next time?"
                      />
                    )}
                  </Field>
                </div>
              </div>
            </Card>

            {/* 7 · Screenshot */}
            <Card title="Screenshot" subtitle="Attach a chart snapshot for later review">
              {shotUploading ? (
                <div className="flex items-center gap-2 rounded-[10px] border border-edge bg-raised px-3 py-6 text-[13px] text-muted">
                  <Loader2 size={15} className="animate-spin" aria-hidden />
                  Converting to WebP &amp; uploading…
                </div>
              ) : draft.screenshotUrl ? (
                <div className="space-y-3">
                  <div className="overflow-hidden rounded-[10px] border border-edge bg-raised">
                    {shot.loading ? (
                      <div className="flex h-40 items-center justify-center text-faint">
                        <Loader2 size={16} className="animate-spin" aria-hidden />
                      </div>
                    ) : shot.src ? (
                      <img
                        src={shot.src}
                        alt="Trade screenshot preview"
                        className="max-h-72 w-full object-contain"
                      />
                    ) : (
                      <div className="flex h-40 items-center justify-center text-[12px] text-faint">
                        Couldn’t load image
                      </div>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    icon={Trash2}
                    onClick={() => patch({ screenshotUrl: "" })}
                  >
                    Remove screenshot
                  </Button>
                </div>
              ) : (
                <Field label="Chart image" hint="PNG or JPG — converted to WebP and stored in the cloud">
                  {(fid) => (
                    <div className="flex items-center gap-3 rounded-[10px] border border-dashed border-edge bg-raised px-3 py-3">
                      <ImagePlus size={16} className="shrink-0 text-faint" aria-hidden />
                      <input
                        id={fid}
                        type="file"
                        accept="image/*"
                        onChange={handleFile}
                        className="block w-full cursor-pointer text-[12px] text-muted file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-surface file:px-3 file:py-1.5 file:text-[12px] file:font-medium file:text-ink hover:file:bg-base"
                      />
                    </div>
                  )}
                </Field>
              )}
            </Card>

            {/* bottom actions (handy on mobile after a long scroll) */}
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" icon={Save}>
                {editing ? "Save changes" : "Save trade"}
              </Button>
            </div>
          </div>

          {/* --------------------------- live summary --------------------------- */}
          <div className="xl:sticky xl:top-20">
            <SummaryPanel
              symbol={draft.symbol}
              direction={draft.direction}
              status={draft.status}
              assetClass={draft.assetClass}
              currency={currency}
              accountName={account ? `${account.name} · ${account.broker}` : undefined}
              calc={calc}
            />
          </div>
        </div>
      </form>
    </div>
  );
}
