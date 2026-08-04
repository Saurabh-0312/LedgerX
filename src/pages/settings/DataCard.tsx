/** Settings → Data management: export, import, reset sample data, clear all data. */

import { useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Download, RefreshCw, Trash2, Upload } from "lucide-react";
import type { Trade } from "@/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useStore } from "@/store/useStore";
import { toast } from "@/store/toast";
import { downloadFile } from "@/lib/csv";
import { formatNumber } from "@/lib/format";

/** Loose structural check — enough to keep the strict Trade shape honest on import. */
function isTradeLike(x: unknown): x is Trade {
  if (typeof x !== "object" || x === null) return false;
  const t = x as Record<string, unknown>;
  return (
    typeof t.id === "string" &&
    typeof t.accountId === "string" &&
    typeof t.symbol === "string" &&
    typeof t.status === "string" &&
    typeof t.quantity === "number" &&
    typeof t.entryPrice === "number" &&
    typeof t.openedAt === "string" &&
    typeof t.grossPnl === "number" &&
    typeof t.netPnl === "number" &&
    typeof t.charges === "object" &&
    t.charges !== null &&
    Array.isArray(t.tags)
  );
}

interface DataRowProps {
  icon: LucideIcon;
  title: string;
  description: string;
  danger?: boolean;
  action: ReactNode;
}

