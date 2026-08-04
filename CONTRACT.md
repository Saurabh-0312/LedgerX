# LedgerX — Page-Agent Contract

You are building ONE page of a dark-theme trading-journal app (Vite + React 18 + TypeScript + Tailwind v4 + Recharts 2 + zustand + react-router 6 + lucide-react + date-fns). The core (types, store, metrics, UI kit, chart kit, layout, routing) is DONE and FROZEN.

## Hard rules
1. Write ONLY the file(s) assigned to you: your page file in `src/pages/` and, if you need subcomponents, new files in a folder you own (e.g. `src/pages/trades/`). NEVER edit any shared file, any other page, App.tsx, or configs.
2. Import shared code via the `@/` alias (maps to `src/`). Import types with `import type`.
3. Do NOT run tsc, vite, npm, or any command. Other agents are writing files concurrently — just write careful, type-correct code.
4. `tsconfig` is strict. `noUnusedLocals` is off, but get types right: `Trade["exitPrice"]` etc. are optional — guard them.
5. Your page must default-export its component (the route imports `@/pages/<Name>` as default).
6. Every list/table you render must handle the empty case with `<EmptyState/>`.

## Shared modules (exact API)

### `@/types`
`AssetClass` = "Equity"|"Options"|"Futures"|"Forex"|"Crypto"|"Commodity" · `Direction` = "Long"|"Short" · `TradeStatus` = "Open"|"Closed"|"Cancelled" · `TaxCategory` = "Intraday"|"STCG"|"LTCG"|"Crypto" · `Timeframe` = "1m"|"5m"|"15m"|"1h"|"4h"|"Daily"|"Weekly" · `MarketCondition` = "Trending"|"Ranging"|"Volatile"|"Quiet" · `Mood` = "great"|"good"|"neutral"|"bad"|"terrible" · `Rating` = 1|2|3|4|5 · `RangePreset`.

`Trade` fields: `id, accountId, symbol, assetClass, direction, status, quantity, entryPrice, exitPrice?, stopLoss?, target?, openedAt, closedAt?, holdingMinutes?, grossPnl, charges: ChargesBreakdown, netPnl, tax: TaxInfo, riskAmount, rMultiple?, positionValue, pctOfCapital, strategy, marketCondition, timeframe, tags: string[], emotionRating: Rating, confidenceRating: Rating, screenshotUrl?, notes, mistakes?, lessons?`.
`ChargesBreakdown`: `brokerage, exchangeTxn, stt, sebi, stampDuty, gst, dpCharges, total`.
`TaxInfo`: `category, taxableAmount, rate, estimatedTax`.
Also: `Account {id,name,broker,currency:"INR"|"USD",startingCapital,createdAt}`, `JournalEntry {id,date,title,content,mood,linkedTradeIds}`, `Goals {monthlyProfitTarget,winRateTarget,maxDailyLoss,maxTradesPerDay}`, `WatchlistItem {id,symbol,assetClass,note,plannedSetup,alertPrice?,addedAt}`, `ChargeRates`, `TaxRates {intradayPct,stcgPct,ltcgPct,cryptoPct}`, `AppSettings {userName,email,baseCurrency,timezone,startingCapital,chargeRates,taxRates,theme}`, `GlobalFilters {preset,from,to,accountId}`.

### `@/store/useStore`
`useStore(selector)` — zustand. State: `trades, accounts, journal, goals, watchlist, settings, filters`.
Actions: `addTrade(t)`, `updateTrade(id, patch)`, `deleteTrade(id)`, `deleteTrades(ids)`, `closeTrade(id, exitPrice, closedAtISO)` (recomputes charges/tax/R), `importTrades(ts)`, `addJournalEntry/updateJournalEntry/deleteJournalEntry`, `addAccount/updateAccount/deleteAccount`, `addWatchItem/updateWatchItem/removeWatchItem`, `setGoals(g)`, `updateSettings(patch)`, `setFilters(patch)`, `resetSampleData()`, `clearAllData()`.
Also exported: `nextTradeId(trades): string`.

### `@/store/useFilteredTrades`
- `useFilteredTrades(): Trade[]` — trades scoped by the GLOBAL topbar date-range + account filters. **Every page's data derives from this** (exceptions: Settings, Accounts, Auth; Tax uses its own FY selector over `useStore(s=>s.trades)`).
- `datasetToday(trades): Date` — "today" anchored to the latest trade (use instead of `new Date()` for month math).
- `rangeForPreset(preset, today, {from,to})`, `PRESET_LABELS`.
- `useScopeCurrency(): "INR"|"USD"`.

