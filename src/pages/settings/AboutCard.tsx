/** Settings → About: version, stack and where the data lives. */

import { useMemo } from "react";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useStore } from "@/store/useStore";
import { formatNumber } from "@/lib/format";

function storageFootprint(): string | null {
  try {
    const raw = window.localStorage.getItem("ledgerx-store");
    if (!raw) return null;
    const kb = new Blob([raw]).size / 1024;
    return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(kb))} KB`;
  } catch {
    return null;
  }
}

function AboutRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
      <dt className="w-20 shrink-0 text-[12px] font-medium text-muted">{label}</dt>
      <dd className="min-w-0 flex-1 text-[13px] leading-relaxed text-ink">{children}</dd>
    </div>
  );
}

export function AboutCard() {
  const tradeCount = useStore((s) => s.trades.length);
  const journalCount = useStore((s) => s.journal.length);

  // Approximate — persist writes after renders, so this trails by one action at most.
  const footprint = useMemo(() => storageFootprint(), [tradeCount, journalCount]);

  return (
    <Card title="About LedgerX" subtitle="Build details and where your data lives.">
      <dl className="space-y-3">
        <AboutRow label="Version">
          <span className="font-mono text-[13px]">1.0.0</span>
          <Badge tone="accent" className="ml-2">
            Local build
          </Badge>
        </AboutRow>
        <AboutRow label="Stack">
          Vite · React 18 · TypeScript · Tailwind CSS v4 · Recharts 2 · zustand · react-router 6
        </AboutRow>
        <AboutRow label="Storage">
          All data lives in your browser (localStorage) — nothing is sent to a server.
          {footprint && (
            <span className="text-muted">
              {" "}
              Currently ~{footprint} across {formatNumber(tradeCount)} trades and {formatNumber(journalCount)} journal
              entries.
            </span>
          )}
        </AboutRow>
      </dl>
    </Card>
  );
}
