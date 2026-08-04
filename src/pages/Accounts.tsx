/** ACCOUNTS / BROKERS — manage broker accounts, capital allocation and
 *  per-account performance. Intentionally unscoped by the global filters:
 *  each account is compared on its own all-time record. */

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, Building2, Landmark, Plus, Trash2, TrendingUp, Wallet } from "lucide-react";
import { format } from "date-fns";
import type { Account } from "@/types";
import { nextCashId, useStore } from "@/store/useStore";
import { datasetToday } from "@/store/useFilteredTrades";
import { toast } from "@/store/toast";
import { computeKpis, equityCurve, netCashFlow } from "@/lib/metrics";
import { formatMoney, formatNumber, pnlMarkColor } from "@/lib/format";
import { BAR_RADIUS_H, CURSOR_FILL, axisDefaults, gridDefaults } from "@/components/charts/chartTheme";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { KpiCard } from "@/components/ui/KpiCard";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { AccountCard, type AccountPerf } from "@/pages/accounts/AccountCard";
import { AccountFormModal, type AccountFormValues } from "@/pages/accounts/AccountFormModal";
import { FundsModal } from "@/pages/accounts/FundsModal";

type FormState = { mode: "add" } | { mode: "edit"; account: Account };

const EMPTY_PERF: AccountPerf = {
  netPnl: 0,
  equity: 0,
  netCashFlow: 0,
  trades: 0,
  closedTrades: 0,
  openTrades: 0,
  winRate: 0,
  roiPct: 0,
  spark: [0],
};

function slugify(name: string): string {
  const s = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "account";
}