### `@/lib/metrics` (all pure, take `Trade[]`)
- `computeKpis(trades, startingCapital): Kpis` — fields: `totalNetPnl, totalGrossPnl, totalCharges, totalTax, totalTrades, closedTrades, openTrades, wins, losses, breakevens, winRate, profitFactor, expectancy, avgWin, avgLoss(neg), payoffRatio, avgR, bestTrade, worstTrade, currentStreak(signed), maxWinStreak, maxLossStreak, maxDrawdown, maxDrawdownPct, roiPct, avgHoldingMinutes, sharpe, chargesPctOfGross`.
- `equityCurve(trades, capital): {date, equity, cumPnl}[]` · `drawdownSeries(trades, capital): {date, drawdown(neg), drawdownPct(neg)}[]`
- `dailyPnl(trades): {date, pnl, trades}[]` · `monthlyPnl(trades): {month:"yyyy-MM", label:"Mar 26", pnl, gross, charges, tax, trades, wins, winRate}[]`
- `pnlBy(trades, keyOf): GroupPerf[]` sorted by pnl desc — `GroupPerf {name, pnl, gross, charges, trades, wins, winRate, avgR}`. keyOf may return string OR string[] (tags).
- `rHistogram(trades, bucketSize=0.5): {from, mid, label, count}[]`
- `winRateOverTime(trades): {month, label, winRate, avgR}[]` · `longShortSplit(trades)` · `dayOfWeekPerf(trades)` · `hourOfDayPerf(trades): {hour, label:"09:00", pnl, trades, winRate,...}[]`
- `calendarMonth(trades, year, month0): {date, day, pnl, trades}[]` · `financialYearOf(iso): "FY 2025-26"` · `monthLabel("2026-03") → "Mar 26"` · `closedOf(trades)`.

### `@/lib/format`
`formatMoney(v, {currency?, compact?, sign?, decimals?})` → "₹1,23,456" / compact "₹1.2L"; `formatPct(v, dp?, sign?)`; `formatNumber(v, dp?)`; `formatR(r?)` → "+1.25R"/"—"; `formatDate(iso)` "12 Mar 2026"; `formatDateShort` "12 Mar"; `formatDateTime`; `formatTime`; `formatDuration(min?)` "3h 20m"; `pnlClass(v)` → "text-profit"/"text-loss"/"text-muted"; `pnlMarkColor(v)` → chart hex for sign.

### `@/lib/tradeMath` (for TradeForm/Settings)
`DEFAULT_CHARGE_RATES`, `DEFAULT_TAX_RATES`, `computeCharges({assetClass, quantity, entryPrice, exitPrice?, intraday, rates}): ChargesBreakdown`, `computeGrossPnl(direction, entry, exit, qty)`, `taxCategoryFor(assetClass, holdingMinutes?, intraday)`, `computeTax(netPnl, category, rates): TaxInfo`, `computeRMultiple(netPnl, riskAmount)`, `holdingMinutesBetween(a, b)`, `isIntraday(openedAt, closedAt?)`.

### `@/lib/csv`
`toCsv(headers, rows): string`, `downloadFile(filename, content, mime?)`.

### `@/store/toast`
`toast(message, tone?: "success"|"error"|"info")` — call after any user action.

### UI kit (`@/components/ui/*`)
- `Card` `{title?, subtitle?, action?, className?, bodyClassName?, children}` — the house card. Charts and tables live inside Cards.
- `KpiCard` `{label, value:number, format:(n)=>string, delta?:{text, direction:"up"|"down"|"flat", upIsGood?}, icon?:LucideIcon, sub?, toneBySign?, spark?:number[]}` — animated count-up stat tile.
- `Badge` `{tone?: "profit"|"loss"|"accent"|"warning"|"info"|"neutral"}`; `DirectionBadge {direction}`; `StatusBadge {status}`.
- `Button` `{variant?: "primary"|"outline"|"ghost"|"danger", size?: "sm"|"md", icon?:LucideIcon}` extends button attrs.
- `Field` `{label, hint?, error?, required?, children:(id)=>ReactNode}` + `Input`, `Select`, `Textarea` (styled, spread native props).
- `TableShell/TH/TD/rowClass` from `@/components/ui/Table` — numeric cells get `className="tnum text-right"`.
- `EmptyState` `{icon?, title, hint?, action?}` · `ProgressBar` `{value:0-100, tone?}` · `Modal`/`Drawer` `{open, onClose, title?, widthClass?}` from `@/components/ui/Modal` · `PageHeader` `{title, description?, actions?}` · `Skeleton/PageSkeleton`.

