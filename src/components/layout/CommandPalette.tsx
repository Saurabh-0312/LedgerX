import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CornerDownLeft,
  Eye,
  FileDown,
  Landmark,
  LayoutDashboard,
  NotebookPen,
  PlusCircle,
  Receipt,
  Search,
  Settings,
  Table2,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import { formatDate, formatMoney, pnlClass } from "@/lib/format";

interface PaletteProps {
  open: boolean;
  onClose: () => void;
}

const PAGES = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/trades", label: "Trades", icon: Table2 },
  { to: "/trades/new", label: "Add Trade", icon: PlusCircle },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/charges", label: "Charges & Fees", icon: Receipt },
  { to: "/tax", label: "Tax Report", icon: Landmark },
  { to: "/goals", label: "Goals", icon: Target },
  { to: "/journal", label: "Journal", icon: NotebookPen },
  { to: "/accounts", label: "Accounts", icon: Wallet },
  { to: "/watchlist", label: "Watchlist", icon: Eye },
  { to: "/reports", label: "Reports", icon: FileDown },
  { to: "/settings", label: "Settings", icon: Settings },
];

/** Ctrl/Cmd+K palette: navigate pages + search trades by symbol/strategy/tag. */
export function CommandPalette({ open, onClose }: PaletteProps) {
  const navigate = useNavigate();
  const trades = useStore((s) => s.trades);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  const q = query.trim().toLowerCase();

  const pageHits = useMemo(
    () => (q ? PAGES.filter((p) => p.label.toLowerCase().includes(q)) : PAGES.slice(0, 6)),
    [q],
  );

  const tradeHits = useMemo(() => {
    if (!q) return [];
    return trades
      .filter(
        (t) =>
          t.symbol.toLowerCase().includes(q) ||
          t.strategy.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q)),
      )
      .slice(-8)
      .reverse();
  }, [q, trades]);

  const total = pageHits.length + tradeHits.length;

  useEffect(() => setActive(0), [q]);

  const go = (idx: number) => {
    if (idx < pageHits.length) {
      navigate(pageHits[idx].to);
    } else {
      const t = tradeHits[idx - pageHits.length];
      if (t) navigate(`/trades?highlight=${t.id}`);
    }
    onClose();
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => Math.min(total - 1, a + 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => Math.max(0, a - 1));
      }
      if (e.key === "Enter" && total > 0) {
        e.preventDefault();
        go(active);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active, total, pageHits, tradeHits]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Command palette">
      <button aria-label="Close" className="fixed inset-0 bg-black/60 backdrop-blur-[2px] cursor-default" onClick={onClose} />
      <div className="animate-pop glass-pop relative w-full max-w-[560px] overflow-hidden rounded-2xl">
        <div className="flex items-center gap-2.5 border-b border-edge px-4">
          <Search size={15} className="text-faint" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages, symbols, strategies, tags…"
            className="h-12 w-full bg-transparent text-[14px] text-ink placeholder:text-faint focus:outline-none"
            aria-label="Search"
          />
          <kbd className="rounded border border-edge bg-surface px-1.5 py-0.5 font-mono text-[10px] text-faint">esc</kbd>
        </div>

        <div ref={listRef} className="max-h-[380px] overflow-y-auto p-1.5">
          {total === 0 && <p className="px-3 py-8 text-center text-[13px] text-muted">No matches for “{query}”.</p>}

          {pageHits.length > 0 && (
            <>
              <div className="label-caps px-3 pb-1 pt-2">Pages</div>
              {pageHits.map((p, i) => (
                <button
                  key={p.to}
                  data-idx={i}
                  onClick={() => go(i)}
                  onMouseEnter={() => setActive(i)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] ${
                    active === i ? "bg-accent-soft text-ink" : "text-muted"
                  }`}
                >
                  <p.icon size={15} aria-hidden />
                  <span className="flex-1">{p.label}</span>
                  {active === i && <CornerDownLeft size={13} className="text-faint" aria-hidden />}
                </button>
              ))}
            </>
          )}

          {tradeHits.length > 0 && (
            <>
              <div className="label-caps px-3 pb-1 pt-3">Trades</div>
              {tradeHits.map((t, j) => {
                const i = pageHits.length + j;
                return (
                  <button
                    key={t.id}
                    data-idx={i}
                    onClick={() => go(i)}
                    onMouseEnter={() => setActive(i)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] ${
                      active === i ? "bg-accent-soft text-ink" : "text-muted"
                    }`}
                  >
                    {t.netPnl >= 0 ? (
                      <TrendingUp size={15} className="text-profit" aria-hidden />
                    ) : (
                      <TrendingDown size={15} className="text-loss" aria-hidden />
                    )}
                    <span className="font-medium text-ink">{t.symbol}</span>
                    <span className="text-[11px]">{t.strategy}</span>
                    <span className="ml-auto flex items-center gap-2">
                      <span className={`tnum text-[12px] font-medium ${pnlClass(t.netPnl)}`}>
                        {t.status === "Closed" ? formatMoney(t.netPnl, { sign: true, compact: true }) : t.status}
                      </span>
                      <span className="text-[11px] text-faint">{formatDate(t.openedAt)}</span>
                      <ArrowRight size={12} className="text-faint" aria-hidden />
                    </span>
                  </button>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
