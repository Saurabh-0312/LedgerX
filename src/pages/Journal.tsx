/** Journal — timeline of daily/weekly reflections with moods and linked trades. */

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { NotebookPen, Plus, SearchX, Trash2 } from "lucide-react";
import type { JournalEntry, Mood } from "@/types";
import { useStore } from "@/store/useStore";
import { datasetToday } from "@/store/useFilteredTrades";
import { toast } from "@/store/toast";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { EntryCard } from "./journal/EntryCard";
import { EntryComposer, type EntryDraft } from "./journal/EntryComposer";
import { MOOD_META, MOOD_ORDER } from "./journal/moods";

/** Next sequential journal id, e.g. "J-13" (matches the sample "J-01" format). */
function nextJournalId(journal: JournalEntry[]): string {
  const max = journal.reduce((m, e) => {
    const n = Number(e.id.replace(/\D/g, ""));
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 0);
  return `J-${String(max + 1).padStart(2, "0")}`;
}

type MoodFilter = Mood | "all";

interface MonthGroup {
  key: string; // "2026-03"
  label: string; // "March 2026"
  entries: JournalEntry[];
}

export default function Journal() {
  const journal = useStore((s) => s.journal);
  const trades = useStore((s) => s.trades);
  const addJournalEntry = useStore((s) => s.addJournalEntry);
  const updateJournalEntry = useStore((s) => s.updateJournalEntry);
  const deleteJournalEntry = useStore((s) => s.deleteJournalEntry);

  const [moodFilter, setMoodFilter] = useState<MoodFilter>("all");
  const [composerOpen, setComposerOpen] = useState(false);
  const [editing, setEditing] = useState<JournalEntry | null>(null);
  const [pendingDelete, setPendingDelete] = useState<JournalEntry | null>(null);

  const tradesById = useMemo(() => {
    const map = new Map<string, (typeof trades)[number]>();
    for (const t of trades) map.set(t.id, t);
    return map;
  }, [trades]);

  const defaultDate = useMemo(() => format(datasetToday(trades), "yyyy-MM-dd"), [trades]);

  const moodCounts = useMemo(() => {
    const counts: Record<Mood, number> = { great: 0, good: 0, neutral: 0, bad: 0, terrible: 0 };
    for (const e of journal) counts[e.mood] += 1;
    return counts;
  }, [journal]);

  const groups = useMemo<MonthGroup[]>(() => {
    const sorted = journal
      .filter((e) => moodFilter === "all" || e.mood === moodFilter)
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
    const out: MonthGroup[] = [];
    for (const e of sorted) {
      const key = e.date.slice(0, 7);
      const last = out[out.length - 1];
      if (last && last.key === key) {
        last.entries.push(e);
      } else {
        out.push({ key, label: format(new Date(`${key}-01T00:00:00`), "MMMM yyyy"), entries: [e] });
      }
    }
    return out;
  }, [journal, moodFilter]);

  const openNew = () => {
    setEditing(null);
    setComposerOpen(true);
  };
  const openEdit = (entry: JournalEntry) => {
    setEditing(entry);
    setComposerOpen(true);
  };
  const closeComposer = () => {
    setComposerOpen(false);
    setEditing(null);
  };

  const handleSave = (draft: EntryDraft) => {
    if (editing) {
      updateJournalEntry(editing.id, draft);
      toast("Journal entry updated");
    } else {
      addJournalEntry({ id: nextJournalId(journal), ...draft });
      toast("Journal entry added");
    }
    closeComposer();
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    deleteJournalEntry(pendingDelete.id);
    toast("Journal entry deleted", "info");
    setPendingDelete(null);
  };

  return (
    <>
      <PageHeader
        title="Journal"
        description="Daily and weekly reflections, tied to the trades behind them."
        actions={
          <Button variant="primary" icon={Plus} onClick={openNew}>
            New entry
          </Button>
        }
      />

      {/* ── mood filter chips ─────────────────────────────────── */}
      <div className="mb-5 flex flex-wrap items-center gap-2" role="group" aria-label="Filter entries by mood">
        <button
          onClick={() => setMoodFilter("all")}
          aria-pressed={moodFilter === "all"}
          className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium transition-colors duration-150 ${
            moodFilter === "all"
              ? "border-accent/60 bg-accent-soft text-ink"
              : "border-edge bg-surface text-muted hover:bg-raised hover:text-ink"
          }`}
        >
          All
          <span className="tnum text-[11px] text-faint">{journal.length}</span>
        </button>
        {MOOD_ORDER.map((m) => {
          const meta = MOOD_META[m];
          const active = moodFilter === m;
          return (
            <button
              key={m}
              onClick={() => setMoodFilter(active ? "all" : m)}
              aria-pressed={active}
              className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium transition-colors duration-150 ${
                active
                  ? "border-accent/60 bg-accent-soft text-ink"
                  : "border-edge bg-surface text-muted hover:bg-raised hover:text-ink"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${meta.dot}`} aria-hidden />
              {meta.label}
              <span className="tnum text-[11px] text-faint">{moodCounts[m]}</span>
            </button>
          );
        })}
      </div>

      {/* ── timeline ──────────────────────────────────────────── */}
      {journal.length === 0 ? (
        <Card className="animate-in">
          <EmptyState
            icon={NotebookPen}
            title="Write your first reflection"
            hint="The journal is where the edge compounds — log what worked, what didn't, and how it felt."
            action={
              <Button variant="primary" icon={Plus} onClick={openNew}>
                New entry
              </Button>
            }
          />
        </Card>
      ) : groups.length === 0 ? (
        <Card className="animate-in">
          <EmptyState
            icon={SearchX}
            title={
              moodFilter === "all"
                ? "No entries yet"
                : `No “${MOOD_META[moodFilter].label.toLowerCase()}” entries`
            }
            hint="No reflections match this mood — try another filter."
            action={
              <Button variant="outline" size="sm" onClick={() => setMoodFilter("all")}>
                Clear filter
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="max-w-[860px] space-y-7">
          {groups.map((group) => (
            <section key={group.key} aria-label={group.label}>
              <div className="mb-3 flex items-center gap-3 pl-7 sm:pl-8">
                <h2 className="label-caps">{group.label}</h2>
                <span className="h-px flex-1 bg-edge-soft" aria-hidden />
                <span className="tnum text-[11px] text-faint">
                  {group.entries.length} {group.entries.length === 1 ? "entry" : "entries"}
                </span>
              </div>
              {group.entries.map((entry, i) => (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  tradesById={tradesById}
                  showLine={i < group.entries.length - 1}
                  onEdit={() => openEdit(entry)}
                  onDelete={() => setPendingDelete(entry)}
                />
              ))}
            </section>
          ))}
        </div>
      )}

      {/* ── composer (new + edit) ─────────────────────────────── */}
      <EntryComposer
        open={composerOpen}
        entry={editing}
        trades={trades}
        defaultDate={defaultDate}
        onClose={closeComposer}
        onSave={handleSave}
      />

      {/* ── delete confirm ────────────────────────────────────── */}
      <Modal
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="Delete journal entry"
        widthClass="max-w-sm"
      >
        <p className="text-[13px] leading-relaxed text-muted">
          Delete <span className="font-medium text-ink">“{pendingDelete?.title}”</span>? The reflection is removed
          permanently — linked trades are not affected.
        </p>
        <div className="mt-5 flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={() => setPendingDelete(null)}>
            Cancel
          </Button>
          <Button variant="danger" icon={Trash2} onClick={confirmDelete}>
            Delete entry
          </Button>
        </div>
      </Modal>
    </>
  );
}
