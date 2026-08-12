/** Charges, tax and P&L math — single source of truth for the generator,
 *  the store and the Add/Edit Trade form's live calculator. */

import type {
  AssetClass,
  ChargeRates,
  ChargesBreakdown,
  Direction,
  Exchange,
  TaxCategory,
  TaxInfo,
  TaxRates,
  TradeSegment,
} from "@/types";

export const DEFAULT_CHARGE_RATES: ChargeRates = {
  brokerageFlatPerOrder: 20,
  brokeragePctPerOrder: 0.1, // Groww: ₹20 or 0.1% whichever lower (delivery/intraday); flat 0.1% for MTF
  minBrokeragePerOrder: 5, // Groww ₹5 min per order (since Jun 2025)
  mtfInterestAnnualPct: 14.95, // Groww MTF interest 14.95% p.a. (0.041%/day) on the funded amount
  sttIntradayPct: 0.025,
  sttDeliveryPct: 0.1,
  sttEtfDeliveryPct: 0.001, // equity/index ETF — 0.001% on sell only (₹1/lakh); nil on buy
  sttOptionsPct: 0.1,
  sttFuturesPct: 0.02,
  exchangeEquityPct: 0.00297, // NSE cash equity — ₹2.97/lakh
  exchangeEquityBsePct: 0.00375, // BSE cash equity (Group A/B) — ₹3.75/lakh
  exchangeOptionsPct: 0.03503,
  exchangeFuturesPct: 0.00173,
  exchangeCommodityPct: 0.0026,
  exchangeForexPct: 0.0009,
  cryptoFeePct: 0.2,
  sebiPct: 0.0001,
  stampDeliveryPct: 0.015,
  stampIntradayPct: 0.003,
  stampOptionsPct: 0.003,
  stampFuturesPct: 0.002,
  gstPct: 18,
  dpChargePerSell: 20, // Groww ₹20/sell (₹16.50 Groww + ₹3.50 CDSL), delivery/MTF only
  pledgeChargePerRequest: 20, // Groww MTF pledge/unpledge ₹20 + GST per ISIN per request
};

export const DEFAULT_TAX_RATES: TaxRates = {
  intradayPct: 30,
  stcgPct: 20,
  ltcgPct: 12.5,
  cryptoPct: 30,
  basicExemption: 400000,
  ltcgExemption: 125000,
  rebate87ALimit: 1200000,
  rebate87AMax: 60000,
  cessPct: 4,
};

const r2 = (n: number) => Math.round(n * 100) / 100;

export interface ChargesInput {
  assetClass: AssetClass;
  /** broker product/segment — drives the brokerage formula (and equity STT/stamp/DP).
   *  Defaults from assetClass when omitted (Equity→Delivery, Options/Futures→FnO). */
  segment?: TradeSegment;
  /** exchange — switches the equity exchange txn charge NSE↔BSE (defaults NSE) */
  exchange?: Exchange;
  quantity: number;
  entryPrice: number;
  exitPrice?: number; // undefined for open trades → only the entry leg
  /** Long: entry=buy, exit=sell · Short: entry=sell, exit=buy (defaults Long) */
  direction?: Direction;
  rates: ChargeRates;
  /** manually-entered MTF/margin interest to fold into the total (MTF only) */
  mtfInterest?: number;
}

/** Best-effort segment when a caller doesn't specify one (legacy / imports). */
export function defaultSegmentFor(assetClass: AssetClass, intraday = false): TradeSegment {
  if (assetClass === "Equity") return intraday ? "Intraday" : "Delivery";
  if (assetClass === "Options" || assetClass === "Futures") return "FnO";
  return "Other";
}

