/** Financial-year income-tax estimator for a trader whose ONLY income is trading,
 *  under India's NEW tax regime for FY 2025-26 (AY 2026-27), resident individual.
 *
 *  Sources (verified Jul 2026): Finance Act 2025 slabs & §87A; §111A (STCG 20%),
 *  §112A (LTCG 12.5% over ₹1.25L), §115BBH (VDA 30%). Key rules encoded:
 *   - Business income (intraday equity = speculative, F&O/others = non-speculative)
 *     is taxed at the progressive slab; the ₹4L basic exemption lives in the slab.
 *   - §87A rebate (₹60k, income ≤ ₹12L) applies ONLY to slab tax on business income,
 *     never to STCG/LTCG/crypto (Finance Act 2025). Marginal relief above ₹12L.
 *   - A resident's UNUSED basic exemption (₹4L − business income) offsets STCG first,
 *     then LTCG. Crypto gets no basic-exemption benefit and no loss set-off.
 *   - 4% health & education cess on tax + surcharge. Surcharge only above ₹50L
 *     (rate on special-rate gains capped at 15%).
 *
 *  This is an estimate — no Chapter VI-A deductions, no standard deduction (that is
 *  salary/pension only), assumes resident individual with trading as the sole income.
 */

import type { TaxRates, Trade } from "@/types";

export interface TaxSlab {
  /** upper bound of this band (Infinity for the top band) */
  upTo: number;
  /** marginal rate % applied to income within this band */
  rate: number;
}

/** New regime, FY 2025-26 (AY 2026-27) — statutory, not user-configurable. */
export const NEW_REGIME_SLABS: TaxSlab[] = [
  { upTo: 400000, rate: 0 },
  { upTo: 800000, rate: 5 },
  { upTo: 1200000, rate: 10 },
  { upTo: 1600000, rate: 15 },
  { upTo: 2000000, rate: 20 },
  { upTo: 2400000, rate: 25 },
  { upTo: Infinity, rate: 30 },
];

/** Progressive tax on an amount across the given slabs. */
export function slabTax(income: number, slabs: TaxSlab[] = NEW_REGIME_SLABS): number {
  if (income <= 0) return 0;
  let tax = 0;
  let prev = 0;
  for (const { upTo, rate } of slabs) {
    if (income <= prev) break;
    const band = Math.min(income, upTo) - prev;
    tax += (band * rate) / 100;
    prev = upTo;
  }
  return tax;
}

/** New-regime FY parameters, with fallbacks so trades/settings saved before these
 *  fields existed still compute correctly. */
export interface FyTaxParams {
  basicExemption: number; // 400000
  ltcgAnnualExemption: number; // 125000
  rebateIncomeLimit: number; // 1200000 (total-income threshold for §87A)
  rebateMax: number; // 60000
  cessPct: number; // 4
  stcgPct: number; // 20
  ltcgPct: number; // 12.5
  cryptoPct: number; // 30
  slabs: TaxSlab[];
}

export function paramsFromRates(rates: TaxRates): FyTaxParams {
  return {
    basicExemption: rates.basicExemption ?? 400000,
    ltcgAnnualExemption: rates.ltcgExemption ?? 125000,
    rebateIncomeLimit: rates.rebate87ALimit ?? 1200000,
    rebateMax: rates.rebate87AMax ?? 60000,
    cessPct: rates.cessPct ?? 4,
    stcgPct: rates.stcgPct ?? 20,
    ltcgPct: rates.ltcgPct ?? 12.5,
    cryptoPct: rates.cryptoPct ?? 30,
    slabs: NEW_REGIME_SLABS,
  };
}

export interface FyTaxResult {
  // ── raw aggregates (net P&L per head) ──
  businessPnl: number; // intraday equity + F&O/futures/options/forex/commodity
  stcgPnl: number;
  ltcgPnl: number;
  cryptoPnl: number; // net (for display)

