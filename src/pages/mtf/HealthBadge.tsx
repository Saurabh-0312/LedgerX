/** MTF interest-health pill (spec §7.5) — HEALTH_META tier dot + label + share
 *  of gross profit ("Interest 12% of profit"). Gross ≤ 0 ⇒ "∞" with a
 *  "No gross profit yet" tooltip. Small, sits anywhere a Badge would. */

import type { ComputedPosition } from "@/lib/mtf/types";
import { HEALTH_META } from "@/lib/mtf/palette";
import { formatPct } from "@/lib/format";

export function HealthBadge({ cp }: { cp: ComputedPosition }) {
  const meta = HEALTH_META[cp.health];
  const finite = Number.isFinite(cp.healthPct);
  const title = finite
    ? `Interest is ${formatPct(cp.healthPct, 2)} of gross profit`
    : "No gross profit yet";

  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap ${meta.className}`}
    >
      <span
        aria-hidden
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: meta.dot }}
      />
      <span>{meta.label}</span>
      <span className="opacity-75">
        {finite ? `Interest ${formatPct(cp.healthPct, 0)} of profit` : "∞"}
      </span>
    </span>
  );
}
