/** Screenshot storage (Phases 10 + 11). Two one-time, user-initiated actions:
 *  • MIGRATE — convert inline data-URI screenshots to WebP in R2 (D6). Convert →
 *    upload → 🔴 read-back confirm → only THEN PATCH the trade.
 *  • RESTORE (Phase 11 §2) — repair trades whose cloud value is an R2 key that no
 *    longer resolves (e.g. migrated to simulated R2), by writing the original
 *    data-URI back FROM the localStorage backup. Only ever writes local→cloud;
 *    localStorage itself is strictly READ-ONLY. */

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ImageUp, Loader2, RotateCcw, ShieldCheck, XCircle } from "lucide-react";
import type { Trade } from "@/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useStore } from "@/store/useStore";
import { detectLegacy } from "@/lib/migrateLocal";
import { dataUriToBlob, screenshotObjectUrl, toWebp, uploadScreenshot } from "@/lib/images";

interface Result {
  id: string;
  symbol: string;
  ok: boolean;
  error?: string;
}

function ResultBlock({ label, results }: { label: string; results: Result[] }) {
  const ok = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  return (
    <div className="space-y-2">
      <div
        className={`flex items-start gap-2.5 rounded-[10px] border p-3 text-[12px] leading-relaxed ${
          failed.length ? "border-warning/40 bg-warning-soft/50 text-warning" : "border-profit/40 bg-profit-soft/40 text-profit"
        }`}
      >
        {failed.length ? (
          <XCircle size={15} className="mt-0.5 shrink-0" aria-hidden />
        ) : (
          <CheckCircle2 size={15} className="mt-0.5 shrink-0" aria-hidden />
        )}
        <span>
          {ok} {label}
          {failed.length ? ` · ${failed.length} left untouched` : ""}.
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
  );
}

