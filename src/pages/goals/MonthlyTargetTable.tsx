/** Per-month target breakdown: portfolio value, each target amount (green when
 *  reached), achieved P&L, achieve % and the highest tier hit. */

import { Check } from "lucide-react";
import type { Currency } from "@/lib/format";
import { formatMoney, formatPct, pnlClass } from "@/lib/format";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { TD, TH, TableShell } from "@/components/ui/Table";
import { TARGET_COLORS, type MonthTargetRow } from "./portfolioTargets";

const pctLabel = (p: number) => `${Number.isInteger(p) ? p : p.toFixed(1)}%`;

export function MonthlyTargetTable({
  rows,
  percents,
  currency,
}: {
  rows: MonthTargetRow[];
  percents: number[];
  currency: Currency;
}) {
  const active = rows.filter((r) => r.capital > 0 || r.achieved !== 0);

  return (
    <Card title="Monthly breakdown" subtitle="Targets reached are highlighted; achieve % is P&L over that month's portfolio">
      {active.length === 0 ? (
        <EmptyState title="Nothing to break down yet" hint="Add a month's portfolio value to populate this table." />
      ) : (
        <TableShell>
          <thead>
            <tr>
              <TH>Month</TH>
              <TH className="tnum text-right">Portfolio</TH>
              {percents.map((p, i) => (
                <TH key={i} className="tnum text-right">
                  <span aria-hidden className="mr-1.5 inline-block h-2.5 w-[3px] rounded-full align-[-1px]" style={{ background: TARGET_COLORS[i % TARGET_COLORS.length] }} />
                  {pctLabel(p)}
                </TH>
              ))}
              <TH className="tnum text-right">Achieved</TH>
              <TH className="tnum text-right">Achieve %</TH>
              <TH className="text-right">Result</TH>
            </tr>
          </thead>
          <tbody>
            {active.map((r) => (
              <tr key={r.ym} className="transition-colors hover:bg-raised/40">
                <TD className="font-medium text-ink">{r.label}</TD>
                <TD className="tnum text-right text-muted">
                  {r.capital > 0 ? formatMoney(r.capital, { currency }) : "—"}
                </TD>
                {r.targets.map((t, i) => {
                  const hit = r.capital > 0 && r.achieved >= t && r.achieved > 0;
                  return (
                    <TD key={i} className={`tnum text-right ${hit ? "text-profit font-medium" : "text-muted"}`}>
                      {r.capital > 0 ? (
                        <span className="inline-flex items-center justify-end gap-1">
                          {hit && <Check size={12} aria-hidden />}
                          {formatMoney(t, { currency, compact: true })}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TD>
                  );
                })}
                <TD className={`tnum text-right font-semibold ${pnlClass(r.achieved)}`}>
                  {formatMoney(r.achieved, { currency, sign: true })}
                </TD>
                <TD className={`tnum text-right ${pnlClass(r.achievePct)}`}>
                  {r.capital > 0 ? formatPct(r.achievePct, 2, true) : "—"}
                </TD>
                <TD className="text-right">
                  {r.bestTargetHit >= 0 ? (
                    <Badge tone="profit">Hit {pctLabel(percents[r.bestTargetHit])}</Badge>
                  ) : r.achieved > 0 ? (
                    <Badge tone="warning">Below 1st</Badge>
                  ) : r.achieved < 0 ? (
                    <Badge tone="loss">Loss</Badge>
                  ) : (
                    <span className="text-faint">—</span>
                  )}
                </TD>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}
    </Card>
  );
}
