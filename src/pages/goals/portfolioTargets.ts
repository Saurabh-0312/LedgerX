/** Monthly percentage-target computation for the Goals page.
 *  For each month of a year: capital (user-entered) → target amounts (percents%
 *  of capital) and achieved (that month's net P&L from closed trades). */

import type { Trade } from "@/types";
import { monthlyPnl } from "@/lib/metrics";
import { CAT } from "@/components/charts/chartTheme";

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Distinct line colors for target tiers — avoids the green/red used by achieved. */
export const TARGET_COLORS = [CAT[7], CAT[4], CAT[2], CAT[1], CAT[5], CAT[6], CAT[0], CAT[3]];

export interface MonthTargetRow {
  ym: string; // "2026-01"
  label: string; // "Jan"
  monthIndex: number; // 0–11
  capital: number;
  achieved: number; // net P&L that month
  achievePct: number; // achieved / capital %
  targets: number[]; // ₹ per percent, aligned to `percents`
  /** index of the highest target reached (achieved ≥ target); -1 if none */
  bestTargetHit: number;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function buildMonthlyTargetRows(
  trades: Trade[],
  year: number,
  percents: number[],
  capitalByMonth: Record<string, number>,
): MonthTargetRow[] {
  const pnlByMonth = new Map(monthlyPnl(trades).map((m) => [m.month, m.pnl]));

  return MONTHS_SHORT.map((label, monthIndex) => {
    const ym = `${year}-${pad(monthIndex + 1)}`;
    const capital = capitalByMonth[ym] ?? 0;
    const achieved = Math.round(pnlByMonth.get(ym) ?? 0);
    const targets = percents.map((p) => Math.round((capital * p) / 100));

    let bestTargetHit = -1;
    if (capital > 0 && achieved > 0) {
      for (let i = 0; i < targets.length; i++) {
        if (achieved >= targets[i]) bestTargetHit = i;
      }
    }

    return {
      ym,
      label,
      monthIndex,
      capital,
      achieved,
      achievePct: capital > 0 ? (achieved / capital) * 100 : 0,
      targets,
      bestTargetHit,
    };
  });
}

/** Years that have either entered capital or closed-trade activity. */
export function targetYears(trades: Trade[], capitalByMonth: Record<string, number>): number[] {
  const set = new Set<number>();
  for (const key of Object.keys(capitalByMonth)) set.add(Number(key.slice(0, 4)));
  for (const m of monthlyPnl(trades)) set.add(Number(m.month.slice(0, 4)));
  return [...set].filter((y) => Number.isFinite(y)).sort((a, b) => a - b);
}
