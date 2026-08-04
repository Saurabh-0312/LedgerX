/** Deterministic sample dataset — ~240 trades across 8 months, 3 accounts,
 *  journal entries, watchlist. Seeded RNG ⇒ identical data on every load. */

import type {
  Account,
  AssetClass,
  CashTransaction,
  Direction,
  Goals,
  JournalEntry,
  MarketCondition,
  Mood,
  PortfolioTargets,
  Rating,
  Timeframe,
  Trade,
  WatchlistItem,
} from "@/types";
import { between, chance, intBetween, mulberry32, pick, pickWeighted, type Rng } from "./rng";
import {
  DEFAULT_CHARGE_RATES,
  DEFAULT_TAX_RATES,
  computeCharges,
  computeGrossPnl,
  computeRMultiple,
  computeTax,
  computeTaxablePnl,
  defaultSegmentFor,
  holdingMinutesBetween,
  isIntraday,
  taxCategoryFor,
} from "./tradeMath";

export const SAMPLE_ACCOUNTS: Account[] = [
  { id: "acc-zerodha", name: "Zerodha — F&O + Intraday", broker: "Zerodha", currency: "INR", startingCapital: 800000, createdAt: "2025-10-15" },
  { id: "acc-fyers", name: "Fyers — Equity Swing", broker: "Fyers", currency: "INR", startingCapital: 500000, createdAt: "2025-10-20" },
  { id: "acc-coindcx", name: "CoinDCX — Crypto", broker: "CoinDCX", currency: "INR", startingCapital: 200000, createdAt: "2025-11-01" },
];

export const TOTAL_CAPITAL = SAMPLE_ACCOUNTS.reduce((s, a) => s + a.startingCapital, 0);

interface Instrument {
  symbol: string;
  assetClass: AssetClass;
  base: number; // typical price / premium
  qtyStep: number; // lot size (1 for equity)
  accountId: string;
  swing?: boolean; // delivery/swing style (multi-day holds)
}

const INSTRUMENTS: Instrument[] = [
  // NSE cash — intraday on Zerodha
  { symbol: "RELIANCE", assetClass: "Equity", base: 2920, qtyStep: 1, accountId: "acc-zerodha" },
  { symbol: "HDFCBANK", assetClass: "Equity", base: 1685, qtyStep: 1, accountId: "acc-zerodha" },
  { symbol: "ICICIBANK", assetClass: "Equity", base: 1240, qtyStep: 1, accountId: "acc-zerodha" },
  { symbol: "SBIN", assetClass: "Equity", base: 845, qtyStep: 1, accountId: "acc-zerodha" },
  { symbol: "TATAMOTORS", assetClass: "Equity", base: 1010, qtyStep: 1, accountId: "acc-zerodha" },
  // NSE cash — swing on Fyers
  { symbol: "TCS", assetClass: "Equity", base: 4150, qtyStep: 1, accountId: "acc-fyers", swing: true },
  { symbol: "INFY", assetClass: "Equity", base: 1870, qtyStep: 1, accountId: "acc-fyers", swing: true },
  { symbol: "ADANIENT", assetClass: "Equity", base: 3240, qtyStep: 1, accountId: "acc-fyers", swing: true },
  { symbol: "LT", assetClass: "Equity", base: 3720, qtyStep: 1, accountId: "acc-fyers", swing: true },
  { symbol: "BHARTIARTL", assetClass: "Equity", base: 1655, qtyStep: 1, accountId: "acc-fyers", swing: true },
  // Index options (premium prices) — Zerodha
  { symbol: "NIFTY 24500 CE", assetClass: "Options", base: 145, qtyStep: 75, accountId: "acc-zerodha" },
  { symbol: "NIFTY 24300 PE", assetClass: "Options", base: 130, qtyStep: 75, accountId: "acc-zerodha" },
  { symbol: "BANKNIFTY 52000 CE", assetClass: "Options", base: 340, qtyStep: 35, accountId: "acc-zerodha" },
  { symbol: "BANKNIFTY 51500 PE", assetClass: "Options", base: 310, qtyStep: 35, accountId: "acc-zerodha" },
  // Futures — Zerodha
  { symbol: "NIFTY FUT", assetClass: "Futures", base: 24480, qtyStep: 75, accountId: "acc-zerodha" },
  { symbol: "BANKNIFTY FUT", assetClass: "Futures", base: 51900, qtyStep: 35, accountId: "acc-zerodha" },
  // Commodity (MCX) — Zerodha
  { symbol: "CRUDEOIL FUT", assetClass: "Commodity", base: 6840, qtyStep: 100, accountId: "acc-zerodha" },
  { symbol: "GOLDM FUT", assetClass: "Commodity", base: 74250, qtyStep: 10, accountId: "acc-zerodha" },
  // Currency — Zerodha
  { symbol: "USDINR FUT", assetClass: "Forex", base: 86.4, qtyStep: 1000, accountId: "acc-zerodha" },
  { symbol: "EURINR FUT", assetClass: "Forex", base: 92.7, qtyStep: 1000, accountId: "acc-zerodha" },
  // Crypto — CoinDCX (INR pairs), swing-ish, trades weekends too
  { symbol: "BTC/INR", assetClass: "Crypto", base: 5250000, qtyStep: 0.001, accountId: "acc-coindcx", swing: true },
  { symbol: "ETH/INR", assetClass: "Crypto", base: 286000, qtyStep: 0.01, accountId: "acc-coindcx", swing: true },
  { symbol: "SOL/INR", assetClass: "Crypto", base: 14150, qtyStep: 0.1, accountId: "acc-coindcx", swing: true },
];

