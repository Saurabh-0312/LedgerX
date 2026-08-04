-- LedgerX — initial Postgres schema (Phase 2)
--
-- Design contract (locked, see Phase 2 spec D1–D6):
--   D1  Column names match the TypeScript field names EXACTLY (camelCase, quoted).
--       The Worker streams response bodies through unchanged, so these column
--       names ARE the JSON keys the React app receives. The sole exception is
--       user_id (snake_case), the auth foreign key every table carries.
--   D2  Every date/time field is `text` — the app stores "2025-01-01T16:17",
--       "2026-07-03" etc. and feeds them straight into datetime-local/date
--       inputs. timestamptz/date would reformat and break round-trip.
--   D3  Every numeric field is `double precision` — JS float64, exact round-trip.
--       `numeric` risks string/precision drift in lib/metrics.ts.
--   D4  ids stay `text`; primary key is (user_id, id) so "T-0001" can exist for
--       many users. No UUID primary keys.
--   D5  Nested objects/arrays are `jsonb` (charges, tax, tags, linkedTradeIds,
--       MTF lots/charges, and the singleton config blobs).
--   D6  user_settings.settings DEFAULT carries the COMPLETE chargeRates (23 keys)
--       and taxRates (9 keys) — a missing key crashes the Settings page.
--
-- The transient UI range/account selector state gets no table and no column.
--
-- RLS: every table is owner-scoped via auth.uid() = user_id, with explicit
-- grants to `authenticated` only (the project has "auto-expose new tables"
-- disabled). `anon` receives nothing.

-- The authenticated role needs schema visibility before table grants apply.
grant usage on schema public to authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- accounts  (Account)
-- ─────────────────────────────────────────────────────────────────────────────
create table public.accounts (
  user_id           uuid not null references auth.users (id) on delete cascade,
  "id"              text not null,
  "name"            text not null,
  "broker"          text not null,
  "currency"        text not null,
  "startingCapital" double precision not null,
  "createdAt"       text not null,
  primary key (user_id, "id")
);

create index idx_accounts_user_id on public.accounts (user_id);

alter table public.accounts enable row level security;

create policy "accounts_select" on public.accounts for select
  to authenticated
  using (auth.uid() = user_id);
create policy "accounts_insert" on public.accounts for insert
  to authenticated
  with check (auth.uid() = user_id);
create policy "accounts_update" on public.accounts for update
  to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "accounts_delete" on public.accounts for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.accounts to authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- trades  (Trade) — full interface from src/types.ts
-- ─────────────────────────────────────────────────────────────────────────────
create table public.trades (
  user_id            uuid not null references auth.users (id) on delete cascade,
  "id"               text not null,
  "accountId"        text not null,
  "symbol"           text not null,
  "assetClass"       text not null,
  "segment"          text not null,
  "exchange"         text not null,
  "direction"        text not null,
  "status"           text not null,
  "quantity"         double precision not null,
  "entryPrice"       double precision not null,
  "exitPrice"        double precision,
  "stopLoss"         double precision,
  "target"           double precision,
  "openedAt"         text not null,
  "closedAt"         text,
  "holdingMinutes"   double precision,
  "grossPnl"         double precision not null,
  "charges"          jsonb not null,
  "manualCharges"    boolean,
  "netPnl"           double precision not null,
  "taxablePnl"       double precision not null,
  "tax"              jsonb not null,
  "riskAmount"       double precision not null,
  "rMultiple"        double precision,
  "positionValue"    double precision not null,
  "pctOfCapital"     double precision not null,
  "strategy"         text not null,
  "marketCondition"  text not null,
  "timeframe"        text not null,
  "tags"             jsonb not null,
  "emotionRating"    double precision not null,
  "confidenceRating" double precision not null,
  "screenshotUrl"    text,
  "notes"            text not null,
  "mistakes"         text,
  "lessons"          text,
  primary key (user_id, "id")
);

create index idx_trades_user_id on public.trades (user_id);
create index idx_trades_user_openedAt on public.trades (user_id, "openedAt");

alter table public.trades enable row level security;

create policy "trades_select" on public.trades for select
  to authenticated
  using (auth.uid() = user_id);
create policy "trades_insert" on public.trades for insert
  to authenticated
  with check (auth.uid() = user_id);
