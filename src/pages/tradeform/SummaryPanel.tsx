/** Sticky live-calculation panel — recomputes P&L, charges, tax and R as the form changes. */

import type { ReactNode } from "react";
import { Calculator, Info } from "lucide-react";
import type {
  AssetClass,
  ChargesBreakdown,
  Direction,
  TaxCategory,
  TaxInfo,
  TradeSegment,
} from "@/types";
import type { BadgeTone } from "@/components/ui/Badge";
import { Badge, DirectionBadge, StatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Currency } from "@/lib/format";
import { formatDuration, formatMoney, formatPct, formatR, pnlClass } from "@/lib/format";

/** Everything the panel needs, derived once per keystroke in the page. */
export interface LiveCalc {
  /** Closed with valid qty/entry/exit → full breakdown is meaningful */
  ready: boolean;
  intraday: boolean;
  /** broker product/segment (Delivery/Intraday/MTF/FnO/Other) */
  segment: TradeSegment;
  /** charges entered as one manual total instead of auto-computed */
  manualCharges: boolean;
  positionValue: number;
  pctOfCapital: number;
  risk: number;
  gross: number;
  charges: ChargesBreakdown;
  net: number;
  /** tax base = gross − deductible charges (differs from net for capital gains/crypto) */
  taxablePnl: number;
  tax: TaxInfo;
  rMultiple?: number;
  chargesPctOfGross?: number;
  holdingMinutes?: number;
  suggestedRisk?: number;
}

interface SummaryPanelProps {
  symbol: string;
  direction: Direction;
  status: "Open" | "Closed";
  assetClass: AssetClass;
  currency: Currency;
  accountName?: string;
  calc: LiveCalc;
}

const TAX_TONE: Record<TaxCategory, BadgeTone> = {
  Intraday: "warning",
  STCG: "info",
  LTCG: "accent",
  Crypto: "warning",
};

function Row({
  label,
  value,
  strong = false,
  valueClass = "text-ink",
}: {
  label: ReactNode;
  value: ReactNode;
  strong?: boolean;
  valueClass?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[13px]">
      <span className={strong ? "font-medium text-ink" : "text-muted"}>{label}</span>
      <span className={`tnum ${strong ? "font-semibold" : "font-medium"} ${valueClass}`}>{value}</span>
    </div>
  );
}