const STRATEGIES = [
  "Opening Range Breakout",
  "Trend Pullback",
  "VWAP Reversion",
  "Breakout",
  "Swing Momentum",
  "Gap & Go",
  "Mean Reversion",
  "News Play",
] as const;

/** Per-strategy edge: win probability tilt + reward tilt. Some setups are simply better. */
const STRATEGY_EDGE: Record<string, { winTilt: number; rTilt: number }> = {
  "Opening Range Breakout": { winTilt: 0.05, rTilt: 0.25 },
  "Trend Pullback": { winTilt: 0.07, rTilt: 0.15 },
  "VWAP Reversion": { winTilt: 0.03, rTilt: -0.1 },
  Breakout: { winTilt: 0, rTilt: 0.1 },
  "Swing Momentum": { winTilt: 0.04, rTilt: 0.35 },
  "Gap & Go": { winTilt: -0.02, rTilt: 0.05 },
  "Mean Reversion": { winTilt: 0.02, rTilt: -0.15 },
  "News Play": { winTilt: -0.08, rTilt: -0.05 },
};

/** Month regimes shape the equity curve: a real-feeling run with a January drawdown. */
const MONTH_BIAS: Record<string, number> = {
  "2025-11": 0.03,
  "2025-12": 0.05,
  "2026-01": -0.1, // drawdown month
  "2026-02": 0.02,
  "2026-03": 0.09, // best month
  "2026-04": -0.03,
  "2026-05": 0.04,
  "2026-06": 0.06,
};

const TAG_POOL = ["breakout", "reversal", "momentum", "news", "earnings", "gap-up", "gap-down", "trend-day", "A+setup", "FOMO", "revenge", "overtrade", "choppy", "disciplined"];

