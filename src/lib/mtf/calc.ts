/** MTF Interest Tracker — ALL pure math (spec §5, §8, §11, §16).
 *  Interest accrues from the purchase day INCLUSIVE: interestDays = holdingDays + 1,
 *  so a position bought today already carries one day of interest (conservative).
 *  Closed positions never compute live — they read the frozen final* snapshot. */

import { addDays, differenceInCalendarDays, format, startOfDay } from "date-fns";
import type {
  ComputedLot,
  ComputedPosition,
  DayPoint,
  MtfAlert,
  MtfBroker,
  MtfCharges,
  MtfForecast,
  MtfHealthLevel,
  MtfLot,
  MtfPosition,
  PortfolioStats,
} from "./types";

const r2 = (n: number) => Math.round(n * 100) / 100;

/** "0.041%/day ≈ 14.97% p.a." — the live hint next to the rate field. */
export const annualizedPct = (dailyRatePct: number) => r2(dailyRatePct * 365);

export interface LiveInterestPoint {
  date: string; // ISO
  interest: number;
}

/** Interest a SINGLE position has accrued by `day`, computed PER LOT — each buy
 *  tranche accrues from its OWN date (inclusive), so a lot added later is only
 *  charged from the day it landed. Closed positions freeze at their exit date.
 *  Equals cp.accumulatedInterest at `today` (open) / finalInterest (closed). */
export function interestAccruedOn(cp: ComputedPosition, day: Date): number {
  const dayMs = startOfDay(day).getTime();
  const exitMs =
    cp.isClosed && cp.pos.exitDate ? startOfDay(new Date(cp.pos.exitDate)).getTime() : Infinity;
  const effectiveMs = Math.min(dayMs, exitMs);
  let sum = 0;
  let started = false;
  for (const lot of cp.lots) {
    const lotMs = startOfDay(new Date(lot.date)).getTime();
    if (effectiveMs < lotMs) continue; // this tranche not bought yet on `day`
    started = true;
    const days = differenceInCalendarDays(new Date(effectiveMs), new Date(lotMs)) + 1;
    sum += lot.dailyInterest * days;
  }
  return started ? r2(sum + (cp.pos.manualInterestAdj ?? 0)) : 0;
}

/** Interest carried by the LIVE (still-open) book on `day` — each position open
 *  on that day contributes its per-lot accrued interest; a position closed
 *  on/before `day` drops to 0 (it left the book). */
export function openInterestCarriedOn(computed: ComputedPosition[], day: Date): number {
  const dayMs = startOfDay(day).getTime();
  return r2(
    computed.reduce((acc, cp) => {
      if (
        cp.isClosed &&
        cp.pos.exitDate &&
        dayMs >= startOfDay(new Date(cp.pos.exitDate)).getTime()
      ) {
        return acc; // sold → off the live book
      }
      return acc + interestAccruedOn(cp, day);
    }, 0),
  );
}

/** Cumulative interest paid across ALL positions by `day` — closed positions
 *  plateau at their frozen final interest (kept, never removed). */
export function cumulativeInterestOn(computed: ComputedPosition[], day: Date): number {
  return r2(computed.reduce((acc, cp) => acc + interestAccruedOn(cp, day), 0));
}

/** Sample `valueAt` from the earliest buy → `today` at ≤ maxPoints points. */
function interestSeries(
  computed: ComputedPosition[],
  today: Date,
  valueAt: (day: Date) => number,
  maxPoints: number,
): LiveInterestPoint[] {
  if (computed.length === 0) return [];
  const end = startOfDay(today);
  const earliest = computed
    .map((cp) => startOfDay(new Date(cp.pos.purchaseDate)))
    .reduce((a, b) => (b.getTime() < a.getTime() ? b : a));
  const totalDays = Math.max(0, differenceInCalendarDays(end, earliest));
  const step = Math.max(1, Math.ceil((totalDays + 1) / maxPoints));
  const points: LiveInterestPoint[] = [];
  let last = -1;
  for (let i = 0; i <= totalDays; i += step) {
    const day = addDays(earliest, i);
    points.push({ date: day.toISOString(), interest: valueAt(day) });
    last = i;
  }
  if (last !== totalDays) points.push({ date: end.toISOString(), interest: valueAt(end) });
  return points;
}

