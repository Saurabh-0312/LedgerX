/** Tiny fetch wrapper for the LedgerX Worker API (Phase 7). Attaches the
 *  Supabase access token, throws on non-2xx. No client generator, no React
 *  Query — just fetch. Store actions call these in the background (fire-and-forget). */

import { supabase } from "@/lib/supabase";

const BASE =
  (import.meta as unknown as { env: { VITE_API_URL?: string } }).env.VITE_API_URL ??
  "http://localhost:8787";

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not signed in");
  return { Authorization: `Bearer ${token}` };
}

/** PostgREST rejects a bulk insert whose objects don't all share the same keys
 *  (PGRST102). Real records legitimately differ — only Closed trades carry
 *  exitPrice, only some carry screenshotUrl — so pad every element of an insert
 *  array to the union of keys, using null for absent ones. POST only: doing this
 *  on PATCH/PUT would null out fields the caller never meant to touch. */
function padInsertArray(body: unknown): unknown {
  if (!Array.isArray(body) || body.length < 2) return body;
  const rows = body as Record<string, unknown>[];
  if (!rows.every((r) => r !== null && typeof r === "object" && !Array.isArray(r))) return body;
  const keys = new Set<string>();
  for (const r of rows) for (const k of Object.keys(r)) keys.add(k);
  return rows.map((r) => {
    const out: Record<string, unknown> = {};
    for (const k of keys) out[k] = r[k] === undefined ? null : r[k];
    return out;
  });
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers = await authHeaders();
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.text()).slice(0, 300);
    } catch {
      /* ignore */
    }
    throw new Error(`${method} ${path} → ${res.status}${detail ? `: ${detail}` : ""}`);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T = unknown>(path: string, body: unknown) => request<T>("POST", path, padInsertArray(body)),
  patch: <T = unknown>(path: string, body: unknown) => request<T>("PATCH", path, body),
  put: <T = unknown>(path: string, body: unknown) => request<T>("PUT", path, body),
  del: <T = unknown>(path: string, body?: unknown) => request<T>("DELETE", path, body),
};