const WIN_NOTES = [
  "Clean setup, waited for confirmation candle before entering. Managed per plan.",
  "Price respected the level perfectly. Scaled out half at 1R, trailed the rest.",
  "Textbook continuation after consolidation. No hesitation on entry.",
  "Entry off the retest, stop below structure. Market did the rest.",
  "Strong momentum aligned with higher timeframe trend. Held to target.",
];
const LOSS_NOTES = [
  "Setup was valid but market reversed on news flow. Stop did its job.",
  "Entered slightly early before confirmation. Stopped out, re-entry would have worked.",
  "Choppy session, should have sat out after the first stop-out.",
  "Level failed to hold. Took the planned loss, no averaging down.",
  "Momentum faded right after entry. Cut it at stop, moved on.",
];
const MISTAKES = [
  "Entered before the candle closed — anticipated instead of confirming.",
  "Position size was slightly above plan.",
  "Ignored the higher-timeframe resistance overhead.",
  "Chased the move after missing the ideal entry.",
  "Traded during a news window against my own rules.",
];
const LESSONS = [
  "Wait for the close. The confirmation costs a few points and saves many.",
  "One setup, one size. Consistency beats conviction.",
  "Check the daily level map before every entry.",
  "If the A-entry is gone, the trade is gone.",
  "Flat during scheduled news — no exceptions.",
];

const CONDITIONS: MarketCondition[] = ["Trending", "Ranging", "Volatile", "Quiet"];