export function SummaryPanel({
  symbol,
  direction,
  status,
  assetClass,
  currency,
  accountName,
  calc: c,
}: SummaryPanelProps) {
  const money = (v: number, opts: { sign?: boolean; decimals?: boolean } = {}) =>
    formatMoney(v, { currency, ...opts });

  const chargeItems = [
    { label: "Brokerage", value: c.charges.brokerage },
    { label: assetClass === "Crypto" ? "Exchange fee" : "Exchange txn", value: c.charges.exchangeTxn },
    { label: assetClass === "Crypto" ? "TDS (1% on sell)" : "STT / CTT", value: c.charges.stt },
    { label: "SEBI fees", value: c.charges.sebi },
    { label: "Stamp duty", value: c.charges.stampDuty },
    { label: "GST", value: c.charges.gst },
    { label: "DP charges", value: c.charges.dpCharges },
    { label: "Pledge", value: c.charges.pledgeCharges ?? 0 },
    { label: "MTF interest", value: c.charges.mtfInterest ?? 0 },
  ].filter((i) => i.value !== 0);

  const afterTax = Math.round((c.net - c.tax.estimatedTax) * 100) / 100;
  // charges that are NOT tax-deductible for this category → taxable P&L exceeds net
  const addBack = Math.round((c.taxablePnl - c.net) * 100) / 100;

  return (
    <Card title="Live summary" subtitle="Recalculates as you type" bodyClassName="space-y-4">
      {/* what's being priced */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[14px] font-semibold text-ink">{symbol.trim() || "—"}</span>
        <DirectionBadge direction={direction} />
        <StatusBadge status={status} />
        <Badge tone="neutral">{assetClass}</Badge>
      </div>
      {accountName && <p className="-mt-2 text-[12px] text-faint">{accountName}</p>}

      {status === "Open" ? (
        <>
          <div className="space-y-2.5 border-t border-edge-soft pt-4">
            <Row label="Position value" value={money(c.positionValue)} />
            <Row label="% of capital" value={formatPct(c.pctOfCapital)} />
            <Row label="Planned risk" value={c.risk > 0 ? money(c.risk) : "—"} />
          </div>
          <div className="flex items-start gap-2 rounded-[10px] bg-info-soft p-3 text-[12px] leading-relaxed text-info">
            <Info size={14} className="mt-0.5 shrink-0" aria-hidden />
            <span>
              P&amp;L, charges and tax are estimated once the trade is marked Closed with an exit price
              and exit time.
            </span>
          </div>
        </>
      ) : !c.ready ? (
        <div className="border-t border-edge-soft">
          <EmptyState
            icon={Calculator}
            title="Awaiting trade numbers"
            hint="Fill in quantity, entry price and exit price to preview net P&L, itemised charges and the estimated tax."
            className="py-8"
          />
        </div>
      ) : (
        <>
          {/* headline */}
          <div className="border-t border-edge-soft pt-4">
            <div className="label-caps">Net P&amp;L (est.)</div>
            <div className={`mt-1 text-[28px] font-semibold leading-none tracking-tight ${pnlClass(c.net)}`}>
              {money(c.net, { sign: true })}
            </div>
            <div className="mt-2 text-[12px] text-muted">
              <span className={`tnum font-medium ${pnlClass(c.net)}`}>{formatR(c.rMultiple)}</span>
              {" · "}
              {formatDuration(c.holdingMinutes)} hold
              {" · "}
              {c.intraday ? "Intraday" : "Positional"}
            </div>
          </div>

          {/* gross → charges → net */}
          <div className="space-y-2.5 border-t border-edge-soft pt-4">
            <Row label="Gross P&L" value={money(c.gross, { sign: true })} valueClass={pnlClass(c.gross)} />
            {c.manualCharges ? (
              <div className="space-y-1.5 rounded-[10px] border border-edge-soft bg-raised p-3">
                <div className="label-caps pb-0.5">Charges · entered manually</div>
                <Row label="Charges" value={money(c.charges.manual, { decimals: true })} valueClass="text-muted" />
                <Row
                  label="MTF interest"
                  value={money(c.charges.mtfInterest, { decimals: true })}
                  valueClass={c.charges.mtfInterest > 0 ? "text-warning" : "text-muted"}
                />
                <div className="border-t border-edge-soft pt-1.5">
                  <Row label="Total charges" value={`−${money(c.charges.total, { decimals: true })}`} strong />
                </div>
              </div>
            ) : chargeItems.length > 0 ? (
              <div className="space-y-1.5 rounded-[10px] border border-edge-soft bg-raised p-3">
                <div className="label-caps pb-0.5">Charges breakdown</div>
                {chargeItems.map((i) => (
                  <Row key={i.label} label={i.label} value={money(i.value, { decimals: true })} valueClass="text-muted" />
                ))}
                <div className="border-t border-edge-soft pt-1.5">
                  <Row label="Total charges" value={`−${money(c.charges.total, { decimals: true })}`} strong />
                </div>
              </div>
            ) : (
              <Row label="Total charges" value={money(0)} />
            )}
            {c.chargesPctOfGross !== undefined && (
              <Row label="Charges as % of gross" value={formatPct(c.chargesPctOfGross)} valueClass="text-muted" />
            )}
          </div>

          {/* tax */}
          <div className="space-y-2 rounded-[10px] border border-edge-soft bg-raised p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="label-caps">Estimated tax</span>
              <Badge tone={TAX_TONE[c.tax.category]}>{c.tax.category}</Badge>
            </div>
            {addBack > 0.005 && (
              <Row
                label="Taxable P&L"
                value={money(c.taxablePnl, { sign: true, decimals: true })}
                valueClass="text-warning"
              />
            )}
            <Row
              label={`Rate on ${money(c.tax.taxableAmount)} taxable`}
              value={formatPct(c.tax.rate, Number.isInteger(c.tax.rate) ? 0 : 1)}
            />
            <Row label="Estimated tax" value={money(c.tax.estimatedTax, { decimals: true })} strong />
            <Row label="After-tax P&L" value={money(afterTax, { sign: true })} valueClass={pnlClass(afterTax)} />
            {addBack > 0.005 && (
              <p className="pt-0.5 text-[11px] leading-relaxed text-faint">
                {c.tax.category === "Crypto"
                  ? "No costs are deductible for crypto — "
                  : "STT/CTT, DP, pledge & interest aren’t deductible — "}
                {money(addBack, { decimals: true })} added back, taxed on gross of these ({c.tax.category}).
              </p>
            )}
          </div>

          {/* sizing recap */}
          <div className="space-y-2.5 border-t border-edge-soft pt-4">
            <Row label="Position value" value={money(c.positionValue)} />
            <Row label="% of capital" value={formatPct(c.pctOfCapital)} />
            <Row label="Planned risk" value={c.risk > 0 ? money(c.risk) : "—"} />
          </div>
        </>
      )}
    </Card>
  );
}
