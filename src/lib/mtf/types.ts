/** MTF Interest Tracker — domain model. Self-contained: do NOT import from
 *  src/types.ts and never extend the journal's Trade model (spec §2.8). */

export type MtfStatus = "Open" | "Closed";
export type InterestBasis = "total" | "funded";

export interface MtfBroker {
  id: string;
  name: string; // "Groww"
  dailyRatePct: number; // 0.041 (% per day)
}

export interface MtfCharges {
  // Method 1 — components (any may be 0/undefined)
  brokerage?: number;
  stt?: number;
  exchangeTxn?: number; // "Exchange Charges"
  gst?: number;
  sebi?: number;
  stampDuty?: number;
  dp?: number; // DP Charges
  other?: number;
  // Method 2 — manual override; if set, this wins over the component sum
  manualTotal?: number;
}

/** One buy tranche. Interest for a lot accrues from ITS OWN purchase date
 *  (inclusive) — buying ₹10k on 10 Jun and ₹10k more on 24 Jun charges the
 *  second ₹10k only from 24 Jun. */
export interface MtfLot {
  id: string; // "L1", "L2"…
  date: string; // ISO yyyy-MM-dd
  quantity: number;
  price: number; // buy price of this tranche
}

export interface MtfPosition {
  id: string; // "MTF-0001"
  stockName: string; // "Reliance Industries"
  symbol: string; // "RELIANCE"
  brokerId: string; // FK → MtfBroker
  /** Buy tranches. Optional for backward compatibility — when absent, the flat
   *  purchaseDate/quantity/avgBuyPrice fields below act as a single lot. */
  lots?: MtfLot[];
  /** Derived when lots exist: earliest lot date. Kept in sync on save. */
  purchaseDate: string; // ISO date (yyyy-MM-dd)
  /** Derived when lots exist: Σ lot quantities. */
  quantity: number;
  /** Derived when lots exist: totalInvestment ÷ quantity. */
  avgBuyPrice: number;
  totalInvestment: number; // Σ lot qty×price (manual override only for lot-less positions)
  currentPrice?: number; // optional manual/live price
  status: MtfStatus;
  notes?: string;

  // Interest settings
  dailyRatePct: number; // default from broker, editable per position
  interestBasis: InterestBasis; // default "total"
  fundedPercent: number; // default 100; only used when basis === "funded"
  manualInterestAdj?: number; // optional ± adjustment to accumulated interest

  charges: MtfCharges;

  // Snapshot fields — frozen on close (closed rows never compute live)
  exitDate?: string;
  exitPrice?: number;
  finalHoldingDays?: number;
  finalInterest?: number;
  finalCharges?: number;
  finalGrossProfit?: number;
  finalNetProfit?: number;
  finalBreakEvenPrice?: number;
}

/** Interest-health tiers (accumulated interest as % of gross profit). */
export type MtfHealthLevel = "green" | "blue" | "yellow" | "orange" | "red";

export type MtfAlertSeverity = "info" | "warning" | "loss";

export interface MtfAlert {
  severity: MtfAlertSeverity;
  title: string;
  detail: string;
  positionId: string;
  symbol: string;
}

/** One buy tranche with everything derived (per-lot interest from its own date). */
export interface ComputedLot {
  id: string;
  date: string;
  quantity: number;
  price: number;
  invested: number; // qty × price
  base: number; // invested × fundedPercent when basis === "funded"
  dailyInterest: number; // base × rate
  holdingDays: number; // elapsed days since THIS lot's date
  interestDays: number; // holdingDays + 1 (lot's purchase day inclusive)
  accumulatedInterest: number; // dailyInterest × interestDays
}

/** Everything derived for one position — pages consume this, never raw math. */
export interface ComputedPosition {
  pos: MtfPosition;
  broker: MtfBroker | undefined;
  isClosed: boolean;
  /** Normalized buy tranches (single synthetic lot for lot-less positions). */
  lots: ComputedLot[];
  isMultiLot: boolean;
  totalInvestment: number; // I = Σ lot invested
  interestBase: number;
  dailyInterest: number;
  holdingDays: number; // elapsed calendar days (bought today → 0); frozen for closed
  interestDays: number; // holdingDays + 1 (purchase day inclusive); frozen for closed
  accumulatedInterest: number;
  totalCharges: number;
  currentValue: number;
  grossProfit: number; // "Current Profit" (before financing)
  profitPct: number;
  netProfit: number; // gross − interest − charges
  netProfitPct: number;
  breakEvenPrice: number;
  breakEvenPct: number;
  extraPriceNeeded: number;
  extraProfitNeeded: number;
  healthPct: number; // Infinity when grossProfit ≤ 0
  health: MtfHealthLevel;
}

/** One row of the day-by-day series used by the per-position charts —
 *  piecewise when a position has multiple lots (slope kinks as tranches land). */
export interface DayPoint {
  dayIndex: number; // 0 = first lot's purchase day
  date: string; // ISO yyyy-MM-dd
  invested: number; // capital deployed up to this day
  quantity: number; // shares held up to this day
  cumInterest: number; // Σ per-lot interest accrued through this day
  breakEven: number; // (invested + cumInterest + charges) / quantity
}

export interface MtfForecast {
  extraDays: number;
  assumedExitPrice: number;
  addlInterest: number;
  futureTotalInterest: number;
  futureBreakEven: number;
  futureGross: number;
  futureNetProfit: number;
  minSellingPrice: number; // = futureBreakEven
  expectedReturnPct: number;
}

export interface PortfolioStats {
  open: ComputedPosition[];
  closed: ComputedPosition[];
  activeCount: number;
  closedCount: number;
  totalCapitalInvested: number; // Σ I (open)
  currentPortfolioValue: number; // Σ currentValue (open)
  grossUnrealized: number; // Σ grossProfit (open)
  openInterest: number; // Σ accumulatedInterest (open)
  openCharges: number; // Σ totalCharges (open)
  openNetProfit: number; // Σ netProfit (open) — net of the OPEN book only
  todaysInterest: number; // Σ dailyInterest (open) — today's burn
  yesterdaysInterest: number; // Σ dailyInterest (open, holdingDays ≥ 1)
  weeklyInterest: number; // Σ dailyInterest × min(interestDays, 7)
  monthlyInterest: number; // Σ dailyInterest × min(interestDays, 30)
  lifetimeInterest: number; // Σ accumulatedInterest (open) + Σ finalInterest (closed)
  totalInterestPaid: number; // = lifetimeInterest
  totalCharges: number; // open + closed
  netPortfolioProfit: number; // open net + closed final net
  avgDailyCost: number; // = todaysInterest
  avgDailyInterest: number; // mean per open position
  avgHoldingDays: number;
  avgPositionSize: number;
  avgInterestPerPosition: number;
  highestInterestPosition: ComputedPosition | null; // open
  longestHolding: ComputedPosition | null; // open
  mostExpensiveHolding: ComputedPosition | null; // open
  cheapestHolding: ComputedPosition | null; // open
  highestProfitStock: ComputedPosition | null; // all
  highestLossStock: ComputedPosition | null; // all
  newestPosition: ComputedPosition | null; // open
  estTomorrow: number;
  est7d: number;
  est30d: number;
  est90d: number;
}
