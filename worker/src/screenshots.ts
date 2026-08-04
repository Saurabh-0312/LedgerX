/** Phase 10 — trade screenshots in Cloudflare R2. Both routes are authenticated
 *  by the shared authMiddleware (/api/*). R2 has no RLS, so the Worker is the ONLY
 *  access control: keys are namespaced <userId>/… and every read verifies the
 *  prefix — a mismatch is 404 (never confirm another user's object exists). */

import type { Hono } from "hono";
import type { Env } from "./index";

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB post-conversion (raised for higher-quality WebP)
const CACHE = "private, max-age=31536000, immutable"; // keys are unique per upload

/** Keep only safe id chars so the built key can never escape the user's prefix. */
const sanitizeId = (id: string): string => id.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);

export function registerScreenshots(app: Hono<Env>): void {
  // POST /api/screenshots/:tradeId — raw image bytes → { key }. The Worker BUILDS
  // the key from the token + a sanitised trade id; a client-supplied key is never used.
  app.post("/api/screenshots/:tradeId", async (c) => {
    const userId = c.get("user").id;
    const tradeId = sanitizeId(c.req.param("tradeId"));
    if (!tradeId) return c.json({ error: "invalid trade id" }, 400);

    const len = Number(c.req.header("Content-Length") ?? "0");
    if (len > MAX_BYTES) return c.json({ error: "image too large (max 2MB)" }, 413);

    const bytes = await c.req.arrayBuffer(); // raw bytes, not base64
    if (bytes.byteLength === 0) return c.json({ error: "empty body" }, 400);
    if (bytes.byteLength > MAX_BYTES) return c.json({ error: "image too large (max 2MB)" }, 413);

    // Only ever store an image content-type (client-supplied, so clamp it).
    const type = c.req.header("Content-Type");
    const contentType = type && type.startsWith("image/") ? type : "image/webp";
    // Timestamp + random suffix so keys never collide (even same-ms / same-trade).
    const key = `${userId}/${tradeId}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.webp`;
    await c.env.SCREENSHOTS.put(key, bytes, {
      httpMetadata: { contentType, cacheControl: CACHE },
    });
    return c.json({ key });
  });

  // GET /api/screenshots/:uid/:file — stream the object. The key is exactly
  // <userId>/<file>; any prefix that isn't the caller's is 404 (not 403).
  app.get("/api/screenshots/:uid/:file", async (c) => {
    const userId = c.get("user").id;
    const key = `${c.req.param("uid")}/${c.req.param("file")}`;
    if (!key.startsWith(`${userId}/`)) return c.json({ error: "not_found" }, 404);

    const obj = await c.env.SCREENSHOTS.get(key);
    if (!obj) return c.json({ error: "not_found" }, 404);

    const headers = new Headers();
    obj.writeHttpMetadata(headers);
    headers.set("Cache-Control", CACHE);
    headers.set("X-Content-Type-Options", "nosniff");
    return new Response(obj.body, { headers }); // streamed, never buffered/base64
  });
}
