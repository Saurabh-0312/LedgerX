/** Phase 10 (D6) — one-time migration of legacy inline data-URI screenshots to
 *  R2. Shown only when such trades exist. For each: convert → upload → 🔴 confirm
 *  it reads back from R2 → only THEN PATCH the trade. Any failure leaves that
 *  trade's data-URI completely untouched and is reported. Idempotent: once the
 *  values are R2 keys there is nothing left to migrate and the card hides. */

import { useMemo, useState } from "react";
import { CheckCircle2, ImageUp, Loader2, XCircle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useStore } from "@/store/useStore";
import { dataUriToBlob, screenshotObjectUrl, toWebp, uploadScreenshot } from "@/lib/images";

interface Result {
  id: string;
  symbol: string;
  ok: boolean;
  error?: string;
}

export function ScreenshotsCard() {
  const trades = useStore((s) => s.trades);
  const updateTrade = useStore((s) => s.updateTrade);
  const legacy = useMemo(
    () => trades.filter((t) => typeof t.screenshotUrl === "string" && t.screenshotUrl.startsWith("data:")),
    [trades],
  );
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);

  // Hidden when there is nothing to migrate and no results to show.
  if (legacy.length === 0 && !results) return null;

  async function migrate() {
    setRunning(true);
    const out: Result[] = [];
    for (const t of legacy) {
      try {
        const webp = await toWebp(dataUriToBlob(t.screenshotUrl as string));
        const key = await uploadScreenshot(t.id, webp);
        // 🔴 confirm the R2 object is READABLE before touching the trade (D6).
        const objUrl = await screenshotObjectUrl(key);
        URL.revokeObjectURL(objUrl);
        updateTrade(t.id, { screenshotUrl: key }); // only now does the value change
        out.push({ id: t.id, symbol: t.symbol, ok: true });
      } catch (e) {
        // leave this trade's data-URI completely untouched
        out.push({ id: t.id, symbol: t.symbol, ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    }
    setResults(out);
    setRunning(false);
  }

  const migrated = results?.filter((r) => r.ok).length ?? 0;
  const failed = results?.filter((r) => !r.ok) ?? [];

  return (
    <Card
      title="Move inline screenshots to cloud storage"
      subtitle="Convert legacy base64 chart images to WebP in R2"
      bodyClassName="space-y-4"
    >
      {legacy.length > 0 && !results && (
        <>
          <p className="text-[13px] leading-relaxed text-muted">
            {legacy.length} trade{legacy.length === 1 ? "" : "s"} still store the chart image inline as a base64 data-URI,
            bloating the row. Migrating converts each to WebP, uploads it to R2, verifies it reads back, and only then
            updates the trade. Your local backup is never touched.
          </p>
          <Button variant="primary" icon={ImageUp} onClick={migrate} disabled={running}>
            {running ? "Migrating…" : `Migrate ${legacy.length} screenshot${legacy.length === 1 ? "" : "s"}`}
          </Button>
        </>
      )}

      {running && (
        <div className="flex items-center gap-2 text-[13px] text-muted">
          <Loader2 size={15} className="animate-spin" aria-hidden />
          Converting, uploading and verifying…
        </div>
      )}

      {results && (
        <div className="space-y-2">
          <div
            className={`flex items-start gap-2.5 rounded-[10px] border p-3 text-[12px] leading-relaxed ${
              failed.length
                ? "border-warning/40 bg-warning-soft/50 text-warning"
                : "border-profit/40 bg-profit-soft/40 text-profit"
            }`}
          >
            {failed.length ? (
              <XCircle size={15} className="mt-0.5 shrink-0" aria-hidden />
            ) : (
              <CheckCircle2 size={15} className="mt-0.5 shrink-0" aria-hidden />
            )}
            <span>
              {migrated} screenshot{migrated === 1 ? "" : "s"} moved to R2 and verified
              {failed.length ? ` · ${failed.length} left untouched (retry below)` : ". Nothing more to do."}
            </span>
          </div>
          {failed.map((r) => (
            <div key={r.id} className="flex items-baseline justify-between gap-3 text-[12px] text-loss">
              <span>
                {r.symbol} ({r.id})
              </span>
              <span className="text-faint">{r.error}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
