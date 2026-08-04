/** Tax Report — estimated FY liability under India's NEW tax regime (FY 2025-26).
 *  Scope: ALL trades filtered by the global account filter only; the FY selector
 *  replaces the global date range here. Closed trades only.
 *
 *  The authoritative number is the aggregate financial-year computation
 *  (slab tax + §87A rebate + basic-exemption set-off + special rates + cess),
 *  not a sum of per-trade estimates — because rebate and exemptions are annual. */

import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Download, Info, Landmark, Percent, Receipt, Sparkles, TrendingUp, Wallet } from "lucide-react";
import { useStore } from "@/store/useStore";
import { useScopeCurrency } from "@/store/useFilteredTrades";
import { financialYearOf } from "@/lib/metrics";
import { computeFinancialYearTax } from "@/lib/incomeTax";
import { toCsv, downloadFile } from "@/lib/csv";
import { toast } from "@/store/toast";
import { formatMoney, formatNumber, formatPct } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { buildMonthRows, isClosedWithDate } from "@/pages/tax/taxMeta";
import { TaxWaterfall } from "@/pages/tax/TaxWaterfall";
import { TaxCharts } from "@/pages/tax/TaxCharts";
import { TaxTable } from "@/pages/tax/TaxTable";

const PAGE_DESCRIPTION =
  "Estimated liability under the new tax regime (FY 2025-26) — the FY selector replaces the global date range; only the account filter applies.";

