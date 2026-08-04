/** The single writer for the shared user_settings row (Phase 8, D3).
 *  The row has four columns owned by TWO stores:
 *    goals · portfolioTargets · settings   ← useStore
 *    mtfAccountValue                        ← useMtfStore
 *  PUT /api/settings replaces the whole row, so both stores route their settings
 *  writes through here — assembling all four fields every time — instead of each
 *  PUTting independently (which would drop the other store's column, Risk 2). */

import type { AppSettings, Goals, PortfolioTargets } from "@/types";
import { api } from "@/lib/api";
import { toast } from "@/store/toast";
import { useStore } from "@/store/useStore";
import { useMtfStore } from "@/store/useMtfStore";

export interface SettingsRow {
  goals: Goals;
  portfolioTargets: PortfolioTargets;
  settings: AppSettings;
  mtfAccountValue: number;
}

/** Assemble the COMPLETE four-column row from both stores at call time. */
function currentRow(): SettingsRow {
  const { goals, portfolioTargets, settings } = useStore.getState();
  const { accountValue } = useMtfStore.getState();
  return { goals, portfolioTargets, settings, mtfAccountValue: accountValue };
}

let timer: ReturnType<typeof setTimeout> | undefined;

/** Debounced (~500ms) PUT of the latest whole row. Bursts (e.g. setMonthCapital
 *  ×20) collapse into one write; the last snapshot wins. Fire-and-forget: a
 *  failure toasts, no rollback. Caveat of debouncing: a settings/MTF-value edit
 *  made within ~500ms of closing the tab may not reach the server — but the row
 *  that eventually lands is always the COMPLETE four columns, never a partial. */
export function scheduleSettingsSync(): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    api.put("/api/settings", currentRow()).catch((e: unknown) =>
      toast(`Couldn't save settings: ${e instanceof Error ? e.message : String(e)}`, "error"),
    );
  }, 500);
}

/** Immediate PUT of an explicit complete row — used for first-run row creation,
 *  where hydrate awaits the result and handles the error itself. Cancels any
 *  pending debounce so this authoritative write is not clobbered. */
export function putCompleteSettings(row: SettingsRow): Promise<unknown> {
  if (timer) clearTimeout(timer);
  return api.put("/api/settings", row);
}
