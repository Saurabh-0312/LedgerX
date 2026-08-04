import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { AssetClass, WatchlistItem } from "@/types";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";

const ASSET_CLASSES: AssetClass[] = ["Equity", "Options", "Futures", "Forex", "Crypto", "Commodity"];

/** What the form hands back to the page — id/addedAt are the page's concern. */
export interface WatchFormValues {
  symbol: string;
  assetClass: AssetClass;
  plannedSetup: string;
  alertPrice?: number;
  note: string;
}

interface WatchItemModalProps {
  open: boolean;
  /** Item being edited, or null when adding a new symbol. */
  initial: WatchlistItem | null;
  /** Setup names: trade strategies + generics, deduped by the page. */
  setupOptions: string[];
  onClose: () => void;
  onSave: (values: WatchFormValues) => void;
}

interface FormState {
  symbol: string;
  assetClass: AssetClass;
  plannedSetup: string;
  alertPrice: string; // raw input text; parsed on submit
  note: string;
}

const blank = (fallbackSetup: string): FormState => ({
  symbol: "",
  assetClass: "Equity",
  plannedSetup: fallbackSetup,
  alertPrice: "",
  note: "",
});

/** Add / edit dialog for a watchlist symbol. */
export function WatchItemModal({ open, initial, setupOptions, onClose, onSave }: WatchItemModalProps) {
  const [form, setForm] = useState<FormState>(() => blank(setupOptions[0] ?? "Breakout"));
  const [symbolError, setSymbolError] = useState<string | undefined>(undefined);
  const [alertError, setAlertError] = useState<string | undefined>(undefined);

  // Re-seed the form every time the dialog opens (fresh add, or prefill for edit).
  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        symbol: initial.symbol,
        assetClass: initial.assetClass,
        plannedSetup: initial.plannedSetup,
        alertPrice: initial.alertPrice !== undefined ? String(initial.alertPrice) : "",
        note: initial.note,
      });
    } else {
      setForm(blank(setupOptions[0] ?? "Breakout"));
    }
    setSymbolError(undefined);
    setAlertError(undefined);
    // setupOptions is stable enough for seeding; we only care about open/initial transitions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);

  // Keep an off-list setup (edited legacy value) selectable instead of silently dropping it.
  const options = form.plannedSetup && !setupOptions.includes(form.plannedSetup)
    ? [form.plannedSetup, ...setupOptions]
    : setupOptions;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const symbol = form.symbol.trim().toUpperCase();
    let ok = true;

    if (!symbol) {
      setSymbolError("Enter a symbol to watch.");
      ok = false;
    } else {
      setSymbolError(undefined);
    }

    let alertPrice: number | undefined;
    const rawAlert = form.alertPrice.trim();
    if (rawAlert !== "") {
      const parsed = Number(rawAlert);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        setAlertError("Alert price must be a positive number.");
        ok = false;
      } else {
        setAlertError(undefined);
        alertPrice = parsed;
      }
    } else {
      setAlertError(undefined);
    }

    if (!ok) return;
    onSave({
      symbol,
      assetClass: form.assetClass,
      plannedSetup: form.plannedSetup,
      alertPrice,
      note: form.note.trim(),
    });
  };

  return (
    <Modal open={open} onClose={onClose} title={initial ? `Edit ${initial.symbol}` : "Add symbol to watchlist"}>
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Symbol" required error={symbolError}>
            {(id) => (
              <Input
                id={id}
                value={form.symbol}
                onChange={(e) => set("symbol", e.target.value.toUpperCase())}
                placeholder="e.g. RELIANCE"
                className="font-mono uppercase"
                autoComplete="off"
                spellCheck={false}
                maxLength={24}
                autoFocus
              />
            )}
          </Field>
          <Field label="Asset class">
            {(id) => (
              <Select id={id} value={form.assetClass} onChange={(e) => set("assetClass", e.target.value as AssetClass)}>
                {ASSET_CLASSES.map((ac) => (
                  <option key={ac} value={ac}>
                    {ac}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Planned setup" hint="The play you're waiting for.">
            {(id) => (
              <Select id={id} value={form.plannedSetup} onChange={(e) => set("plannedSetup", e.target.value)}>
                {options.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Alert price" hint="Optional — level worth a notification." error={alertError}>
            {(id) => (
              <Input
                id={id}
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={form.alertPrice}
                onChange={(e) => set("alertPrice", e.target.value)}
                placeholder="e.g. 5600"
              />
            )}
          </Field>
        </div>

        <Field label="Note">
          {(id) => (
            <Textarea
              id={id}
              value={form.note}
              onChange={(e) => set("note", e.target.value)}
              placeholder="Why is this on the radar? Levels, catalysts, invalidation…"
              rows={3}
            />
          )}
        </Field>

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            {initial ? "Save changes" : "Add to watchlist"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
