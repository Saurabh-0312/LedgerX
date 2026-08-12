/** Charge-component identity — fixed order + fixed CAT slot per the design contract.
 *  Never reorder or cycle: Brokerage=CAT[0] … DP charges=CAT[6] everywhere on the page. */

import type { ChargesBreakdown, Trade } from "@/types";
import { CAT, INFO, WARNING } from "@/components/charts/chartTheme";

export type ChargeComponentKey = Exclude<keyof ChargesBreakdown, "total">;

export interface ChargeComponentDef {
  key: ChargeComponentKey;
  /** full display name (legend, totals table) */
  label: string;
  /** compact column header for the per-trade table */
  short: string;
  /** fixed categorical slot */
  color: string;
}

export const CHARGE_COMPONENTS: readonly ChargeComponentDef[] = [
  { key: "brokerage", label: "Brokerage", short: "Brokerage", color: CAT[0] },
  { key: "exchangeTxn", label: "Exchange txn", short: "Exch txn", color: CAT[1] },
  { key: "stt", label: "STT/CTT", short: "STT/CTT", color: CAT[2] },
  { key: "sebi", label: "SEBI", short: "SEBI", color: CAT[3] },
  { key: "stampDuty", label: "Stamp duty", short: "Stamp", color: CAT[4] },
  { key: "gst", label: "GST", short: "GST", color: CAT[5] },
  { key: "dpCharges", label: "DP charges", short: "DP", color: CAT[6] },
  { key: "pledgeCharges", label: "Pledge", short: "Pledge", color: INFO },
  { key: "manual", label: "Manual charges", short: "Manual", color: CAT[7] },
  { key: "mtfInterest", label: "MTF interest", short: "MTF int", color: WARNING },
];

export function sumComponent(trades: Trade[], key: ChargeComponentKey): number {
  return trades.reduce((acc, t) => acc + (t.charges[key] ?? 0), 0);
}
