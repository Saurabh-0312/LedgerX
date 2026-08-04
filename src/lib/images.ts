/** Phase 10 — screenshot helpers: client-side WebP conversion + authenticated R2
 *  access. `screenshotUrl` now holds EITHER a legacy `data:` URI (rendered as-is,
 *  D1) OR an R2 object key like `<userId>/<tradeId>-<ts>.webp` (fetched through the
 *  Worker with the bearer token, D2/D3). No image library, no presigned URLs. */

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const API_BASE =
  (import.meta as unknown as { env: { VITE_API_URL?: string } }).env.VITE_API_URL ??
  "http://localhost:8787";

const MAX_EDGE = 2400; // keep chart text legible; only downscale very large images
const WEBP_QUALITY = 0.92;

async function bearer(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not signed in");
  return token;
}

/** Is this a legacy inline data-URI (vs an R2 object key)? Pure. */
export const isDataUri = (value: string): boolean => value.startsWith("data:");

/** Pure: the URL a key/data-URI resolves to. data: → itself; key → the Worker
 *  endpoint (fetched separately with auth — never used directly in <img src>). */
export function screenshotSrc(value: string, apiBase: string = API_BASE): string {
  return isDataUri(value) ? value : `${apiBase}/api/screenshots/${value}`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode that image"));
    img.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** Convert an image File/Blob to a WebP Blob, downscaled so the longest edge is
 *  ≤ 1600px (D4). Falls back to JPEG if the browser can't encode WebP. */
export async function toWebp(input: Blob): Promise<Blob> {
  const url = URL.createObjectURL(input);
  try {
    const img = await loadImage(url);
    let width = img.naturalWidth || img.width;
    let height = img.naturalHeight || img.height;
    const longest = Math.max(width, height);
    if (longest > MAX_EDGE) {
      const scale = MAX_EDGE / longest;
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is unavailable");
    ctx.drawImage(img, 0, 0, width, height);
    const webp = await canvasToBlob(canvas, "image/webp", WEBP_QUALITY);
    if (webp) return webp;
    const jpeg = await canvasToBlob(canvas, "image/jpeg", WEBP_QUALITY);
    if (jpeg) return jpeg;
    throw new Error("Image encoding failed");
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Convert a legacy `data:` URI to a Blob (for the D6 migration). */
export function dataUriToBlob(uri: string): Blob {
  const comma = uri.indexOf(",");
  const meta = uri.slice(0, comma);
  const body = uri.slice(comma + 1);
  const mime = /data:(.*?)(;base64)?$/.exec(meta)?.[1] || "image/png";
  if (/;base64/.test(meta)) {
    const bin = atob(body);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }
  return new Blob([decodeURIComponent(body)], { type: mime });
}

/** Upload a screenshot Blob for a trade → returns the R2 object key. The Worker
 *  builds the key from the token + a sanitised trade id (D3); we never send one. */
export async function uploadScreenshot(tradeId: string, blob: Blob): Promise<string> {
  const res = await fetch(`${API_BASE}/api/screenshots/${encodeURIComponent(tradeId)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await bearer()}`, "Content-Type": blob.type || "image/webp" },
    body: blob,
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  const { key } = (await res.json()) as { key: string };
  return key;
}

/** Fetch an R2 screenshot with the bearer token and return an object URL for
 *  <img src>. `data:` values pass through unchanged. Caller revokes the URL. */
export async function screenshotObjectUrl(value: string): Promise<string> {
  if (isDataUri(value)) return value;
  const res = await fetch(screenshotSrc(value), { headers: { Authorization: `Bearer ${await bearer()}` } });
  if (!res.ok) throw new Error(`Load failed (${res.status})`);
  return URL.createObjectURL(await res.blob());
}

interface ShotState {
  src: string | null;
  loading: boolean;
  error: boolean;
}

/** Synchronous initial state — a data: URI resolves immediately (no first-frame
 *  flicker); an R2 key starts in `loading` so the effect can fetch it. */
const initialShot = (value: string | undefined): ShotState =>
  !value
    ? { src: null, loading: false, error: false }
    : isDataUri(value)
      ? { src: value, loading: false, error: false }
      : { src: null, loading: true, error: false };

/** Resolve a `screenshotUrl` (data: or R2 key) to a renderable src, fetching R2
 *  objects with auth and revoking the object URL on unmount/change. */
export function useScreenshotUrl(value: string | undefined): ShotState {
  const [state, setState] = useState<ShotState>(() => initialShot(value));

  useEffect(() => {
    if (!value || isDataUri(value)) {
      setState(initialShot(value)); // sync branches — no fetch
      return;
    }
    let cancelled = false;
    let objectUrl: string | null = null;
    setState({ src: null, loading: true, error: false });
    screenshotObjectUrl(value)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        setState({ src: url, loading: false, error: false });
      })
      .catch(() => {
        if (!cancelled) setState({ src: null, loading: false, error: true });
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [value]);

  return state;
}
