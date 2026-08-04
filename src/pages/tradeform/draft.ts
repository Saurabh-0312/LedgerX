/** TradeForm draft model + pure helpers. Owned by the TradeForm page. */

import type {
  Account,
  AssetClass,
  ChargesBreakdown,
  Direction,
  Exchange,
  MarketCondition,
  Rating,
  Timeframe,
  Trade,
  TradeSegment,
} from "@/types";
import { defaultSegmentFor } from "@/lib/tradeMath";

/** Editable, string-backed form state (numbers stay strings until save). */
export interface Draft {
  accountId: string;
  symbol: string;
  assetClass: AssetClass;
  /** broker product/segment (Equity: Delivery/Intraday/MTF; derivatives: FnO) */
  segment: TradeSegment;
  /** exchange the order routed to — NSE/BSE (equity exchange txn charge) */
  exchange: Exchange;
  direction: Direction;
  status: "Open" | "Closed";
  quantity: string;
  entryPrice: string;
  exitPrice: string;
  stopLoss: string;
  target: string;
  /** local ISO "yyyy-MM-ddTHH:mm" (datetime-local value) */
  openedAt: string;
  closedAt: string;
  riskAmount: string;
  /** charge entry mode — true = manual (charges + MTF interest), false = auto-computed */
  manualCharges: boolean;
  /** manual brokerage + statutory charges (string-backed) */
  manualChargeAmount: string;
  /** manual MTF/margin interest (string-backed; 0 for delivery) */
  manualMtfInterest: string;
  strategy: string;
  customStrategy: string;
  useCustomStrategy: boolean;
  marketCondition: MarketCondition;
  timeframe: Timeframe;
  tags: string[];
  emotionRating: Rating;
  confidenceRating: Rating;
  notes: string;
  mistakes: string;
  lessons: string;
  screenshotUrl: string;
}

export const ASSET_CLASSES: AssetClass[] = ["Equity", "Options", "Futures", "Forex", "Crypto", "Commodity"];
export const MARKET_CONDITIONS: MarketCondition[] = ["Trending", "Ranging", "Volatile", "Quiet"];
export const TIMEFRAMES: Timeframe[] = ["1m", "5m", "15m", "1h", "4h", "Daily", "Weekly"];

export const ZERO_CHARGES: ChargesBreakdown = {
  brokerage: 0,
  exchangeTxn: 0,
  stt: 0,
  sebi: 0,
  stampDuty: 0,
  gst: 0,
  dpCharges: 0,
  pledgeCharges: 0,
  manual: 0,
  mtfInterest: 0,
  total: 0,
};

export const r2 = (n: number): number => Math.round(n * 100) / 100;

/** Lenient numeric parse for form fields — empty/garbage → 0. */
export function num(s: string): number {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

/** Date → "yyyy-MM-ddTHH:mm" for datetime-local inputs. */
export function toLocalInput(d: Date): string {
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Unique non-empty strategies across the journal, alphabetical. */
export function uniqueStrategies(trades: Trade[]): string[] {
  return Array.from(new Set(trades.map((t) => t.strategy).filter((s) => s.trim().length > 0))).sort(
    (a, b) => a.localeCompare(b),
  );
}

/** All tags used before, most frequent first — feeds the suggestion chips. */
export function tagsByFrequency(trades: Trade[]): string[] {
  const freq = new Map<string, number>();
  for (const t of trades) for (const tag of t.tags) freq.set(tag, (freq.get(tag) ?? 0) + 1);
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag]) => tag);
}

/** Build the initial draft — blank for /trades/new, prefilled for /trades/:id/edit. */
export function makeDraft(trade: Trade | undefined, accounts: Account[], strategies: string[]): Draft {
  if (!trade) {
    return {
      accountId: accounts[0]?.id ?? "",
      symbol: "",
      assetClass: "Equity",
      segment: "Delivery",
      exchange: "NSE",
      direction: "Long",
      status: "Closed",
      quantity: "",
      entryPrice: "",
      exitPrice: "",
      stopLoss: "",
      target: "",
      openedAt: toLocalInput(new Date()),
      closedAt: "",
      riskAmount: "",
      manualCharges: true,
      manualChargeAmount: "",
      manualMtfInterest: "",
      strategy: strategies[0] ?? "",
      customStrategy: "",
      useCustomStrategy: strategies.length === 0,
      marketCondition: "Trending",
      timeframe: "15m",
      tags: [],
      emotionRating: 3,
      confidenceRating: 3,
      notes: "",
      mistakes: "",
      lessons: "",
      screenshotUrl: "",
    };
  }
  const known = strategies.includes(trade.strategy);
  return {
    accountId: trade.accountId,
    symbol: trade.symbol,
    assetClass: trade.assetClass,
    segment:
      trade.segment ??
      ((trade.charges.mtfInterest ?? 0) > 0 && trade.assetClass === "Equity"
        ? "MTF"
        : defaultSegmentFor(trade.assetClass, trade.tax?.category === "Intraday")),
    exchange: trade.exchange ?? "NSE",
    direction: trade.direction,
    status: trade.status === "Closed" ? "Closed" : "Open",
    quantity: String(trade.quantity),
    entryPrice: String(trade.entryPrice),
    exitPrice: trade.status === "Closed" && trade.exitPrice !== undefined ? String(trade.exitPrice) : "",
    stopLoss: trade.stopLoss !== undefined ? String(trade.stopLoss) : "",
    target: trade.target !== undefined ? String(trade.target) : "",
    openedAt: toLocalInput(new Date(trade.openedAt)),
    closedAt: trade.status === "Closed" && trade.closedAt ? toLocalInput(new Date(trade.closedAt)) : "",
    riskAmount: trade.riskAmount > 0 ? String(trade.riskAmount) : "",
    manualCharges: trade.manualCharges ?? false,
    manualChargeAmount:
      trade.manualCharges && trade.charges.manual > 0 ? String(trade.charges.manual) : "",
    manualMtfInterest:
      trade.manualCharges && (trade.charges.mtfInterest ?? 0) > 0
        ? String(trade.charges.mtfInterest)
        : "",
    strategy: known ? trade.strategy : (strategies[0] ?? ""),
    customStrategy: known ? "" : trade.strategy,
    useCustomStrategy: !known,
    marketCondition: trade.marketCondition,
    timeframe: trade.timeframe,
    tags: [...trade.tags],
    emotionRating: trade.emotionRating,
    confidenceRating: trade.confidenceRating,
    notes: trade.notes,
    mistakes: trade.mistakes ?? "",
    lessons: trade.lessons ?? "",
    screenshotUrl: trade.screenshotUrl ?? "",
  };
}
