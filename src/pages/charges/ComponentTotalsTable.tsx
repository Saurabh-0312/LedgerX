/** Totals per charge component — color key, total, share bar, avg/trade + bold Total row. */

import { Coins } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { TD, TH, TableShell } from "@/components/ui/Table";
import { formatMoney, formatPct } from "@/lib/format";
import type { ChargeComponentDef } from "./chargeComponents";

export interface ComponentTotal {
  def: ChargeComponentDef;
  total: number;
}

interface ComponentTotalsTableProps {
  rows: ComponentTotal[];
  /** executed (non-cancelled) trades in range — denominator for avg/trade */
  tradeCount: number;
}

export function ComponentTotalsTable({ rows, tradeCount }: ComponentTotalsTableProps) {
  const grand = rows.reduce((acc, r) => acc + r.total, 0);

  if (grand <= 0 || tradeCount === 0) {
    return (
      <EmptyState
        icon={Coins}
        title="No charges in this range"
        hint="Widen the global date range or switch accounts to see how fees break down by component."
      />
    );
  }

  return (
    <TableShell>
      <thead>
        <tr>
          <TH>Component</TH>
          <TH className="tnum text-right">Total</TH>
          <TH>Share of all charges</TH>
          <TH className="tnum text-right">Avg / trade</TH>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ def, total }) => {
          const pct = (total / grand) * 100;
          return (
            <tr key={def.key} className="transition-colors hover:bg-raised/40">
              <TD>
                <span className="flex items-center gap-2.5">
                  <span
                    aria-hidden
                    className="h-4 w-[3px] shrink-0 rounded-full"
                    style={{ background: def.color }}
                  />
                  <span className="font-medium text-ink">{def.label}</span>
                </span>
              </TD>
              <TD className="tnum text-right">{formatMoney(total, { decimals: true })}</TD>
              <TD>
                <span className="flex items-center gap-2.5">
                  <span aria-hidden className="h-1 w-24 overflow-hidden rounded-full bg-raised sm:w-36">
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${Math.min(100, Math.max(1.5, pct))}%`, background: def.color }}
                    />
                  </span>
                  <span className="tnum text-[12px] text-muted">{formatPct(pct)}</span>
                </span>
              </TD>
              <TD className="tnum text-right text-muted">
                {formatMoney(total / tradeCount, { decimals: true })}
              </TD>
            </tr>
          );
        })}
        <tr>
          <TD className="font-semibold text-ink">Total</TD>
          <TD className="tnum text-right font-semibold text-ink">{formatMoney(grand, { decimals: true })}</TD>
          <TD className="tnum text-[12px] font-semibold text-muted">100%</TD>
          <TD className="tnum text-right font-semibold text-ink">
            {formatMoney(grand / tradeCount, { decimals: true })}
          </TD>
        </tr>
      </tbody>
    </TableShell>
  );
}