/** Time series of interest carried by the live (open) book — falls on each sell. */
export function liveOpenInterestSeries(
  computed: ComputedPosition[],
  today: Date,
  maxPoints = 90,
): LiveInterestPoint[] {
  return interestSeries(computed, today, (d) => openInterestCarriedOn(computed, d), maxPoints);
}

/** Time series of cumulative interest paid across all positions (monotonic). */
export function portfolioInterestTrendSeries(
  computed: ComputedPosition[],
  today: Date,
  maxPoints = 90,
): LiveInterestPoint[] {
  return interestSeries(computed, today, (d) => cumulativeInterestOn(computed, d), maxPoints);
}

/** Round-trip charges: the manual total wins over the itemized sum (spec §2.6). */
export function chargesTotal(c: MtfCharges): number {
  if (c.manualTotal !== undefined && c.manualTotal !== null) return r2(c.manualTotal);
  return r2(
    (c.brokerage ?? 0) +
      (c.stt ?? 0) +
      (c.exchangeTxn ?? 0) +
      (c.gst ?? 0) +
      (c.sebi ?? 0) +
      (c.stampDuty ?? 0) +
      (c.dp ?? 0) +
      (c.other ?? 0),
  );
}

/** Buy tranches, sorted by date. Lot-less positions become ONE synthetic lot
 *  from the flat fields, so every consumer sees the same shape. */
export function normalizeLots(pos: MtfPosition): MtfLot[] {
  if (pos.lots && pos.lots.length > 0) {
    return [...pos.lots].sort((a, b) => a.date.localeCompare(b.date));
  }
  return [
    {
      id: "L1",
      date: pos.purchaseDate,
      quantity: pos.quantity,
      // preserve a manual investment override by folding it into the lot price
      price: pos.quantity > 0 && pos.totalInvestment > 0 ? pos.totalInvestment / pos.quantity : pos.avgBuyPrice,
    },
  ];
}

/** Per-lot derivation: interest accrues from EACH lot's own date (inclusive). */
function computeLots(
  lots: MtfLot[],
  ratePct: number,
  basis: MtfPosition["interestBasis"],
  fundedPercent: number,
  asOf: Date,
): ComputedLot[] {
  return lots.map((lot) => {
    const invested = lot.quantity * lot.price;
    const base = basis === "funded" ? (invested * fundedPercent) / 100 : invested;
    const dailyInterest = r2((base * ratePct) / 100);
    const holdingDays = Math.max(
      0,
      differenceInCalendarDays(startOfDay(asOf), startOfDay(new Date(lot.date))),
    );
    const interestDays = holdingDays + 1;
    return {
      id: lot.id,
      date: lot.date,
      quantity: lot.quantity,
      price: lot.price,
      invested: r2(invested),
      base: r2(base),
      dailyInterest,
      holdingDays,
      interestDays,
      accumulatedInterest: r2(dailyInterest * interestDays),
    };
  });
}

export function healthLevel(healthPct: number): MtfHealthLevel {
  if (!Number.isFinite(healthPct)) return "red"; // grossProfit ≤ 0
  if (healthPct < 5) return "green";
  if (healthPct < 15) return "blue";
  if (healthPct < 30) return "yellow";
  if (healthPct < 50) return "orange";
  return "red";
}

/** Derive everything for one position. `asOf` = today (startOfDay of real now).
 *  Interest is PER LOT — each buy tranche accrues from its own date (inclusive). */
