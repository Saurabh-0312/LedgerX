/** Phase 9 — one-time "migrate my local data to the cloud" card. Renders nothing
 *  on origins without legacy data. Reads localStorage (via migrateLocal) strictly
 *  read-only; writes ONLY the new "ledgerx-migrated-at" flag on a verified success.
 *  The legacy keys are never modified. */

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck, UploadCloud, XCircle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import {
  MIGRATED_FLAG,
  detectLegacy,
  getCloudCounts,
  uploadAll,
  validateVersions,
  verifyAll,
  type UploadReport,
  type VerifyReport,
} from "@/lib/migrateLocal";

type Status = "preview" | "confirm" | "running" | "success" | "failed" | "error" | "migrated";

export function MigrationCard() {
  const detected = useMemo(() => detectLegacy(), []);
  const [migratedAt, setMigratedAt] = useState<string | null>(() => localStorage.getItem(MIGRATED_FLAG));
  const [status, setStatus] = useState<Status>(() => (localStorage.getItem(MIGRATED_FLAG) ? "migrated" : "preview"));
  const [upload, setUpload] = useState<UploadReport | null>(null);
  const [verify, setVerify] = useState<VerifyReport | null>(null);
  const [cloud, setCloud] = useState<{ total: number; byKey: Record<string, number> } | null>(null);
  const [errMsg, setErrMsg] = useState("");

  // D: hidden entirely on cloud-only origins (no legacy keys).
  if (!detected) return null;

  const version = validateVersions(detected);
  const c = detected.counts;
  const rows: Array<[string, number]> = [
    ["Trades", c.trades],
    ["Accounts", c.accounts],
    ["Cash transactions", c.cashTransactions],
    ["Journal entries", c.journal],
    ["Watchlist", c.watchlist],
    ["Monthly targets", c.monthlyTargets],
    ["MTF positions", c.mtfPositions],
    ["MTF brokers", c.mtfBrokers],
  ];
  const shown = rows.filter(([, n]) => n > 0);
  const total = shown.reduce((s, [, n]) => s + n, 0);

  async function runMigration(skipCloudCheck = false) {
    if (!detected || !version.ok) return;
    setStatus("running");
    try {
      // D8 — refuse a surprise write into a non-empty cloud (unless already migrated).
      if (!migratedAt && !skipCloudCheck) {
        const counts = await getCloudCounts(api);
        if (counts.total > 0) {
          setCloud(counts);
          setStatus("confirm");
          return;
        }
      }
      const up = await uploadAll(detected, api); // idempotent: id-skip per collection
      setUpload(up);
      const vr = await verifyAll(detected, api);
      setVerify(vr);
      if (vr.pass) {
        const now = new Date().toISOString();
        localStorage.setItem(MIGRATED_FLAG, now); // NEW key only — never the legacy keys
        setMigratedAt(now);
        setStatus("success");
      } else {
        setStatus("failed");
      }
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  }

  // "Run again" after a completed migration → verify only, uploads nothing (D3).
  async function reverify() {
    if (!detected) return;
    setStatus("running");
    try {
      const vr = await verifyAll(detected, api);
      setVerify(vr);
      setStatus(vr.pass ? "success" : "failed");
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  }

  return (
    <Card
      title="Migrate this browser's data to the cloud"
      subtitle="A one-time upload of the trades, positions and settings still stored locally here"
      bodyClassName="space-y-4"
    >
      {/* what will be uploaded */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-3">
        {shown.map(([label, n]) => (
          <div key={label} className="flex items-baseline justify-between gap-2 text-[13px]">
            <span className="text-muted">{label}</span>
            <span className="tnum font-semibold text-ink">{n}</span>
          </div>
        ))}
      </div>

      {/* version mismatch — hard abort (D1) */}
      {!version.ok ? (
        <div className="flex items-start gap-2.5 rounded-[10px] border border-loss/40 bg-loss-soft/50 p-3 text-[12px] leading-relaxed text-loss">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden />
          <span>{version.reason}</span>
        </div>
      ) : status === "confirm" ? (
        /* D8 — cloud already has data */
        <div className="space-y-3">
          <div className="flex items-start gap-2.5 rounded-[10px] border border-warning/40 bg-warning-soft/50 p-3 text-[12px] leading-relaxed text-warning">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden />
            <span>
              Your cloud account already holds <span className="font-semibold">{cloud?.total}</span> record(s). Migrating is safe —
              records whose id already exists are skipped, never duplicated — but confirm you want to proceed.
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="primary" icon={UploadCloud} onClick={() => runMigration(true)}>
              Migrate anyway
            </Button>
            <Button variant="ghost" onClick={() => setStatus("preview")}>
              Cancel
            </Button>
          </div>
        </div>
      ) : status === "running" ? (
        <div className="flex items-center gap-2 text-[13px] text-muted">
          <Loader2 size={15} className="animate-spin" aria-hidden />
          Uploading and verifying…
        </div>
      ) : status === "success" || status === "migrated" ? (
        <div className="space-y-3">
          <div className="flex items-start gap-2.5 rounded-[10px] border border-profit/40 bg-profit-soft/40 p-3 text-[12px] leading-relaxed text-profit">
            <CheckCircle2 size={15} className="mt-0.5 shrink-0" aria-hidden />
            <span>
              {status === "migrated" ? "Already migrated" : "Migration complete and verified"}
              {migratedAt && <> · {new Date(migratedAt).toLocaleString()}</>}. Every record was checked field-by-field against the cloud.
            </span>
          </div>
          {verify && <VerifyList report={verify} />}
          {upload && (
            <p className="text-[12px] text-faint">
              Uploaded{" "}
              {upload.collections.filter((x) => x.uploaded > 0).map((x) => `${x.uploaded} ${x.label.toLowerCase()}`).join(", ") || "nothing new"}
              {upload.settingsUploaded ? " · settings" : ""}.
            </p>
          )}
          <Button variant="ghost" onClick={reverify}>
            Re-verify against the cloud
          </Button>
        </div>
      ) : status === "failed" ? (
        <div className="space-y-3">
          <div className="flex items-start gap-2.5 rounded-[10px] border border-loss/50 bg-loss-soft/60 p-3 text-[12px] leading-relaxed text-loss">
            <XCircle size={15} className="mt-0.5 shrink-0" aria-hidden />
            <span className="font-medium">Verification FAILED — the cloud does not match your local data. Not marking as migrated.</span>
          </div>
          {verify && <VerifyList report={verify} />}
        </div>
      ) : status === "error" ? (
        <div className="space-y-3">
          <div className="flex items-start gap-2.5 rounded-[10px] border border-loss/40 bg-loss-soft/50 p-3 text-[12px] leading-relaxed text-loss">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden />
            <span>{errMsg || "Something went wrong. Nothing was marked as migrated; your local data is untouched."}</span>
          </div>
          <Button variant="primary" onClick={() => runMigration()}>
            Try again
          </Button>
        </div>
      ) : (
        /* preview */
        <Button variant="primary" icon={UploadCloud} onClick={() => runMigration()}>
          Migrate {total} record{total === 1 ? "" : "s"} to the cloud
        </Button>
      )}

      {/* 🔴 the legacy copy is always safe */}
      <div className="flex items-start gap-2.5 rounded-[10px] border border-edge-soft bg-raised/60 p-3 text-[12px] leading-relaxed text-muted">
        <ShieldCheck size={15} className="mt-0.5 shrink-0 text-accent" aria-hidden />
        <span>
          Your original local copy stays exactly where it is — this only <span className="font-medium text-ink">reads</span> it. Nothing here
          ever deletes or changes it. Keep it as a backup for as long as you like.
        </span>
      </div>
    </Card>
  );
}

function VerifyList({ report }: { report: VerifyReport }) {
  return (
    <div className="space-y-1">
      {report.collections
        .filter((r) => r.total > 0 || !r.pass)
        .map((r) => (
          <div key={r.key} className="flex items-baseline justify-between gap-3 text-[12px]">
            <span className="flex items-center gap-1.5">
              {r.pass ? (
                <CheckCircle2 size={13} className="text-profit" aria-hidden />
              ) : (
                <XCircle size={13} className="text-loss" aria-hidden />
              )}
              <span className={r.pass ? "text-muted" : "text-loss"}>{r.label}</span>
            </span>
            <span className={`tnum ${r.pass ? "text-faint" : "text-loss"}`}>
              {r.matched}/{r.total} {r.pass ? "verified" : `— ${r.failures.slice(0, 2).join("; ")}`}
            </span>
          </div>
        ))}
    </div>
  );
}
