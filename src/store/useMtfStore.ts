/** MTF Interest Tracker store — backed by the Worker API (Phase 8).
 *  Positions/brokers live in Postgres; accountValue is one column of the shared
 *  user_settings row (written through settingsSync — never PUT directly here).
 *  Actions stay SYNCHRONOUS and optimistic, exactly like useStore (Phase 7):
 *  set() immediately, then fire the API call in the background (failures toast,
 *  no rollback). No local persistence — the old "mtf-store" key is never touched. */

import { useEffect, useState } from "react";
import { startOfDay } from "date-fns";
import { create } from "zustand";
import type { MtfBroker, MtfPosition } from "@/lib/mtf/types";
import { buildCloseSnapshot } from "@/lib/mtf/calc";
import { SAMPLE_BROKERS, generateSampleMtf } from "@/lib/mtf/sampleMtf";
import { api } from "@/lib/api";
import { toast } from "@/store/toast";
import { scheduleSettingsSync } from "@/store/settingsSync";

const POS = "/api/mtf/positions";
const BROKERS = "/api/mtf/brokers";

// ── background-sync helpers (mirror useStore) ────────────────────────────────
const bg = (label: string, p: Promise<unknown>): void => {
  p.catch((e: unknown) => toast(`Couldn't save ${label}: ${e instanceof Error ? e.message : String(e)}`, "error"));
};
const eid = (id: string) => encodeURIComponent(id);
const idsOf = (rows: Array<{ id: string }>) => rows.map((r) => r.id);
const bulkDelete = (path: string, rows: Array<{ id: string }>): Promise<unknown> =>
  rows.length ? api.del(path, { ids: idsOf(rows) }) : Promise.resolve(null);
const bulkInsert = (path: string, rows: unknown[]): Promise<unknown> =>
  rows.length ? api.post(path, rows) : Promise.resolve(null);
const stripUserId = <T,>(rows: Array<T & { user_id?: string }>): T[] =>
  rows.map((r) => {
    const copy = { ...r };
    delete (copy as { user_id?: string }).user_id;
    return copy as T;
  });

/** The snapshot columns a reopen must CLEAR — sent as explicit null so PostgREST
 *  actually nulls them (an undefined field would be omitted and left stale). */
const REOPEN_CLEAR = {
  status: "Open",
  exitDate: null,
  exitPrice: null,
  finalHoldingDays: null,
  finalInterest: null,
  finalCharges: null,
  finalGrossProfit: null,
  finalNetProfit: null,
  finalBreakEvenPrice: null,
};

interface MtfState {
  positions: MtfPosition[];
  brokers: MtfBroker[];
  /** trading-account value, denominator for the "interest as % of account" metric
   *  (0 = unset → % hidden until the user enters it). One column of user_settings. */
  accountValue: number;

  /** false until the initial API hydrate resolves; the app shell gates on this
   *  alongside useStore.hydrated. */
  hydrated: boolean;
  hydrateError: string | null;
  /** Loads positions + brokers. accountValue is set by useStore.hydrate from the
   *  same GET /api/settings response — no second request here (D4). */
  hydrate: () => Promise<void>;

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

export const useMtfStore = create<MtfState>()((set, get) => ({
  // Empty initial state — real data arrives via hydrate() (D2). No sample flash.
  positions: [],
  brokers: [],
  accountValue: 0,

  hydrated: false,
  hydrateError: null,

  hydrate: async () => {
    set({ hydrateError: null });
    try {
      const [positions, brokers] = await Promise.all([
        api.get<Array<MtfPosition & { user_id?: string }>>(POS),
        api.get<Array<MtfBroker & { user_id?: string }>>(BROKERS),
      ]);
      set({
        positions: stripUserId(positions),
        brokers: stripUserId(brokers),
        hydrated: true,
        hydrateError: null,
      });
    } catch (e) {
      set({ hydrateError: e instanceof Error ? e.message : "Failed to load MTF data", hydrated: false });
    }
  },

  setAccountValue: (v) => {
    set({ accountValue: Math.max(0, v) });
    scheduleSettingsSync(); // accountValue is a user_settings column (single writer, D3)
  },

  addPosition: (p) => {
    set((s) => ({ positions: [p, ...s.positions] }));
    bg("position", api.post(POS, p));
  },
  updatePosition: (id, patch) => {
    set((s) => ({ positions: s.positions.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
    bg("position", api.patch(`${POS}/${eid(id)}`, patch));
  },
  deletePosition: (id) => {
    set((s) => ({ positions: s.positions.filter((p) => p.id !== id) }));
    bg("position", api.del(`${POS}/${eid(id)}`));
  },
  duplicatePosition: (id) => {
    const src = get().positions.find((p) => p.id === id);
    if (!src) return;
    const clone: MtfPosition = {
      ...src,
      id: nextMtfId(get().positions),
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
    set((s) => ({ positions: [clone, ...s.positions] }));
    bg("position", api.post(POS, clone));
  },

  closePosition: (id, exitPrice, exitDateISO) => {
    const p = get().positions.find((x) => x.id === id);
    if (!p || p.status !== "Open") return;
    const closed = { ...p, ...buildCloseSnapshot(p, exitPrice, exitDateISO) };
    set((s) => ({ positions: s.positions.map((x) => (x.id === id ? closed : x)) }));
    bg("position", api.patch(`${POS}/${eid(id)}`, closed));
  },
  reopenPosition: (id) => {
    const p = get().positions.find((x) => x.id === id);
    if (!p) return;
    set((s) => ({
      positions: s.positions.map((x) =>
        x.id === id
          ? {
              ...x,
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
          : x,
      ),
    }));
    bg("position", api.patch(`${POS}/${eid(id)}`, REOPEN_CLEAR));
  },

  addBroker: (b) => {
    set((s) => ({ brokers: [...s.brokers, b] }));
    bg("broker", api.post(BROKERS, b));
  },
  updateBroker: (id, patch) => {
    set((s) => ({ brokers: s.brokers.map((b) => (b.id === id ? { ...b, ...patch } : b)) }));
    bg("broker", api.patch(`${BROKERS}/${eid(id)}`, patch));
  },
  deleteBroker: (id) => {
    set((s) => ({ brokers: s.brokers.filter((b) => b.id !== id) }));
    bg("broker", api.del(`${BROKERS}/${eid(id)}`));
  },

  resetSampleData: () => {
    const prev = get();
    const positions = generateSampleMtf();
    set({ positions, brokers: SAMPLE_BROKERS });
    bg(
      "MTF reset",
      (async () => {
        await Promise.all([bulkDelete(POS, prev.positions), bulkDelete(BROKERS, prev.brokers)]);
        await Promise.all([bulkInsert(POS, positions), bulkInsert(BROKERS, SAMPLE_BROKERS)]);
      })(),
    );
  },
  clearAll: () => {
    const prev = get();
    set({ positions: [], brokers: SAMPLE_BROKERS });
    bg(
      "MTF clear",
      (async () => {
        await Promise.all([bulkDelete(POS, prev.positions), bulkDelete(BROKERS, prev.brokers)]);
        await bulkInsert(BROKERS, SAMPLE_BROKERS);
      })(),
    );
  },
}));

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