/** Stable, timestamp-free id from the account name; suffixes -2, -3… on collision. */
function uniqueAccountId(name: string, taken: ReadonlySet<string>): string {
  const base = `acc-${slugify(name)}`;
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

/** [0, …cumPnl] downsampled to at most 12 points (always keeps first + last). */
function sparkPoints(cumPnl: number[]): number[] {
  const pts = [0, ...cumPnl];
  if (pts.length <= 12) return pts;
  const out: number[] = [];
  for (let i = 0; i < 12; i++) out.push(pts[Math.round((i * (pts.length - 1)) / 11)]);
  return out;
}

export default function Accounts() {
  const accounts = useStore((s) => s.accounts);
  const trades = useStore((s) => s.trades);
  const cashTransactions = useStore((s) => s.cashTransactions);
  const baseCurrency = useStore((s) => s.settings.baseCurrency);
  const filters = useStore((s) => s.filters);
  const addAccount = useStore((s) => s.addAccount);
  const updateAccount = useStore((s) => s.updateAccount);
  const deleteAccount = useStore((s) => s.deleteAccount);
  const addCashTransaction = useStore((s) => s.addCashTransaction);
  const deleteCashTransaction = useStore((s) => s.deleteCashTransaction);
  const setFilters = useStore((s) => s.setFilters);

  const [form, setForm] = useState<FormState | null>(null);
  const [deleting, setDeleting] = useState<Account | null>(null);
  const [fundsAccount, setFundsAccount] = useState<Account | null>(null);

  const perfById = useMemo(() => {
    const map = new Map<string, AccountPerf>();
    for (const account of accounts) {
      const own = trades.filter((t) => t.accountId === account.id);
      const cashFlow = netCashFlow(cashTransactions.filter((c) => c.accountId === account.id));
      const kpis = computeKpis(own, account.startingCapital);
      map.set(account.id, {
        netPnl: kpis.totalNetPnl,
        netCashFlow: cashFlow,
        equity: account.startingCapital + kpis.totalNetPnl + cashFlow,
        trades: kpis.totalTrades,
        closedTrades: kpis.closedTrades,
        openTrades: kpis.openTrades,
        winRate: kpis.winRate,
        roiPct: kpis.roiPct,
        spark: sparkPoints(equityCurve(own, account.startingCapital).map((p) => p.cumPnl)),
      });
    }
    return map;
  }, [accounts, trades, cashTransactions]);

  // Combined totals only aggregate accounts in the base currency — summing
  // across currencies without an FX rate would be meaningless.
  const combined = useMemo(() => {
    const baseAccounts = accounts.filter((a) => a.currency === baseCurrency);
    const ids = new Set(baseAccounts.map((a) => a.id));
    const baseTrades = trades.filter((t) => ids.has(t.accountId));
    const baseCash = cashTransactions.filter((c) => ids.has(c.accountId));
    const capital = baseAccounts.reduce((sum, a) => sum + a.startingCapital, 0);
    const cashFlow = netCashFlow(baseCash);
    const kpis = computeKpis(baseTrades, capital);
    return {
      capital,
      count: baseAccounts.length,
      netPnl: kpis.totalNetPnl,
      netCashFlow: cashFlow,
      equity: capital + kpis.totalNetPnl + cashFlow,
      closedTrades: kpis.closedTrades,
      openTrades: kpis.openTrades,
      spark: sparkPoints(equityCurve(baseTrades, capital).map((p) => p.cumPnl)),
    };
  }, [accounts, trades, cashTransactions, baseCurrency]);

  const chartData = useMemo(
    () =>
      accounts
        .map((a) => ({ name: a.name, pnl: perfById.get(a.id)?.netPnl ?? 0 }))
        .sort((a, b) => b.pnl - a.pnl),
    [accounts, perfById],
  );

  const deletingTradeCount = deleting
    ? trades.filter((t) => t.accountId === deleting.id).length
    : 0;

  const handleSave = (values: AccountFormValues) => {
    if (form?.mode === "edit") {
      updateAccount(form.account.id, values);
      toast(`Updated "${values.name}"`);
    } else {
      const id = uniqueAccountId(values.name, new Set(accounts.map((a) => a.id)));
      const createdAt = format(datasetToday(trades), "yyyy-MM-dd");
      addAccount({ id, createdAt, ...values });
      toast(`Account "${values.name}" added`);
    }
    setForm(null);
  };

  const handleFocus = (account: Account) => {
    if (filters.accountId === account.id) {
      setFilters({ accountId: "all" });
      toast("Showing all accounts", "info");
    } else {
      setFilters({ accountId: account.id });
      toast(`Filtering by ${account.name}`, "info");
    }
  };

  const confirmDelete = () => {
    if (!deleting) return;
    const n = deletingTradeCount;
    deleteAccount(deleting.id);
    toast(`Deleted "${deleting.name}" and ${n} trade${n === 1 ? "" : "s"}`, "info");
    setDeleting(null);
  };

  return (
    <div className="animate-in">
      <PageHeader
        title="Accounts"
        description="Broker accounts, capital allocation and per-account performance."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setForm({ mode: "add" })}>
            Add account
          </Button>
        }
      />

      <div className="space-y-4">
        {/* summary KPIs */}
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <KpiCard
            label="Combined capital"
            value={combined.capital}
            format={(n) => formatMoney(n, { compact: true, currency: baseCurrency })}
            icon={Wallet}
            sub={`across ${combined.count} ${baseCurrency} account${combined.count === 1 ? "" : "s"}`}
          />
          <KpiCard
            label="Current balance"
            value={combined.equity}
            format={(n) => formatMoney(n, { compact: true, currency: baseCurrency })}
            icon={Landmark}
            sub={
              combined.netCashFlow !== 0
                ? `capital + P&L ${combined.netCashFlow >= 0 ? "+" : "−"} ${formatMoney(Math.abs(combined.netCashFlow), { compact: true, currency: baseCurrency })} funding`
                : "capital + realised P&L"
            }
            spark={combined.spark}
          />
          <KpiCard
            label="Total net P&L"
            value={combined.netPnl}
            format={(n) => formatMoney(n, { compact: true, sign: true, currency: baseCurrency })}
            icon={TrendingUp}
            toneBySign
            sub={`${combined.closedTrades} closed trade${combined.closedTrades === 1 ? "" : "s"}`}
          />
          <KpiCard
            label="Active accounts"
            value={accounts.length}
            format={(n) => formatNumber(Math.round(n))}
            icon={Building2}
            sub={`${combined.openTrades} open position${combined.openTrades === 1 ? "" : "s"}`}
          />
        </div>

        {/* account cards */}
        {accounts.length === 0 ? (
          <Card>
            <EmptyState
              icon={Landmark}
              title="No accounts yet"
              hint="Add your first broker account to start attributing trades, capital and P&L."
              action={
                <Button variant="primary" icon={Plus} onClick={() => setForm({ mode: "add" })}>
                  Add account
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {accounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                perf={perfById.get(account.id) ?? { ...EMPTY_PERF, equity: account.startingCapital }}
                focused={filters.accountId === account.id}
                onFocus={() => handleFocus(account)}
                onFunds={() => setFundsAccount(account)}
                onEdit={() => setForm({ mode: "edit", account })}
                onDelete={() => setDeleting(account)}
              />
            ))}
            {/* ghost add card */}
            <button
              type="button"
              onClick={() => setForm({ mode: "add" })}
              className="group flex min-h-[260px] flex-col items-center justify-center gap-2 rounded-[14px] border border-dashed border-edge text-muted transition-colors duration-150 hover:border-accent/60 hover:bg-raised/40 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft transition-transform duration-150 group-hover:scale-110">
                <Plus size={18} className="text-accent" aria-hidden />
              </span>
              <span className="text-[13px] font-medium">Add account</span>
              <span className="text-[11px] text-faint">Track another broker or capital pocket</span>
            </button>
          </div>
        )}

        {/* per-account P&L comparison */}
        <Card title="Net P&L by account" subtitle="All-time realised performance per broker account">
          {chartData.length === 0 || combined.closedTrades === 0 ? (
            <EmptyState
              icon={TrendingUp}
              title="No closed trades yet"
              hint="Once trades are closed, per-account P&L comparison shows up here."
            />
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(180, chartData.length * 52 + 24)}>
              <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 24, bottom: 0, left: 8 }}>
                <CartesianGrid {...gridDefaults} horizontal={false} vertical />
                <XAxis
                  {...axisDefaults}
                  type="number"
                  tickFormatter={(v: number) => formatMoney(v, { compact: true })}
                />
                <YAxis
                  {...axisDefaults}
                  type="category"
                  dataKey="name"
                  width={150}
                  tickFormatter={(v: string) => (v.length > 20 ? `${v.slice(0, 19)}…` : v)}
                />
                <Tooltip
                  content={
                    <ChartTooltip valueFormatter={(v) => formatMoney(v, { compact: true, sign: true })} />
                  }
                  cursor={{ fill: CURSOR_FILL }}
                />
                <Bar dataKey="pnl" name="Net P&L" maxBarSize={24} radius={BAR_RADIUS_H}>
                  {chartData.map((d, i) => (
                    <Cell key={`${d.name}-${i}`} fill={pnlMarkColor(d.pnl)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* add / edit modal */}
      <AccountFormModal
        open={form !== null}
        initial={form?.mode === "edit" ? form.account : null}
        onClose={() => setForm(null)}
        onSave={handleSave}
      />

      {/* manage funds modal */}
      <FundsModal
        open={fundsAccount !== null}
        account={fundsAccount}
        transactions={fundsAccount ? cashTransactions.filter((c) => c.accountId === fundsAccount.id) : []}
        netPnl={fundsAccount ? (perfById.get(fundsAccount.id)?.netPnl ?? 0) : 0}
        defaultDate={format(datasetToday(trades), "yyyy-MM-dd")}
        onClose={() => setFundsAccount(null)}
        onAdd={(txn) => addCashTransaction({ id: nextCashId(cashTransactions), ...txn })}
        onDelete={(id) => deleteCashTransaction(id)}
      />

      {/* delete confirmation */}
      <Modal open={deleting !== null} onClose={() => setDeleting(null)} title="Delete account" widthClass="max-w-md">
        {deleting && (
          <>
            <div className="flex gap-3 rounded-xl border border-loss/30 bg-loss-soft p-4">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-loss" aria-hidden />
              <div className="text-[13px] leading-relaxed">
                <p className="font-medium text-ink">Delete “{deleting.name}”?</p>
                <p className="mt-1 text-muted">
                  This permanently removes the account and its{" "}
                  <span className="font-semibold text-ink">
                    {deletingTradeCount} trade{deletingTradeCount === 1 ? "" : "s"}
                  </span>
                  . This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDeleting(null)}>
                Cancel
              </Button>
              <Button variant="danger" icon={Trash2} onClick={confirmDelete}>
                Delete account
              </Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
