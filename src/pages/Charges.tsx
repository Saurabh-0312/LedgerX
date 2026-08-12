/** Charges & Fees — where the costs hide.
 *  KPI row · monthly stacked component chart · account/percent charts ·
 *  cost-per-trade trend · component totals · per-trade table · rate-card note. */

import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Coins,
  Download,
  History,
  Info,
  Landmark,
  Layers,
  Percent,
  Receipt,
  TrendingDown,
  TriangleAlert,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import { useFilteredTrades } from "@/store/useFilteredTrades";
import { computeKpis, monthLabel, monthlyPnl } from "@/lib/metrics";
import { formatMoney, formatPct } from "@/lib/format";
import { downloadFile, toCsv } from "@/lib/csv";
import { toast } from "@/store/toast";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import {
  AXIS_TEXT,
  BAR_RADIUS_H,
  CAT,
  CURSOR_FILL,
  GRID,
  WARNING,
  axisDefaults,
  gridDefaults,
} from "@/components/charts/chartTheme";
import { CHARGE_COMPONENTS, sumComponent } from "./charges/chargeComponents";
import { ComponentTotalsTable } from "./charges/ComponentTotalsTable";
import { PerTradeChargesTable } from "./charges/PerTradeChargesTable";

/** Card surface hex — the contract's 2px surface-gap rule for stacked segments. */
const SURFACE = "#141619";

interface MonthChargesRow {
  month: string;
  label: string;
  brokerage: number;
  exchangeTxn: number;
  stt: number;
  sebi: number;
  stampDuty: number;
  gst: number;
  dpCharges: number;
  pledgeCharges: number;
  manual: number;
  mtfInterest: number;
}

