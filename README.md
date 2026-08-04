<div align="center">

# 📓 LedgerX

### Your broker shows you one number. There are actually three.

A dark-theme trading journal for Indian markets, where brokerage, STT, stamp duty, GST, DP charges, pledge fees and margin interest aren't a footnote — they're the whole point.

<p>
  <img alt="React" src="https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.7_strict-3178C6?logo=typescript&logoColor=white">
  <img alt="Vite" src="https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white">
  <img alt="Tailwind" src="https://img.shields.io/badge/Tailwind-v4-06B6D4?logo=tailwindcss&logoColor=white">
  <img alt="Recharts" src="https://img.shields.io/badge/Recharts-2.15-FF6384">
  <img alt="Supabase" src="https://img.shields.io/badge/Supabase-Postgres_·_Auth-3ECF8E?logo=supabase&logoColor=white">
  <img alt="Cloudflare" src="https://img.shields.io/badge/Cloudflare-Workers_·_Pages_·_R2-F38020?logo=cloudflare&logoColor=white">
  <img alt="License" src="https://img.shields.io/badge/license-all_rights_reserved-lightgrey">
</p>

</div>

---

## The three numbers

Close a position in India and there are three different, equally real answers to *"what did I make?"*

```mermaid
flowchart LR
    A["Exit − Entry × Qty"] --> B["<b>Gross P&L</b><br/>the screenshot number"]
    B -- "− every cost<br/>you actually paid" --> C["<b>Net P&L</b><br/>what hits your bank"]
    B -- "− only what the<br/>IT Act lets you deduct" --> D["<b>Taxable P&L</b><br/>what you're taxed on"]

    style B fill:#1c1f24,stroke:#8b929d,color:#e6e8eb
    style C fill:#14321f,stroke:#22c55e,color:#e6e8eb
    style D fill:#3a2a12,stroke:#f59e0b,color:#e6e8eb
```

Most journals track the first. Decent ones track the second.

**LedgerX tracks all three** — because they genuinely diverge. Sell equity for a capital gain and STT, DP charges and MTF interest get **added back** to your tax base. Trade crypto under §115BBH and **nothing** is deductible. Get that wrong and your advance-tax planning is wrong in the expensive direction.

That distinction is the reason this project exists.

---

## What's inside

Sixteen pages. Here's the tour.

### 📊 The journal

| | |
|---|---|
| **Dashboard** | Equity curve, cumulative P&L, month + quarter comparisons, win-rate donut, calendar heatmap, recent trades |
| **Trades** | Every execution in scope — filter, sort, bulk-select, CSV in/out, detail drawer |
| **Trade form** | Charges and tax recompute live as you type. Auto from the rate card, or paste your contract-note total |
| **Analytics** | R-multiple distribution, performance by strategy / tag / setup, day-of-week, hour-of-day, long vs short |
| **Calendar** | Daily P&L heatmap — click any day, see what you did |
| **Journal** | Reflections with mood tracking, linked to the trades that caused them |

### 💸 The uncomfortable pages

| | |
|---|---|
| **Charges & Fees** | Every levy, broken out by component, as a % of gross. This is the page that changes how you trade |
| **Tax Report** | Full FY computation — slab-wise business income, §111A STCG, §112A LTCG with the ₹1.25L exemption, §115BBH crypto, §87A rebate, cess |
| **MTF Tracker** | A sub-app for margin positions: daily interest accrual, lot-wise cost basis, live break-even, and health tiers for when interest is quietly eating the trade |
| **Accounts** | Multi-broker, capital allocation, deposits/withdrawals, per-account performance |

### 🎯 Planning

| | |
|---|---|
| **Goals** | Monthly %-of-portfolio targets, capital planner, pace tracking, discipline scoring, milestones |
| **Watchlist** | Planned setups with alert prices |
| **Reports** | Downloadable performance / trade-log / tax summaries, over a period independent of the global filters |
| **Settings** | Profile, appearance, editable charge + tax rate cards, export / import / reset |

## Screenshots

<!-- Drop images in docs/ and uncomment:
| Dashboard | Charges |
|---|---|
| ![Dashboard](docs/dashboard.png) | ![Charges](docs/charges.png) |
-->

_Coming soon._

---

## 🔬 The engine

The interesting code lives in [`src/lib/tradeMath.ts`](src/lib/tradeMath.ts) and [`src/lib/incomeTax.ts`](src/lib/incomeTax.ts).