/** Tiny deterministic SVG "chart screenshot" as a data URI. */
function screenshotSvg(rng: Rng, symbol: string, win: boolean): string {
  let y = 60 + rng() * 20;
  const pts: string[] = [];
  for (let x = 0; x <= 280; x += 10) {
    y += (rng() - (win ? 0.58 : 0.42)) * 14;
    y = Math.max(14, Math.min(126, y));
    pts.push(`${x + 10},${y}`);
  }
  const color = win ? "#16a34a" : "#ef4444";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="150" viewBox="0 0 300 150"><rect width="300" height="150" fill="#0f1114"/><g stroke="#1e2228" stroke-width="1">${[30, 60, 90, 120].map((gy) => `<line x1="0" y1="${gy}" x2="300" y2="${gy}"/>`).join("")}</g><polyline fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" points="${pts.join(" ")}"/><text x="12" y="22" fill="#8b929d" font-family="monospace" font-size="11">${symbol}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const pad = (n: number) => String(n).padStart(2, "0");
const isoAt = (d: Date, h: number, m: number) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(h)}:${pad(m)}:00`;

function makeTrade(rng: Rng, id: string, day: Date, openTrade: boolean, cancelled: boolean): Trade {
  const inst = pick(rng, INSTRUMENTS);
  const acct = SAMPLE_ACCOUNTS.find((a) => a.id === inst.accountId)!;
  const strategy = inst.swing
    ? pick(rng, ["Swing Momentum", "Trend Pullback", "Breakout", "Mean Reversion"] as const)
    : pick(rng, STRATEGIES);
  const edge = STRATEGY_EDGE[strategy];
  const ym = `${day.getFullYear()}-${pad(day.getMonth() + 1)}`;
  const bias = MONTH_BIAS[ym] ?? 0;

  const direction: Direction = chance(rng, inst.assetClass === "Options" ? 0.85 : 0.62) ? "Long" : "Short";
  const entryPrice = round2(inst.base * (1 + (rng() - 0.5) * 0.08));

  // position sizing off planned rupee risk
  const riskAmount = Math.round(between(rng, 0.004, 0.013) * acct.startingCapital);
  const stopPct = inst.swing ? between(rng, 0.02, 0.05) : between(rng, 0.003, 0.012);
  const stopDistance = Math.max(entryPrice * stopPct, entryPrice * 0.002);
  let quantity = Math.max(1, Math.round(riskAmount / stopDistance / inst.qtyStep)) * inst.qtyStep;
  if (inst.qtyStep < 1) quantity = round4(Math.max(inst.qtyStep, (riskAmount / stopDistance) * 1) * 1); // crypto fractional
  const stopLoss = round2(direction === "Long" ? entryPrice - stopDistance : entryPrice + stopDistance);

  // session times
  const isCrypto = inst.assetClass === "Crypto";
  const isCommodity = inst.assetClass === "Commodity";
  const openHour = isCrypto ? intBetween(rng, 8, 22) : isCommodity ? intBetween(rng, 10, 21) : intBetween(rng, 9, 14);
  const openMin = openHour === 9 ? intBetween(rng, 16, 59) : intBetween(rng, 0, 59);
  const openedAt = isoAt(day, openHour, openMin);

  const timeframe: Timeframe = inst.swing ? pick(rng, ["1h", "4h", "Daily"] as const) : pick(rng, ["1m", "5m", "15m"] as const);
  const marketCondition = pick(rng, CONDITIONS);
  const targetR = between(rng, 1.5, 3.2);
  const target = round2(direction === "Long" ? entryPrice + stopDistance * targetR : entryPrice - stopDistance * targetR);

  const base: Omit<Trade, "grossPnl" | "charges" | "netPnl" | "taxablePnl" | "tax" | "rMultiple" | "status" | "segment"> = {
    id,
    accountId: acct.id,
    symbol: inst.symbol,
    assetClass: inst.assetClass,
    exchange: "NSE",
    direction,
    quantity,
    entryPrice,
    stopLoss,
    target,
    openedAt,
    riskAmount,
    positionValue: round2(entryPrice * quantity),
    pctOfCapital: round2(((entryPrice * quantity) / acct.startingCapital) * 100),
    strategy,
    marketCondition,
    timeframe,
    tags: [],
    emotionRating: 3 as Rating,
    confidenceRating: intBetween(rng, 2, 5) as Rating,
    notes: "",
  };

  if (cancelled) {
    return {
      ...base,
      segment: defaultSegmentFor(inst.assetClass),
      status: "Cancelled",
      grossPnl: 0,
      netPnl: 0,
      taxablePnl: 0,
      charges: { brokerage: 0, exchangeTxn: 0, stt: 0, sebi: 0, stampDuty: 0, gst: 0, dpCharges: 0, pledgeCharges: 0, manual: 0, mtfInterest: 0, total: 0 },
      tax: { category: "Intraday", taxableAmount: 0, rate: 0, estimatedTax: 0 },
      notes: "Order placed but cancelled before fill — setup invalidated.",
      tags: ["disciplined"],
    };
  }

  if (openTrade) {
    const segment = defaultSegmentFor(inst.assetClass);
    const charges = computeCharges({ assetClass: inst.assetClass, segment, quantity, entryPrice, direction, rates: DEFAULT_CHARGE_RATES });
    return {
      ...base,
      segment,
      status: "Open",
      grossPnl: 0,
      netPnl: 0,
      taxablePnl: 0,
      charges,
      tax: { category: taxCategoryFor(inst.assetClass, undefined, false), taxableAmount: 0, rate: 0, estimatedTax: 0 },
      notes: "Position open — managing per plan.",
      tags: [pick(rng, ["momentum", "breakout", "A+setup", "trend-day"])],
    };
  }

  // outcome
  const winP = Math.min(0.72, Math.max(0.3, 0.53 + edge.winTilt + bias));
  const win = chance(rng, winP);
  const rGross = win
    ? pickWeighted(rng, [
        [between(rng, 0.3, 1), 30],
        [between(rng, 1, 2), 38],
        [between(rng, 2, 3.5), 22],
        [between(rng, 3.5, 6), 10],
      ]) + edge.rTilt
    : -pickWeighted(rng, [
        [between(rng, 0.2, 0.7), 30],
        [between(rng, 0.7, 1.1), 50],
        [between(rng, 1.1, 2), 20],
      ]);

  const grossPnlTargetRaw = rGross * riskAmount;
  const priceMove = grossPnlTargetRaw / quantity;
  const exitPrice = round4(direction === "Long" ? entryPrice + priceMove : entryPrice - priceMove);

  // holding period
  let closedAt: string;
  if (inst.swing) {
    const holdDays = intBetween(rng, 1, 14);
    const close = new Date(day);
    close.setDate(close.getDate() + holdDays);
    if (!isCrypto) {
      while (close.getDay() === 0 || close.getDay() === 6) close.setDate(close.getDate() + 1);
    }
    closedAt = isoAt(close, intBetween(rng, 10, 15), intBetween(rng, 0, 59));
  } else {
    const holdMin = intBetween(rng, 6, 240);
    const close = new Date(day);
    close.setHours(openHour, openMin + holdMin, 0, 0);
    if (!isCrypto && !isCommodity && close.getHours() >= 15) close.setHours(15, intBetween(rng, 5, 25), 0, 0);
    closedAt = isoAt(close, close.getHours(), close.getMinutes());
  }

  const intraday = isIntraday(openedAt, closedAt);
  const segment = defaultSegmentFor(inst.assetClass, intraday);
  const grossPnl = computeGrossPnl(direction, entryPrice, exitPrice, quantity);
  const charges = computeCharges({ assetClass: inst.assetClass, segment, quantity, entryPrice, exitPrice, direction, rates: DEFAULT_CHARGE_RATES });
  const netPnl = round2(grossPnl - charges.total);
  const holdingMinutes = holdingMinutesBetween(openedAt, closedAt);
  const taxCategory = taxCategoryFor(inst.assetClass, holdingMinutes, intraday);
  const taxablePnl = computeTaxablePnl(grossPnl, charges, taxCategory);
  const tax = computeTax(taxablePnl, taxCategory, DEFAULT_TAX_RATES);

  const emotional = chance(rng, 0.18); // some trades tagged with psychology slip-ups
  const tags = [
    ...(win ? [pick(rng, ["breakout", "momentum", "trend-day", "A+setup", "disciplined"])] : [pick(rng, ["choppy", "reversal", "gap-down", "news"])]),
    ...(chance(rng, 0.6) ? [pick(rng, TAG_POOL)] : []),
    ...(emotional && !win ? [pick(rng, ["FOMO", "revenge", "overtrade"])] : []),
  ].filter((t, i, arr) => arr.indexOf(t) === i);

  return {
    ...base,
    segment,
    status: "Closed",
    exitPrice,
    closedAt,
    holdingMinutes,
    grossPnl,
    charges,
    netPnl,
    taxablePnl,
    tax,
    rMultiple: computeRMultiple(netPnl, riskAmount),
    emotionRating: (win ? intBetween(rng, 3, 5) : emotional ? intBetween(rng, 1, 2) : intBetween(rng, 2, 4)) as Rating,
    notes: win ? pick(rng, WIN_NOTES) : pick(rng, LOSS_NOTES),
    mistakes: !win && chance(rng, 0.7) ? pick(rng, MISTAKES) : undefined,
    lessons: !win && chance(rng, 0.6) ? pick(rng, LESSONS) : undefined,
    screenshotUrl: chance(rng, 0.45) ? screenshotSvg(rng, inst.symbol, win) : undefined,
    tags,
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const round4 = (n: number) => Math.round(n * 10000) / 10000;

export function generateTrades(): Trade[] {
  const rng = mulberry32(0x1ed6e9);
  const trades: Trade[] = [];
  let n = 1;
  const start = new Date(2025, 10, 3); // 3 Nov 2025
  const end = new Date(2026, 5, 30); // 30 Jun 2026

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const weekend = d.getDay() === 0 || d.getDay() === 6;
    const count = weekend
      ? chance(rng, 0.22)
        ? 1
        : 0 // only crypto weekends
      : pickWeighted(rng, [
          [0, 18],
          [1, 30],
          [2, 28],
          [3, 16],
          [4, 8],
        ]);
    for (let i = 0; i < count; i++) {
      const day = new Date(d);
      let t = makeTrade(rng, `T-${String(n).padStart(4, "0")}`, day, false, false);
      if (weekend && t.assetClass !== "Crypto") continue; // only crypto trades on weekends
      trades.push(t);
      n++;
    }
  }

  // a few open positions in the final week + two cancelled orders
  const lastDays = [new Date(2026, 5, 25), new Date(2026, 5, 26), new Date(2026, 5, 29), new Date(2026, 5, 30)];
  for (const d of lastDays) {
    trades.push(makeTrade(rng, `T-${String(n++).padStart(4, "0")}`, d, true, false));
  }
  trades.push(makeTrade(rng, `T-${String(n++).padStart(4, "0")}`, new Date(2026, 4, 14), false, true));
  trades.push(makeTrade(rng, `T-${String(n++).padStart(4, "0")}`, new Date(2026, 5, 9), false, true));

  return trades.sort((a, b) => a.openedAt.localeCompare(b.openedAt));
}

const MOODS: Mood[] = ["great", "good", "neutral", "bad", "terrible"];

export function generateJournal(trades: Trade[]): JournalEntry[] {
  const rng = mulberry32(7341);
  const entries: JournalEntry[] = [];
  const dates = [
    ["2025-11-07", "First week on the new journal", "Started logging every trade with full charge breakdowns. The ORB setup on BANKNIFTY is my bread and butter — three clean wins this week. Need to stop touching News Play trades, they bleed."],
    ["2025-11-21", "Expiry week review", "Theta burned two option longs. Rule going forward: no long premium after Wednesday of expiry week unless IV is expanding."],
    ["2025-12-05", "Strong trend days", "Caught two beautiful trend days on NIFTY futures. Sat on hands during chop — the discipline tag count is going up and it shows in the equity curve."],
    ["2025-12-19", "Year-end reflection", "December has been kind. Win rate near 60% and charges are eating less of the gross because I stopped over-trading. Fewer, bigger, better."],
    ["2026-01-09", "Rough start to January", "Three losing days in a row. The market regime changed — ranges everywhere, my breakout entries keep failing. Cutting size by half until I see a green week."],
    ["2026-01-23", "Drawdown management", "Down about 6% from the peak. Following the drawdown protocol: half size, A+ setups only, mandatory day off after two red days. It hurts but the max daily loss cap is doing its job."],
    ["2026-02-06", "Stabilising", "First green week since December. The half-size rule saved the account from a deeper hole. Slowly scaling back up."],
    ["2026-02-20", "Swing book working", "The Fyers swing account quietly compounds while I fight intraday. TCS and INFY momentum swings both hit 2R+. Maybe the lesson is obvious."],
    ["2026-03-06", "Best month in a while", "Trend is back. ORB win rate this month is huge and the BANKNIFTY moves have follow-through. Pressing size on A+ setups per plan, not on feelings."],
    ["2026-03-27", "FY closing notes", "Closing the financial year strongly. Tax provision set aside per the estimate report. Biggest cost centre after losses: STT on options. Considering more futures, fewer options."],
    ["2026-04-10", "Post-FY chop", "April giving back a little. Volatility crushed, premiums dead. Trading less, reading more."],
    ["2026-05-08", "Process over outcome", "Grading trades A/B/C by process, not P&L. Funny how the A-graded trades are also the profitable ones. The journal keeps proving the same lesson."],
    ["2026-06-05", "June momentum", "Two months of steady equity highs. The revenge-trade tag hasn't appeared since January. That alone is worth the journaling habit."],
    ["2026-06-26", "Half-year review", "Six months in: profitable, disciplined, and the data shows exactly which setups pay. Goals for H2: hold winners longer (avg win R still below 1.5) and keep max daily loss untouched."],
  ] as const;

  for (let i = 0; i < dates.length; i++) {
    const [date, title, content] = dates[i];
    const nearby = trades
      .filter((t) => t.status === "Closed" && Math.abs(new Date(t.closedAt!).getTime() - new Date(date).getTime()) < 6 * 86400000)
      .slice(0, intBetween(rng, 1, 3))
      .map((t) => t.id);
    const moodIdx = content.includes("Rough") || content.includes("Drawdown") ? intBetween(rng, 3, 4) : content.includes("chop") ? 2 : intBetween(rng, 0, 1);
    entries.push({ id: `J-${String(i + 1).padStart(2, "0")}`, date, title, content, mood: MOODS[moodIdx], linkedTradeIds: nearby });
  }
  return entries;
}

export function generateWatchlist(): WatchlistItem[] {
  return [
    { id: "W-01", symbol: "HAL", assetClass: "Equity", note: "Defence orders momentum; watching for base breakout above 5,600.", plannedSetup: "Breakout", alertPrice: 5600, addedAt: "2026-06-12" },
    { id: "W-02", symbol: "NIFTY 25000 CE", assetClass: "Options", note: "Lottery only if index reclaims 24,800 with strong breadth.", plannedSetup: "Momentum", addedAt: "2026-06-18" },
    { id: "W-03", symbol: "TATAPOWER", assetClass: "Equity", note: "Coiling in a tight flag on the daily. Volume drying up nicely.", plannedSetup: "Trend Pullback", alertPrice: 465, addedAt: "2026-06-20" },
    { id: "W-04", symbol: "SILVERM FUT", assetClass: "Commodity", note: "Gold/silver ratio stretched; silver catch-up trade possible.", plannedSetup: "Mean Reversion", addedAt: "2026-06-22" },
    { id: "W-05", symbol: "ETH/INR", assetClass: "Crypto", note: "Holding above the 200D. Add on a clean retest, not on a green candle.", plannedSetup: "Swing Momentum", alertPrice: 275000, addedAt: "2026-06-24" },
    { id: "W-06", symbol: "KOTAKBANK", assetClass: "Equity", note: "Post-results drift setup, waiting for the gap to fill.", plannedSetup: "Gap & Go", alertPrice: 2210, addedAt: "2026-06-27" },
    { id: "W-07", symbol: "USDINR FUT", assetClass: "Forex", note: "RBI band play — fade moves toward 87.20 while the range holds.", plannedSetup: "Mean Reversion", alertPrice: 87.2, addedAt: "2026-06-29" },
    { id: "W-08", symbol: "DIXON", assetClass: "Equity", note: "Electronics PLI theme. High beta, size accordingly.", plannedSetup: "Breakout", addedAt: "2026-07-01" },
  ];
}

export function generateCashTransactions(): CashTransaction[] {
  return [
    { id: "CF-01", accountId: "acc-zerodha", type: "deposit", amount: 200000, date: "2025-12-01", note: "Topped up F&O margin" },
    { id: "CF-02", accountId: "acc-zerodha", type: "withdrawal", amount: 50000, date: "2026-03-15", note: "Personal use — profit booking" },
    { id: "CF-03", accountId: "acc-fyers", type: "deposit", amount: 100000, date: "2026-01-10", note: "Added to swing account" },
    { id: "CF-04", accountId: "acc-coindcx", type: "deposit", amount: 50000, date: "2025-11-20", note: "Initial crypto allocation" },
    { id: "CF-05", accountId: "acc-zerodha", type: "withdrawal", amount: 30000, date: "2026-06-05", note: "Monthly draw" },
  ];
}

/** Sample monthly targets — 3/4/6/7.2% of a portfolio that compounds through the
 *  months that have actually happened (Jan–Jun 2026). Future months stay empty:
 *  you only know your portfolio value for the current or a past month. */
export const SAMPLE_PORTFOLIO_TARGETS: PortfolioTargets = {
  percents: [3, 4, 6, 7.2],
  capitalByMonth: {
    "2026-01": 1000000,
    "2026-02": 1075000,
    "2026-03": 1150000,
    "2026-04": 1360000,
    "2026-05": 1310000,
    "2026-06": 1420000,
  },
};

export const SAMPLE_GOALS: Goals = {
  monthlyProfitTarget: 60000,
  winRateTarget: 55,
  maxDailyLoss: 12000,
  maxTradesPerDay: 6,
};