create policy "trades_update" on public.trades for update
  to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "trades_delete" on public.trades for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.trades to authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- cash_transactions  (CashTransaction)
-- ─────────────────────────────────────────────────────────────────────────────
create table public.cash_transactions (
  user_id      uuid not null references auth.users (id) on delete cascade,
  "id"         text not null,
  "accountId"  text not null,
  "type"       text not null,
  "amount"     double precision not null,
  "date"       text not null,
  "note"       text,
  primary key (user_id, "id")
);

create index idx_cash_transactions_user_id on public.cash_transactions (user_id);

alter table public.cash_transactions enable row level security;

create policy "cash_transactions_select" on public.cash_transactions for select
  to authenticated
  using (auth.uid() = user_id);
create policy "cash_transactions_insert" on public.cash_transactions for insert
  to authenticated
  with check (auth.uid() = user_id);
create policy "cash_transactions_update" on public.cash_transactions for update
  to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "cash_transactions_delete" on public.cash_transactions for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.cash_transactions to authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- journal_entries  (JournalEntry)
-- ─────────────────────────────────────────────────────────────────────────────
create table public.journal_entries (
  user_id           uuid not null references auth.users (id) on delete cascade,
  "id"              text not null,
  "date"            text not null,
  "title"           text not null,
  "content"         text not null,
  "mood"            text not null,
  "linkedTradeIds"  jsonb not null,
  primary key (user_id, "id")
);

create index idx_journal_entries_user_id on public.journal_entries (user_id);

alter table public.journal_entries enable row level security;

create policy "journal_entries_select" on public.journal_entries for select
  to authenticated
  using (auth.uid() = user_id);
create policy "journal_entries_insert" on public.journal_entries for insert
  to authenticated
  with check (auth.uid() = user_id);
create policy "journal_entries_update" on public.journal_entries for update
  to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "journal_entries_delete" on public.journal_entries for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.journal_entries to authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- watchlist_items  (WatchlistItem)
-- ─────────────────────────────────────────────────────────────────────────────
create table public.watchlist_items (
  user_id         uuid not null references auth.users (id) on delete cascade,
  "id"            text not null,
  "symbol"        text not null,
  "assetClass"    text not null,
  "note"          text not null,
  "plannedSetup"  text not null,
  "alertPrice"    double precision,
  "addedAt"       text not null,
  primary key (user_id, "id")
);

create index idx_watchlist_items_user_id on public.watchlist_items (user_id);

alter table public.watchlist_items enable row level security;

create policy "watchlist_items_select" on public.watchlist_items for select
  to authenticated
  using (auth.uid() = user_id);
create policy "watchlist_items_insert" on public.watchlist_items for insert
  to authenticated
  with check (auth.uid() = user_id);
create policy "watchlist_items_update" on public.watchlist_items for update
  to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "watchlist_items_delete" on public.watchlist_items for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.watchlist_items to authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- mtf_brokers  (MtfBroker, src/lib/mtf/types.ts)
-- ─────────────────────────────────────────────────────────────────────────────
create table public.mtf_brokers (
  user_id         uuid not null references auth.users (id) on delete cascade,
  "id"            text not null,
  "name"          text not null,
  "dailyRatePct"  double precision not null,
  primary key (user_id, "id")
);

create index idx_mtf_brokers_user_id on public.mtf_brokers (user_id);

alter table public.mtf_brokers enable row level security;

create policy "mtf_brokers_select" on public.mtf_brokers for select
  to authenticated
  using (auth.uid() = user_id);
create policy "mtf_brokers_insert" on public.mtf_brokers for insert
  to authenticated
  with check (auth.uid() = user_id);
create policy "mtf_brokers_update" on public.mtf_brokers for update
  to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "mtf_brokers_delete" on public.mtf_brokers for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.mtf_brokers to authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- mtf_positions  (MtfPosition) — full interface from src/lib/mtf/types.ts
