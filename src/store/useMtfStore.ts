/** MTF Interest Tracker store — SEPARATE persisted zustand store ("mtf-store"
 *  localStorage key). Never touches ledgerx-store or the journal's Trade model. */

import { useEffect, useState } from "react";
import { startOfDay } from "date-fns";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { MtfBroker, MtfPosition } from "@/lib/mtf/types";
import { buildCloseSnapshot } from "@/lib/mtf/calc";
import { SAMPLE_BROKERS, generateSampleMtf } from "@/lib/mtf/sampleMtf";

interface MtfState {
  positions: MtfPosition[];
  brokers: MtfBroker[];
  /** trading-account value, denominator for the "interest as % of account" metric
   *  (0 = unset → % hidden until the user enters it) */
  accountValue: number;

  setAccountValue: (v: number) => void;
  addPosition: (p: MtfPosition) => void;
  updatePosition: (id: string, patch: Partial<MtfPosition>) => void;
  deletePosition: (id: string) => void;
  duplicatePosition: (id: string) => void;
  /** Computes & freezes the final* snapshot, moves the position to Closed. */
  closePosition: (id: string, exitPrice: number, exitDateISO: string) => void;
  /** Back to Open; clears the frozen snapshot. */
  reopenPosition: (id: string) => void;

  addBroker: (b: MtfBroker) => void;
  updateBroker: (id: string, patch: Partial<MtfBroker>) => void;
  deleteBroker: (id: string) => void;

  resetSampleData: () => void;
  clearAll: () => void;
}

export const useMtfStore = create<MtfState>()(
  persist(
    (set) => ({
      positions: generateSampleMtf(),
      brokers: SAMPLE_BROKERS,
      accountValue: 0,

      setAccountValue: (v) => set({ accountValue: Math.max(0, v) }),
      addPosition: (p) => set((s) => ({ positions: [p, ...s.positions] })),
      updatePosition: (id, patch) =>
        set((s) => ({
          positions: s.positions.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        })),
      deletePosition: (id) =>
        set((s) => ({ positions: s.positions.filter((p) => p.id !== id) })),
      duplicatePosition: (id) =>
        set((s) => {
          const src = s.positions.find((p) => p.id === id);
          if (!src) return s;
          const clone: MtfPosition = {
            ...src,
            id: nextMtfId(s.positions),
            stockName: `${src.stockName} (copy)`,
            status: "Open",
            exitDate: undefined,
            exitPrice: undefined,
            finalHoldingDays: undefined,
            finalInterest: undefined,
            finalCharges: undefined,
            finalGrossProfit: undefined,
            finalNetProfit: undefined,
            finalBreakEvenPrice: undefined,
          };
          return { positions: [clone, ...s.positions] };
        }),

      closePosition: (id, exitPrice, exitDateISO) =>
        set((s) => ({
          positions: s.positions.map((p) =>
            p.id === id && p.status === "Open"
              ? { ...p, ...buildCloseSnapshot(p, exitPrice, exitDateISO) }
              : p,
          ),
        })),
      reopenPosition: (id) =>
        set((s) => ({
          positions: s.positions.map((p) =>
            p.id === id
              ? {
                  ...p,
                  status: "Open" as const,
                  exitDate: undefined,
                  exitPrice: undefined,
                  finalHoldingDays: undefined,
                  finalInterest: undefined,
                  finalCharges: undefined,
                  finalGrossProfit: undefined,
                  finalNetProfit: undefined,
                  finalBreakEvenPrice: undefined,
                }
              : p,
          ),
        })),

      addBroker: (b) => set((s) => ({ brokers: [...s.brokers, b] })),
      updateBroker: (id, patch) =>
        set((s) => ({ brokers: s.brokers.map((b) => (b.id === id ? { ...b, ...patch } : b)) })),
      deleteBroker: (id) => set((s) => ({ brokers: s.brokers.filter((b) => b.id !== id) })),

      resetSampleData: () =>
        set({ positions: generateSampleMtf(), brokers: SAMPLE_BROKERS }),
      clearAll: () => set({ positions: [], brokers: SAMPLE_BROKERS }),
    }),
    {
      name: "mtf-store",
      version: 2,
      // v1 → v2: add accountValue (denominator for the interest-% metric), default 0
      migrate: (persisted: unknown) => {
        const s = persisted as { accountValue?: number } | undefined;
        if (s && typeof s.accountValue !== "number") s.accountValue = 0;
        return s as unknown as MtfState;
      },
    },
  ),
);

/** Next sequential id, zero-padded to 4 — "MTF-0009". */
export function nextMtfId(positions: MtfPosition[]): string {
  const max = positions.reduce((m, p) => {
    const n = Number(p.id.replace(/\D/g, ""));
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 0);
  return `MTF-${String(max + 1).padStart(4, "0")}`;
}

/** Today (startOfDay of the REAL clock), refreshing itself past local midnight
 *  so an always-open tab rolls interest over without a reload (spec §2.7). */
export function useAsOfToday(): Date {
  const [today, setToday] = useState<Date>(() => startOfDay(new Date()));
  useEffect(() => {
    const timer = setInterval(() => {
      const now = startOfDay(new Date());
      setToday((prev) => (prev.getTime() === now.getTime() ? prev : now));
    }, 60_000);
    return () => clearInterval(timer);
  }, []);
  return today;
}
