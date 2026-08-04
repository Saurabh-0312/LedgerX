/** Settings → Appearance: honest, display-only theme & accent rows (no fake toggles). */

import { Check, Moon, Sun } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

/** Miniature mock of the app in the dark palette. */
function DarkPreview() {
  return (
    <div aria-hidden className="h-20 overflow-hidden rounded-lg border border-edge bg-base p-2.5">
      <div className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
        <span className="h-1 w-8 rounded-full bg-raised" />
        <span className="ml-auto h-1 w-4 rounded-full bg-raised" />
      </div>
      <div className="mt-2 flex h-11 items-end gap-1 rounded-md border border-edge-soft bg-surface p-1.5">
        {[4, 7, 5, 9, 6, 8, 10, 7, 11, 8].map((h, i) => (
          <span
            key={i}
            className={`w-1.5 rounded-sm ${i % 4 === 2 ? "bg-loss/60" : "bg-profit/60"}`}
            style={{ height: h * 2.6 }}
          />
        ))}
      </div>
    </div>
  );
}

/** Miniature mock of a light palette — inline colors on purpose (no light tokens exist yet). */
function LightPreview() {
  return (
    <div aria-hidden className="h-20 overflow-hidden rounded-lg border border-edge p-2.5" style={{ background: "#eef0f3" }}>
      <div className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#b9bfca" }} />
        <span className="h-1 w-8 rounded-full" style={{ background: "#d5d9e0" }} />
        <span className="ml-auto h-1 w-4 rounded-full" style={{ background: "#d5d9e0" }} />
      </div>
      <div className="mt-2 h-11 rounded-md" style={{ background: "#ffffff", border: "1px solid #dcdfe6" }} />
    </div>
  );
}

export function AppearanceCard() {
  return (
    <Card title="Appearance" subtitle="Theme and accent — LedgerX ships dark-first.">
      <div className="space-y-5">
        <div>
          <h4 className="label-caps">Theme</h4>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-accent/50 bg-raised p-3 ring-1 ring-accent/25">
              <DarkPreview />
              <div className="mt-2.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
                  <Moon size={14} className="text-accent" aria-hidden />
                  Dark
                </span>
                <Badge tone="accent">Active</Badge>
              </div>
            </div>
            <div aria-disabled="true" className="rounded-xl border border-edge p-3 opacity-55">
              <LightPreview />
              <div className="mt-2.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
                  <Sun size={14} aria-hidden />
                  Light
                </span>
                <Badge tone="neutral">Planned</Badge>
              </div>
            </div>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-faint">
            Light theme is planned — the current palette is tuned for dark terminals, so switching is disabled until
            the light palette passes the same contrast bar.
          </p>
        </div>

        <div>
          <h4 className="label-caps">Accent color</h4>
          <div className="mt-2 flex items-center gap-3">
            <span
              aria-hidden
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent ring-2 ring-accent/30"
            >
              <Check size={14} className="text-white" />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-ink">Electric violet</p>
              <p className="text-[12px] text-muted">
                Fixed brand accent — charts and highlights are tuned around it, so it isn't configurable in this build.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
