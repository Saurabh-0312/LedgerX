# MTF Interest Tracker — Build Spec for LedgerX

> **How to use this file:** Paste this whole document to Fable as the build brief. It is a complete, self-contained specification for adding a new **MTF (Margin Trading Facility) Interest Tracker** module to the existing **LedgerX** trading-journal app. It already accounts for the app's real theme, conventions, and frozen core, so Fable should follow it literally rather than invent new patterns.

---

## 0. Mission

Build a **premium financial dashboard** inside LedgerX that tracks the *real* profitability of Groww MTF positions after **daily interest**, **brokerage/taxes/charges**, and **break-even**. It must look and feel identical to the rest of LedgerX (TradingView / Linear / Vercel / Stripe / Notion energy), recalculate automatically as days pass, and support multiple simultaneous positions and multiple brokers.

The module is a **new sidebar section → new pages**, with its **own data store** and its **own daily-interest math**. It must not disturb the existing trade-journal data model.

---

## 1. The existing app — what you MUST reuse (do not reinvent)

LedgerX is **Vite + React 18 + TypeScript (strict) + Tailwind v4 + Recharts 2 + zustand + react-router 6 + lucide-react + date-fns**. Import shared code via the `@/` alias (maps to `src/`). Import types with `import type`.

### 1.1 Theme tokens (from `src/index.css` — already defined, use these class names, NO raw hex in JSX)
| Purpose | Token / class | Value |
|---|---|---|
| App background | `bg-base` | `#0a0b0d` *(this is the "pure black" — **do not** use `#090909`)* |
| Card surface | `bg-surface` / `card` utility | `#141619` glass |
| Popover/hover | `bg-raised` | `#1c1f24` |
| Borders | `border-edge`, `border-edge-soft` | `#262a31` / `#1e2228` |
| Primary text | `text-ink` | `#e6e8eb` |
| Secondary text | `text-muted` | `#8b929d` |
| Tertiary text | `text-faint` | `#5c626c` |
| Brand / **Forecasts (purple)** | `text-accent` / `bg-accent-soft` | `#7c5cff` |
| **Profit (green)** | `text-profit` / `bg-profit-soft` | `#22c55e` |
| **Loss (red)** | `text-loss` / `bg-loss-soft` | `#ef4444` |
| **Interest (orange)** | `text-warning` / `bg-warning-soft` | `#f59e0b` |
| **Holding info (blue)** | `text-info` / `bg-info-soft` | `#38bdf8` |

Utilities available: `card` (glass surface + hover lift), `glass-pop` (modals/drawers), `tnum` (tabular figures for number columns), `label-caps` (uppercase muted labels), `input-base`, `animate-in`, `animate-pop`, `skeleton`. Fonts: default sans = Inter; `font-mono` = JetBrains Mono.

> **Break-even yellow:** LedgerX has **no yellow token**. For break-even accents use a local constant `#eab308` (yellow-500) defined inside this module's own chart palette file — never edit `index.css`.

### 1.2 UI kit (`@/components/ui/*`) — build the whole module out of these
- `PageHeader {title, description?, actions?}` — every page starts with this.
- `Card {title?, subtitle?, action?, className?, bodyClassName?, children}` — the house card; charts & tables live inside Cards.
- `KpiCard {label, value:number, format:(n)=>string, delta?:{text,direction:"up"|"down"|"flat",upIsGood?}, icon?:LucideIcon, sub?, toneBySign?, spark?:number[]}` — **animated count-up stat tile** (already animates on value change — use it for every stat card so "cards animate when values change" is free).
- `Badge {tone?: "profit"|"loss"|"accent"|"warning"|"info"|"neutral"}`, plus `StatusBadge`.
- `Button {variant?: "primary"|"outline"|"ghost"|"danger", size?, icon?}`.
- `Field {label,hint?,error?,required?,children:(id)=>ReactNode}` + `Input`, `Select`, `Textarea`.
- `Modal {open,onClose,title?,widthClass?}` and `Drawer {open,onClose,title?,widthClass?}` from `@/components/ui/Modal`.
- `TableShell/TH/TD/rowClass` from `@/components/ui/Table` — numeric cells get `className="tnum text-right"`.
- `EmptyState {icon?,title,hint?,action?}`, `ProgressBar {value:0-100, tone?}`, `Skeleton`.

