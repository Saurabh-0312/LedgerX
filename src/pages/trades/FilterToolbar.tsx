/** Trades page filter toolbar — search + facet selects + live count. */

import type { ReactNode, SelectHTMLAttributes } from "react";
import { ChevronDown, FilterX, Search } from "lucide-react";
import type { AssetClass, Direction, TradeStatus } from "@/types";
import { Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

export type ResultFilter = "all" | "win" | "loss" | "be";

export interface TradeFilters {
  search: string;
  assetClass: AssetClass | "all";
  direction: Direction | "all";
  strategy: string; // "all" or an exact strategy name
  tag: string; // "all" or an exact tag
  result: ResultFilter;
  status: TradeStatus | "all";
}

export const DEFAULT_TRADE_FILTERS: TradeFilters = {
  search: "",
  assetClass: "all",
  direction: "all",
  strategy: "all",
  tag: "all",
  result: "all",
  status: "all",
};

export function hasActiveFilters(f: TradeFilters): boolean {
  return (
    f.search.trim() !== "" ||
    f.assetClass !== "all" ||
    f.direction !== "all" ||
    f.strategy !== "all" ||
    f.tag !== "all" ||
    f.result !== "all" ||
    f.status !== "all"
  );
}

const ASSET_CLASSES: AssetClass[] = ["Equity", "Options", "Futures", "Forex", "Crypto", "Commodity"];
const DIRECTIONS: Direction[] = ["Long", "Short"];
const STATUSES: TradeStatus[] = ["Open", "Closed", "Cancelled"];

interface ToolbarSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  children: ReactNode;
  /** dims the control when it is still on its "All …" default */
  active: boolean;
}

/** Compact select with its own chevron (the shared Select is appearance-none). */
function ToolbarSelect({ label, active, children, className = "", ...rest }: ToolbarSelectProps) {
  return (
    <div className="relative">
      <Select
        aria-label={label}
        className={`h-8 w-auto py-0 pr-7 text-[12px] ${active ? "text-ink" : "text-muted"} ${className}`}
        {...rest}
      >
        {children}
      </Select>
      <ChevronDown
        size={13}
        aria-hidden
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-faint"
      />
    </div>
  );
}

interface FilterToolbarProps {
  filters: TradeFilters;
  onChange: (patch: Partial<TradeFilters>) => void;
  onClear: () => void;
  strategies: string[];
  tags: string[];
  /** rows surviving the local filters */
  shown: number;
  /** rows in the global (topbar) scope */
  total: number;
}

export function FilterToolbar({ filters, onChange, onClear, strategies, tags, shown, total }: FilterToolbarProps) {
  const active = hasActiveFilters(filters);

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-60">
        <Search size={14} aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
        <Input
          type="search"
          value={filters.search}
          onChange={(e) => onChange({ search: e.target.value })}
          placeholder="Search symbol, strategy or tag…"
          aria-label="Search trades by symbol, strategy or tag"
          className="h-8 py-0 pl-8 text-[12px]"
        />
      </div>

      <ToolbarSelect
        label="Filter by asset class"
        active={filters.assetClass !== "all"}
        value={filters.assetClass}
        onChange={(e) => onChange({ assetClass: e.target.value as TradeFilters["assetClass"] })}
      >
        <option value="all">All assets</option>
        {ASSET_CLASSES.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </ToolbarSelect>

      <ToolbarSelect
        label="Filter by direction"
        active={filters.direction !== "all"}
        value={filters.direction}
        onChange={(e) => onChange({ direction: e.target.value as TradeFilters["direction"] })}
      >
        <option value="all">All directions</option>
        {DIRECTIONS.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </ToolbarSelect>

      <ToolbarSelect
        label="Filter by strategy"
        active={filters.strategy !== "all"}
        value={filters.strategy}
        onChange={(e) => onChange({ strategy: e.target.value })}
      >
        <option value="all">All strategies</option>
        {strategies.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </ToolbarSelect>

      <ToolbarSelect
        label="Filter by tag"
        active={filters.tag !== "all"}
        value={filters.tag}
        onChange={(e) => onChange({ tag: e.target.value })}
      >
        <option value="all">All tags</option>
        {tags.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </ToolbarSelect>

      <ToolbarSelect
        label="Filter by result"
        active={filters.result !== "all"}
        value={filters.result}
        onChange={(e) => onChange({ result: e.target.value as ResultFilter })}
      >
        <option value="all">All results</option>
        <option value="win">Winners</option>
        <option value="loss">Losers</option>
        <option value="be">Break-even</option>
      </ToolbarSelect>

      <ToolbarSelect
        label="Filter by status"
        active={filters.status !== "all"}
        value={filters.status}
        onChange={(e) => onChange({ status: e.target.value as TradeFilters["status"] })}
      >
        <option value="all">All statuses</option>
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </ToolbarSelect>

      <div className="ml-auto flex items-center gap-2">
        <span className="whitespace-nowrap text-[12px] text-muted" aria-live="polite">
          <span className="tnum font-medium text-ink">{shown}</span> of <span className="tnum">{total}</span> trades
        </span>
        {active && (
          <Button variant="ghost" size="sm" icon={FilterX} onClick={onClear}>
            Clear filters
          </Button>
        )}
      </div>
    </div>
  );
}
