/** user_settings singleton (Phase 6). One row per user (PK = user_id) holding
 *  goals / portfolioTargets / settings (jsonb) + mtfAccountValue. GET returns the
 *  caller's row as a 0-or-1 array — empty when none yet, never a 500. PUT upserts
 *  the whole row (create if missing, replace if present). No enumerate/delete —
 *  there is nothing to list or remove. */

import type { Hono } from "hono";
import type { Env } from "./index";
import { REST, sb, passthrough } from "./crud";

export function registerSettings(app: Hono<Env>): void {
  // GET — the caller's row (0 or 1). PASS-THROUGH: [] when no row exists yet, so a
  // brand-new user gets a sane empty result rather than a 500.
  app.get("/api/settings", async (c) => {
    const res = await fetch(REST(c, "user_settings?select=*"), { headers: sb(c) });
    return passthrough(res);
  });

  // PUT — upsert the whole row. user_id is forced from the token; the client sends
  // the complete object every time (D2 — no server-side field merging).
  app.put("/api/settings", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "invalid JSON body" }, 400);
    }
    const row = { ...(body as Record<string, unknown>), user_id: c.get("user").id };
    const res = await fetch(REST(c, "user_settings?on_conflict=user_id"), {
      method: "POST",
      headers: sb(c, { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=representation" }),
      body: JSON.stringify(row),
    });
    return passthrough(res);
  });
}