### 1.3 Formatting (`@/lib/format`) — use for ALL money/%/dates
`formatMoney(v, {currency?, compact?, sign?, decimals?})` → `"₹1,23,456"` / compact `"₹1.2L"`; `formatPct(v, dp?, sign?)`; `formatNumber(v, dp?)`; `formatDate(iso)` `"12 Mar 2026"`; `formatDateShort`; `pnlClass(v)` → `text-profit/loss/muted`; `pnlMarkColor(v)` → chart hex per sign. Currency defaults to **INR** — correct everywhere here.

### 1.4 Charts (`@/components/charts/*`)
- `chartTheme`: `CAT` (8 fixed categorical slots — assign in order, never cycle), `PNL {profit:"#16a34a", loss:"#ef4444"}`, `WARNING`, `INFO`, `ACCENT`, `GRID`, `axisDefaults`, `gridDefaults`, `BAR_MAX`, `BAR_RADIUS`, `BAR_RADIUS_H`, `AREA_OPACITY`.
- `ChartTooltip` — pass to Recharts: `<Tooltip content={<ChartTooltip valueFormatter={(v)=>formatMoney(v,{compact:true,sign:true})}/>} cursor={{fill: CURSOR_FILL}}/>`.
- Chart rules: `<ResponsiveContainer width="100%" height={240..320}>` inside a `Card`; `<XAxis {...axisDefaults}/>`, `<YAxis {...axisDefaults} tickFormatter/>`, `<CartesianGrid {...gridDefaults}/>`; no dashed lines, no axis lines; bars `maxBarSize={24}` + `radius={BAR_RADIUS}`; lines `strokeWidth={2} dot={false}`; ONE series → no `<Legend/>`, TWO+ → `<Legend/>` required. **Never color text with chart hues.**

### 1.5 Toast (`@/store/toast`)
`toast(message, tone?: "success"|"error"|"info")` — call after every user action (add/edit/delete/close/duplicate/export).

### 1.6 CSV/print (`@/lib/csv`)
`toCsv(headers, rows): string`, `downloadFile(filename, content, mime?)`. Reuse these for CSV/"Excel". For PDF/print use `window.print()` with a print stylesheet (mirror the pattern in `src/pages/reports/printReport.ts`). **Do not add jsPDF, xlsx, or any new dependency.**

---

## 2. Decisions & corrections (already reconciled with the codebase)

