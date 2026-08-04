# MTF Module — Agent Contract (addendum to CONTRACT.md)

You are building part of the **MTF Interest Tracker** module inside LedgerX. TWO documents govern your work, in this priority order:
1. **MTF_TRACKER_SPEC.md** (project root) — the full feature spec. READ IT FIRST, it is authoritative for content/behavior/colors.
2. **CONTRACT.md** (project root) — the app-wide design rules, UI kit, chart rules, Tailwind tokens. All its hard rules apply (own files only, `@/` imports, no commands, strict TS, EmptyState everywhere).

The CORE of the MTF module is DONE and FROZEN — do not modify these files, only consume them:

## Frozen MTF core (exact APIs)

### `@/lib/mtf/types`
`MtfStatus`, `InterestBasis`, `MtfBroker {id,name,dailyRatePct}`, `MtfCharges` (brokerage?/stt?/exchangeTxn?/gst?/sebi?/stampDuty?/dp?/other?/manualTotal?), `MtfPosition` (see spec §4 — includes dailyRatePct, interestBasis, fundedPercent, manualInterestAdj?, charges, final* snapshot fields), `MtfHealthLevel` = "green"|"blue"|"yellow"|"orange"|"red", `MtfAlert {severity:"info"|"warning"|"loss", title, detail, positionId, symbol}`, **`ComputedPosition`** (pos, broker, isClosed, totalInvestment, interestBase, dailyInterest, holdingDays, interestDays, accumulatedInterest, totalCharges, currentValue, grossProfit, profitPct, netProfit, netProfitPct, breakEvenPrice, breakEvenPct, extraPriceNeeded, extraProfitNeeded, healthPct, health), `MtfForecast` (extraDays, assumedExitPrice, addlInterest, futureTotalInterest, futureBreakEven, futureGross, futureNetProfit, minSellingPrice, expectedReturnPct), **`PortfolioStats`** (open: ComputedPosition[], closed: ComputedPosition[], activeCount, closedCount, totalCapitalInvested, currentPortfolioValue, grossUnrealized, todaysInterest, yesterdaysInterest, weeklyInterest, monthlyInterest, lifetimeInterest, totalInterestPaid, totalCharges, netPortfolioProfit, avgDailyCost, avgDailyInterest, avgHoldingDays, avgPositionSize, avgInterestPerPosition, highestInterestPosition|longestHolding|mostExpensiveHolding|cheapestHolding|highestProfitStock|highestLossStock|newestPosition: ComputedPosition|null, estTomorrow, est7d, est30d, est90d).

### Multi-lot positions (per-tranche interest — validated 35/35)
`MtfPosition.lots?: MtfLot[]` — buy tranches `{id, date, quantity, price}`. Each lot accrues interest FROM ITS OWN DATE (inclusive). When `lots` is absent the flat purchaseDate/quantity/avgBuyPrice act as a single lot (full backward compat). When lots exist, the flat fields are DERIVED (purchaseDate = earliest lot, quantity = Σ, totalInvestment = Σ qty×price, avgBuyPrice = I/qty) and MUST be written in sync on save.
`ComputedPosition` now includes `lots: ComputedLot[]` (`{id, date, quantity, price, invested, base, dailyInterest, holdingDays, interestDays, accumulatedInterest}` — per-lot, already accrued to today/exit) and `isMultiLot: boolean`. `accumulatedInterest` on the position = Σ per-lot. `holdingDays` = since the FIRST lot.
New calc exports: `normalizeLots(pos): MtfLot[]` (sorted; synthesizes one lot for legacy) and **`buildDaySeries(cp, {futureDays?, maxPoints?}): DayPoint[]`** — `{dayIndex, date, invested, quantity, cumInterest, breakEven}` from the first lot's day to today (+future), piecewise across lots (slope kinks on tranche days; lot days always kept). Per-position charts MUST use this instead of deriving `dailyInterest × (i+1)` themselves — that formula is now wrong for multi-lot positions.

