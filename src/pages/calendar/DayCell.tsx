import type { CSSProperties } from "react";
import { heatColor, heatTextColor } from "@/components/charts/chartTheme";
import { formatDate, formatMoney } from "@/lib/format";

interface DayCellProps {
  /** yyyy-MM-dd */
  date: string;
  day: number;
  pnl: number;
  tradeCount: number;
  /** max |day pnl| of the visible month, for heat scaling */
  maxAbs: number;
  weekend: boolean;
  future: boolean;
  selected: boolean;
  onOpen: (date: string) => void;
}

/** One calendar day — heat-shaded button. Empty weekdays are outlined,
 *  weekends with no trades are dimmer, future days are disabled. */
export function DayCell({ date, day, pnl, tradeCount, maxAbs, weekend, future, selected, onOpen }: DayCellProps) {
  const filled = tradeCount > 0;
  const aria = filled
    ? `${formatDate(date)}: ${formatMoney(pnl, { sign: true })}, ${tradeCount} ${tradeCount === 1 ? "trade" : "trades"}`
    : `${formatDate(date)}: no trades`;

  let surface: string;
  let style: CSSProperties | undefined;
  let dayNumClass: string;
  if (filled) {
    style = { backgroundColor: heatColor(pnl, maxAbs), color: heatTextColor(pnl, maxAbs) };
    surface = "border border-transparent hover:brightness-110";
    dayNumClass = "opacity-80";
  } else if (future) {
    surface = "border border-edge-soft/50 bg-surface opacity-35";
    dayNumClass = "text-faint";
  } else if (weekend) {
    surface = "border border-transparent bg-base/60 hover:bg-raised/40";
    dayNumClass = "text-faint/70";
  } else {
    surface = "border border-edge-soft bg-surface hover:bg-raised/60";
    dayNumClass = "text-faint";
  }

  return (
    <button
      type="button"
      disabled={future}
      onClick={() => onOpen(date)}
      aria-label={aria}
      aria-current={selected ? "date" : undefined}
      title={aria}
      style={style}
      className={`relative flex min-h-[56px] flex-col items-center justify-center rounded-lg p-1 pt-4 text-center transition-all duration-150 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-default sm:min-h-[84px] ${surface} ${
        selected ? "ring-2 ring-accent" : ""
      }`}
    >
      <span className={`absolute left-1.5 top-1 text-[10px] font-medium sm:left-2 sm:top-1.5 sm:text-[11px] ${dayNumClass}`}>
        {day}
      </span>
      {filled && (
        <>
          <span className="tnum text-[11px] font-semibold leading-tight sm:text-[13px]">
            {formatMoney(pnl, { compact: true, sign: true })}
          </span>
          <span className="mt-0.5 text-[9px] opacity-75 sm:text-[10px]">
            {tradeCount} {tradeCount === 1 ? "trade" : "trades"}
          </span>
        </>
      )}
    </button>
  );
}
