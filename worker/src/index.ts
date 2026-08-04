/** LedgerX API — Cloudflare Worker (Hono).
 *  Public: GET /health, GET / . Protected (Bearer token): everything under /api/*.
 *  Phase 4 added auth (/api/me); Phase 5 adds trades CRUD as a thin authenticated
 *  proxy to Supabase PostgREST — the caller's JWT is forwarded so Postgres RLS
 *  scopes every row to them, and reads stream through unparsed (flat CPU). */

import { Hono } from "hono";
import type { Context } from "hono";
import { cors } from "hono/cors";
import { createMiddleware } from "hono/factory";

type Bindings = {
  /** Comma-separated allow-list; exact origin or one with a `*` wildcard label. */
  CORS_ORIGINS: string;
  /** Supabase project URL, e.g. https://<ref>.supabase.co */
  SUPABASE_URL: string;
  /** Public anon/publishable key — safe to ship; RLS is the real boundary. */
  SUPABASE_ANON_KEY: string;
};

type Variables = {
  user: { id: string; email: string };
};

type Env = { Bindings: Bindings; Variables: Variables };

const app = new Hono<Env>();

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

/** Validate the Bearer token by asking Supabase who it belongs to (no local
 *  crypto — the network wait costs no Worker CPU). 200 → attach the user; else 401. */
const authMiddleware = createMiddleware<Env>(async (c, next) => {
  const authz = c.req.header("Authorization") ?? "";
  const token = authz.startsWith("Bearer ") ? authz.slice(7).trim() : "";
  if (!token) return c.json({ error: "missing bearer token" }, 401);

  const res = await fetch(`${c.env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: c.env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return c.json({ error: "invalid or expired token" }, 401);

  const u = (await res.json()) as { id: string; email: string | null };
  c.set("user", { id: u.id, email: u.email ?? "" });
  await next();
});

// Public
app.get("/", (c) => c.json({ service: "ledgerx-api", status: "ok" }));
app.get("/health", (c) =>
  c.json({ ok: true, service: "ledgerx-api", time: new Date().toISOString() }));

// Protected — everything under /api/* needs a valid Supabase token
app.use("/api/*", authMiddleware);
app.get("/api/me", (c) => {
  const user = c.get("user");
  return c.json({ userId: user.id, email: user.email });
});

// ── Trades API (Phase 5) ─────────────────────────────────────────────────────
// A thin authenticated proxy to PostgREST. The caller's validated JWT is
// forwarded on every call, so Postgres RLS decides which rows are visible — the
// Worker holds no service_role key. Reads pipe bytes straight through (never
// parsed) so CPU stays flat at any row count.

const REST = (c: Context<Env>, path: string) => `${c.env.SUPABASE_URL}/rest/v1/${path}`;

/** The bearer token authMiddleware already validated for this request. */
const bearer = (c: Context<Env>) => (c.req.header("Authorization") ?? "").slice(7).trim();

/** PostgREST headers — forward the caller's token so RLS applies. `extra` adds
 *  Content-Type / Prefer for writes. */
const sb = (c: Context<Env>, extra: Record<string, string> = {}): Record<string, string> => ({
  apikey: c.env.SUPABASE_ANON_KEY,
  Authorization: `Bearer ${bearer(c)}`,
  ...extra,
});

const WRITE = { "Content-Type": "application/json", Prefer: "return=representation" };
const REPRESENT = { Prefer: "return=representation" };

/** Forward a PostgREST response verbatim — status + streamed body, no parsing.
 *  Errors flow through unchanged (D4) so Phase 7 sees exactly what failed. */
const passthrough = (res: Response) =>
  new Response(res.body, { status: res.status, headers: { "content-type": "application/json" } });

// GET /api/trades — all of the caller's trades. PASS-THROUGH: the body is never
// read here, so CPU does not scale with row count. RLS does the user scoping —
// no user_id filter (that would mask an RLS misconfiguration).
app.get("/api/trades", async (c) => {
  const res = await fetch(REST(c, "trades?select=*"), { headers: sb(c) });
  return passthrough(res);
});

// POST /api/trades — insert one trade or an array. The request body is parsed
// (small), and user_id is forced to the token's id on every record (D1); any
// client-supplied user_id is dropped by the overwrite.
app.post("/api/trades", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }
  const uid = c.get("user").id;
  const rows = (Array.isArray(body) ? body : [body]).map((r) => ({
    ...(r as Record<string, unknown>),
    user_id: uid,
  }));
  const res = await fetch(REST(c, "trades"), {
    method: "POST",
    headers: sb(c, WRITE),
    body: JSON.stringify(rows),
  });
  return passthrough(res);
});

// PATCH /api/trades/:id — partial update of one trade. user_id is stripped so it
// can never be reassigned. The id is URL-encoded (client-supplied string).
app.patch("/api/trades/:id", async (c) => {
  let body: Record<string, unknown>;
  try {
    body = (await c.req.json()) as Record<string, unknown>;
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }
  delete body.user_id;
  delete body.id; // the URL param is the sole source of row identity
  const id = encodeURIComponent(c.req.param("id"));
  const res = await fetch(REST(c, `trades?id=eq.${id}`), {
    method: "PATCH",
    headers: sb(c, WRITE),
    body: JSON.stringify(body),
  });
  return passthrough(res);
});

// DELETE /api/trades/:id — delete one trade.
app.delete("/api/trades/:id", async (c) => {
  const id = encodeURIComponent(c.req.param("id"));
  const res = await fetch(REST(c, `trades?id=eq.${id}`), { method: "DELETE", headers: sb(c, REPRESENT) });
  return passthrough(res);
});

// DELETE /api/trades — bulk delete, body {"ids":[...]}. An empty or absent list
// is a safe no-op (never a mass delete), returning 200 [] without touching the DB.
app.delete("/api/trades", async (c) => {
  let body: { ids?: unknown };
  try {
    body = (await c.req.json()) as { ids?: unknown };
  } catch {
    body = {};
  }
  const ids = Array.isArray(body.ids) ? body.ids.map((x) => String(x)).filter(Boolean) : [];
  if (ids.length === 0) return c.json([], 200);
  const list = ids.map((id) => encodeURIComponent(id)).join(",");
  const res = await fetch(REST(c, `trades?id=in.(${list})`), { method: "DELETE", headers: sb(c, REPRESENT) });
  return passthrough(res);
});

app.notFound((c) => c.json({ error: "not_found", service: "ledgerx-api" }, 404));

export default app;
