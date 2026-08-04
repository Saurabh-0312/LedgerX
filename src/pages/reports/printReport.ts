/** Self-contained printable HTML report for Reports → "Print / save as PDF".
 *  LIGHT print-friendly palette (white background, dark text), all styles inline —
 *  the document is written into a fresh window and printed, so nothing from the
 *  app stylesheet is available. */

import type { Trade } from "@/types";
import { formatDate, formatMoney, formatPct, formatR } from "@/lib/format";

export interface PrintKpi {
  label: string;
  value: string;
  /** sign source for coloring (>0 green, <0 red, 0/undefined plain ink) */
  tone?: number;
  sub?: string;
}

export interface MonthlyBreakdownRow {
  month: string;
  label: string;
  pnl: number;
  gross: number;
  charges: number;
  tax: number;
  trades: number;
  wins: number;
  winRate: number;
}

export interface PrintReportArgs {
  periodLabel: string;
  accountLabel: string;
  rangeText: string;
  currency: "INR" | "USD";
  kpis: PrintKpi[];
  monthly: MonthlyBreakdownRow[];
  /** closed trades in close-date order; capped at MAX_PRINT_ROWS in the output */
  trades: Trade[];
  userName: string;
  /** preformatted timestamp, e.g. "03 Jul 2026, 14:20" */
  generatedAt: string;
}

export const MAX_PRINT_ROWS = 200;

const INK = "#111827";
const MUTED = "#6b7280";
const PROFIT = "#15803d";
const LOSS = "#b91c1c";

const esc = (v: string): string =>
  v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const toneColor = (v: number): string => (v > 0 ? PROFIT : v < 0 ? LOSS : INK);