export function ScreenshotsCard() {
  const trades = useStore((s) => s.trades);
  const updateTrade = useStore((s) => s.updateTrade);

  // localStorage data-URIs by trade id — READ ONLY, never written.
  const legacyById = useMemo(() => {
    const m = new Map<string, string>();
    const legacyTrades = detectLegacy()?.ledgerx?.state.trades ?? [];
    for (const t of legacyTrades) {
      if (typeof t.screenshotUrl === "string" && t.screenshotUrl.startsWith("data:")) m.set(t.id, t.screenshotUrl);
    }
    return m;
  }, []);

  // cloud trades whose screenshot is still an inline data-URI → migrate to R2
  const migrateCandidates = useMemo(
    () => trades.filter((t) => typeof t.screenshotUrl === "string" && t.screenshotUrl.startsWith("data:")),
    [trades],
  );
  // cloud trades whose screenshot is a KEY we also hold a local backup for → check
  const restoreCandidateCount = useMemo(
    () => trades.filter((t) => typeof t.screenshotUrl === "string" && !t.screenshotUrl.startsWith("data:") && legacyById.has(t.id)).length,
    [trades, legacyById],
  );

  const [broken, setBroken] = useState<Trade[]>([]);
  const [checked, setChecked] = useState(false);
  const [migrateResults, setMigrateResults] = useState<Result[] | null>(null);
  const [restoreResults, setRestoreResults] = useState<Result[] | null>(null);
  const [busy, setBusy] = useState<"" | "migrate" | "restore" | "check">("");

  // Determine which restore candidates actually FAIL to read back (broken keys).
  useEffect(() => {
    const candidates = trades.filter(
      (t) => typeof t.screenshotUrl === "string" && !t.screenshotUrl.startsWith("data:") && legacyById.has(t.id),
    );
    if (candidates.length === 0) {
      setBroken([]);
      setChecked(true);
      return;
    }
    let cancelled = false;
    setBusy("check");
    (async () => {
      const out: Trade[] = [];
      for (const t of candidates) {
        try {
          URL.revokeObjectURL(await screenshotObjectUrl(t.screenshotUrl as string));
        } catch (err) {
          // ONLY a genuine 404 proves the R2 object is gone (missing key / prefix
          // mismatch — see worker/src/screenshots.ts). A 5xx, a network blip, or a
          // still-401-after-refresh is transient and must NOT flag a valid key as
          // broken: restoring over it would overwrite a live key with a stale
          // data-URI (§2). screenshotObjectUrl throws `Load failed (<status>)`.
          if (err instanceof Error && /\(404\)/.test(err.message)) out.push(t);
        }
      }
      if (!cancelled) {
        setBroken(out);
        setChecked(true);
        setBusy("");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [trades, legacyById]);

  const nothingToShow =
    migrateCandidates.length === 0 && broken.length === 0 && !migrateResults && !restoreResults;
  if (nothingToShow && (checked || restoreCandidateCount === 0)) return null;

  async function restore() {
    setBusy("restore");
    const out: Result[] = [];
    for (const t of broken) {
      const dataUri = legacyById.get(t.id);
      if (!dataUri) {
        // no local copy — leave the broken key alone (evidence), never blank it
        out.push({ id: t.id, symbol: t.symbol, ok: false, error: "no local backup found" });
        continue;
      }
      try {
        updateTrade(t.id, { screenshotUrl: dataUri }); // local data-URI → cloud
        out.push({ id: t.id, symbol: t.symbol, ok: true });
      } catch (e) {
        out.push({ id: t.id, symbol: t.symbol, ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    }
    setRestoreResults(out);
    setBroken([]);
    setBusy("");
  }

  async function migrate() {
    setBusy("migrate");
    const out: Result[] = [];
    for (const t of migrateCandidates) {
      try {
        const webp = await toWebp(dataUriToBlob(t.screenshotUrl as string));
        const key = await uploadScreenshot(t.id, webp);
        URL.revokeObjectURL(await screenshotObjectUrl(key)); // 🔴 read-back confirm
        updateTrade(t.id, { screenshotUrl: key });
        out.push({ id: t.id, symbol: t.symbol, ok: true });
      } catch (e) {
        out.push({ id: t.id, symbol: t.symbol, ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    }
    setMigrateResults(out);
    setBusy("");
  }

  return (
    <Card
      title="Screenshot storage"
      subtitle="Move chart images to R2, or restore a broken one from your local backup"
      bodyClassName="space-y-4"
    >
      {/* RESTORE — cloud keys that no longer resolve, but we have a local copy of */}
      {broken.length > 0 && !restoreResults && (
        <div className="space-y-2.5">
          <div className="flex items-start gap-2.5 rounded-[10px] border border-warning/40 bg-warning-soft/50 p-3 text-[12px] leading-relaxed text-warning">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden />
            <span>
              {broken.length} trade{broken.length === 1 ? "" : "s"} point at a screenshot that no longer exists in R2.
              Restore the original from your local backup — then re-migrate it below.
            </span>
          </div>
          <Button variant="primary" icon={RotateCcw} onClick={restore} disabled={busy !== ""}>
            {busy === "restore" ? "Restoring…" : `Restore ${broken.length} from local backup`}
          </Button>
        </div>
      )}
      {restoreResults && <ResultBlock label="restored from your local backup" results={restoreResults} />}

      {/* MIGRATE — inline data-URIs → WebP in R2 */}
      {migrateCandidates.length > 0 && !migrateResults && (
        <div className="space-y-2.5">
          <p className="text-[13px] leading-relaxed text-muted">
            {migrateCandidates.length} screenshot{migrateCandidates.length === 1 ? "" : "s"} stored inline as base64.
            Convert to WebP, upload to R2, verify it reads back, and only then update the trade. Your local backup is
            never touched.
          </p>
          <Button variant="primary" icon={ImageUp} onClick={migrate} disabled={busy !== ""}>
            {busy === "migrate" ? "Migrating…" : `Migrate ${migrateCandidates.length} to R2`}
          </Button>
        </div>
      )}
      {migrateResults && <ResultBlock label="moved to R2 and verified" results={migrateResults} />}

      {busy === "migrate" || busy === "restore" ? (
        <div className="flex items-center gap-2 text-[13px] text-muted">
          <Loader2 size={15} className="animate-spin" aria-hidden />
          Working…
        </div>
      ) : busy === "check" ? (
        <div className="flex items-center gap-2 text-[12px] text-faint">
          <Loader2 size={14} className="animate-spin" aria-hidden />
          Checking cloud screenshots…
        </div>
      ) : null}

      <div className="flex items-start gap-2.5 rounded-[10px] border border-edge-soft bg-raised/60 p-3 text-[12px] leading-relaxed text-muted">
        <ShieldCheck size={15} className="mt-0.5 shrink-0 text-accent" aria-hidden />
        <span>
          Your local copy is only ever <span className="font-medium text-ink">read</span> here — never modified or deleted.
        </span>
      </div>
    </Card>
  );
}
