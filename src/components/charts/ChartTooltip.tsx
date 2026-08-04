/** Shared dark tooltip for every Recharts chart.
 *  Values lead (bold, primary); series names follow (muted). Line-keys, not boxes. */

import type { ReactNode } from "react";

interface PayloadEntry {
  name?: string | number;
  value?: number | string | Array<number | string>;
  color?: string;
  stroke?: string;
  fill?: string;
  dataKey?: string | number;
  payload?: Record<string, unknown>;
}

export interface ChartTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: PayloadEntry[];
  /** format numeric values (e.g. money formatter). Default: en-IN number. */
  valueFormatter?: (value: number, entry: PayloadEntry) => string;
  /** format the x label shown on top */
  labelFormatter?: (label: string | number) => ReactNode;
  /** hide series whose value is 0 (useful for sparse stacks) */
  hideZero?: boolean;
}

const defaultFormat = (v: number) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(v);

export function ChartTooltip({
  active,
  label,
  payload,
  valueFormatter,
  labelFormatter,
  hideZero = false,
}: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const rows = hideZero ? payload.filter((p) => Number(p.value) !== 0) : payload;
  if (rows.length === 0) return null;

  return (
    <div className="glass-pop rounded-xl px-3 py-2.5 min-w-[140px]">
      {label !== undefined && label !== "" && (
        <div className="mb-1.5 text-[11px] font-medium text-muted">
          {labelFormatter ? labelFormatter(label) : String(label)}
        </div>
      )}
      <div className="space-y-1">
        {rows.map((entry, i) => {
          const color = entry.color ?? entry.stroke ?? entry.fill ?? "#8b929d";
          const raw = Array.isArray(entry.value) ? entry.value[0] : entry.value;
          const num = typeof raw === "number" ? raw : Number(raw);
          const text =
            Number.isFinite(num) && valueFormatter
              ? valueFormatter(num, entry)
              : Number.isFinite(num)
                ? defaultFormat(num)
                : String(raw ?? "—");
          return (
            <div key={i} className="flex items-center gap-2">
              <span
                aria-hidden
                className="h-3 w-[3px] shrink-0 rounded-full"
                style={{ background: color }}
              />
              <span className="tnum text-[13px] font-semibold text-ink">{text}</span>
              {entry.name !== undefined && (
                <span className="ml-auto pl-3 text-[11px] text-muted">{String(entry.name)}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