export function computePosition(
  pos: MtfPosition,
  brokers: MtfBroker[],
  asOf: Date,
): ComputedPosition {
  const broker = brokers.find((b) => b.id === pos.brokerId);
  const isClosed = pos.status === "Closed";
  const rawLots = normalizeLots(pos);
  // lots accrue to today when open, to the exit date when closed
  const lotAsOf = isClosed && pos.exitDate ? new Date(pos.exitDate) : asOf;
  const lots = computeLots(rawLots, pos.dailyRatePct, pos.interestBasis, pos.fundedPercent, lotAsOf);
  const isMultiLot = lots.length > 1;

  const qty = lots.reduce((s, l) => s + l.quantity, 0);
  const I = lots.reduce((s, l) => s + l.invested, 0);
  const avgBuy = qty > 0 ? I / qty : pos.avgBuyPrice;
  const interestBase = lots.reduce((s, l) => s + l.base, 0);
  const dailyInterest = r2(lots.reduce((s, l) => s + l.dailyInterest, 0));

  // ── Closed: read the frozen snapshot, compute nothing live ─────────────
  if (isClosed) {
    const holdingDays = pos.finalHoldingDays ?? 0;
    const interestDays = holdingDays + 1;
    const accumulatedInterest = pos.finalInterest ?? 0;
    const totalCharges = pos.finalCharges ?? chargesTotal(pos.charges);
    const exitPrice = pos.exitPrice ?? avgBuy;
    const currentValue = r2(exitPrice * qty);
    const grossProfit = pos.finalGrossProfit ?? r2(currentValue - I);
    const netProfit = pos.finalNetProfit ?? r2(grossProfit - accumulatedInterest - totalCharges);
    const breakEvenPrice =
      pos.finalBreakEvenPrice ?? (qty > 0 ? r2((I + accumulatedInterest + totalCharges) / qty) : 0);
    const healthPct = grossProfit > 0 ? (accumulatedInterest / grossProfit) * 100 : Infinity;
    return {
      pos,
      broker,
      isClosed: true,
      lots,
      isMultiLot,
      totalInvestment: r2(I),
      interestBase: r2(interestBase),
      dailyInterest,
      holdingDays,
      interestDays,
      accumulatedInterest: r2(accumulatedInterest),
      totalCharges: r2(totalCharges),
      currentValue,
      grossProfit: r2(grossProfit),
      profitPct: I > 0 ? r2((grossProfit / I) * 100) : 0,
      netProfit: r2(netProfit),
      netProfitPct: I > 0 ? r2((netProfit / I) * 100) : 0,
      breakEvenPrice,
      breakEvenPct: avgBuy > 0 ? r2(((breakEvenPrice - avgBuy) / avgBuy) * 100) : 0,
      extraPriceNeeded: 0,
      extraProfitNeeded: 0,
      healthPct: Number.isFinite(healthPct) ? r2(healthPct) : Infinity,
      health: healthLevel(healthPct),
    };
  }

  // ── Open: live math (accumulated = Σ per-lot accrual) ───────────────────
  const firstLotDate = lots[0]?.date ?? pos.purchaseDate;
  const holdingDays = Math.max(
    0,
    differenceInCalendarDays(startOfDay(asOf), startOfDay(new Date(firstLotDate))),
  );
  const interestDays = holdingDays + 1; // display: since the FIRST tranche
  const accumulatedInterest = r2(
    lots.reduce((s, l) => s + l.accumulatedInterest, 0) + (pos.manualInterestAdj ?? 0),
  );
  const totalCharges = chargesTotal(pos.charges);

  const currentValue = r2(pos.currentPrice != null ? qty * pos.currentPrice : I);
  const grossProfit = r2(currentValue - I);
  const profitPct = I > 0 ? r2((grossProfit / I) * 100) : 0;
  const netProfit = r2(grossProfit - accumulatedInterest - totalCharges);
  const netProfitPct = I > 0 ? r2((netProfit / I) * 100) : 0;

  const breakEvenPrice = qty > 0 ? r2((I + accumulatedInterest + totalCharges) / qty) : 0;
  const breakEvenPct = avgBuy > 0 ? r2(((breakEvenPrice - avgBuy) / avgBuy) * 100) : 0;
  const refPrice = pos.currentPrice ?? avgBuy;
  const extraPriceNeeded = r2(Math.max(0, breakEvenPrice - refPrice));
  const extraProfitNeeded = r2(Math.max(0, accumulatedInterest + totalCharges - grossProfit));

  const healthPct = grossProfit > 0 ? (accumulatedInterest / grossProfit) * 100 : Infinity;

  return {
    pos,
    broker,
    isClosed: false,
    lots,
    isMultiLot,
    totalInvestment: r2(I),
    interestBase: r2(interestBase),
    dailyInterest,
    holdingDays,
    interestDays,
    accumulatedInterest,
    totalCharges,
    currentValue,
    grossProfit,
    profitPct,
    netProfit,
    netProfitPct,
    breakEvenPrice,
    breakEvenPct,
    extraPriceNeeded,
    extraProfitNeeded,
    healthPct: Number.isFinite(healthPct) ? r2(healthPct) : Infinity,
    health: healthLevel(healthPct),
  };
}

