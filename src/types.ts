/** LedgerX domain model — shared by every page. Do not modify from page code. */

export type AssetClass = "Equity" | "Options" | "Futures" | "Forex" | "Crypto" | "Commodity";
export type Direction = "Long" | "Short";
export type TradeStatus = "Open" | "Closed" | "Cancelled";
/** Broker product/segment — drives which charge formula applies and the tax base.
 *  Equity splits into Delivery (CNC) / Intraday (MIS) / MTF (e-Margin);
 *  Options & Futures are FnO; everything else is Other. */
export type TradeSegment = "Delivery" | "Intraday" | "MTF" | "ETF" | "FnO" | "Other";
/** Exchange the order routed to — only the exchange transaction charge differs
 *  (NSE 0.00297% vs BSE 0.00375% on equity); every other levy is identical. */
export type Exchange = "NSE" | "BSE";
export type TaxCategory = "Intraday" | "STCG" | "LTCG" | "Crypto";
export type MarketCondition = "Trending" | "Ranging" | "Volatile" | "Quiet";
export type Timeframe = "1m" | "5m" | "15m" | "1h" | "4h" | "Daily" | "Weekly";
export type Mood = "great" | "good" | "neutral" | "bad" | "terrible";
export type Rating = 1 | 2 | 3 | 4 | 5;

export interface ChargesBreakdown {
  brokerage: number;
  exchangeTxn: number;
  stt: number; // STT/CTT (crypto TDS is folded in here and labeled in UI)
  sebi: number;
  stampDuty: number;
  gst: number;
  dpCharges: number;
  /** Pledge + unpledge charges (₹20/request per leg; MTF & pledged ETF, else 0) */
  pledgeCharges: number;
  /** manually-entered brokerage + statutory charges (manual mode only; 0 for auto) */
  manual: number;
  /** manually-entered MTF/margin interest (manual mode only; 0 for delivery/auto) */
  mtfInterest: number;
  total: number;
}

export interface TaxInfo {
  category: TaxCategory;
  taxableAmount: number; // max(0, netPnl) — losses carry 0 tax here
  rate: number; // percent applied
  estimatedTax: number;
}

export interface Trade {
  id: string;
  accountId: string;
  symbol: string;
  assetClass: AssetClass;
  /** broker product/segment — Delivery/Intraday/MTF for Equity, FnO for derivatives */
  segment: TradeSegment;
  /** exchange the order routed to (affects only the equity exchange txn charge) */
  exchange: Exchange;
  direction: Direction;
  status: TradeStatus;
  quantity: number;
  entryPrice: number;
  exitPrice?: number;
  stopLoss?: number;
  target?: number;
  openedAt: string; // ISO datetime
  closedAt?: string; // ISO datetime
  holdingMinutes?: number;
  /** P&L — all zero until the trade is Closed */
  grossPnl: number;
  charges: ChargesBreakdown;
  /** true when charges were entered as one manual total instead of auto-computed */
  manualCharges?: boolean;
  netPnl: number; // grossPnl - charges.total (real take-home, all costs)
  /** tax base = grossPnl − only the DEDUCTIBLE charges for this trade's tax
   *  category. Differs from netPnl for capital gains (STT/DP/MTF interest are
   *  added back) and crypto (nothing deductible). Business income = netPnl. */
  taxablePnl: number;
  tax: TaxInfo;
  /** Risk & sizing */
  riskAmount: number; // planned rupee risk
  rMultiple?: number; // netPnl / riskAmount, closed trades only
  positionValue: number; // entryPrice * quantity
  pctOfCapital: number; // positionValue / account capital * 100
  /** Context */
  strategy: string;
  marketCondition: MarketCondition;
  timeframe: Timeframe;
  tags: string[];
  emotionRating: Rating;
  confidenceRating: Rating;
  screenshotUrl?: string; // data-URI SVG in samples
  notes: string;
  mistakes?: string;
  lessons?: string;
}

export interface Account {
  id: string;
  name: string;
  broker: string;
  currency: "INR" | "USD";
  startingCapital: number;
  createdAt: string; // ISO date
}

