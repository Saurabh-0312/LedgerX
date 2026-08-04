/** MTF Close Position modal (spec §8-close). SELF-CONTAINED: previews the
 *  frozen snapshot via the pure buildCloseSnapshot, then calls
 *  closePosition(id, exitPrice, exitDateISO), toasts and closes. */

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import type { MtfPosition } from "@/lib/mtf/types";
import { buildCloseSnapshot } from "@/lib/mtf/calc";
import { useMtfStore } from "@/store/useMtfStore";
import { toast } from "@/store/toast";
import { formatDate, formatMoney, formatNumber, pnlClass } from "@/lib/format";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";

const num = (s: string): number => {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
};

interface Errors {
  exitPrice?: string;
  exitDate?: string;
}

export function ClosePositionModal({
  open,
  position,
  onClose,
}: {
  open: boolean;
  position: MtfPosition | null;
  onClose: () => void;
}) {
  const closePosition = useMtfStore((s) => s.closePosition);

  const [exitPrice, setExitPrice] = useState("");
  const [exitDate, setExitDate] = useState("");
  const [errors, setErrors] = useState<Errors>({});

  // re-seed whenever the modal opens or targets a different position
  useEffect(() => {
    if (!open || !position) return;
    setExitPrice(String(position.currentPrice ?? position.avgBuyPrice));
    setExitDate(format(new Date(), "yyyy-MM-dd"));
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, position?.id]);

  /** buildCloseSnapshot is pure — safe to run live as the inputs change. */
  const preview = useMemo(() => {
    if (!position) return null;
    const p = num(exitPrice);
    if (!(p > 0) || !exitDate) return null;
    if (new Date(exitDate).getTime() < new Date(position.purchaseDate).getTime()) return null;
    return buildCloseSnapshot(position, p, exitDate);
  }, [position, exitPrice, exitDate]);

  if (!position) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const errs: Errors = {};
    const p = num(exitPrice);
    if (!(p > 0)) errs.exitPrice = "Exit price must be greater than 0";
    if (!exitDate) errs.exitDate = "Exit date is required";
    else if (new Date(exitDate).getTime() < new Date(position.purchaseDate).getTime())
      errs.exitDate = "Exit date cannot be before the purchase date";
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      toast("Please fix the highlighted fields", "error");
      return;
    }
    closePosition(position.id, p, exitDate);
    toast("Position closed", "success");
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Close Position" widthClass="max-w-sm">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* position summary line */}
        <div className="rounded-xl border border-edge-soft bg-raised/40 p-3">
          <p className="text-[13px] font-semibold text-ink">
            {position.stockName} <span className="font-normal text-muted">({position.symbol})</span>
          </p>
          <p className="tnum mt-0.5 text-[12px] text-muted">
            {formatNumber(position.quantity)} qty @ {formatMoney(position.avgBuyPrice, { decimals: true })} · bought{" "}
            {formatDate(position.purchaseDate)}
          </p>
        </div>

        <Field label="Exit Price" required error={errors.exitPrice}>
          {(id) => (
            <Input
              id={id}
              type="number"
              min="0"
              step="0.01"
              value={exitPrice}
              onChange={(e) => {
                setExitPrice(e.target.value);
                setErrors((prev) => ({ ...prev, exitPrice: undefined }));
              }}
              placeholder="0.00"
              autoFocus
            />
          )}
        </Field>
        <Field label="Exit Date" required error={errors.exitDate}>
          {(id) => (
            <Input
              id={id}
              type="date"
              min={position.purchaseDate}
              value={exitDate}
              onChange={(e) => {
                setExitDate(e.target.value);
                setErrors((prev) => ({ ...prev, exitDate: undefined }));
              }}
            />
          )}
        </Field>

        {/* live snapshot preview */}
        <div className="rounded-xl border border-edge-soft bg-raised/40 p-3">
          {preview ? (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="label-caps">Interest</p>
                <p className="tnum mt-1 text-[13px] font-semibold text-warning">
                  {formatMoney(preview.finalInterest ?? 0, { decimals: true })}
                </p>
              </div>
              <div>
                <p className="label-caps">Holding</p>
                <p className="tnum mt-1 text-[13px] font-semibold text-info">
                  {formatNumber(preview.finalHoldingDays ?? 0)} days
                </p>
              </div>
              <div>
                <p className="label-caps">Net Profit</p>
                <p className={`tnum mt-1 text-[13px] font-semibold ${pnlClass(preview.finalNetProfit ?? 0)}`}>
                  {formatMoney(preview.finalNetProfit ?? 0, { sign: true })}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-[12px] text-muted">Enter a valid exit price and date to preview the final numbers.</p>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-edge-soft pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            Close Position
          </Button>
        </footer>
      </form>
    </Modal>
  );
}
