import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import type { Goals } from "@/types";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";

interface EditGoalsModalProps {
  open: boolean;
  onClose: () => void;
  goals: Goals;
  onSave: (goals: Goals) => void;
}

interface Draft {
  monthlyProfitTarget: string;
  winRateTarget: string;
  maxDailyLoss: string;
  maxTradesPerDay: string;
}

type DraftErrors = Partial<Record<keyof Draft, string>>;

const toDraft = (g: Goals): Draft => ({
  monthlyProfitTarget: String(g.monthlyProfitTarget),
  winRateTarget: String(g.winRateTarget),
  maxDailyLoss: String(g.maxDailyLoss),
  maxTradesPerDay: String(g.maxTradesPerDay),
});

/** Modal form for the four goal numbers. Validates, then calls onSave. */
export function EditGoalsModal({ open, onClose, goals, onSave }: EditGoalsModalProps) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(goals));
  const [errors, setErrors] = useState<DraftErrors>({});

  useEffect(() => {
    if (open) {
      setDraft(toDraft(goals));
      setErrors({});
    }
  }, [open, goals]);

  const bind = (key: keyof Draft) => (e: ChangeEvent<HTMLInputElement>) =>
    setDraft((d) => ({ ...d, [key]: e.target.value }));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const errs: DraftErrors = {};

    const profit = Number(draft.monthlyProfitTarget);
    const winRate = Number(draft.winRateTarget);
    const dailyLoss = Number(draft.maxDailyLoss);
    const tradesCap = Number(draft.maxTradesPerDay);

    if (draft.monthlyProfitTarget.trim() === "" || !Number.isFinite(profit) || profit <= 0)
      errs.monthlyProfitTarget = "Enter a positive rupee amount";
    if (draft.winRateTarget.trim() === "" || !Number.isFinite(winRate) || winRate <= 0 || winRate > 100)
      errs.winRateTarget = "Enter a percentage between 1 and 100";
    if (draft.maxDailyLoss.trim() === "" || !Number.isFinite(dailyLoss) || dailyLoss <= 0)
      errs.maxDailyLoss = "Enter a positive rupee amount";
    if (
      draft.maxTradesPerDay.trim() === "" ||
      !Number.isFinite(tradesCap) ||
      !Number.isInteger(tradesCap) ||
      tradesCap < 1
    )
      errs.maxTradesPerDay = "Enter a whole number of at least 1";

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    onSave({
      monthlyProfitTarget: profit,
      winRateTarget: winRate,
      maxDailyLoss: dailyLoss,
      maxTradesPerDay: tradesCap,
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit goals">
      <form onSubmit={handleSubmit} noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Monthly profit target (₹)"
            hint="Net P&L you aim to bank each month"
            error={errors.monthlyProfitTarget}
            required
          >
            {(id) => (
              <Input
                id={id}
                type="number"
                inputMode="numeric"
                min={0}
                step={1000}
                value={draft.monthlyProfitTarget}
                onChange={bind("monthlyProfitTarget")}
              />
            )}
          </Field>
          <Field
            label="Win rate target (%)"
            hint="Share of closed trades that should win"
            error={errors.winRateTarget}
            required
          >
            {(id) => (
              <Input
                id={id}
                type="number"
                inputMode="numeric"
                min={1}
                max={100}
                step={1}
                value={draft.winRateTarget}
                onChange={bind("winRateTarget")}
              />
            )}
          </Field>
          <Field
            label="Max daily loss (₹)"
            hint="Largest tolerable single-day loss"
            error={errors.maxDailyLoss}
            required
          >
            {(id) => (
              <Input
                id={id}
                type="number"
                inputMode="numeric"
                min={0}
                step={500}
                value={draft.maxDailyLoss}
                onChange={bind("maxDailyLoss")}
              />
            )}
          </Field>
          <Field
            label="Max trades per day"
            hint="Hard cap on trades taken in one day"
            error={errors.maxTradesPerDay}
            required
          >
            {(id) => (
              <Input
                id={id}
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={draft.maxTradesPerDay}
                onChange={bind("maxTradesPerDay")}
              />
            )}
          </Field>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            Save goals
          </Button>
        </div>
      </form>
    </Modal>
  );
}