/** Itemised Indian brokerage/statutory charges for a round trip (or entry leg only). */
export function computeCharges(input: ChargesInput): ChargesBreakdown {
  const { assetClass, quantity, entryPrice, exitPrice, rates, direction = "Long" } = input;
  const segment = input.segment ?? defaultSegmentFor(assetClass);
  // equity intraday treatment is now explicit via the segment
  const intraday = segment === "Intraday";
  // legs by time: entry always executed, exit only if closed
  const entryValue = entryPrice * quantity;
  const exitValue = (exitPrice ?? 0) * quantity;
  const turnover = entryValue + exitValue;
  const legs = exitPrice !== undefined ? 2 : 1;
  // STT is sell-side, stamp duty is buy-side — which leg is buy vs sell flips for shorts
  const buyValue = direction === "Short" ? exitValue : entryValue;
  const sellValue = direction === "Short" ? entryValue : exitValue;

  const pct = (v: number, p: number) => (v * p) / 100;
  const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

  // ── brokerage per segment (Groww schedule) ──
  //  Delivery / Intraday: ₹20 or 0.1% whichever lower, min ₹5 · MTF: flat 0.1%, min ₹5, no cap
  //  F&O (Options/Futures): flat ₹20/leg · Crypto: none (fee in exchangeTxn) · others: min(flat, %)
  const deliveryLeg = (v: number) =>
    clamp(pct(v, rates.brokeragePctPerOrder), rates.minBrokeragePerOrder, rates.brokerageFlatPerOrder);
  const mtfLeg = (v: number) => Math.max(rates.minBrokeragePerOrder, pct(v, rates.brokeragePctPerOrder));
  const legBrokerage: (v: number) => number =
    assetClass === "Crypto"
      ? () => 0
      : assetClass === "Options" || assetClass === "Futures"
        ? () => rates.brokerageFlatPerOrder
        : assetClass === "Equity"
          ? segment === "MTF"
            ? mtfLeg
            : deliveryLeg
          : (v) => Math.min(rates.brokerageFlatPerOrder, pct(v, rates.brokeragePctPerOrder));
  const brokerage = legBrokerage(entryValue) + (legs === 2 ? legBrokerage(exitValue) : 0);

  let stt = 0;
  let exchangeTxn = 0;
  let stampDuty = 0;
  let dpCharges = 0;

  switch (assetClass) {
    case "Equity": {
      // MTF is a delivery product — same statutory treatment as delivery.
      // ETF (equity/index) is delivery treatment too, EXCEPT STT: nil on the buy,
      // 0.001% on the sell only (vs 0.1% on both legs for ordinary shares).
      // only the exchange transaction charge differs NSE vs BSE
      const equityExchangePct =
        input.exchange === "BSE" ? rates.exchangeEquityBsePct : rates.exchangeEquityPct;
      exchangeTxn = pct(turnover, equityExchangePct);
      if (segment === "Intraday") {
        stt = pct(sellValue, rates.sttIntradayPct);
        stampDuty = pct(buyValue, rates.stampIntradayPct);
      } else if (segment === "ETF") {
        stt = pct(sellValue, rates.sttEtfDeliveryPct); // sell side only — nothing on buy
        stampDuty = pct(buyValue, rates.stampDeliveryPct);
        if (legs === 2) dpCharges = rates.dpChargePerSell;
      } else {
        // Delivery / MTF
        stt = pct(buyValue, rates.sttDeliveryPct) + pct(sellValue, rates.sttDeliveryPct);
        stampDuty = pct(buyValue, rates.stampDeliveryPct);
        if (legs === 2) dpCharges = rates.dpChargePerSell;
      }
      break;
    }
    case "Options":
      exchangeTxn = pct(turnover, rates.exchangeOptionsPct);
      stt = pct(sellValue, rates.sttOptionsPct);
      stampDuty = pct(buyValue, rates.stampOptionsPct);
      break;
    case "Futures":
      exchangeTxn = pct(turnover, rates.exchangeFuturesPct);
      stt = pct(sellValue, rates.sttFuturesPct);
      stampDuty = pct(buyValue, rates.stampFuturesPct);
      break;
    case "Commodity":
      exchangeTxn = pct(turnover, rates.exchangeCommodityPct);
      stt = pct(sellValue, rates.sttFuturesPct); // CTT
      stampDuty = pct(buyValue, rates.stampFuturesPct);
      break;
    case "Forex":
      exchangeTxn = pct(turnover, rates.exchangeForexPct);
      break;
    case "Crypto":
      exchangeTxn = pct(turnover, rates.cryptoFeePct); // exchange trading fee
      stt = pct(sellValue, 1); // 1% TDS on sell, shown as STT/TDS in UI
      break;
  }

  // MTF pledge (buy leg) + unpledge (sell leg) — ₹20/request per executed leg
  const pledgeCharges = segment === "MTF" ? rates.pledgeChargePerRequest * legs : 0;
  // SEBI turnover fee applies to exchange-regulated segments only, not crypto/VDA
  const sebi = assetClass === "Crypto" ? 0 : pct(turnover, rates.sebiPct);
  // GST 18% on brokerage + exchange txn + SEBI + DP + pledge (Groww's GST base)
  const gst = pct(brokerage + exchangeTxn + sebi + dpCharges + pledgeCharges, rates.gstPct);
  // MTF interest is entered manually (segment MTF only) and folded straight into the total
  const mtfInterest = segment === "MTF" ? Math.max(0, r2(input.mtfInterest ?? 0)) : 0;
  const total =
    brokerage + exchangeTxn + stt + sebi + stampDuty + gst + dpCharges + pledgeCharges + mtfInterest;

  return {
    brokerage: r2(brokerage),
    exchangeTxn: r2(exchangeTxn),
    stt: r2(stt),
    sebi: r2(sebi),
    stampDuty: r2(stampDuty),
    gst: r2(gst),
    dpCharges: r2(dpCharges),
    pledgeCharges: r2(pledgeCharges),
    manual: 0,
    mtfInterest,
    total: r2(total),
  };
}