export default function Charges() {
  const trades = useFilteredTrades();
  const allTrades = useStore((s) => s.trades);
  const accounts = useStore((s) => s.accounts);
  const startingCapital = useStore((s) => s.settings.startingCapital);

  const kpis = useMemo(() => computeKpis(trades, startingCapital), [trades, startingCapital]);

  /** Executed trades (cancelled ones carry no fees). */
  const chargeable = useMemo(() => trades.filter((t) => t.status !== "Cancelled"), [trades]);

  const componentTotals = useMemo(
    () => CHARGE_COMPONENTS.map((def) => ({ def, total: sumComponent(chargeable, def.key) })),
    [chargeable],
  );

  const totalCharges = useMemo(
    () => componentTotals.reduce((acc, r) => acc + r.total, 0),
    [componentTotals],
  );

  const largest = useMemo(
    () => componentTotals.reduce((a, b) => (b.total > a.total ? b : a), componentTotals[0]),
    [componentTotals],
  );

  const gstTotal = componentTotals.find((c) => c.def.key === "gst")?.total ?? 0;
  const avgPerTrade = chargeable.length ? totalCharges / chargeable.length : 0;
  const largestShare = totalCharges > 0 ? (largest.total / totalCharges) * 100 : 0;

  /** Lifetime — deliberately ignores the global range/account filters. */
  const lifetime = useMemo(() => {
    const executed = allTrades.filter((t) => t.status !== "Cancelled");
    return {
      total: executed.reduce((acc, t) => acc + t.charges.total, 0),
      count: executed.length,
    };
  }, [allTrades]);

  /** Per-month component sums over the SAME chargeable set as the totals/other
   *  charts (open trades included, grouped by close-or-open month) so the stack
   *  reconciles with the KPI and component-table totals. */
  const monthlyComponents = useMemo<MonthChargesRow[]>(() => {
    const map = new Map<string, MonthChargesRow>();
    for (const t of chargeable) {
      const month = (t.closedAt ?? t.openedAt).slice(0, 7);
      let row = map.get(month);
      if (!row) {
        row = {
          month,
          label: monthLabel(month),
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
        };
        map.set(month, row);
      }
      for (const { key } of CHARGE_COMPONENTS) row[key] += t.charges[key] ?? 0;
    }
    return [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
  }, [chargeable]);

  const monthly = useMemo(() => monthlyPnl(trades), [trades]);

  const pctPerMonth = useMemo(
    () =>
      monthly.map((m) => ({
        label: m.label,
        pct: Math.abs(m.gross) > 0 ? (m.charges / Math.abs(m.gross)) * 100 : 0,
      })),
    [monthly],
  );

  const costPerTrade = useMemo(
    () =>
      monthly.map((m) => ({
        label: m.label,
        avg: m.trades ? m.charges / m.trades : 0,
      })),
    [monthly],
  );

  const byAccount = useMemo(() => {
    const nameOf = new Map(accounts.map((a) => [a.id, a.name]));
    const map = new Map<string, number>();
    for (const t of chargeable) {
      const name = nameOf.get(t.accountId) ?? t.accountId;
      map.set(name, (map.get(name) ?? 0) + t.charges.total);
    }
    return [...map.entries()]
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);
  }, [chargeable, accounts]);

  const handleExport = () => {
    const rows = chargeable
      .filter((t) => t.charges.total > 0)
      .sort((a, b) => b.charges.total - a.charges.total)
      .map((t) => [
        t.id,
        (t.closedAt ?? t.openedAt).slice(0, 10),
        t.symbol,
        t.status === "Closed" ? t.grossPnl.toFixed(2) : "",
        ...CHARGE_COMPONENTS.map((c) => (t.charges[c.key] ?? 0).toFixed(2)),
        t.charges.total.toFixed(2),
      ]);
    if (!rows.length) {
      toast("No charges to export in this range", "info");
      return;
    }
    const csv = toCsv(
      ["Trade ID", "Date", "Symbol", "Gross P&L", ...CHARGE_COMPONENTS.map((c) => c.label), "Total charges"],
      rows,
    );
    downloadFile("ledgerx-charges.csv", csv);
    toast(`Exported charges for ${rows.length} trades`);
  };

  const moneyCompact = (v: number) => formatMoney(v, { compact: true });
  const hasData = chargeable.length > 0;

  return (
    <>
      <PageHeader
        title="Charges & Fees"
        description="Where the costs hide — brokerage, statutory levies and taxes across every trade."
        actions={
          <Button variant="outline" size="sm" icon={Download} onClick={handleExport}>
            Export CSV
          </Button>
        }
      />

      <div className="animate-in space-y-4">
        {/* 1 · KPI row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <KpiCard
            label="Total charges"
            value={totalCharges}
            format={moneyCompact}
            icon={TriangleAlert}
            sub={`${chargeable.length} trades in range`}
          />
          <KpiCard
            label="% of gross P&L"
            value={kpis.chargesPctOfGross}
            format={(n) => formatPct(n)}
            icon={Percent}
            sub="charges ÷ |gross P&L|"
          />
          <KpiCard
            label="Avg per trade"
            value={avgPerTrade}
            format={(n) => formatMoney(n)}
            icon={Receipt}
            sub="across executed trades"
          />
          <KpiCard
            label="Largest component"
            value={largest.total}
            format={() => (largest.total > 0 ? largest.def.label : "—")}
            icon={Layers}
            sub={
              largest.total > 0
                ? `${formatMoney(largest.total)} · ${formatPct(largestShare)} of charges`
                : "No charges in range"
            }
          />
          <KpiCard
            label="Est. GST paid"
            value={gstTotal}
            format={moneyCompact}
            icon={Landmark}
            sub="18% on brokerage + txn + SEBI + DP + pledge"
          />
          <KpiCard
            label="Lifetime charges"
            value={lifetime.total}
            format={moneyCompact}
            icon={History}
            sub={`All time · ${lifetime.count} trades — ignores filters`}
          />
        </div>

        {!hasData ? (
          <Card>
            <EmptyState
              icon={Coins}
              title="No trades in the selected range"
              hint="Widen the global date range or switch accounts in the topbar to see where your fees go."
            />
          </Card>
        ) : (
          <>
            {/* 2 · Monthly stacked component chart */}
            <Card
              title="Monthly charges by component"
              subtitle="Stacked fee breakdown per closing month"
            >
              {monthlyComponents.length ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthlyComponents} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid {...gridDefaults} />
                    <XAxis {...axisDefaults} dataKey="label" />
                    <YAxis {...axisDefaults} width={56} tickFormatter={(v: number) => moneyCompact(v)} />
                    <Tooltip
                      content={<ChartTooltip hideZero valueFormatter={(v) => formatMoney(v)} />}
                      cursor={{ fill: CURSOR_FILL }}
                    />
                    <Legend
                      iconSize={9}
                      wrapperStyle={{ fontSize: 12, paddingTop: 4 }}
                      formatter={(value) => <span style={{ color: AXIS_TEXT }}>{value}</span>}
                    />
                    {CHARGE_COMPONENTS.map((c) => (
                      <Bar
                        key={c.key}
                        dataKey={c.key}
                        name={c.label}
                        stackId="c"
                        fill={c.color}
                        stroke={SURFACE}
                        strokeWidth={1.5}
                        maxBarSize={24}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState
                  icon={Coins}
                  title="No closed trades in range"
                  hint="Monthly fee stacks appear once trades are closed inside the selected range."
                />
              )}
            </Card>

            {/* 3 · Account split + cost drag */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card title="Charges by account" subtitle="Total fees paid per broker account">
                {byAccount.length ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart
                      data={byAccount}
                      layout="vertical"
                      margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
                    >
                      <CartesianGrid {...gridDefaults} horizontal={false} vertical />
                      <XAxis {...axisDefaults} type="number" tickFormatter={(v: number) => moneyCompact(v)} />
                      <YAxis {...axisDefaults} type="category" dataKey="name" width={128} />
                      <Tooltip
                        content={<ChartTooltip valueFormatter={(v) => formatMoney(v)} />}
                        cursor={{ fill: CURSOR_FILL }}
                      />
                      <Bar
                        dataKey="total"
                        name="Charges"
                        fill={CAT[0]}
                        radius={BAR_RADIUS_H}
                        maxBarSize={24}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState
                    icon={Coins}
                    title="No account charges"
                    hint="Fees group by broker account once trades incur charges."
                  />
                )}
              </Card>

              <Card title="Charges as % of gross" subtitle="Monthly cost drag — lower is better">
                {pctPerMonth.length ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={pctPerMonth} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid {...gridDefaults} />
                      <XAxis {...axisDefaults} dataKey="label" />
                      <YAxis
                        {...axisDefaults}
                        width={44}
                        domain={[0, "auto"]}
                        tickFormatter={(v: number) => formatPct(v, 0)}
                      />
                      <Tooltip
                        content={<ChartTooltip valueFormatter={(v) => formatPct(v, 2)} />}
                        cursor={{ stroke: GRID }}
                      />
                      <Line
                        type="monotone"
                        dataKey="pct"
                        name="Charges % of gross"
                        stroke={WARNING}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, stroke: SURFACE, strokeWidth: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState
                    icon={TrendingDown}
                    title="No closed months yet"
                    hint="The cost-drag trend needs at least one month of closed trades."
                  />
                )}
              </Card>
            </div>

            {/* 4 · Cost per trade trend */}
            <Card title="Cost per trade" subtitle="Average charges per closed trade, by month">
              {costPerTrade.length ? (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={costPerTrade} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid {...gridDefaults} />
                    <XAxis {...axisDefaults} dataKey="label" />
                    <YAxis {...axisDefaults} width={56} tickFormatter={(v: number) => moneyCompact(v)} />
                    <Tooltip
                      content={
                        <ChartTooltip valueFormatter={(v) => formatMoney(v, { decimals: true })} />
                      }
                      cursor={{ stroke: GRID }}
                    />
                    <Line
                      type="monotone"
                      dataKey="avg"
                      name="Avg charges / trade"
                      stroke={CAT[0]}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, stroke: SURFACE, strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState
                  icon={Receipt}
                  title="No closed trades in range"
                  hint="The cost-per-trade trend appears once trades close inside the selected range."
                />
              )}
            </Card>

            {/* 5 · Component totals */}
            <Card title="Component totals" subtitle="Where the money goes, by fee head">
              <ComponentTotalsTable rows={componentTotals} tradeCount={chargeable.length} />
            </Card>

            {/* 6 · Per-trade charges */}
            <Card
              title="Per-trade charges"
              subtitle="Every executed trade, costliest first — click a row to open it"
            >
              <PerTradeChargesTable trades={chargeable} />
            </Card>
          </>
        )}

        {/* Rate-card note */}
        <Card>
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-warning-soft">
              <Info size={15} className="text-warning" aria-hidden />
            </div>
            <p className="text-[12.5px] leading-relaxed text-muted">
              Charges are computed from the configurable rate card in{" "}
              <Link to="/settings" className="font-medium text-accent hover:underline">
                Settings
              </Link>{" "}
              — brokerage ₹20 or 0.1% whichever lower (flat 0.1% for MTF), STT/CTT by segment,
              exchange transaction fees (NSE/BSE), SEBI turnover fees, stamp duty on the buy side,
              DP charges on delivery/MTF/ETF sells, pledge + MTF interest, and 18% GST on brokerage +
              exchange txn + SEBI + DP + pledge. Adjust the rates to match your broker and future
              trades recompute automatically.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
}