### Segment decides everything

A trade isn't just "equity." It's *delivery* equity or *intraday* equity or *MTF* equity — and each one is charged under a completely different formula.

| Segment | Is | The catch |
|---|---|---|
| `Delivery` | Equity CNC | STT on **both** legs, plus a DP charge every time you sell |
| `Intraday` | Equity MIS | STT sell-side only, no DP |
| `MTF` | Equity e-Margin | Pledge **and** unpledge fees, plus interest ticking daily |
| `FnO` | Options & Futures | Its own STT and stamp rates entirely |
| `Other` | Forex, Crypto, Commodity | |

Even the exchange matters: NSE cash equity is `0.00297%`, BSE is `0.00375%`. One line item, different number, and LedgerX tracks which venue filled you.

### Where the tax base diverges

```
netPnl     = grossPnl − charges.total          ← every cost, no exceptions
taxablePnl = grossPnl − deductible charges only ← depends on tax category
```

| Category | Deductible |
|---|---|
| Intraday (business income) | Everything |
| STCG / LTCG (capital gains) | Everything **except** STT, DP charges, MTF interest |
| Crypto (§115BBH VDA) | **Nothing** |

Two numbers, deliberately different, computed per trade and stored on the row.

### Rate cards you can edit

Ships with a Groww-shaped default — 0.1% brokerage with a ₹5 floor, ₹20 DP per sell, ₹20 per pledge request, 14.95% p.a. MTF interest. Switched brokers? Edit them in **Settings → Charge rates** and everything recomputes.

Tax parameters for FY 2025-26 are editable too: ₹4,00,000 basic exemption, ₹12,00,000 §87A threshold with a ₹60,000 max rebate, 4% cess.

> ⚠️ **This is not tax advice.** It's a planning tool. Reconcile against your contract notes and talk to a CA before you file.

---

## 🛠 Built with

| | |
|---|---|
| **Build** | Vite 6 · TypeScript 5.7 `strict` · Node 20 |
| **UI** | React 18.3 · Tailwind CSS v4 (`@theme` tokens, zero config file) |
| **Charts** | Recharts 2.15 |
| **State** | Zustand 5 — optimistic, API-backed |
| **Backend** | Cloudflare Worker + Hono · Supabase Postgres (RLS) · Supabase Auth · Cloudflare R2 |
| **Routing** | React Router 6.28, lazy routes |
| **Dates** | date-fns 4 |
| **Icons** | lucide-react |
| **Type** | Inter Variable · JetBrains Mono |

**No component library.** Every Card, Button, Badge, Modal and Table is hand-built in `src/components/ui/`. Same for the chart theme.

---

## 🚀 Run it

```bash
git clone https://github.com/Saurabh-0312/LedgerX.git
cd LedgerX
npm install
npm run dev
```

→ **http://localhost:5173**

The app is cloud-backed now, so local dev needs two things running and a `.env`:

```bash
cp .env.example .env    # fill in VITE_SUPABASE_URL / ANON_KEY / VITE_API_URL
cd worker && npx wrangler dev    # the API on :8787 (simulated R2, no remote needed)
npm run dev                       # the app on :5173, in another terminal
```

Sign in (Supabase Auth) and your data loads from Postgres. New accounts start empty; add a trade and it persists in the cloud. Want a blank slate again? **Settings → Data management → Clear all data.**

| Command | |
|---|---|
| `npm run dev` | Dev server, HMR |
| `npm run build` | Type-check, then build to `dist/` |
| `npm run typecheck` | Types only |
| `npm run preview` | Serve the build on :4173 |

`npm run build` runs `tsc --noEmit` first and **fails on any type error.** That's deliberate.

---

## 🗺 Layout

