/** LedgerX API — Cloudflare Worker (Hono). Phase 4: adds Supabase-JWT auth.
 *  Public: GET /health, GET / . Protected (Bearer token): everything under /api/*.
 *  No database yet — /api/me just echoes the authenticated user (Phases 5–7 add data). */

import { Hono } from "hono";
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

app.notFound((c) => c.json({ error: "not_found", service: "ledgerx-api" }, 404));

export default app;
