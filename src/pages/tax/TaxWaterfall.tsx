/** The financial-year tax computation, shown as a readable waterfall:
 *  business income → slab tax → §87A rebate; STCG/LTCG with basic-exemption
 *  set-off; crypto flat; then cess → total. Driven by the incomeTax engine. */

import type { ReactNode } from "react";
import type { FyTaxResult } from "@/lib/incomeTax";
import type { TaxRates } from "@/types";
import type { Currency } from "@/lib/format";
import { formatMoney, formatPct, pnlClass } from "@/lib/format";
import { Card } from "@/components/ui/Card";
import { ratePctLabel } from "./taxMeta";

interface LineProps {
  label: ReactNode;
  value: ReactNode;
  /** visual weight */
  strong?: boolean;
  /** indent sub-steps under a section head */
  indent?: boolean;
  valueClass?: string;
  muted?: boolean;
}

function Line({ label, value, strong, indent, valueClass = "text-ink", muted }: LineProps) {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${indent ? "pl-3" : ""}`}>
      <span className={`text-[13px] ${strong ? "font-medium text-ink" : muted ? "text-faint" : "text-muted"}`}>
        {label}
      </span>
      <span className={`tnum text-[13px] ${strong ? "font-semibold" : "font-medium"} ${valueClass}`}>
        {value}
      </span>
    </div>
  );
}

function SectionHead({ title, note }: { title: string; note?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h4 className="text-[13px] font-semibold text-ink">{title}</h4>
      {note && <span className="text-[11px] text-faint">{note}</span>}
    </div>
  );
}

export function TaxWaterfall({
  r,
  rates,
  currency,
}: {
  r: FyTaxResult;
  rates: TaxRates;
  currency: Currency;
}) {
  const m = (v: number, sign = false) => formatMoney(v, { currency, sign });
  const md = (v: number) => formatMoney(v, { currency, decimals: true });
  const annualExemption = rates.ltcgExemption ?? 125000;
  const ltcgAnnualUsed = Math.min(r.ltcgGains, annualExemption);

  const hasBusiness = r.businessPnl !== 0;
  // show a head whenever it has net P&L OR a positive taxable base — capital
  // gains can be taxed (STT, DP, MTF interest and pledge charges are added
  // back) even when net nets to zero
  const hasStcg = r.stcgPnl !== 0 || r.stcgGains > 0;
  const hasLtcg = r.ltcgPnl !== 0 || r.ltcgGains > 0;
  const hasCrypto = r.cryptoPnl !== 0 || r.cryptoGains !== 0;
  // non-deductible charges added back to reach the taxable base (≥ 0)
  const stcgAddBack = Math.round((r.stcgTaxablePnl - r.stcgPnl) * 100) / 100;
  const ltcgAddBack = Math.round((r.ltcgTaxablePnl - r.ltcgPnl) * 100) / 100;

  return (
    <Card
      title="How your tax is computed"
      subtitle="New regime, FY 2025-26 · resident individual · trading as your only income"
      bodyClassName="space-y-4"
    >
      {/* ── Business income ── */}
      {hasBusiness && (
        <div className="space-y-1.5">
          <SectionHead title="Business income — intraday & F&O" note="taxed at slab rates" />
          <Line label="Net business P&L" value={m(r.businessPnl, true)} valueClass={pnlClass(r.businessPnl)} />
          {r.businessLoss > 0 ? (
            <Line
              label="Taxable (a net loss books no tax)"
              value={m(0)}
              indent
              muted
            />
          ) : (
            <>
              <Line label="Slab tax (new regime)" value={m(r.slabTaxOnBusiness)} indent />
              {r.rebate87A > 0 && (
                <Line
                  label="Less §87A rebate"
                  value={`− ${m(r.rebate87A)}`}
                  indent
                  valueClass="text-profit"
                />
              )}
              <Line label="Business income tax" value={m(r.businessTax)} indent strong valueClass="text-warning" />
            </>
          )}
        </div>
      )}

      {/* ── STCG ── */}
      {hasStcg && (
        <div className="space-y-1.5 border-t border-edge-soft pt-3">
          <SectionHead title="Short-term capital gains · §111A" note={`${ratePctLabel(rates.stcgPct)} flat`} />
          <Line label="Net STCG (equity, held < 12m)" value={m(r.stcgPnl, true)} valueClass={pnlClass(r.stcgPnl)} />
          {stcgAddBack > 0.005 && (
            <Line
              label="Add back non-deductible (STT · DP · MTF interest · pledge)"
              value={`+ ${m(stcgAddBack)}`}
              indent
              valueClass="text-warning"
            />
          )}
          {r.basicExemptionUsedStcg > 0 && (
            <Line label="Less unused ₹4L basic exemption" value={`− ${m(r.basicExemptionUsedStcg)}`} indent valueClass="text-profit" />
          )}
          <Line label={`Taxable @ ${ratePctLabel(rates.stcgPct)}`} value={m(r.stcgTaxable)} indent />
          <Line label="STCG tax" value={m(r.stcgTax)} indent strong valueClass="text-warning" />
        </div>
      )}

      {/* ── LTCG ── */}
      {hasLtcg && (
        <div className="space-y-1.5 border-t border-edge-soft pt-3">
          <SectionHead title="Long-term capital gains · §112A" note={`${ratePctLabel(rates.ltcgPct)} over ₹1.25L`} />
          <Line label="Net LTCG (equity, held ≥ 12m)" value={m(r.ltcgPnl, true)} valueClass={pnlClass(r.ltcgPnl)} />
          {ltcgAddBack > 0.005 && (
            <Line
              label="Add back non-deductible (STT · DP · MTF interest · pledge)"
              value={`+ ${m(ltcgAddBack)}`}
              indent
              valueClass="text-warning"
            />
          )}
          {ltcgAnnualUsed > 0 && (
            <Line label={`Less annual exemption (${m(annualExemption)})`} value={`− ${m(ltcgAnnualUsed)}`} indent valueClass="text-profit" />
          )}
          {r.basicExemptionUsedLtcg > 0 && (
            <Line label="Less unused basic exemption" value={`− ${m(r.basicExemptionUsedLtcg)}`} indent valueClass="text-profit" />
          )}
          <Line label={`Taxable @ ${ratePctLabel(rates.ltcgPct)}`} value={m(r.ltcgTaxable)} indent />
          <Line label="LTCG tax" value={m(r.ltcgTax)} indent strong valueClass="text-warning" />
        </div>
      )}

      {/* ── Crypto ── */}
      {hasCrypto && (
        <div className="space-y-1.5 border-t border-edge-soft pt-3">
          <SectionHead title="Crypto / VDA · §115BBH" note={`${ratePctLabel(rates.cryptoPct)} flat`} />
          <Line label="Net crypto P&L" value={m(r.cryptoPnl, true)} valueClass={pnlClass(r.cryptoPnl)} />
          <Line label="Taxable gains (no loss set-off)" value={m(r.cryptoGains)} indent />
          <Line label={`Crypto tax @ ${ratePctLabel(rates.cryptoPct)}`} value={m(r.cryptoTax)} indent strong valueClass="text-warning" />
        </div>
      )}

      {/* ── Totals ── */}
      <div className="space-y-1.5 border-t border-edge pt-3">
        <Line label="Tax before cess" value={md(r.taxBeforeCess)} />
        {r.surcharge > 0 && <Line label="Surcharge" value={md(r.surcharge)} />}
        <Line label="Health & education cess (4%)" value={md(r.cess)} />
        <div className="mt-1.5 flex items-baseline justify-between gap-3 rounded-[10px] bg-warning-soft/60 px-3 py-2.5">
          <div>
            <p className="text-[13px] font-semibold text-warning">Total estimated tax</p>
            <p className="text-[11px] text-warning/70">
              Effective {formatPct(r.effectiveRate, 1)} of ₹{formatMoney(r.totalIncome).replace("₹", "")} taxable income
            </p>
          </div>
          <span className="tnum text-[20px] font-semibold text-warning">{md(r.totalTax)}</span>
        </div>
      </div>

      {/* carry-forward note */}
      {(r.businessLoss > 0 || r.stcgLoss > 0 || r.ltcgLoss > 0) && (
        <div className="rounded-[10px] border border-edge-soft bg-raised/60 p-3 text-[12px] leading-relaxed text-muted">
          <span className="font-medium text-ink">Losses to carry forward: </span>
          {[
            r.businessLoss > 0 ? `${m(r.businessLoss)} business` : null,
            r.stcgLoss > 0 ? `${m(r.stcgLoss)} STCG` : null,
            r.ltcgLoss > 0 ? `${m(r.ltcgLoss)} LTCG` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
          . These aren&apos;t taxed this year and may offset future gains (business 8y / speculative 4y /
          capital-loss 8y) when you file.
        </div>
      )}
    </Card>
  );
}