```
src/
├── types.ts                 # The domain model. Single source of truth.
├── App.tsx                  # Routes, lazy-loaded
├── index.css                # Tailwind v4 @theme tokens
│
├── store/
│   ├── useStore.ts          # Trades, accounts, journal, goals,
│   │                        #   watchlist, settings — API-backed, optimistic
│   ├── useMtfStore.ts       # MTF tracker — deliberately isolated
│   ├── settingsSync.ts      # Single debounced writer for the shared settings row
│   ├── useFilteredTrades.ts # Global date-range + account scoping
│   └── toast.ts
│
├── lib/
│   ├── api.ts               # fetch wrapper — attaches the JWT, retries once on 401
│   ├── supabase.ts          # Supabase client (auth + session)
│   ├── images.ts            # WebP conversion + authenticated R2 screenshot access
│   ├── backup.ts            # Lossless export / import
│   ├── migrateLocal.ts      # One-time localStorage → cloud migration
│   ├── metrics.ts           # All performance math. Pure. Takes Trade[].
│   ├── tradeMath.ts         # Charges, tax category, R-multiple
│   ├── incomeTax.ts         # FY engine — slabs, 87A, cess
│   ├── sampleData.ts        # Seeded deterministic generator
│   ├── format.ts · csv.ts · rng.ts
│   └── mtf/                 # MTF domain: types, calc, palette, export
│
├── components/
│   ├── ui/                  # Card, Button, Badge, Field, Modal, Table…
│   ├── charts/              # chartTheme + shared ChartTooltip
│   ├── RequireAuth.tsx      # Guards the app shell
│   └── layout/              # AppLayout, Sidebar, Topbar, CommandPalette
│
└── pages/                   # One folder per page for its subcomponents

worker/                      # Cloudflare Worker (Hono)
├── src/index.ts             #   CORS, auth middleware, route registration, keep-alive cron
├── src/crud.ts              #   shared entity CRUD (pass-through streaming)
├── src/settings.ts          #   user_settings singleton
└── src/screenshots.ts       #   R2 upload / download

supabase/migrations/         # Postgres schema — 8 tables, RLS, grants (applied)
```

`@/` → `src/`. Import `@/lib/metrics`, never `../../lib/metrics`.

---

## 🧱 How it holds together

### The architecture

```mermaid
flowchart TD
    P["16 pages · 40+ charts"] -- "useStore(s => s.trades)" --> S["zustand stores<br/>optimistic · in-memory"]
    P -- "addTrade / closeTrade / …" --> S
    S -- "fetch + Bearer JWT" --> W["Cloudflare Worker · Hono<br/>pass-through proxy"]
    W -- "forwards the caller's JWT" --> DB[("Supabase Postgres<br/>Row Level Security")]
    W --> R2[("Cloudflare R2<br/>screenshots")]
    A["Supabase Auth"] -. "access token" .-> P

    style S fill:#1c1f24,stroke:#7c5cff,color:#e6e8eb
    style W fill:#1c1f24,stroke:#f38020,color:#e6e8eb
    style DB fill:#14321f,stroke:#3ecf8e,color:#e6e8eb
    style R2 fill:#1c1f24,stroke:#f38020,color:#e6e8eb
    style A fill:#1c1f24,stroke:#8b929d,color:#e6e8eb
    style P fill:#141619,stroke:#262a31,color:#e6e8eb
```

**Not one page or chart touches the network.** Everything still reads through a selector and writes through a named action — the pages never changed. The two store files hydrate from the API on load and mirror every mutation optimistically, so swapping `localStorage` for the cloud really was the two-file job the boundary promised.

The Worker is a thin authenticated proxy: it validates the Supabase token, then **forwards it** to Postgres so **Row Level Security** — not the Worker — decides which rows you see. It holds no `service_role` key. Screenshots stream to Cloudflare R2, namespaced by user id.

### Compute is pure

Every function in `src/lib/metrics.ts` takes `Trade[]` and returns data. No hooks, no store access, no side effects — `computeKpis`, `equityCurve`, `drawdownSeries`, `dailyPnl`, `monthlyPnl`, `pnlBy`, `rHistogram`, `dayOfWeekPerf`, `hourOfDayPerf`, `calendarMonth`.

Only `status === "Closed"` trades carry P&L, tax and R. The helpers filter internally so you don't have to remember.

### One filter to rule them all

The topbar date-range and account pickers reach every page through `useFilteredTrades()`. Pages never touch `trades` raw. Two deliberate exceptions: **Tax Report** has its own FY selector, **Reports** has its own period.

`datasetToday()` anchors "today" to the newest trade instead of the wall clock — so the sample data behaves whenever you open it.

### Optimistic, then synced

Each store hydrates from the API on sign-in and writes optimistically — the UI updates instantly, the API call fires in the background, and a failed write raises a toast. `settings` is one shared Postgres row written through a single debounced path, so the two stores can never clobber each other's columns.

