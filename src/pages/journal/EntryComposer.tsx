/** Journal entry composer — one Modal reused for both "New entry" and "Edit entry". */

import { useEffect, useMemo, useState } from "react";
import { Link2, Search, X } from "lucide-react";
import type { JournalEntry, Mood, Trade } from "@/types";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { StatusBadge } from "@/components/ui/Badge";
import { formatDateShort, formatMoney, pnlClass } from "@/lib/format";
import { MOOD_META, MOOD_ORDER } from "./moods";

export const MAX_LINKED_TRADES = 5;

export interface EntryDraft {
  title: string;
  date: string; // yyyy-MM-dd
  mood: Mood;
  content: string;
  linkedTradeIds: string[];
}

interface EntryComposerProps {
  open: boolean;
  /** entry being edited, or null when composing a new one */
  entry: JournalEntry | null;
  trades: Trade[];
  /** default date for new entries (latest dataset date, yyyy-MM-dd) */
  defaultDate: string;
  onClose: () => void;
  onSave: (draft: EntryDraft) => void;
}

export function EntryComposer({ open, entry, trades, defaultDate, onClose, onSave }: EntryComposerProps) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [mood, setMood] = useState<Mood>("neutral");
  const [content, setContent] = useState("");
  const [linkedIds, setLinkedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // (Re)initialise the form each time the modal opens.
  useEffect(() => {
    if (!open) return;
    setTitle(entry?.title ?? "");
    setDate(entry ? entry.date.slice(0, 10) : defaultDate);
    setMood(entry?.mood ?? "neutral");
    setContent(entry?.content ?? "");
    setLinkedIds(entry ? entry.linkedTradeIds.slice(0, MAX_LINKED_TRADES) : []);
    setSearch("");
    setSubmitted(false);
  }, [open, entry, defaultDate]);

  const tradesById = useMemo(() => {
    const map = new Map<string, Trade>();
    for (const t of trades) map.set(t.id, t);
    return map;
  }, [trades]);

  const query = search.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!query) return [];
    return trades
      .filter(
        (t) =>
          !linkedIds.includes(t.id) &&
          (t.symbol.toLowerCase().includes(query) || t.id.toLowerCase().includes(query)),
      )
      .sort((a, b) => b.openedAt.localeCompare(a.openedAt))
      .slice(0, 8);
  }, [trades, query, linkedIds]);

  const atMax = linkedIds.length >= MAX_LINKED_TRADES;

  const addLink = (id: string) => {
    setLinkedIds((prev) => (prev.includes(id) || prev.length >= MAX_LINKED_TRADES ? prev : [...prev, id]));
    setSearch("");
  };
  const removeLink = (id: string) => setLinkedIds((prev) => prev.filter((x) => x !== id));

  const titleError = submitted && title.trim().length === 0 ? "Give the entry a title." : undefined;
  const dateError = submitted && date.length === 0 ? "Pick a date." : undefined;
  const contentError = submitted && content.trim().length === 0 ? "Write the reflection itself." : undefined;

  const handleSubmit = () => {
    if (title.trim().length === 0 || content.trim().length === 0 || date.length === 0) {
      setSubmitted(true);
      return;
    }
    onSave({
      title: title.trim(),
      date,
      mood,
      content: content.trim(),
      linkedTradeIds: linkedIds,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={entry ? "Edit journal entry" : "New journal entry"}
      widthClass="max-w-2xl"
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        noValidate
      >
        <Field label="Title" required error={titleError}>
          {(id) => (
            <Input
              id={id}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Expiry week review"
              autoFocus
              maxLength={120}
            />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date" required error={dateError}>
            {(id) => <Input id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
          </Field>
          <Field label="Mood">
            {(id) => (
              <Select id={id} value={mood} onChange={(e) => setMood(e.target.value as Mood)}>
                {MOOD_ORDER.map((m) => (
                  <option key={m} value={m}>
                    {MOOD_META[m].label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <Field label="Reflection" required error={contentError} hint="Blank lines split the text into paragraphs.">
          {(id) => (
            <Textarea
              id={id}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What worked, what didn't, and how you felt while trading…"
              className="min-h-[200px]"
            />
          )}
        </Field>

        {/* ── Linked trades ─────────────────────────────────────── */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[12px] font-medium text-muted">
              <Link2 size={13} aria-hidden />
              Linked trades
            </span>
            <span className="tnum text-[11px] text-faint">
              {linkedIds.length}/{MAX_LINKED_TRADES}
            </span>
          </div>

          {linkedIds.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {linkedIds.map((id) => {
                const t = tradesById.get(id);
                return (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-edge bg-raised px-2 py-1 text-[11px] font-medium text-ink"
                  >
                    <span>{t ? t.symbol : id}</span>
                    {t && <span className="font-mono text-[10px] text-faint">{t.id}</span>}
                    <button
                      type="button"
                      onClick={() => removeLink(id)}
                      aria-label={`Unlink trade ${t ? `${t.symbol} ${t.id}` : id}`}
                      className="rounded p-0.5 text-muted transition-colors hover:bg-loss-soft hover:text-loss"
                    >
                      <X size={11} aria-hidden />
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          <div className="relative">
            <Search
              size={13}
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const first = matches[0];
                  if (first && !atMax) addLink(first.id);
                }
              }}
              disabled={atMax}
              placeholder={atMax ? "Maximum trades linked" : "Search trades by symbol or ID…"}
              aria-label="Search trades to link"
              className="pl-8"
            />
          </div>
          {atMax && (
            <p className="mt-1 text-[11px] text-faint">
              Up to {MAX_LINKED_TRADES} trades per entry — unlink one to add another.
            </p>
          )}

          {query.length > 0 && !atMax && (
            <div className="mt-1.5 max-h-44 overflow-y-auto rounded-xl border border-edge bg-raised p-1">
              {matches.length === 0 ? (
                <p className="px-2.5 py-2 text-[12px] text-faint">No trades match “{search.trim()}”.</p>
              ) : (
                matches.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => addLink(t.id)}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12px] transition-colors hover:bg-white/5"
                  >
                    <span className="font-medium text-ink">{t.symbol}</span>
                    <span className="font-mono text-[10px] text-faint">{t.id}</span>
                    <span className="ml-auto flex shrink-0 items-center gap-2">
                      <span className="text-[11px] text-faint">{formatDateShort(t.openedAt)}</span>
                      {t.status === "Closed" ? (
                        <span className={`tnum text-[11px] font-medium ${pnlClass(t.netPnl)}`}>
                          {formatMoney(t.netPnl, { compact: true, sign: true })}
                        </span>
                      ) : (
                        <StatusBadge status={t.status} />
                      )}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-edge-soft pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            {entry ? "Save changes" : "Add entry"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
