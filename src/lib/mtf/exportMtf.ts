/** MTF export — CSV via the shared @/lib/csv helpers, PDF via a print-friendly
 *  popup + window.print() (mirrors src/pages/reports/printReport.ts; no new deps). */

import { format } from "date-fns";
import { downloadFile, toCsv } from "@/lib/csv";
import { formatMoney } from "@/lib/format";
import type { ComputedPosition, PortfolioStats } from "./types";

export function positionsCsv(computed: ComputedPosition[]): string {
  const headers = [
    "ID", "Stock", "Symbol", "Status", "Purchase date", "Holding days", "Quantity",
    "Buy price", "Current/Exit price", "Total investment", "Current value",
    "Gross profit", "Daily interest", "Interest days", "Accumulated interest",
    "Total charges", "Net profit", "Break-even price", "Break-even %",
    "Daily rate %", "Interest basis", "Funded %",
  ];
  const rows = computed.map((c) => [
    c.pos.id, c.pos.stockName, c.pos.symbol, c.pos.status, c.pos.purchaseDate,
    c.holdingDays, c.pos.quantity, c.pos.avgBuyPrice,
    c.isClosed ? (c.pos.exitPrice ?? "") : (c.pos.currentPrice ?? ""),
    c.totalInvestment.toFixed(2), c.currentValue.toFixed(2), c.grossProfit.toFixed(2),
    c.dailyInterest.toFixed(2), c.interestDays, c.accumulatedInterest.toFixed(2),
    c.totalCharges.toFixed(2), c.netProfit.toFixed(2), c.breakEvenPrice.toFixed(2),
    c.breakEvenPct.toFixed(2), c.pos.dailyRatePct, c.pos.interestBasis, c.pos.fundedPercent,
  ]);
  return toCsv(headers, rows);
}

export function downloadMtfCsv(computed: ComputedPosition[]) {
  downloadFile(`mtf-positions-${format(new Date(), "yyyyMMdd")}.csv`, positionsCsv(computed));
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const inr = (v: number) => formatMoney(v, { decimals: true });

/** Opens a light, print-friendly report window and triggers print (Save as PDF). */
export function printMtfReport(stats: PortfolioStats): boolean {
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) return false;

  const row = (c: ComputedPosition) => `
    <tr>
      <td>${esc(c.pos.symbol)}</td><td>${esc(c.pos.stockName)}</td>
      <td>${c.pos.purchaseDate}</td><td class="n">${c.holdingDays}</td>
      <td class="n">${c.pos.quantity}</td><td class="n">${inr(c.pos.avgBuyPrice)}</td>
      <td class="n">${inr(c.totalInvestment)}</td><td class="n">${inr(c.grossProfit)}</td>
      <td class="n">${inr(c.accumulatedInterest)}</td><td class="n">${inr(c.totalCharges)}</td>
      <td class="n"><b>${inr(c.netProfit)}</b></td><td class="n">${inr(c.breakEvenPrice)}</td>
    </tr>`;

  const section = (title: string, rows: ComputedPosition[]) =>
    rows.length
      ? `<h2>${title}</h2>
         <table>
           <thead><tr>
             <th>Symbol</th><th>Stock</th><th>Bought</th><th>Days</th><th>Qty</th>
             <th>Buy ₹</th><th>Investment</th><th>Gross P&L</th><th>Interest</th>
             <th>Charges</th><th>Net P&L</th><th>Break-even</th>
           </tr></thead>
           <tbody>${rows.map(row).join("")}</tbody>
         </table>`
      : "";

  win.document.write(`<!doctype html><html><head><title>LedgerX — MTF Interest Report</title>
    <style>
      body{font-family:Inter,system-ui,sans-serif;color:#111;margin:32px;font-size:12px}
      h1{font-size:20px;margin:0 0 2px} .sub{color:#666;margin:0 0 18px}
      h2{font-size:14px;margin:22px 0 8px}
      table{width:100%;border-collapse:collapse}
      th,td{border-bottom:1px solid #ddd;padding:6px 8px;text-align:left}
      th{font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#666}
      .n{text-align:right;font-variant-numeric:tabular-nums}
      .kpis{display:flex;gap:24px;flex-wrap:wrap;margin:14px 0 6px}
      .kpi b{display:block;font-size:15px} .kpi span{color:#666;font-size:10px;text-transform:uppercase}
      @media print{body{margin:12mm}}
    </style></head><body>
    <h1>MTF Interest Report</h1>
    <p class="sub">Generated ${format(new Date(), "dd MMM yyyy, HH:mm")} · LedgerX</p>
    <div class="kpis">
      <div class="kpi"><span>Active positions</span><b>${stats.activeCount}</b></div>
      <div class="kpi"><span>Capital invested</span><b>${inr(stats.totalCapitalInvested)}</b></div>
      <div class="kpi"><span>Today's interest</span><b>${inr(stats.todaysInterest)}</b></div>
      <div class="kpi"><span>Lifetime interest</span><b>${inr(stats.lifetimeInterest)}</b></div>
      <div class="kpi"><span>Total charges</span><b>${inr(stats.totalCharges)}</b></div>
      <div class="kpi"><span>Net portfolio profit</span><b>${inr(stats.netPortfolioProfit)}</b></div>
    </div>
    ${section("Open positions", stats.open)}
    ${section("Closed positions", stats.closed)}
    <script>window.onload = function(){ window.print(); };</script>
    </body></html>`);
  win.document.close();
  return true;
}
