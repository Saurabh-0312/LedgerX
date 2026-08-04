import { useEffect, useRef, useState } from "react";
import { CalendarRange, Check, ChevronDown } from "lucide-react";
import type { RangePreset } from "@/types";
import { useStore } from "@/store/useStore";
import { PRESET_LABELS } from "@/store/useFilteredTrades";
import { Button } from "@/components/ui/Button";

const PRESETS: RangePreset[] = ["all", "7d", "30d", "90d", "thisMonth", "lastMonth", "ytd"];

/** Global date-range control: preset rows (16px bold check on selection),
 *  custom range tucked behind a hairline in the footer — per the dataviz picker spec. */
export function DateRangePicker() {
  const filters = useStore((s) => s.filters);
  const setFilters = useStore((s) => s.setFilters);
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(filters.from ?? "");
  const [to, setTo] = useState(filters.to ?? "");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const label =
    filters.preset === "custom" && filters.from && filters.to
      ? `${filters.from} → ${filters.to}`
      : PRESET_LABELS[filters.preset];

  return (
    <div className="relative" ref={ref}>
      <Button variant="outline" size="sm" icon={CalendarRange} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="listbox">
        <span className="max-w-[160px] truncate">{label}</span>
        <ChevronDown size={13} className="text-faint" aria-hidden />
      </Button>

      {open && (
        <div className="animate-pop glass-pop absolute right-0 z-40 mt-1.5 w-[240px] rounded-xl p-1.5" role="listbox">
          {PRESETS.map((p) => (
            <button
              key={p}
              role="option"
              aria-selected={filters.preset === p}
              onClick={() => {
                setFilters({ preset: p });
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] transition-colors hover:bg-white/[0.04] ${
                filters.preset === p ? "text-ink font-medium" : "text-muted"
              }`}
            >
              {PRESET_LABELS[p]}
              {filters.preset === p && <Check size={16} strokeWidth={2.5} className="text-accent" aria-hidden />}
            </button>
          ))}

          {/* custom range behind a hairline */}
          <div className="mt-1.5 border-t border-edge pt-2 px-1.5 pb-1">
            <div className="label-caps mb-1.5">Custom range</div>
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="input-base !px-2 !py-1.5 text-[12px]"
                aria-label="From date"
              />
              <span className="text-faint text-[11px]">→</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="input-base !px-2 !py-1.5 text-[12px]"
                aria-label="To date"
              />
            </div>
            <Button
              variant="primary"
              size="sm"
              className="mt-2 w-full"
              disabled={!from || !to}
              onClick={() => {
                setFilters({ preset: "custom", from, to });
                setOpen(false);
              }}
            >
              Apply
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
