/** Reports / Export — build downloadable performance, trade-log and tax summaries.
 *  The period + account selectors here are LOCAL to this page and independent of
 *  the global topbar filters, so a report can cover any span without touching them. */

import { useMemo, useState } from "react";
import {
  CalendarRange,
  Download,
  FileBarChart2,
  FileSpreadsheet,
  Info,
  Printer,
  ReceiptText,
  ScrollText,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { TaxCategory, Trade } from "@/types";
import { useStore } from "@/store/useStore";
import { datasetToday, rangeForPreset } from "@/store/useFilteredTrades";
import { closedOf, computeKpis, financialYearOf, monthlyPnl } from "@/lib/metrics";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatNumber,
  formatPct,
  formatR,
  pnlClass,
} from "@/lib/format";
import { downloadFile, toCsv } from "@/lib/csv";
import { toast } from "@/store/toast";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Field, Select } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { TableShell, TD, TH } from "@/components/ui/Table";
import { buildPrintHtml, MAX_PRINT_ROWS } from "./reports/printReport";
import type { PrintKpi } from "./reports/printReport";

/* ------------------------------------------------------------------ */
/* Period model                                                        */
/* ------------------------------------------------------------------ */

interface PeriodOption {
  key: string;
  label: string;
  /** filename-safe slug, e.g. "this-month", "fy-2025-26" */
  slug: string;
  from: Date | null;
  to: Date | null;
}

const NO_CUSTOM = { from: null, to: null } as const;
const round2 = (v: number) => Math.round(v * 100) / 100;
const TAX_CATEGORY_ORDER: TaxCategory[] = ["Intraday", "STCG", "LTCG", "Crypto"];

/* ------------------------------------------------------------------ */
/* Small presentational pieces                                         */
/* ------------------------------------------------------------------ */

function StatCell({ item }: { item: PrintKpi }) {
  const toneClass = item.tone !== undefined && item.tone !== 0 ? pnlClass(item.tone) : "text-ink";
  return (
    <div className="rounded-xl border border-edge-soft bg-raised/40 px-3.5 py-3 transition-colors hover:border-edge">
      <div className="label-caps">{item.label}</div>
      <div className={`mt-1 truncate text-[17px] font-semibold leading-tight tracking-tight ${toneClass}`}>
        {item.value}
      </div>
      {item.sub && <div className="mt-0.5 truncate text-[11px] text-muted">{item.sub}</div>}
    </div>
  );
}

interface ExportRowProps {
  icon: LucideIcon;
  iconClass: string;
  title: string;
  description: string;
  buttonLabel: string;
  buttonIcon: LucideIcon;
  buttonVariant?: "primary" | "outline";
  disabled?: boolean;
  onClick: () => void;
}

