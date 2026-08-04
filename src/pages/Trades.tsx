/** THE TRADE LOG — filterable, sortable, selectable table over every execution
 *  in the global scope, with CSV import/export and a full detail drawer. */

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Download, Plus, SearchX, Trash2, Upload } from "lucide-react";
import type { Trade } from "@/types";
import { useStore } from "@/store/useStore";
import { useFilteredTrades } from "@/store/useFilteredTrades";
import { downloadFile, toCsv } from "@/lib/csv";
import { formatDate, formatMoney, formatNumber, formatR, pnlClass } from "@/lib/format";
import { toast } from "@/store/toast";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge, DirectionBadge, StatusBadge } from "@/components/ui/Badge";
import { TableShell, TH, TD, rowClass } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { DEFAULT_TRADE_FILTERS, FilterToolbar, type TradeFilters } from "./trades/FilterToolbar";
import { TradeDetailDrawer } from "./trades/TradeDetailDrawer";
import { parseTradesCsv } from "./trades/importCsv";

const PAGE_SIZE = 15;

type SortKey = "date" | "symbol" | "qty" | "entry" | "exit" | "gross" | "charges" | "net" | "tax" | "r";

interface SortState {
  key: SortKey;
  dir: "asc" | "desc";
}

function sortValue(t: Trade, key: SortKey): number | string {
  switch (key) {
    case "date":
      return new Date(t.closedAt ?? t.openedAt).getTime();
    case "symbol":
      return t.symbol;
    case "qty":
      return t.quantity;
    case "entry":
      return t.entryPrice;
    case "exit":
      return t.exitPrice ?? Number.NEGATIVE_INFINITY;
    case "gross":
      return t.status === "Closed" ? t.grossPnl : Number.NEGATIVE_INFINITY;
    case "charges":
      return t.charges.total;
    case "net":
      return t.status === "Closed" ? t.netPnl : Number.NEGATIVE_INFINITY;
    case "tax":
      return t.tax.estimatedTax;
    case "r":
      return t.rMultiple ?? Number.NEGATIVE_INFINITY;
  }
}

interface SortHeaderProps {
  label: string;
  k: SortKey;
  sort: SortState;
  onSort: (key: SortKey) => void;
  numeric?: boolean;
}

function SortHeader({ label, k, sort, onSort, numeric = false }: SortHeaderProps) {
  const active = sort.key === k;
  return (
    <TH aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined} className={numeric ? "text-right" : ""}>
      <button
        type="button"
        onClick={() => onSort(k)}
        className={`group inline-flex cursor-pointer items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors ${
          active ? "text-ink" : "text-muted hover:text-ink"
        } ${numeric ? "flex-row-reverse" : ""}`}
      >
        {label}
        <span
          aria-hidden
          className={`text-[9px] leading-none ${active ? "text-accent" : "text-faint opacity-0 transition-opacity group-hover:opacity-70"}`}
        >
          {active && sort.dir === "asc" ? "▲" : "▼"}
        </span>
      </button>
    </TH>
  );
}

/* label styled to match the outline Button (a real <button> can't wrap a file input) */
const IMPORT_LABEL_CLASS =
  "inline-flex h-9 cursor-pointer select-none items-center justify-center gap-2 rounded-[10px] border border-edge bg-transparent px-4 text-[13px] font-medium text-ink transition-colors duration-150 hover:border-[#333945] hover:bg-raised focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent";

