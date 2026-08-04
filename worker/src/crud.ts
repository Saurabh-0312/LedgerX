/** Shared CRUD registration for the collection entities (Phase 6). Every entity
 *  gets the same five verbs trades established in Phase 5, behaviour-identical:
 *  reads stream through unparsed, writes force user_id from the token, ids are
 *  URL-encoded, empty bulk-delete is a safe no-op, and PostgREST errors pass
 *  through. No options bag — one flat, obvious shape shared by all six. */

import type { Context, Hono } from "hono";
import type { Env } from "./index";

export const REST = (c: Context<Env>, path: string) => `${c.env.SUPABASE_URL}/rest/v1/${path}`;

/** The bearer token authMiddleware already validated for this request. */
export const bearer = (c: Context<Env>) => (c.req.header("Authorization") ?? "").slice(7).trim();

/** PostgREST headers — forward the caller's token so RLS applies. `extra` adds
 *  Content-Type / Prefer for writes. */
export const sb = (c: Context<Env>, extra: Record<string, string> = {}): Record<string, string> => ({
  apikey: c.env.SUPABASE_ANON_KEY,
  Authorization: `Bearer ${bearer(c)}`,
  ...extra,
});

export const WRITE = { "Content-Type": "application/json", Prefer: "return=representation" };
export const REPRESENT = { Prefer: "return=representation" };

/** Forward a PostgREST response verbatim — status + streamed body, no parsing. */
export const passthrough = (res: Response) =>
  new Response(res.body, { status: res.status, headers: { "content-type": "application/json" } });

/** Register GET / POST / PATCH:id / DELETE:id / DELETE(bulk) for one collection
 *  table at /api/<path>. `user_id` is always forced from the token; reads never
 *  parse the response body. */
export function registerCrud(app: Hono<Env>, path: string, table: string): void {
  // GET — all of the caller's rows. PASS-THROUGH (never parsed). RLS scopes; no
  // user_id filter (that would mask an RLS misconfiguration).
  app.get(`/api/${path}`, async (c) => {
    const res = await fetch(REST(c, `${table}?select=*`), { headers: sb(c) });
    return passthrough(res);
  });

  // POST — insert one row or an array. The request body is parsed (small); user_id
  // is forced to the token's id on every record — any client value is dropped.
  app.post(`/api/${path}`, async (c) => {
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
    const res = await fetch(REST(c, table), {
      method: "POST",
      headers: sb(c, WRITE),
      body: JSON.stringify(rows),
    });
    return passthrough(res);
  });

  // PATCH — partial update of one row. user_id and id can't be reassigned; the
  // URL param is the sole source of row identity.
  app.patch(`/api/${path}/:id`, async (c) => {
    let body: Record<string, unknown>;
    try {
      body = (await c.req.json()) as Record<string, unknown>;
    } catch {
      return c.json({ error: "invalid JSON body" }, 400);
    }
    delete body.user_id;
    delete body.id;
    const id = encodeURIComponent(c.req.param("id"));
    const res = await fetch(REST(c, `${table}?id=eq.${id}`), {
      method: "PATCH",
      headers: sb(c, WRITE),
      body: JSON.stringify(body),
    });
    return passthrough(res);
  });

  // DELETE one.
  app.delete(`/api/${path}/:id`, async (c) => {
    const id = encodeURIComponent(c.req.param("id"));
    const res = await fetch(REST(c, `${table}?id=eq.${id}`), { method: "DELETE", headers: sb(c, REPRESENT) });
    return passthrough(res);
  });

  // DELETE bulk — {"ids":[...]}. An empty/absent/all-falsy list is a safe no-op
  // (returns 200 [] without touching the DB) — never an unfiltered mass delete.
  app.delete(`/api/${path}`, async (c) => {
    let body: { ids?: unknown };
    try {
      body = (await c.req.json()) as { ids?: unknown };
    } catch {
      body = {};
    }
    const ids = Array.isArray(body.ids) ? body.ids.map((x) => String(x)).filter(Boolean) : [];
    if (ids.length === 0) return c.json([], 200);
    const list = ids.map((id) => encodeURIComponent(id)).join(",");
    const res = await fetch(REST(c, `${table}?id=in.(${list})`), { method: "DELETE", headers: sb(c, REPRESENT) });
    return passthrough(res);
  });
}