/** Day-by-day series from the FIRST lot's date through today (plus optional
 *  future days) — piecewise across lots: capital, quantity and the interest
 *  slope all step up on the day each tranche lands. Downsampled to ≤ maxPoints
 *  (kink days — lot dates — and the last day are always kept). */
export function buildDaySeries(
  cp: ComputedPosition,
  opts: { futureDays?: number; maxPoints?: number } = {},
): DayPoint[] {
  const { futureDays = 0, maxPoints = 60 } = opts;
  const qtyTotal = cp.lots.reduce((s, l) => s + l.quantity, 0);
  if (qtyTotal <= 0 || cp.lots.length === 0) return [];

  const first = startOfDay(new Date(cp.lots[0].date));
  const lastDay = cp.holdingDays + futureDays;

  // offsets of each lot from the first lot's day (kinks to always keep)
  const lotOffsets = cp.lots.map((l) =>
    Math.max(0, differenceInCalendarDays(startOfDay(new Date(l.date)), first)),
  );

  const step = Math.max(1, Math.ceil((lastDay + 1) / maxPoints));
  const keep = new Set<number>([0, lastDay, cp.holdingDays, ...lotOffsets]);
  for (let i = 0; i <= lastDay; i += step) keep.add(i);
  const days = [...keep].filter((d) => d >= 0 && d <= lastDay).sort((a, b) => a - b);

  return days.map((dayIndex) => {
    let invested = 0;
    let quantity = 0;
    let cumInterest = 0;
    cp.lots.forEach((lot, li) => {
      const offset = lotOffsets[li];
      if (offset <= dayIndex) {
        invested += lot.invested;
        quantity += lot.quantity;
        cumInterest += lot.dailyInterest * (dayIndex - offset + 1); // lot's own day inclusive
      }
    });
    cumInterest = r2(cumInterest + (cp.pos.manualInterestAdj ?? 0));
    return {
      dayIndex,
      date: format(addDays(first, dayIndex), "yyyy-MM-dd"),
      invested: r2(invested),
      quantity,
      cumInterest,
      breakEven: quantity > 0 ? r2((invested + cumInterest + cp.totalCharges) / quantity) : 0,
    };
  });
}

/** Forecast N extra days ahead at an assumed exit price (spec §5-forecast). */
export function forecastPosition(
  cp: ComputedPosition,
  extraDays: number,
  assumedExitPrice?: number,
): MtfForecast {
  const P = assumedExitPrice ?? cp.pos.currentPrice ?? cp.pos.avgBuyPrice;
  const addlInterest = r2(cp.dailyInterest * extraDays);
  const futureTotalInterest = r2(cp.accumulatedInterest + addlInterest);
  const futureBreakEven =
    cp.pos.quantity > 0
      ? r2((cp.totalInvestment + futureTotalInterest + cp.totalCharges) / cp.pos.quantity)
      : 0;
  const futureGross = r2(P * cp.pos.quantity - cp.totalInvestment);
  const futureNetProfit = r2(futureGross - futureTotalInterest - cp.totalCharges);
  return {
    extraDays,
    assumedExitPrice: P,
    addlInterest,
    futureTotalInterest,
    futureBreakEven,
    futureGross,
    futureNetProfit,
    minSellingPrice: futureBreakEven,
    expectedReturnPct:
      cp.totalInvestment > 0 ? r2((futureNetProfit / cp.totalInvestment) * 100) : 0,
  };
}

/** The frozen snapshot written onto a position when it is closed (spec §8). */
export function buildCloseSnapshot(
  pos: MtfPosition,
  exitPrice: number,
  exitDateISO: string,
): Pick<
  MtfPosition,
  | "status" | "exitDate" | "exitPrice" | "finalHoldingDays" | "finalInterest"
  | "finalCharges" | "finalGrossProfit" | "finalNetProfit" | "finalBreakEvenPrice"