function ExportRow({
  icon: Icon,
  iconClass,
  title,
  description,
  buttonLabel,
  buttonIcon,
  buttonVariant = "outline",
  disabled,
  onClick,
}: ExportRowProps) {
  return (
    <div className="flex items-center gap-3.5 py-3.5 first:pt-0 last:pb-0">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${iconClass}`}>
        <Icon size={16} aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-ink">{title}</div>
        <div className="mt-0.5 text-[12px] leading-snug text-muted">{description}</div>
      </div>
      <Button
        size="sm"
        variant={buttonVariant}
        icon={buttonIcon}
        onClick={onClick}
        disabled={disabled}
        aria-label={title}
        className="shrink-0"
      >
        {buttonLabel}
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function Reports() {
  const trades = useStore((s) => s.trades);
  const accounts = useStore((s) => s.accounts);
  const settings = useStore((s) => s.settings);

  /* Local, page-only selectors — deliberately NOT the global filters. */
  const [periodKey, setPeriodKey] = useState<string>("thisMonth");
  const [accountId, setAccountId] = useState<string>("all");

  const periodOptions = useMemo<PeriodOption[]>(() => {
    const today = datasetToday(trades);
    const preset = (p: "thisMonth" | "lastMonth" | "90d") => rangeForPreset(p, today, NO_CUSTOM);
    const opts: PeriodOption[] = [
      { key: "thisMonth", label: "This month", slug: "this-month", ...preset("thisMonth") },
      { key: "lastMonth", label: "Last month", slug: "last-month", ...preset("lastMonth") },
      { key: "90d", label: "Last 90 days", slug: "last-90-days", ...preset("90d") },
    ];
    const fys = [...new Set(trades.map((t) => financialYearOf(t.closedAt ?? t.openedAt)))]
      .sort()
      .reverse();
    for (const fy of fys) {
      const startYear = Number(fy.slice(3, 7)); // "FY 2025-26" → 2025
      if (!Number.isFinite(startYear)) continue;
      opts.push({
        key: fy,
        label: fy,
        slug: fy.toLowerCase().replace(/\s+/g, "-"),
        from: new Date(startYear, 3, 1),
        to: new Date(startYear + 1, 2, 31, 23, 59, 59, 999),
      });
    }
    opts.push({ key: "all", label: "All time", slug: "all-time", from: null, to: null });
    return opts;
  }, [trades]);

  const period = useMemo(
    () => periodOptions.find((o) => o.key === periodKey) ?? periodOptions[periodOptions.length - 1],
    [periodOptions, periodKey],
  );

  const account = useMemo(
    () => (accountId === "all" ? undefined : accounts.find((a) => a.id === accountId)),
    [accounts, accountId],
  );
  const currency = account?.currency ?? settings.baseCurrency;
  const capital = account?.startingCapital ?? settings.startingCapital;
  const accountLabel = accountId === "all" ? "All accounts" : account ? `${account.name} · ${account.broker}` : "All accounts";

  /* The report slice: period + account applied locally. */
  const periodTrades = useMemo(
    () =>
      trades.filter((t) => {
        if (accountId !== "all" && t.accountId !== accountId) return false;
        const when = new Date(t.closedAt ?? t.openedAt);
        if (period.from && when < period.from) return false;
        if (period.to && when > period.to) return false;
        return true;
      }),
    [trades, accountId, period],
  );
  const closed = useMemo(() => closedOf(periodTrades), [periodTrades]);
  const kpis = useMemo(() => computeKpis(periodTrades, capital), [periodTrades, capital]);
  const monthly = useMemo(() => monthlyPnl(periodTrades), [periodTrades]);

  const monthlyTotals = useMemo(
    () =>
      monthly.reduce(
        (acc, m) => ({
          trades: acc.trades + m.trades,
          wins: acc.wins + m.wins,
          gross: acc.gross + m.gross,
          charges: acc.charges + m.charges,
          tax: acc.tax + m.tax,
          pnl: acc.pnl + m.pnl,
        }),
        { trades: 0, wins: 0, gross: 0, charges: 0, tax: 0, pnl: 0 },
      ),
    [monthly],
  );

  const rangeText = useMemo(() => {
    if (period.from && period.to) {
      return `${formatDate(period.from.toISOString())} – ${formatDate(period.to.toISOString())}`;
    }
    if (!trades.length) return "No data yet";
    const times = trades.map((t) => new Date(t.closedAt ?? t.openedAt).getTime());
    const lo = new Date(Math.min(...times)).toISOString();
    const hi = new Date(Math.max(...times)).toISOString();
    return `${formatDate(lo)} – ${formatDate(hi)}`;
  }, [period, trades]);

  /* KPI list — shared verbatim by the preview grid, the print report and the CSV. */
  const kpiItems = useMemo<PrintKpi[]>(() => {
    const money = (v: number, sign = false) => formatMoney(v, { currency, sign });
    const pfText =
      kpis.profitFactor === Infinity ? "∞" : formatNumber(kpis.profitFactor, 2);
    const best = kpis.bestTrade;
    const worst = kpis.worstTrade;
    return [
      { label: "Net P&L", value: money(kpis.totalNetPnl, true), tone: kpis.totalNetPnl, sub: `${formatPct(kpis.roiPct, 1, true)} on capital` },
      { label: "Gross P&L", value: money(kpis.totalGrossPnl, true), tone: kpis.totalGrossPnl },
      { label: "Charges", value: money(kpis.totalCharges), sub: `${formatPct(kpis.chargesPctOfGross)} of gross` },
      { label: "Est. tax", value: money(kpis.totalTax) },
      { label: "Closed trades", value: formatNumber(kpis.closedTrades), sub: `${kpis.wins}W · ${kpis.losses}L · ${kpis.breakevens}BE` },
      { label: "Win rate", value: formatPct(kpis.winRate) },
      { label: "Profit factor", value: pfText },
      { label: "Avg R", value: formatR(kpis.avgR), tone: kpis.avgR },
      { label: "Expectancy / trade", value: money(kpis.expectancy, true), tone: kpis.expectancy },
      { label: "Max drawdown", value: money(-kpis.maxDrawdown), tone: -kpis.maxDrawdown, sub: `${formatPct(kpis.maxDrawdownPct)} of peak` },
      {
        label: "Best trade",
        value: best ? money(best.netPnl, true) : "—",
        tone: best?.netPnl ?? 0,
        sub: best ? `${best.symbol} · ${formatDate(best.closedAt ?? best.openedAt)}` : undefined,
      },
      {
        label: "Worst trade",
        value: worst ? money(worst.netPnl, true) : "—",
        tone: worst?.netPnl ?? 0,
        sub: worst ? `${worst.symbol} · ${formatDate(worst.closedAt ?? worst.openedAt)}` : undefined,
      },
    ];
  }, [kpis, currency]);

  /* ---------------------------------------------------------------- */
  /* Exports                                                           */
  /* ---------------------------------------------------------------- */

  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? id;

  function exportPerformanceCsv() {
    const headers = ["Month", "Trades", "Wins", "Win rate %", "Gross P&L", "Charges", "Est. tax", "Net P&L"];
    const rows: (string | number | undefined)[][] = monthly.map((m) => [
      m.label,
      m.trades,
      m.wins,
      round2(m.winRate),
      round2(m.gross),
      round2(m.charges),
      round2(m.tax),
      round2(m.pnl),
    ]);
    rows.push([
      "Total",
      monthlyTotals.trades,
      monthlyTotals.wins,
      monthlyTotals.trades ? round2((monthlyTotals.wins / monthlyTotals.trades) * 100) : 0,
      round2(monthlyTotals.gross),
      round2(monthlyTotals.charges),
      round2(monthlyTotals.tax),
      round2(monthlyTotals.pnl),
    ]);
    downloadFile(`ledgerx-performance-${period.slug}.csv`, toCsv(headers, rows));
    toast(`Performance report exported — ${period.label}`);
  }

  function exportTradeLogCsv() {
    const headers = [
      "Trade ID", "Account", "Symbol", "Asset class", "Segment", "Exchange", "Direction", "Status",
      "Quantity", "Entry price", "Exit price", "Stop loss", "Target",
      "Opened at", "Closed at", "Holding (min)",
      "Gross P&L", "Brokerage", "Exchange txn", "STT/CTT", "SEBI", "Stamp duty", "GST", "DP charges", "Pledge", "Manual charges", "MTF interest", "Total charges",
      "Net P&L", "Taxable P&L", "Tax category", "Taxable amount", "Tax rate %", "Est. tax",
      "Risk amount", "R multiple", "Position value", "% of capital",
      "Strategy", "Market condition", "Timeframe", "Tags",
      "Emotion (1-5)", "Confidence (1-5)", "Notes", "Mistakes", "Lessons",
    ];
    const sorted = [...periodTrades].sort(
      (a, b) => new Date(a.openedAt).getTime() - new Date(b.openedAt).getTime(),
    );
    const rows: (string | number | undefined)[][] = sorted.map((t: Trade) => [
      t.id, accountName(t.accountId), t.symbol, t.assetClass, t.segment, t.exchange, t.direction, t.status,
      t.quantity, t.entryPrice, t.exitPrice, t.stopLoss, t.target,
      t.openedAt, t.closedAt, t.holdingMinutes,
      round2(t.grossPnl), round2(t.charges.brokerage), round2(t.charges.exchangeTxn), round2(t.charges.stt),
      round2(t.charges.sebi), round2(t.charges.stampDuty), round2(t.charges.gst), round2(t.charges.dpCharges),
      round2(t.charges.pledgeCharges ?? 0), round2(t.charges.manual ?? 0), round2(t.charges.mtfInterest ?? 0),
      round2(t.charges.total),
      round2(t.netPnl), round2(t.taxablePnl ?? t.netPnl), t.tax.category, round2(t.tax.taxableAmount), t.tax.rate, round2(t.tax.estimatedTax),
      round2(t.riskAmount), t.rMultiple !== undefined ? round2(t.rMultiple) : undefined,
      round2(t.positionValue), round2(t.pctOfCapital),
      t.strategy, t.marketCondition, t.timeframe, t.tags.join(" | "),
      t.emotionRating, t.confidenceRating, t.notes, t.mistakes, t.lessons,
    ]);
    downloadFile(`ledgerx-trades-${period.slug}.csv`, toCsv(headers, rows));
    toast(`Trade log exported — ${sorted.length} trades`);
  }

  function exportTaxCsv() {
    interface CatAgg { trades: number; net: number; taxable: number; tax: number; rate: number }
    const byCat = new Map<TaxCategory, CatAgg>();
    for (const t of closed) {
      const cur = byCat.get(t.tax.category) ?? { trades: 0, net: 0, taxable: 0, tax: 0, rate: t.tax.rate };
      cur.trades += 1;
      cur.net += t.netPnl;
      cur.taxable += t.tax.taxableAmount;
      cur.tax += t.tax.estimatedTax;
      byCat.set(t.tax.category, cur);
    }

    const catHeaders = ["Tax category", "Closed trades", "Net P&L", "Taxable amount", "Rate %", "Est. tax"];
    const catRows: (string | number | undefined)[][] = TAX_CATEGORY_ORDER.filter((c) => byCat.has(c)).map((c) => {
      const v = byCat.get(c)!;
      return [c, v.trades, round2(v.net), round2(v.taxable), v.rate, round2(v.tax)];
    });
    catRows.push([
      "Total",
      closed.length,
      round2(kpis.totalNetPnl),
      round2(closed.reduce((s, t) => s + t.tax.taxableAmount, 0)),
      undefined,
      round2(kpis.totalTax),
    ]);

    const tradeHeaders = ["Trade ID", "Symbol", "Closed at", "Asset class", "Net P&L", "Tax category", "Taxable amount", "Rate %", "Est. tax"];
    const tradeRows: (string | number | undefined)[][] = closed.map((t) => [
      t.id, t.symbol, t.closedAt ?? t.openedAt, t.assetClass,
      round2(t.netPnl), t.tax.category, round2(t.tax.taxableAmount), t.tax.rate, round2(t.tax.estimatedTax),
    ]);

    const content = [
      toCsv([`LedgerX tax summary — ${period.label}`, accountLabel, rangeText], []),
      "",
      "Category totals",
      toCsv(catHeaders, catRows),
      "",
      "Per-trade tax detail",
      toCsv(tradeHeaders, tradeRows),
    ].join("\n");

    downloadFile(`ledgerx-tax-${period.slug}.csv`, content);
    toast(`Tax summary exported — ${period.label}`);
  }

  function openPrintReport() {
    const win = window.open("", "_blank", "width=980,height=760");
    if (!win) {
      toast("Pop-up blocked — allow pop-ups for LedgerX to open the print view", "error");
      return;
    }
    const html = buildPrintHtml({
      periodLabel: period.label,
      accountLabel,
      rangeText,
      currency,
      kpis: kpiItems,
      monthly,
      trades: closed,
      userName: settings.userName,
      generatedAt: formatDateTime(new Date().toISOString()),
    });
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    window.setTimeout(() => {
      try {
        win.print();
      } catch {
        /* window already closed — nothing to do */
      }
    }, 350);
    toast("Print view opened — choose “Save as PDF” in the dialog", "info");
  }

  /* ---------------------------------------------------------------- */
  /* Render                                                            */
  /* ---------------------------------------------------------------- */

  const hasClosed = closed.length > 0;
  const netTone = kpis.totalNetPnl > 0 ? "profit" : kpis.totalNetPnl < 0 ? "loss" : "neutral";

  return (
    <div className="animate-in">
      <PageHeader
        title="Reports"
        description="Build downloadable performance, trade-log and tax summaries — the period below is local to this page and independent of the global filters."
      />

      <div className="space-y-4">
        {/* 1 · Period selection */}
        <Card
          title="Report period"
          subtitle="Applies to the preview and every export on this page — the topbar date range and account filter are ignored here."
        >
          <div className="flex flex-wrap items-end gap-4">
            <Field label="Period" className="w-full sm:w-52">
              {(id) => (
                <Select id={id} value={period.key} onChange={(e) => setPeriodKey(e.target.value)}>
                  {periodOptions.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Account" className="w-full sm:w-56">
              {(id) => (
                <Select id={id} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                  <option value="all">All accounts</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} · {a.broker}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <div className="flex items-center gap-2.5 sm:ml-auto">
              <CalendarRange size={15} className="hidden text-faint sm:block" aria-hidden />
              <div className="sm:text-right">
                <div className="text-[13px] font-medium text-ink">
                  <span className="tnum">{formatNumber(closed.length)}</span> closed ·{" "}
                  <span className="tnum">{formatNumber(kpis.openTrades)}</span> open trades
                </div>
                <div className="mt-0.5 text-[12px] text-muted">{rangeText}</div>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid gap-4 xl:grid-cols-3">
          {/* 2 · Report preview */}
          <Card
            className="xl:col-span-2"
            title={`Performance summary — ${period.label}`}
            subtitle={`${rangeText} · ${accountLabel} — this preview is exactly what the exports contain`}
            action={
              hasClosed ? (
                <Badge tone={netTone}>
                  {formatMoney(kpis.totalNetPnl, { currency, compact: true, sign: true })} net
                </Badge>
              ) : undefined
            }
          >
            {hasClosed ? (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {kpiItems.map((item) => (
                    <StatCell key={item.label} item={item} />
                  ))}
                </div>

                <h4 className="label-caps mt-6 mb-2">Monthly breakdown</h4>
                <TableShell>
                  <thead>
                    <tr>
                      <TH>Month</TH>
                      <TH className="tnum text-right">Trades</TH>
                      <TH className="tnum text-right">Gross</TH>
                      <TH className="tnum text-right">Charges</TH>
                      <TH className="tnum text-right">Est. tax</TH>
                      <TH className="tnum text-right">Net</TH>
                      <TH className="tnum text-right">Win rate</TH>
                    </tr>
                  </thead>
                  <tbody>
                    {monthly.map((m) => (
                      <tr key={m.month} className="transition-colors hover:bg-raised/60">
                        <TD className="font-medium text-ink">{m.label}</TD>
                        <TD className="tnum text-right text-muted">{m.trades}</TD>
                        <TD className={`tnum text-right ${pnlClass(m.gross)}`}>
                          {formatMoney(m.gross, { currency, sign: true })}
                        </TD>
                        <TD className="tnum text-right text-muted">{formatMoney(m.charges, { currency })}</TD>
                        <TD className="tnum text-right text-muted">{formatMoney(m.tax, { currency })}</TD>
                        <TD className={`tnum text-right font-medium ${pnlClass(m.pnl)}`}>
                          {formatMoney(m.pnl, { currency, sign: true })}
                        </TD>
                        <TD className="tnum text-right text-muted">{formatPct(m.winRate)}</TD>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-edge">
                      <TD className="border-b-0 font-semibold text-ink">Total</TD>
                      <TD className="tnum border-b-0 text-right font-medium text-ink">{monthlyTotals.trades}</TD>
                      <TD className={`tnum border-b-0 text-right font-medium ${pnlClass(monthlyTotals.gross)}`}>
                        {formatMoney(monthlyTotals.gross, { currency, sign: true })}
                      </TD>
                      <TD className="tnum border-b-0 text-right font-medium text-ink">
                        {formatMoney(monthlyTotals.charges, { currency })}
                      </TD>
                      <TD className="tnum border-b-0 text-right font-medium text-ink">
                        {formatMoney(monthlyTotals.tax, { currency })}
                      </TD>
                      <TD className={`tnum border-b-0 text-right font-semibold ${pnlClass(monthlyTotals.pnl)}`}>
                        {formatMoney(monthlyTotals.pnl, { currency, sign: true })}
                      </TD>
                      <TD className="tnum border-b-0 text-right font-medium text-ink">
                        {formatPct(monthlyTotals.trades ? (monthlyTotals.wins / monthlyTotals.trades) * 100 : 0)}
                      </TD>
                    </tr>
                  </tfoot>
                </TableShell>
              </>
            ) : (
              <EmptyState
                icon={FileBarChart2}
                title="No closed trades in this period"
                hint={
                  periodTrades.length > 0
                    ? `${periodTrades.length} open or cancelled trade${periodTrades.length === 1 ? "" : "s"} fall in this range — P&L reports only include closed trades. Pick a wider period or another account.`
                    : "Pick a wider period or a different account to build a report."
                }
              />
            )}
          </Card>

          {/* 3 · Export actions */}
          <Card
            title="Export"
            subtitle="Downloads reflect the period and account selected above"
            bodyClassName="divide-y divide-edge-soft"
          >
            <ExportRow
              icon={FileSpreadsheet}
              iconClass="bg-accent-soft text-accent"
              title="Performance report (CSV)"
              description="The monthly breakdown exactly as previewed — trades, gross, charges, tax, net and win rate per month, plus a totals row."
              buttonLabel="CSV"
              buttonIcon={Download}
              disabled={monthly.length === 0}
              onClick={exportPerformanceCsv}
            />
            <ExportRow
              icon={ScrollText}
              iconClass="bg-info-soft text-info"
              title="Trade log (CSV)"
              description={`Every trade in the period (${periodTrades.length}) with full pricing, charge-breakdown, tax, risk and context columns.`}
              buttonLabel="CSV"
              buttonIcon={Download}
              disabled={periodTrades.length === 0}
              onClick={exportTradeLogCsv}
            />
            <ExportRow
              icon={ReceiptText}
              iconClass="bg-warning-soft text-warning"
              title="Tax summary (CSV)"
              description="Per-category totals — Intraday, STCG, LTCG, Crypto — followed by a per-trade tax detail for your CA."
              buttonLabel="CSV"
              buttonIcon={Download}
              disabled={!hasClosed}
              onClick={exportTaxCsv}
            />
            <ExportRow
              icon={Printer}
              iconClass="bg-raised text-muted"
              title="Print / save as PDF"
              description={`Opens a print-friendly report in a new tab — summary, monthly table and up to ${MAX_PRINT_ROWS} trades. Use your browser's “Save as PDF”.`}
              buttonLabel="Print"
              buttonIcon={Printer}
              buttonVariant="primary"
              disabled={!hasClosed}
              onClick={openPrintReport}
            />
          </Card>
        </div>

        {/* 4 · Info footer */}
        <div className="flex items-start gap-2.5 rounded-xl border border-edge-soft bg-surface/60 px-4 py-3">
          <Info size={14} className="mt-0.5 shrink-0 text-faint" aria-hidden />
          <p className="text-[12px] leading-relaxed text-muted">
            Exports reflect the period and account selected on this page and ignore the global topbar
            filters. CSV files open directly in Excel or Google Sheets. Charges and tax figures are
            estimates — reconcile with your broker statements and a tax professional before filing.
          </p>
        </div>
      </div>
    </div>
  );
}