export default function Trades() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const scoped = useFilteredTrades();
  const allTrades = useStore((s) => s.trades);
  const accounts = useStore((s) => s.accounts);
  const settings = useStore((s) => s.settings);
  const globalAccountId = useStore((s) => s.filters.accountId);
  const importTradesAction = useStore((s) => s.importTrades);
  const deleteTradesAction = useStore((s) => s.deleteTrades);

  const [filters, setFilters] = useState<TradeFilters>(DEFAULT_TRADE_FILTERS);
  const [sort, setSort] = useState<SortState>({ key: "date", dir: "desc" });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  /* ── facet options from the scoped data ─────────────────────────── */
  const strategies = useMemo(
    () => Array.from(new Set(scoped.map((t) => t.strategy))).sort((a, b) => a.localeCompare(b)),
    [scoped],
  );
  const tags = useMemo(
    () => Array.from(new Set(scoped.flatMap((t) => t.tags))).sort((a, b) => a.localeCompare(b)),
    [scoped],
  );

  /* ── local filtering + sorting + paging ─────────────────────────── */
  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return scoped.filter((t) => {
      if (
        q &&
        !t.symbol.toLowerCase().includes(q) &&
        !t.strategy.toLowerCase().includes(q) &&
        !t.tags.some((tag) => tag.toLowerCase().includes(q))
      ) {
        return false;
      }
      if (filters.assetClass !== "all" && t.assetClass !== filters.assetClass) return false;
      if (filters.direction !== "all" && t.direction !== filters.direction) return false;
      if (filters.strategy !== "all" && t.strategy !== filters.strategy) return false;
      if (filters.tag !== "all" && !t.tags.includes(filters.tag)) return false;
      if (filters.result !== "all") {
        if (t.status !== "Closed") return false;
        if (filters.result === "win" && t.netPnl <= 0) return false;
        if (filters.result === "loss" && t.netPnl >= 0) return false;
        if (filters.result === "be" && t.netPnl !== 0) return false;
      }
      if (filters.status !== "all" && t.status !== filters.status) return false;
      return true;
    });
  }, [scoped, filters]);

  const sorted = useMemo(() => {
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const va = sortValue(a, sort.key);
      const vb = sortValue(b, sort.key);
      if (typeof va === "string" && typeof vb === "string") return va.localeCompare(vb) * dir;
      const na = va as number;
      const nb = vb as number;
      if (na === nb) return 0;
      return (na < nb ? -1 : 1) * dir;
    });
  }, [filtered, sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [filters, sort]);

  /* keep the selection limited to rows that still pass the filters */
  useEffect(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev;
      const visible = new Set(filtered.map((t) => t.id));
      const next = new Set<string>();
      let changed = false;
      prev.forEach((id) => {
        if (visible.has(id)) next.add(id);
        else changed = true;
      });
      return changed ? next : prev;
    });
  }, [filtered]);

  /* ── selection ──────────────────────────────────────────────────── */
  const pageIds = pageRows.map((t) => t.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const somePageSelected = pageIds.some((id) => selected.has(id));

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allPageSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  };

  /* ── detail drawer via ?highlight=<id> ──────────────────────────── */
  const highlightId = searchParams.get("highlight");
  const drawerTrade = useMemo(
    () => (highlightId ? (allTrades.find((t) => t.id === highlightId) ?? null) : null),
    [highlightId, allTrades],
  );

  const openDrawer = (id: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("highlight", id);
    setSearchParams(next, { replace: true });
  };

  const closeDrawer = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("highlight");
    setSearchParams(next, { replace: true });
  };

  /* drop a stale ?highlight (deleted trade / unknown id) */
  useEffect(() => {
    if (highlightId && !drawerTrade) {
      const next = new URLSearchParams(searchParams);
      next.delete("highlight");
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightId, drawerTrade]);

  /* ── CSV export / import ────────────────────────────────────────── */
  const handleExport = () => {
    if (sorted.length === 0) {
      toast("No trades to export in the current view", "info");
      return;
    }
    const headers = [
      "date",
      "symbol",
      "assetClass",
      "direction",
      "qty",
      "entry",
      "exit",
      "grossPnl",
      "charges",
      "netPnl",
      "estimatedTax",
      "rMultiple",
      "strategy",
      "tags",
      "status",
    ];
    const rows = sorted.map((t) => [
      (t.closedAt ?? t.openedAt).slice(0, 10),
      t.symbol,
      t.assetClass,
      t.direction,
      t.quantity,
      t.entryPrice,
      t.exitPrice,
      t.grossPnl,
      t.charges.total,
      t.netPnl,
      t.tax.estimatedTax,
      t.rMultiple,
      t.strategy,
      t.tags.join("; "),
      t.status,
    ]);
    downloadFile(`ledgerx-trades-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(headers, rows));
    toast(`Exported ${sorted.length} trade${sorted.length === 1 ? "" : "s"} to CSV`);
  };

  const handleImport = (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      input.value = "";
      try {
        const parsed = parseTradesCsv(String(reader.result ?? ""), {
          existing: allTrades,
          accounts,
          accountId: globalAccountId,
          settings,
        });
        importTradesAction(parsed);
        toast(`Imported ${parsed.length} trade${parsed.length === 1 ? "" : "s"} from ${file.name}`);
      } catch (err) {
        toast(err instanceof Error ? err.message : "Could not parse that CSV file", "error");
      }
    };
    reader.onerror = () => {
      input.value = "";
      toast("Could not read that file", "error");
    };
    reader.readAsText(file);
  };

  /* ── bulk delete ────────────────────────────────────────────────── */
  const confirmBulkDelete = () => {
    const ids = Array.from(selected);
    deleteTradesAction(ids);
    setSelected(new Set());
    setBulkDeleteOpen(false);
    toast(`Deleted ${ids.length} trade${ids.length === 1 ? "" : "s"}`);
  };

  const handleSort = (key: SortKey) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "symbol" ? "asc" : "desc" },
    );
  };

  const rangeStart = sorted.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(safePage * PAGE_SIZE, sorted.length);

  return (
    <div className="animate-in">
      <PageHeader
        title="Trades"
        description="Every execution in the current scope — filter, inspect, export."
        actions={
          <>
            <label className={IMPORT_LABEL_CLASS}>
              <Upload size={15} aria-hidden />
              Import CSV
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={handleImport}
                aria-label="Import trades from a CSV file"
              />
            </label>
            <Button variant="outline" icon={Download} onClick={handleExport}>
              Export CSV
            </Button>
            <Button variant="primary" icon={Plus} onClick={() => navigate("/trades/new")}>
              Add trade
            </Button>
          </>
        }
      />

      <FilterToolbar
        filters={filters}
        onChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
        onClear={() => setFilters(DEFAULT_TRADE_FILTERS)}
        strategies={strategies}
        tags={tags}
        shown={sorted.length}
        total={scoped.length}
      />

      {selected.size > 0 && (
        <div className="animate-in mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-accent/40 bg-accent-soft px-4 py-2">
          <span className="text-[13px] font-medium text-ink">
            <span className="tnum">{selected.size}</span> selected
          </span>
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
            Clear selection
          </Button>
          <Button variant="danger" size="sm" icon={Trash2} className="ml-auto" onClick={() => setBulkDeleteOpen(true)}>
            Delete
          </Button>
        </div>
      )}

      <div className="card overflow-hidden">
        {sorted.length === 0 ? (
          scoped.length === 0 ? (
            <EmptyState
              title="No trades in this range"
              hint="Widen the global date range or account filter in the top bar, or log your first trade."
              action={
                <Button variant="primary" icon={Plus} onClick={() => navigate("/trades/new")}>
                  Add trade
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={SearchX}
              title="No trades match your filters"
              hint="Try loosening the search or clearing a facet — the trades are still there."
              action={
                <Button variant="outline" onClick={() => setFilters(DEFAULT_TRADE_FILTERS)}>
                  Clear filters
                </Button>
              }
            />
          )
        ) : (
          <>
            <TableShell>
              <thead>
                <tr>
                  <TH className="w-8">
                    <input
                      type="checkbox"
                      ref={(el) => {
                        if (el) el.indeterminate = somePageSelected && !allPageSelected;
                      }}
                      checked={allPageSelected}
                      onChange={toggleSelectAllVisible}
                      aria-label="Select all trades on this page"
                      className="size-3.5 cursor-pointer align-middle accent-accent"
                    />
                  </TH>
                  <SortHeader label="Date" k="date" sort={sort} onSort={handleSort} />
                  <SortHeader label="Symbol" k="symbol" sort={sort} onSort={handleSort} />
                  <TH>Direction</TH>
                  <SortHeader label="Qty" k="qty" sort={sort} onSort={handleSort} numeric />
                  <SortHeader label="Entry" k="entry" sort={sort} onSort={handleSort} numeric />
                  <SortHeader label="Exit" k="exit" sort={sort} onSort={handleSort} numeric />
                  <SortHeader label="Gross P&L" k="gross" sort={sort} onSort={handleSort} numeric />
                  <SortHeader label="Charges" k="charges" sort={sort} onSort={handleSort} numeric />
                  <SortHeader label="Net P&L" k="net" sort={sort} onSort={handleSort} numeric />
                  <SortHeader label="Tax" k="tax" sort={sort} onSort={handleSort} numeric />
                  <SortHeader label="R" k="r" sort={sort} onSort={handleSort} numeric />
                  <TH>Strategy</TH>
                  <TH>Tags</TH>
                  <TH>Status</TH>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((t) => {
                  const closed = t.status === "Closed";
                  const isSelected = selected.has(t.id);
                  return (
                    <tr
                      key={t.id}
                      className={`${rowClass} ${isSelected ? "bg-accent-soft/50" : ""}`}
                      onClick={() => openDrawer(t.id)}
                    >
                      <TD onClick={(e) => e.stopPropagation()} className="w-8">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(t.id)}
                          aria-label={`Select ${t.symbol} trade ${t.id}`}
                          className="size-3.5 cursor-pointer align-middle accent-accent"
                        />
                      </TD>
                      <TD className="text-muted">{formatDate(t.closedAt ?? t.openedAt)}</TD>
                      <TD>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openDrawer(t.id);
                            }}
                            aria-label={`Open details for ${t.symbol} trade ${t.id}`}
                            className="cursor-pointer font-medium text-ink transition-colors hover:text-accent"
                          >
                            {t.symbol}
                          </button>
                          <Badge tone="neutral">{t.assetClass}</Badge>
                        </div>
                      </TD>
                      <TD>
                        <DirectionBadge direction={t.direction} />
                      </TD>
                      <TD className="tnum text-right">{formatNumber(t.quantity, t.quantity % 1 !== 0 ? 4 : 0)}</TD>
                      <TD className="tnum text-right">{formatMoney(t.entryPrice, { decimals: true })}</TD>
                      <TD className="tnum text-right">
                        {t.exitPrice !== undefined ? formatMoney(t.exitPrice, { decimals: true }) : "—"}
                      </TD>
                      <TD className={`tnum text-right ${closed ? pnlClass(t.grossPnl) : "text-faint"}`}>
                        {closed ? formatMoney(t.grossPnl, { sign: true }) : "—"}
                      </TD>
                      <TD className={`tnum text-right ${closed ? "text-muted" : "text-faint"}`}>
                        {closed ? formatMoney(t.charges.total) : "—"}
                      </TD>
                      <TD className={`tnum text-right font-semibold ${closed ? pnlClass(t.netPnl) : "text-faint"}`}>
                        {closed ? formatMoney(t.netPnl, { sign: true }) : "—"}
                      </TD>
                      <TD className={`tnum text-right ${closed ? "text-muted" : "text-faint"}`}>
                        {closed ? formatMoney(t.tax.estimatedTax) : "—"}
                      </TD>
                      <TD className={`tnum text-right ${t.rMultiple !== undefined ? pnlClass(t.rMultiple) : "text-faint"}`}>
                        {formatR(t.rMultiple)}
                      </TD>
                      <TD className="max-w-[160px] truncate text-muted">{t.strategy}</TD>
                      <TD>
                        {t.tags.length === 0 ? (
                          <span className="text-faint">—</span>
                        ) : (
                          <div className="flex items-center gap-1">
                            {t.tags.slice(0, 2).map((tag) => (
                              <Badge key={tag} tone="neutral">
                                {tag}
                              </Badge>
                            ))}
                            {t.tags.length > 2 && (
                              <span className="text-[11px] text-faint" title={t.tags.slice(2).join(", ")}>
                                +{t.tags.length - 2}
                              </span>
                            )}
                          </div>
                        )}
                      </TD>
                      <TD>
                        <StatusBadge status={t.status} />
                      </TD>
                    </tr>
                  );
                })}
              </tbody>
            </TableShell>

            <footer className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <p className="text-[12px] text-muted">
                Showing{" "}
                <span className="tnum text-ink">
                  {rangeStart}–{rangeEnd}
                </span>{" "}
                of <span className="tnum">{sorted.length}</span> trades
              </p>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={ChevronLeft}
                  onClick={() => setPage(safePage - 1)}
                  disabled={safePage <= 1}
                  aria-label="Previous page"
                >
                  Prev
                </Button>
                <span className="tnum px-1 text-[12px] text-muted">
                  Page {safePage} of {pageCount}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage(safePage + 1)}
                  disabled={safePage >= pageCount}
                  aria-label="Next page"
                >
                  Next
                  <ChevronRight size={14} aria-hidden />
                </Button>
              </div>
            </footer>
          </>
        )}
      </div>

      <TradeDetailDrawer key={drawerTrade?.id ?? "closed"} trade={drawerTrade} onClose={closeDrawer} />

      <Modal
        open={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        title={`Delete ${selected.size} trade${selected.size === 1 ? "" : "s"}`}
        widthClass="max-w-sm"
      >
        <p className="text-[13px] leading-relaxed text-muted">
          This permanently removes <span className="tnum font-medium text-ink">{selected.size}</span> selected trade
          {selected.size === 1 ? "" : "s"} from your journal. This can't be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setBulkDeleteOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" icon={Trash2} onClick={confirmBulkDelete}>
            Delete trades
          </Button>
        </div>
      </Modal>
    </div>
  );
}