  // ── taxable P&L per head (the base charged; ≥ net for capital gains, where
  //    STT/DP/MTF interest+pledge are added back) — for the add-back display ──
  businessTaxablePnl: number;
  stcgTaxablePnl: number;
  ltcgTaxablePnl: number;

  // ── business income (slab) ──
  businessIncome: number; // max(0, businessPnl)
  slabTaxOnBusiness: number;
  rebate87A: number;
  businessTax: number; // slab tax after rebate

  // ── basic-exemption adjustment against gains ──
  basicExemptionUnused: number; // 4L − businessIncome, floored at 0
  basicExemptionUsedStcg: number;
  basicExemptionUsedLtcg: number;

  // ── STCG ──
  stcgGains: number; // max(0, stcgPnl)
  stcgTaxable: number;
  stcgTax: number;

  // ── LTCG ──
  ltcgGains: number; // max(0, ltcgPnl)
  ltcgAfterAnnualExemption: number; // gains − 1.25L
  ltcgTaxable: number;
  ltcgTax: number;

  // ── Crypto ──
  cryptoGains: number; // sum of positive VDA trades (no loss offset)
  cryptoTax: number;

  // ── totals ──
  totalIncome: number; // for the §87A threshold
  specialTax: number; // stcg + ltcg + crypto
  taxBeforeCess: number; // businessTax + specialTax + surcharge
  surcharge: number;
  cess: number;
  totalTax: number;
  effectiveRate: number; // totalTax / totalIncome %
  netAfterTax: number; // net realised P&L − totalTax

  // ── carry-forward losses (informational) ──
  businessLoss: number; // |businessPnl| if net loss
  stcgLoss: number;
  ltcgLoss: number;
}

function surchargeRateFor(income: number): number {
  if (income > 50000000) return 37; // (old regime; new regime caps at 25 — handled below)
  if (income > 20000000) return 25;
  if (income > 10000000) return 15;
  if (income > 5000000) return 10;
  return 0;
}

/** Compute the FY tax for a set of trades already scoped to one financial year.
 *  Only CLOSED trades carry realised P&L. */
