/** Pure analytics over Trade[] — pages pass in already-filtered trades.
 *  Only Closed trades count toward P&L stats; helpers filter internally. */

import type { CashTransaction, Trade } from "@/types";

/** Net cash movement: deposits added minus withdrawals taken out. */
export function netCashFlow(txns: CashTransaction[]): number {
  return txns.reduce((sum, t) => sum + (t.type === "deposit" ? t.amount : -t.amount), 0);
}

/** Signed daily cash deltas (+deposit / −withdrawal) for the equity curve. */
export function cashFlowDeltas(txns: CashTransaction[]): { date: string; amount: number }[] {
  return txns.map((t) => ({ date: t.date.slice(0, 10), amount: t.type === "deposit" ? t.amount : -t.amount }));
}

export const closedOf = (trades: Trade[]) =>
  trades.filter((t) => t.status === "Closed").sort(byCloseDate);

const byCloseDate = (a: Trade, b: Trade) =>
  new Date(a.closedAt ?? a.openedAt).getTime() - new Date(b.closedAt ?? b.openedAt).getTime();

const dayKey = (iso: string) => iso.slice(0, 10); // yyyy-MM-dd
const monthKey = (iso: string) => iso.slice(0, 7); // yyyy-MM

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const monthLabel = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTHS[m - 1]} ${String(y).slice(2)}`;
};

export interface Kpis {
  totalNetPnl: number;
  totalGrossPnl: number;
  totalCharges: number;
  totalTax: number;
  totalTrades: number;
  closedTrades: number;
  openTrades: number;
  wins: number;
  losses: number;
  breakevens: number;
  winRate: number; // %
  profitFactor: number;
  expectancy: number; // avg net pnl per closed trade
  avgWin: number;
  avgLoss: number; // negative number
  payoffRatio: number;
  avgR: number;
  bestTrade: Trade | null;
  worstTrade: Trade | null;
  currentStreak: number; // +n win streak, -n loss streak
  maxWinStreak: number;
  maxLossStreak: number;
  maxDrawdown: number; // positive rupees
  maxDrawdownPct: number; // % of peak equity
  roiPct: number;
  avgHoldingMinutes: number;
  sharpe: number; // daily-return Sharpe-like ratio, annualised √252
  chargesPctOfGross: number;
}

export function computeKpis(trades: Trade[], startingCapital: number): Kpis {
  const closed = closedOf(trades);
  const wins = closed.filter((t) => t.netPnl > 0);
  const losses = closed.filter((t) => t.netPnl < 0);
  const breakevens = closed.length - wins.length - losses.length;

  const totalNetPnl = sum(closed.map((t) => t.netPnl));
  const totalGrossPnl = sum(closed.map((t) => t.grossPnl));
  // charges over the SAME closed population as the P&L it's compared against
  const totalCharges = sum(closed.map((t) => t.charges.total));
  const totalTax = sum(closed.map((t) => t.tax.estimatedTax));
  const grossWins = sum(wins.map((t) => t.netPnl));
  const grossLosses = Math.abs(sum(losses.map((t) => t.netPnl)));

  const rs = closed.map((t) => t.rMultiple).filter((r): r is number => r !== undefined);

  // streaks over close-date order
  let cur = 0;
  let maxWin = 0;
  let maxLoss = 0;
  for (const t of closed) {
    if (t.netPnl > 0) cur = cur > 0 ? cur + 1 : 1;
    else if (t.netPnl < 0) cur = cur < 0 ? cur - 1 : -1;
    else cur = 0;
    maxWin = Math.max(maxWin, cur);
    maxLoss = Math.min(maxLoss, cur);
  }

  const { maxDrawdown, maxDrawdownPct } = drawdownStats(closed, startingCapital);

  return {
    totalNetPnl,
    totalGrossPnl,
    totalCharges,
    totalTax,
    totalTrades: trades.filter((t) => t.status !== "Cancelled").length,
    closedTrades: closed.length,
    openTrades: trades.filter((t) => t.status === "Open").length,
    wins: wins.length,
    losses: losses.length,
    breakevens,
    winRate: closed.length ? (wins.length / closed.length) * 100 : 0,
    profitFactor: grossLosses > 0 ? grossWins / grossLosses : grossWins > 0 ? Infinity : 0,
    expectancy: closed.length ? totalNetPnl / closed.length : 0,
    avgWin: wins.length ? grossWins / wins.length : 0,
    avgLoss: losses.length ? -grossLosses / losses.length : 0,
    payoffRatio:
      wins.length && losses.length ? grossWins / wins.length / (grossLosses / losses.length) : 0,
    avgR: rs.length ? sum(rs) / rs.length : 0,
    bestTrade: closed.length ? closed.reduce((a, b) => (b.netPnl > a.netPnl ? b : a)) : null,
    worstTrade: closed.length ? closed.reduce((a, b) => (b.netPnl < a.netPnl ? b : a)) : null,
    currentStreak: cur,
    maxWinStreak: maxWin,
    maxLossStreak: Math.abs(maxLoss),
    maxDrawdown,
    maxDrawdownPct,
    roiPct: startingCapital ? (totalNetPnl / startingCapital) * 100 : 0,
    avgHoldingMinutes: closed.length
      ? sum(closed.map((t) => t.holdingMinutes ?? 0)) / closed.length
      : 0,
    sharpe: sharpeOf(closed),
    chargesPctOfGross:
      Math.abs(totalGrossPnl) > 0 ? (totalCharges / Math.abs(totalGrossPnl)) * 100 : 0,
  };
}

const sum = (ns: number[]) => ns.reduce((a, b) => a + b, 0);

function sharpeOf(closed: Trade[]): number {
  const daily = dailyPnl(closed).map((d) => d.pnl);
  if (daily.length < 2) return 0;
  const mean = sum(daily) / daily.length;
  const sd = Math.sqrt(sum(daily.map((v) => (v - mean) ** 2)) / (daily.length - 1));
  return sd > 0 ? (mean / sd) * Math.sqrt(252) : 0;
}

function drawdownStats(closed: Trade[], startingCapital: number) {
  let equity = startingCapital;
  let peak = startingCapital;
  let maxDrawdown = 0;
  let maxDrawdownPct = 0;
  for (const t of closed) {
    equity += t.netPnl;
    peak = Math.max(peak, equity);
    const dd = peak - equity;
    if (dd > maxDrawdown) {
      maxDrawdown = dd;
      maxDrawdownPct = peak > 0 ? (dd / peak) * 100 : 0;
    }
  }
  return { maxDrawdown, maxDrawdownPct };
}

/** Cumulative equity per event-day. `equity` = capital + running P&L + running
 *  cash flow (deposits/withdrawals); `cumPnl` stays P&L-only so sparklines and
 *  ROI aren't distorted by funding. Cash flows are optional & backward-compatible. */
export function equityCurve(
  trades: Trade[],
  startingCapital: number,
  cashFlows: { date: string; amount: number }[] = [],
) {
  const pnlByDay = new Map(dailyPnl(trades).map((d) => [d.date, d.pnl]));
  const cashByDay = new Map<string, number>();
  for (const cf of cashFlows) {
    const day = cf.date.slice(0, 10);
    cashByDay.set(day, (cashByDay.get(day) ?? 0) + cf.amount);
  }
  const days = [...new Set([...pnlByDay.keys(), ...cashByDay.keys()])].sort((a, b) => a.localeCompare(b));
  const out: { date: string; equity: number; cumPnl: number }[] = [];
  let cumPnl = 0;
  let cumCash = 0;
  for (const date of days) {
    cumPnl += pnlByDay.get(date) ?? 0;
    cumCash += cashByDay.get(date) ?? 0;
    out.push({ date, equity: startingCapital + cumPnl + cumCash, cumPnl });
  }
  return out;
}

/** Peak-to-trough drawdown per day (negative rupee values for the area chart). */
export function drawdownSeries(trades: Trade[], startingCapital: number) {
  const curve = equityCurve(trades, startingCapital);
  let peak = startingCapital;
  return curve.map((p) => {
    peak = Math.max(peak, p.equity);
    return {
      date: p.date,
      drawdown: -(peak - p.equity),
      drawdownPct: peak > 0 ? -((peak - p.equity) / peak) * 100 : 0,
    };
  });
}

export function dailyPnl(trades: Trade[]) {
  const map = new Map<string, { pnl: number; trades: number }>();
  for (const t of closedOf(trades)) {
    const key = dayKey(t.closedAt!);
    const cur = map.get(key) ?? { pnl: 0, trades: 0 };
    cur.pnl += t.netPnl;
    cur.trades += 1;
    map.set(key, cur);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, pnl: v.pnl, trades: v.trades }));
}

export function monthlyPnl(trades: Trade[]) {
  const map = new Map<string, { pnl: number; gross: number; charges: number; tax: number; trades: number; wins: number }>();
  for (const t of closedOf(trades)) {
    const key = monthKey(t.closedAt!);
    const cur = map.get(key) ?? { pnl: 0, gross: 0, charges: 0, tax: 0, trades: 0, wins: 0 };
    cur.pnl += t.netPnl;
    cur.gross += t.grossPnl;
    cur.charges += t.charges.total;
    cur.tax += t.tax.estimatedTax;
    cur.trades += 1;
    if (t.netPnl > 0) cur.wins += 1;
    map.set(key, cur);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, label: monthLabel(month), ...v, winRate: v.trades ? (v.wins / v.trades) * 100 : 0 }));
}

export interface GroupPerf {
  name: string;
  pnl: number;
  gross: number;
  charges: number;
  trades: number;
  wins: number;
  winRate: number;
  avgR: number;
}

/** Generic group-by performance (symbol, strategy, tag, asset class…). */
export function pnlBy(trades: Trade[], keyOf: (t: Trade) => string | string[]): GroupPerf[] {
  const map = new Map<string, { pnl: number; gross: number; charges: number; trades: number; wins: number; rSum: number; rN: number }>();
  for (const t of closedOf(trades)) {
    const keys = keyOf(t);
    for (const key of Array.isArray(keys) ? keys : [keys]) {
      const cur = map.get(key) ?? { pnl: 0, gross: 0, charges: 0, trades: 0, wins: 0, rSum: 0, rN: 0 };
      cur.pnl += t.netPnl;
      cur.gross += t.grossPnl;
      cur.charges += t.charges.total;
      cur.trades += 1;
      if (t.netPnl > 0) cur.wins += 1;
      if (t.rMultiple !== undefined) {
        cur.rSum += t.rMultiple;
        cur.rN += 1;
      }
      map.set(key, cur);
    }
  }
  return [...map.entries()]
    .map(([name, v]) => ({
      name,
      pnl: v.pnl,
      gross: v.gross,
      charges: v.charges,
      trades: v.trades,
      wins: v.wins,
      winRate: v.trades ? (v.wins / v.trades) * 100 : 0,
      avgR: v.rN ? v.rSum / v.rN : 0,
    }))
    .sort((a, b) => b.pnl - a.pnl);
}

/** Histogram of R multiples in fixed buckets. */
export function rHistogram(trades: Trade[], bucketSize = 0.5) {
  const rs = closedOf(trades)
    .map((t) => t.rMultiple)
    .filter((r): r is number => r !== undefined);
  if (!rs.length) return [];
  const lo = Math.floor(Math.min(...rs) / bucketSize) * bucketSize;
  // ensure at least one bucket even when every R lands on the same boundary
  const hi = Math.max(Math.ceil(Math.max(...rs) / bucketSize) * bucketSize, lo + bucketSize);
  const buckets: { from: number; label: string; count: number; mid: number }[] = [];
  for (let b = lo; b < hi; b += bucketSize) {
    const from = Math.round(b * 100) / 100;
    buckets.push({ from, mid: from + bucketSize / 2, label: `${from}R`, count: 0 });
  }
  for (const r of rs) {
    const idx = Math.min(buckets.length - 1, Math.max(0, Math.floor((r - lo) / bucketSize)));
    buckets[idx].count += 1;
  }
  return buckets;
}

/** Month-by-month win rate and average R (trend lines). */
export function winRateOverTime(trades: Trade[]) {
  return monthlyPnl(trades).map((m) => ({ month: m.month, label: m.label, winRate: m.winRate, avgR: avgRForMonth(trades, m.month) }));
}

function avgRForMonth(trades: Trade[], ym: string) {
  const rs = closedOf(trades)
    .filter((t) => monthKey(t.closedAt!) === ym)
    .map((t) => t.rMultiple)
    .filter((r): r is number => r !== undefined);
  return rs.length ? sum(rs) / rs.length : 0;
}

export function longShortSplit(trades: Trade[]): GroupPerf[] {
  return pnlBy(trades, (t) => t.direction);
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function dayOfWeekPerf(trades: Trade[]) {
  const grouped = pnlBy(trades, (t) => DAYS[new Date(t.closedAt!).getDay()]);
  return DAYS.filter((d) => d !== "Sun" || grouped.some((g) => g.name === "Sun"))
    .map((day) => grouped.find((g) => g.name === day) ?? { name: day, pnl: 0, gross: 0, charges: 0, trades: 0, wins: 0, winRate: 0, avgR: 0 })
    .filter((g) => g.trades > 0 || ["Mon", "Tue", "Wed", "Thu", "Fri"].includes(g.name));
}

export function hourOfDayPerf(trades: Trade[]) {
  const grouped = pnlBy(trades, (t) => String(new Date(t.openedAt).getHours()).padStart(2, "0"));
  return grouped
    .map((g) => ({ ...g, hour: Number(g.name), label: `${g.name}:00` }))
    .sort((a, b) => a.hour - b.hour);
}

/** Day cells for a calendar month; day = 1..31 with pnl/trade count. */
export function calendarMonth(trades: Trade[], year: number, month0: number) {
  const daily = new Map(dailyPnl(trades).map((d) => [d.date, d]));
  const days: { date: string; day: number; pnl: number; trades: number }[] = [];
  const last = new Date(year, month0 + 1, 0).getDate();
  for (let day = 1; day <= last; day++) {
    const date = `${year}-${String(month0 + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const hit = daily.get(date);
    days.push({ date, day, pnl: hit?.pnl ?? 0, trades: hit?.trades ?? 0 });
  }
  return days;
}

/** Average of monthly % returns — each month's net P&L ÷ that month's portfolio
 *  value, averaged over every month that has a portfolio value entered. Because
 *  it normalises by each month's capital, it reflects % performance regardless of
 *  how the portfolio size changes over time. */
export function averageMonthlyReturn(
  trades: Trade[],
  capitalByMonth: Record<string, number>,
): { avgPct: number; months: number; bestPct: number; worstPct: number } {
  const pnlByMonth = new Map(monthlyPnl(trades).map((m) => [m.month, m.pnl]));
  const returns: number[] = [];
  for (const [ym, cap] of Object.entries(capitalByMonth)) {
    if (cap > 0) returns.push(((pnlByMonth.get(ym) ?? 0) / cap) * 100);
  }
  const months = returns.length;
  return {
    avgPct: months ? returns.reduce((a, b) => a + b, 0) / months : 0,
    months,
    bestPct: months ? Math.max(...returns) : 0,
    worstPct: months ? Math.min(...returns) : 0,
  };
}

/** Indian financial year key for a date: "FY 2025-26". */
export function financialYearOf(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const fyStart = d.getMonth() >= 3 ? y : y - 1;
  return `FY ${fyStart}-${String((fyStart + 1) % 100).padStart(2, "0")}`;
}