export default function TaxReport() {
  const trades = useStore((s) => s.trades);
  const accountId = useStore((s) => s.filters.accountId);
  const taxRates = useStore((s) => s.settings.taxRates);
  const accounts = useStore((s) => s.accounts);
  const currency = useScopeCurrency();
  const navigate = useNavigate();

  /** Closed trades scoped ONLY by the global account filter (no date range). */
  const closed = useMemo(
    () => trades.filter(isClosedWithDate).filter((t) => accountId === "all" || t.accountId === accountId),
    [trades, accountId],
  );

  const fyOptions = useMemo(() => {
    const set = new Set<string>();
    for (const t of closed) set.add(financialYearOf(t.closedAt));
    return [...set].sort();
  }, [closed]);

  const [fySelected, setFySelected] = useState<string | null>(null);
  const fy =
    fySelected !== null && fyOptions.includes(fySelected)
      ? fySelected
      : (fyOptions[fyOptions.length - 1] ?? "");

  const fyTrades = useMemo(
    () =>
      closed
        .filter((t) => financialYearOf(t.closedAt) === fy)
        .sort((a, b) => a.closedAt.localeCompare(b.closedAt)),
    [closed, fy],
  );

  const tax = useMemo(() => computeFinancialYearTax(fyTrades, taxRates), [fyTrades, taxRates]);
  const months = useMemo(() => buildMonthRows(fyTrades), [fyTrades]);
  const netRealised = tax.businessPnl + tax.stcgPnl + tax.ltcgPnl + tax.cryptoPnl;

  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? id;

  const exportCsv = () => {
    if (fyTrades.length === 0) return;
    const headers = [
      "Trade ID", "Closed", "Symbol", "Asset class", "Account",
      "Tax category", "Net P&L", "Taxable amount", "Rate %", "Gross tax (pre-rebate)",
    ];
    const rows = [...fyTrades]
      .sort((a, b) => b.tax.estimatedTax - a.tax.estimatedTax)
      .map((t) => [
        t.id, t.closedAt.slice(0, 10), t.symbol, t.assetClass, accountName(t.accountId),
        t.tax.category, t.netPnl.toFixed(2), t.tax.taxableAmount.toFixed(2), t.tax.rate, t.tax.estimatedTax.toFixed(2),
      ]);
    // append the authoritative FY summary
    rows.push([]);
    rows.push(["FY SUMMARY", fy, "", "", "", "", "", "", "", ""]);
    rows.push(["Business income tax (after §87A)", "", "", "", "", "", "", "", "", tax.businessTax.toFixed(2)]);
    rows.push(["STCG tax", "", "", "", "", "", "", "", "", tax.stcgTax.toFixed(2)]);
    rows.push(["LTCG tax", "", "", "", "", "", "", "", "", tax.ltcgTax.toFixed(2)]);
    rows.push(["Crypto tax", "", "", "", "", "", "", "", "", tax.cryptoTax.toFixed(2)]);
    rows.push(["Health & education cess", "", "", "", "", "", "", "", "", tax.cess.toFixed(2)]);
    rows.push(["TOTAL ESTIMATED TAX", "", "", "", "", "", "", "", "", tax.totalTax.toFixed(2)]);
    downloadFile(`ledgerx-tax-${fy.replace(/\s+/g, "").toLowerCase()}.csv`, toCsv(headers, rows));
    toast(`Exported ${fyTrades.length} tax rows for ${fy}`, "success");
  };

  if (fyOptions.length === 0) {
    return (
      <div className="animate-in">
        <PageHeader title="Tax Report" description={PAGE_DESCRIPTION} />
        <Card>
          <EmptyState
            icon={Landmark}
            title="No closed trades to estimate tax on"
            hint={
              accountId !== "all"
                ? "This account has no closed trades yet — switch the account filter or close a trade to see its estimated tax."
                : "Close a trade and its estimated tax will appear here, grouped by financial year."
            }
            action={
              <Button variant="primary" onClick={() => navigate("/trades")}>
                Go to trades
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="animate-in">
      <PageHeader
        title="Tax Report"
        description={PAGE_DESCRIPTION}
        actions={
          <>
            <div className="w-[140px]">
              <Select aria-label="Financial year" value={fy} onChange={(e) => setFySelected(e.target.value)}>
                {[...fyOptions].reverse().map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </Select>
            </div>
            <Button variant="primary" icon={Download} onClick={exportCsv} disabled={fyTrades.length === 0}>
              Export tax CSV
            </Button>
          </>
        }
      />

      <div className="space-y-4">
        {/* KPI row — all from the aggregate FY engine */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <KpiCard
            label="Est. total tax"
            value={tax.totalTax}
            format={(n) => formatMoney(n, { currency, compact: true })}
            icon={Landmark}
            sub={`${fy} · incl. 4% cess`}
          />
          <KpiCard
            label="Net realized P&L"
            value={netRealised}
            format={(n) => formatMoney(n, { currency, compact: true, sign: true })}
            icon={TrendingUp}
            toneBySign
            sub={`${formatNumber(fyTrades.length)} closed trades`}
          />
          <KpiCard
            label="Take-home"
            value={tax.netAfterTax}
            format={(n) => formatMoney(n, { currency, compact: true, sign: true })}
            icon={Wallet}
            toneBySign
            sub="Net P&L − estimated tax"
          />
          <KpiCard
            label="Effective rate"
            value={tax.effectiveRate}
            format={(n) => formatPct(n, 1)}
            icon={Percent}
            sub="Tax ÷ taxable income"
          />
          <KpiCard
            label="Taxable income"
            value={tax.totalIncome}
            format={(n) => formatMoney(n, { currency, compact: true })}
            icon={Receipt}
            sub="Business + gains (post-exemption)"
          />
          <KpiCard
            label="§87A rebate"
            value={tax.rebate87A}
            format={(n) => formatMoney(n, { currency, compact: true })}
            icon={Sparkles}
            sub={
              tax.rebate87A > 0
                ? tax.totalIncome <= (taxRates.rebate87ALimit ?? 1200000)
                  ? "Applied · income ≤ ₹12L"
                  : "Marginal relief applied"
                : "Not available"
            }
          />
        </div>

        {/* The computation itself + monthly context */}
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <TaxWaterfall r={tax} rates={taxRates} currency={currency} />
          <div className="space-y-4">
            <TaxCharts months={months} currency={currency} fy={fy} />
          </div>
        </div>

        {/* Per-trade table — keyed by FY so pagination resets on switch */}
        <TaxTable key={fy} trades={fyTrades} currency={currency} fy={fy} />

        {/* Disclaimer */}
        <Card bodyClassName="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-info-soft">
            <Info size={15} className="text-info" aria-hidden />
          </div>
          <div className="min-w-0 text-[12px] leading-relaxed text-muted">
            <p className="text-[13px] font-medium text-ink">Estimates only — not tax advice</p>
            <p className="mt-1">
              Computed under the <span className="text-ink">new tax regime for FY 2025-26 (AY 2026-27)</span>,
              assuming a <span className="text-ink">resident individual whose only income is trading</span>.
              F&amp;O and intraday are treated as business income at the slab rates; the §87A rebate (up to ₹60,000
              for total income ≤ ₹12L) is applied to that slab tax <span className="text-ink">only</span> — never to
              STCG (20%), LTCG (12.5% over ₹1.25L) or crypto (30%), per the Finance Act 2025. Your unused ₹4L basic
              exemption is set off against STCG then LTCG. The ₹75,000 standard deduction does not apply to trading
              income. Set-off/carry-forward of losses, surcharge nuances and advance-tax interest are simplified.
              Rates are configurable in{" "}
              <Link to="/settings" className="text-accent transition-colors hover:underline">
                Settings → Tax rates
              </Link>
              . Please confirm with a chartered accountant before filing.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