/** A manual cash movement in/out of an account — deposits added, withdrawals
 *  taken for personal use. Adjusts the account's value, NOT trading P&L or ROI. */
export interface CashTransaction {
  id: string;
  accountId: string;
  type: "deposit" | "withdrawal";
  amount: number; // always positive; `type` gives the direction
  date: string; // ISO date
  note?: string;
}

export interface JournalEntry {
  id: string;
  date: string; // ISO date
  title: string;
  content: string; // plain text with \n paragraphs
  mood: Mood;
  linkedTradeIds: string[];
}

export interface Goals {
  monthlyProfitTarget: number;
  winRateTarget: number; // percent
  maxDailyLoss: number; // positive rupee number
  maxTradesPerDay: number;
}

/** Monthly percentage-of-portfolio targets. The user enters each month's
 *  portfolio value; targets are `percents`% of it, achieved = that month's net P&L. */
export interface PortfolioTargets {
  /** target percentages of each month's portfolio value, e.g. [3, 4, 6, 7.2] */
  percents: number[];
  /** month-start portfolio value keyed by "yyyy-MM" */
  capitalByMonth: Record<string, number>;
}

export interface WatchlistItem {
  id: string;
  symbol: string;
  assetClass: AssetClass;
  note: string;
  plannedSetup: string;
  alertPrice?: number;
  addedAt: string; // ISO date
}

export interface ChargeRates {
  brokerageFlatPerOrder: number; // ₹ per executed order (leg) — cap for delivery/intraday, flat for F&O
  brokeragePctPerOrder: number; // % per leg (Groww 0.1% for equity delivery/intraday/MTF)
  minBrokeragePerOrder: number; // ₹ floor per leg (Groww ₹5); 0 disables the floor
  mtfInterestAnnualPct: number; // MTF/margin interest % per annum (informational — interest is entered manually)
  sttIntradayPct: number; // sell side
  sttDeliveryPct: number; // both sides
  sttEtfDeliveryPct: number; // equity ETF — sell side only (nil on buy)
  sttOptionsPct: number; // sell premium
  sttFuturesPct: number; // sell side
  exchangeEquityPct: number; // NSE cash equity (0.00297%)
  exchangeEquityBsePct: number; // BSE cash equity (0.00375%, Group A/B)
  exchangeOptionsPct: number;
  exchangeFuturesPct: number;
  exchangeCommodityPct: number;
  exchangeForexPct: number;
  cryptoFeePct: number; // per leg
  sebiPct: number; // on turnover
  stampDeliveryPct: number; // buy side
  stampIntradayPct: number;
  stampOptionsPct: number;
  stampFuturesPct: number;
  gstPct: number; // on brokerage + exchange + sebi + DP + pledge
  dpChargePerSell: number; // delivery equity sell
  pledgeChargePerRequest: number; // MTF pledge/unpledge — ₹20/request per ISIN per leg
}

export interface TaxRates {
  intradayPct: number; // rough per-trade business-income estimate (FY page uses slabs)
  stcgPct: number; // §111A — 20%
  ltcgPct: number; // §112A — 12.5%
  cryptoPct: number; // §115BBH — flat 30% VDA
  /** ── new-regime FY 2025-26 parameters (used by the financial-year tax engine) ── */
  basicExemption: number; // 400000
  ltcgExemption: number; // 125000 annual LTCG exemption
  rebate87ALimit: number; // 1200000 total-income threshold for the §87A rebate
  rebate87AMax: number; // 60000 max rebate
  cessPct: number; // 4 health & education cess
}

export interface AppSettings {
  userName: string;
  email: string;
  baseCurrency: "INR" | "USD";
  timezone: string;
  startingCapital: number; // combined, used for equity curve & ROI
  chargeRates: ChargeRates;
  taxRates: TaxRates;
  theme: "dark" | "light";
}

export type RangePreset = "7d" | "30d" | "90d" | "ytd" | "thisMonth" | "lastMonth" | "all" | "custom";

export interface GlobalFilters {
  preset: RangePreset;
  /** ISO dates, used when preset === "custom" */
  from: string | null;
  to: string | null;
  accountId: string | "all";
}
