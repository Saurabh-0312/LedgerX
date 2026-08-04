/** Manage an account's cash ledger — deposits added and withdrawals taken for
 *  personal use. Shows the balance breakdown, an add form and the history. */

import { useEffect, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Plus, Trash2 } from "lucide-react";
import type { Account, CashTransaction } from "@/types";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { formatDate, formatMoney } from "@/lib/format";
import { netCashFlow } from "@/lib/metrics";
import { toast } from "@/store/toast";

interface FundsModalProps {
  open: boolean;
  account: Account | null;
  transactions: CashTransaction[]; // already filtered to this account
  netPnl: number; // realised trading P&L for this account
  defaultDate: string; // yyyy-MM-dd
  onClose: () => void;
  onAdd: (txn: Omit<CashTransaction, "id">) => void;
  onDelete: (id: string) => void;
}

export function FundsModal({
  open,
  account,
  transactions,
  netPnl,
  defaultDate,
  onClose,
  onAdd,
  onDelete,
}: FundsModalProps) {
  const [type, setType] = useState<"deposit" | "withdrawal">("deposit");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [note, setNote] = useState("");

  // reset the form each time the modal opens for a (possibly different) account
  useEffect(() => {
    if (open) {
      setType("deposit");
      setAmount("");
      setDate(defaultDate);
      setNote("");
    }
  }, [open, account?.id, defaultDate]);

  if (!account) return null;
  const currency = account.currency;
  const m = (v: number, sign = false) => formatMoney(v, { currency, sign });

  const deposits = transactions.filter((t) => t.type === "deposit").reduce((s, t) => s + t.amount, 0);
  const withdrawals = transactions.filter((t) => t.type === "withdrawal").reduce((s, t) => s + t.amount, 0);
  const netFlow = netCashFlow(transactions);
  const balance = account.startingCapital + netPnl + netFlow;

  const submit = () => {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast("Enter an amount greater than zero", "error");
      return;
    }
    if (!date) {
      toast("Pick a date for this entry", "error");
      return;
    }
    onAdd({ accountId: account.id, type, amount: Math.round(amt * 100) / 100, date, note: note.trim() || undefined });
    toast(`${type === "deposit" ? "Deposited" : "Withdrew"} ${m(amt)} · ${account.name}`);
    setAmount("");
    setNote("");
  };

  const sorted = [...transactions].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <Modal open={open} onClose={onClose} title={`Manage funds — ${account.name}`} widthClass="max-w-lg">
      {/* balance breakdown */}
      <div className="rounded-xl border border-edge bg-raised/50 p-4">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
          <span className="text-muted">Starting capital</span>
          <span className="tnum text-right text-ink">{m(account.startingCapital)}</span>
          <span className="text-muted">+ Deposits</span>
          <span className="tnum text-right text-profit">{deposits > 0 ? `+ ${m(deposits)}` : m(0)}</span>
          <span className="text-muted">− Withdrawals</span>
          <span className="tnum text-right text-loss">{withdrawals > 0 ? `− ${m(withdrawals)}` : m(0)}</span>
          <span className="text-muted">+ Realised P&L</span>
          <span className={`tnum text-right ${netPnl >= 0 ? "text-profit" : "text-loss"}`}>{m(netPnl, true)}</span>
        </div>
        <div className="mt-3 flex items-baseline justify-between border-t border-edge-soft pt-3">
          <span className="text-[13px] font-medium text-ink">Current balance</span>
          <span className="tnum text-[18px] font-semibold text-ink">{m(balance)}</span>
        </div>
      </div>

      {/* add form */}
      <div className="mt-4">
        <div className="mb-3 grid grid-cols-2 gap-1 rounded-[10px] border border-edge bg-raised p-1" role="group" aria-label="Transaction type">
          <button
            type="button"
            aria-pressed={type === "deposit"}
            onClick={() => setType("deposit")}
            className={`flex h-9 items-center justify-center gap-1.5 rounded-lg text-[13px] font-medium transition-colors ${
              type === "deposit" ? "bg-profit-soft text-profit" : "text-muted hover:text-ink"
            }`}
          >
            <ArrowDownToLine size={15} aria-hidden /> Deposit
          </button>
          <button
            type="button"
            aria-pressed={type === "withdrawal"}
            onClick={() => setType("withdrawal")}
            className={`flex h-9 items-center justify-center gap-1.5 rounded-lg text-[13px] font-medium transition-colors ${
              type === "withdrawal" ? "bg-loss-soft text-loss" : "text-muted hover:text-ink"
            }`}
          >
            <ArrowUpFromLine size={15} aria-hidden /> Withdraw
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={`Amount (${currency === "INR" ? "₹" : "$"})`} required>
            {(id) => (
              <Input
                id={id}
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoFocus
              />
            )}
          </Field>
          <Field label="Date" required>
            {(id) => <Input id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
          </Field>
        </div>
        <Field label="Note" className="mt-3">
          {(id) => (
            <Textarea
              id={id}
              className="min-h-[60px]"
              placeholder={type === "deposit" ? "e.g. Added margin for expiry week" : "e.g. Personal use — profit booking"}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          )}
        </Field>
        <Button variant="primary" icon={Plus} className="mt-3 w-full" onClick={submit}>
          {type === "deposit" ? "Add deposit" : "Record withdrawal"}
        </Button>
      </div>

      {/* history */}
      <div className="mt-5 border-t border-edge pt-4">
        <div className="mb-2 flex items-baseline justify-between">
          <h4 className="label-caps">Transaction history</h4>
          <span className="text-[11px] text-faint">Net funding {netFlow >= 0 ? "+" : "−"}{m(Math.abs(netFlow))}</span>
        </div>
        {sorted.length === 0 ? (
          <p className="py-4 text-center text-[12px] text-muted">
            No cash movements yet — add a deposit or withdrawal above.
          </p>
        ) : (
          <ul className="max-h-[220px] space-y-1.5 overflow-y-auto pr-1">
            {sorted.map((t) => (
              <li
                key={t.id}
                className="flex items-center gap-3 rounded-[10px] border border-edge-soft bg-raised/40 px-3 py-2"
              >
                <span
                  aria-hidden
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                    t.type === "deposit" ? "bg-profit-soft text-profit" : "bg-loss-soft text-loss"
                  }`}
                >
                  {t.type === "deposit" ? <ArrowDownToLine size={14} /> : <ArrowUpFromLine size={14} />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge tone={t.type === "deposit" ? "profit" : "loss"}>
                      {t.type === "deposit" ? "Deposit" : "Withdrawal"}
                    </Badge>
                    <span className="text-[11px] text-faint">{formatDate(t.date)}</span>
                  </div>
                  {t.note && <p className="mt-0.5 truncate text-[12px] text-muted">{t.note}</p>}
                </div>
                <span className={`tnum shrink-0 text-[13px] font-semibold ${t.type === "deposit" ? "text-profit" : "text-loss"}`}>
                  {t.type === "deposit" ? "+" : "−"}
                  {m(t.amount)}
                </span>
                <button
                  onClick={() => onDelete(t.id)}
                  aria-label="Delete transaction"
                  className="shrink-0 rounded-lg p-1.5 text-faint transition-colors hover:bg-loss-soft hover:text-loss"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