export function computeFinancialYearTax(trades: Trade[], rates: TaxRates): FyTaxResult {
  const p = paramsFromRates(rates);
  const closed = trades.filter((t) => t.status === "Closed");
  const sumBy = (cat: string, sel: (t: Trade) => number) =>
    closed.filter((t) => t.tax.category === cat).reduce((a, t) => a + sel(t), 0);

  // real net P&L per head — for display and take-home (all costs deducted)
  const businessPnl = round2(sumBy("Intraday", (t) => t.netPnl));
  const stcgPnl = round2(sumBy("STCG", (t) => t.netPnl));
  const ltcgPnl = round2(sumBy("LTCG", (t) => t.netPnl));

  // taxable P&L per head — the tax base, with non-deductible charges (STT/DP/MTF
  // interest for capital gains, all charges for crypto) added back
  const businessTaxablePnl = round2(sumBy("Intraday", (t) => t.taxablePnl));
  const stcgTaxablePnl = round2(sumBy("STCG", (t) => t.taxablePnl));
  const ltcgTaxablePnl = round2(sumBy("LTCG", (t) => t.taxablePnl));

  // crypto: each VDA gain is taxed on its taxable base; losses can't offset (§115BBH)
  const cryptoTrades = closed.filter((t) => t.tax.category === "Crypto");
  const cryptoGains = round2(cryptoTrades.reduce((a, t) => a + Math.max(0, t.taxablePnl), 0));
  const cryptoPnl = round2(cryptoTrades.reduce((a, t) => a + t.netPnl, 0));

  // ── business income at slab rates (basic exemption is the 0–4L nil band) ──
  const businessIncome = Math.max(0, businessTaxablePnl);
  const slabTaxOnBusiness = slabTax(businessIncome, p.slabs);

  // ── STCG / LTCG positive gains (taxable base) ──
  const stcgGains = Math.max(0, stcgTaxablePnl);
  const ltcgGains = Math.max(0, ltcgTaxablePnl);
  const ltcgAfterAnnualExemption = Math.max(0, ltcgGains - p.ltcgAnnualExemption);

  // ── resident basic-exemption adjustment: STCG first (higher rate), then LTCG ──
  let unused = Math.max(0, p.basicExemption - businessIncome);
  const basicExemptionUnused = unused;
  const basicExemptionUsedStcg = Math.min(unused, stcgGains);
  const stcgTaxable = Math.max(0, stcgGains - unused);
  unused = Math.max(0, unused - stcgGains);
  const basicExemptionUsedLtcg = Math.min(unused, ltcgAfterAnnualExemption);
  const ltcgTaxable = Math.max(0, ltcgAfterAnnualExemption - unused);

  const stcgTax = round2((stcgTaxable * p.stcgPct) / 100);
  const ltcgTax = round2((ltcgTaxable * p.ltcgPct) / 100);
  const cryptoTax = round2((cryptoGains * p.cryptoPct) / 100);

  // ── total income for the §87A threshold (taxable components) ──
  const totalIncome = round2(businessIncome + stcgGains + ltcgAfterAnnualExemption + cryptoGains);

  // ── §87A rebate: only against slab tax on business income ──
  let rebate87A = 0;
  if (totalIncome <= p.rebateIncomeLimit) {
    rebate87A = Math.min(slabTaxOnBusiness, p.rebateMax);
  } else {
    // marginal relief just above the threshold
    rebate87A = Math.max(0, slabTaxOnBusiness - (totalIncome - p.rebateIncomeLimit));
    rebate87A = Math.min(rebate87A, slabTaxOnBusiness);
  }
  const businessTax = round2(Math.max(0, slabTaxOnBusiness - rebate87A));

  const specialTax = round2(stcgTax + ltcgTax + cryptoTax);

  // ── surcharge (rare; only above ₹50L). New regime caps overall at 25%; the
  //    rate on special-rate gains is capped at 15%. ──
  const baseRate = Math.min(surchargeRateFor(totalIncome), 25);
  const gainsRate = Math.min(baseRate, 15);
  const surcharge = round2((businessTax * baseRate) / 100 + (specialTax * gainsRate) / 100);

  const taxBeforeCess = round2(businessTax + specialTax + surcharge);
  const cess = round2((taxBeforeCess * p.cessPct) / 100);
  const totalTax = round2(taxBeforeCess + cess);

  const netRealised = round2(businessPnl + stcgPnl + ltcgPnl + cryptoPnl);
  const effectiveRate = totalIncome > 0 ? round2((totalTax / totalIncome) * 100) : 0;

  return {
    businessPnl,
    stcgPnl,
    ltcgPnl,
    cryptoPnl,
    businessTaxablePnl,
    stcgTaxablePnl,
    ltcgTaxablePnl,
    businessIncome,
    slabTaxOnBusiness: round2(slabTaxOnBusiness),
    rebate87A: round2(rebate87A),
    businessTax,
    basicExemptionUnused,
    basicExemptionUsedStcg: round2(basicExemptionUsedStcg),
    basicExemptionUsedLtcg: round2(basicExemptionUsedLtcg),
    stcgGains,
    stcgTaxable: round2(stcgTaxable),
    stcgTax,
    ltcgGains,
    ltcgAfterAnnualExemption: round2(ltcgAfterAnnualExemption),
    ltcgTaxable: round2(ltcgTaxable),
    ltcgTax,
    cryptoGains,
    cryptoTax,
    totalIncome,
    specialTax,
    taxBeforeCess,
    surcharge,
    cess,
    totalTax,
    effectiveRate,
    netAfterTax: round2(netRealised - totalTax),
    businessLoss: businessTaxablePnl < 0 ? round2(-businessTaxablePnl) : 0,
    stcgLoss: stcgTaxablePnl < 0 ? round2(-stcgTaxablePnl) : 0,
    ltcgLoss: ltcgTaxablePnl < 0 ? round2(-ltcgTaxablePnl) : 0,
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