### `@/lib/mtf/calc` (pure, validated 42/42 — NEVER re-derive math in components)
- `computePosition(pos, brokers, asOf): ComputedPosition` — closed positions read their frozen snapshot.
- `computePortfolio(positions, brokers, asOf): PortfolioStats`
- `forecastPosition(cp, extraDays, assumedExitPrice?): MtfForecast`
- `buildCloseSnapshot(pos, exitPrice, exitDateISO)` (used by the store — you won't need it)
- `computeAlerts(cp): MtfAlert[]` (open positions only; returns [] for closed)
- `chargesTotal(charges): number` · `healthLevel(pct): MtfHealthLevel` · `annualizedPct(dailyRatePct): number` (0.041 → 14.97)
- `fetchPrice(symbol): Promise<number|null>` — inert stub, do not call in v1 UI.

### `@/store/useMtfStore`
`useMtfStore(selector)` — state `{positions: MtfPosition[], brokers: MtfBroker[]}`; actions `addPosition(p)`, `updatePosition(id, patch)`, `deletePosition(id)`, `duplicatePosition(id)`, `closePosition(id, exitPrice, exitDateISO)`, `reopenPosition(id)`, `addBroker/updateBroker/deleteBroker`, `resetSampleData()`, `clearAll()`.
Also: `nextMtfId(positions): string` ("MTF-0009") and **`useAsOfToday(): Date`** — THE clock for all live math (real startOfDay(now), self-refreshes past midnight). Standard page pattern:
```ts
const positions = useMtfStore((s) => s.positions);
const brokers = useMtfStore((s) => s.brokers);
const asOf = useAsOfToday();
const stats = useMemo(() => computePortfolio(positions, brokers, asOf), [positions, brokers, asOf]);
```

### `@/lib/mtf/palette`
`MTF_COLORS {interest:"#f59e0b", breakEven:"#eab308", holding:"#38bdf8", forecast:"#7c5cff", profit:"#16a34a", loss:"#ef4444"}` — chart hexes; `HEALTH_META[level] {label, className, dot}` for the health badge; `ALERT_META[severity] {className, iconClass}`. These are the ONLY raw-hex sources allowed (plus shared chartTheme).

### `@/lib/mtf/exportMtf`
`downloadMtfCsv(computed: ComputedPosition[])` · `printMtfReport(stats: PortfolioStats): boolean` (false = popup blocked → toast an error).

### Already wired (do not touch)
Routes `/mtf` + `/mtf/:id` in App.tsx; sidebar "MTF Interest" (Money section). `src/pages/Mtf.tsx` and `src/pages/MtfPositionDetail.tsx` exist as placeholders — the assigned agents REPLACE their contents (keep default export).

## Component interface contract — EXACT exports (cross-agent imports depend on these)

Files under `src/pages/mtf/`. Use NAMED exports with EXACTLY these signatures:

```ts
// StatGrid.tsx
export function StatGrid({ stats }: { stats: PortfolioStats })
// LiveInterestMeter.tsx
export function LiveInterestMeter({ stats }: { stats: PortfolioStats })
// PortfolioAnalytics.tsx
export function PortfolioAnalytics({ stats }: { stats: PortfolioStats })
// AlertsPanel.tsx — renders null when no alerts
export function AlertsPanel({ computed }: { computed: ComputedPosition[] })
// HealthBadge.tsx
export function HealthBadge({ cp }: { cp: ComputedPosition })
// FilterSortBar.tsx
export type MtfSortKey = "interestDesc"|"interestAsc"|"profitDesc"|"profitAsc"|"holdingDesc"|"newest"|"oldest"|"investmentDesc"|"chargesDesc"|"netProfitDesc";
export interface MtfFilterState { status: "All"|"Open"|"Closed"; brokerId: string /* "all" or id */; query: string; sort: MtfSortKey; }
export const DEFAULT_MTF_FILTERS: MtfFilterState; // {status:"All", brokerId:"all", query:"", sort:"newest"}
export function applyFilterSort(computed: ComputedPosition[], f: MtfFilterState): ComputedPosition[]; // pure
export function FilterSortBar({ value, onChange, brokers }: { value: MtfFilterState; onChange: (v: MtfFilterState) => void; brokers: MtfBroker[] })
// PositionsTable.tsx — row click navigates to /mtf/:id itself (useNavigate)
export function PositionsTable({ rows, variant, onEdit, onClosePosition, onDuplicate, onDelete }: {
  rows: ComputedPosition[];
  variant: "open" | "closed";
  onEdit: (id: string) => void;
  onClosePosition: (id: string) => void; // open a ClosePositionModal (ignored for closed variant)
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void; // the TABLE owns the delete-confirm Modal, then calls onDelete(id)
})
// PositionFormModal.tsx — self-contained: writes to the store itself, toasts, closes
export function PositionFormModal({ open, initial, onClose }: { open: boolean; initial: MtfPosition | null; onClose: () => void })
// ClosePositionModal.tsx — self-contained: calls closePosition, toasts, closes
export function ClosePositionModal({ open, position, onClose }: { open: boolean; position: MtfPosition | null; onClose: () => void })
// ProfitConsumptionBar.tsx
export function ProfitConsumptionBar({ cp }: { cp: ComputedPosition })
// ForecastCalculator.tsx
export function ForecastCalculator({ cp }: { cp: ComputedPosition })
```

Charts under `src/pages/mtf/charts/` — one file per chart, named export = filename:
```ts
// per-position (each: { cp }: { cp: ComputedPosition })
DailyInterestGrowthChart.tsx   → export function DailyInterestGrowthChart({ cp })
CumulativeInterestChart.tsx    → export function CumulativeInterestChart({ cp })
InterestVsProfitChart.tsx      → export function InterestVsProfitChart({ cp })
InterestVsHoldingDaysChart.tsx → export function InterestVsHoldingDaysChart({ cp })
BreakEvenGrowthChart.tsx       → export function BreakEvenGrowthChart({ cp })
ProjectedInterestChart.tsx     → export function ProjectedInterestChart({ cp })
// portfolio (each: { computed }: { computed: ComputedPosition[] } — pass open+closed or open as spec'd)
PortfolioInterestTrendChart.tsx → export function PortfolioInterestTrendChart({ computed })
TopInterestStocksChart.tsx      → export function TopInterestStocksChart({ computed })
InterestDistributionChart.tsx   → export function InterestDistributionChart({ computed })
CapitalAllocationChart.tsx      → export function CapitalAllocationChart({ computed })
ProfitVsInterestChart.tsx       → export function ProfitVsInterestChart({ computed })
NetProfitTrendChart.tsx         → export function NetProfitTrendChart({ computed })
HoldingDurationChart.tsx        → export function HoldingDurationChart({ computed })
```
Per-position time-series data: derive inside the chart from `cp` — day i in 0..holdingDays, cumulative interest = dailyInterest × (i+1); break-even at day i = (I + dailyInterest×(i+1) + charges)/qty. Projected: from today forward N days (use 30) via the same formula. X labels: "D0","D5"… or dates via date-fns addDays(purchaseDate, i) → formatDateShort. Downsample to ≤ 60 points for long holds (step = ceil(days/60)).

## Module color rules (spec §2.2 — stricter than app defaults)
Interest figures/series → amber (`text-warning` / MTF_COLORS.interest). Break-even → `#eab308` via palette (never a Tailwind token; in JSX use the documented arbitrary classes from HEALTH_META or inline style with MTF_COLORS.breakEven for chart strokes/label dots only — text still uses standard tokens with a colored dot beside it). Holding/duration → info blue. Forecast framing → accent. P&L → profit/loss tokens + `pnlClass`. Currency INR default — `formatMoney(v)` everywhere; percents `formatPct`.

## Money formatting hint
Daily interest is small (₹2–₹60) — use `formatMoney(v, {decimals:true})` for interest/charges cells; compact for big KPIs.