export function buildPrintHtml(args: PrintReportArgs): string {
  const { periodLabel, accountLabel, rangeText, currency, kpis, monthly, trades, userName, generatedAt } = args;

  const money = (v: number, sign = false) => esc(formatMoney(v, { currency, sign }));
  const price = (v: number) => esc(formatMoney(v, { currency, decimals: true }));

  /* ---- KPI grid ---- */
  const kpiCells = kpis
    .map((k) => {
      const color = k.tone !== undefined && k.tone !== 0 ? toneColor(k.tone) : INK;
      return `<div class="kpi">
        <div class="kpi-label">${esc(k.label)}</div>
        <div class="kpi-value" style="color:${color}">${esc(k.value)}</div>
        ${k.sub ? `<div class="kpi-sub">${esc(k.sub)}</div>` : ""}
      </div>`;
    })
    .join("");

  /* ---- Monthly breakdown table ---- */
  const totals = monthly.reduce(
    (acc, m) => ({
      trades: acc.trades + m.trades,
      wins: acc.wins + m.wins,
      gross: acc.gross + m.gross,
      charges: acc.charges + m.charges,
      tax: acc.tax + m.tax,
      pnl: acc.pnl + m.pnl,
    }),
    { trades: 0, wins: 0, gross: 0, charges: 0, tax: 0, pnl: 0 },
  );
  const totalWinRate = totals.trades ? (totals.wins / totals.trades) * 100 : 0;

  const monthlyRows = monthly
    .map(
      (m) => `<tr>
        <td>${esc(m.label)}</td>
        <td class="num">${m.trades}</td>
        <td class="num">${esc(formatPct(m.winRate))}</td>
        <td class="num" style="color:${toneColor(m.gross)}">${money(m.gross, true)}</td>
        <td class="num">${money(m.charges)}</td>
        <td class="num">${money(m.tax)}</td>
        <td class="num" style="color:${toneColor(m.pnl)}">${money(m.pnl, true)}</td>
      </tr>`,
    )
    .join("");

  const monthlyTable = monthly.length
    ? `<table>
        <thead><tr>
          <th>Month</th><th class="num">Trades</th><th class="num">Win rate</th>
          <th class="num">Gross P&amp;L</th><th class="num">Charges</th><th class="num">Est. tax</th><th class="num">Net P&amp;L</th>
        </tr></thead>
        <tbody>${monthlyRows}</tbody>
        <tfoot><tr>
          <td>Total</td>
          <td class="num">${totals.trades}</td>
          <td class="num">${esc(formatPct(totalWinRate))}</td>
          <td class="num" style="color:${toneColor(totals.gross)}">${money(totals.gross, true)}</td>
          <td class="num">${money(totals.charges)}</td>
          <td class="num">${money(totals.tax)}</td>
          <td class="num" style="color:${toneColor(totals.pnl)}">${money(totals.pnl, true)}</td>
        </tr></tfoot>
      </table>`
    : `<p class="note">No closed trades in this period.</p>`;

  /* ---- Per-trade table (capped) ---- */
  const shown = trades.slice(0, MAX_PRINT_ROWS);
  const tradeRows = shown
    .map(
      (t) => `<tr>
        <td>${esc(t.id)}</td>
        <td>${esc(formatDate(t.closedAt ?? t.openedAt))}</td>
        <td>${esc(t.symbol)}</td>
        <td>${esc(t.assetClass)}</td>
        <td>${esc(t.direction)}</td>
        <td class="num">${t.quantity}</td>
        <td class="num">${price(t.entryPrice)}</td>
        <td class="num">${t.exitPrice !== undefined ? price(t.exitPrice) : "—"}</td>
        <td class="num">${money(t.charges.total)}</td>
        <td class="num" style="color:${toneColor(t.netPnl)}">${money(t.netPnl, true)}</td>
        <td class="num">${esc(formatR(t.rMultiple))}</td>
      </tr>`,
    )
    .join("");

  const tradesTable = shown.length
    ? `<table>
        <thead><tr>
          <th>ID</th><th>Closed</th><th>Symbol</th><th>Class</th><th>Side</th>
          <th class="num">Qty</th><th class="num">Entry</th><th class="num">Exit</th>
          <th class="num">Charges</th><th class="num">Net P&amp;L</th><th class="num">R</th>
        </tr></thead>
        <tbody>${tradeRows}</tbody>
      </table>
      ${trades.length > MAX_PRINT_ROWS ? `<p class="note">Showing the first ${MAX_PRINT_ROWS} of ${trades.length} closed trades — export the trade-log CSV for the full list.</p>` : ""}`
    : `<p class="note">No closed trades in this period.</p>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>LedgerX — Performance report</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html { background: #ffffff; }
  body { font: 12px/1.5 "Segoe UI", -apple-system, "Helvetica Neue", Arial, sans-serif; color: ${INK}; background: #ffffff; padding: 32px 36px; }
  header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 2px solid ${INK}; padding-bottom: 14px; margin-bottom: 18px; }
  .brand { font-size: 19px; font-weight: 700; letter-spacing: -0.02em; white-space: nowrap; }
  .brand .mark { display: inline-block; width: 22px; height: 22px; border-radius: 6px; background: #6d4aff; color: #ffffff; text-align: center; line-height: 22px; font-size: 13px; font-weight: 700; margin-right: 7px; vertical-align: -4px; }
  .brand .sub { display: block; font-size: 11px; font-weight: 400; color: ${MUTED}; margin-top: 2px; letter-spacing: 0; }
  .meta { text-align: right; font-size: 11px; color: ${MUTED}; }
  .meta strong { display: block; font-size: 13px; color: ${INK}; font-weight: 600; margin-bottom: 2px; }
  h2 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.07em; color: ${MUTED}; margin: 22px 0 8px; }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .kpi { border: 1px solid #e5e7eb; border-radius: 8px; padding: 9px 11px; }
  .kpi-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; color: ${MUTED}; }
  .kpi-value { font-size: 14px; font-weight: 600; margin-top: 3px; }
  .kpi-sub { font-size: 9.5px; color: ${MUTED}; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
  th { text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; color: ${MUTED}; border-bottom: 1px solid #9ca3af; padding: 6px 8px; white-space: nowrap; }
  td { border-bottom: 1px solid #eceef1; padding: 5px 8px; vertical-align: top; }
  th.num, td.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  tfoot td { border-top: 1.5px solid #9ca3af; border-bottom: none; font-weight: 600; }
  .note { font-size: 10px; color: ${MUTED}; margin-top: 6px; }
  footer { display: flex; justify-content: space-between; gap: 16px; margin-top: 28px; padding-top: 10px; border-top: 1px solid #e5e7eb; font-size: 10px; color: ${MUTED}; }
  @page { margin: 14mm; }
  @media print {
    body { padding: 0; }
    tr, .kpi { page-break-inside: avoid; }
    .kpis { page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <header>
    <div class="brand"><span class="mark">L</span>LedgerX — Performance report<span class="sub">Trading journal &amp; analytics</span></div>
    <div class="meta">
      <strong>${esc(periodLabel)}</strong>
      ${esc(rangeText)}<br>
      ${esc(accountLabel)}
    </div>
  </header>

  <h2>Performance summary</h2>
  <div class="kpis">${kpiCells}</div>

  <h2>Monthly breakdown</h2>
  ${monthlyTable}

  <h2>Trades (${trades.length})</h2>
  ${tradesTable}

  <footer>
    <span>Generated by LedgerX for ${esc(userName)} on ${esc(generatedAt)}</span>
    <span>Charges &amp; tax figures are estimates — verify against broker statements before filing.</span>
  </footer>
</body>
</html>`;
}