function DataRow({ icon: Icon, title, description, danger, action }: DataRowProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 py-4 first:pt-0 last:pb-0">
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
          danger ? "border-loss/30 bg-loss-soft" : "border-edge bg-raised"
        }`}
      >
        <Icon size={16} className={danger ? "text-loss" : "text-muted"} aria-hidden />
      </div>
      <div className="min-w-[200px] flex-1">
        <p className="text-[13px] font-medium text-ink">{title}</p>
        <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{description}</p>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}

export function DataCard() {
  const trades = useStore((s) => s.trades);
  const accounts = useStore((s) => s.accounts);
  const cashTransactions = useStore((s) => s.cashTransactions);
  const journal = useStore((s) => s.journal);
  const goals = useStore((s) => s.goals);
  const watchlist = useStore((s) => s.watchlist);
  const settings = useStore((s) => s.settings);
  const importTrades = useStore((s) => s.importTrades);
  const resetSampleData = useStore((s) => s.resetSampleData);
  const clearAllData = useStore((s) => s.clearAllData);

  const fileRef = useRef<HTMLInputElement>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearText, setClearText] = useState("");

  const exportBackup = () => {
    downloadFile(
      "ledgerx-backup.json",
      JSON.stringify({ trades, accounts, cashTransactions, journal, goals, watchlist, settings }, null, 2),
      "application/json",
    );
    toast(`Backup exported — ${formatNumber(trades.length)} trades included`);
  };

  const handleBackupText = (text: string) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      toast("That file isn't valid JSON", "error");
      return;
    }
    if (typeof parsed !== "object" || parsed === null || !Array.isArray((parsed as { trades?: unknown }).trades)) {
      toast("No trades array found — export a backup from LedgerX first", "error");
      return;
    }
    const rows = (parsed as { trades: unknown[] }).trades;
    const valid = rows.filter(isTradeLike);
    if (valid.length === 0) {
      toast("The backup contains no readable trades", "error");
      return;
    }
    const existing = new Set(trades.map((t) => t.id));
    const fresh = valid.filter((t) => !existing.has(t.id));
    const dupes = valid.length - fresh.length;
    const unreadable = rows.length - valid.length;
    if (fresh.length === 0) {
      toast(`All ${valid.length} trades in the backup already exist — nothing imported`, "info");
      return;
    }
    importTrades(fresh);
    const parts = [`Imported ${fresh.length} trade${fresh.length === 1 ? "" : "s"}`];
    if (dupes > 0) parts.push(`${dupes} duplicate${dupes === 1 ? "" : "s"} skipped`);
    if (unreadable > 0) parts.push(`${unreadable} unreadable skipped`);
    toast(`${parts.join(" · ")} — this build restores trades only`);
  };

  const onFilePicked = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => handleBackupText(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => toast("Could not read the selected file", "error");
    reader.readAsText(file);
  };

  const confirmReset = () => {
    resetSampleData();
    setResetOpen(false);
    toast("Sample data regenerated");
  };

  const closeClear = () => {
    setClearOpen(false);
    setClearText("");
  };

  const confirmClear = () => {
    clearAllData();
    closeClear();
    toast("All data cleared from this browser", "info");
  };

  return (
    <Card
      title="Data management"
      subtitle={`Everything is stored locally — currently ${formatNumber(trades.length)} trades, ${formatNumber(
        journal.length,
      )} journal entries and ${formatNumber(watchlist.length)} watchlist items.`}
    >
      <div className="divide-y divide-edge-soft">
        <DataRow
          icon={Download}
          title="Export all data (JSON)"
          description="Download trades, accounts, journal, goals, watchlist and settings as a single ledgerx-backup.json."
          action={
            <Button variant="outline" size="sm" icon={Download} onClick={exportBackup}>
              Export JSON
            </Button>
          }
        />
        <DataRow
          icon={Upload}
          title="Import trades from backup"
          description="Pick a ledgerx-backup.json — trades are validated and appended, duplicates skipped by id. This build restores trades only."
          action={
            <>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="sr-only"
                aria-label="Choose a LedgerX backup JSON file"
                onChange={onFilePicked}
              />
              <Button variant="outline" size="sm" icon={Upload} onClick={() => fileRef.current?.click()}>
                Import trades
              </Button>
            </>
          }
        />
        <DataRow
          icon={RefreshCw}
          title="Reset sample data"
          description="Regenerate the demo dataset — replaces current trades, journal, accounts, goals and watchlist."
          action={
            <Button variant="outline" size="sm" icon={RefreshCw} onClick={() => setResetOpen(true)}>
              Reset data
            </Button>
          }
        />
        <DataRow
          icon={Trash2}
          danger
          title="Clear all data"
          description="Delete every trade, journal entry and watchlist item from this browser. Cannot be undone."
          action={
            <Button variant="danger" size="sm" icon={Trash2} onClick={() => setClearOpen(true)}>
              Clear all data
            </Button>
          }
        />
      </div>

      <Modal open={resetOpen} onClose={() => setResetOpen(false)} title="Reset sample data?">
        <div className="space-y-4">
          <p className="text-[13px] leading-relaxed text-muted">
            This replaces your current trades, journal entries, accounts, goals and watchlist with a freshly generated
            sample dataset. Settings are kept. If you have real entries here, export a JSON backup first.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setResetOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" icon={RefreshCw} onClick={confirmReset}>
              Reset sample data
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={clearOpen} onClose={closeClear} title="Clear all data">
        <div className="space-y-4">
          <div className="rounded-lg border border-loss/30 bg-loss-soft p-3 text-[12.5px] leading-relaxed text-ink">
            This permanently deletes {formatNumber(trades.length)} trades, {formatNumber(journal.length)} journal
            entries and {formatNumber(watchlist.length)} watchlist items from this browser. Accounts reset to the
            defaults; settings and goals are kept. There is no undo.
          </div>
          <Field label={'Type "CLEAR" to confirm'} hint="This guard exists because the deletion is irreversible.">
            {(id) => (
              <Input
                id={id}
                value={clearText}
                onChange={(e) => setClearText(e.target.value)}
                placeholder="CLEAR"
                autoComplete="off"
                spellCheck={false}
              />
            )}
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={closeClear}>
              Cancel
            </Button>
            <Button variant="danger" icon={Trash2} disabled={clearText.trim() !== "CLEAR"} onClick={confirmClear}>
              Clear all data
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}