-- ─────────────────────────────────────────────────────────────────────────────
create table public.mtf_positions (
  user_id               uuid not null references auth.users (id) on delete cascade,
  "id"                  text not null,
  "stockName"           text not null,
  "symbol"              text not null,
  "brokerId"            text not null,
  "lots"                jsonb,
  "purchaseDate"        text not null,
  "quantity"            double precision not null,
  "avgBuyPrice"         double precision not null,
  "totalInvestment"     double precision not null,
  "currentPrice"        double precision,
  "status"              text not null,
  "notes"               text,
  "dailyRatePct"        double precision not null,
  "interestBasis"       text not null,
  "fundedPercent"       double precision not null,
  "manualInterestAdj"   double precision,
  "charges"             jsonb not null,
  "exitDate"            text,
  "exitPrice"           double precision,
  "finalHoldingDays"    double precision,
  "finalInterest"       double precision,
  "finalCharges"        double precision,
  "finalGrossProfit"    double precision,
  "finalNetProfit"      double precision,
  "finalBreakEvenPrice" double precision,
  primary key (user_id, "id")
);

create index idx_mtf_positions_user_id on public.mtf_positions (user_id);

alter table public.mtf_positions enable row level security;

create policy "mtf_positions_select" on public.mtf_positions for select
  to authenticated
  using (auth.uid() = user_id);
create policy "mtf_positions_insert" on public.mtf_positions for insert
  to authenticated
  with check (auth.uid() = user_id);
create policy "mtf_positions_update" on public.mtf_positions for update
  to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "mtf_positions_delete" on public.mtf_positions for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.mtf_positions to authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- user_settings  (singleton per user)
--   goals            → Goals              (src/types.ts)
--   portfolioTargets → PortfolioTargets   (src/types.ts)
--   settings         → AppSettings        (src/types.ts) — carries the FULL
--                      chargeRates (23 keys) + taxRates (9 keys), copied verbatim
--                      from DEFAULT_CHARGE_RATES / DEFAULT_TAX_RATES (D6).
--   mtfAccountValue  → mtf-store accountValue
-- user_id is the sole primary key here, so it already provides the (user_id)
-- index — no separate index needed.
-- ─────────────────────────────────────────────────────────────────────────────
create table public.user_settings (
  user_id            uuid not null references auth.users (id) on delete cascade,
  "goals"            jsonb not null default '{
    "monthlyProfitTarget": 0,
    "winRateTarget": 0,
    "maxDailyLoss": 0,
    "maxTradesPerDay": 0
  }'::jsonb,
  "portfolioTargets" jsonb not null default '{
    "percents": [],
    "capitalByMonth": {}
  }'::jsonb,
  "settings"         jsonb not null default '{
    "userName": "",
    "email": "",
    "baseCurrency": "INR",
    "timezone": "Asia/Kolkata",
    "startingCapital": 0,
    "theme": "dark",
    "chargeRates": {
      "brokerageFlatPerOrder": 20,
      "brokeragePctPerOrder": 0.1,
      "minBrokeragePerOrder": 5,
      "mtfInterestAnnualPct": 14.95,
      "sttIntradayPct": 0.025,
      "sttDeliveryPct": 0.1,
      "sttOptionsPct": 0.1,
      "sttFuturesPct": 0.02,
      "exchangeEquityPct": 0.00297,
      "exchangeEquityBsePct": 0.00375,
      "exchangeOptionsPct": 0.03503,
      "exchangeFuturesPct": 0.00173,
      "exchangeCommodityPct": 0.0026,
      "exchangeForexPct": 0.0009,
      "cryptoFeePct": 0.2,
      "sebiPct": 0.0001,
      "stampDeliveryPct": 0.015,
      "stampIntradayPct": 0.003,
      "stampOptionsPct": 0.003,
      "stampFuturesPct": 0.002,
      "gstPct": 18,
      "dpChargePerSell": 20,
      "pledgeChargePerRequest": 20
    },
    "taxRates": {
      "intradayPct": 30,
      "stcgPct": 20,
      "ltcgPct": 12.5,
      "cryptoPct": 30,
      "basicExemption": 400000,
      "ltcgExemption": 125000,
      "rebate87ALimit": 1200000,
      "rebate87AMax": 60000,
      "cessPct": 4
    }
  }'::jsonb,
  "mtfAccountValue"  double precision not null default 0,
  primary key (user_id)
);

alter table public.user_settings enable row level security;

create policy "user_settings_select" on public.user_settings for select
  to authenticated
  using (auth.uid() = user_id);
create policy "user_settings_insert" on public.user_settings for insert
  to authenticated
  with check (auth.uid() = user_id);
create policy "user_settings_update" on public.user_settings for update
  to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_settings_delete" on public.user_settings for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.user_settings to authenticated;