### Chart kit (`@/components/charts/*`)
- `chartTheme`: `CAT` (8 fixed categorical slots — assign in order, never cycle), `PNL {profit:"#16a34a", loss:"#ef4444", neutral}`, `ACCENT, INFO, WARNING, GRID, AXIS_TEXT, CURSOR_FILL, tickStyle, axisDefaults, gridDefaults, BAR_MAX, BAR_RADIUS, BAR_RADIUS_H, LINE_WIDTH, AREA_OPACITY, heatColor(value, maxAbs), heatTextColor(value, maxAbs)`.
- `ChartTooltip` — pass to Recharts: `<Tooltip content={<ChartTooltip valueFormatter={(v)=>formatMoney(v,{compact:true,sign:true})}/>} cursor={{fill: CURSOR_FILL}}/>` (line charts: `cursor={{stroke: GRID}}`).

## Design rules (dataviz-validated — follow exactly)
- Charts: `<ResponsiveContainer width="100%" height={...}>` inside a `Card`; typical heights 240–320.
- Axes: `<XAxis {...axisDefaults} dataKey=.../>` `<YAxis {...axisDefaults} tickFormatter={(v)=>formatMoney(v,{compact:true})}/>`; grid: `<CartesianGrid {...gridDefaults}/>`. Never dashed lines, no axis lines.
- Bars: `maxBarSize={24}`, `radius={BAR_RADIUS}` (vertical) or `BAR_RADIUS_H` (horizontal layout). P&L bars: color per sign with `<Cell fill={pnlMarkColor(v)}/>`.
- Lines: `strokeWidth={2}`, `dot={false}`; end/active dots r≥4 with `stroke="#141619" strokeWidth={2}`.
- Areas: gradient from series color at ~0.25 opacity → 0; or flat `fillOpacity={AREA_OPACITY}`.
- ONE series → NO `<Legend/>` (title carries it). TWO+ series → `<Legend/>` required (wrapperStyle fontSize 12, color muted).
- Multi-series identity colors come from `CAT` in order (CAT[0], CAT[1], …). P&L direction always uses `PNL`/`pnlMarkColor`. Fees/tax accent = WARNING amber. Never color text with chart hues — text uses `text-ink/text-muted` + `text-profit/text-loss` only.
- Numbers in tables/columns: `tnum` class. Big standalone numbers: NO tnum.
- Heatmaps (calendar, time-of-day): cell fill `heatColor(v, maxAbs)`, cell text `heatTextColor`, cells are buttons with tooltips (title attr ok) and keyboard focus.
- Page scaffold: `<PageHeader title=... description=... actions=.../>` then a `space-y-4` or grid of Cards. Responsive: `grid gap-4 md:grid-cols-2 xl:grid-cols-3` patterns; KPI rows `grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6`.
- Money always via `formatMoney` (compact in charts/KPIs, full in tables). P&L text: `pnlClass(v)` + `formatMoney(v,{sign:true})`.
- Currency: `formatMoney` defaults to INR — fine everywhere (accounts are INR; only pass currency when showing a specific USD account).
- Interactions: hover states on rows (`rowClass`), toasts on actions, `aria-label` on icon-only buttons.

## Navigation conventions
- Row click on any trade list → open the Trades page detail drawer via `/trades?highlight=T-0123` (the Trades page reads `highlight` search param and opens its drawer; other pages just navigate).
- Edit → `/trades/:id/edit`. New → `/trades/new`. Day click on calendar heatmaps → `/calendar?date=yyyy-MM-dd` (Calendar reads `date` param and opens that day's panel).
- `useNavigate`/`useSearchParams` from react-router-dom.

## Tailwind v4 theme tokens (already defined — use these, no hex in class names)
Colors: `bg-base` (app bg) · `bg-surface` (cards) · `bg-raised` (popovers/hover) · `border-edge`, `border-edge-soft` · text: `text-ink`, `text-muted`, `text-faint` · brand: `text-accent`, `bg-accent`, `bg-accent-soft` · status: `text-profit`, `bg-profit-soft`, `text-loss`, `bg-loss-soft`, `text-warning`, `bg-warning-soft`, `text-info`, `bg-info-soft`.
Utilities: `card` (surface+border+radius+shadow) · `tnum` (tabular figures) · `label-caps` (small uppercase muted label) · `input-base` (form control style) · `animate-in` (page/card entrance) · `animate-pop` (popover entrance) · `skeleton` (shimmer).
Fonts: default sans is Inter; `font-mono` = JetBrains Mono (raw figures, kbd).
Standard Tailwind utilities all work as usual.

## Dataset notes
Sample data: ~240 trades Nov 2025 → Jun 2026 (INR, Indian instruments incl. options/futures/crypto), 3 accounts, some Open + 2 Cancelled trades. "Today" = latest trade date (use `datasetToday`). Only `status==="Closed"` trades have P&L/tax/R — metrics helpers already handle this; if you compute manually, filter first.
