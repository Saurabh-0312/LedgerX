/** Accounts page — add / edit account modal.
 *  Shared by the header button, the ghost "Add account" card and each card's edit action. */

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Check, Plus } from "lucide-react";
import type { Account } from "@/types";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";

export interface AccountFormValues {
  name: string;
  broker: string;
  currency: "INR" | "USD";
  startingCapital: number;
}

interface FormErrors {
  name?: string;
  broker?: string;
  capital?: string;
}

interface AccountFormModalProps {
  open: boolean;
  /** Account being edited, or null when adding a new one. */
  initial: Account | null;
  onClose: () => void;
  onSave: (values: AccountFormValues) => void;
}

export function AccountFormModal({ open, initial, onClose, onSave }: AccountFormModalProps) {
  const [name, setName] = useState("");
  const [broker, setBroker] = useState("");
  const [currency, setCurrency] = useState<"INR" | "USD">("INR");
  const [capital, setCapital] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});

  // Re-seed the form every time the modal opens (add vs edit).
  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setBroker(initial?.broker ?? "");
    setCurrency(initial?.currency ?? "INR");
    setCapital(initial ? String(initial.startingCapital) : "");
    setErrors({});
  }, [open, initial]);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const next: FormErrors = {};
    const trimmedName = name.trim();
    const trimmedBroker = broker.trim();
    const cap = Number(capital);
    if (!trimmedName) next.name = "Account name is required.";
    if (!trimmedBroker) next.broker = "Broker is required.";
    if (!capital.trim() || !Number.isFinite(cap)) next.capital = "Enter a valid amount.";
    else if (cap <= 0) next.capital = "Starting capital must be greater than zero.";
    setErrors(next);
    if (next.name || next.broker || next.capital) return;
    onSave({ name: trimmedName, broker: trimmedBroker, currency, startingCapital: cap });
  };

  return (
    <Modal open={open} onClose={onClose} title={initial ? "Edit account" : "Add account"}>
      <form onSubmit={submit} noValidate>
        <div className="space-y-4">
          <Field label="Account name" required error={errors.name}>
            {(id) => (
              <Input
                id={id}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Zerodha — F&O + Intraday"
                autoFocus
              />
            )}
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Broker" required error={errors.broker}>
              {(id) => (
                <Input
                  id={id}
                  value={broker}
                  onChange={(e) => setBroker(e.target.value)}
                  placeholder="e.g. Zerodha"
                />
              )}
            </Field>
            <Field label="Currency">
              {(id) => (
                <Select
                  id={id}
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value === "USD" ? "USD" : "INR")}
                >
                  <option value="INR">INR — Indian Rupee</option>
                  <option value="USD">USD — US Dollar</option>
                </Select>
              )}
            </Field>
          </div>
          <Field
            label="Starting capital"
            required
            error={errors.capital}
            hint="Used for this account's equity, ROI and drawdown math."
          >
            {(id) => (
              <Input
                id={id}
                type="number"
                inputMode="decimal"
                min={0}
                step={1000}
                value={capital}
                onChange={(e) => setCapital(e.target.value)}
                placeholder="500000"
              />
            )}
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" icon={initial ? Check : Plus}>
            {initial ? "Save changes" : "Add account"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
