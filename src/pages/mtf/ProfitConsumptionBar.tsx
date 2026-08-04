/** Profit Consumption Meter (spec §7.4, §7.5) — animated horizontal bars showing
 *  how gross profit is eaten by financing interest and charges to leave net.
 *  Colors: gross/net by sign (PNL), interest amber, charges muted gray. */

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { formatMoney, pnlClass, pnlMarkColor } from "@/lib/format";
import { MTF_COLORS } from "@/lib/mtf/palette";
import type { ComputedPosition } from "@/lib/mtf/types";

interface BarRow {
  label: string;
  display: string;
  textClass: string;
  fill: string;
  widthPct: number;
  divider?: boolean;
}

export function ProfitConsumptionBar({ cp }: { cp: ComputedPosition }) {
  // Start bars at 0 width and expand on mount so the meter visibly animates.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setMounted(true), 50);
    return () => window.clearTimeout(t);
  }, []);

  const gross = cp.grossProfit;
  const interest = cp.accumulatedInterest;
  const charges = cp.totalCharges;
  const net = cp.netProfit;

  // Scale every bar against the biggest magnitude in play (≥1 to avoid /0).
  const scale = Math.max(Math.abs(gross), interest + charges, Math.abs(net), 1);
  const widthOf = (v: number) => Math.min(100, (Math.abs(v) / scale) * 100);

  const rows: BarRow[] = [
    {
      label: "Gross profit",
      display: formatMoney(gross, { sign: true, decimals: true }),
      textClass: pnlClass(gross),
      fill: pnlMarkColor(gross),
      widthPct: widthOf(gross),
    },
    {
      label: "− Interest",
      display: formatMoney(-interest, { sign: true, decimals: true }),
      textClass: "text-warning",
      fill: MTF_COLORS.interest,
      widthPct: widthOf(interest),
    },
    {
      label: "− Charges",
      display: formatMoney(-charges, { sign: true, decimals: true }),
      textClass: "text-muted",
      fill: pnlMarkColor(0), // muted gray mark color
      widthPct: widthOf(charges),
    },
    {
      label: "= Net profit",
      display: formatMoney(net, { sign: true, decimals: true }),
      textClass: pnlClass(net),
      fill: pnlMarkColor(net),
      widthPct: widthOf(net),
      divider: true,
    },
  ];

  return (
    <Card title="Where the profit goes" subtitle="Gross profit minus daily interest and charges">
      <div className="space-y-3.5">
        {rows.map((r) => (
          <div key={r.label} className={r.divider ? "border-t border-edge-soft pt-3.5" : ""}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[12px] font-medium text-muted">{r.label}</span>
              <span className={`tnum text-[13px] font-semibold ${r.textClass}`}>{r.display}</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-raised">
              <div
                className="h-full rounded-full transition-[width] duration-500 ease-out"
                style={{ width: mounted ? `${r.widthPct}%` : "0%", backgroundColor: r.fill }}
              />
            </div>
          </div>
        ))}
      </div>
      {gross < 0 && (
        <p className="mt-3 text-[12px] text-loss">
          Gross profit is negative — interest and charges deepen the loss instead of consuming a gain.
        </p>
      )}
    </Card>
  );
}