> {
  // per-lot accrual to the exit date — each tranche charged from its own day
  const lots = computeLots(
    normalizeLots(pos),
    pos.dailyRatePct,
    pos.interestBasis,
    pos.fundedPercent,
    new Date(exitDateISO),
  );
  const qty = lots.reduce((s, l) => s + l.quantity, 0);
  const I = lots.reduce((s, l) => s + l.invested, 0);
  const firstLotDate = lots[0]?.date ?? pos.purchaseDate;
  const finalHoldingDays = Math.max(
    0,
    differenceInCalendarDays(startOfDay(new Date(exitDateISO)), startOfDay(new Date(firstLotDate))),
  );
  const finalInterest = r2(
    lots.reduce((s, l) => s + l.accumulatedInterest, 0) + (pos.manualInterestAdj ?? 0),
  );
  const finalCharges = chargesTotal(pos.charges);
  const finalGrossProfit = r2(exitPrice * qty - I);
  const finalNetProfit = r2(finalGrossProfit - finalInterest - finalCharges);
  const finalBreakEvenPrice = qty > 0 ? r2((I + finalInterest + finalCharges) / qty) : 0;
  return {
    status: "Closed",
    exitDate: exitDateISO,
    exitPrice,
    finalHoldingDays,
    finalInterest,
    finalCharges,
    finalGrossProfit,
    finalNetProfit,
    finalBreakEvenPrice,
  };
}

const sum = (ns: number[]) => ns.reduce((a, b) => a + b, 0);
const mean = (ns: number[]) => (ns.length ? sum(ns) / ns.length : 0);
const argmax = <T,>(xs: T[], f: (x: T) => number): T | null =>
  xs.length ? xs.reduce((a, b) => (f(b) > f(a) ? b : a)) : null;
const argmin = <T,>(xs: T[], f: (x: T) => number): T | null =>
  xs.length ? xs.reduce((a, b) => (f(b) < f(a) ? b : a)) : null;

/** Portfolio aggregates over an (already filtered) set of positions (spec §5). */
export function computePortfolio(
  positions: MtfPosition[],
  brokers: MtfBroker[],
  asOf: Date,
): PortfolioStats {
  const all = positions.map((p) => computePosition(p, brokers, asOf));
  const open = all.filter((c) => !c.isClosed);
  const closed = all.filter((c) => c.isClosed);

  const todaysInterest = r2(sum(open.map((c) => c.dailyInterest)));
  const lifetimeInterest = r2(
    sum(open.map((c) => c.accumulatedInterest)) + sum(closed.map((c) => c.accumulatedInterest)),
  );

  return {
    open,
    closed,
    activeCount: open.length,
    closedCount: closed.length,
    totalCapitalInvested: r2(sum(open.map((c) => c.totalInvestment))),
    currentPortfolioValue: r2(sum(open.map((c) => c.currentValue))),
    grossUnrealized: r2(sum(open.map((c) => c.grossProfit))),
    openInterest: r2(sum(open.map((c) => c.accumulatedInterest))),
    openCharges: r2(sum(open.map((c) => c.totalCharges))),
    openNetProfit: r2(sum(open.map((c) => c.netProfit))),
    todaysInterest,
    yesterdaysInterest: r2(sum(open.filter((c) => c.holdingDays >= 1).map((c) => c.dailyInterest))),
    weeklyInterest: r2(sum(open.map((c) => c.dailyInterest * Math.min(c.interestDays, 7)))),
    monthlyInterest: r2(sum(open.map((c) => c.dailyInterest * Math.min(c.interestDays, 30)))),
    lifetimeInterest,
    totalInterestPaid: lifetimeInterest,
    totalCharges: r2(sum(all.map((c) => c.totalCharges))),
    netPortfolioProfit: r2(sum(all.map((c) => c.netProfit))),
    avgDailyCost: todaysInterest,
    avgDailyInterest: r2(mean(open.map((c) => c.dailyInterest))),
    avgHoldingDays: r2(mean(open.map((c) => c.holdingDays))),
    avgPositionSize: r2(mean(open.map((c) => c.totalInvestment))),
    avgInterestPerPosition: r2(mean(open.map((c) => c.accumulatedInterest))),
    highestInterestPosition: argmax(open, (c) => c.accumulatedInterest),
    longestHolding: argmax(open, (c) => c.holdingDays),
    mostExpensiveHolding: argmax(open, (c) => c.totalInvestment),
    cheapestHolding: argmin(open, (c) => c.totalInvestment),
    highestProfitStock: argmax(all, (c) => c.netProfit),
    highestLossStock: argmin(all, (c) => c.netProfit),
    newestPosition: argmax(open, (c) => new Date(c.pos.purchaseDate).getTime()),
    estTomorrow: todaysInterest,
    est7d: r2(todaysInterest * 7),
    est30d: r2(todaysInterest * 30),
    est90d: r2(todaysInterest * 90),
  };
}