The pre-cloud `localStorage` keys (`ledgerx-store` v7, `mtf-store` v2) are **still on disk, read-only** — the source for a one-time **Settings → Migrate to cloud** that uploads them to your account, verified field-by-field, and never touches them again.

### The design system

Semantic tokens only, defined in `src/index.css`. No raw hex in class names, ever.

| | |
|---|---|
| Surfaces | `bg-base` → `bg-surface` → `bg-raised` |
| Text | `text-ink` / `text-muted` / `text-faint` |
| Status | `text-profit` / `text-loss` / `text-warning` / `text-info` |
| Brand | `accent` — electric violet `#7c5cff` |

Chart colours are a separate, accessibility-validated system: 8 fixed categorical slots assigned **in order, never cycled**, plus a dedicated P&L pair. Reach for `chartTheme`, never a hand-picked hex.

`CONTRACT.md` at the repo root pins the full shared API. It's what the pages were built against — keep it honest.

---

## 🔒 Your data

Your journal lives in **your own Supabase account**, isolated by Postgres **Row Level Security** — every query is scoped to your user id, enforced by the database, not the app. Sign in with Supabase Auth and you see only your rows; the Worker forwards your token and holds no master key, so it can't reach anyone else's data either.

| Where | Holds |
|---|---|
| **Postgres** (8 tables, RLS) | Trades, accounts, cash, journal, goals, targets, watchlist, settings, MTF positions & brokers |
| **Cloudflare R2** | Trade screenshots — WebP, namespaced by user id |
| **`localStorage`** | The pre-cloud copy — kept read-only as your offline backup |

**No analytics, no telemetry, no third-party tracking.** Just your data, in your account.

### Back it up

**Settings → Data management → Export JSON** — a complete, lossless snapshot: every collection, your settings, and the full MTF store. **Import** restores all of it. (The old export gaps are closed — nothing is left behind anymore.)

---

## ☁️ Deploy

Frontend on **Cloudflare Pages**, API on a **Cloudflare Worker**, data in **Supabase**, screenshots in **R2**.

```bash
cd worker
npx wrangler r2 bucket create ledgerx-screenshots   # once
npx wrangler deploy                                  # Worker + R2 binding + daily cron
```

Then point the frontend at it: connect the repo to **Cloudflare Pages**, build `npm run build`, output `dist`, `NODE_VERSION=20`, and set the three `VITE_*` env vars — with `VITE_API_URL` pointing at the deployed Worker's `workers.dev` URL. Vite inlines env vars at build time, so **redeploy Pages after adding them.**

A daily `[triggers]` cron on the Worker makes one unauthenticated read against Postgres so the free Supabase project never idles into its 7-day pause — see [`worker/README.md`](worker/README.md). The pre-cloud [`netlify.toml`](netlify.toml) / [`vercel.json`](vercel.json) static configs are kept for reference.

The SPA fallback (`public/_redirects`) **isn't optional** — without it every route except `/` 404s on hard refresh. Classic.

---

## ✅ Shipped

Everything the roadmap promised — the journal now follows you between devices:

- [x] **Supabase** — Postgres + Auth + Row Level Security, Mumbai region
- [x] **Real auth** — email/password sign-in, a session-guarded app shell (`/login` and `/signup` do the real thing now)
- [x] **Cloudflare Worker API** — Hono, a JWT-forwarding pass-through to PostgREST so RLS stays the boundary
- [x] **One-click migration** — detect local data, verify the store version, upload it field-verified
- [x] **Screenshots → R2**, WebP on upload, never inline data-URIs in a trade row
- [x] **Lossless backup** — Export / Import now covers every collection
- [x] **Cloudflare Pages** deploy + a daily keep-alive cron

Still on the wishlist: Google sign-in, password reset, and broker API sync (Zerodha / Groww). Thanks to the store boundary, none of it touched the pages.

---

## 🤝 Contributing

Personal project, but issues and ideas are welcome. If you send a PR:

1. `npm run typecheck` passes. The build enforces it anyway.
2. Design tokens and `chartTheme` only — no raw hex.
3. Read `CONTRACT.md` before touching `store/`, `lib/`, or `components/ui/`.
4. New persisted field? Bump the version, write the migration.

---

## 📄 License

None chosen yet — which legally means **all rights reserved**. Read it, learn from it, but reuse isn't licensed. Want that to change? Drop in a `LICENSE` file (MIT is the usual pick).

---

<div align="center">

**Built for traders who'd rather know the real number.**

</div>
