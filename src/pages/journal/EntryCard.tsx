/** One timeline entry: mood-dot rail + card with title, mood badge, kebab actions,
 *  paragraph content and linked-trade chips. */

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import type { JournalEntry, Trade } from "@/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatDate, formatMoney, pnlClass } from "@/lib/format";
import { MOOD_META } from "./moods";

interface EntryCardProps {
  entry: JournalEntry;
  tradesById: Map<string, Trade>;
  /** draw the connecting hairline below the mood dot (all but the last entry of a group) */
  showLine: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export function EntryCard({ entry, tradesById, showLine, onEdit, onDelete }: EntryCardProps) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const mood = MOOD_META[entry.mood];

  // Close the kebab menu on Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const linkedTrades = useMemo(
    () =>
      entry.linkedTradeIds
        .map((id) => tradesById.get(id))
        .filter((t): t is Trade => t !== undefined),
    [entry.linkedTradeIds, tradesById],
  );

  const paragraphs = useMemo(
    () =>
      entry.content
        .split("\n")
        .map((p) => p.trim())
        .filter((p) => p.length > 0),
    [entry.content],
  );

  return (
    <div className="flex">
      {/* ── left rail: mood dot + connecting hairline ── */}
      <div className="mr-3 flex w-4 shrink-0 flex-col items-center sm:mr-4" aria-hidden>
        <span className={`mt-[25px] h-2.5 w-2.5 shrink-0 rounded-full ${mood.dot}`} />
        {showLine && <span className="mt-2 w-px flex-1 bg-edge-soft" />}
      </div>

      <div className={`min-w-0 flex-1 ${showLine ? "pb-4" : ""}`}>
        <Card className="animate-in">
          {/* header */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-[14px] font-semibold leading-tight text-ink">{entry.title}</h3>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span className="text-[12px] text-muted">{formatDate(entry.date)}</span>
                <Badge tone={mood.tone}>
                  <span className={`h-1.5 w-1.5 rounded-full ${mood.dot}`} aria-hidden />
                  {mood.label}
                </Badge>
              </div>
            </div>

            {/* kebab actions */}
            <div className="relative shrink-0">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                aria-label={`Actions for entry “${entry.title}”`}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className="rounded-lg p-1.5 text-muted transition-colors hover:bg-raised hover:text-ink"
              >
                <MoreHorizontal size={16} aria-hidden />
              </button>
              {menuOpen && (
                <>
                  <button
                    aria-label="Close menu"
                    className="fixed inset-0 z-10 cursor-default"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div
                    role="menu"
                    aria-label="Entry actions"
                    className="animate-pop absolute right-0 top-full z-20 mt-1 w-40 rounded-xl border border-edge bg-raised p-1 shadow-[var(--shadow-pop)]"
                  >
                    <button
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        onEdit();
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12px] text-ink transition-colors hover:bg-white/5"
                    >
                      <Pencil size={13} aria-hidden />
                      Edit entry
                    </button>
                    <button
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        onDelete();
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12px] text-loss transition-colors hover:bg-loss-soft"
                    >
                      <Trash2 size={13} aria-hidden />
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* content */}
          <div className="mt-3 max-w-prose space-y-2">
            {paragraphs.map((p, i) => (
              <p key={i} className="text-[13px] leading-relaxed text-muted">
                {p}
              </p>
            ))}
          </div>

          {/* linked trade chips */}
          {linkedTrades.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-edge-soft pt-3">
              <span className="label-caps mr-1">Trades</span>
              {linkedTrades.map((t) => (
                <button
                  key={t.id}
                  onClick={() => navigate(`/trades?highlight=${t.id}`)}
                  aria-label={`Open trade ${t.symbol} ${t.id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-edge bg-raised px-2 py-1 text-[11px] font-medium text-ink transition-colors duration-150 hover:border-accent/50 hover:bg-accent-soft"
                >
                  <span>{t.symbol}</span>
                  {t.status === "Closed" ? (
                    <span className={`tnum ${pnlClass(t.netPnl)}`}>
                      {formatMoney(t.netPnl, { compact: true, sign: true })}
                    </span>
                  ) : (
                    <span className="text-faint">{t.status}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