/** Intelligent warnings for one OPEN position (spec §11). Highest tier only per rule. */
export function computeAlerts(cp: ComputedPosition): MtfAlert[] {
  if (cp.isClosed) return [];
  const alerts: MtfAlert[] = [];
  const base = { positionId: cp.pos.id, symbol: cp.pos.symbol };

  // accumulated interest thresholds — escalating, highest tier only
  if (cp.accumulatedInterest > 1000) {
    alerts.push({ ...base, severity: "loss", title: "Interest above ₹1,000", detail: `Accumulated interest is ₹${cp.accumulatedInterest.toFixed(0)} and growing daily.` });
  } else if (cp.accumulatedInterest > 500) {
    alerts.push({ ...base, severity: "warning", title: "Interest above ₹500", detail: `Accumulated interest is ₹${cp.accumulatedInterest.toFixed(0)}.` });
  } else if (cp.accumulatedInterest > 100) {
    alerts.push({ ...base, severity: "info", title: "Interest above ₹100", detail: `Accumulated interest is ₹${cp.accumulatedInterest.toFixed(0)}.` });
  }

  // holding duration — escalating
  if (cp.holdingDays > 90) {
    alerts.push({ ...base, severity: "loss", title: "Held over 90 days", detail: `${cp.holdingDays} days of financing on this position.` });
  } else if (cp.holdingDays > 60) {
    alerts.push({ ...base, severity: "warning", title: "Held over 60 days", detail: `${cp.holdingDays} days and counting.` });
  } else if (cp.holdingDays > 30) {
    alerts.push({ ...base, severity: "info", title: "Held over 30 days", detail: `${cp.holdingDays} days on margin.` });
  }

  // interest as share of gross profit
  if (Number.isFinite(cp.healthPct)) {
    if (cp.healthPct > 50) {
      alerts.push({ ...base, severity: "loss", title: "Interest > 50% of profit", detail: `Financing has consumed ${cp.healthPct.toFixed(0)}% of the gross profit.` });
    } else if (cp.healthPct > 25) {
      alerts.push({ ...base, severity: "warning", title: "Interest > 25% of profit", detail: `Financing is eating ${cp.healthPct.toFixed(0)}% of the gross profit.` });
    }
  }

  // net turned negative
  if (cp.netProfit < 0 && cp.grossProfit > 0) {
    alerts.push({ ...base, severity: "loss", title: "Interest ate your profit", detail: `Gross is +₹${cp.grossProfit.toFixed(0)} but net is ₹${cp.netProfit.toFixed(0)} after interest & charges.` });
  } else if (cp.netProfit < 0) {
    alerts.push({ ...base, severity: "loss", title: "Net profit is negative", detail: `Position is ₹${Math.abs(cp.netProfit).toFixed(0)} under water after all costs.` });
  }

  // almost break-even
  if (
    cp.pos.currentPrice != null &&
    cp.netProfit < 0 &&
    cp.pos.currentPrice > 0 &&
    (Math.abs(cp.breakEvenPrice - cp.pos.currentPrice) / cp.pos.currentPrice) * 100 <= 1
  ) {
    alerts.push({ ...base, severity: "info", title: "Almost at break-even", detail: `Break-even ₹${cp.breakEvenPrice.toFixed(2)} is within 1% of the current price.` });
  }

  return alerts;
}

/** Live-price seam (spec §14) — inert stub; a real API drops in here later. */
export async function fetchPrice(_symbol: string): Promise<number | null> {
  return null;
}
