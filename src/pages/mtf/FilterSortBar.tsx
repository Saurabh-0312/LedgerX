/** MTF filter / search / sort toolbar (spec §12) + the PURE applyFilterSort
 *  helper the pages run before rendering tables/charts. State lives in the
 *  page (useState) — this component is fully controlled. */

import type { ReactNode, SelectHTMLAttributes } from "react";
import { ChevronDown, FilterX, Search } from "lucide-react";
import type { ComputedPosition, MtfBroker } from "@/lib/mtf/types";
import { Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

export type MtfSortKey =
  | "interestDesc"
  | "interestAsc"
  | "profitDesc"
  | "profitAsc"
  | "holdingDesc"
  | "newest"
  | "oldest"
  | "investmentDesc"
  | "chargesDesc"
  | "netProfitDesc"
  | "netProfitAsc";

export interface MtfFilterState {
  status: "All" | "Open" | "Closed";
  brokerId: string; // "all" or a broker id
  query: string;
  sort: MtfSortKey;
}

export const DEFAULT_MTF_FILTERS: MtfFilterState = {
  status: "All",
  brokerId: "all",
  query: "",
  sort: "newest",
};

const SORT_OPTIONS: { value: MtfSortKey; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "interestDesc", label: "Highest interest" },
  { value: "interestAsc", label: "Lowest interest" },
  { value: "netProfitDesc", label: "Highest net profit" },
  { value: "netProfitAsc", label: "Lowest net profit" },
  { value: "profitDesc", label: "Highest gross profit" },
  { value: "profitAsc", label: "Lowest gross profit" },
  { value: "holdingDesc", label: "Longest holding" },
  { value: "investmentDesc", label: "Largest investment" },
  { value: "chargesDesc", label: "Largest charges" },
];

// Chips rank by NET profit (after interest + charges) to match the "Highest
// Profit / Loss" standout tiles in Portfolio analytics.
const QUICK_CHIPS: { label: string; sort: MtfSortKey }[] = [
  { label: "Highest Profit", sort: "netProfitDesc" },
  { label: "Highest Loss", sort: "netProfitAsc" },
  { label: "Longest Holding", sort: "holdingDesc" },
  { label: "Most Interest", sort: "interestDesc" },
];

/** Pure: query/status/broker filter + all sorts. Never mutates the input. */
export function applyFilterSort(
  computed: ComputedPosition[],
  f: MtfFilterState,
): ComputedPosition[] {
  const q = f.query.trim().toLowerCase();
  const filtered = computed.filter((cp) => {
    if (f.status !== "All" && cp.pos.status !== f.status) return false;
    if (f.brokerId !== "all" && cp.pos.brokerId !== f.brokerId) return false;
    if (q) {
      const hay = `${cp.pos.stockName} ${cp.pos.symbol} ${cp.pos.notes ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const boughtAt = (cp: ComputedPosition) => new Date(cp.pos.purchaseDate).getTime();
  const sorted = [...filtered];
  switch (f.sort) {
    case "newest":
      sorted.sort((a, b) => boughtAt(b) - boughtAt(a));
      break;
    case "oldest":
      sorted.sort((a, b) => boughtAt(a) - boughtAt(b));
      break;
    case "interestDesc":
      sorted.sort((a, b) => b.accumulatedInterest - a.accumulatedInterest);
      break;
    case "interestAsc":
      sorted.sort((a, b) => a.accumulatedInterest - b.accumulatedInterest);
      break;
    case "profitDesc":
      sorted.sort((a, b) => b.grossProfit - a.grossProfit);
      break;
    case "profitAsc":
      sorted.sort((a, b) => a.grossProfit - b.grossProfit);
      break;
    case "holdingDesc":
      sorted.sort((a, b) => b.holdingDays - a.holdingDays);
      break;
    case "investmentDesc":
      sorted.sort((a, b) => b.totalInvestment - a.totalInvestment);
      break;
    case "chargesDesc":
      sorted.sort((a, b) => b.totalCharges - a.totalCharges);
      break;
    case "netProfitDesc":
      sorted.sort((a, b) => b.netProfit - a.netProfit);
      break;
    case "netProfitAsc":
      sorted.sort((a, b) => a.netProfit - b.netProfit);
      break;
  }
  return sorted;
}

interface BarSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  children: ReactNode;
  /** dims the control while it sits on its default value */
  active: boolean;
}

/** Compact select with its own chevron (the shared Select is appearance-none). */
function BarSelect({ label, active, children, className = "", ...rest }: BarSelectProps) {
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

export function FilterSortBar({
  value,
  onChange,
  brokers,
}: {
  value: MtfFilterState;
  onChange: (v: MtfFilterState) => void;
  brokers: MtfBroker[];
}) {
  const patch = (p: Partial<MtfFilterState>) => onChange({ ...value, ...p });
  const isDefault =
    value.query.trim() === "" &&
    value.status === DEFAULT_MTF_FILTERS.status &&
    value.brokerId === DEFAULT_MTF_FILTERS.brokerId &&
    value.sort === DEFAULT_MTF_FILTERS.sort;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-64">
        <Search
          size={14}
          aria-hidden
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint"
        />
        <Input
          type="search"
          value={value.query}
          onChange={(e) => patch({ query: e.target.value })}
          placeholder="Search stock, symbol, notes…"
          aria-label="Search positions by stock, symbol or notes"
          className="h-8 py-0 pl-8 text-[12px]"
        />
      </div>

      <BarSelect
        label="Filter by status"
        active={value.status !== "All"}
        value={value.status}
        onChange={(e) => patch({ status: e.target.value as MtfFilterState["status"] })}
      >
        <option value="All">All</option>
        <option value="Open">Open</option>
        <option value="Closed">Closed</option>
      </BarSelect>

      <BarSelect
        label="Filter by broker"
        active={value.brokerId !== "all"}
        value={value.brokerId}
        onChange={(e) => patch({ brokerId: e.target.value })}
      >
        <option value="all">All brokers</option>
        {brokers.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </BarSelect>

      <BarSelect
        label="Sort positions"
        active={value.sort !== DEFAULT_MTF_FILTERS.sort}
        value={value.sort}
        onChange={(e) => patch({ sort: e.target.value as MtfSortKey })}
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </BarSelect>

      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Quick sorts">
        {QUICK_CHIPS.map((chip) => {
          const active = value.sort === chip.sort;
          return (
            <button
              key={chip.sort}
              type="button"
              aria-pressed={active}
              onClick={() =>
                patch({ sort: active ? DEFAULT_MTF_FILTERS.sort : chip.sort })
              }
              className={`h-7 cursor-pointer rounded-full border px-2.5 text-[11px] font-medium whitespace-nowrap transition-colors ${
                active
                  ? "border-accent/40 bg-accent-soft text-accent"
                  : "border-edge bg-transparent text-muted hover:bg-raised hover:text-ink"
              }`}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {!isDefault && (
        <Button
          variant="ghost"
          size="sm"
          icon={FilterX}
          onClick={() => onChange({ ...DEFAULT_MTF_FILTERS })}
        >
          Clear
        </Button>
      )}
    </div>
  );
}
