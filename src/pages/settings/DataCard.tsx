/** Settings → Data management: export, import, reset sample data, clear all data. */

import { useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Download, RefreshCw, Trash2, Upload } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useStore } from "@/store/useStore";
import { useMtfStore } from "@/store/useMtfStore";
import { toast } from "@/store/toast";
import { downloadFile } from "@/lib/csv";
import { formatNumber } from "@/lib/format";
import { buildBackup, dedupeById, parseBackup } from "@/lib/backup";

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
  const portfolioTargets = useStore((s) => s.portfolioTargets);
  const watchlist = useStore((s) => s.watchlist);
  const settings = useStore((s) => s.settings);
  const importTrades = useStore((s) => s.importTrades);
  const addAccount = useStore((s) => s.addAccount);
  const addCashTransaction = useStore((s) => s.addCashTransaction);
  const addJournalEntry = useStore((s) => s.addJournalEntry);
  const addWatchItem = useStore((s) => s.addWatchItem);
  const setGoals = useStore((s) => s.setGoals);
  const setTargetPercents = useStore((s) => s.setTargetPercents);
  const setMonthCapital = useStore((s) => s.setMonthCapital);
  const updateSettings = useStore((s) => s.updateSettings);
  const resetSampleData = useStore((s) => s.resetSampleData);
  const clearAllData = useStore((s) => s.clearAllData);

  const mtfPositions = useMtfStore((s) => s.positions);
  const mtfBrokers = useMtfStore((s) => s.brokers);
  const mtfAccountValue = useMtfStore((s) => s.accountValue);
  const addPosition = useMtfStore((s) => s.addPosition);
  const addBroker = useMtfStore((s) => s.addBroker);
  const setAccountValue = useMtfStore((s) => s.setAccountValue);
  const clearMtf = useMtfStore((s) => s.clearAll);

  const fileRef = useRef<HTMLInputElement>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearText, setClearText] = useState("");

  const exportBackup = () => {
    const envelope = buildBackup(
      { trades, accounts, cashTransactions, journal, goals, portfolioTargets, watchlist, settings },
      { positions: mtfPositions, brokers: mtfBrokers, accountValue: mtfAccountValue },
      new Date().toISOString(),
    );
    downloadFile("ledgerx-backup.json", JSON.stringify(envelope, null, 2), "application/json");
    toast(`Backup exported — ${formatNumber(trades.length)} trades and MTF data included`);
  };

  /** Legacy flat backup — trades only, preserving the original behaviour/copy. */
  const restoreLegacy = (validTrades: typeof trades, unreadable: number) => {
    if (validTrades.length === 0) {
      toast("The backup contains no readable trades", "error");
      return;
    }
    const existing = new Set(trades.map((t) => t.id));
    const { fresh, dupes } = dedupeById(validTrades, existing);
    if (fresh.length === 0) {
      toast(`All ${validTrades.length} trades in the backup already exist — nothing imported`, "info");
      return;
    }
    importTrades(fresh);
    const parts = [`Imported ${fresh.length} trade${fresh.length === 1 ? "" : "s"}`];
    if (dupes.length > 0) parts.push(`${dupes.length} duplicate${dupes.length === 1 ? "" : "s"} skipped`);
    if (unreadable > 0) parts.push(`${unreadable} unreadable skipped`);
    toast(`${parts.join(" · ")} — legacy backup, trades only`);
  };

  const handleBackupText = (text: string) => {
    const result = parseBackup(text);
    if (!result.ok) {
      toast(result.error, "error");
      return;
    }
    const { data } = result;

    if (data.legacy) {
      restoreLegacy(data.ledgerx.trades, data.invalid.trades);
      return;
    }

    // ── v2 envelope — additive restore of every id-collection ──────────
    const lx = data.ledgerx;
    const mtf = data.mtf;
    const parts: string[] = [];
    let restoredTotal = 0;
    let skippedTotal = 0;

    const add = (restored: number, skipped: number, singular: string, plural: string) => {
      restoredTotal += restored;
      skippedTotal += skipped;
      if (restored === 0 && skipped === 0) return;
      let s = `${restored} ${restored === 1 ? singular : plural}`;
      if (skipped > 0) s += ` (${skipped} skipped)`;
      parts.push(s);
    };

    // Trades — preserve existing de-dup (skip if id already exists).
    {
      const existing = new Set(trades.map((t) => t.id));
      const { fresh, dupes } = dedupeById(lx.trades, existing);
      if (fresh.length > 0) importTrades(fresh);
      add(fresh.length, dupes.length + data.invalid.trades, "trade", "trades");
    }
    // Accounts
    {
      const existing = new Set(accounts.map((a) => a.id));
      const { fresh, dupes } = dedupeById(lx.accounts, existing);
      fresh.forEach(addAccount);
      add(fresh.length, dupes.length + data.invalid.accounts, "account", "accounts");
    }
    // Cash transactions
    {
      const existing = new Set(cashTransactions.map((c) => c.id));
      const { fresh, dupes } = dedupeById(lx.cashTransactions, existing);
      fresh.forEach(addCashTransaction);
      add(fresh.length, dupes.length + data.invalid.cashTransactions, "cash txn", "cash txns");
    }
    // Journal
    {
      const existing = new Set(journal.map((e) => e.id));
      const { fresh, dupes } = dedupeById(lx.journal, existing);
      fresh.forEach(addJournalEntry);
      add(fresh.length, dupes.length + data.invalid.journal, "journal entry", "journal entries");
    }
    // Watchlist
    {
      const existing = new Set(watchlist.map((w) => w.id));
      const { fresh, dupes } = dedupeById(lx.watchlist, existing);
      fresh.forEach(addWatchItem);
      add(fresh.length, dupes.length + data.invalid.watchlist, "watch item", "watch items");
    }
    // MTF positions
    {
      const existing = new Set(mtfPositions.map((p) => p.id));
      const { fresh, dupes } = dedupeById(mtf.positions, existing);
      fresh.forEach(addPosition);
      add(fresh.length, dupes.length + data.invalid.mtfPositions, "MTF position", "MTF positions");
    }
    // MTF brokers
    {
      const existing = new Set(mtfBrokers.map((b) => b.id));
      const { fresh, dupes } = dedupeById(mtf.brokers, existing);
      fresh.forEach(addBroker);
      add(fresh.length, dupes.length + data.invalid.mtfBrokers, "MTF broker", "MTF brokers");
    }

    // Singletons — not id-deduped; noted separately in the summary.
    if (lx.settings) {
      updateSettings(lx.settings);
      parts.push("settings merged");
    }
    if (lx.goals) {
      setGoals(lx.goals);
      parts.push("goals replaced");
    }
    if (lx.portfolioTargets) {
      setTargetPercents(lx.portfolioTargets.percents);
      const months = Object.entries(lx.portfolioTargets.capitalByMonth);
      let monthCount = 0;
      for (const [ym, value] of months) {
        if (typeof value === "number") {
          setMonthCapital(ym, value);
          monthCount += 1;
        }
      }
      parts.push(`${monthCount} monthly target${monthCount === 1 ? "" : "s"}`);
    }
    // Only restore a real value — a backup holding 0 (unset) must not clobber
    // an account value the user has since entered.
    if (mtf.accountValue !== null && mtf.accountValue > 0) {
      setAccountValue(mtf.accountValue);
      parts.push("MTF account value set");
    }

    if (parts.length === 0) {
      toast("Nothing to import — the backup was empty", "info");
      return;
    }
    const tone = restoredTotal === 0 && skippedTotal > 0 ? "info" : "success";
    toast(`Restored ${parts.join(" · ")}`, tone);
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
    clearMtf(); // clearAllData only touches ledgerx-store; MTF has its own store
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
          description="Download every trade, account, cash transaction, journal entry, goal, monthly target, watchlist item, setting and MTF position as a single ledgerx-backup.json."
          action={
            <Button variant="outline" size="sm" icon={Download} onClick={exportBackup}>
              Export JSON
            </Button>
          }
        />
        <DataRow
          icon={Upload}
          title="Import trades from backup"
          description="Pick a ledgerx-backup.json — every collection is validated and appended, duplicates skipped by id."
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
