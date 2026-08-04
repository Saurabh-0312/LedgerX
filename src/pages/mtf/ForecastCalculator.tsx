/** Forecast Calculator (spec §8-forecast) — "if I hold N more days…".
 *  Preset day chips + custom days + assumed exit price → live MtfForecast tiles.
 *  Interest amber, break-even #eab308 dot, forecast framing accent, P&L pnlClass. */

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { formatMoney, formatPct, pnlClass } from "@/lib/format";
import { forecastPosition } from "@/lib/mtf/calc";
import { MTF_COLORS } from "@/lib/mtf/palette";
import type { ComputedPosition } from "@/lib/mtf/types";

const PRESET_DAYS = [5, 10, 15, 30, 45, 60, 90, 180, 365];

interface ForecastTile {
  label: string;
  value: string;
  valueClass: string;
  dot?: string;
  sub?: string;
}

export function ForecastCalculator({ cp }: { cp: ComputedPosition }) {
  const defaultPrice = cp.pos.currentPrice ?? cp.pos.avgBuyPrice;

  const [daysStr, setDaysStr] = useState("30");
  const [priceStr, setPriceStr] = useState(() => String(defaultPrice));

  // Re-seed the assumed exit price when the position (or its price) changes.
  useEffect(() => {
    setPriceStr(String(defaultPrice));
  }, [cp.pos.id, defaultPrice]);

  const days = useMemo(() => {
    const n = Math.floor(Number(daysStr));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [daysStr]);

  const price = useMemo(() => {
    const n = Number(priceStr);
    return Number.isFinite(n) && n > 0 ? n : defaultPrice;
  }, [priceStr, defaultPrice]);

  const f = useMemo(() => forecastPosition(cp, days, price), [cp, days, price]);

  const tiles: ForecastTile[] = [
    {
      label: "Additional interest",
      value: formatMoney(f.addlInterest, { decimals: true }),
      valueClass: "text-warning",
      sub: `${formatMoney(cp.dailyInterest, { decimals: true })}/day × ${days} day${days === 1 ? "" : "s"}`,
    },
    {
      label: "Future total interest",
      value: formatMoney(f.futureTotalInterest, { decimals: true }),
      valueClass: "text-warning",
    },
    {
      label: "Future break-even",
      value: formatMoney(f.futureBreakEven, { decimals: true }),
      valueClass: "text-ink",
      dot: MTF_COLORS.breakEven,
    },
    {
      label: "Future net profit",
      value: formatMoney(f.futureNetProfit, { sign: true, decimals: true }),
      valueClass: pnlClass(f.futureNetProfit),
    },
    {
      label: "Minimum selling price",
      value: formatMoney(f.minSellingPrice, { decimals: true }),
      valueClass: "text-ink",
      dot: MTF_COLORS.breakEven,
      sub: "= future break-even",
    },
    {
      label: "Expected return",
      value: formatPct(f.expectedReturnPct, 2, true),
      valueClass: pnlClass(f.expectedReturnPct),
    },
  ];

  return (
    <Card
      title="Forecast — if I hold longer"
      subtitle={
        <span className="text-accent">
          Interest keeps accruing daily — project {days} more day{days === 1 ? "" : "s"} at an exit of{" "}
          {formatMoney(price, { decimals: true })}
        </span>
      }
    >
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Forecast horizon presets">
        {PRESET_DAYS.map((d) => {
          const active = days === d;
          return (
            <button
              key={d}
              type="button"
              aria-pressed={active}
              onClick={() => setDaysStr(String(d))}
              className={`h-7 rounded-lg border px-2.5 text-[12px] font-medium transition-colors ${
                active
                  ? "border-accent/50 bg-accent-soft text-accent"
                  : "border-edge bg-transparent text-muted hover:bg-raised hover:text-ink"
              }`}
            >
              {d}d
            </button>
          );
        })}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:max-w-md">
        <Field label="Custom days">
          {(id) => (
            <Input
              id={id}
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              value={daysStr}
              onChange={(e) => setDaysStr(e.target.value)}
            />
          )}
        </Field>
        <Field label="Assumed exit price (₹)" hint={`Default ${formatMoney(defaultPrice, { decimals: true })}`}>
          {(id) => (
            <Input
              id={id}
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={priceStr}
              onChange={(e) => setPriceStr(e.target.value)}
            />
          )}
        </Field>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl border border-edge-soft bg-raised/40 p-3">
            <p className="label-caps">{t.label}</p>
            <p className={`tnum mt-1 flex items-center gap-1.5 text-[15px] font-semibold ${t.valueClass}`}>
              {t.dot && (
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: t.dot }}
                  aria-hidden
                />
              )}
              {t.value}
            </p>
            {t.sub && <p className="mt-0.5 text-[11px] text-faint">{t.sub}</p>}
          </div>
        ))}
      </div>
    </Card>
  );
}
