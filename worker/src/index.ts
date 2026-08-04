/** LedgerX API — Cloudflare Worker (Hono). Phase 3 scaffold: health + CORS only.
 *  No database, no auth, no data routes — those arrive in Phases 4–6. */

import { Hono } from "hono";
import { cors } from "hono/cors";

type Bindings = {
  /** Comma-separated allow-list; an entry is either an exact origin or one with
   *  a `*` wildcard label (e.g. "https://*.pages.dev"). Set in wrangler.toml. */
  CORS_ORIGINS: string;
};

const app = new Hono<{ Bindings: Bindings }>();

/** Match one allow-list entry against an Origin. `*` expands to one-or-more DNS
 *  labels, fully anchored — so "https://*.pages.dev" allows "…/ledgerx.pages.dev"
 *  and "…/abc.ledgerx.pages.dev" but never "https://x.pages.dev.evil.com". */
function matches(pattern: string, origin: string): boolean {
  if (!pattern.includes("*")) return pattern === origin;
  const rx =
    "^" +
    pattern
      .split("*")
      .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("[a-z0-9-]+(?:\\.[a-z0-9-]+)*") +
    "$";
  return new RegExp(rx, "i").test(origin);
}

app.use("*", cors({
  origin: (origin, c) => {
    const raw = (c.env as Bindings).CORS_ORIGINS ?? "";
    const allowed = raw.split(",").map((s) => s.trim()).filter(Boolean);
    return allowed.some((p) => matches(p, origin)) ? origin : null;
  },
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  maxAge: 86400,
}));

app.get("/", (c) => c.json({ service: "ledgerx-api", status: "ok" }));

app.get("/health", (c) =>
  c.json({ ok: true, service: "ledgerx-api", time: new Date().toISOString() }));

app.notFound((c) => c.json({ error: "not_found", service: "ledgerx-api" }, 404));

export default app;