/** Charges that ARE deductible when computing the taxable P&L for a trade's tax
 *  category (the researched Indian position):
 *   - Business income (Intraday/F&O): everything is deductible → net of all costs.
 *   - Capital gains (STCG/LTCG): STT/CTT, DP charges, MTF interest and MTF pledge
 *     charges are NOT deductible; brokerage + exchange + SEBI + stamp + GST + manual are.
 *   - Crypto (§115BBH): nothing but cost of acquisition — no charge is deductible. */
export function deductibleCharges(charges: ChargesBreakdown, category: TaxCategory): number {
  if (category === "Crypto") return 0;
  if (category === "Intraday") return r2(charges.total);
  const nonDeductible =
    charges.stt + charges.dpCharges + charges.mtfInterest + (charges.pledgeCharges ?? 0);
  return r2(charges.total - nonDeductible);
}

/** Taxable P&L base = gross − only the deductible charges for this category.
 *  Equals netPnl for business income; higher (less negative) for capital gains
 *  and crypto where some/all costs are added back. */
export function computeTaxablePnl(
  grossPnl: number,
  charges: ChargesBreakdown,
  category: TaxCategory,
): number {
  return r2(grossPnl - deductibleCharges(charges, category));
}

/** Manually-entered charges split into brokerage+statutory (`manual`) and
 *  MTF/margin interest (`mtfInterest`) — itemised fields stay 0, the total is
 *  their sum. Delivery trades pass mtfInterest = 0. */
export function manualChargesBreakdown(charges: number, mtfInterest = 0): ChargesBreakdown {
  const c = Math.max(0, r2(charges || 0));
  const m = Math.max(0, r2(mtfInterest || 0));
  return {
    brokerage: 0,
    exchangeTxn: 0,
    stt: 0,
    sebi: 0,
    stampDuty: 0,
    gst: 0,
    dpCharges: 0,
    pledgeCharges: 0,
    manual: c,
    mtfInterest: m,
    total: r2(c + m),
  };
}

/** Signed gross P&L for a closed round trip. */
export function computeGrossPnl(
  direction: Direction,
  entryPrice: number,
  exitPrice: number,
  quantity: number,
): number {
  const sign = direction === "Long" ? 1 : -1;
  return r2((exitPrice - entryPrice) * quantity * sign);
}

export function taxCategoryFor(
  assetClass: AssetClass,
  holdingMinutes: number | undefined,
  intraday: boolean,
): TaxCategory {
  if (assetClass === "Crypto") return "Crypto";
  if (assetClass === "Equity" && !intraday) {
    return (holdingMinutes ?? 0) >= 365 * 24 * 60 ? "LTCG" : "STCG";
  }
  // intraday equity + all derivatives/forex/commodity → business income
  return "Intraday";
}

export function computeTax(netPnl: number, category: TaxCategory, rates: TaxRates): TaxInfo {
  const rate =
    category === "Crypto"
      ? rates.cryptoPct
      : category === "LTCG"
        ? rates.ltcgPct
        : category === "STCG"
          ? rates.stcgPct
          : rates.intradayPct;
  const taxableAmount = Math.max(0, r2(netPnl));
  return { category, taxableAmount, rate, estimatedTax: r2((taxableAmount * rate) / 100) };
}

export function computeRMultiple(netPnl: number, riskAmount: number): number | undefined {
  if (!riskAmount || riskAmount <= 0) return undefined;
  return r2(netPnl / riskAmount);
}

export function holdingMinutesBetween(openedAt: string, closedAt: string): number {
  return Math.max(1, Math.round((new Date(closedAt).getTime() - new Date(openedAt).getTime()) / 60000));
}

/** A trade is charged/taxed as intraday when opened & closed the same calendar day. */
export function isIntraday(openedAt: string, closedAt: string | undefined): boolean {
  if (!closedAt) return false;
  return new Date(openedAt).toDateString() === new Date(closedAt).toDateString();
}