1. **Background** = existing `bg-base` (#0a0b0d) with the app's ambient glows — not a new #090909.
2. **Accent color mapping:** Profit→`profit`, Loss→`loss`, **Interest→`warning` (amber #f59e0b)**, **Holding→`info` (#38bdf8)**, **Forecast→`accent` (#7c5cff)**, **Break-even→local `#eab308`**.
3. **Interest basis (important, real-world correction):** Groww actually charges MTF interest on the **broker-funded (borrowed) amount**, not the whole position. To stay both correct and simple:
   - Add an optional field **Funded / Margin split**. `interestBase = fundedPercent < 100 ? totalInvestment × fundedPercent/100 : totalInvestment`.
   - **Default `fundedPercent = 100`** so the out-of-the-box behavior equals your current mental model (interest on total value). Power users can set the real borrowed %.
4. **Interest rate:** default **0.041% / day** (≈ **14.97% p.a.**, since 0.041×365). Keep it **editable per position and per broker** — Groww's published MTF rate changes over time and differs by tier, so never hard-code beyond the default. Show the annualized equivalent next to the field as a live hint.
5. **"Current Profit" vs "Net Profit":** *Current/Gross Profit* = market value − investment (before financing). *Net Profit* = gross − accumulated interest − charges. Label them consistently everywhere.
6. **Break-even charges:** exit brokerage technically depends on the exit price (mild circularity). Keep it simple and honest: treat the position's entered **Total Charges** as the all-in **round-trip** estimate and fold it straight into break-even. Show a one-line note "assumes round-trip charges ≈ ₹X".
7. **Daily recalculation:** no backend/cron. Recompute from **real `new Date()`** on every render (holding days via `date-fns differenceInCalendarDays(startOfDay(now), startOfDay(purchaseDate))`). Do **not** use the sample-data `datasetToday` helper — that's only for the synthetic journal trades. Add a lightweight "recompute at midnight" effect (a `setInterval` that re-renders once past local midnight) so an always-open tab rolls over.
   - **Interest accrues from the purchase day (inclusive):** a position bought *today* already carries **1 day** of interest. So `interestDays = holdingDays + 1` and interest = `dailyInterest × interestDays`. This is the conservative/safe side (never under-counts financing cost). The "Holding Days" column still shows *elapsed* days (bought-today ⇒ 0); only the interest math adds the purchase day.
8. **Data isolation:** MTF gets its **own persisted zustand store** (`mtf-store` localStorage key) and its **own types**. Do **not** extend `Trade`, `useStore`, or `src/types.ts`.
9. **Shared files you MAY edit — only these two:** `src/App.tsx` (add the routes) and `src/components/layout/Sidebar.tsx` (add the nav item). Everything else you create is new files under `src/pages/mtf/` and `src/store/`.
10. **Live prices:** manual "Current Market Price" entry in v1. Put fetching behind a `priceProvider` seam (a stub function) so a real API can drop in later. No network calls in v1.

---

## 3. File plan

**Create (new files you own):**
```
src/store/useMtfStore.ts            # self-contained persisted zustand store + sample seed
src/lib/mtf/types.ts                # MtfPosition, MtfBroker, Charges, computed types
src/lib/mtf/calc.ts                 # ALL pure calculation functions (see §5)
src/lib/mtf/sampleMtf.ts            # 5–6 realistic seed positions (Indian stocks, INR)
src/lib/mtf/palette.ts             # local chart palette incl. break-even #eab308
src/lib/mtf/exportMtf.ts            # CSV + print helpers (wrap @/lib/csv)
src/pages/Mtf.tsx                   # default export — the dashboard/overview page (route /mtf)
src/pages/MtfPositionDetail.tsx     # default export — detail page (route /mtf/:id)
src/pages/mtf/StatGrid.tsx          # the KPI grid (uses KpiCard)
src/pages/mtf/LiveInterestMeter.tsx # the hero "today's interest running" widget
src/pages/mtf/PositionsTable.tsx    # active positions table + row actions
src/pages/mtf/PositionFormModal.tsx # add/edit modal (Basic / Interest / Charges sections)
src/pages/mtf/ClosePositionModal.tsx# close-position flow
src/pages/mtf/ForecastCalculator.tsx# forecast widget (reused on detail page)
src/pages/mtf/ProfitConsumptionBar.tsx # animated gross/interest/charges/net bars
src/pages/mtf/HealthBadge.tsx       # interest-health colored badge
src/pages/mtf/AlertsPanel.tsx       # intelligent warning cards
src/pages/mtf/FilterSortBar.tsx     # filters + search + sort toolbar
src/pages/mtf/charts/*.tsx          # one file per chart (see §9)
src/pages/mtf/PortfolioAnalytics.tsx# portfolio-level analytics cards
```

**Edit (shared — minimal, surgical):**
- `src/App.tsx`: `const Mtf = lazy(() => import("@/pages/Mtf"));` + `const MtfPositionDetail = lazy(() => import("@/pages/MtfPositionDetail"));` and inside `<Route element={<AppLayout/>}>` add `<Route path="/mtf" element={<Mtf/>}/>` and `<Route path="/mtf/:id" element={<MtfPositionDetail/>}/>`.
- `src/components/layout/Sidebar.tsx`: add a nav item to the **"Money"** section: `{ to: "/mtf", label: "MTF Interest", icon: Percent }` (import `Percent` from lucide-react; acceptable alternative icons: `HandCoins`, `Coins`, `CircleDollarSign`). Keep it visually consistent with existing items.

---

## 4. Data model (`src/lib/mtf/types.ts`)

```ts
export type MtfStatus = "Open" | "Closed";
export type InterestBasis = "total" | "funded";

export interface MtfBroker {
  id: string;
  name: string;              // "Groww"
  dailyRatePct: number;      // 0.041
}

export interface MtfCharges {
  // Method 1 — components (any may be 0/undefined)
  brokerage?: number;
  stt?: number;
  exchangeTxn?: number;      // "Exchange Charges"
  gst?: number;
  sebi?: number;
  stampDuty?: number;
  dp?: number;               // DP Charges
  other?: number;
  // Method 2 — manual override; if set, this wins over the component sum
  manualTotal?: number;
}

export interface MtfPosition {
  id: string;                // "MTF-0001"
  stockName: string;         // "Reliance Industries"
  symbol: string;            // "RELIANCE" (NSE/BSE)
  brokerId: string;          // FK → MtfBroker
  purchaseDate: string;      // ISO date (yyyy-MM-dd)
  quantity: number;
  avgBuyPrice: number;
  totalInvestment: number;   // auto = qty × avgBuyPrice, but stored (allow manual override)
  currentPrice?: number;     // optional live/manual price
  status: MtfStatus;
  notes?: string;

  // Interest settings
  dailyRatePct: number;      // default from broker, editable per position (0.041)
  interestBasis: InterestBasis; // default "total"
  fundedPercent: number;     // default 100; only used when basis === "funded"
  manualInterestAdj?: number;// optional manual +/- adjustment to accumulated interest

  charges: MtfCharges;

  // Snapshot fields — filled on close (see §8)
  exitDate?: string;
  exitPrice?: number;
  finalHoldingDays?: number;
  finalInterest?: number;
  finalCharges?: number;
  finalGrossProfit?: number;
  finalNetProfit?: number;
  finalBreakEvenPrice?: number;
}
```

---

## 5. Calculations (`src/lib/mtf/calc.ts`) — pure functions, exact formulas

Let `T = startOfDay(new Date())`. For each position:

```
totalInvestment  I  = quantity × avgBuyPrice            (or stored override)
interestBase        = interestBasis==="funded" ? I × fundedPercent/100 : I
dailyRate           = dailyRatePct / 100
dailyInterest       = interestBase × dailyRate
holdingDays      H  = max(0, differenceInCalendarDays(T, startOfDay(purchaseDate)))  // elapsed days, shown in the "Holding Days" column (bought today ⇒ 0)
interestDays        = H + 1   // ← interest accrues FROM the purchase day (inclusive), so bought-today ⇒ 1 day of interest (safe/conservative side)
accumulatedInterest = dailyInterest × interestDays + (manualInterestAdj ?? 0)
totalCharges     C  = charges.manualTotal ?? sum(all component fields)
currentValue        = currentPrice != null ? quantity × currentPrice : I
grossProfit         = currentValue − I                  // "Current Profit" / unrealized
profitPct           = I>0 ? grossProfit / I × 100 : 0
netProfit           = grossProfit − accumulatedInterest − C
netProfitPct        = I>0 ? netProfit / I × 100 : 0

# Break-even (sell price where netProfit = 0)
breakEvenPrice      = (I + accumulatedInterest + C) / quantity
breakEvenPct        = (breakEvenPrice − avgBuyPrice) / avgBuyPrice × 100
extraPriceNeeded    = max(0, breakEvenPrice − (currentPrice ?? avgBuyPrice))
extraProfitNeeded   = max(0, accumulatedInterest + C − grossProfit)   // rupees still to earn to reach net 0

# Interest health (base = grossProfit)
healthPct           = grossProfit > 0 ? accumulatedInterest / grossProfit × 100 : Infinity
# → <5 green(profit) · 5–15 blue(info) · 15–30 yellow(#eab308) · 30–50 orange(warning) · >50 red(loss)
# → grossProfit ≤ 0 ⇒ red
```

**Forecast** (position + future extra days `N`):
```
addlInterest        = dailyInterest × N
futureTotalInterest = accumulatedInterest + addlInterest
futureBreakEven     = (I + futureTotalInterest + C) / quantity
# at an assumed exit price P (default = currentPrice ?? avgBuyPrice):
futureGross         = P×quantity − I
futureNetProfit     = futureGross − futureTotalInterest − C
minSellingPrice     = futureBreakEven
expectedReturnPct   = I>0 ? futureNetProfit / I × 100 : 0
```

**Portfolio aggregates** (over the *filtered* set; open-only unless noted):
```
activeCount / closedCount
totalCapitalInvested   = Σ I (open)
currentPortfolioValue  = Σ currentValue (open)
grossUnrealized        = Σ grossProfit (open)
todaysInterest         = Σ dailyInterest (open)                 # today's burn
yesterdaysInterest     = Σ dailyInterest (open where H ≥ 1)
weeklyInterest         = Σ dailyInterest × min(interestDays,7)  (open)
monthlyInterest        = Σ dailyInterest × min(interestDays,30) (open)
lifetimeInterest       = Σ accumulatedInterest (open) + Σ finalInterest (closed)
totalInterestPaid      = lifetimeInterest
totalCharges           = Σ C (open) + Σ finalCharges (closed)
netPortfolioProfit     = Σ netProfit (open) + Σ finalNetProfit (closed)
avgDailyCost           = todaysInterest                          # daily burn across open
avgDailyInterest       = mean(position dailyInterest, open)
avgHoldingDays         = mean(H, open)
avgPositionSize        = mean(I, open)
avgInterestPerPosition = mean(accumulatedInterest, open)
highestInterestPosition= argmax accumulatedInterest (open)
longestHolding         = argmax H (open)
mostExpensiveHolding   = argmax I (open)
cheapestHolding        = argmin I (open)
highestProfitStock     = argmax netProfit
highestLossStock       = argmin netProfit
newestPosition         = argmax purchaseDate (open)
# forward estimates (added to lifetime):
estTomorrow            = todaysInterest × 1
est7d                  = todaysInterest × 7
est30d                 = todaysInterest × 30
est90d                 = todaysInterest × 90
```

Expose these as `computePosition(pos, brokers, asOf): ComputedPosition` and `computePortfolio(positions[], brokers, asOf): PortfolioStats`. Keep everything pure and memoized in pages via `useMemo`.

---

## 6. Store (`src/store/useMtfStore.ts`)

Mirror the app's store pattern exactly (`create<T>()(persist((set,get)=>({…}), {name, version, migrate}))`), but with a **separate** localStorage key so it never touches `ledgerx-store`.

```ts
// key: "mtf-store", version: 1
state: { positions: MtfPosition[]; brokers: MtfBroker[] }
actions:
  addPosition(p)              // prepend
  updatePosition(id, patch)
  deletePosition(id)
  duplicatePosition(id)       // clone with new id + " (copy)"
  closePosition(id, exitPrice, exitDateISO)  // computes & freezes final* snapshot (see §8)
  reopenPosition(id)          // optional: move back to Open, clear final*
  addBroker(b) / updateBroker(id, patch) / deleteBroker(id)
  resetSampleData() / clearAll()
export nextMtfId(positions): string   // "MTF-0007", zero-padded to 4
```
Seed on first load with `sampleMtf.ts` (default broker "Groww" @0.041, and 5–6 realistic open + 1–2 closed positions across Indian stocks — RELIANCE, TATAMOTORS, HDFCBANK, INFY, ITC, ADANIENT etc., realistic qty/prices/dates spread over the last 5–90 days, one or two showing net loss so alerts light up).

---

## 7. Pages & UI

### 7.1 Dashboard / Overview — `src/pages/Mtf.tsx` (route `/mtf`)
Scaffold: `<PageHeader title="MTF Interest Tracker" description="Real profitability of your margin positions after daily interest, charges & break-even." actions={<Button variant="primary" icon={Plus}>Add Position</Button>} />` then `<div className="animate-in space-y-4">`.

Order of sections:
1. **Live Interest Meter** (`LiveInterestMeter.tsx`) — hero strip, full width. Four inline stats with the running feel:
   - 💸 **Today's Interest Running** — `todaysInterest` (amber), animated.
   - **Current Daily Burn** — `avgDailyCost`/day (amber).
   - **Total Interest Paid** — `lifetimeInterest`.
   - **Estimated Tomorrow** — `estTomorrow`.
   Use amber `text-warning` for interest figures, subtle pulse animation on the running number.
2. **Stat grid** (`StatGrid.tsx`) — a `grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6` of `KpiCard`s. Include (with sensible icons + `sub` + `toneBySign` where signed): Active Positions, Closed Positions, Total Capital Invested, Current Portfolio Value, Gross Unrealized Profit, Total Interest Paid, Today's Interest, Yesterday's Interest, Weekly Interest, Monthly Interest, Lifetime Interest, Total Trading Charges, Net Portfolio Profit, Average Daily Interest, Highest Interest Position, Longest Holding Position, Average Holding Days, Average Daily Cost, Est. Interest Tomorrow, Est. in 7 Days, Est. in 30 Days, Est. in 90 Days. (`KpiCard` already animates on value change — requirement satisfied.)
3. **Alerts panel** (`AlertsPanel.tsx`) — see §11. Only render when there are active alerts.
4. **Filter / sort / search bar** (`FilterSortBar.tsx`) — see §12.
5. **Active Positions table** (`PositionsTable.tsx`) — see §7.3.
6. **Portfolio analytics** (`PortfolioAnalytics.tsx`) — see §10.
7. **Charts grid** — the portfolio-level charts from §9 (`grid gap-4 md:grid-cols-2`).
8. **Closed positions** — a collapsed/secondary table (same columns as active + Exit Date/Price, Final Net) using the frozen `final*` snapshot.

Empty state: if `positions.length === 0`, show `<EmptyState title="No MTF positions yet" hint="Add your first margin position to start tracking daily interest and break-even." action={<Button icon={Plus}>Add Position</Button>}/>` inside a Card.

### 7.2 Add / Edit Position — `PositionFormModal.tsx`
A `<Modal widthClass="max-w-2xl">` with three `Field`-based sections (use `Segmented`/`Select`/`Input` from the kit):

- **Basic Details:** Stock Name, Symbol (NSE/BSE), Broker (`Select` from store brokers), Purchase Date (date input), Quantity, Average Buy Price, Total Investment Amount (auto = qty × price, editable override with a "reset to auto" affordance), Current Market Price (optional), Status (Open/Closed segmented), Notes (`Textarea`).
- **Interest Settings:** Daily Interest Rate (`Input` suffix `%`, default from broker 0.041, editable) with a live **"≈ X% p.a."** hint; Interest Basis segmented **Total value / Funded amount**; when "Funded", reveal **Funded %** (default 100). Optional **Manual interest adjustment (±₹)**.
- **Charges:** segmented **Method 1 — Itemized / Method 2 — Total**.
  - *Itemized:* Brokerage, STT, Exchange Charges, GST, SEBI Charges, Stamp Duty, DP Charges, Other Charges → live **Total Charges** readout (sum).
  - *Total:* single **Total Charges** field (e.g. `₹186.45`) → stored as `charges.manualTotal` and used directly.
- **Live summary panel** on the right/bottom (like the app's `SummaryPanel`): shows computed Daily Interest, Break-even Price, Net Profit preview as the user types.
- Footer: `Cancel` (ghost) + `Save Position` (primary). Validate required fields with `Field error`. `toast("Position added"/"Position updated","success")`.

Reuse this same modal for **Edit** (pre-filled). Edit is also reachable from the detail page.

### 7.3 Active Positions table — `PositionsTable.tsx`
`TableShell` with these columns (numeric cells `tnum text-right`, money via `formatMoney`, P&L colored via `pnlClass`):
Stock · Symbol · Purchase Date · Holding Days · Quantity · Buy Price · Current Price · Total Investment · Current Value · Current Profit · Profit % · Daily Interest *(amber)* · Total Interest *(amber)* · Total Charges · **Net Profit** · Break-even Price *(#eab308)* · Break-even % · Additional Price Needed · Interest Rate · **Health** badge (`HealthBadge`) · Status.

- Row click → navigate to `/mtf/:id` (detail page).
- Each row has an actions menu (kebab or hover buttons) — **View Details**, **Edit**, **Duplicate**, **Close Position**, **Delete** (danger, with confirm). Icon-only buttons need `aria-label`.
- Horizontal scroll on small screens (wrap in `overflow-x-auto`); on mobile, degrade gracefully to a stacked card list of the key figures (Stock, Net Profit, Daily Interest, Break-even, Health).
- Empty case → `<EmptyState/>`.

### 7.4 Position Detail — `src/pages/MtfPositionDetail.tsx` (route `/mtf/:id`)
Read `:id` via `useParams`; if not found, show EmptyState with a back link. Layout:
- **Large header:** stock name + symbol + `StatusBadge` + `HealthBadge`; right side actions (Edit, Duplicate, Close, Delete). Below: big Net Profit number (`toneBySign`) with gross/interest/charges breakdown.
- **Summary cards row:** Investment Summary (qty, buy price, investment, current value), Holding Summary (purchase date, holding days, daily interest, accumulated interest), Break-even card (break-even price, break-even %, extra price needed, extra profit needed), Charges card (itemized or total).
- **Profit Consumption Meter** (`ProfitConsumptionBar.tsx`) — animated horizontal bars: Gross Profit / Interest / Charges / Net Profit, each labeled with ₹ and a colored bar (`ProgressBar` or custom) scaled to gross. Interest bar amber, charges muted, net green/red.
- **Timeline** — purchase → today, with holding days and a small interest-accrual note.
- **Charts** (per-position, from §9): Daily Interest Growth, Cumulative Interest, Interest vs Profit, Interest vs Holding Days, Break-even Growth, Projected Interest.
- **Forecast Calculator** (`ForecastCalculator.tsx`) — see §8-forecast.
- **Notes** — editable inline (updates store).
- **History** — for closed positions, show the frozen `final*` snapshot.

### 7.5 Live Interest Meter, Profit Consumption Meter, Health badge
- **LiveInterestMeter** — described in 7.1.1; amber theme; the "running" number animates continuously (small opacity/scale pulse), not a fake ticker.
- **ProfitConsumptionBar** — animated horizontal bars as in the brief (Gross ████ / Interest █ / Charges ▪ / Net ███). Bars animate width on mount/value change.
- **HealthBadge** — colored `Badge`: green `profit` (<5%), blue `info` (5–15%), yellow `#eab308` local (15–30%), orange `warning` (30–50%), red `loss` (>50% or gross ≤ 0). Tooltip shows exact `healthPct`.

---

## 8. Forecast Calculator & Closing a position

### Forecast (`ForecastCalculator.tsx`)
Preset day chips **5 · 10 · 15 · 30 · 45 · 60 · 90 · 180 · 365** plus a custom number input, and an optional assumed exit price (default current price). Instantly show: Additional Interest, Future Total Interest, Future Break-even Price, Future Net Profit, Minimum Selling Price Required, Expected Return %. Update live as inputs change. Use `#eab308` for break-even, amber for interest, `accent` for the forecast framing.

### Close position (`ClosePositionModal.tsx`)
Modal: Exit Price (required), Exit Date (default today). On confirm → `closePosition(id, exitPrice, exitDate)`:
- Compute and **freeze** into the position: `finalHoldingDays` (= `differenceInCalendarDays(exitDate, purchaseDate)`), `finalInterest` (= `dailyInterest × (finalHoldingDays + 1)` — purchase-day-inclusive, same as live math), `finalCharges`, `finalGrossProfit`, `finalNetProfit`, `finalBreakEvenPrice`, plus `exitDate`, `exitPrice`, `status="Closed"`.
- Move it out of Active into **Closed Positions** (still queryable for history/reports). `toast("Position closed","success")`. Closed rows compute nothing live — they read the snapshot.

---

## 9. Charts (Recharts 2, inside `Card`s) — file per chart under `src/pages/mtf/charts/`

Map each requested chart. Colors: interest=amber `#f59e0b`, break-even=`#eab308`, holding=info `#38bdf8`, forecast/generic=accent from `CAT`, profit/loss=`PNL`. Follow §1.4 chart rules (single series → no legend; 2+ → legend). Use `ChartTooltip` everywhere.

**Per-position (detail page):**
- Daily Interest Growth — area/line, amber, x=day, y=cumulative interest.
- Cumulative Interest — area, amber gradient.
- Interest vs Profit — grouped bars (interest amber vs gross profit green) → 2 series, legend.
- Interest vs Holding Days — line, amber, x=days.
- Break-even Growth — line `#eab308`, break-even price rising with days.
- Projected Interest — forecast area (dashed-free), accent/amber, from today forward.

**Portfolio-level (overview):**
- Portfolio Interest Trend — cumulative portfolio interest over time (amber area).
- Top Interest Paying Stocks — horizontal bar, `CAT` in order, `BAR_RADIUS_H`.
- Interest Distribution — donut/pie by position (`CAT`).
- Capital Allocation — donut/pie of investment by position (`CAT`).
- Profit vs Interest — scatter or grouped bar per position.
- Net Profit Trend — line, `PNL` coloring.
- Holding Duration Distribution — histogram (buckets of holding days).

Each chart: title carries the single-series meaning; heights 240–300; `ResponsiveContainer`.

---

## 10. Portfolio Analytics (`PortfolioAnalytics.tsx`)
A grid of `Card`s / `KpiCard`s surfacing: Total Portfolio Interest, Total Portfolio Charges, Gross Portfolio Profit, Net Portfolio Profit, Portfolio Break-even (blended), Average Daily Interest, Average Holding Days, Average Position Size, Average Interest Per Position, Most Expensive Holding, Cheapest Holding, Highest Interest Stock, Highest Profit Stock, Highest Loss Stock, Longest Holding, Newest Position. Name-type stats (Highest Interest Stock etc.) show the stock symbol + the figure in `sub`.

---

## 11. Alerts (`AlertsPanel.tsx`) — intelligent warning cards
Compute per-position and render only the triggered ones as small colored cards (icon + message + stock). Rules:
- Accumulated interest > ₹100 / ₹500 / ₹1000 (escalating: info → warning → loss).
- Held > 30 / 60 / 90 days (info → warning → loss).
- Interest > 25% of gross profit (warning) / > 50% (loss).
- Net profit turned negative (loss).
- Break-even within 1% of current price (info — "almost break-even").
- Trade no longer profitable, i.e. `netProfit < 0 && grossProfit > 0` (loss — "interest ate your profit").
Group by severity; show a count. Use `bg-*-soft` backgrounds with matching `text-*`.

---

## 12. Filters, search, sort, export

**FilterSortBar** (`FilterSortBar.tsx`):
- **Filter:** status (Open/Closed/All), broker, stock, date range, plus quick chips (Highest Profit / Highest Loss / Longest Holding / Most Interest).
- **Search:** free-text over stock name, symbol, notes.
- **Sort:** Highest/Lowest Interest, Highest/Lowest Profit, Holding Days, Newest, Oldest, Largest Investment, Largest Charges, Largest Net Profit.
Keep filter/sort state local to the page (`useState`); apply before rendering table + charts.

**Export** (`exportMtf.ts`):
- **CSV / Excel** → build rows with `toCsv(headers, rows)` + `downloadFile("mtf-positions.csv", csv, "text/csv")`. (Excel opens CSV natively — no xlsx dep.)
- **PDF / Print Report** → a print-friendly layout + `window.print()` (mirror `src/pages/reports/printReport.ts`); a `@media print` block hides the sidebar/topbar and expands cards.
Buttons live in the PageHeader `actions` or a small export menu. `toast` on export.

---

## 13. Responsiveness, animation, accessibility
- **Responsive:** KPI grid `grid-cols-2 → sm:grid-cols-3 → xl:grid-cols-6`; chart grids `md:grid-cols-2`; table scrolls horizontally, collapses to stacked cards on mobile; modals full-width on small screens.
- **Animation:** page uses `animate-in`; cards cascade via the existing `card` nth-child stagger; `KpiCard` count-up; profit bars animate width; live interest number pulses; hover lift on cards is automatic. Respect `prefers-reduced-motion` (already handled globally).
- **Accessibility:** `aria-label` on all icon-only buttons; keyboard-focusable rows/actions; charts have titles; color is never the only signal (pair with text/labels); focus-visible rings are global.

---

## 14. Future-proofing (build the seams now)
- Multiple brokers with distinct rates → brokers live in the store; positions reference `brokerId` and can override `dailyRatePct`.
- Editable rate per position → yes (form field).
- Manual interest adjustments → `manualInterestAdj`.
- Live prices → `currentPrice` is manual now; add a stub `fetchPrice(symbol): Promise<number|null>` in `calc.ts`/a provider file returning `null`, wired but inert, so a real API drops in later.
- Import/export → CSV export now; add a matching CSV import parser (optional stretch) shaped like `src/pages/trades/importCsv.ts`.
- Historical interest → closed positions keep the `final*` snapshot; the portfolio interest-trend chart reads history.
- Automatic daily recalculation → real-`new Date()` recompute + midnight-rollover effect (§2.7).

---

## 15. Definition of Done (acceptance checklist)
- [ ] New **"MTF Interest"** item appears in the sidebar (Money section, `Percent` icon) and routes to `/mtf`; detail routes to `/mtf/:id`.
- [ ] Only `App.tsx` and `Sidebar.tsx` are edited among shared files; the existing `Trade`/`useStore` core is untouched; MTF uses its own `mtf-store`.
- [ ] Adding a position with just qty + buy price + purchase date immediately shows correct Daily Interest, Accumulated Interest, Net Profit, and Break-even, and recalculates as the date advances.
- [ ] Both charge methods work; manual total overrides the itemized sum.
- [ ] Interest basis Total vs Funded works; default behaves as interest-on-total.
- [ ] All stat cards, table columns, detail page, forecast, portfolio analytics, alerts, charts, filters/search/sort, and CSV+print export are present and functional.
- [ ] Closing a position freezes its snapshot and moves it to Closed while keeping it in history.
- [ ] Health badge, live interest meter, and profit-consumption bars render with the correct colors and animate.
- [ ] Everything visually matches LedgerX (glass cards, tokens, fonts, spacing); no raw hex in JSX except the documented `#eab308`/chart hexes; `formatMoney`/`formatPct` used for all numbers.
- [ ] `tsc --noEmit` passes (strict); every list/table handles its empty case; responsive on desktop/tablet/mobile.

---

## 16. Quick reference — the interest math in one line
> **Net Profit = (Current Value − Investment) − (Daily Interest × Interest Days) − Charges**, where **Daily Interest = Interest Base × Rate/100**, **Interest Days = elapsed days + 1** (interest counts the purchase day), and a position is truly profitable only once its price clears **Break-even = (Investment + Accumulated Interest + Charges) ÷ Quantity**.
